import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Select, MenuItem } from '@mui/material';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

const Register = () => {
    const API_URL = 'http://localhost:5000'; // Updated to match backend
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [classCode, setClassCode] = useState('');
    const [college, setCollege] = useState('');
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [semester, setSemester] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isCodeValidated, setIsCodeValidated] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState(null);

    const handleValidateCode = async () => {
        try {
            const response = await fetch(`${API_URL}/api/class-codes/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: classCode })
            });
            if (!response.ok) {
                const text = await response.text();
                console.error('Validation response:', text);
                throw new Error('Invalid class code');
            }
            const data = await response.json();
            if (!data.valid) {
                throw new Error('Invalid class code');
            }
            const detailsResponse = await fetch(`${API_URL}/api/class-codes/${classCode}`);
            if (!detailsResponse.ok) {
                throw new Error('Failed to fetch class code details');
            }
            const detailsData = await detailsResponse.json();
            setCollege(detailsData.college);
            setBranch(detailsData.branch);
            setSection(detailsData.section);
            setRoomNumber(detailsData.room_number);
            setIsCodeValidated(true);
            setError(null);
        } catch (error) {
            console.error('Error validating class code:', error);
            setError('Invalid class code');
            setIsCodeValidated(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (classCode && !isCodeValidated) {
            setError('Please validate the class code');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    username,
                    roll_no: rollNo,
                    class_code: classCode,
                    college,
                    branch,
                    section,
                    room_number: roomNumber,
                    semester,
                    password
                })
            });
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Registration response:', errorData);
                throw new Error(errorData.error || 'Registration failed');
            }
            const data = await response.json();
            localStorage.setItem('token', data.token);
            navigate('/student-dashboard');
        } catch (error) {
            console.error('Registration error:', error);
            setError(error.message || 'Failed to connect to the server');
        }
    };

    const togglePasswordVisibility = () => setShowPassword(!showPassword);
    const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md ">
            <h1 className="text-2xl font-bold text-blue-600 mb-4 text-center">
                Student Registration
            </h1>
            {error && <p className="text-red-600 text-center mb-4">{error}</p>}
            <form onSubmit={handleRegister}>
                <div className="mb-4">
                    <TextField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                        variant="outlined"
                        placeholder="lifeofmanu17@gmail.com"
                        required
                    />
                </div>
                <div className="mb-4">
                    <TextField
                        label="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                        variant="outlined"
                        required
                    />
                </div>
                <div className="mb-4">
                    <TextField
                        label="Roll No"
                        type="text"
                        value={rollNo}
                        onChange={(e) => setRollNo(e.target.value)}
                        fullWidth
                        variant="outlined"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-1">Class Code</label>
                    <div className="flex space-x-4">
                        <TextField
                            value={classCode}
                            onChange={(e) => setClassCode(e.target.value)}
                            fullWidth
                            variant="outlined"
                            required
                        />
                        <Button
                            type="button"
                            onClick={handleValidateCode}
                            variant="contained"
                            color="primary"
                        >
                            Validate
                        </Button>
                    </div>
                </div>
                <div className="mb-4">
                    <TextField
                        label="Section (e.g., EC01)"
                        type="text"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        fullWidth
                        variant="outlined"
                        required
                        disabled={isCodeValidated}
                    />
                </div>
                <div className="mb-4">
                    <Select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        fullWidth
                        variant="outlined"
                        displayEmpty
                        required
                        renderValue={(selected) => selected || 'Select Semester'}
                    >
                        <MenuItem value="">Select Semester</MenuItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                            <MenuItem key={sem} value={sem}>{sem}</MenuItem>
                        ))}
                    </Select>
                </div>
                <div className="mb-4 relative">
                    <TextField
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        variant="outlined"
                        required
                    />
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-600"
                    >
                        {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                            <EyeIcon className="h-5 w-5" />
                        )}
                    </button>
                </div>
                <div className="mb-4 relative">
                    <TextField
                        label="Confirm Password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        fullWidth
                        variant="outlined"
                        required
                    />
                    <button
                        type="button"
                        onClick={toggleConfirmPasswordVisibility}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-600"
                    >
                        {showConfirmPassword ? (
                            <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                            <EyeIcon className="h-5 w-5" />
                        )}
                    </button>
                </div>
                <Button type="submit" variant="contained" color="primary" fullWidth>
                    Register
                </Button>
            </form>
            <div className="mt-4">
                <Button
                    onClick={() => window.location.href = `${API_URL}/auth/google`}
                    variant="outlined"
                    fullWidth
                    startIcon={
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.20-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.04.69-2.37 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C4 20.36 7.9 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.9 1 4 3.64 2.18 7.07l2.66 2.84c.87-2.60 3.3-4.53 6.16-4.53z" />
                        </svg>
                    }
                >
                    Sign in with Google
                </Button>
            </div>
        </div>
    );
};

export default Register;