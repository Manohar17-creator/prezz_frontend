import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab, Box } from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const StudentDashboard = () => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    const [todayClasses, setTodayClasses] = useState([]);
    const [attendance, setAttendance] = useState({}); // { class_id: { date: { status, reason } } }
    const [pendingTodayAttendance, setPendingTodayAttendance] = useState({}); // Temporary state for today's changes
    const [pendingHistoricalAttendance, setPendingHistoricalAttendance] = useState({}); // Temporary state for historical changes
    const [reasons, setReasons] = useState(['Health Issue', 'Placement Drive']);
    const [customReason, setCustomReason] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date('2025-05-28')); // Set to May 28, 2025
    const [historicalClasses, setHistoricalClasses] = useState([]);
    const [semesterClasses, setSemesterClasses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [semesterDates, setSemesterDates] = useState({ semester_start_date: '', semester_end_date: '' });
    const [subjects, setSubjects] = useState([]);
    const [tabValue, setTabValue] = useState(0);
    const [error, setError] = useState(null);
    const [selectedWeekStart, setSelectedWeekStart] = useState('2025-05-26'); // Fixed to May 26, 2025 (Monday)

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        return `${hours}:${minutes}`;
    };

    const normalizeDate = (dateInput) => {
        if (!dateInput) return '';
        if (typeof dateInput === 'string') {
            if (dateInput.includes('T')) {
                return dateInput.split('T')[0];
            }
            return dateInput;
        }
        const date = new Date(dateInput);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const getDayOfWeek = (dateString) => {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const date = new Date(dateString);
        return daysOfWeek[date.getDay()];
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const profileRes = await fetch(`${API_URL}/api/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!profileRes.ok) {
                    throw new Error('Failed to fetch profile data');
                }
                const profileData = await profileRes.json();
                const startDate = profileData.semester_start_date || '2025-01-01';
                const endDate = normalizeDate(new Date('2025-05-28')); // Use May 28, 2025
                setSemesterDates({
                    semester_start_date: startDate,
                    semester_end_date: profileData.semester_end_date || ''
                });

                const [todayClassesRes, timeSlotsRes, schedulesRes, holidaysRes, semesterClassesRes, attendanceRes, reasonsRes, subjectsRes] = await Promise.all([
                    fetch(`${API_URL}/api/today-classes`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/time-slots`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/class-schedules`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/holidays`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/classes/semester`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/attendance?start_date=${startDate}&end_date=${endDate}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_URL}/api/attendance/reasons`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/subjects`, { headers: { 'Authorization': `Bearer ${token}` } }),
                ]);

                const responses = [todayClassesRes, timeSlotsRes, schedulesRes, holidaysRes, semesterClassesRes, attendanceRes, reasonsRes, subjectsRes];
                for (const res of responses) {
                    if (res.status === 401 || res.status === 403) {
                        setError('Failed to fetch data: You do not have permission. Please log in as a student.');
                        localStorage.removeItem('token');
                        navigate('/login');
                        return;
                    }
                }

                const todayClassesData = await todayClassesRes.json();
                const timeSlotsData = await timeSlotsRes.json();
                const schedulesData = await schedulesRes.json();
                const holidaysData = await holidaysRes.json();
                const semesterClassesData = await semesterClassesRes.json();
                const attendanceData = await attendanceRes.json();
                const reasonsData = await reasonsRes.json();
                const subjectsData = await subjectsRes.json();

                console.log('Today’s classes:', todayClassesData);
                console.log('Semester classes:', semesterClassesData);
                console.log('Attendance data:', attendanceData);

                setTodayClasses(todayClassesData.sort((a, b) => a.start_time.localeCompare(b.start_time)));
                setTimeSlots(timeSlotsData);
                setSchedules(schedulesData);
                setHolidays(holidaysData);
                setSemesterClasses(semesterClassesData);
                setReasons(reasonsData);
                setSubjects(subjectsData);

                const initialAttendance = {};
                todayClassesData.forEach(cls => {
                    const matchingRecords = attendanceData.filter(a => a.class_id === cls.id);
                    matchingRecords.forEach(record => {
                        if (!initialAttendance[cls.id]) {
                            initialAttendance[cls.id] = {};
                        }
                        initialAttendance[cls.id][normalizeDate(record.date_str || record.date)] = {
                            status: record.status,
                            reason: record.reason || ''
                        };
                    });
                    if (!initialAttendance[cls.id]) {
                        initialAttendance[cls.id] = {};
                        initialAttendance[cls.id][normalizeDate(new Date('2025-05-28'))] = { status: '', reason: '' };
                    }
                });
                semesterClassesData.forEach(cls => {
                    const matchingRecords = attendanceData.filter(a => a.class_id === cls.id);
                    matchingRecords.forEach(record => {
                        if (!initialAttendance[cls.id]) {
                            initialAttendance[cls.id] = {};
                        }
                        initialAttendance[cls.id][normalizeDate(record.date_str || record.date)] = {
                            status: record.status,
                            reason: record.reason || ''
                        };
                    });
                });
                console.log('Initial attendance state:', initialAttendance);
                setAttendance(initialAttendance);

                await fetchHistoricalClasses(selectedDate, semesterClassesData, attendanceData);
            } catch (error) {
                console.error('Fetch data error:', error);
                setError('Failed to load data. Please log in again.');
                localStorage.removeItem('token');
                navigate('/login');
            }
        };
        fetchData();
    }, [navigate, token]);

    const fetchHistoricalClasses = async (date, semesterClassesData = semesterClasses, attendanceData = []) => {
        const dateString = normalizeDate(date);
        const dayOfWeek = getDayOfWeek(dateString);
        const historical = semesterClassesData.filter(cls => {
            const specificDate = normalizeDate(cls.specific_date);
            const startDate = normalizeDate(cls.start_date);
            const endDate = normalizeDate(cls.end_date);
            if (specificDate) {
                return specificDate === dateString;
            }
            if (cls.day_of_week && startDate && endDate) {
                return cls.day_of_week === dayOfWeek && startDate <= dateString && endDate >= dateString;
            }
            return false;
        }).sort((a, b) => a.start_time.localeCompare(b.start_time));

        console.log(`Historical classes for ${dateString}:`, historical);

        const existingAttendance = { ...attendance };
        const missingClasses = historical.filter(cls => {
            const records = existingAttendance[cls.id] || {};
            return !records[dateString];
        });
        if (missingClasses.length > 0) {
            const attendanceRes = await fetch(`${API_URL}/api/attendance?start_date=${dateString}&end_date=${dateString}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (attendanceRes.ok) {
                const newAttendanceData = await attendanceRes.json();
                console.log(`Attendance data for ${dateString}:`, newAttendanceData);
                historical.forEach(cls => {
                    const attendanceRecord = newAttendanceData.find(a => a.class_id === cls.id && normalizeDate(a.date_str || a.date) === dateString);
                    if (!existingAttendance[cls.id]) {
                        existingAttendance[cls.id] = {};
                    }
                    existingAttendance[cls.id][dateString] = attendanceRecord ? {
                        status: attendanceRecord.status,
                        reason: attendanceRecord.reason || ''
                    } : { status: '', reason: '' };
                });
                setAttendance(existingAttendance);
            }
        }
        setHistoricalClasses(historical);
    };

    const handlePendingAttendanceChange = (classId, date, status, reason, isTodaySection) => {
        const dateString = normalizeDate(date);
        if (isTodaySection) {
            setPendingTodayAttendance(prev => {
                const newPending = { ...prev };
                if (!newPending[classId]) {
                    newPending[classId] = {};
                }
                newPending[classId][dateString] = { status, reason };
                console.log('Updated pending today attendance:', newPending);
                return newPending;
            });
        } else {
            setPendingHistoricalAttendance(prev => {
                const newPending = { ...prev };
                if (!newPending[classId]) {
                    newPending[classId] = {};
                }
                newPending[classId][dateString] = { status, reason };
                console.log('Updated pending historical attendance:', newPending);
                return newPending;
            });
        }
    };

    const handleReasonChange = (classId, reason, date, isTodaySection) => {
        const dateString = normalizeDate(date);
        if (isTodaySection) {
            setPendingTodayAttendance(prev => {
                const newPending = { ...prev };
                if (!newPending[classId]) {
                    newPending[classId] = {};
                }
                newPending[classId][dateString] = {
                    status: newPending[classId][dateString]?.status || 'absent',
                    reason
                };
                return newPending;
            });
        } else {
            setPendingHistoricalAttendance(prev => {
                const newPending = { ...prev };
                if (!newPending[classId]) {
                    newPending[classId] = {};
                }
                newPending[classId][dateString] = {
                    status: newPending[classId][dateString]?.status || 'absent',
                    reason
                };
                return newPending;
            });
        }
    };

    const handleCustomReasonSubmit = (classId, date, isTodaySection) => {
        if (customReason && !reasons.includes(customReason)) {
            handlePendingAttendanceChange(classId, date, 'absent', customReason, isTodaySection);
            setCustomReason('');
            setReasons(prev => [...prev, customReason]);
        }
    };

    const saveAttendance = async (isTodaySection) => {
        const pendingAttendance = isTodaySection ? pendingTodayAttendance : pendingHistoricalAttendance;
        const dateToSave = isTodaySection ? today : normalizeDate(selectedDate);
        const entries = [];

        Object.keys(pendingAttendance).forEach(classId => {
            if (pendingAttendance[classId][dateToSave]) {
                const { status, reason } = pendingAttendance[classId][dateToSave];
                if (status) { // Only save if a status is selected
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
            console.log('No attendance changes to save');
            return;
        }

        console.log('Saving attendance entries:', entries);

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
            console.log('Attendance saved to backend:', savedRecords);

            // Update local attendance state with saved records
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
                console.log('Updated attendance state after save:', newAttendance);
                return newAttendance;
            });

            // Clear pending changes
            if (isTodaySection) {
                setPendingTodayAttendance({});
            } else {
                setPendingHistoricalAttendance({});
            }

            // Refresh historical attendance if the date matches today's date
            if (!isTodaySection && normalizeDate(selectedDate) === today) {
                await fetchHistoricalClasses(selectedDate);
            }
        } catch (error) {
            setError(error.message);
            console.error('Error saving attendance:', error.message);
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
    const weekDates = daysOfWeek.map((day, index) => {
        const dateObj = new Date(selectedWeekStart);
        dateObj.setDate(dateObj.getDate() + index);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const date = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${date}`;
        return {
            day,
            date: dateStr,
            displayDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
                    const dayIndex = currentDate.getDay();
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
                            return latest;
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

    const calculateAttendanceStats = () => {
        const stats = {};
        subjects.forEach(subject => {
            const subjectClasses = semesterClasses.filter(cls => cls.subject_id === subject.id);
            const totalClasses = subjectClasses.length;
            const attendedClasses = subjectClasses.filter(cls => {
                const records = attendance[cls.id] || {};
                return Object.values(records).some(record => record.status === 'present');
            }).length;

            const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
            const minPercentage = 80;
            const classesNeededForMin = totalClasses > 0 ? Math.ceil((minPercentage / 100) * totalClasses - attendedClasses) : 0;

            stats[subject.id] = {
                subject_id: subject.id,
                subject_name: subject.name,
                totalClasses,
                attendedClasses,
                percentage: percentage.toFixed(2),
                classesNeeded: classesNeededForMin > 0 ? classesNeededForMin : 0
            };
        });
        return stats;
    };

    const attendanceStats = calculateAttendanceStats();

    const getDatesWithClasses = () => {
        const datesWithClasses = new Set();
        semesterClasses.forEach(cls => {
            if (cls.specific_date) {
                datesWithClasses.add(normalizeDate(cls.specific_date));
            } else if (cls.day_of_week && cls.start_date && cls.end_date) {
                const start = normalizeDate(cls.start_date);
                const end = normalizeDate(cls.end_date);
                const dayOfWeek = daysOfWeek.indexOf(cls.day_of_week);
                let date = new Date(start);
                while (date <= new Date(end)) {
                    if (date.getDay() === (dayOfWeek + 1) % 7) { // Adjust for Monday start
                        datesWithClasses.add(normalizeDate(date));
                    }
                    date.setDate(date.getDate() + 1);
                }
            }
        });
        console.log('Dates with classes:', Array.from(datesWithClasses));
        return Array.from(datesWithClasses);
    };

    const getDailyAttendance = useMemo(() => {
        const dailyStats = {};
        const datesWithClasses = getDatesWithClasses();
        datesWithClasses.forEach(date => {
            const dayOfWeek = getDayOfWeek(date);
            const classesOnDate = semesterClasses.filter(cls => {
                if (cls.specific_date) {
                    return normalizeDate(cls.specific_date) === date;
                }
                if (cls.day_of_week && cls.start_date && cls.end_date) {
                    return cls.day_of_week === dayOfWeek && normalizeDate(cls.start_date) <= date && normalizeDate(cls.end_date) >= date;
                }
                return false;
            });

            const total = classesOnDate.length;
            let attended = 0;
            classesOnDate.forEach(cls => {
                const records = attendance[cls.id] || {};
                const record = records[date];
                if (record && record.status === 'present') {
                    attended += 1;
                }
            });

            const percentage = total > 0 ? (attended / total) * 100 : 0;
            dailyStats[date] = {
                percentage,
                color: percentage >= 80 ? 'green' : percentage >= 50 ? 'yellow' : 'red'
            };
        });
        console.log('Daily attendance stats:', dailyStats);
        return dailyStats;
    }, [attendance, semesterClasses]);

    const highlightDatesConfig = Object.keys(getDailyAttendance).map(date => {
        const config = {
            date: new Date(date),
            className: `react-datepicker__day--highlighted-${getDailyAttendance[date].color}`
        };
        return config;
    });
    console.log('highlightDatesConfig:', highlightDatesConfig);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const today = normalizeDate(new Date('2025-05-28'));

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <style>
                {`
                    .react-datepicker__day--highlighted-green {
                        background-color: #90ee90;
                        color: black;
                    }
                    .react-datepicker__day--highlighted-yellow {
                        background-color: #ffff99;
                        color: black;
                    }
                    .react-datepicker__day--highlighted-red {
                        background-color: #ff9999;
                        color: black;
                    }
                `}
            </style>
            <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">
                Student Dashboard
            </h1>
            {error && <div className="text-red-600 mb-4">{error}</div>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="navigation tabs">
                    <Tab label="Dashboard" />
                    <Tab label="Attendance Statistics" />
                </Tabs>
            </Box>

            {tabValue === 0 && (
                <>
                    {/* Today's Classes */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-blue-600 mb-4">Today’s Classes ({today})</h2>
                        {todayClasses.length === 0 ? (
                            <p className="text-gray-600">No classes scheduled for today.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {todayClasses.map(cls => {
                                        const record = pendingTodayAttendance[cls.id]?.[today] || attendance[cls.id]?.[today] || { status: '', reason: '' };
                                        return (
                                            <div key={cls.id} className="p-4 border rounded-lg flex items-start">
                                                <div className="flex-1">
                                                    <p className="text-gray-700">{cls.subject_name}</p>
                                                    <p className="text-gray-700">{cls.start_time} - {cls.end_time}</p>
                                                    <div className="mt-2">
                                                        <label className="mr-2">Attendance:</label>
                                                        <select
                                                            value={record.status || ''}
                                                            onChange={(e) => {
                                                                const newStatus = e.target.value;
                                                                handlePendingAttendanceChange(cls.id, today, newStatus, record.reason, true);
                                                            }}
                                                            className="p-2 border rounded-lg mr-2"
                                                        >
                                                            <option value="">Select Status</option>
                                                            <option value="present">Present</option>
                                                            <option value="absent">Absent</option>
                                                        </select>
                                                        {record.status === 'absent' && (
                                                            <div className="mt-2">
                                                                <label className="mr-2">Reason for Absence:</label>
                                                                <select
                                                                    value={record.reason || ''}
                                                                    onChange={(e) => {
                                                                        if (e.target.value === 'custom') {
                                                                            setCustomReason('');
                                                                        } else {
                                                                            handleReasonChange(cls.id, e.target.value, today, true);
                                                                        }
                                                                    }}
                                                                    className="p-2 border rounded-lg mr-2"
                                                                >
                                                                    <option value="">Select Reason</option>
                                                                    {reasons.map((reason, idx) => (
                                                                        <option key={idx} value={reason}>{reason}</option>
                                                                    ))}
                                                                    <option value="custom">Custom Reason</option>
                                                                </select>
                                                                {record.reason === 'custom' && (
                                                                    <div className="mt-2">
                                                                        <input
                                                                            type="text"
                                                                            value={customReason}
                                                                            onChange={(e) => setCustomReason(e.target.value)}
                                                                            placeholder="Enter custom reason"
                                                                            className="border p-2 rounded-lg mr-2"
                                                                        />
                                                                        <button
                                                                            onClick={() => handleCustomReasonSubmit(cls.id, today, true)}
                                                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                                                        >
                                                                            Save Reason
                                                                        </button>
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
                                <button
                                    onClick={() => saveAttendance(true)}
                                    className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                >
                                    Save Attendance
                                </button>
                            </>
                        )}
                    </div>

                    {/* Historical Attendance */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                        <h2 className="text-2xl font-bold text-blue-600 mb-4">Historical Attendance</h2>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-1">Select Date</label>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                minDate={semesterDates.semester_start_date ? new Date(semesterDates.semester_start_date) : new Date('2025-01-01')}
                                maxDate={new Date('2025-05-28')}
                                highlightDates={highlightDatesConfig.map(config => ({
                                    [config.className]: [config.date]
                                }))}
                                inline
                                className="border p-2 rounded-lg"
                            />
                        </div>
                        {historicalClasses.length === 0 ? (
                            <p className="text-gray-600">No classes scheduled for {normalizeDate(selectedDate)}.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {historicalClasses.map(cls => {
                                        const dateString = normalizeDate(selectedDate);
                                        const record = pendingHistoricalAttendance[cls.id]?.[dateString] || attendance[cls.id]?.[dateString] || { status: '', reason: '' };
                                        return (
                                            <div key={cls.id} className="p-4 border rounded-lg flex items-start">
                                                <div className="flex-1">
                                                    <p className="text-gray-700">{cls.subject_name}</p>
                                                    <p className="text-gray-700">{cls.start_time} - {cls.end_time}</p>
                                                    <div className="mt-2">
                                                        <label className="mr-2">Attendance:</label>
                                                        <select
                                                            value={record.status || ''}
                                                            onChange={(e) => {
                                                                const newStatus = e.target.value;
                                                                handlePendingAttendanceChange(cls.id, selectedDate, newStatus, record.reason, false);
                                                            }}
                                                            className="p-2 border rounded-lg mr-2"
                                                            disabled={dateString > today}
                                                        >
                                                            <option value="">Select Status</option>
                                                            <option value="present">Present</option>
                                                            <option value="absent">Absent</option>
                                                        </select>
                                                        {record.status === 'absent' && (
                                                            <div className="mt-2">
                                                                <label className="mr-2">Reason for Absence:</label>
                                                                <select
                                                                    value={record.reason || ''}
                                                                    onChange={(e) => {
                                                                        if (e.target.value === 'custom') {
                                                                            setCustomReason('');
                                                                        } else {
                                                                            handleReasonChange(cls.id, e.target.value, selectedDate, false);
                                                                        }
                                                                    }}
                                                                    className="p-2 border rounded-lg mr-2"
                                                                    disabled={dateString > today}
                                                                >
                                                                    <option value="">Select Reason</option>
                                                                    {reasons.map((reason, idx) => (
                                                                        <option key={idx} value={reason}>{reason}</option>
                                                                    ))}
                                                                    <option value="custom">Custom Reason</option>
                                                                </select>
                                                                {record.reason === 'custom' && (
                                                                    <div className="mt-2">
                                                                        <input
                                                                            type="text"
                                                                            value={customReason}
                                                                            onChange={(e) => setCustomReason(e.target.value)}
                                                                            placeholder="Enter custom reason"
                                                                            className="border p-2 rounded-lg mr-2"
                                                                            disabled={dateString > today}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleCustomReasonSubmit(cls.id, selectedDate, false)}
                                                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                                                            disabled={dateString > today}
                                                                        >
                                                                            Save Reason
                                                                        </button>
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
                                <button
                                    onClick={() => saveAttendance(false)}
                                    className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                    disabled={normalizeDate(selectedDate) > today}
                                >
                                    Save Attendance
                                </button>
                            </>
                        )}
                    </div>

                    {/* Weekly Timetable */}
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-blue-600">
                                Weekly Timetable ({`${weekDates[0].displayDate} - ${weekDates[6].displayDate}`})
                            </h2>
                            <div>
                                <button
                                    onClick={handlePreviousWeek}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg mr-2 hover:bg-gray-400"
                                >
                                    Previous Week
                                </button>
                                <button
                                    onClick={handleNextWeek}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                                >
                                    Next Week
                                </button>
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
                                                    <td key={`${date}-${index}`} className="border border-gray-300 p-2">
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
                </>
            )}

            {tabValue === 1 && (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-blue-600 mb-4">Attendance Statistics</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.values(attendanceStats).map(stat => (
                            <div key={stat.subject_id} className="p-4 border rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-600">{stat.subject_name}</h3>
                                <p className="text-gray-700">Attendance: {stat.percentage}%</p>
                                <p className="text-gray-700">Attended: {stat.attendedClasses} out of {stat.totalClasses} classes</p>
                                <p className="text-gray-700">
                                    {stat.classesNeeded > 0
                                        ? `Need ${stat.classesNeeded} more classes to maintain 80% attendance`
                                        : 'You have met the 80% attendance requirement'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;