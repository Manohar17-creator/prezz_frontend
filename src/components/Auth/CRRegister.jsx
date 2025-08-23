import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'; // Importing icons for visibility toggle

const CRRegister = () => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [crType, setCrType] = useState('regular');
    const [college, setCollege] = useState('');
    const [branch, setBranch] = useState('');
    const [section, setSection] = useState('');
    const [semester, setSemester] = useState('');
    const [electiveName, setElectiveName] = useState('');
    const [electiveProfessor, setElectiveProfessor] = useState('');
    const [electiveType, setElectiveType] = useState('core');
    const [electiveCollege, setElectiveCollege] = useState(''); // New field for Elective CR college
    const [electiveBranch, setElectiveBranch] = useState(''); // New field for Elective CR branch
    const [generatedCode, setGeneratedCode] = useState(null);
    const [error, setError] = useState(null);

    const handleNextStep = (e) => {
        e.preventDefault();
        // Basic validation for Step 1
        if (!username || !email || !rollNo || !password || !crType) {
            setError('Please fill in all fields');
            return;
        }
        setError(null);
        setStep(2);
    };

    const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation for Step 2
    if (crType === 'regular') {
        if (!college || !branch || !section || !semester) {
            setError('Please fill in all fields');
            return;
        }
    } else {
        console.log('Elective CR fields:', { electiveName, electiveProfessor, electiveType, electiveCollege, electiveBranch });
        if (!electiveName || !electiveProfessor || !electiveType) {
            setError('Please fill in all fields');
            return;
        }
        if (electiveType === 'open') {
            if (!electiveCollege) {
                setError('Please provide the college name for an open elective');
                return;
            }
        } else {
            if (!electiveCollege || !electiveBranch) {
                setError('Please provide both college and branch for a core elective');
                return;
            }
        }
    }

    try {
        const payload = {
            username,
            email,
            roll_no: rollNo,
            password,
            cr_type: crType,
            ...(crType === 'regular' ? {
                college,
                branch,
                section,
                semester
            } : {
                elective_name: electiveName,
                elective_professor: electiveProfessor,
                elective_type: electiveType,
                elective_college: electiveCollege,
                elective_branch: electiveBranch
            })
        };

        const response = await fetch(`${API_URL}/api/cr-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
        }

        const data = await response.json();
        if (crType === 'regular') {
            setGeneratedCode(data.class_code);
        }
        localStorage.setItem('token', data.token);
        navigate(crType === 'regular' ? '/regular-cr-dashboard' : '/elective-cr-dashboard');
    } catch (error) {
        console.error('Registration error:', error);
        setError(error.message || 'Failed to connect to the server');
    }
};

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="p-8 max-w-md mx-auto">
            <h1 className="text-3xl font-bold text-blue-800 mb-8">Class Representative Registration</h1>
            {error && <div className="text-red-600 mb-4 text-center">{error}</div>}

            {step === 1 ? (
                <form onSubmit={handleNextStep}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="lifeofmanu17@gmail.com"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Roll No</label>
                        <input
                            type="text"
                            value={rollNo}
                            onChange={(e) => setRollNo(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            required
                        />
                    </div>
                    <div className="mb-4 relative">
                        <label className="block text-gray-700 mb-1">Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            required
                        />
                        <button
                            type="button"
                            onClick={togglePasswordVisibility}
                            className="absolute right-2 top-9 text-gray-600"
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">CR Type</label>
                        <select
                            value={crType}
                            onChange={(e) => setCrType(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            required
                        >
                            <option value="regular">Regular CR</option>
                            <option value="elective">Elective CR</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                    >
                        Next
                    </button>
                </form>
            ) : (
                <form onSubmit={handleRegister}>
                    {crType === 'regular' ? (
    <>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">College</label>
            <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Branch</label>
            <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Section (e.g., EC01)</label>
            <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Semester</label>
            <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            >
                <option value="">Select Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                ))}
            </select>
        </div>
    </>
) : (
    <>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Elective Type</label>
            <select
                value={electiveType}
                onChange={(e) => setElectiveType(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            >
                <option value="core">Core Elective (Branch-Specific)</option>
                <option value="open">Open Elective (College-Wide)</option>
            </select>
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Elective Name</label>
            <input
                type="text"
                value={electiveName}
                onChange={(e) => setElectiveName(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">Professor Name</label>
            <input
                type="text"
                value={electiveProfessor}
                onChange={(e) => setElectiveProfessor(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        <div className="mb-4">
            <label className="block text-gray-700 mb-1">College</label>
            <input
                type="text"
                value={electiveCollege}
                onChange={(e) => setElectiveCollege(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
            />
        </div>
        {electiveType === 'core' && (
            <div className="mb-4">
                <label className="block text-gray-700 mb-1">Branch</label>
                <input
                    type="text"
                    value={electiveBranch}
                    onChange={(e) => setElectiveBranch(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                />
            </div>
        )}
    </>
)}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                    >
                        Register
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full mt-2 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400"
                    >
                        Back
                    </button>
                </form>
            )}
            {generatedCode && crType === 'regular' && (
                <p className="mt-4 text-center">Generated Class Code: <strong>{generatedCode}</strong></p>
            )}
        </div>
    );
};

export default CRRegister;