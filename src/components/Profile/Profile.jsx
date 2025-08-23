import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const navigate = useNavigate();
    const [userProfile, setUserProfile] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profileRes = await fetch('http://localhost:5000/api/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const profileData = await profileRes.json();
                if (profileData.error) {
                    throw new Error('Failed to load profile');
                }
                setUserProfile(profileData);
            } catch (error) {
                console.error('Error fetching profile:', error);
                alert('Failed to load profile. Please log in again.');
                navigate('/login');
            }
        };
        fetchProfile();
    }, [navigate, token]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-200 p-8">
            <div className="flex justify-end mb-4">
                <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200"
                >
                    Logout
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-blue-700 mb-4">Profile</h2>
                {userProfile ? (
                    <div className="space-y-2">
                        <p><strong>Username:</strong> {userProfile.username}</p>
                        <p><strong>Email:</strong> {userProfile.email}</p>
                        <p><strong>Role:</strong> {userProfile.role}</p>
                        <p><strong>Class Code:</strong> {userProfile.class_code}</p>
                        <p><strong>Roll Number:</strong> {userProfile.roll_no}</p>
                    </div>
                ) : (
                    <p className="text-gray-600">Loading profile...</p>
                )}
            </div>
            <div className="fixed bottom-4 flex justify-around w-full bg-white p-2 rounded-lg shadow-lg">
                <a href={localStorage.getItem('role') === 'student' ? '/student-dashboard' : '/cr-dashboard'} className="text-gray-600">Home</a>
                <a href="/materials" className="text-gray-600">Materials</a>
                <a href="/profile" className="text-blue-600">Profile</a>
            </div>
        </div>
    );
};

export default Profile;