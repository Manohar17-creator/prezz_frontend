import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import {
  Tabs, Tab, Box, Button, Select, MenuItem, TextField, List, ListItem, ListItemText, IconButton,
  CircularProgress, Typography, Card, CardContent, Grid, Input, Alert, FormControl, InputLabel,
  Modal, Menu, Dialog, DialogTitle, DialogContent, DialogActions, Skeleton
} from '@mui/material';
import { Download, Send as SendIcon, PictureAsPdf, Image, Link as LinkIcon, AttachFile as AttachFileIcon, MoreVert, Close } from '@mui/icons-material';
import DatePicker from 'react-datepicker';
import moment from 'moment-timezone';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import localforage from 'localforage';
import debounce from 'lodash/debounce';
import { db, storage, auth } from '../../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import MaterialDashboard from '../Material/MaterialDashboard';


// Polyfill for AbortController.timeout
if (!AbortController.timeout) {
  AbortController.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

const StudentDashboard = () => {
    // ...existing code...
    const fetchStartedRef = useRef(false);
    // guards to prevent duplicate network calls (React StrictMode / multiple effects)
    const fetchMaterialsStartedRef = useRef(false);
    const fetchSubjectsStartedRef = useRef(false);
    const fetchElectivesStartedRef = useRef(false);
    const isFetchingHistoricalRef = useRef(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem('token');
  const userId = parseInt(localStorage.getItem('user_id'));
  const classcode = localStorage.getItem('classcode');
  const navigate = useNavigate();
  const TIMEZONE = 'Asia/Kolkata';
  const [todayClasses, setTodayClasses] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [pendingTodayAttendance, setPendingTodayAttendance] = useState({});
  const [pendingHistoricalAttendance, setPendingHistoricalAttendance] = useState({});
  const [reasons, setReasons] = useState(['Health Issue', 'Placement Drive']);
  const [customReason, setCustomReason] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historicalClasses, setHistoricalClasses] = useState([]);
  const [semesterClasses, setSemesterClasses] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [semesterDates, setSemesterDates] = useState({ semester_start_date: '', semester_end_date: '' });
  const [subjects, setSubjects] = useState([]);
  const [electivesAvailable, setElectivesAvailable] = useState([]);
  const [electivesSelected, setElectivesSelected] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState(null);
  const [electiveSchedules, setElectiveSchedules] = useState([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
  const today = moment.tz(TIMEZONE).startOf('day');
  // compute start of ISO week (Monday)
  const startOfWeek = today.clone().startOf('isoWeek');
  return startOfWeek.format('YYYY-MM-DD');
});
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryCache, setCategoryCache] = useState({});
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFileId, setEditFileId] = useState(null);
  const [editFileName, setEditFileName] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [offlineFiles, setOfflineFiles] = useState({});
  const [errorMaterials, setErrorMaterials] = useState(null);
  const [chatPhoto, setChatPhoto] = useState(null);
  const [isLoadingElectives, setIsLoadingElectives] = useState(false);
  const [profileData, setProfileData] = useState({});
  const role = localStorage.getItem('role')?.toUpperCase() || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingFile, setViewingFile] = useState(null);
  const [numPages, setNumPages] = useState(null);


  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  

  const normalizeDate = (date) => {
    if (!date) return null;
    return moment.tz(date, TIMEZONE).startOf('day').format('YYYY-MM-DD');
  };

  const getDayOfWeek = (dateString) => {
    const iso = moment.tz(dateString, 'YYYY-MM-DD', TIMEZONE).isoWeekday();
    return (iso + 6) % 7; // converts 1..7 -> 0..6 with Monday=0
  };

  const buildLocalDateFromYYYYMMDD = (ymd) => {
    if (!ymd) return null;
    const parts = ymd.split('-');
    if (parts.length < 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return new Date(y, m - 1, d); // local midnight for that date
  };

  const fetchElectives = async () => {
    if (fetchElectivesStartedRef.current) return;
    try {
      const response = await axios.get(`${API_URL}/api/electives/selected`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      });
      setElectivesSelected(response.data || []);
    } catch (err) {
      console.error('Failed to fetch selected electives:', err);
      setElectivesSelected([]);
      etchElectivesStartedRef.current = false;
      throw err;
      
    }
  };

  useEffect(() => {
  const fetchData = async () => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const todayStr = normalizeDate(new Date());

    try {
      const profileRes = await fetch(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortController.timeout(3000)
      });
      if (!profileRes.ok) throw new Error('Failed to fetch profile data');
      const profileData = await profileRes.json();
      setProfileData(profileData);
      const startDate = profileData.semester_start_date || '2025-01-01';
      const endDate = profileData.semester_end_date || '2025-06-30';
      setSemesterDates({ semester_start_date: startDate, semester_end_date: endDate });

      const [
        todayClassesRes,
        timeSlotsRes,
        holidaysRes,
        semesterClassesRes,
        electiveSchedulesRes,
        attendanceRes,
        reasonsRes,
        subjectsRes,
        electivesRes
      ] = await Promise.all([
        fetch(`${API_URL}/api/today-classes?date=${todayStr}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/time-slots`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/holidays`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/classes/semester`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/elective-schedules`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/attendance?start_date=${startDate}&end_date=${endDate}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/attendance/reasons`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) }),
        fetch(`${API_URL}/api/electives/available?classcode=${classcode || ''}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortController.timeout(3000) })
      ]);

      const responses = [todayClassesRes, timeSlotsRes, holidaysRes, semesterClassesRes, electiveSchedulesRes, attendanceRes, reasonsRes, subjectsRes, electivesRes];
      const errors = [];

      for (const res of responses) {
        if (!res.ok) {
          let errorMessage = `HTTP ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = res.statusText || errorMessage;
          }
          console.error(`Error fetching ${res.url}:`, errorMessage);
          errors.push(`Failed to load ${res.url}: ${errorMessage}`);
          if (res.status === 401 || res.status === 403) {
            setError('Unauthorized access. Please log in again.');
            localStorage.removeItem('token');
            navigate('/login', { replace: true });
            return;
          }
        }
      }

      if (errors.length > 0) {
        setError(errors.join('; '));
      }

      const [
        todayClassesData, timeSlotsData, holidaysData, semesterClassesData, electiveSchedulesData,
        attendanceData, reasonsData, subjectsData, electivesData
      ] = await Promise.all(
        responses.map(res => res.ok ? res.json().then(data => Array.isArray(data) ? data : []) : [])
      );

      setTodayClasses(Array.isArray(todayClassesData) ? todayClassesData.sort((a, b) => a.start_time.localeCompare(b.start_time)) : []);
      setTimeSlots(Array.isArray(timeSlotsData) ? timeSlotsData : []);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
      setSemesterClasses(Array.isArray(semesterClassesData) ? semesterClassesData : []);
      setElectiveSchedules(Array.isArray(electiveSchedulesData) ? electiveSchedulesData : []);
      setReasons(Array.isArray(reasonsData) ? reasonsData : ['Health Issue', 'Placement Drive']);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setElectivesAvailable(Array.isArray(electivesData) ? electivesData : []);

      const initialAttendance = {};
      const allClasses = [...todayClassesData, ...semesterClassesData, ...electiveSchedulesData];
      allClasses.forEach(cls => {
        const matchingRecords = attendanceData.filter(a => a.class_id === cls.id);
        if (!initialAttendance[cls.id]) initialAttendance[cls.id] = {};
        matchingRecords.forEach(record => {
          initialAttendance[cls.id][normalizeDate(record.date_str || record.date)] = {
            status: record.status,
            reason: record.reason || ''
          };
        });
        if (!initialAttendance[cls.id][todayStr]) {
          initialAttendance[cls.id][todayStr] = { status: '', reason: '' };
        }
      });
      setAttendance(initialAttendance);

      await fetchElectives();
      await fetchHistoricalClasses(selectedDate);
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Failed to load data. Please try again.');
    }
  };
  fetchData();
}, [navigate, token, classcode]);

  // ... (rest of the file remains unchanged)

  useEffect(() => {
      // This will be called whenever selectedDate changes
      fetchHistoricalClasses(selectedDate);
  }, [selectedDate, token, API_URL, navigate]);


  useEffect(() => {
    if (!classcode || tabValue !== 3) return;
    setIsLoadingChat(true);

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
      console.log('No user, navigating to login');
      navigate('/login', { replace: true });
      setIsLoadingChat(false);
      return;
    }

      const room = `class_${classcode}`;
      const messagesRef = collection(db, `chats/${room}/messages`);
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      

      const unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        const messageList = [];
        const promises = [];
        for (const doc of snapshot.docs) {
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
        };

        console.log('onSnapshot updated with messages:', messageList.length);

        try {
          // wait for all media caching to finish so localMediaUrl is available
          await Promise.all(promises);
        } catch (err) {
          console.error('Error processing media URLs:', err);
          setError('Failed to load some media in messages');
        }

        messageList.sort((a, b) => a.createdAt - b.createdAt);
        setChatMessages(messageList);
        setIsLoadingChat(false);
      },(error) => {
      console.error('Error fetching messages:', error);
      setError('Failed to load chat messages');
      setIsLoadingChat(false);
    });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, [classcode, tabValue, navigate]);
  

  const fetchAvailableElectives = async () => {
    setIsLoadingElectives(true);
    try {
      const res = await fetch(`${API_URL}/api/electives/available?semester=${profileData?.semester || '7'}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortController.timeout(3000)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch electives');
      }
      const data = await res.json();
      console.log('Available electives:', data);
      setElectivesAvailable(data);
    } catch (err) {
      console.error('Error loading electives:', err);
      setError('Failed to load available electives');
      setElectivesAvailable([]);
    } finally {
      setIsLoadingElectives(false);
    }
  };

  useEffect(() => {
    if (profileData?.semester) {
      fetchAvailableElectives();
    }
  }, [profileData]);



  const fetchSubjects = async () => {
    if (fetchSubjectsStartedRef.current) return;
    try {
      const response = await axios.get(`${API_URL}/api/subjects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const coreSubjects = response.data;
      const electiveSubjects = electivesSelected
        .filter(e => e.status === 'enrolled')
        .map(e => ({ id: `elective_${e.id}`, name: e.name, isElective: true, elective_id: e.id }));
      setSubjects([...coreSubjects, ...electiveSubjects]);
    } catch (err) {
      setErrorMaterials(err.response?.data?.error || 'Failed to fetch subjects');
      fetchSubjectsStartedRef.current = false;
      throw err;
      setSubjects([
        { id: 1, name: 'Mathematics' },
        { id: 'elective_1', name: 'Machine Learning', isElective: true, elective_id: 1 }
      ]);
    }
  };

useEffect(() => {
    if (tabValue === 4) {
    if (fetchMaterialsStartedRef.current) return;
    fetchMaterialsStartedRef.current = true;
      (async () => {
      try {
        await fetchElectives(); // guarded above
        await fetchSubjects();  // guarded above
        // optional: any other init for materials
      } catch (err) {
        console.error('Materials init error:', err);
        // allow reattempt later if needed
        fetchMaterialsStartedRef.current = false;
      }
    })();
    return;
  }
    }
  , [tabValue, role, fetchSubjects, fetchElectives]);

  const fetchCategories = useCallback(
    debounce(async (subjectId) => {
      if (categoryCache[subjectId]) {
        setCategories(categoryCache[subjectId]);
        return;
      }
      try {
        const response = await axios.get(`${API_URL}/api/materials/categories/${subjectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setCategories(response.data);
        setCategoryCache((prev) => ({ ...prev, [subjectId]: response.data }));
      } catch (err) {
        setErrorMaterials(err.response?.data?.error || 'Failed to fetch categories');
        setCategories([
          { id: 1, name: 'Lecture Notes' },
          { id: 2, name: 'Assignments' }
        ]);
      }
    }, 300),
    [token, categoryCache]
  );

  const fetchMaterials = async () => {
    setIsLoadingMaterials(true);
    try {
      const response = await axios.get(`${API_URL}/api/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const enrolledElectiveIds = electivesSelected
        .filter(e => e.status === 'enrolled')
        .map(e => e.id);
      setMaterials(response.data.filter(m => 
        !m.elective_id || enrolledElectiveIds.includes(m.elective_id)
      ));
    } catch (error) {
      setErrorMaterials('Failed to fetch materials, using mock data');
      setMaterials([
        { id: 1, filename: 'Lecture Notes Week 1.pdf', subject_id: 1, subject_name: 'Mathematics', category_id: 1, uploaded_by: userId, created_at: '2025-06-01' },
        { id: 2, filename: 'ML Assignment 1.pdf', subject_id: 'elective_1', subject_name: 'Machine Learning', category_id: 2, uploaded_by: userId + 1, created_at: '2025-06-02', elective_id: 1 }
      ]);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const handleDownload = async (material) => {
    if (material.url) {
      window.open(material.url, '_blank');
      return;
    }
    if (!material.path) {
      setErrorMaterials('No file path available for download');
      return;
    }
    try {
      const fileName = material.path.includes('/') ? material.path.split('/').pop() : material.path;
      const response = await axios.get(`${API_URL}/Uploads/${fileName}`, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: material.filename?.endsWith('.pdf') ? 'application/pdf' : 'image/*' });
      await localforage.setItem(material.id.toString(), {
        blob,
        filename: material.filename || fileName,
        type: material.filename?.endsWith('.pdf') ? 'pdf' : 'image'
      });
      setOfflineFiles((prev) => ({
        ...prev,
        [material.id]: { blob, filename: material.filename || fileName, type: material.filename?.endsWith('.pdf') ? 'pdf' : 'image' }
      }));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = material.filename || fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setErrorMaterials(err.response?.data?.error || 'Failed to download file');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file && !url) {
      setErrorMaterials('Please select a file or provide a URL');
      return;
    }
    if (file && url) {
      setErrorMaterials('Provide either a file or a URL, not both');
      return;
    }
    if (!uploadSubject) {
      setErrorMaterials('Please select a subject');
      return;
    }
    if (!uploadCategory) {
      setErrorMaterials('Please select a category');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    formData.append('subject_id', uploadSubject);
    formData.append('category_id', uploadCategory);
    if (url) {
      formData.append('url', url);
    }
    if (uploadSubject.startsWith('elective_')) {
      const electiveId = parseInt(uploadSubject.split('_')[1]);
      formData.append('elective_id', electiveId);
    }
    try {
      await axios.post(`${API_URL}/api/materials/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setFile(null);
      setUrl('');
      setUploadSubject('');
      setUploadCategory('');
      await fetchMaterials();
      setUploadModalOpen(false);
    } catch (err) {
      setErrorMaterials(err.response?.data?.error || 'Failed to upload material');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
    try {
      await axios.delete(`${API_URL}/api/materials/${materialId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMaterials((prev) => prev.filter((m) => m.id !== parseInt(materialId)));
      await localforage.removeItem(materialId.toString());
      setOfflineFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[materialId];
        return newFiles;
      });
    } catch (err) {
      setErrorMaterials(err.response?.data?.error || 'Failed to delete material');
    }
  };

  const handleEdit = async () => {
    try {
      await axios.put(`${API_URL}/api/materials/${editFileId}`, {
        filename: editFileName
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === parseInt(editFileId) ? { ...m, filename: editFileName } : m
        )
      );
      setEditModalOpen(false);
      setEditFileId(null);
      setEditFileName('');
    } catch (err) {
      setErrorMaterials(err.response?.data?.error || 'Failed to edit material');
    }
  };

  const handleMenuOpen = (event, materialId) => {
    setAnchorEl(event.currentTarget);
    setEditFileId(materialId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setEditFileId(null);
  };

  const sendMessage = async (e) => {
  e.preventDefault();
  if (!newMessage.trim() && !chatPhoto) {
    setError('Message or photo required');
    setTimeout(() => setError(null), 3000);
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
      const storageRef = ref(storage, `chat/${classcode}/${chatPhoto.name}`);
      await uploadBytes(storageRef, chatPhoto);
      mediaUrl = await getDownloadURL(storageRef);
    }

    await addDoc(collection(db, `chats/class_${classcode}/messages`), {
      message: newMessage.trim() || null,
      userId: userId.toString(),
      userName: profileData.username || 'Unknown',
      mediaUrl,
      createdAt: serverTimestamp()
    });

    setNewMessage('');
    setChatPhoto(null);
  } catch (error) {
    console.error('Send message error:', error);
    setError('Failed to send message');
    setTimeout(() => setError(null), 3000);
  }
};

  const fetchHistoricalClasses = async (date) => {
  const dateString = normalizeDate(date);
  if (isFetchingHistoricalRef.current) return; // avoid concurrent calls
  isFetchingHistoricalRef.current = true;
  const maxRetries = 3;
  let attempt = 0;
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  while (attempt < maxRetries) {
    try {
      const [classesResponse, attendanceResponse] = await Promise.all([
        fetch(`${API_URL}/api/today-classes?date=${dateString}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/attendance?start_date=${dateString}&end_date=${dateString}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!classesResponse.ok) {
        if (classesResponse.status === 429) {
          attempt++;
          const delay = 200 * Math.pow(2, attempt); // exponential backoff
          console.warn(`Rate limited fetching historical classes, retrying in ${delay}ms (attempt ${attempt})`);
          await wait(delay);
          continue;
        }
        throw new Error('Failed to fetch historical classes');
      }

      const historicalClasses = await classesResponse.json();
      setHistoricalClasses(historicalClasses.sort((a, b) => a.start_time.localeCompare(b.start_time)));

      if (attendanceResponse.ok) {
        const newAttendanceData = await attendanceResponse.json();
        setAttendance(prev => {
          const updatedAttendance = { ...prev };
          historicalClasses.forEach(cls => {
            const attendanceRecord = newAttendanceData.find(a => a.class_id === cls.id);
            if (!updatedAttendance[cls.id]) {
              updatedAttendance[cls.id] = {};
            }
            updatedAttendance[cls.id][dateString] = attendanceRecord ? {
              status: attendanceRecord.status,
              reason: attendanceRecord.reason || ''
            } : { status: '', reason: '' };
         });
         return updatedAttendance;
       });
     }
      // sucess -> break loop
      break;    } catch (error) {
      // if e hit a 429 above we already retried; for other errors we break
      consol.error('Error fetching historical classes:', error);
      setErrr('Failed to load historical classes');
      break;    } finally{
      attempt;
    }
  }

  isFetchingHistoricalRef.current = false;
};

  const handlePendingAttendanceChange = (classId, date, status, reason, isTodaySection) => {
    const dateString = normalizeDate(date);
    if (isTodaySection) {
      setPendingTodayAttendance(prev => ({
        ...prev,
        [classId]: { ...prev[classId], [dateString]: { status, reason } }
      }));
    } else {
      setPendingHistoricalAttendance(prev => ({
        ...prev,
        [classId]: { ...prev[classId], [dateString]: { status, reason } }
      }));
    }
  };

  const handleReasonChange = (classId, reason, date, isTodaySection) => {
    const dateString = normalizeDate(date);
    if (isTodaySection) {
      setPendingTodayAttendance(prev => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [dateString]: {
            status: prev[classId]?.[dateString]?.status || 'absent',
            reason
          }
        }
      }));
    } else {
      setPendingHistoricalAttendance(prev => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [dateString]: {
            status: prev[classId]?.[dateString]?.status || 'absent',
            reason
          }
        }
      }));
    }
  };

  const handleCustomReasonSubmit = (classId, date, isTodaySection) => {
    if (customReason && !reasons.includes(customReason)) {
      handlePendingAttendanceChange(classId, date, 'absent', customReason, isTodaySection);
      setReasons(prev => [...prev, customReason]);
      setCustomReason('');
    }
  };

  const saveAttendance = async (isTodaySection) => {
    const pendingAttendance = isTodaySection ? pendingTodayAttendance : pendingHistoricalAttendance;
    const dateToSave = isTodaySection ? normalizeDate(new Date()) : normalizeDate(selectedDate);
    const entries = [];

    Object.keys(pendingAttendance).forEach(classId => {
      if (pendingAttendance[classId]?.[dateToSave]) {
        const { status, reason } = pendingAttendance[classId][dateToSave];
        if (status) {
          entries.push({
            class_id: parseInt(classId),
            date: dateToSave,
            status,
            reason: status === 'absent' ? reason : null
          });
        }
      }
    });

    if (entries.length === 0) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entries)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save attendance');
      }
      const savedRecords = await response.json();

      setAttendance(prev => {
        const newAttendance = { ...prev };
        savedRecords.forEach(record => {
          const classId = record.class_id;
          const dateString = normalizeDate(record.date_str || record.date);
          if (!newAttendance[classId]) {
            newAttendance[classId] = {};
          }
          newAttendance[classId][dateString] = {
            status: record.status,
            reason: record.reason || ''
          };
        });
        return newAttendance;
      });

      if (isTodaySection) {
        setPendingTodayAttendance({});
      } else {
        setPendingHistoricalAttendance({});
      }

      const todayStr = normalizeDate(new Date());
      const updatedTodayClassesRes = await fetch(`${API_URL}/api/today-classes?date=${todayStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (updatedTodayClassesRes.ok) {
        const updatedTodayClasses = await updatedTodayClassesRes.json();
        setTodayClasses(updatedTodayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time)));
      }
      if (normalizeDate(selectedDate) === todayStr) {
        await fetchHistoricalClasses(selectedDate);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  


  const handleSelectElective = async (electiveId) => {
    try {
      const response = await fetch(`${API_URL}/api/electives/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ elective_id: electiveId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to select elective');
      }
      const [updatedSelected, updatedAvailable, updatedSchedules] = await Promise.all([
        fetch(`${API_URL}/api/electives/selected`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/electives/available?semester=${semesterDates.semester || '7'}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/elective-schedules`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
      ]);
      setElectivesSelected(updatedSelected);
      setElectivesAvailable(updatedAvailable);
      setElectiveSchedules(updatedSchedules);
      setError('Elective selected successfully');
      setTimeout(() => setError(null), 2000);
      await fetchSubjects();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDropElective = async (electiveId) => {
    try {
      const response = await fetch(`${API_URL}/api/electives/drop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ elective_id: electiveId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to drop elective');
      }
      const [updatedSelected, updatedAvailable, updatedSchedules] = await Promise.all([
        fetch(`${API_URL}/api/electives/selected`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/electives/available?semester=${semesterDates.semester || '7'}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/elective-schedules`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
      ]);
      setElectivesSelected(updatedSelected);
      setElectivesAvailable(updatedAvailable);
      setElectiveSchedules(updatedSchedules);
      setError('Elective dropped successfully');
      setTimeout(() => setError(null), 2000);
      await fetchSubjects();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSwapElective = async (oldElectiveId, newElectiveId) => {
    try {
      const response = await fetch(`${API_URL}/api/electives/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ old_elective_id: oldElectiveId, new_elective_id: newElectiveId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to swap elective');
      }
      const [updatedSelected, updatedAvailable, updatedSchedules] = await Promise.all([
        fetch(`${API_URL}/api/electives/selected`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/electives/available?semester=${semesterDates.semester || '7'}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/elective-schedules`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
      ]);
      setElectivesSelected(updatedSelected);
      setElectivesAvailable(updatedAvailable);
      setElectiveSchedules(updatedSchedules);
      setError('Elective swapped successfully');
      setTimeout(() => setError(null), 2000);
      await fetchSubjects();
    } catch (error) {
      setError(error.message);
    }
  };

  const handlePreviousWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setSelectedWeekStart(newStart.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setSelectedWeekStart(newStart.toISOString().split('T')[0]);
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const daysOfWeekShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weekDates = daysOfWeek.map((day, index) => {
  const date = moment.tz(selectedWeekStart, 'YYYY-MM-DD', TIMEZONE).startOf('day').add(index, 'days').format('YYYY-MM-DD');
  return {
    dayLong: daysOfWeek[index],
    dayShort: daysOfWeekShort[index],
    date,
    displayDate: moment.tz(date, 'YYYY-MM-DD', TIMEZONE).format('Do MMM')
  };
});

  const timetableData = useMemo(() => {
  console.log('Generating timetableData with:', { semesterClasses, electiveSchedules });
  return weekDates.map(({ dayLong, dayShort, date }, index) => {
    const day = dayLong; // use the dayLong from weekDates (was previously undefined)
    const holiday = Array.isArray(holidays)
      ? holidays.find(h => normalizeDate(h.holiday_date || h.date || h.date_str || h) === date)
      : null;
    const isHoliday = !!holiday;

    const singleClassCancellations = [...(Array.isArray(semesterClasses) ? semesterClasses : []), ...(Array.isArray(electiveSchedules) ? electiveSchedules : [])].filter(s =>
      s.specific_date === date && s.canceled === true
    );

    const daySchedules = [...(Array.isArray(semesterClasses) ? semesterClasses : []), ...(Array.isArray(electiveSchedules) ? electiveSchedules : [])].filter(schedule => {
      if (schedule.canceled === true) return false;

      if (schedule.specific_date) {
        return schedule.specific_date === date;
      }

      if (schedule.day_of_week && schedule.start_date && schedule.end_date) {
        // compare schedule day with the day from weekDates (day)
        if (schedule.day_of_week !== day) return false;

        const startDate = new Date(schedule.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(schedule.end_date);
        endDate.setHours(0, 0, 0, 0);
        const currentDate = new Date(date);
        currentDate.setHours(0, 0, 0, 0);

        if (currentDate < startDate || currentDate > endDate) return false;

        const isCanceled = singleClassCancellations.some(c =>
          (c.subject_id === schedule.subject_id && c.elective_id === schedule.elective_id) &&
          c.time_slot_id === schedule.time_slot_id
        );
        if (isCanceled) return false;

        return true;
      }

      return false;
    });

    const isDefaultHoliday = (day === 'Saturday' || day === 'Sunday') && !daySchedules.length && !holiday;

    return {
      day: dayShort,
      date,
      isHoliday,
      isDefaultHoliday,
      holidayDescription: holiday ? (holiday.description || 'Holiday') : 'Holiday',
      schedules: timeSlots.map(slot => {
        const slotSchedules = [...(Array.isArray(semesterClasses) ? semesterClasses : []), ...(Array.isArray(electiveSchedules) ? electiveSchedules : [])].filter(s =>
          s.specific_date === date && s.time_slot_id === slot.id
        );
        if (slotSchedules.length > 0) {
          const latestSchedule = slotSchedules.reduce((latest, current) => {
            if (current.canceled === true) return latest;
            if (!latest || current.id > latest.id) return current;
            return latest;
          }, null);

          if (latestSchedule && latestSchedule.canceled !== true) {
            return latestSchedule.subject_name || latestSchedule.elective_name;
          }

          const cancellation = slotSchedules.find(s => s.canceled === true);
          if (cancellation) {
            return 'Cancelled';
          }
        }

        const schedule = daySchedules.find(s => s.time_slot_id === slot.id);
        if (schedule) {
          return schedule.subject_name || schedule.elective_name;
        }
        return null;
      })
    };
  });
}, [weekDates, semesterClasses, electiveSchedules, holidays, timeSlots]);

  const getClassDates = (cls, startBoundary, endBoundary, schedules, holidays) => {
    const dates = [];
    const startBoundaryDate = new Date(startBoundary);
    const endBoundaryDate = new Date(endBoundary);

    if (cls.day_of_week && cls.start_date && cls.end_date) {
      const start = new Date(Math.max(startBoundaryDate.getTime(), new Date(cls.start_date).getTime()));
      const end = new Date(Math.min(endBoundaryDate.getTime(), new Date(cls.end_date).getTime()));
      const dayOfWeekMap = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 7
      };
      const targetDayOfWeek = dayOfWeekMap[cls.day_of_week];

      let date = new Date(start);
      date.setHours(0, 0, 0, 0);

      while (date.getDay() !== targetDayOfWeek && date <= end) {
        date.setDate(date.getDate() + 1);
      }

      while (date <= end) {
        const dateStr = normalizeDate(date);
        const isHoliday = holidays.some(h => h.holiday_date === dateStr);
        if (!isHoliday) {
          const specificSchedule = schedules.find(s =>
            s.specific_date === dateStr &&
            (s.subject_id === cls.subject_id || s.elective_id === cls.elective_id) &&
            s.time_slot_id === cls.time_slot_id
          );
          if (specificSchedule && !specificSchedule.canceled) {
            dates.push({ date: dateStr, classId: cls.id || specificSchedule.id });
          } else if (!specificSchedule) {
            dates.push({ date: dateStr, classId: cls.id });
          }
        }
        date.setDate(date.getDate() + 7);
      }
    }

    return dates;
  };

  const calculateAttendanceStats = useMemo(() => {
    const todayStr = normalizeDate(new Date());
    const todayDate = new Date(todayStr);
    const stats = {};

    const allSubjects = [
      ...subjects.filter(s => !s.isElective).map(s => ({ id: s.id, name: s.name, isElective: false })),
      ...electivesSelected.filter(e => e.status === 'enrolled').map(e => ({ id: e.id, name: e.name, isElective: true }))
    ];

    allSubjects.forEach(subject => {
      const isElective = subject.isElective;
      const subjectClasses = semesterClasses.filter(cls =>
        isElective ? cls.elective_id === subject.id : cls.subject_id === subject.id
      );

      const subjectSchedules = schedules.filter(sch =>
        isElective ? sch.elective_id === subject.id : sch.subject_id === subject.id
      );

      const allClassInstances = [];
      subjectClasses.forEach(cls => {
        const classDates = getClassDates(cls, semesterDates.semester_start_date, semesterDates.semester_end_date, subjectSchedules, holidays);
        allClassInstances.push(...classDates);
      });

      subjectSchedules.forEach(sch => {
        if (sch.day_of_week && sch.start_date && sch.end_date && !sch.specific_date && !sch.canceled) {
          const recurringClass = {
            id: sch.id,
            subject_id: sch.subject_id,
            elective_id: sch.elective_id,
            day_of_week: sch.day_of_week,
            start_date: sch.start_date,
            end_date: sch.end_date,
            time_slot_id: sch.time_slot_id
          };
          const classDates = getClassDates(recurringClass, semesterDates.semester_start_date, semesterDates.semester_end_date, subjectSchedules, holidays);
          classDates.forEach(date => allClassInstances.push({ ...date, classId: sch.id }));
        } else if (sch.specific_date && !sch.canceled) {
          const specificDate = normalizeDate(sch.specific_date);
          const specificDateObj = new Date(specificDate);
          if (specificDateObj >= new Date(semesterDates.semester_start_date) && specificDateObj <= new Date(semesterDates.semester_end_date)) {
            const isHoliday = holidays.some(h => h.holiday_date === specificDate);
            if (!isHoliday) {
              allClassInstances.push({ date: specificDate, classId: sch.id });
            }
          }
        }
      });

      const todayClassesForSubject = todayClasses.filter(cls =>
        isElective ? cls.elective_id === subject.id : cls.subject_id === subject.id
      );
      todayClassesForSubject.forEach(cls => {
        const date = todayStr;
        if (!allClassInstances.some(instance => instance.date === date && instance.classId === cls.id)) {
          allClassInstances.push({ date, classId: cls.id });
        }
      });

      const specificDateInstances = [];
      const recurringInstances = [];
      allClassInstances.forEach(instance => {
        const matchingSchedule = schedules.find(sch =>
          sch.specific_date === instance.date &&
          sch.id === instance.classId
        );
        if (matchingSchedule) {
          specificDateInstances.push(instance);
        } else {
          recurringInstances.push(instance);
        }
      });

      const specificDates = new Set(specificDateInstances.map(instance => instance.date));
      const filteredRecurringInstances = recurringInstances.filter(instance => !specificDates.has(instance.date));

      const uniqueClassInstances = [];
      const seen = new Set();
      specificDateInstances.forEach(instance => {
        const key = `${instance.date}-${instance.classId}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueClassInstances.push(instance);
        }
      });
      filteredRecurringInstances.forEach(instance => {
        const key = `${instance.date}-${instance.classId}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueClassInstances.push(instance);
        }
      });

      const totalClassesSemester = uniqueClassInstances.length;

      const conductedClassInstances = uniqueClassInstances.filter(instance => {
        const instanceDate = new Date(instance.date);
        return instanceDate <= todayDate;
      });

      const totalClassesConducted = conductedClassInstances.length;

      const futureClassInstances = uniqueClassInstances.filter(instance => {
        const instanceDate = new Date(instance.date);
        return instanceDate > todayDate;
      });

      const totalRemainingClasses = futureClassInstances.length;

      let attendedClasses = 0;
      conductedClassInstances.forEach(instance => {
        const records = attendance[instance.classId] || {};
        const record = records[instance.date];
        if (record && record.status === 'present') {
          attendedClasses += 1;
        }
      });

      const percentage = totalClassesConducted > 0 ? Math.min((attendedClasses / totalClassesConducted) * 100, 100) : 0;

      const minPercentage = 80;
      const classesNeededForMinTotal = totalClassesSemester > 0 ? Math.ceil((minPercentage / 100) * totalClassesSemester) : 0;
      const classesNeededForMin = classesNeededForMinTotal - attendedClasses;

      const futureDates = futureClassInstances.map(instance => instance.date);

      stats[subject.id] = {
        subject_id: subject.id,
        subject_name: subject.name,
        isElective,
        totalClasses: totalClassesConducted,
        attendedClasses,
        percentage: percentage.toFixed(2),
        classesNeeded: classesNeededForMin > 0 ? classesNeededForMin : 0,
        totalRemainingClasses,
        futureDates
      };
    });

    return stats;
  }, [subjects, electivesSelected, attendance, semesterClasses, schedules, holidays, semesterDates, todayClasses]);

  const getDatesWithClasses = () => {
    const datesWithClasses = new Set();
    semesterClasses.forEach(cls => {
      if (cls.specific_date) {
        datesWithClasses.add(normalizeDate(cls.specific_date));
      } else if (cls.day_of_week && cls.start_date && cls.end_date) {
        let date = new Date(cls.start_date);
      const end = new Date(cls.end_date);
      const dayOfWeek = daysOfWeek.indexOf(cls.day_of_week);
      while (date <= end) {
          if (date.getDay() === dayOfWeek) {
            datesWithClasses.add(normalizeDate(date));
          }
          date.setDate(date.getDate() + 1);
        }
      }
    });
    electiveSchedules.forEach(cls => {
    if (cls.specific_date) {
      datesWithClasses.add(normalizeDate(cls.specific_date));
    }
  });
  return Array.from(datesWithClasses).sort();
};

  const getDailyAttendanceStats = useMemo(() => {
    if (!semesterClasses.length || !Object.keys(attendance).length) {
        return {};
    }

    const dailyStats = {};
    const datesWithClasses = getDatesWithClasses().filter(date => {
        const dateObj = new Date(date);
        // Only consider dates that have passed
        return new Date(date) <= new Date(normalizeDate(new Date()));
    });

    datesWithClasses.forEach(date => {
        // Find all classes that occurred on this specific date
        const isHoliday = holidays.some(h => h.holiday_date === date);
        if (isHoliday) {
            dailyStats[date] = { percentage: 0, color: 'red' };
            return; // Skip attendance calculation for holidays
        }

        const classesOnDate = [...semesterClasses, ...electiveSchedules].filter(cls => {
            if (cls.specific_date) {
                return normalizeDate(cls.specific_date) === date;
            }
            if (cls.day_of_week && cls.start_date && cls.end_date) {
                const classDate = new Date(date);
                const dayIndex = (classDate.getDay() + 6) % 7; // Convert to Monday-first index
                const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const dayName = daysOfWeek[dayIndex];

                return (
                    cls.day_of_week === dayName &&
                    normalizeDate(cls.start_date) <= date &&
                    normalizeDate(cls.end_date) >= date
                );
            }
            return false;
        });

        const total = classesOnDate.length;
        let attended = 0;
        classesOnDate.forEach(cls => {
            const records = attendance[cls.id] || {};
            if (records[date] && records[date].status === 'present') {
                attended += 1;
            }
        });

        const percentage = total > 0 ? (attended / total) * 100 : 0;
        dailyStats[date] = {
            percentage,
            color: percentage >= 80 ? 'green' : percentage >= 50 ? 'yellow' : 'red'
        };
    });

    return dailyStats;
}, [attendance, semesterClasses, electiveSchedules, holidays]);

// Then, make sure your holiday logic is applied correctly to override the date highlight
const highlightDatesConfig = useMemo(() => {
  const map = {}; // dateStr -> color

  // holidays from backend
  (Array.isArray(holidays) ? holidays : []).forEach(h => {
    const d = normalizeDate(h.holiday_date || h.date || h.date_str || h);
    if (d) map[d] = 'red';
  });

  // weekend defaults between semester boundaries
  const start = new Date(semesterDates.semester_start_date || '2025-01-01');
  const end = new Date(semesterDates.semester_end_date || new Date());
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
      const ds = normalizeDate(new Date(d));
      if (ds && !map[ds]) map[ds] = 'red';
    }
  }

  // attendance-derived colours
  const daily = getDailyAttendanceStats || {};
  Object.entries(daily).forEach(([dateKey, stat]) => {
    const d = normalizeDate(dateKey);
    if (!d) return;
    if (stat && stat.color) {
      // let holiday override keep 'red'
      if (!map[d] || map[d] !== 'red') {
        map[d] = stat.color;
      }
    }
  });

  // group by color to match react-datepicker's expected shape { colorKey: [Date, ...] }
  const grouped = {};
  Object.entries(map).forEach(([dateStr, color]) => {
    if (!grouped[color]) grouped[color] = [];
    const safeDate = buildLocalDateFromYYYYMMDD(dateStr);
    if (safeDate) grouped[color].push(safeDate);
  });

  // optional: debug to verify dates are correct
  console.log('highlightDatesConfig grouped:', Object.keys(grouped).reduce((acc,k)=>{acc[k]=grouped[k].map(d=>d.toDateString()); return acc},{}), grouped);

  // return array like [{ green: [Date,..] }, { red: [Date,..] }, ...]
  return Object.entries(grouped).map(([color, dates]) => ({ [color]: dates }));
}, [holidays, getDailyAttendanceStats, semesterDates]);

  const handleTabChange = (event, newValue) => {
    // Keep materials rendered inline as a dashboard tab (no route navigation
    setTabValue(newValue);
  };


  const todayStr = normalizeDate(new Date());

  return (
  <div className="min-h-screen bg-gray-100 p-6">
     <style>
      {`
        /* Stronger rules so react-datepicker highlight classes cannot be overridden */
        .react-datepicker__day--highlighted,
        .react-datepicker__day--highlighted.react-datepicker__day,
        .react-datepicker__day--highlighted-green,
        .react-datepicker__day--highlighted-yellow,
        .react-datepicker__day--highlighted-red,
        .react-datepicker__day--highlighted-green.react-datepicker__day,
        .react-datepicker__day--highlighted-yellow.react-datepicker__day,
        .react-datepicker__day--highlighted-red.react-datepicker__day {
          border-radius: 0.35rem !important;
          background-image: none !important;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04) !important;
        }

        /* explicit color keys (use !important to override other libs) */
        .react-datepicker__day--highlighted-green,
        .react-datepicker__day--highlighted-green:hover,
        .react-datepicker__day--highlighted-green.react-datepicker__day {
          background-color: #90ee90 !important;
          color: #000 !important;
        }

        .react-datepicker__day--highlighted-yellow,
        .react-datepicker__day--highlighted-yellow:hover,
        .react-datepicker__day--highlighted-yellow.react-datepicker__day {
          background-color: #ffff99 !important;
          color: #000 !important;
        }

        .react-datepicker__day--highlighted-red,
        .react-datepicker__day--highlighted-red:hover,
        .react-datepicker__day--highlighted-red.react-datepicker__day {
          background-color: #ff9999 !important;
          color: #000 !important;
        }

        /* also handle when react-datepicker nests classes or marks outside-month */
        .react-datepicker__day--outside-month.react-datepicker__day--highlighted-green,
        .react-datepicker__day--outside-month.react-datepicker__day--highlighted-yellow,
        .react-datepicker__day--outside-month.react-datepicker__day--highlighted-red,
        .react-datepicker__day--outside-month.react-datepicker__day--highlighted {
          opacity: 0.6 !important;
        }

        /* handle combined classes some versions produce */
        [class*="react-datepicker__day--highlighted-"] {
          background-image: none !important;
        }

        /* improve DatePicker cell visibility */
        .react-datepicker__day {
          border: none !important;
        }

        /* small site style enhancements */
        .dashboard-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .dashboard-header {
          background: linear-gradient(90deg,#0ea5e9,#60a5fa);
          color: white;
          padding: 1rem 1.25rem;
          border-radius: .5rem;
          box-shadow: 0 8px 24px rgba(10,10,20,0.06);
          margin-bottom: 1rem;
        }
        .card {
          transition: box-shadow .18s ease, transform .18s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(10,10,20,0.08);
        }

        .elective-class {
          background-color: #e6f3ff;
          border-left: 4px solid #2196f3;
        }
      `}
    </style>
    <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">Student Dashboard</h1>
    {error && <div className="text-red-600 mb-4 text-center">{error}</div>}

    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
      <Tabs value={tabValue} onChange={handleTabChange} aria-label="navigation tabs">
        <Tab label="Dashboard" />
        <Tab label="Attendance Statistics" />
        <Tab label="Electives" />
        <Tab label="Chat" />
        <Tab label="Materials" />
      </Tabs>
    </Box>

    {tabValue === 0 && (
      <>
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-blue-600 mb-4">Today’s Classes ({moment().format('Do MMMM')})</h2>
          {todayClasses.length === 0 ? (
            <p className="text-gray-600">No classes scheduled for today.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {todayClasses.map(cls => {
                  const pendingRecord = pendingTodayAttendance[cls.id]?.[todayStr];
                  const savedRecord = attendance[cls.id]?.[todayStr] || { status: '', reason: '' };
                  const record = pendingRecord || savedRecord;
                  const isElective = !!cls.elective_id;
                  return (
                    <div key={cls.id} className={`p-4 border rounded-lg flex items-start ${isElective ? 'elective-class' : ''}`}>
                      <div className="flex-1">
                        <p className="text-gray-700 font-semibold">{isElective ? '[Elective] ' : ''}{cls.subject_name}</p>
                        <p className="text-gray-600">{cls.start_time} - {cls.end_time}</p>
                        <div className="mt-2">
                          <label className="mr-2">Attendance:</label>
                          <Select
                            value={record.status || ''}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              handlePendingAttendanceChange(cls.id, todayStr, newStatus, record.reason, true);
                            }}
                            displayEmpty
                            className="p-2 border rounded-lg mr-2 w-32"
                          >
                            <MenuItem value="">Select Status</MenuItem>
                            <MenuItem value="present">Present</MenuItem>
                            <MenuItem value="absent">Absent</MenuItem>
                          </Select>
                          {record.status === 'absent' && (
                            <div className="mt-2">
                              <label className="mr-2">Reason:</label>
                              <Select
                                value={record.reason || ''}
                                onChange={(e) => {
                                  if (e.target.value === 'custom') {
                                    setCustomReason('');
                                  } else {
                                    handleReasonChange(cls.id, e.target.value, todayStr, true);
                                  }
                                }}
                                displayEmpty
                                className="p-2 border rounded-lg mr-2 w-40"
                              >
                                <MenuItem value="">Select Reason</MenuItem>
                                {reasons.map((reason, idx) => (
                                  <MenuItem key={idx} value={reason}>{reason}</MenuItem>
                                ))}
                                <MenuItem value="custom">Custom Reason</MenuItem>
                              </Select>
                              {record.reason === 'custom' && (
                                <div className="mt-2 flex items-center">
                                  <TextField
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="Enter custom reason"
                                    variant="outlined"
                                    size="small"
                                    className="mr-2"
                                  />
                                  <Button
                                    onClick={() => handleCustomReasonSubmit(cls.id, todayStr, true)}
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                  >
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                onClick={() => saveAttendance(true)}
                variant="contained"
                color="success"
                className="mt-4"
              >
                Save Attendance
              </Button>
            </>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-blue-600 mb-4">Historical Attendance</h2>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Select Date</label>
            <DatePicker
            selected={selectedDate}
            onChange={(date) => {
              const adjustedDate = moment(date).tz(TIMEZONE).toDate();
              setSelectedDate(adjustedDate);
              fetchHistoricalClasses(adjustedDate);
            }}
            minDate={semesterDates.semester_start_date ? new Date(semesterDates.semester_start_date) : new Date('2025-01-01')}
            maxDate={new Date()}
            highlightDates={highlightDatesConfig} // <-- pass grouped array of { colorKey: [Date,..] }
            inline
            className="border p-2 rounded-lg"
            calendarStartDay={1}
          />
          </div>
          {historicalClasses.length === 0 ? (
            <p className="text-gray-600">No classes scheduled for {normalizeDate(selectedDate)}.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {historicalClasses.map(cls => {
                  const dateString = normalizeDate(selectedDate);
                  const pendingRecord = pendingHistoricalAttendance[cls.id]?.[dateString];
                  const savedRecord = attendance[cls.id]?.[dateString] || { status: '', reason: '' };
                  const record = pendingRecord || savedRecord;
                  const isElective = !!cls.elective_id;
                  return (
                    <div key={cls.id} className={`p-4 border rounded-lg flex items-start ${isElective ? 'elective-class' : ''}`}>
                      <div className="flex-1">
                        <p className="text-gray-700 font-semibold">{isElective ? '[Elective] ' : ''}{cls.subject_name}</p>
                        <p className="text-gray-600">{cls.start_time} - {cls.end_time}</p>
                        <div className="mt-2">
                          <label className="mr-2">Attendance:</label>
                          <Select
                            value={record.status || ''}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              handlePendingAttendanceChange(cls.id, selectedDate, newStatus, record.reason, false);
                            }}
                            displayEmpty
                            className="p-2 border rounded-lg mr-2 w-32"
                            disabled={dateString > todayStr}
                          >
                            <MenuItem value="">Select Status</MenuItem>
                            <MenuItem value="present">Present</MenuItem>
                            <MenuItem value="absent">Absent</MenuItem>
                          </Select>
                          {record.status === 'absent' && (
                            <div className="mt-2">
                              <label className="mr-2">Reason:</label>
                              <Select
                                value={record.reason || ''}
                                onChange={(e) => {
                                  if (e.target.value === 'custom') {
                                    setCustomReason('');
                                  } else {
                                    handleReasonChange(cls.id, e.target.value, selectedDate, false);
                                  }
                                }}
                                displayEmpty
                                className="p-2 border rounded-lg mr-2 w-40"
                                disabled={dateString > todayStr}
                              >
                                <MenuItem value="">Select Reason</MenuItem>
                                {reasons.map((reason, idx) => (
                                  <MenuItem key={idx} value={reason}>{reason}</MenuItem>
                                ))}
                                <MenuItem value="custom">Custom Reason</MenuItem>
                              </Select>
                              {record.reason === 'custom' && (
                                <div className="mt-2 flex items-center">
                                  <TextField
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="Enter custom reason"
                                    variant="outlined"
                                    size="small"
                                    className="mr-2"
                                    disabled={dateString > todayStr}
                                  />
                                  <Button
                                    onClick={() => handleCustomReasonSubmit(cls.id, selectedDate, false)}
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    disabled={dateString > todayStr}
                                  >
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                onClick={() => saveAttendance(false)}
                variant="contained"
                color="success"
                className="mt-4"
                disabled={normalizeDate(selectedDate) > todayStr}
              >
                Save Attendance
              </Button>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-blue-600">
              Weekly Timetable ({`${weekDates[0].displayDate} - ${weekDates[6].displayDate}`})
            </h2>
            <div className="flex space-x-2">
              <Button onClick={handlePreviousWeek}  size="large" aria-label="Previous Week">
                &lt;
              </Button>
              <Button onClick={handleNextWeek}  size="large" aria-label="Next Week">
                &gt;
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
                    <td className="border border-gray-300 p-2">{day}</td>
                    {isHoliday || isDefaultHoliday ? (
                      <td colSpan={timeSlots.length} className="border border-gray-300 p-2 text-center">
                        {holidayDescription}
                      </td>
                    ) : (
                      schedules.map((schedule, index) => (
                        <td key={`${date}-${index}`} className="border border-gray-300 p-2">{schedule || '-'}</td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {tabValue === 1 && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-blue-600 mb-4">Attendance Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(calculateAttendanceStats).map(stat => (
              <div key={stat.subject_id} className={`p-4 border rounded-lg ${stat.isElective ? 'elective-class' : ''}`}>
                <h3 className="text-lg font-semibold text-blue-600">{stat.isElective ? '[Elective] ' : ''}{stat.subject_name}</h3>
                <p className="text-gray-700">Attendance: {stat.percentage}%</p>
                <p className="text-gray-700">Attended: {stat.attendedClasses} out of {stat.totalClasses} classes</p>
                <p className="text-gray-700">
                  {stat.classesNeeded > 0
                    ? stat.classesNeeded <= stat.totalRemainingClasses
                      ? `Need ${stat.classesNeeded} more out of ${stat.totalRemainingClasses} remaining to attain 80% attendance`
                      : `Need ${stat.classesNeeded} more classes, but only ${stat.totalRemainingClasses} remaining. It’s impossible to attain 80% attendance`
                    : 'You have met the 80% attendance requirement'}
                </p>
                <p className="text-gray-500">Future dates: {stat.futureDates.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tabValue === 2 && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-blue-600 mb-4">Manage Electives</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Selected Electives</h3>
            {electivesSelected.filter(e => e.status === 'enrolled').length === 0 ? (
              <p className="text-gray-600">No electives selected. Please select from available electives below.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {electivesSelected.filter(e => e.status === 'enrolled').map(elective => (
                  <div key={elective.id} className="p-4 border rounded-lg elective-class">
                    <p className="text-gray-700 font-semibold">{elective.name}</p>
                    <p className="text-gray-600">{elective.is_open ? 'Open Elective' : `Branch: ${elective.branch || 'N/A'}`}</p>
                    <p className="text-gray-600">Status: {elective.status || 'Not Set'}</p>
                    <div className="mt-2 flex space-x-2">
                      <Button onClick={() => handleDropElective(elective.id)} variant="contained" color="error" size="small">
                        Drop
                      </Button>
                      <Select
                        value=""
                        onChange={(e) => handleSwapElective(elective.id, parseInt(e.target.value))}
                        displayEmpty
                        className="w-40"
                        size="small"
                      >
                        <MenuItem value="" disabled>Swap with...</MenuItem>
                        {electivesAvailable
                          .filter(e => e.id !== elective.id)
                          .map(e => (
                            <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
                          ))}
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Available Electives</h3>
            {electivesAvailable.length === 0 ? (
              <p className="text-gray-600">No electives available for your semester.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {electivesAvailable.map(elective => (
                  <div key={elective.id} className="p-4 border rounded-lg">
                    <p className="text-gray-700 font-semibold">{elective.name}</p>
                    <p className="text-gray-600">{elective.is_open ? 'Open Elective' : `Branch: ${elective.branch || 'N/A'}`}</p>
                    <Button
                      onClick={() => handleSelectElective(elective.id)}
                      variant="contained"
                      color="primary"
                      size="small"
                      className="mt-2"
                      disabled={electivesSelected.filter(e => e.status === 'enrolled').length >= 3}
                    >
                      Enroll
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


{tabValue === 3 && (
  <div className="bg-white p-6 rounded-lg shadow-lg">
    <h2 className="text-2xl font-bold text-blue-600 mb-4">Chat</h2>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {isLoadingChat ? (
      <CircularProgress />
    ) : (
      <>
        <List className="mb-4 max-h-96 overflow-y-auto">
          {chatMessages.map((msg) => {
            const mine = msg.userId?.toString() === userId?.toString();
            return (
            <ListItem
              key={msg.id}
              sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}
            >
              <Box
                sx={{
                  maxWidth: '70%',
                  bgcolor: mine? '#007AFF' : '#E5E5EA',
                  color: mine ? 'white' : 'black',
                  borderRadius: 3,
                  p: 1
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ fontWeight: 'bold', color: mine ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}
                  >
                    {msg.userName}
                </Typography>
                {msg.message && <Typography variant="body1" sx={{ color: mine ? 'white' : 'black', whiteSpace: 'pre-wrap' }}>{msg.message}</Typography>}
                {msg.mediaUrl && (
                  <Box sx={{ mt: 1 }}>
                    <img src={msg.localMediaUrl || msg.mediaUrl} alt="Chat media" style={{ maxWidth: '100%', borderRadius: 8 }} />
                  </Box>
                )}
                <Typography variant="caption" sx={{ opacity: 0.8, color: mine ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)', mt: 0.5 }}>
                  {msg.createdAt ? moment(msg.createdAt).format('MMM D, h:mm A') : ''}
                </Typography>
              </Box>
            </ListItem>
            );
      })}
        </List>
        <Box component="form" onSubmit={sendMessage} sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            fullWidth
            variant="outlined"
            size="small"
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
      </>
    )}
  </div>
)}


      {tabValue === 4 && (
        <MaterialDashboard inline parentSubjects={subjects} parentMaterials={materials} />        
      )}
    </div>
  );
}

export default StudentDashboard;