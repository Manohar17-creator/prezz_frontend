import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CRDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-blue-600 mb-4">CR Dashboard</h1>
      <p>Schedule management (to be implemented)</p>
      {/* Add schedule form and table */}
      <div className="fixed bottom-4 flex justify-around w-full bg-white p-2 rounded-lg shadow-lg">
        <a href="/cr-dashboard" className="text-blue-600">Home</a>
        <a href="/materials" className="text-gray-600">Materials</a>
        <a href="/profile" className="text-gray-600">Profile</a>
      </div>
    </div>
  );
};

export default CRDashboard;