import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab, Box } from '@mui/material';
import Compressor from 'compressorjs';

const UploadTimetable = () => {
    const navigate = useNavigate();
    const [tabValue, setTabValue] = useState(3);
    const [image, setImage] = useState(null);
    const [extractedTimetable, setExtractedTimetable] = useState(null);
    const [error, setError] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);

    const token = localStorage.getItem('token');
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!token) {
                    throw new Error('No token found. Please log in.');
                }

                const [subjectsRes, timeSlotsRes] = await Promise.all([
                    fetch(`${API_URL}/api/subjects`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/time-slots`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                if (!subjectsRes.ok) {
                    if (subjectsRes.status === 401) {
                        setError('Session expired. Please log in again.');
                        navigate('/login');
                        return;
                    }
                    throw new Error(`Failed to fetch subjects: ${subjectsRes.statusText}`);
                }
                if (!timeSlotsRes.ok) throw new Error(`Failed to fetch time slots: ${timeSlotsRes.statusText}`);

                const subjectsData = await subjectsRes.json();
                const timeSlotsData = await timeSlotsRes.json();

                const uniqueTimeSlots = Array.from(
                    new Map(timeSlotsData.map(slot => [`${slot.start_time}-${slot.end_time}`, slot])).values()
                );

                setSubjects(subjectsData);
                setTimeSlots(uniqueTimeSlots);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError(error.message);
                navigate('/login');
            }
        };
        fetchData();
    }, [navigate, token, API_URL]);

    const handleImageUpload = (e) => {
        const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
        if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
            setImage(file);
            processTimetableImage(file);
        } else {
            setError('Please upload a valid image (PNG or JPEG).');
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleImageUpload(e);
    };

    const processTimetableImage = async (file) => {
        try {
            setError(null);

            // Compress the image
            const compressedFile = await new Promise((resolve, reject) => {
                new Compressor(file, {
                    quality: 0.6,
                    maxWidth: 1024,
                    maxHeight: 1024,
                    success: resolve,
                    error: reject,
                });
            });

            // Send compressed image as FormData
            const formData = new FormData();
            formData.append('image', compressedFile);
            formData.append('subjects', JSON.stringify(subjects));
            formData.append('timeSlots', JSON.stringify(timeSlots));

            const response = await fetch(`${API_URL}/api/timetable/process-timetable`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to process timetable');
                } else {
                    const text = await response.text();
                    throw new Error(`Unexpected response: ${text.substring(0, 100)}...`);
                }
            }

            const data = await response.json();
            setExtractedTimetable(data);
        } catch (error) {
            console.error('Error processing timetable image:', error);
            setError(error.message);
        }
    };

    const handleConfirmTimetable = async () => {
        if (!extractedTimetable) {
            setError('No timetable data to confirm.');
            return;
        }

        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/class-schedules/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(extractedTimetable.schedules),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save timetable');
            }

            alert('Timetable successfully saved!');
            setImage(null);
            setExtractedTimetable(null);
            navigate('/cr-dashboard');
        } catch (error) {
            console.error('Error saving timetable:', error);
            setError(error.message);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
        if (newValue === 0) navigate('/cr-dashboard');
        if (newValue === 1) navigate('/materials');
        if (newValue === 2) navigate('/profile');
        if (newValue === 3) navigate('/upload-timetable');
    };

    return (
        <div className="min-h-screen bg-gray-200 p-8 pb-20">
            {error && <div className="text-red-500 mb-4">{error}</div>}

            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-700 mb-4">Upload Timetable</h2>
                <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="timetable-upload"
                    />
                    <label htmlFor="timetable-upload" className="cursor-pointer">
                        <p className="text-gray-700 mb-2">Drag and drop your timetable image here, or click to upload</p>
                        <button className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200">
                            Upload Image
                        </button>
                    </label>
                    {image && <p className="mt-4 text-gray-700">Selected: {image.name}</p>}
                </div>
            </div>

            {/* Display Extracted Timetable */}
            {extractedTimetable && (
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-4">Extracted Timetable</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-gray-300">
                            <thead>
                                <tr>
                                    <th className="border border-gray-300 p-2">Day</th>
                                    {extractedTimetable.timeSlots.map(slot => (
                                        <th key={slot.id} className="border border-gray-300 p-2">
                                            {slot.start_time} - {slot.end_time}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                    <tr key={day}>
                                        <td className="border border-gray-300 p-2">{day}</td>
                                        {extractedTimetable.timeSlots.map(slot => {
                                            const schedule = extractedTimetable.schedules.find(
                                                s => s.day_of_week === day && s.time_slot_id === slot.id
                                            );
                                            return (
                                                <td key={slot.id} className="border border-gray-300 p-2">
                                                    {schedule
                                                        ? subjects.find(sub => sub.id === schedule.subject_id)?.name || '-'
                                                        : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={handleConfirmTimetable}
                        className="w-full mt-4 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200"
                    >
                        Confirm and Save Timetable
                    </button>
                </div>
            )}

            {/* Navigation Bar */}
            <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, bgcolor: 'white', boxShadow: 3, p: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange} centered>
                    <Tab label="Home" />
                    <Tab label="Materials" />
                    <Tab label="Profile" />
                    <Tab label="Upload Timetable" />
                </Tabs>
            </Box>
        </div>
    );
};

export default UploadTimetable;