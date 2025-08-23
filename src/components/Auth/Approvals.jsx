import React, { useState, useEffect } from 'react';
import './Approvals.css'; // Import the CSS file

const Approvals = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [error, setError] = useState(null);
    const adminEmail = 'admin@example.com';

    useEffect(() => {
        const fetchPendingUsers = async () => {
            try {
                console.log('Fetching pending users...');
                const response = await fetch('http://localhost:5000/api/pending-users', {
                    headers: { 'user-email': adminEmail }
                });
                console.log('Response status:', response.status);
                const data = await response.json();
                console.log('Response data:', data);
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch pending users');
                }
                setPendingUsers(data);
            } catch (err) {
                console.error('Fetch error:', err.message);
                setError(err.message);
            }
        };
        fetchPendingUsers();
    }, []);

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    return (
        <div className="approvals-container">
            <h2>Pending Approvals</h2>
            {pendingUsers.length === 0 ? (
                <p className="no-users-message">No users pending approval.</p>
            ) : (
                <ul className="pending-users-list">
                    {pendingUsers.map(user => (
                        <li key={user.id} className="pending-user-item">
                            <span>{user.email} ({user.role}) - Class Code: {user.class_code}</span>
                            <button className="approve-button" onClick={() => handleApprove(user.id)}>Approve</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    async function handleApprove(userId) {
        try {
            console.log('Approving user:', userId);
            const response = await fetch('http://localhost:5000/api/approve-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'user-email': adminEmail },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to approve user');
            }
            alert(data.message);
            setPendingUsers(pendingUsers.filter(user => user.id !== userId));
        } catch (err) {
            alert('Approval error: ' + err.message);
        }
    }
};

export default Approvals;