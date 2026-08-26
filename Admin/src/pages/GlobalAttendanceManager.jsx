import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Users, Clock, Calendar, IndianRupee, RotateCw, MapPin, ClipboardCheck, FileImage, Briefcase, UserCheck, Building2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/SH_logo.png';

const GlobalAttendanceManager = () => {
  const { user, userData } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const toggleSidebar = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('sidebar-collapsed', String(nextVal));
  };
  const navigate = useNavigate();

  // State for tabs
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' or 'staff'
  const [staffMembers, setStaffMembers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Staff & Doctors
      const staffQuery = query(collection(db, 'users'), where('role', 'in', ['doctor', 'staff', 'receptionist', 'hr']));
      const staffSnap = await getDocs(staffQuery);
      const staffData = [];
      staffSnap.forEach(doc => {
        staffData.push({ id: doc.id, ...doc.data() });
      });
      setStaffMembers(staffData);

      // Fetch Logs (Running Month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // We might have more than 500 logs for all staff, but we'll try to fetch without limit or with a larger limit
      const logsQuery = query(collection(db, 'activity_logs'));
      const logsSnap = await getDocs(logsQuery);
      const logsData = [];
      logsSnap.forEach(doc => {
        const data = doc.data();
        if (data.timestamp?.toDate() >= startOfMonth) {
          logsData.push({ id: doc.id, ...data });
        }
      });

      const sortedLogs = logsData.sort((a, b) => {
        const timeA = a.timestamp?.toDate() || 0;
        const timeB = b.timestamp?.toDate() || 0;
        return timeB - timeA;
      });
      setActivityLogs(sortedLogs);

      // Fetch Approved Leaves
      const leavesQuery = query(collection(db, 'leave_requests'), where('status', '==', 'approved'));
      const leavesSnap = await getDocs(leavesQuery);
      const leavesData = [];
      leavesSnap.forEach(doc => leavesData.push({ id: doc.id, ...doc.data() }));
      setLeaveRequests(leavesData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData) {
      fetchData();
    }
  }, [userData]);

  // Filter lists based on tab
  const employeeDoctors = staffMembers.filter(m => m.role === 'doctor' && m.doctorType === 'employee');
  const allStaff = staffMembers.filter(m => ['staff', 'receptionist', 'hr'].includes(m.role) || (m.role === 'doctor' && m.doctorType !== 'head' && m.doctorType !== 'employee'));

  const displayedList = activeTab === 'doctors' ? employeeDoctors : allStaff;

  if (loading && !staffMembers.length) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loader">Analyzing Attendance Patterns...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '8px',
          padding: isCollapsed ? '16px 8px 12px 8px' : '16px 16px 12px 16px',
          margin: isCollapsed ? '-16px -8px 0 -8px' : '-16px -16px 0 -16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          width: 'calc(100% + ' + (isCollapsed ? '16px' : '32px') + ')',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <img src={logo} alt="Logo" style={{ height: isCollapsed ? '35px' : '45px', transition: 'all 0.3s ease' }} />
            {!isCollapsed && (
              <span style={{
                color: 'var(--primary-color)',
                fontWeight: '700',
                fontSize: '0.85rem',
                lineHeight: '1.2',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                display: 'block'
              }}>
                Spiritual Homeo Clinic
              </span>
            )}
          </div>
          <button onClick={toggleSidebar} className="sidebar-toggle-btn" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }}>
            {isCollapsed ? <ChevronRight size={20} color="var(--primary-color)" /> : <ChevronLeft size={20} color="var(--primary-color)" />}
          </button>
        </div>
        <p className="sidebar-text" style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', marginTop: '-12px' }}>
          HR Portal
        </p>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginTop: '20px' }}>
          <button style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <ChevronLeft size={18} />
            <span className="sidebar-text">Back to Dashboard</span>
          </button>
          
          {!selectedStaff && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '16px 0' }} />
              <button
                className={`btn-secondary ${activeTab === 'doctors' ? 'active' : ''}`}
                style={{ textAlign: 'left', display: 'flex', gap: '12px', border: activeTab === 'doctors' ? '1px solid var(--primary-color)' : '' }}
                onClick={() => setActiveTab('doctors')}
              >
                <UserCheck size={20} color={activeTab === 'doctors' ? 'var(--primary-color)' : 'var(--text-muted)'} />
                <span className="sidebar-text">Employee Doctors</span>
              </button>
              <button
                className={`btn-secondary ${activeTab === 'staff' ? 'active' : ''}`}
                style={{ textAlign: 'left', display: 'flex', gap: '12px', border: activeTab === 'staff' ? '1px solid var(--primary-color)' : '' }}
                onClick={() => setActiveTab('staff')}
              >
                <Users size={20} color={activeTab === 'staff' ? 'var(--primary-color)' : 'var(--text-muted)'} />
                <span className="sidebar-text">Staff (All Staff)</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <div className="fade-in">
          <div className="flex-between" style={{ marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', background: 'linear-gradient(90deg, #0d63ccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
                {selectedStaff ? `Staff Report: ${selectedStaff.name}` : 'Monthly Attendance Directory'}
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>
                {selectedStaff ? `Tracking attendance for ${selectedStaff.name}` : `View attendance for ${activeTab === 'doctors' ? 'Employee Doctors' : 'All Staff'}`}
              </p>
            </div>
            <button className="btn-secondary" onClick={fetchData}>
              <RotateCw size={18} style={{ marginRight: '8px' }} /> Refresh
            </button>
          </div>

          {!selectedStaff ? (
            <div className="table-container glass-panel">
              <div style={{ padding: '16px', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setActiveTab('doctors')} 
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: activeTab === 'doctors' ? 'var(--primary-color)' : '#f1f5f9',
                    color: activeTab === 'doctors' ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Employee Doctors
                </button>
                <button 
                  onClick={() => setActiveTab('staff')} 
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: activeTab === 'staff' ? 'var(--primary-color)' : '#f1f5f9',
                    color: activeTab === 'staff' ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Staff (All Staff)
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role</th>
                    <th>Last Known GPS</th>
                    <th>Total Month Logs</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedList.map(m => {
                    const mLogs = activityLogs.filter(l => l.userId === m.id || l.userId === m.uid);
                    const lastLocation = mLogs.find(l => l.location)?.location;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td><span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{m.role}</span></td>
                        <td>
                          {lastLocation ? (
                            <a
                              href={`https://www.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.75rem', color: 'var(--primary-color)', textDecoration: 'none' }}
                            >
                              📍 {lastLocation.address?.substring(0, 15)}...
                            </a>
                          ) : 'No Data'}
                        </td>
                        <td>{mLogs.length}</td>
                        <td><button className="btn-primary" onClick={() => setSelectedStaff(m)}>View Month Report</button></td>
                      </tr>
                    );
                  })}
                  {displayedList.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>No users found in this category.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container glass-panel">
              <div style={{ padding: '16px' }}>
                <button className="btn-secondary" onClick={() => setSelectedStaff(null)} style={{ marginBottom: '20px' }}>
                  <ChevronLeft size={16} /> Back to Directory
                </button>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.8rem' }}>Present Days (This Month)</p>
                    <h3 style={{ fontSize: '1.8rem', color: 'var(--primary-color)' }}>
                      {new Set(activityLogs.filter(l => l.userId === selectedStaff.id || l.userId === selectedStaff.uid).map(l => l.timestamp?.toDate().toDateString())).size}
                    </h3>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.8rem' }}>Approved Leaves</p>
                    <h3 style={{ fontSize: '1.8rem', color: '#ef4444' }}>
                      {leaveRequests.filter(r => (r.userId === selectedStaff.id || r.userId === selectedStaff.uid) && r.status === 'approved').length}
                    </h3>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.8rem' }}>Working Days (So far)</p>
                    <h3 style={{ fontSize: '1.8rem', color: 'var(--secondary-color)' }}>
                      {(() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), today.getMonth(), 1);
                        let count = 0;
                        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
                          if (d.getDay() !== 0) count++; // Exclude Sundays
                        }
                        return count;
                      })()}
                    </h3>
                  </div>
                </div>
                
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Selfie</th>
                      <th>Log Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.filter(l => l.userId === selectedStaff.id || l.userId === selectedStaff.uid).map(log => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'}</td>
                        <td style={{ color: 'var(--secondary-color)', fontWeight: 500 }}>
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </td>
                        <td>
                          <span className={`badge ${log.action === 'login' ? 'badge-primary' : 'badge-danger'}`} style={{ minWidth: '80px', textAlign: 'center' }}>
                            {log.action === 'login' ? 'PUNCH IN' : 'PUNCH OUT'}
                          </span>
                        </td>
                        <td>
                          {log.photoUrl ? (
                            <img 
                              src={log.photoUrl} 
                              alt="Selfie" 
                              style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.1)' }} 
                              onClick={() => setPreviewImage(log.photoUrl)}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Photo</span>
                          )}
                        </td>
                        <td>
                          {log.location ? (
                            <a
                              href={`https://www.google.com/maps?q=${log.location.latitude},${log.location.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="location-badge"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--primary-color)',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                background: 'rgba(168, 206, 58, 0.05)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(168, 206, 58, 0.1)'
                              }}
                            >
                              <MapPin size={14} />
                              <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.location.address || 'Click to view map'}
                              </span>
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No location captured</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Image Preview Modal */}
        {previewImage && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => setPreviewImage(null)}
          >
            <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
              <button 
                onClick={() => setPreviewImage(null)}
                style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
              <img src={previewImage} alt="Full Preview" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', objectFit: 'contain' }} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GlobalAttendanceManager;
