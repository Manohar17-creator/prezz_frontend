import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MaterialDashboard from '../Material/MaterialDashboard';
import { Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab, Box, Button, TextField, Select, MenuItem, Typography, Alert } from '@mui/material';
import { db, storage, auth } from '../../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import localforage from 'localforage';
import { IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import moment from 'moment';
import { jwtDecode } from 'jwt-decode';

// --- Move ChatTab to top-level (stable identity) to avoid remount on every parent render ---
const ChatTab = React.memo(function ChatTab({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  isLoadingChat,
  chatPhoto,
  setChatPhoto,
  userId,
  classCode,
  error
}) {
  const inputRef = useRef(null);

  // keep focus on input when ChatTab mounts
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleChange = (e) => {
    setNewMessage(e.target.value);
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
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          p: 2,
          height: '60vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          mb: 2,
        }}
      >
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              justifyContent: msg.userId?.toString() === userId?.toString() ? 'flex-end' : 'flex-start',
              mb: 2,
            }}
          >
            <Box
              sx={{
                maxWidth: '70%',
                bgcolor: msg.userId?.toString() === userId?.toString() ? '#007AFF' : '#E5E5EA',
                color: msg.userId?.toString() === userId?.toString() ? 'white' : 'black',
                borderRadius: 3,
                p: 1,
                position: 'relative',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                {msg.userName}
              </Typography>
              {msg.message && (
                <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                  {msg.message}
                </Typography>
              )}
              {msg.mediaUrl && (
                <Box sx={{ mt: 1 }}>
                  <img
                    src={msg.localMediaUrl || msg.mediaUrl}
                    alt="Chat media"
                    style={{ maxWidth: '100%', borderRadius: 8 }}
                  />
                </Box>
              )}
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {moment(msg.createdAt).format('MMM D, h:mm A')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '8px 16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <TextField
          inputRef={inputRef}
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          fullWidth
          variant="standard"
          size="medium"
          sx={{
            mr: 2,
            '& .MuiInput-root': {
              fontSize: '1rem',
              '&:before, &:after': { display: 'none' },
            }
          }}
          InputProps={{
            disableUnderline: true,
          }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setChatPhoto(e.target.files[0])}
          style={{ display: 'none' }}
          id="chat-photo-upload"
        />
        <label htmlFor="chat-photo-upload">
          <IconButton
            component="span"
            aria-label="Upload photo"
            sx={{
              color: '#666',
              '&:hover': { color: '#1976d2' }
            }}
          >
            <AttachFileIcon />
          </IconButton>
        </label>
        <IconButton
          type="button"
          color="primary"
          aria-label="Send message"
          onClick={sendMessage}
          disabled={isLoadingChat}
          sx={{
            backgroundColor: '#1976d2',
            color: '#fff',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
            '&.Mui-disabled': {
              backgroundColor: '#ccc',
              color: '#fff'
            }
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
});
// --- end ChatTab ---

const RegularCRDashboard = () => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState('');
    const [selectedProfessors, setSelectedProfessors] = useState([]);
    const [deleteSubjectId, setDeleteSubjectId] = useState('');

    const [professors, setProfessors] = useState([]);
    const [newProfessor, setNewProfessor] = useState('');
    const [deleteProfessorId, setDeleteProfessorId] = useState('');

    const [timeSlots, setTimeSlots] = useState([]);
    const [newTimeSlot, setNewTimeSlot] = useState({ start_time: '', end_time: '' });
    const [deleteTimeSlotId, setDeleteTimeSlotId] = useState('');

    const [classCode, setClassCode] = useState(null);
    const [isLoadingClassCode, setIsLoadingClassCode] = useState(true);

    const [singleClass, setSingleClass] = useState({
        subject_id: '',
        specific_date: '',
        time_slot_id: '',
    });

    const [schedules, setSchedules] = useState([]);
    const [isFetchingSchedules, setIsFetchingSchedules] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        subject_id: '',
        start_date: '',
        end_date: '',
        day_of_week: '',
        time_slot_id: '',
        repeat_option: 'weekly',
    });

    const [holidays, setHolidays] = useState([]);
    const [newHoliday, setNewHoliday] = useState({ holiday_date: '', description: '' });
    const [lastAddedHoliday, setLastAddedHoliday] = useState(null);
    const [deletedClassesByHoliday, setDeletedClassesByHoliday] = useState({});
    const [selectedHolidayId, setSelectedHolidayId] = useState('');
    const [editHolidayDescription, setEditHolidayDescription] = useState('');

    const [semesterDates, setSemesterDates] = useState({
        semester_start_date: '',
        semester_end_date: ''
    });

    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatPhoto, setChatPhoto] = useState(null);
    const [chatMessages, setChatMessages] = useState([]); // used by ChatTab
    const [isLoadingChat, setIsLoadingChat] = useState(false); // previously missing
    const newMessageRef = useRef('');
    const userId = localStorage.getItem('user_id');
    const userName = localStorage.getItem('user_name') || 'User';

    const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
        const monday = new Date();
        monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
        monday.setHours(0, 0, 0, 0);
        const year = monday.getFullYear();
        const month = String(monday.getMonth() + 1).padStart(2, '0');
        const date = String(monday.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    });

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        return `${hours}:${minutes}`;
    };

    const fetchSchedules = async () => {
        if (isFetchingSchedules) return;
        setIsFetchingSchedules(true);
        try {
            const response = await fetch(`${API_URL}/api/class-schedules`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to fetch schedules: You do not have permission. Please ensure you are logged in as a CR.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            const schedulesData = await response.json();
            const normalizedSchedules = schedulesData.map(schedule => ({
                ...schedule,
                specific_date: schedule.specific_date && typeof schedule.specific_date === 'string' && schedule.specific_date.includes('T')
                    ? new Date(schedule.specific_date).toISOString().split('T')[0]
                    : schedule.specific_date,
                start_date: schedule.start_date && typeof schedule.start_date === 'string' && schedule.start_date.includes('T')
                    ? new Date(schedule.start_date).toISOString().split('T')[0]
                    : schedule.start_date,
                end_date: schedule.end_date && typeof schedule.end_date === 'string' && schedule.end_date.includes('T')
                    ? new Date(schedule.end_date).toISOString().split('T')[0]
                    : schedule.end_date
            }));
            setSchedules(normalizedSchedules);
        } catch (err) {
            setError('Failed to fetch schedules. Please log in again.');
            localStorage.removeItem('token');
            navigate('/login');
        } finally {
            setIsFetchingSchedules(false);
        }
    };

    // Basic chat initialization + send handler (minimal / client-side only to avoid extra API calls)
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          setIsLoadingChat(true);
          // optional: fetch existing messages from API if desired (avoid hitting rate limits while debugging)
          // const res = await fetch(`${API_URL}/api/chat/messages`, { headers: { Authorization: `Bearer ${token}` } });
          // const data = await res.json();
          // if (mounted) setChatMessages(data);
        } catch (err) {
          console.error('Chat init error', err);
        } finally {
          if (mounted) setIsLoadingChat(false);
        }
      })();
      return () => { mounted = false; };
    }, []);

    // keep ref in sync with state to avoid recreating callbacks on every keystroke
    useEffect(() => { newMessageRef.current = newMessage; }, [newMessage]);

    const sendMessage = useCallback(async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const messageText = (newMessageRef.current || '').trim();
      if (!messageText && !chatPhoto) return;
      if (!classCode) {
        setError('Cannot send: class code not available yet.');
        return;
      }

      try {
        setIsLoadingChat(true);
        const room = `class_${classCode}`;
        let mediaUrl = null;

        if (chatPhoto) {
          // upload to Firebase Storage
          const storagePath = `chats/${room}/${Date.now()}_${chatPhoto.name}`;
          const storageRefObj = ref(storage, storagePath);
          const uploadSnap = await uploadBytes(storageRefObj, chatPhoto);
          mediaUrl = await getDownloadURL(uploadSnap.ref);
        }

        // add message doc to Firestore — onSnapshot will pick it up and update `messages`
        await addDoc(collection(db, `chats/${room}/messages`), {
          userId,
          userName,
          message: messageText || '',
          mediaUrl: mediaUrl || null,
          createdAt: serverTimestamp()
        });

        // clear input AFTER successful write
        setNewMessage('');
        newMessageRef.current = '';
        setChatPhoto(null);
      } catch (err) {
        console.error('Failed to send chat message:', err);
        setError('Failed to send message. Try again.');
      } finally {
        setIsLoadingChat(false);
      }
    }, [chatPhoto, userName, classCode, userId]);
   
    useEffect(() => {
  const waitForUser = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    // Wait for Firebase auth state to sync
    const user = await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!user || localStorage.getItem('firebaseAuthenticated') !== 'true') {
      navigate('/login');
      return;
    }

    // Proceed with fetchData only if user is authenticated
    const fetchData = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user, redirecting to login');
      navigate('/login');
      return;
    }

    // Get fresh Firebase ID token
    const idToken = await currentUser.getIdToken(true);
    console.log('Fresh ID Token:', idToken);

    const [
      subjectsRes,
      timeSlotsRes,
      schedulesRes,
      professorsRes,
      holidaysRes,
      profileRes
    ] = await Promise.all([
      fetch(`${API_URL}/api/subjects`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      fetch(`${API_URL}/api/time-slots`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      fetch(`${API_URL}/api/class-schedules`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      fetch(`${API_URL}/api/professors`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      fetch(`${API_URL}/api/holidays`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      fetch(`${API_URL}/api/profile`, { headers: { 'Authorization': `Bearer ${idToken}` } })
    ]);

    if (!profileRes.ok) {
      console.log(`Profile request failed with status: ${profileRes.status}`);
      throw new Error(`Failed to fetch profile: ${profileRes.statusText}`);
    }

    if (profileRes.status === 401) {
      localStorage.clear();
      navigate('/login');
      return;
    }

    const responses = [subjectsRes, timeSlotsRes, schedulesRes, professorsRes, holidaysRes, profileRes];
    for (const res of responses) {
      if (res.status === 401 || res.status === 403) {
        console.warn('Protected API failed, retrying after 1s...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        setError('Failed to fetch data: Unauthorized access. Please try logging in again.');
        return;
      }
    }

    const [
      subjectsData, timeSlotsData, schedulesData, professorsData, holidaysData, profileData
    ] = await Promise.all(responses.map(res => res.json()));

    const sortedTimeSlots = [...timeSlotsData].sort((a, b) => {
      const timeA = new Date(`1970-01-01T${a.start_time.padStart(5, '0')}:00Z`);
      const timeB = new Date(`1970-01-01T${b.start_time.padStart(5, '0')}:00Z`);
      return timeA - timeB;
    });

    const normalizedSchedules = schedulesData.map(schedule => ({
      ...schedule,
      specific_date: schedule.specific_date && typeof schedule.specific_date === 'string' && schedule.specific_date.includes('T')
        ? new Date(schedule.specific_date).toISOString().split('T')[0]
        : schedule.specific_date,
      start_date: schedule.start_date && schedule.start_date.includes('T')
        ? new Date(schedule.start_date).toISOString().split('T')[0]
        : schedule.start_date,
      end_date: schedule.end_date && schedule.end_date.includes('T')
        ? new Date(schedule.end_date).toISOString().split('T')[0]
        : schedule.end_date
    }));

    const decodedToken = jwtDecode(idToken); // ✅ use the fresh token
    if (!decodedToken || !decodedToken.class_code || decodedToken.cr_type !== 'regular') {
      throw new Error('Invalid profile: You must be a Regular CR with a valid class code.');
    }

    const filteredHolidays = holidaysData.filter(holiday => holiday.class_code === decodedToken.class_code);

    setSubjects(subjectsData);
    setTimeSlots(sortedTimeSlots);
    setSchedules(normalizedSchedules);
    setProfessors(professorsData);
    setHolidays(filteredHolidays);
    setSemesterDates({
      semester_start_date: profileData.semester_start_date || '',
      semester_end_date: profileData.semester_end_date || ''
    });
    setClassCode(decodedToken.class_code);
    setIsLoadingClassCode(false);
  } catch (err) {
    console.error("Error in fetchData():", err);
    setError('Failed to fetch data. Please try logging in again.');
  }
};


    fetchData();
  };

  waitForUser();
}, [navigate, token]);
    
   useEffect(() => {
  if (!classCode || tabValue !== 4) return; // Use classCode, tabValue === 4 for Chat
  setIsLoadingChat(true);

  const room = `class_${classCode}`;
  const messagesRef = collection(db, `chats/${room}/messages`);
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const messageList = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const messageData = {
        id: doc.id,
        userId: data.userId,
        userName: data.userName || 'Unknown',
        message: data.message,
        mediaUrl: data.mediaUrl,
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate()
          : new Date(data.createdAt || Date.now()),
        localMediaUrl: null
      };
      if (data.mediaUrl) {
        try {
          const cachedPhoto = await localforage.getItem(`chat_photo_${data.mediaUrl}`);
          if (!cachedPhoto) {
            const response = await fetch(data.mediaUrl);
            if (!response.ok) throw new Error('Failed to fetch media');
            const blob = await response.blob();
            await localforage.setItem(`chat_photo_${data.mediaUrl}`, blob);
            messageData.localMediaUrl = URL.createObjectURL(blob);
          } else {
            messageData.localMediaUrl = URL.createObjectURL(cachedPhoto);
          }
        } catch (err) {
          console.error('Error caching photo:', err);
          messageData.localMediaUrl = data.mediaUrl;
        }
      }
      messageList.push(messageData);
    }
    messageList.sort((a, b) => {
       const ta = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
       const tb = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
       return ta - tb;
     });
    console.log('onSnapshot updated with messages:', messageList.length);
    setMessages(messageList);
    setIsLoadingChat(false);
  }, (err) => {
    console.error('Error fetching messages:', err);
    setError('Failed to load chat messages');
    setIsLoadingChat(false);
  });

  return () => unsubscribe();
}, [classCode, tabValue, navigate]);




    const handleAddSubject = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/subjects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newSubject, professorIds: selectedProfessors })
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to add subject: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add subject');
            }
            const data = await response.json();
            setSubjects([...subjects, data]);
            setNewSubject('');
            setSelectedProfessors([]);
            setError('Subject added successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteSubject = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/subjects/${deleteSubjectId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to delete subject: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete subject');
            }
            setSubjects(subjects.filter(subject => subject.id !== parseInt(deleteSubjectId)));
            setDeleteSubjectId('');
            setError('Subject deleted successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddProfessor = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/professors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newProfessor })
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to add professor: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add professor');
            }
            const data = await response.json();
            setProfessors([...professors, data]);
            setNewProfessor('');
            setError('Professor added successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteProfessor = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/professors/${deleteProfessorId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to delete professor: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete professor');
            }
            setProfessors(professors.filter(professor => professor.id !== parseInt(deleteProfessorId)));
            setDeleteProfessorId('');
            setError('Professor deleted successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddTimeSlot = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/time-slots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTimeSlot)
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to add time slot: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add time slot');
            }
            const data = await response.json();
            const exists = timeSlots.some(slot => 
                slot.start_time === data.start_time && slot.end_time === data.end_time
            );
            if (!exists) {
                const updatedTimeSlots = [...timeSlots, data].sort((a, b) => {
                    const timeA = new Date(`1970-01-01T${a.start_time.padStart(5, '0')}:00Z`);
                    const timeB = new Date(`1970-01-01T${b.start_time.padStart(5, '0')}:00Z`);
                    return timeA - timeB;
                });
                setTimeSlots(updatedTimeSlots);
            }
            setNewTimeSlot({ start_time: '', end_time: '' });
            setError('Time slot added successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteTimeSlot = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/time-slots/${deleteTimeSlotId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to delete time slot: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete time slot');
            }
            const updatedTimeSlots = [...timeSlots]
                .filter(slot => slot.id !== parseInt(deleteTimeSlotId))
                .sort((a, b) => {
                    const timeA = new Date(`1970-01-01T${a.start_time.padStart(5, '0')}:00Z`);
                    const timeB = new Date(`1970-01-01T${b.start_time.padStart(5, '0')}:00Z`);
                    return timeA - timeB;
                });
            setTimeSlots(updatedTimeSlots);
            setDeleteTimeSlotId('');
            setError('Time slot deleted successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddSingleClass = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const holidayExists = holidays.find(h => h.holiday_date === singleClass.specific_date);
            if (holidayExists) {
                throw new Error(`Cannot add/modify class: ${singleClass.specific_date} is a holiday (${holidayExists.description || 'Holiday'}).`);
            }

            if (!singleClass.subject_id) {
                throw new Error('Select a subject.');
            }

            const existingClass = schedules.find(s =>
                s.subject_id === parseInt(singleClass.subject_id) &&
                s.specific_date === singleClass.specific_date &&
                s.time_slot_id === parseInt(singleClass.time_slot_id) &&
                s.repeat_option === 'no-repeat'
            );

            const normalizedSpecificDate = singleClass.specific_date;
            const payload = {
                subject_id: singleClass.subject_id,
                specific_date: normalizedSpecificDate,
                time_slot_id: singleClass.time_slot_id,
                repeat_option: 'no-repeat'
            };

            let url = `${API_URL}/api/class-schedules`;
            let method = 'POST';
            let actionMessage = 'Class added successfully';

            if (existingClass) {
                if (existingClass.canceled) {
                    const deleteResponse = await fetch(`${API_URL}/api/class-schedules/${existingClass.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!deleteResponse.ok) {
                        const errorData = await deleteResponse.json();
                        throw new Error(errorData.error || 'Failed to remove existing cancellation');
                    }
                } else {
                    url = `${API_URL}/api/class-schedules/${existingClass.id}`;
                    method = 'PATCH';
                    actionMessage = 'Class modified successfully';
                    payload.canceled = false;
                }
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to add/modify class: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add/modify class');
            }
            const updatedClass = await response.json();
            setSchedules(prev => {
                const filteredSchedules = prev.filter(s => s.id !== updatedClass.id);
                return [...filteredSchedules, updatedClass];
            });
            await fetchSchedules();
            setSingleClass({ subject_id: '', specific_date: singleClass.specific_date, time_slot_id: '' });
            setError(actionMessage);
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleCancelSingleClass = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            let schedule = schedules.find(s =>
                s.subject_id === parseInt(singleClass.subject_id) &&
                s.specific_date === singleClass.specific_date &&
                s.time_slot_id === parseInt(singleClass.time_slot_id) &&
                (s.canceled === false || s.canceled === undefined || s.canceled === null) &&
                s.repeat_option === 'no-repeat'
            );

            if (schedule) {
                const response = await fetch(`${API_URL}/api/class-schedules/${schedule.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status === 401 || response.status === 403) {
                    setError('Failed to cancel class: You do not have permission.');
                    localStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
                if (response.status === 404) {
                    await fetchSchedules();
                    throw new Error('Class not found. It may have been deleted.');
                }
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to cancel class');
                }
                await fetchSchedules();
                setError('Class canceled successfully');
            } else {
                const selectedDate = new Date(singleClass.specific_date);
                selectedDate.setHours(0, 0, 0, 0);
                const dayIndex = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1;
                const selectedDayOfWeek = daysOfWeek[dayIndex];

                schedule = schedules.find(s =>
                    s.subject_id === parseInt(singleClass.subject_id) &&
                    s.time_slot_id === parseInt(singleClass.time_slot_id) &&
                    s.day_of_week === selectedDayOfWeek &&
                    s.start_date && s.end_date &&
                    (s.canceled === false || s.canceled === undefined || s.canceled === null) &&
                    !s.specific_date
                );

                if (schedule) {
                    const startDate = new Date(schedule.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(schedule.end_date);
                    endDate.setHours(0, 0, 0, 0);

                    if (selectedDate >= startDate && selectedDate <= endDate) {
                        const response = await fetch(`${API_URL}/api/class-schedules`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                subject_id: singleClass.subject_id,
                                specific_date: singleClass.specific_date,
                                time_slot_id: singleClass.time_slot_id,
                                repeat_option: 'no-repeat',
                                canceled: true
                            })
                        });
                        if (response.status === 401 || response.status === 403) {
                            setError('Failed to cancel class: You do not have permission.');
                            localStorage.removeItem('token');
                            navigate('/login');
                            return;
                        }
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to create cancellation entry');
                        }
                        await fetchSchedules();
                        setError('Semester class on this date canceled successfully');
                    } else {
                        throw new Error('No matching class found on this date within the semester schedule');
                    }
                } else {
                    throw new Error('No matching class found to cancel on this date');
                }
            }

            setSingleClass({ subject_id: '', specific_date: singleClass.specific_date, time_slot_id: '' });
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const adjustDatesToDayOfWeek = (startDate, endDate, dayOfWeek) => {
        const daysOfWeekMap = {
            'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
            'Friday': 5, 'Saturday': 6, 'Sunday': 0
        };
        const targetDay = daysOfWeekMap[dayOfWeek];
        
        let adjustedStart = new Date(startDate);
        let adjustedEnd = new Date(endDate);
        
        const startDay = adjustedStart.getDay();
        const startDiff = (targetDay - startDay + 7) % 7;
        if (startDiff !== 0) {
            adjustedStart.setDate(adjustedStart.getDate() + startDiff);
        }
        
        const endDay = adjustedEnd.getDay();
        const endDiff = (endDay - targetDay + 7) % 7;
        if (endDiff !== 0) {
            adjustedEnd.setDate(adjustedEnd.getDate() - endDiff);
        }
        
        return {
            adjustedStart: adjustedStart.toISOString().split('T')[0],
            adjustedEnd: adjustedEnd.toISOString().split('T')[0]
        };
    };

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            let payload = { ...newSchedule };
            if (newSchedule.day_of_week && newSchedule.start_date && newSchedule.end_date) {
                const { adjustedStart, adjustedEnd } = adjustDatesToDayOfWeek(
                    newSchedule.start_date,
                    newSchedule.end_date,
                    newSchedule.day_of_week
                );
                payload.start_date = adjustedStart;
                payload.end_date = adjustedEnd;

                const startDate = new Date(adjustedStart);
                const endDate = new Date(adjustedEnd);
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayIndex = currentDate.getDay();
                    const currentDayOfWeek = daysOfWeek[dayIndex === 0 ? 6 : dayIndex - 1];
                    if (currentDayOfWeek === newSchedule.day_of_week) {
                        const holidayExists = holidays.find(h => h.holiday_date === dateStr);
                        if (holidayExists) {
                            throw new Error(`Cannot add schedule: ${dateStr} is a holiday (${holidayExists.description || 'Holiday'}).`);
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }

            if (!payload.subject_id) {
                throw new Error('Select a subject.');
            }

            const matchingSchedule = schedules.find(schedule =>
                schedule.subject_id === parseInt(newSchedule.subject_id) &&
                schedule.day_of_week === newSchedule.day_of_week &&
                schedule.time_slot_id === parseInt(newSchedule.time_slot_id) &&
                (schedule.canceled === false || schedule.canceled === undefined || schedule.canceled === null) &&
                !schedule.specific_date
            );

            let url = `${API_URL}/api/class-schedules`;
            let method = 'POST';
            let actionMessage = 'Schedule added successfully';

            if (matchingSchedule) {
                url = `${API_URL}/api/class-schedules/${matchingSchedule.id}`;
                method = 'PATCH';
                actionMessage = 'Schedule modified successfully';
                payload = {
                    ...payload,
                    subject_id: matchingSchedule.subject_id,
                    day_of_week: matchingSchedule.day_of_week,
                    time_slot_id: matchingSchedule.time_slot_id,
                    repeat_option: matchingSchedule.repeat_option || 'weekly'
                };
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to save schedule: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save schedule');
            }
            await fetchSchedules();
            setNewSchedule({
                subject_id: '',
                start_date: newSchedule.start_date,
                end_date: newSchedule.end_date,
                day_of_week: '',
                time_slot_id: '',
                repeat_option: 'weekly'
            });
            setError(actionMessage);
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const existingHoliday = holidays.find(h => h.holiday_date === newHoliday.holiday_date);
            if (existingHoliday) {
                throw new Error(`A holiday already exists for ${newHoliday.holiday_date}: ${existingHoliday.description}`);
            }

            const response = await fetch(`${API_URL}/api/holidays`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newHoliday)
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to add holiday: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add holiday');
            }
            const data = await response.json();

            const holidayDate = newHoliday.holiday_date;
            const schedulesOnHoliday = schedules.filter(s => {
                if (s.specific_date) {
                    return s.specific_date === holidayDate;
                }
                if (s.day_of_week && s.start_date && s.end_date) {
                    const scheduleDayOfWeek = s.day_of_week;
                    const currentDate = new Date(holidayDate);
                    currentDate.setHours(0, 0, 0, 0);
                    const dayIndex = (currentDate.getDay() + 6) % 7;
                    const currentDayOfWeek = daysOfWeek[dayIndex];

                    if (scheduleDayOfWeek !== currentDayOfWeek) return false;

                    const startDate = new Date(s.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(s.end_date);
                    endDate.setHours(0, 0, 0, 0);

                    return currentDate >= startDate && currentDate <= endDate;
                }
                return false;
            });

            setDeletedClassesByHoliday(prev => ({
                ...prev,
                [data.id]: schedulesOnHoliday
            }));

            for (const schedule of schedulesOnHoliday) {
    try {
        const deleteResponse = await fetch(`${API_URL}/api/class-schedules/${schedule.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!deleteResponse.ok && deleteResponse.status !== 404) {
            const errorData = await deleteResponse.json();
            throw new Error(errorData.error || `Failed to delete schedule ID ${schedule.id}`);
        }
        // Continue even if 404 (schedule already deleted)
    } catch (error) {
        console.error(`Error deleting schedule ID ${schedule.id}:`, error);
        throw error; // Re-throw to stop holiday addition if non-404 error
    }
}

            const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!holidaysResponse.ok) {
                const errorData = await holidaysResponse.json();
                throw new Error(errorData.error || 'Failed to refetch holidays');
            }
            const updatedHolidaysData = await holidaysResponse.json();
            setHolidays(updatedHolidaysData);

            await fetchSchedules();
            setLastAddedHoliday(data);
            setNewHoliday({ holiday_date: '', description: '' });
            setError('Holiday added successfully and schedules removed');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleUndoHoliday = async () => {
        if (!lastAddedHoliday) return;
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/holidays/${lastAddedHoliday.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to undo holiday: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to undo holiday');
            }

            const deletedClasses = deletedClassesByHoliday[lastAddedHoliday.id] || [];
            for (const schedule of deletedClasses) {
                const payload = {
                    subject_id: schedule.subject_id || null,
                    specific_date: schedule.specific_date || null,
                    time_slot_id: schedule.time_slot_id,
                    repeat_option: schedule.repeat_option || 'no-repeat',
                    canceled: schedule.canceled || false,
                    day_of_week: schedule.day_of_week || null,
                    start_date: schedule.start_date || null,
                    end_date: schedule.end_date || null
                };
                const restoreResponse = await fetch(`${API_URL}/api/class-schedules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                if (!restoreResponse.ok) {
                    const errorData = await restoreResponse.json();
                    throw new Error(errorData.error || 'Failed to restore schedule');
                }
            }

            setDeletedClassesByHoliday(prev => {
                const newState = { ...prev };
                delete newState[lastAddedHoliday.id];
                return newState;
            });

            const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!holidaysResponse.ok) {
                const errorData = await holidaysResponse.json();
                throw new Error(errorData.error || 'Failed to refetch holidays');
            }
            const updatedHolidaysData = await holidaysResponse.json();
            setHolidays(updatedHolidaysData);

            await fetchSchedules();
            setLastAddedHoliday(null);
            setError('Holiday undone successfully and classes restored');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
            try {
                const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (holidaysResponse.ok) {
                    const updatedHolidaysData = await holidaysResponse.json();
                    setHolidays(updatedHolidaysData);
                }
            } catch (fetchError) {
                console.error('Failed to refetch holidays:', fetchError);
            }
        }
    };

    const handleEditHoliday = async (e) => {
        e.preventDefault();
        if (!selectedHolidayId) {
            setError('Please select a holiday to edit');
            return;
        }
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/holidays/${selectedHolidayId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ description: editHolidayDescription })
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to update holiday: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update holiday');
            }
            const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!holidaysResponse.ok) {
                const errorData = await holidaysResponse.json();
                throw new Error(errorData.error || 'Failed to refetch holidays');
            }
            const updatedHolidaysData = await holidaysResponse.json();
            setHolidays(updatedHolidaysData);
            setSelectedHolidayId('');
            setEditHolidayDescription('');
            setError('Holiday updated successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteHoliday = async (e) => {
        e.preventDefault();
        if (!selectedHolidayId) {
            setError('Please select a holiday to delete');
            return;
        }
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/holidays/${selectedHolidayId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to delete holiday: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete holiday');
            }
            const deletedClasses = deletedClassesByHoliday[selectedHolidayId] || [];
            for (const schedule of deletedClasses) {
                const payload = {
                    subject_id: schedule.subject_id || null,
                    specific_date: schedule.specific_date || null,
                    time_slot_id: schedule.time_slot_id,
                    repeat_option: schedule.repeat_option || 'no-repeat',
                    canceled: schedule.canceled || false,
                    day_of_week: schedule.day_of_week || null,
                    start_date: schedule.start_date || null,
                    end_date: schedule.end_date || null
                };
                const restoreResponse = await fetch(`${API_URL}/api/class-schedules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                if (!restoreResponse.ok) {
                    const errorData = await restoreResponse.json();
                    throw new Error(errorData.error || 'Failed to restore schedule');
                }
            }
            setDeletedClassesByHoliday(prev => {
                const newState = { ...prev };
                delete newState[selectedHolidayId];
                return newState;
            });
            const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!holidaysResponse.ok) {
                const errorData = await holidaysResponse.json();
                throw new Error(errorData.error || 'Failed to refetch holidays');
            }
            const updatedHolidaysData = await holidaysResponse.json();
            setHolidays(updatedHolidaysData);
            await fetchSchedules();
            setSelectedHolidayId('');
            setEditHolidayDescription('');
            setLastAddedHoliday(null);
            setError('Holiday deleted successfully and classes restored');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
            try {
                const holidaysResponse = await fetch(`${API_URL}/api/holidays`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (holidaysResponse.ok) {
                    const updatedHolidaysData = await holidaysResponse.json();
                    setHolidays(updatedHolidaysData);
                }
            } catch (fetchError) {
                console.error('Failed to refetch holidays:', fetchError);
            }
        }
    };

    


    const handleUpdateSemesterDates = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/class-settings`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(semesterDates)
            });
            if (response.status === 401 || response.status === 403) {
                setError('Failed to update semester dates: You do not have permission.');
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update semester dates');
            }
            const profileResponse = await fetch(`${API_URL}/api/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!profileResponse.ok) {
                throw new Error('Failed to fetch updated profile data');
            }
            const updatedProfile = await profileResponse.json();
            setSemesterDates({
                semester_start_date: updatedProfile.semester_start_date || '',
                semester_end_date: updatedProfile.semester_end_date || ''
            });
            setError('Semester dates updated successfully');
            setTimeout(() => setError(null), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handlePreviousWeek = () => {
        const newStart = new Date(selectedWeekStart);
        newStart.setDate(newStart.getDate() - 7);
        const year = newStart.getFullYear();
        const month = String(newStart.getMonth() + 1).padStart(2, '0');
        const date = String(newStart.getDate()).padStart(2, '0');
        setSelectedWeekStart(`${year}-${month}-${date}`);
    };

    const handleNextWeek = () => {
        const newStart = new Date(selectedWeekStart);
        newStart.setDate(newStart.getDate() + 7);
        const year = newStart.getFullYear();
        const month = String(newStart.getMonth() + 1).padStart(2, '0');
        const date = String(newStart.getDate()).padStart(2, '0');
        setSelectedWeekStart(`${year}-${month}-${date}`);
    };

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysOfWeekShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const weekDates = daysOfWeek.map((day, index) => {
        const dateObj = new Date(selectedWeekStart);
        // This is the key change: set the start date to the first Monday of the week.
        const dayOffset = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
        const newDate = new Date(dateObj);
        newDate.setDate(dateObj.getDate() - dayOffset + index);
        const dateStr = newDate.toISOString().split('T')[0];

        return {
            day,
            date: dateStr,
            displayDate: newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    });

    const timetableData = useMemo(() => {
        return weekDates.map(({ day, date }) => {
            const holiday = holidays.find(h => h.holiday_date === date);
            const isHoliday = !!holiday;

            const singleClassCancellations = schedules.filter(s =>
                s.specific_date === date && s.canceled === true
            );

            const daySchedules = schedules.filter(schedule => {
                if (schedule.canceled === true) return false;

                if (schedule.specific_date) {
                    return schedule.specific_date === date;
                }

                if (schedule.day_of_week && schedule.start_date && schedule.end_date) {
                    const scheduleDayOfWeek = schedule.day_of_week;
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    const dayIndex = currentDate.getDay(); // 0 for Sunday, 1 for Monday, etc.
                    const currentDayOfWeek = daysOfWeek[dayIndex === 0 ? 6 : dayIndex - 1];

                    if (scheduleDayOfWeek !== currentDayOfWeek) return false;

                    const startDate = new Date(schedule.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(schedule.end_date);
                    endDate.setHours(0, 0, 0, 0);

                    if (currentDate < startDate || currentDate > endDate) return false;

                    const isCanceled = singleClassCancellations.some(c =>
                        c.subject_id === schedule.subject_id &&
                        c.time_slot_id === schedule.time_slot_id
                    );
                    if (isCanceled) return false;

                    return true;
                }

                return false;
            });

            const isDefaultHoliday = (day === 'Saturday' || day === 'Sunday') && !daySchedules.length && !holiday;

            return {
                day,
                date,
                isHoliday,
                isDefaultHoliday,
                holidayDescription: holiday ? (holiday.description || 'Holiday') : 'Holiday',
                schedules: timeSlots.map(slot => {
                    const slotSchedules = schedules.filter(s =>
                        s.specific_date === date && s.time_slot_id === slot.id
                    );
                    if (slotSchedules.length > 0) {
                        const latestSchedule = slotSchedules.reduce((latest, current) => {
                            if (current.canceled === true) return latest;
                            if (!latest || current.id > latest.id) return current;
                            return current;
                        }, null);

                        if (latestSchedule && latestSchedule.canceled !== true) {
                            const professors = latestSchedule.professor_names && latestSchedule.professor_names.length > 0 
                                ? latestSchedule.professor_names.join(', ') 
                                : 'No Professor';
                            return `${latestSchedule.subject_name} - ${professors}`;
                        }

                        const cancellation = slotSchedules.find(s => s.canceled === true);
                        if (cancellation) {
                            return 'Cancelled';
                        }
                    }

                    const schedule = daySchedules.find(s => s.time_slot_id === slot.id);
                    if (schedule) {
                        const professors = schedule.professor_names && schedule.professor_names.length > 0 
                            ? schedule.professor_names.join(', ') 
                            : 'No Professor';
                        return `${schedule.subject_name} - ${professors}`;
                    }
                    return null;
                })
            };
        });
    }, [weekDates, schedules, holidays, timeSlots]);

    const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <style>
            {`
                .elective-class {
                background-color: #e6f3ff;
                border-left: 4px solid #2196f3;
                }
                table {
                width: 100%;
                font-size: 14px;
                border-collapse: collapse;
                }
                th, td {
                border: 1px solid #d1d5db;
                padding: 8px;
                text-align: left;
                }
                @media (max-width: 600px) {
                table, thead, tbody, th, td, tr {
                    display: block;
                }
                thead tr {
                    position: absolute;
                    top: -9999px;
                    left: -9999px;
                }
                tr {
                    margin-bottom: 10px;
                    border: 1px solid #d1d5db;
                }
                td {
                    position: relative;
                    padding-left: 50%;
                }
                td:before {
                    content: attr(data-label);
                    position: absolute;
                    left: 8px;
                    width: 45%;
                    font-weight: bold;
                }
                }
            `}
            </style>
            <h1 className="text-3xl font-bold text-blue-800 mb-4 text-center">Regular Class Representative Dashboard</h1>
            {/* Top navigation tabs (now control local UI, not route navigation) */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="navigation tabs" centered>
                    <Tab label="Dashboard" />
                    <Tab label="Materials" />
                    <Tab label="Profile" />
                    <Tab label="Upload Timetable" />
                    <Tab label="Chat" />
                </Tabs>
            </Box>

            {error && <div className="text-red-600 mb-4 text-center">{error}</div>}

            {/* Main Dashboard content shown only when Dashboard tab is active */}
            {tabValue === 0 && (
              <>
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Your Class Code</h2>
                    {isLoadingClassCode ? (
                        <p className="text-center">Loading class code...</p>
                    ) : classCode ? (
                        <p className="text-center">Class Code: <strong>{classCode}</strong></p>
                    ) : (
                        <p className="text-center text-red-600">Class code not found. Please contact support.</p>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Subjects</h2>
                    <form onSubmit={handleAddSubject} className="mb-4">
                        <div className="flex flex-col space-y-4">
                            <TextField
                                label="Subject Name"
                                value={newSubject}
                                onChange={(e) => setNewSubject(e.target.value)}
                                required
                                variant="outlined"
                            />
                            <Select
                            multiple
                            value={selectedProfessors}
                            onChange={(e) => setSelectedProfessors(e.target.value.map(id => parseInt(id)))}
                            variant="outlined"
                            displayEmpty
                            renderValue={(selected) => selected.length ? selected.map(id => professors.find(p => p.id === id)?.name || 'Unknown').join(', ') : 'Select Professors'}
                        >
                            {professors && professors.length > 0 ? (
                                professors.map(professor => (
                                    <MenuItem key={professor.id} value={professor.id}>
                                        {professor.name}
                                    </MenuItem>
                                ))
                            ) : (
                                <MenuItem disabled>No professors available</MenuItem>
                            )}
                        </Select>
                            <Button type="submit" variant="contained" color="primary">
                                Add Subject
                            </Button>
                        </div>
                    </form>
                    <form onSubmit={handleDeleteSubject} className="flex space-x-4">
                        <Select
                            value={deleteSubjectId}
                            onChange={(e) => setDeleteSubjectId(e.target.value)}
                            displayEmpty
                            variant="outlined"
                            renderValue={(selected) => selected ? subjects.find(s => s.id === parseInt(selected))?.name : 'Select Subject to Delete'}
                        >
                            <MenuItem value="">Select Subject to Delete</MenuItem>
                            {subjects.map(subject => (
                                <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>
                            ))}
                        </Select>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={!deleteSubjectId}
                        >
                            Delete Subject
                        </Button>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Professors</h2>
                    <form onSubmit={handleAddProfessor} className="mb-4">
                        <div className="flex flex-col space-y-4">
                            <TextField
                                label="Professor Name"
                                value={newProfessor}
                                onChange={(e) => setNewProfessor(e.target.value)}
                                required
                                variant="outlined"
                            />
                            <Button type="submit" variant="contained" color="primary">
                                Add Professor
                            </Button>
                        </div>
                    </form>
                    <form onSubmit={handleDeleteProfessor} className="flex space-x-4">
                        <Select
                            value={deleteProfessorId}
                            onChange={(e) => setDeleteProfessorId(e.target.value)}
                            displayEmpty
                            variant="outlined"
                            renderValue={(selected) => selected ? professors.find(p => p.id === parseInt(selected))?.name : 'Select Professor to Delete'}
                        >
                            <MenuItem value="">Select Professor to Delete</MenuItem>
                            {professors.map(professor => (
                                <MenuItem key={professor.id} value={professor.id}>{professor.name}</MenuItem>
                            ))}
                        </Select>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={!deleteProfessorId}
                        >
                            Delete Professor
                        </Button>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Time Slots</h2>
                    <form onSubmit={handleAddTimeSlot} className="mb-4">
                        <div className="flex flex-col space-y-4">
                            <TextField
                                label="Start Time"
                                type="time"
                                value={newTimeSlot.start_time}
                                onChange={(e) => setNewTimeSlot({ ...newTimeSlot, start_time: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="End Time"
                                type="time"
                                value={newTimeSlot.end_time}
                                onChange={(e) => setNewTimeSlot({ ...newTimeSlot, end_time: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <Button type="submit" variant="contained" color="primary">
                                Add Time Slot
                            </Button>
                        </div>
                    </form>
                    <form onSubmit={handleDeleteTimeSlot} className="flex space-x-4">
                        <Select
                            value={deleteTimeSlotId}
                            onChange={(e) => setDeleteTimeSlotId(e.target.value)}
                            displayEmpty
                            variant="outlined"
                            renderValue={(selected) => selected ? `${formatTime(timeSlots.find(s => s.id === parseInt(selected))?.start_time)} - ${formatTime(timeSlots.find(s => s.id === parseInt(selected))?.end_time)}` : 'Select Time Slot to Delete'}
                        >
                            <MenuItem value="">Select Time Slot to Delete</MenuItem>
                            {timeSlots.map(slot => (
                                <MenuItem key={slot.id} value={slot.id}>
                                    {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                </MenuItem>
                            ))}
                        </Select>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={!deleteTimeSlotId}
                        >
                            Delete Time Slot
                        </Button>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Set Semester Dates</h2>
                    <form onSubmit={handleUpdateSemesterDates}>
                        <div className="flex flex-col space-y-4">
                            <TextField
                                label="Semester Start Date"
                                type="date"
                                value={semesterDates.semester_start_date}
                                onChange={(e) => setSemesterDates({ ...semesterDates, semester_start_date: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="Semester End Date"
                                type="date"
                                value={semesterDates.semester_end_date}
                                onChange={(e) => setSemesterDates({ ...semesterDates, semester_end_date: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <Button type="submit" variant="contained" color="primary">
                                Update Semester Dates
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Add/Modify Class</h2>
                    <form onSubmit={handleAddSingleClass}>
                        <div className="flex flex-col space-y-4">
                            <div>
                                <label className="block text-gray-700 mb-1">Subject</label>
                                <Select
                                    value={singleClass.subject_id || ''}
                                    onChange={(e) => setSingleClass({ ...singleClass, subject_id: e.target.value })}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected ? subjects.find(s => s.id === parseInt(selected))?.name || 'Unknown' : 'Select Subject'}
                                >
                                    <MenuItem value="">Select Subject</MenuItem>
                                    {subjects.map(subject => (
                                        <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>
                                    ))}
                                </Select>
                            </div>
                            <TextField
                                label="Date"
                                type="date"
                                value={singleClass.specific_date}
                                onChange={(e) => setSingleClass({ ...singleClass, specific_date: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <div>
                                <label className="block text-gray-700 mb-1">Time Slot</label>
                                <Select
                                    value={singleClass.time_slot_id}
                                    onChange={(e) => setSingleClass({ ...singleClass, time_slot_id: e.target.value })}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected ? `${formatTime(timeSlots.find(s => s.id === parseInt(selected))?.start_time)} - ${formatTime(timeSlots.find(s => s.id === parseInt(selected))?.end_time)}` : 'Select Time Slot'}
                                >
                                    <MenuItem value="">Select Time Slot</MenuItem>
                                    {timeSlots.map(slot => (
                                        <MenuItem key={slot.id} value={slot.id}>
                                            {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex space-x-4">
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    className="w-full"
                                >
                                    Add/Modify Class
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleCancelSingleClass}
                                    variant="contained"
                                    color="error"
                                    className="w-full"
                                >
                                    Cancel Class
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Add/Modify Semester Schedule</h2>
                    <form onSubmit={handleAddSchedule}>
                        <div className="flex flex-col space-y-4">
                            <div>
                                <label className="block text-gray-700 mb-1">Subject</label>
                                <Select
                                    value={newSchedule.subject_id || ''}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, subject_id: e.target.value })}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected ? subjects.find(s => s.id === parseInt(selected))?.name || 'Unknown' : 'Select Subject'}
                                >
                                    <MenuItem value="">Select Subject</MenuItem>
                                    {subjects.map(subject => (
                                        <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>
                                    ))}
                                </Select>
                            </div>
                            <TextField
                                label="Start Date"
                                type="date"
                                value={newSchedule.start_date}
                                onChange={(e) => setNewSchedule({ ...newSchedule, start_date: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="End Date"
                                type="date"
                                value={newSchedule.end_date}
                                onChange={(e) => setNewSchedule({ ...newSchedule, end_date: e.target.value })}
                                required
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                            />
                            <div>
                                <label className="block text-gray-700 mb-1">Day of Week</label>
                                <Select
                                    value={newSchedule.day_of_week}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected || 'Select Day of Week'}
                                >
                                    <MenuItem value="">Select Day of Week</MenuItem>
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                        <MenuItem key={day} value={day}>{day}</MenuItem>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-1">Time Slot</label>
                                <Select
                                    value={newSchedule.time_slot_id}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, time_slot_id: e.target.value })}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected ? `${formatTime(timeSlots.find(s => s.id ===parseInt(selected))?.start_time)} - ${formatTime(timeSlots.find(s => s.id ===parseInt(selected))?.end_time)}` : 'Select Time Slot'}
                                >
                                    <MenuItem value="">Select Time Slot</MenuItem>
                                    {timeSlots.map(slot => (
                                        <MenuItem key={slot.id} value={slot.id}>
                                            {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </div>
                            <Button type="submit" variant="contained" color="primary">
                                Add/Modify Class
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-blue-700">
                            Weekly Timetable ({`${weekDates[0].displayDate} - ${weekDates[6].displayDate}`})
                        </h2>
                        <div>
                            <Button
                                onClick={handlePreviousWeek}
                                variant="outlined"
                                className="mr-2"
                            >
                                Previous Week
                            </Button>
                            <Button
                                onClick={handleNextWeek}
                                variant="outlined"
                            >
                                Next Week
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-gray-300">
                            <thead>
                            <tr>
                                <th className="border border-gray-300 p-2">Day</th>
                                {timeSlots.map(slot => (
                                <th key={slot.id} className="border border-gray-300 p-2">
                                    {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {timetableData.map(({ day, date, isHoliday, isDefaultHoliday, holidayDescription, schedules }) => (
                                <tr key={date}>
                                <td data-label="Day" className="border border-gray-300 p-2">{day}</td>
                                {isHoliday || isDefaultHoliday ? (
                                    <td data-label="Schedule" colSpan={timeSlots.length} className="border border-gray-300 p-2 text-center">
                                    {holidayDescription}
                                    </td>
                                ) : (
                                    schedules.map((schedule, index) => (
                                    <td
                                        data-label={`${formatTime(timeSlots[index].start_time)} - ${formatTime(timeSlots[index].end_time)}`}
                                        key={`${date}-${index}`}
                                        className="border border-gray-300 p-2"
                                    >
                                        {schedule || '-'}
                                    </td>
                                    ))
                                )}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Holidays</h2>
                    <div className="flex space-x-8">
                        <div className="flex-1">
                            <h3 className="text-xl font-medium text-blue-600 mb-2">Add Holiday</h3>
                            <form onSubmit={handleAddHoliday}>
                                <div className="flex flex-col space-y-4">
                                    <TextField
                                        label="Holiday Date"
                                        type="date"
                                        value={newHoliday.holiday_date}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                                        required
                                        variant="outlined"
                                        InputLabelProps={{ shrink: true }}
                                    />
                                    <TextField
                                        label="Holiday Description"
                                        value={newHoliday.description}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                                        required
                                        variant="outlined"
                                    />
                                    <Button type="submit" variant="contained" color="primary">
                                        Add Holiday
                                    </Button>
                                </div>
                            </form>
                            {lastAddedHoliday && (
                                <div className="mt-4">
                                    <Button
                                        onClick={handleUndoHoliday}
                                        variant="contained"
                                        color="warning"
                                    >
                                        Undo Last Holiday ({lastAddedHoliday.holiday_date}: {lastAddedHoliday.description})
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-medium text-blue-600 mb-2">Edit/Delete Holiday</h3>
                            <form onSubmit={handleEditHoliday}>
                                <div className="flex flex-col space-y-4">
                                    <Select
                                    value={selectedHolidayId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedHolidayId(val);
                                        const holiday = holidays.find(h => h.id === parseInt(val));
                                        setEditHolidayDescription(holiday ? holiday.description || '' : '');
                                    }}
                                    displayEmpty
                                    variant="outlined"
                                    renderValue={(selected) => selected ? `${holidays.find(h => h.id === parseInt(selected))?.holiday_date} - ${holidays.find(h => h.id === parseInt(selected))?.description}` : 'Select Holiday'}
                                >
                                    <MenuItem value="">Select Holiday to Edit/Delete</MenuItem>
                                    {holidays.map(holiday => (
                                        <MenuItem key={holiday.id} value={holiday.id}>
                                            {`${holiday.holiday_date} - ${holiday.description}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                                    <div className="flex space-x-4">
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            disabled={!selectedHolidayId}
                                        >
                                            Update Description
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={handleDeleteHoliday}
                                            variant="contained"
                                            color="error"
                                            disabled={!selectedHolidayId}
                                        >
                                            Delete Holiday
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
              </>
                       )}

            {/* Materials tab: render MaterialDashboard inline (no navigation) */}
            {tabValue === 1 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <MaterialDashboard inline parentSubjects={subjects} parentMaterials={[]} />
              </div>
            )}

            {/* Profile tab: show MaterialDashboard inside the Profile tab (per request) */}
            {tabValue === 2 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <MaterialDashboard inline parentSubjects={subjects} parentMaterials={[]} />
              </div>
            )}

            {/* Upload Timetable tab (3) — keep Dashboard fallback or show a placeholder */}
            {tabValue === 3 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-700 mb-4">Upload / Timetable</h2>
                <p className="text-gray-600">Use the Add/Modify Class and Add/Modify Semester Schedule sections on the Dashboard tab, or implement a dedicated upload UI here.</p>
              </div>
            )}

            {/* Chat tab */}
            {tabValue === 4 && (
            <ChatTab
                messages={messages}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                sendMessage={sendMessage}
                isLoadingChat={isLoadingChat}
                chatPhoto={chatPhoto}
                setChatPhoto={setChatPhoto}
                userId={userId}
                classCode={classCode}
                error={error}
            />
            )}
        </div>
    );
};

export default RegularCRDashboard;