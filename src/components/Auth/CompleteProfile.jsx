import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CompleteProfile = () => {
    const [classCode, setClassCode] = useState('');
    const [isCodeValidated, setIsCodeValidated] = useState(false);
    const [college, setCollege] = useState('');
    const [branch, setBranch] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const API_URL = 'http://localhost:3000'; // Adjust based on your setup

    const handleValidateCode = async () => {
        try {
            const response = await fetch(`${API_URL}/api/class-codes/${classCode}`);
            if (!response.ok) {
                throw new Error('Invalid class code');
            }
            const data = await response.json();
            setCollege(data.college);
            setBranch(data.branch);
            setIsCodeValidated(true);
            setError(null);
        } catch (error) {
            console.error('Error validating class code:', error);
            setError('Invalid class code');
            setIsCodeValidated(false);
        }
    };

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        if (classCode && !isCodeValidated) {
            setError('Please validate the class code');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/complete-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ college, branch })
            });
            if (!response.ok) {
                throw new Error('Failed to complete profile');
            }
            navigate('/dashboard');
        } catch (error) {
            console這樣的

            console.error('Error completing profile:', error);
            setError('Failed to complete profile');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-center">Complete Your Profile</h2>
            <form onSubmit={handleCompleteProfile}>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-1">Class Code (optional)</label>
                    <div className="flex">
                        <input
                            type="text"
                            value={classCode}
                            onChange={(e) => setClassCode(e.target.value)}
                            className="w-full p-2 border rounded-lg"
                        />
                        <button
                            type="button"
                            onClick={handleValidateCode}
                            className="ml-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                        >
                            Validate
                        </button>
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-1">College Name</label>
                    <input
                        type="text"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                        required={!classCode}
                        disabled={isCodeValidated}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-1">Branch</label>
                    <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                        required={!classCode}
                        disabled={isCodeValidated}
                    />
                </div>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
                >
                    Complete Profile
                </button>
            </form>
        </div>
    );
};

export default CompleteProfile;