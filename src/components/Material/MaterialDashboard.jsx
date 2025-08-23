// filepath: /Users/manoharkandula/Downloads/Web Development/Attendance Tracker 3 copy/client/src/components/Material/MaterialDashboard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Routes, Route, Navigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CircularProgress, Grid, IconButton, Typography, Input, Alert,
  Select, MenuItem, FormControl, InputLabel, TextField, Modal, Menu, Dialog, DialogTitle,
  DialogContent, DialogActions, Skeleton, Tabs, Tab
} from '@mui/material';
import {
  Download, Upload, Delete, PictureAsPdf, Image, Link as LinkIcon, AttachFile, MoreVert, Close
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import localforage from 'localforage';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import moment from 'moment';
import debounce from 'lodash/debounce';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Define Apple-inspired MUI theme
const theme = createTheme({
  palette: {
    primary: { main: '#007AFF' },
    secondary: { main: '#FF2D55' },
    background: { default: '#F5F5F7', paper: '#FFFFFF' },
    text: { primary: '#1D1D1F', secondary: '#6E6E73' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", "system-ui", sans-serif',
    h4: { fontWeight: 600, fontSize: '1.5rem', color: '#1D1D1F' },
    subtitle1: { fontSize: '1rem', color: '#1D1D1F' },
    body2: { fontSize: '0.875rem', color: '#6E6E73' },
  },
  components: {
    MuiCard: {
      styleOverrides: { root: { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #E5E5EA' } }
    },
    MuiButton: {
      styleOverrides: { root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 } }
    },
    MuiIconButton: {
      styleOverrides: { root: { color: '#6E6E73', '&:hover': { backgroundColor: '#E5E5EA' } } }
    },
    MuiModal: {
      styleOverrides: { root: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }
    }
  }
});

const EditFileNameDialog = React.memo(({ open, onClose, editFileName, setEditFileName, onSave }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Edit File Name</DialogTitle>
    <DialogContent>
      <TextField
        label="File Name"
        value={editFileName}
        onChange={(e) => setEditFileName(e.target.value)}
        fullWidth
        sx={{ mt: 2 }}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onSave} variant="contained" color="primary">Save</Button>
    </DialogActions>
  </Dialog>
));

const MaterialDashboard = ({ inline = false, parentSubjects = null, parentMaterials = null }) => {
   const navigate = useNavigate();
   const { subjectId, categoryId } = useParams();
   const [materials, setMaterials] = useState(parentMaterials || []);
   const [subjects, setSubjects] = useState(parentSubjects || []);
   const [electivesSelected, setElectivesSelected] = useState([]);
   const [categories, setCategories] = useState([]);
   const [categoryCache, setCategoryCache] = useState({});
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedSubject, setSelectedSubject] = useState(subjectId || '');
   const [loading, setLoading] = useState(Boolean(!inline && (!parentSubjects || !parentMaterials)));
   const [error, setError] = useState(null);
   const [file, setFile] = useState(null);
   const [url, setUrl] = useState('');
   const [uploadSubject, setUploadSubject] = useState('');
   const [uploadCategoryId, setUploadCategoryId] = useState('');
   const [uploading, setUploading] = useState(false);
   const [offlineFiles, setOfflineFiles] = useState({});
   const [viewingFile, setViewingFile] = useState(null);
   const [numPages, setNumPages] = useState(null);
   const [anchorEl, setAnchorEl] = useState(null);
   const [uploadModalOpen, setUploadModalOpen] = useState(false);
   const [editModalOpen, setEditModalOpen] = useState(false);
   const [editFileId, setEditFileId] = useState(null);
   const [editFileName, setEditFileName] = useState('');
   const [newCategoryName, setNewCategoryName] = useState('');
   const [categoryLoading, setCategoryLoading] = useState(Boolean(!inline));
   const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
   const [tabValue, setTabValue] = useState(0);

   const token = localStorage.getItem('token');
   const role = localStorage.getItem('role')?.toUpperCase() || '';
   const isCR = role === 'CR';
   const crType = localStorage.getItem('cr_type')?.toLowerCase() || '';
   const classcode = localStorage.getItem('classcode') || '';
   const electiveId = localStorage.getItem('cr_elective_id') || null;
   const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
   const userId = localStorage.getItem('user_id');
   const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

   // If embedded inline, skip automatic server fetches to avoid duplicate calls/rate limits.
   useEffect(() => {
     if (inline) {
       // Use cached/provided parent data if available; otherwise show empty state but don't call APIs.
       setLoading(false);
       setCategoryLoading(false);
       return;
     }

     let mounted = true;
     (async () => {
       try {
         if (!token) {
           setError('Please log in to access materials');
           navigate('/login', { replace: true });
           return;
         }

         setLoading(true);
         // original initialization logic goes here (fetch subjects, materials, categories, electives)
         if (role.toLowerCase() === 'student') {
           await fetchElectives();
         }
         await fetchSubjects();
         await fetchMaterials();
         if (subjectId) {
           setSelectedSubject(subjectId);
           await fetchCategories(subjectId);
         } else {
           setCategories([]);
         }
         // if you have a local/offline loader, call it here (optional)
         // await loadOfflineFiles();
       } catch (err) {
         console.error('Materials init error:', err);
         if (mounted) setError('Failed to load materials');
       } finally {
         if (mounted) setLoading(false);
       }
     })();

     return () => { mounted = false; };
   }, [inline, navigate, token, subjectId]);

   const fetchElectives = async () => {
     if (role.toLowerCase() !== 'student') return;
     try {
       const response = await axios.get(`${API_URL}/api/electives/enrolled`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       setElectivesSelected(response.data || []);
     } catch (err) {
       setElectivesSelected([]);
     }
   };

   const fetchCategories = async (subjectId) => {
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
       setError(err.response?.data?.error || 'Failed to fetch categories');
       setCategories([]);
     }
   };

   useEffect(() => {
     const handler = debounce(() => setDebouncedQuery(searchQuery), 300);
     handler();
     return () => handler.cancel();
   }, [searchQuery]);

   const fetchSubjects = useCallback(async () => {

    if (inline || (parentSubjects && parentSubjects.length)) {
      if (parentSubjects && parentSubjects.length) {
        setSubjects(parentSubjects);
      }
      return;
    }
     try {
       let coreSubjects = [];
       if (isCR && crType === 'elective') {
         coreSubjects = [{
           id: `elective_${electiveId}`,
           name: `Elective ${electiveId}`,
           isElective: true,
           elective_id: parseInt(electiveId)
         }];
       } else {
         const response = await axios.get(`${API_URL}/api/subjects`, {
           headers: { 'Authorization': `Bearer ${token}` }
         });
         coreSubjects = response.data.map(subject => ({
           ...subject,
           isElective: false
         }));
       }

       const electiveSubjects = role === 'STUDENT' && electivesSelected.length > 0
         ? electivesSelected
             .filter(e => e.status === 'enrolled')
             .map(e => ({
               id: `elective_${e.id}`,
               name: e.name,
               isElective: true,
               elective_id: e.id
             }))
         : [];

       const allSubjects = [...coreSubjects, ...electiveSubjects];
       setSubjects(allSubjects);
     } catch (err) {
       setError(err.response?.data?.error || 'Failed to fetch subjects');
       setSubjects([]);
     }
   }, [token, isCR, crType, electiveId, role, electivesSelected]);

   const fetchMaterials = useCallback(async () => {
     setIsLoadingMaterials(true);
     try {
       const response = await axios.get(`${API_URL}/api/materials`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });

       const allMaterials = response.data;
      let filteredMaterials = [...allMaterials];

      if (role === 'STUDENT') {
        const enrolledElectiveIds = electivesSelected
          .filter(e => e.status === 'enrolled')
          .map(e => Number(e.id));
        filteredMaterials = allMaterials.filter(m =>
          (m.classcode === classcode && !m.elective_id) ||
          (m.elective_id && enrolledElectiveIds.includes(Number(m.elective_id)))
        );
      } else if (isCR && crType === 'regular') {
        filteredMaterials = allMaterials.filter(m =>
          m.classcode === classcode && !m.elective_id
        );
      } else if (isCR && crType === 'elective') {
        const parsedElectiveId = parseInt(electiveId, 10);
        filteredMaterials = allMaterials.filter(m => Number(m.elective_id) === parsedElectiveId);
      }

      setMaterials(filteredMaterials);
      setIsLoadingMaterials(false);
      setLoading(false);
    } catch (error) {
      setError('Failed to fetch materials');
      setMaterials([]);
    }
  }, [token, role, isCR, crType, classcode, electiveId, electivesSelected]);

  const loadOfflineFiles = async () => {
    const storedFiles = {};
    await localforage.iterate((value, key) => {
      storedFiles[key] = value;
    });
    setOfflineFiles(storedFiles);
  };

  const handleDownload = async (material) => {
    if (material.url) {
      window.open(material.url, '_blank');
      return;
    }
    if (!material.path) {
      setError('No file path available for download');
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
      setError(err.response?.data?.error || 'Failed to download file');
    }
  };

  const handleView = async (material) => {
    if (material.url) {
      window.open(material.url, '_blank');
      return;
    }
    const offlineFile = offlineFiles[material.id];
    if (offlineFile) {
      try {
        const url = URL.createObjectURL(offlineFile.blob);
        setViewingFile({ url, type: offlineFile.type, filename: material.filename || offlineFile.filename });
      } catch (err) {
        setError('Failed to display offline file');
      }
    } else {
      await handleDownload(material);
      const updatedOfflineFile = offlineFiles[material.id];
      if (updatedOfflineFile) {
        try {
          const url = URL.createObjectURL(updatedOfflineFile.blob);
          setViewingFile({ url, type: updatedOfflineFile.type, filename: material.filename || updatedOfflineFile.filename });
        } catch (err) {
          setError('Failed to display file after download');
        }
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file && !url) {
      setError('Please select a file or provide a URL');
      return;
    }

    if (file && url) {
      setError('Provide either a file or a URL, not both');
      return;
    }

    if (!uploadSubject) {
      setError('Please select a subject');
      return;
    }

    if (!uploadCategoryId) {
      setError('Please select a category');
      return;
    }

    let subjectId = null;
    let electiveId = null;

    if (uploadSubject.startsWith('elective_')) {
      electiveId = Number(uploadSubject.split('_')[1]);
      if (isNaN(electiveId)) {
        setError('Invalid elective selected');
        return;
      }
    } else {
      subjectId = Number(uploadSubject);
      if (isNaN(subjectId)) {
        setError('Invalid subject selected');
        return;
      }
    }

    setUploading(true);
    const formData = new FormData();

    if (file) formData.append('file', file);
    if (url) formData.append('url', url);
    formData.append('category_id', uploadCategoryId);

    if (uploadSubject.startsWith('elective_')) {
      formData.append('elective_id', electiveId);
    } else {
      formData.append('subject_id', subjectId);
      formData.append('classcode', classcode);
    }

    try {
      const response = await axios.post(`${API_URL}/api/materials/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setFile(null);
      setUrl('');
      setUploadSubject('');
      setUploadCategoryId('');
      setUploadModalOpen(false);
      await fetchMaterials();
      await fetchCategories(uploadSubject);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload material');
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
      setError(err.response?.data?.error || 'Failed to delete material');
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
      setError(err.response?.data?.error || 'Failed to edit material');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName) {
      setError('Category name is required');
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/materials/categories`, {
        name: newCategoryName,
        subject_id: parseInt(selectedSubject, 10),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewCategoryName('');
      setCategories([...categories, response.data]);
      setCategoryCache((prev) => ({ ...prev, [selectedSubject]: [...(prev[selectedSubject] || []), response.data] }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create category');
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

  const SubjectDashboard = () => (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
      <h2 className="text-2xl font-bold text-blue-600 mb-4">Materials</h2>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Grid container spacing={2}>
          {[...Array(4)].map((_, i) => (
            <Grid key={i} item xs={12}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : subjects.length === 0 ? (
        <Typography>No subjects available.</Typography>
      ) : (
        <Grid container spacing={2}>
          {subjects.map((subject) => (
            <Grid key={subject.id} item xs={12}>
              <Card
                className="card"
                onClick={() => {
                  setSelectedSubject(subject.id.toString());
                  navigate(`/materials/${subject.id}`);
                }}
                sx={{ cursor: 'pointer' }}
              >
                <CardContent>
                  <Typography variant="h6">{subject.name}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </div>
  );

  const CategoryView = React.memo(() => {
    const { subjectId } = useParams();
    const subject = subjects.find((s) => s.id.toString() === subjectId);
    const [localNewCategoryName, setLocalNewCategoryName] = useState('');
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
      if (subjectId && !categoryCache[subjectId]) {
        setFetching(true);
        setCategoryLoading(true);
        fetchCategories(subjectId)
          .then(() => {
            setCategoryLoading(false);
            setFetching(false);
          })
          .catch(() => {
            setCategoryLoading(false);
            setFetching(false);
          });
      } else if (subjectId) {
        setCategories(categoryCache[subjectId] || []);
        setCategoryLoading(false);
      }
    }, [subjectId, categoryCache]);

    if (!subject || !subjects.length) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <Typography variant="h4" color="error">
            {subjects.length ? 'Subject Not Found' : 'Loading Subjects...'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/materials')}
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-2xl font-bold text-blue-600 mb-4">{subject.name} Materials</h2>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isCR && (crType === 'regular' || crType === 'elective') && (
          <Box component="form" onSubmit={(e) => {
            e.preventDefault();

            if (!localNewCategoryName) {
              setError('Category name is required');
              return;
            }

            let parsedSubjectId = null;

            if (typeof selectedSubject === 'string') {
              if (selectedSubject.startsWith('elective_')) {
                const parts = selectedSubject.split('_');
                parsedSubjectId = parseInt(parts[1], 10);
              } else {
                parsedSubjectId = parseInt(selectedSubject, 10);
              }
            } else if (typeof selectedSubject === 'number') {
              parsedSubjectId = selectedSubject;
            }

            if (!parsedSubjectId || isNaN(parsedSubjectId)) {
              setError('Invalid subject selected. Please try again.');
              return;
            }

            const payload = {
              name: localNewCategoryName,
              subject_id: parsedSubjectId,
            };

            axios.post(`${API_URL}/api/materials/categories`, payload, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((response) => {
                setLocalNewCategoryName('');
                setCategories([...categories, response.data]);
                setCategoryCache((prev) => ({
                  ...prev,
                  [selectedSubject]: [...(prev[selectedSubject] || []), response.data],
                }));
              })
              .catch((err) => {
                setError(err.response?.data?.error || 'Failed to create category');
              });
          }} sx={{ mb: 4 }}>
            <TextField
              key="new-category-input"
              label="New Category"
              value={localNewCategoryName}
              onChange={(e) => setLocalNewCategoryName(e.target.value)}
              sx={{ mr: 2, width: 300, bgcolor: 'background.paper', borderRadius: 2 }}
            />
            <Button type="submit" variant="contained" color="primary">
              Add Category
            </Button>
          </Box>
        )}
        {categoryLoading ? (
          <Grid container spacing={2}>
            {[...Array(4)].map((_, i) => (
              <Grid key={i} item xs={12} sm={6} md={4}>
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : categories.length === 0 ? (
          <Typography variant="h6" color="textSecondary" sx={{ mb: 2 }}>
            No categories are present.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {categories.map((category) => (
              <Grid key={category.id} item xs={12} sm={6} md={4}>
                <Card
                  className="card"
                  onClick={() => navigate(`/materials/${subjectId}/${category.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent>
                    <Typography variant="h6">{category.name}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </div>
    );
  });

  const FilesView = () => {
    const { subjectId, categoryId } = useParams();

    useEffect(() => {
      if (subjectId) {
        const key = subjectId;
        if (!categoryCache[key]) {
          fetchCategories(subjectId);
        } else {
          setCategories(categoryCache[key] || []);
        }
      }
    }, [subjectId, categoryCache]);

    const parsedCategoryId = parseInt(categoryId, 10);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredMaterials = normalizedQuery
      ? materials.filter((m) => {
          const fields = [
            m.filename,
            m.subject_name,
            m.uploaded_by_name
          ];
          return fields.some(field =>
            field?.toLowerCase().includes(normalizedQuery)
          );
        })
      : materials;

    let filteredFiles;
    if (subjectId.startsWith('elective_')) {
      const electiveId = parseInt(subjectId.split('_')[1], 10);
      filteredFiles = filteredMaterials.filter(
        (m) => m.elective_id === electiveId && m.category_id === parsedCategoryId
      );
    } else {
      const parsedSubjectId = parseInt(subjectId, 10);
      filteredFiles = filteredMaterials.filter(
        (m) => m.subject_id === parsedSubjectId && m.category_id === parsedCategoryId
      );
    }

    const category = categories.find((c) => c.id === parseInt(categoryId));

    if (!subjectId || !categoryId) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <Typography variant="h4" color="error">
            Invalid Subject or Category
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/materials')}
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </div>
      );
    }

    if (!category && categoryId) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <Typography variant="h4" color="error">
            Category Not Found
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/materials/${subjectId}`)}
            sx={{ mt: 2 }}
          >
            Back to Categories
          </Button>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-2xl font-bold text-blue-600 mb-4">{category ? category.name : 'Materials'}</h2>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isCR && (
          <Box sx={{ mb: 4 }}>
            <IconButton
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
                setUploadSubject(subjectId);
                setUploadCategoryId(categoryId);
              }}
              aria-label="Upload material"
            >
              <AttachFile />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl) && !editFileId}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={() => { setUploadModalOpen(true); setAnchorEl(null); }}>
                Upload File
              </MenuItem>
              <MenuItem onClick={() => { setUploadModalOpen(true); setUrl(''); setFile(null); setAnchorEl(null); }}>
                Add Link
              </MenuItem>
            </Menu>
            <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)}>
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'background.paper',
                  p: 4,
                  borderRadius: 2,
                  boxShadow: 24,
                  width: 400,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Upload Material
                </Typography>
                <form onSubmit={handleUpload}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="category-select-label">Category</InputLabel>
                    <Select
                      labelId="category-select-label"
                      value={uploadCategoryId}
                      onChange={(e) => setUploadCategoryId(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="">Select Category</MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      setFile(e.target.files[0]);
                      setUrl('');
                    }}
                    fullWidth
                    disabled={!!url}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Or enter URL"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setFile(null);
                    }}
                    fullWidth
                    disabled={!!file}
                    sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 2 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={<Upload />}
                    disabled={uploading || (!file && !url)}
                    fullWidth
                  >
                    {uploading ? <CircularProgress size={24} /> : 'Upload'}
                  </Button>
                </form>
              </Box>
            </Modal>
          </Box>
        )}
        {isLoadingMaterials ? (
          <Grid container spacing={2}>
            {[...Array(4)].map((_, i) => (
              <Grid key={i} item xs={12} sm={6} md={4}>
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : filteredFiles.length === 0 ? (
          <Typography>No materials available for this category.</Typography>
        ) : (
          <Grid container spacing={2}>
            {filteredFiles.map((material) => (
              <Grid key={material.id} item xs={12} sm={6} md={4}>
                <Card className="card" onDoubleClick={() => handleView(material)} sx={{ cursor: 'pointer' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center">
                        {material.url ? (
                          <LinkIcon color="secondary" sx={{ mr: 1 }} />
                        ) : material.filename?.endsWith('.pdf') ? (
                          <PictureAsPdf color="error" sx={{ mr: 1 }} />
                        ) : (
                          <Image color="primary" sx={{ mr: 1 }} />
                        )}
                        <Typography variant="subtitle1" noWrap>
                          {material.filename || material.url}
                        </Typography>
                      </Box>
                      <Box>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(material);
                          }}
                          aria-label="Download material"
                        >
                          <Download />
                        </IconButton>
                        {material.uploaded_by === parseInt(userId) && (
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuOpen(e, material.id);
                            }}
                            aria-label="More options"
                          >
                            <MoreVert />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                    <Typography variant="body2">
                      Subject: {material.subject_name}
                    </Typography>
                    <Typography variant="body2">
                      Uploaded by {material.uploaded_by_name} on {moment(material.created_at).format('MMM D, YYYY')}
                    </Typography>
                  </CardContent>
                </Card>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl) && editFileId === material.id}
                  onClose={handleMenuClose}
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem
                    onClick={() => {
                      setEditFileName(material.filename);
                      setEditModalOpen(true);
                      setAnchorEl(null);
                    }}
                  >
                    Edit Name
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      handleDelete(material.id);
                      setAnchorEl(null);
                    }}
                  >
                    Delete
                  </MenuItem>
                </Menu>
              </Grid>
            ))}
          </Grid>
        )}
        <EditFileNameDialog
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          editFileName={editFileName}
          setEditFileName={setEditFileName}
          onSave={handleEdit}
        />
        {viewingFile && (
          <Modal open={Boolean(viewingFile)} onClose={() => setViewingFile(null)}>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                bgcolor: 'background.paper',
                p: 4,
                borderRadius: 2,
                boxShadow: 24,
                maxWidth: '90%',
                maxHeight: '90%',
                overflow: 'auto',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{viewingFile.filename}</Typography>
                <IconButton onClick={() => setViewingFile(null)}>
                  <Close />
                </IconButton>
              </Box>
              {viewingFile.type === 'pdf' ? (
                <Document
                  file={viewingFile.url}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  error={<Typography color="error">Failed to load PDF</Typography>}
                >
                  {Array.from(new Array(numPages || 0), (el, index) => (
                    <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={1.0} />
                  ))}
                </Document>
              ) : (
                <img src={viewingFile.url} alt={viewingFile.filename} style={{ maxWidth: '100%', borderRadius: 4 }} />
              )}
            </Box>
          </Modal>
        )}
      </div>
    );
  };

  const uploadMaterial = async (file, title, subjectId) => {
    try {
      if (!file) throw new Error('No file provided');

      const form = new FormData();
      form.append('file', file);               // match backend field name
      form.append('title', title || file.name);
      if (subjectId) form.append('subject_id', subjectId);

      const token = localStorage.getItem('token');

      const res = await fetch(`${API_URL}/api/materials/upload`, {
        method: 'POST',
        headers: {
          // DO NOT set 'Content-Type' here — browser will set the multipart boundary
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: form
      });

      if (!res.ok) {
        // read body (json or text) for detailed error
        let body;
        try { body = await res.json(); } catch (e) { body = await res.text(); }
        throw new Error(`Upload failed ${res.status}: ${JSON.stringify(body)}`);
      }

      const data = await res.json();
      // handle success (e.g., add to list)
      return data;
    } catch (err) {
      console.error('uploadMaterial error:', err);
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>
        {`
          .dashboard-container { max-width: 1200px; margin: 0 auto; }
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
        `}
      </style>
      <div className="dashboard-container">
        <div className="dashboard-header mb-6">
          <h1 className="text-3xl font-bold text-white">Materials</h1>
        </div>
        <ThemeProvider theme={theme}>
          
          <Routes>
            <Route path="/" element={<SubjectDashboard />} />
            <Route path=":subjectId" element={<CategoryView />} />
            <Route path=":subjectId/:categoryId" element={<FilesView />} />
            <Route path="*" element={<Navigate to="/materials" replace />} />
          </Routes>
        </ThemeProvider>
      </div>
    </div>
  );
};

export default MaterialDashboard;