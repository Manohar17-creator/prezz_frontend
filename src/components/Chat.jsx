import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, IconButton, Typography, Alert, List, ListItem } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import localforage from 'localforage';
import moment from 'moment';
import axios from 'axios';

const Chat = () => {
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const classCode = localStorage.getItem('classcode') || '';
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('token');
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPhoto, setChatPhoto] = useState(null);
  const [error, setError] = useState(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('user_name') || 'Unknown');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });
        const { username, email } = response.data;
        const name = username || email || 'Unknown';
        setUserName(name);
        localStorage.setItem('user_name', name);
      } catch (err) {
        console.error('Error fetching username:', err);
      }
    };

    if (token) {
      fetchUserName();
    }

    if (!classCode || !userId) {
      setError('Class code or user ID not found. Please log in again.');
      navigate('/login', { replace: true });
      return;
    }
    setIsLoadingChat(true);

    const room = `class_${classCode}`;
    const messagesRef = collection(db, `chats/${room}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc')); // Ascending order

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      const promises = []; // Collect promises for media URL processing

      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate()
          : new Date(data.createdAt || Date.now());

        const messageData = {
          id: doc.id,
          userId: data.userId,
          userName: data.userName || 'Unknown',
          message: data.message,
          mediaUrl: data.mediaUrl,
          createdAt,
          localMediaUrl: null
        };

        if (data.mediaUrl) {
          const promise = localforage.getItem(`chat_${data.mediaUrl}`).then((cachedPhoto) => {
            if (!cachedPhoto) {
              return fetch(data.mediaUrl)
                .then((response) => {
                  if (!response.ok) throw new Error('Failed to fetch media');
                  return response.blob();
                })
                .then((blob) => {
                  return localforage.setItem(`chat_${data.mediaUrl}`, blob).then(() => {
                    messageData.localMediaUrl = URL.createObjectURL(blob);
                  });
                })
                .catch((err) => {
                  console.error('Error caching photo:', err);
                  messageData.localMediaUrl = data.mediaUrl;
                });
            } else {
              messageData.localMediaUrl = URL.createObjectURL(cachedPhoto);
              return Promise.resolve();
            }
          });
          promises.push(promise);
        }

        messageList.push(messageData);
      });

      // Wait for all media URL processing to complete
      Promise.all(promises).then(() => {
        messageList.sort((a, b) => a.createdAt - b.createdAt);
        console.log('onSnapshot updated with messages:', messageList.length);
        console.log('Sorted messages:', messageList.map(m => ({ id: m.id, createdAt: m.createdAt.toISOString() })));
        setMessages(messageList);
        setIsLoadingChat(false);
        scrollToBottom();
      }).catch((error) => {
        console.error('Error processing media URLs:', error);
        setError('Failed to load some media in messages');
        setIsLoadingChat(false);
      });
    }, (error) => {
      console.error('Error fetching messages:', error);
      setError('Failed to load chat messages');
      setIsLoadingChat(false);
    });

    return () => unsubscribe();
  }, [classCode, userId, navigate, token]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !chatPhoto) {
      setError('Message or photo required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!classCode || !userId) {
      setError('Class code or user ID not found. Please log in again.');
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Please log in to send messages');
        navigate('/login', { replace: true });
        return;
      }

      let mediaUrl = null;
      if (chatPhoto) {
        if (!(chatPhoto instanceof File)) {
          throw new Error('Invalid file selected. Please select an image.');
        }
        const fileName = `${Date.now()}-${chatPhoto.name}`;
        const storageRef = ref(storage, `chat/${classCode}/${fileName}`);
        await uploadBytes(storageRef, chatPhoto);
        mediaUrl = await getDownloadURL(storageRef);
      }

      const room = `class_${classCode}`;
      const messagesRef = collection(db, `chats/${room}/messages`);
      await addDoc(messagesRef, {
        message: newMessage.trim() || null,
        userId: userId.toString(),
        userName: userName,
        class_code: classCode,
        mediaUrl,
        createdAt: serverTimestamp()
      });

      setNewMessage('');
      setChatPhoto(null);
      scrollToBottom();
    } catch (error) {
      console.error('Send message error:', error);
      setError(
        error.code === 'storage/unauthorized'
          ? 'Unable to upload photo due to permissions. Please check your settings.'
          : error.message || 'Failed to send message'
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Class Chat ({classCode})
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {isLoadingChat ? (
        <Typography>Loading chat...</Typography>
      ) : (
        <List
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            p: 2,
            height: '60vh',
            overflowY: 'auto',
            mb: 2
          }}
        >
          {messages.map((msg) => (
            <ListItem
              key={msg.id}
              sx={{
                display: 'flex',
                justifyContent: msg.userId === userId ? 'flex-end' : 'flex-start',
                mb: 2
              }}
            >
              <Box
                sx={{
                  maxWidth: '70%',
                  bgcolor: msg.userId === userId ? '#007AFF' : '#E5E5EA',
                  color: msg.userId === userId ? 'white' : 'black',
                  borderRadius: 3,
                  p: 1
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {msg.userName}
                </Typography>
                {msg.message && <Typography variant="body1">{msg.message}</Typography>}
                {msg.mediaUrl && (
                  <Box sx={{ mt: 1 }}>
                    <img
                      src={msg.localMediaUrl || msg.mediaUrl}
                      alt="Chat media"
                      style={{ maxWidth: '100%', borderRadius: 8 }}
                      onError={() => console.error('Failed to load image:', msg.mediaUrl)}
                    />
                  </Box>
                )}
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {moment(msg.createdAt).format('MMM D, h:mm A')}
                </Typography>
              </Box>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      )}
      <Box component="form" onSubmit={sendMessage} sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          fullWidth
          variant="outlined"
          sx={{ mr: 1 }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setChatPhoto(e.target.files[0])}
          style={{ display: 'none' }}
          id="chat-photo-upload"
        />
        <label htmlFor="chat-photo-upload">
          <IconButton component="span" aria-label="Upload photo">
            <AttachFileIcon />
          </IconButton>
        </label>
        <IconButton type="submit" color="primary" aria-label="Send message">
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default Chat;