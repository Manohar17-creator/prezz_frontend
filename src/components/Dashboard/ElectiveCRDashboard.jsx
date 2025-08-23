import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab, Box } from '@mui/material';
import { auth } from '../../firebase';

const ElectiveCRDashboard = () => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    const [electiveType, setElectiveType] = useState('core');
    const [electiveName, setElectiveName] = useState('');
    const [electiveProfessor, setElectiveProfessor] = useState('');
    const [electiveSchedule, setElectiveSchedule] = useState({
        start_date: '',
        end_date: '',
        day_of_week: '',
        time_slot_id: ''
    });

    const [timeSlots, setTimeSlots] = useState([]);
    const [newTimeSlot, setNewTimeSlot] = useState({ start_time: '', end_time: '' });
    const [deleteTimeSlotId, setDeleteTimeSlotId] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);
    const [crElectiveId, setCrElectiveId] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Track loading state

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

useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true);
    if (!token) {
      setError('No authentication token found. Please log in again.');
      navigate('/login');
      setIsLoading(false);
      return;
    }

    const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const waitTime = delay * Math.pow(2, i); // Exponential backoff
        console.warn(`Rate limit hit for ${url}, retrying after ${waitTime}ms... (attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      const waitTime = delay * Math.pow(2, i);
      console.warn(`Error for ${url}, retrying after ${waitTime}ms... (attempt ${i + 1}/${retries})`, err);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
};

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No current user, redirecting to login');
        navigate('/login');
        setIsLoading(false);
        return;
      }

      let idToken = await currentUser.getIdToken(true);
      let idTokenResult = await currentUser.getIdTokenResult();
      let claims = idTokenResult.claims;

      // Refresh token if cr_elective_id is missing
      if (!claims.cr_elective_id && claims.role === 'CR' && claims.cr_type === 'elective') {
        const refreshResponse = await fetch(`${API_URL}/api/refresh-token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!refreshResponse.ok) throw new Error('Failed to refresh token');
        const { token: newToken } = await refreshResponse.json();
        localStorage.setItem('token', newToken);
        idToken = newToken;
        idTokenResult = await currentUser.getIdTokenResult(true);
        claims = idTokenResult.claims;
      }

      if (!claims || claims.cr_type !== 'elective' || claims.role !== 'CR') {
        throw new Error('Invalid profile: You must be an Elective CR.');
      }
      if (!claims.cr_elective_id) {
        throw new Error('No elective assigned to this CR. Please contact support.');
      }
      setCrElectiveId(claims.cr_elective_id);

      const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      };

      // Define responses here, after token refresh
      const responses = await Promise.all([
        fetchWithRetry(`${API_URL}/api/time-slots`, { headers }),
        fetchWithRetry(`${API_URL}/api/elective-schedules`, { headers }),
        fetchWithRetry(`${API_URL}/api/electives/managed`, { headers })
      ]);

      // Now process the responses
      const [
        timeSlotsData = [],
        schedulesData = [],
        managedElectiveData = []
      ] = await Promise.all(responses.map(res => res.ok ? res.json() : []));
      console.log('Fetched time slots:', timeSlotsData);
      console.log('Fetched schedules:', schedulesData);
      console.log('Fetched managed elective:', managedElectiveData);

      const errorMessages = [];
      for (const res of responses) {
        if (res.status === 401 || res.status === 403) {
          errorMessages.push(`Unauthorized access at ${res.url}: You do not have permission.`);
          localStorage.removeItem('token');
          navigate('/login');
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          let errorData;
          try {
            errorData = await res.json();
          } catch (e) {
            errorData = { error: res.error || `HTTP ${res.status} at ${res.url}` };
          }
          if (res.url.includes('/api/elective-schedules') && errorData.error === 'No elective assigned to this CR') {
            setSchedules([]);
            continue;
          }
          errorMessages.push(`Error at ${res.url}: ${errorData.error || 'Unknown error'}`);
        }
      }

      if (errorMessages.length > 0) {
        console.error('Fetch errors:', errorMessages);
        setError(`Failed to load some data: ${errorMessages.join('; ')}`);
      }

      const sortedTimeSlots = [...timeSlotsData].sort((a, b) => {
        const timeA = new Date(`1970-01-01T${a.start_time.padStart(5, '0')}:00Z`);
        const timeB = new Date(`1970-01-01T${b.start_time.padStart(5, '0')}:00Z`);
        return timeA - timeB;
      });

      const normalizedSchedules = schedulesData.map(schedule => ({
        ...schedule,
        specific_date: schedule.specific_date && typeof schedule.specific_date === 'string' && schedule.specific_date.includes('T')
          ? new Date(schedule.specific_date).toISOString().slice(0, 10)
          : schedule.specific_date,
        start_date: schedule.start_date && schedule.start_date.includes('T')
          ? new Date(schedule.start_date).toISOString().slice(0, 10)
          : schedule.start_date,
        end_date: schedule.end_date && schedule.end_date.includes('T')
          ? new Date(schedule.end_date).toISOString().slice(0, 10)
          : schedule.end_date
      }));

      setTimeSlots(sortedTimeSlots);
      setSchedules(normalizedSchedules);

      if (managedElectiveData[0]) {
        setElectiveName(managedElectiveData[0].name || '');
        setElectiveProfessor(managedElectiveData[0].professor || '');
        setElectiveType(managedElectiveData[0].is_open ? 'open' : 'core');
      }
    } catch (err) {
      console.error('FetchData error:', err);
      setError(err.message || 'Failed to fetch data. Please log in again.');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
}, [token]);// Removed navigate from dependencies

    

    const handleAddElective = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (!crElectiveId) {
                throw new Error('No elective assigned to this CR');
            }
            const response = await fetch(`${API_URL}/api/class-schedules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    elective_id: crElectiveId,
                    time_slot_id: parseInt(electiveSchedule.time_slot_id),
                    day_of_week: electiveSchedule.day_of_week,
                    start_date: electiveSchedule.start_date,
                    end_date: electiveSchedule.end_date,
                    repeat_option: 'weekly',
                    canceled: false
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add schedule');
            }
            const newSchedule = await response.json();
            setElectiveSchedule({
                start_date: '',
                end_date: '',
                day_of_week: '',
                time_slot_id: ''
            });
            setError('Schedule added successfully');
            setTimeout(() => setError(''), 2000);
            // Refresh schedules
            const schedulesRes = await fetch(`${API_URL}/api/elective-schedules`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (schedulesRes.ok) {
                const schedulesData = await schedulesRes.json();
                const normalizedSchedules = schedulesData.map(schedule => ({
                    ...schedule,
                    specific_date: schedule.specific_date && typeof schedule.specific_date === 'string' && schedule.specific_date.includes('T')
                        ? new Date(schedule.specific_date).toISOString().slice(0, 10)
                        : schedule.specific_date,
                    start_date: schedule.start_date && schedule.start_date.includes('T')
                        ? new Date(schedule.start_date).toISOString().slice(0, 10)
                        : schedule.start_date,
                    end_date: schedule.end_date && schedule.end_date.includes('T')
                        ? new Date(schedule.end_date).toISOString().slice(0, 10)
                        : schedule.end_date
                }));
                setSchedules(normalizedSchedules);
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddTimeSlot = async (e) => {
        e.preventDefault();
        setError('');
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
            setTimeout(() => setError(''), 2000);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleDeleteTimeSlot = async (e) => {
        e.preventDefault();
        setError('');
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
            setTimeout(() => setError(''), 2000);
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
            const daySchedules = schedules.filter(schedule => {
                if (schedule.canceled === true) return false;

                if (schedule.specific_date) {
                    return schedule.specific_date === date;
                }

                if (schedule.day_of_week && schedule.start_date && schedule.end_date) {
                    const scheduleDayOfWeek = schedule.day_of_week;
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    const dayIndex = (currentDate.getDay() + 6) % 7;
                    const currentDayOfWeek = daysOfWeek[dayIndex];

                    if (scheduleDayOfWeek !== currentDayOfWeek) return false;

                    const startDate = new Date(schedule.start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(schedule.end_date);
                    endDate.setHours(0, 0, 0, 0);

                    if (currentDate < startDate || currentDate > endDate) return false;

                    return true;
                }

                return false;
            });

            const isDefaultHoliday = (day === 'Saturday' || day === 'Sunday') && !daySchedules.length;

            return {
                day,
                date,
                isHoliday: false,
                isDefaultHoliday,
                holidayDescription: 'Holiday',
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
                            return `[Elective] ${latestSchedule.elective_name}`;
                        }

                        const cancellation = slotSchedules.find(s => s.canceled === true);
                        if (cancellation) {
                            return 'Cancelled';
                        }
                    }

                    const schedule = daySchedules.find(s => s.time_slot_id === slot.id);
                    if (schedule) {
                        return `[Elective] ${schedule.elective_name}`;
                    }
                    return null;
                })
            };
        });
    }, [weekDates, schedules, timeSlots]);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
        const routes = ['/elective-cr-dashboard', '/materials', '/profile', '/upload-timetable'];
        navigate(routes[newValue]);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-blue-800 mb-8">Elective Class Representative Dashboard</h1>
            {error && <div className="text-red-600 mb-4 text-center">{error}</div>}
            {isLoading && <div className="text-gray-600 mb-4 text-center">Loading data...</div>}

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Elective Schedule</h2>
                <form onSubmit={handleAddElective}>
                    <div className="flex flex-col space-y-4">
                        <div>
                            <label className="block text-gray-700 mb-1">Elective Type</label>
                            <select
                                value={electiveType}
                                onChange={(e) => setElectiveType(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                disabled
                            >
                                <option value="core">Core Elective (Branch-Specific)</option>
                                <option value="open">Open Elective (College-Wide)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">Elective Name</label>
                            <input
                                type="text"
                                value={electiveName}
                                onChange={(e) => setElectiveName(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                disabled
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">Professor</label>
                            <input
                                type="text"
                                value={electiveProfessor}
                                className="w-full p-2 border rounded-lg bg-gray-100 focus:outline-none"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={electiveSchedule.start_date}
                                onChange={(e) => setElectiveSchedule({ ...electiveSchedule, start_date: e.target.value })}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                value={electiveSchedule.end_date}
                                onChange={(e) => setElectiveSchedule({ ...electiveSchedule, end_date: e.target.value })}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">Day of Week</label>
                            <select
                                value={electiveSchedule.day_of_week}
                                onChange={(e) => setElectiveSchedule({ ...electiveSchedule, day_of_week: e.target.value })}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                required
                            >
                                <option value="">Select Day of Week</option>
                                {daysOfWeek.map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">Time Slot</label>
                            <select
                                value={electiveSchedule.time_slot_id}
                                onChange={(e) => setElectiveSchedule({ ...electiveSchedule, time_slot_id: e.target.value })}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                required
                            >
                                <option value="">Select Time Slot</option>
                                {timeSlots.map(slot => (
                                    <option key={slot.id} value={slot.id}>
                                        {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                        >
                            Add Elective Schedule
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-700 mb-4">Manage Time Slots</h2>
                <form onSubmit={handleAddTimeSlot} className="mb-4">
                    <div className="flex flex-col space-y-4">
                        <input
                            type="time"
                            value={newTimeSlot.start_time}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, start_time: e.target.value })}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Start Time (e.g., 09:00)"
                            required
                        />
                        <input
                            type="time"
                            value={newTimeSlot.end_time}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, end_time: e.target.value })}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="End Time (e.g., 10:00)"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                        >
                            Add Time Slot
                        </button>
                    </div>
                </form>
                <form onSubmit={handleDeleteTimeSlot} className="flex space-x-4">
                    <select
                        value={deleteTimeSlotId}
                        onChange={(e) => setDeleteTimeSlotId(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        <option value="">Select Time Slot to Delete</option>
                        {timeSlots.map(slot => (
                            <option key={slot.id} value={slot.id}>
                                {`${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                        disabled={!deleteTimeSlotId}
                    >
                        Delete Time Slot
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-blue-700">
                        Weekly Timetable ({`${weekDates[0].displayDate} - ${weekDates[6].displayDate}`})
                    </h2>
                    <div>
                        <button
                            onClick={handlePreviousWeek}
                            className="mr-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
                        >
                            Previous Week
                        </button>
                        <button
                            onClick={handleNextWeek}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                        >
                            Next Week
                        </button>
                    </div>
                </div>
                {isLoading ? (
                    <p className="text-gray-600 text-center">Loading schedules...</p>
                ) : schedules.length === 0 ? (
                    <p className="text-gray-600 text-center">No schedules added yet. Use the form above to add a schedule for your elective.</p>
                ) : (
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
                )}
            </div>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="navigation tabs">
                    <Tab label="Dashboard" />
                    <Tab label="Materials" />
                    <Tab label="Profile" />
                    <Tab label="Upload Timetable" />
                </Tabs>
            </Box>
        </div>
    );
};

export default ElectiveCRDashboard;