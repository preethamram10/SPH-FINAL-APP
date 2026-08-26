import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import BranchDashboard from './pages/BranchDashboard';
import AttendanceManager from './pages/AttendanceManager';
import GlobalAttendanceManager from './pages/GlobalAttendanceManager';
import TargetManagement from './pages/TargetManagement';
import StaffWorkingHours from './pages/StaffWorkingHours';
import ReceptionDashboard from './pages/reception/ReceptionDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import HRDashboard from './pages/hr/HRDashboard';
import PatientClassificationPage from './pages/reception/PatientClassificationPage';

function App() {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="loader">Loading...</div>
    </div>;
  }

  const roleClean = String(userData?.role || '').toLowerCase().trim();
  const isSuperAdmin = roleClean === 'superadmin' || roleClean === 'admin';
  const isHR = roleClean === 'hr';
  const isDoctor = roleClean === 'doctor';
  const isReceptionist = !isSuperAdmin && !isHR && !isDoctor; // All non-admin/HR/doctor staff get full Receptionist Dashboard with sidebar menu

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={
          !user ? <Navigate to="/login" /> : 
          isSuperAdmin ? <SuperAdminDashboard /> : 
          isHR ? <HRDashboard /> :
          isDoctor ? <DoctorDashboard /> :
          <ReceptionDashboard />
        } />
        <Route path="/attendance" element={!user ? <Navigate to="/login" /> : <AttendanceManager />} />
        <Route path="/global-attendance" element={!user ? <Navigate to="/login" /> : <GlobalAttendanceManager />} />
        <Route path="/working-hours" element={!user ? <Navigate to="/login" /> : <StaffWorkingHours />} />
        <Route path="/targets" element={!user ? <Navigate to="/login" /> : <TargetManagement />} />
        <Route path="/patient-classification" element={
          !user ? <Navigate to="/login" /> : 
          userData?.role === 'hr' ? <HRDashboard /> :
          <SuperAdminDashboard />
        } />
        <Route path="/medicine-form-editor" element={
          !user ? <Navigate to="/login" /> : 
          <SuperAdminDashboard />
        } />
      </Routes>
    </Router>
  );
}

export default App;
