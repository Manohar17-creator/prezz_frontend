import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Auth/Login.jsx'; // Add .jsx extension
import Register from './components/Auth/Register.jsx';
import Approvals from './components/Auth/Approvals.jsx';
import ForgotPassword from './components/Auth/ForgotPassword.jsx';
import ResetPassword from './components/Auth/ResetPassword.jsx';
import StudentDashboard from './components/Dashboard/StudentDashboard.jsx';
import MaterialDashboard from './components/Material/MaterialDashboard.jsx';
import Profile from './components/Profile/Profile.jsx';
import UploadTimetable from './UploadTimetable.jsx';
import CompleteProfile from './components/Auth/CompleteProfile.jsx';
import CRRegister from './components/Auth/CRRegister.jsx';
import ElectiveCRDashboard from './components/Dashboard/ElectiveCRDashboard.jsx';
import RegularCRDashboard from './components/Dashboard/RegularCRDashboard.jsx';
import Chat from './components/Chat.jsx';
import './index.css';

const App = () => {
  return (
    <Routes>
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/upload-timetable" element={<UploadTimetable />} />
      <Route path="/regular-cr-dashboard/*" element={<RegularCRDashboard />} />
      <Route path="/student-dashboard/*" element={<StudentDashboard />} />
      <Route path="/materials/*" element={<MaterialDashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/cr-register" element={<CRRegister />} />
      <Route path="/elective-cr-dashboard" element={<ElectiveCRDashboard />} />
      <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
  );
};

export default App;