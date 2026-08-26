import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { auth } from '../../firebase';
import { initializeApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc, query, where, deleteField } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2, Eye, EyeOff, X } from 'lucide-react';

const parseTimeTo24h = (timeStr) => {
  if (!timeStr) return '';
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m}`;
};

const convertTo12h = (val) => {
  if (!val) return '';
  const [h, m] = val.split(':');
  if (!h || !m) return val;
  let hh = parseInt(h, 10);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh.toString().padStart(2, '0')}:${m} ${ampm}`;
};

const AddStaff = () => {
  const { userData } = useAuth();
  const [branches, setBranches] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Staff State
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'staff',
    doctorType: 'employee', // 'head' | 'employee'
    branchId: '',
    salary: '',
    shiftType: 'single',
    loginTime: '09:00 AM',
    logoutTime: '06:00 PM',
    loginTime2: '',
    logoutTime2: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Edit Staff State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffEditData, setStaffEditData] = useState(null);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);

  const fetchBranches = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.role === 'branch') {
          list.push({ id: doc.id, ...d });
        }
      });
      setBranches(list);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (['doctor', 'staff', 'receptionist', 'hr'].includes(d.role)) {
          list.push({ id: doc.id, ...d });
        }
      });
      setStaffMembers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();

    if (!newStaff.name.trim()) {
      alert('Please enter staff name');
      return;
    }
    if (!newStaff.phone || newStaff.phone.replace(/\D/g, '').length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const isEmailRole = ['staff', 'hr'].includes(newStaff.role);
    const cleanPhone = newStaff.phone.replace(/\D/g, '').slice(-10);

    // Email is required for Staff and HR in Web Admin
    const needsEmail = ['staff', 'hr'].includes(newStaff.role);
    if (needsEmail) {
      if (!newStaff.email || !newStaff.email.includes('@')) {
        alert('Please enter a valid Email ID');
        return;
      }
    }

    if (isEmailRole) {
      if (!newStaff.password) {
        alert('Please enter a Password');
        return;
      }
    }

    const needsBranch = ['staff', 'receptionist'].includes(newStaff.role);
    if (needsBranch && !newStaff.branchId) {
      alert('Please select a branch');
      return;
    }

    const needsSalarySchedule = newStaff.role === 'staff' || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee');
    if (needsSalarySchedule) {
      if (!newStaff.salary || isNaN(parseFloat(newStaff.salary))) {
        alert('Please enter a valid monthly salary amount');
        return;
      }
    }

    setIsCreatingStaff(true);
    try {
      const branch = newStaff.branchId ? branches.find(b => b.id === newStaff.branchId) : null;
      const emailToUse = newStaff.email ? newStaff.email.toLowerCase().trim() : '';

      // Check if email already exists in Firestore
      if (isEmailRole && emailToUse) {
        const qEmail = query(collection(db, 'users'), where('email', '==', emailToUse));
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          alert('Failed to authorize staff: A user with this email address already exists in the system.');
          setIsCreatingStaff(false);
          return;
        }
      }

      // Check if phone number already exists in Firestore
      if (cleanPhone) {
        const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          alert('Failed to authorize staff: A user with this phone number already exists in the system.');
          setIsCreatingStaff(false);
          return;
        }
      }

      if (isEmailRole) {
        const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp_HR_Staff_' + Date.now());
        const secondaryAuth = getSecondaryAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, newStaff.password);
        const newUserId = userCredential.user.uid;

        const docData = {
          uid: newUserId,
          name: newStaff.name.trim(),
          phone: cleanPhone,
          email: emailToUse,
          role: newStaff.role,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        if (newStaff.role === 'staff' || newStaff.role === 'hr' || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee')) {
          if (newStaff.branchId) {
            docData.branchId = newStaff.branchId;
            docData.branchName = branch?.name || 'Unknown';
          }
          if (newStaff.role === 'staff' || newStaff.role === 'doctor') {
            docData.salary = parseFloat(newStaff.salary) || 0;
            docData.shiftType = newStaff.shiftType || 'single';
            docData.loginTime = newStaff.loginTime;
            docData.logoutTime = newStaff.logoutTime;
            if (newStaff.shiftType === 'multi') {
              docData.loginTime2 = newStaff.loginTime2;
              docData.logoutTime2 = newStaff.logoutTime2;
            }
          }
          if (newStaff.role === 'doctor') {
            docData.doctorType = newStaff.doctorType;
          }
        }

        await setDoc(doc(db, 'users', newUserId), docData);
        await secondaryAuth.signOut();
      } else {
        // Doctor or Receptionist: Phone-based (no password)
        const docData = {
          name: newStaff.name.trim(),
          phone: cleanPhone,
          role: newStaff.role,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        if (newStaff.role === 'receptionist') {
          docData.branchId = newStaff.branchId;
          docData.branchName = branch?.name || 'Unknown';
        } else if (newStaff.role === 'doctor') {
          docData.doctorType = newStaff.doctorType;
          if (newStaff.doctorType === 'employee') {
            docData.salary = parseFloat(newStaff.salary);
            docData.shiftType = newStaff.shiftType || 'single';
            docData.loginTime = newStaff.loginTime;
            docData.logoutTime = newStaff.logoutTime;
            if (newStaff.shiftType === 'multi') {
              docData.loginTime2 = newStaff.loginTime2;
              docData.logoutTime2 = newStaff.logoutTime2;
            }
          }
        }

        await addDoc(collection(db, 'users'), docData);
      }

      setShowAddStaff(false);
      setNewStaff({ name: '', phone: '', email: '', password: '', role: 'staff', doctorType: 'employee', branchId: '', salary: '', shiftType: 'single', loginTime: '09:00 AM', logoutTime: '06:00 PM', loginTime2: '', logoutTime2: '' });
      fetchStaff();
      alert('Staff member authorized successfully!');
    } catch (error) {
      console.error('Error authorizing staff:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Failed to authorize staff: This email address is already registered in Firebase Authentication. Since this staff member was previously deleted from the portal, their login account must be deleted from the Firebase Console (Authentication tab) before you can re-register them with this email.');
      } else {
        alert('Failed to authorize staff: ' + error.message);
      }
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
      try {
        await deleteDoc(doc(db, 'users', staffId));
        fetchStaff();
        alert('Staff member removed from database successfully.\n\nNote: To re-add this staff member with the same email, you must also delete their account from the Firebase Authentication console.');
      } catch (error) {
        console.error('Error removing staff:', error);
        alert('Failed to remove staff.');
      }
    }
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff || !staffEditData) return;
    setIsUpdatingStaff(true);
    try {
      const updatePayload = {
        name: staffEditData.name,
        phone: staffEditData.phone,
        role: staffEditData.role,
      };

      if (['staff', 'hr'].includes(staffEditData.role)) {
        updatePayload.email = staffEditData.email;
      }

      if (['staff', 'receptionist'].includes(staffEditData.role) || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) {
        updatePayload.branchId = staffEditData.branchId;
        updatePayload.branchName = branches.find(b => b.id === staffEditData.branchId)?.name || 'Unknown';
      }

      if (staffEditData.role === 'doctor') {
        updatePayload.doctorType = staffEditData.doctorType;
      }

      if (staffEditData.role === 'staff' || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) {
        updatePayload.salary = parseFloat(staffEditData.salary) || 0;
        updatePayload.shiftType = staffEditData.shiftType || 'single';
        updatePayload.loginTime = staffEditData.loginTime || '';
        updatePayload.logoutTime = staffEditData.logoutTime || '';
        if (staffEditData.shiftType === 'multi') {
          updatePayload.loginTime2 = staffEditData.loginTime2 || '';
          updatePayload.logoutTime2 = staffEditData.logoutTime2 || '';
        } else {
          updatePayload.loginTime2 = deleteField();
          updatePayload.logoutTime2 = deleteField();
        }
      }

      await updateDoc(doc(db, 'users', selectedStaff.id), updatePayload);
      await fetchStaff();
      alert('Staff details updated successfully.');
      setSelectedStaff(null);
      setStaffEditData(null);
    } catch (error) {
      console.error('Error updating staff:', error);
      alert('Failed to update staff details.');
    } finally {
      setIsUpdatingStaff(false);
    }
  };

  const openStaffModal = (staff) => {
    setSelectedStaff(staff);
    setStaffEditData({
      ...staff,
      doctorType: staff.doctorType || 'employee',
      salary: staff.salary || '',
      shiftType: staff.shiftType || 'single',
      loginTime: staff.loginTime || '09:00 AM',
      logoutTime: staff.logoutTime || '06:00 PM',
      loginTime2: staff.loginTime2 || '',
      logoutTime2: staff.logoutTime2 || '',
      branchId: staff.branchId || '',
    });
  };

  const closeStaffModal = () => {
    setSelectedStaff(null);
    setStaffEditData(null);
  };

  const isDoctorOrHR = ['doctor', 'hr'].includes(newStaff.role);
  const isRestrictedOff = newStaff.restricted === 'off';
  const hideSalaryAndSchedule = isDoctorOrHR && isRestrictedOff;

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Staff Management</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage doctor credentials and authorized reception profiles</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddStaff(true)}>
          <Plus size={16} /> Add Staff Member
        </button>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>Loading employee directory...</div>
      ) : (
        <div className="table-container glass-panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {staffMembers.map((member) => (
                <tr key={member.id}>
                  <td style={{ fontWeight: 600 }}>{member.name}</td>
                  <td><span className="badge badge-secondary">{member.role?.toUpperCase()}</span></td>
                  <td>{member.phone || 'N/A'}</td>
                  <td>{member.branchName || 'N/A'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => openStaffModal(member)} title="Edit Staff Details">
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Edit</span>
                      </button>
                      <button className="btn-secondary" style={{ color: '#ef4444', padding: '6px' }} onClick={() => handleDeleteStaff(member.id)} title="Remove Staff">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddStaff && (
        <div style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <h3>Add Staff Member</h3>
              <button onClick={() => setShowAddStaff(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff}>
              {/* 1. Role Selection */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Assign Staff Role</label>
                <select
                  className="glass-input"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                >
                  <option value="staff">Regular Staff</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Doctor</option>
                  <option value="hr">HR Manager</option>
                </select>
              </div>

              {/* 2. Doctor Category (only if role is Doctor) */}
              {newStaff.role === 'doctor' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Doctor Category</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className={newStaff.doctorType === 'head' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1 }}
                      onClick={() => setNewStaff({ ...newStaff, doctorType: 'head' })}
                    >
                      Head Doctor
                    </button>
                    <button
                      type="button"
                      className={newStaff.doctorType === 'employee' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1 }}
                      onClick={() => setNewStaff({ ...newStaff, doctorType: 'employee' })}
                    >
                      Employee Doctor
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Personal Details */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="glass-input"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Mobile Number (without +91)</label>
                  <input
                    type="tel"
                    className="glass-input"
                    required
                    placeholder="10-digit number"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  />
                </div>
                {['staff', 'hr'].includes(newStaff.role) && (
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="glass-input"
                      required={['staff', 'hr'].includes(newStaff.role)}
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {['staff', 'hr'].includes(newStaff.role) && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="glass-input"
                      required
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Branch Assignment */}
              {(['staff', 'receptionist'].includes(newStaff.role) || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee')) && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Branch Assignment</label>
                  <select
                    className="glass-input"
                    value={newStaff.branchId}
                    onChange={(e) => setNewStaff({ ...newStaff, branchId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Branch --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 5. Salary & Work Schedule (Only for Regular Staff or Employee Doctor) */}
              {(newStaff.role === 'staff' || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee')) && (
                <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salary &amp; Work Schedule</p>
                  <div className="form-group">
                    <label className="form-label">Monthly Base Salary (Rs)</label>
                    <input
                      type="number"
                      className="glass-input"
                      value={newStaff.salary}
                      onChange={(e) => setNewStaff({ ...newStaff, salary: e.target.value })}
                      required
                      placeholder="e.g. 25000"
                      min="0"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Shift Type</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        className={newStaff.shiftType === 'single' || !newStaff.shiftType ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '6px' }}
                        onClick={() => setNewStaff({ ...newStaff, shiftType: 'single' })}
                      >
                        Single Strict
                      </button>
                      <button
                        type="button"
                        className={newStaff.shiftType === 'multi' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '6px' }}
                        onClick={() => setNewStaff({ ...newStaff, shiftType: 'multi' })}
                      >
                        Multi Strict
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Login Time {newStaff.shiftType === 'multi' && '1'}</label>
                      <input
                        type="time"
                        className="glass-input"
                        value={parseTimeTo24h(newStaff.loginTime)}
                        onChange={(e) => setNewStaff({ ...newStaff, loginTime: convertTo12h(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Logout Time {newStaff.shiftType === 'multi' && '1'}</label>
                      <input
                        type="time"
                        className="glass-input"
                        value={parseTimeTo24h(newStaff.logoutTime)}
                        onChange={(e) => setNewStaff({ ...newStaff, logoutTime: convertTo12h(e.target.value) })}
                      />
                    </div>
                    {newStaff.shiftType === 'multi' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                          <label className="form-label">Login Time 2</label>
                          <input
                            type="time"
                            className="glass-input"
                            value={parseTimeTo24h(newStaff.loginTime2)}
                            onChange={(e) => setNewStaff({ ...newStaff, loginTime2: convertTo12h(e.target.value) })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                          <label className="form-label">Logout Time 2</label>
                          <input
                            type="time"
                            className="glass-input"
                            value={parseTimeTo24h(newStaff.logoutTime2)}
                            onChange={(e) => setNewStaff({ ...newStaff, logoutTime2: convertTo12h(e.target.value) })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p style={{ fontSize: '0.72rem', color: '#f59e0b', margin: 0, fontWeight: '600' }}>
                      Deduction Rule: 3 days late (15+ min) = Rs 500 deduction
                    </p>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={isCreatingStaff}>
                {isCreatingStaff ? 'Saving...' : 'Create Employee Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {selectedStaff && staffEditData && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h3>Edit Staff Member</h3>
              <button className="btn-secondary" style={{ padding: '8px' }} onClick={closeStaffModal}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Role Selection */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Assign Staff Role</label>
                <select
                  className="glass-input"
                  value={staffEditData.role}
                  onChange={(e) => setStaffEditData({ ...staffEditData, role: e.target.value })}
                  style={{ background: 'var(--bg-dark)' }}
                >
                  <option value="staff">Regular Staff</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Doctor</option>
                  <option value="hr">HR Manager</option>
                </select>
              </div>

              {/* 2. Doctor Category (only if role is Doctor) */}
              {staffEditData.role === 'doctor' && (
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Doctor Category</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className={staffEditData.doctorType === 'head' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1 }}
                      onClick={() => setStaffEditData({ ...staffEditData, doctorType: 'head' })}
                    >
                      Head Doctor
                    </button>
                    <button
                      type="button"
                      className={staffEditData.doctorType === 'employee' ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1 }}
                      onClick={() => setStaffEditData({ ...staffEditData, doctorType: 'employee' })}
                    >
                      Employee Doctor
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Personal Details */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={staffEditData.name}
                  onChange={(e) => setStaffEditData({ ...staffEditData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Mobile Number (without +91)</label>
                <input
                  type="text"
                  className="glass-input"
                  value={staffEditData.phone}
                  onChange={(e) => setStaffEditData({ ...staffEditData, phone: e.target.value })}
                  required
                  pattern="[0-9]{10}"
                />
              </div>

              {['staff', 'hr'].includes(staffEditData.role) && (
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Email ID</label>
                  <input
                    type="email"
                    className="glass-input"
                    value={staffEditData.email || ''}
                    onChange={(e) => setStaffEditData({ ...staffEditData, email: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* 4. Branch Assignment */}
              {(['staff', 'receptionist'].includes(staffEditData.role) || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) && (
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Assign to Branch</label>
                  <select
                    className="glass-input"
                    value={staffEditData.branchId || ''}
                    onChange={(e) => setStaffEditData({ ...staffEditData, branchId: e.target.value })}
                    required
                    style={{ background: 'var(--bg-dark)' }}
                  >
                    <option value="">Select a Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 5. Salary & Work Schedule */}
              {(staffEditData.role === 'staff' || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) && (
                <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salary &amp; Work Schedule</p>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Monthly Base Salary (Rs)</label>
                    <input
                      type="number"
                      className="glass-input"
                      value={staffEditData.salary}
                      onChange={(e) => setStaffEditData({ ...staffEditData, salary: e.target.value })}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Shift Type</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        className={staffEditData.shiftType === 'single' || !staffEditData.shiftType ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '6px' }}
                        onClick={() => setStaffEditData({ ...staffEditData, shiftType: 'single' })}
                      >
                        Single Strict
                      </button>
                      <button
                        type="button"
                        className={staffEditData.shiftType === 'multi' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '6px' }}
                        onClick={() => setStaffEditData({ ...staffEditData, shiftType: 'multi' })}
                      >
                        Multi Strict
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Login Time {staffEditData.shiftType === 'multi' && '1'}</label>
                      <input
                        type="time"
                        className="glass-input"
                        value={parseTimeTo24h(staffEditData.loginTime)}
                        onChange={(e) => setStaffEditData({ ...staffEditData, loginTime: convertTo12h(e.target.value) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Logout Time {staffEditData.shiftType === 'multi' && '1'}</label>
                      <input
                        type="time"
                        className="glass-input"
                        value={parseTimeTo24h(staffEditData.logoutTime)}
                        onChange={(e) => setStaffEditData({ ...staffEditData, logoutTime: convertTo12h(e.target.value) })}
                      />
                    </div>
                    {staffEditData.shiftType === 'multi' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                          <label className="form-label">Login Time 2</label>
                          <input
                            type="time"
                            className="glass-input"
                            value={parseTimeTo24h(staffEditData.loginTime2)}
                            onChange={(e) => setStaffEditData({ ...staffEditData, loginTime2: convertTo12h(e.target.value) })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                          <label className="form-label">Logout Time 2</label>
                          <input
                            type="time"
                            className="glass-input"
                            value={parseTimeTo24h(staffEditData.logoutTime2)}
                            onChange={(e) => setStaffEditData({ ...staffEditData, logoutTime2: convertTo12h(e.target.value) })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={closeStaffModal}>Cancel</button>
                <button type="button" className="btn-primary" onClick={handleUpdateStaff} disabled={isUpdatingStaff}>
                  {isUpdatingStaff ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddStaff;
