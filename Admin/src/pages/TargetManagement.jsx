import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { Target, Calendar, TrendingUp, DollarSign, Edit, Save, RefreshCw, ArrowLeft, LogOut, Building2, Users, UserCheck, IndianRupee, Briefcase, FileImage, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import logo from '../assets/SPH ADMIN.png';

const TargetManagement = () => {
  const { userData } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const toggleSidebar = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('sidebar-collapsed', String(nextVal));
  };
  const [branches, setBranches] = useState([]);
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [editingTarget, setEditingTarget] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [salesData, setSalesData] = useState({});
  const [consultationData, setConsultationData] = useState({});
  const [consultationRevenueData, setConsultationRevenueData] = useState({});
  const [pharmacyData, setPharmacyData] = useState({});
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(monthKey);

    fetchBranches();
    const unsubscribeTargets = fetchTargets(monthKey);
    fetchAllData(monthKey);
    fetchHistoryData();

    return () => {
      if (unsubscribeTargets) unsubscribeTargets();
    };
  }, []);

  // Auto-sync true revenue to Firebase monthly_targets collection
  useEffect(() => {
    if (Object.keys(targets).length === 0 || branches.length === 0) return;

    branches.forEach(branch => {
      const bKey = normKey(branch.branchId || branch.branchName || branch.name || branch.location || branch.id);
      const targetData = targets[bKey] || targets[branch.id] || targets[branch.name];
      if (targetData && targetData.id) {
        const liveRevenue = salesData[bKey] || 0;

        if (liveRevenue > 0 && targetData.reached !== liveRevenue) {
          updateDoc(doc(db, 'monthly_targets', targetData.id), { reached: liveRevenue }).catch(console.error);
        }
      }
    });
  }, [targets, salesData, branches]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'branch'));
      const snapshot = await getDocs(q);

      const branchesList = [];
      snapshot.forEach(doc => {
        branchesList.push({ id: doc.id, ...doc.data() });
      });

      const snap2 = await getDocs(collection(db, 'branches'));
      snap2.forEach(d => {
        const data = d.data();
        const exists = branchesList.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes((data.name || d.id || '').toLowerCase()));
        if (!exists) branchesList.push({ id: d.id, ...data });
      });

      const canonicals = [
        { id: 'Kphb', name: 'Kphb', branchName: 'Kphb Branch' },
        { id: 'Chandanagar', name: 'Chandanagar', branchName: 'Chandanagar Branch' },
        { id: 'Dilshuknagar', name: 'Dilshuknagar', branchName: 'Dilshuknagar Branch' },
        { id: 'Nallagandla', name: 'Nallagandla', branchName: 'Nallagandla Branch' }
      ];

      canonicals.forEach(c => {
        const exists = branchesList.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(c.name.toLowerCase()));
        if (!exists) branchesList.push(c);
      });

      setBranches(branchesList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setLoading(false);
    }
  };

  const fetchTargets = (monthKey) => {
    try {
      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));

      console.log('Fetching targets for month:', monthKey);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const targetsMap = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          const k1 = normKey(data.branchId);
          const k2 = normKey(data.branchName);
          if (k1) targetsMap[k1] = { id: doc.id, ...data };
          if (k2) targetsMap[k2] = { id: doc.id, ...data };
          if (data.branchId) targetsMap[data.branchId] = { id: doc.id, ...data };
        });
        setTargets(targetsMap);
      }, (error) => {
        console.error('Error fetching targets:', error);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up targets listener:', error);
    }
  };

  const normKey = (val) => {
    if (!val) return '';
    const s = String(val).toLowerCase().trim();
    if (s.includes('kphb') || s.includes('kphp') || s.includes('kph')) return 'kphb';
    if (s.includes('chnr') || s.includes('chand') || s.includes('chn')) return 'chandanagar';
    if (s.includes('dsnr') || s.includes('dil') || s.includes('dsn')) return 'dilshuknagar';
    if (s.includes('nalla') || s.includes('ngl') || s.includes('nlg')) return 'nallagandla';
    return s.replace(/\s*branch\s*/i, '').trim();
  };

  const fetchAllData = async (currentMonthKey) => {
    try {
      // Fetch all transactions (latest first, up to 5000)
      const txDocs = [];
      const seenDocIds = new Set();
      try {
        const q1 = query(collection(db, 'alltransactions'), orderBy('timestamp', 'desc'), limit(5000));
        const s1 = await getDocs(q1);
        s1.forEach(d => {
          if (!seenDocIds.has(d.id)) {
            seenDocIds.add(d.id);
            txDocs.push(d);
          }
        });
      } catch (e) {
        const s2 = await getDocs(collection(db, 'alltransactions'));
        s2.forEach(d => {
          if (!seenDocIds.has(d.id)) {
            seenDocIds.add(d.id);
            txDocs.push(d);
          }
        });
      }
      const salesMap = {};
      const consultRevMap = {};
      const pharmMap = {};
      const patMap = {}; // Consultations count
      const processedConsultations = new Set(); // Prevent double counting patients in the same month

      const parseAnyDate = (raw) => {
        if (!raw) return null;
        if (raw.toDate && typeof raw.toDate === 'function') return raw.toDate();
        if (raw.seconds) return new Date(raw.seconds * 1000);
        if (typeof raw === 'string') {
          const clean = raw.trim();
          const dDirect = new Date(clean);
          if (!isNaN(dDirect.getTime())) return dDirect;

          const datePart = clean.split(' ')[0];
          const parts = datePart.split(/[-/T]/);
          if (parts.length >= 3) {
            const p0 = parts[0].replace(/\D/g, '');
            const p2 = parts[2].replace(/\D/g, '');
            const y = parseInt(p0.length === 4 ? p0 : p2, 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(p0.length === 4 ? p2 : p0, 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
              return new Date(y, m, d);
            }
          }
        }
        return null;
      };

      txDocs.forEach(d => {
        const data = d.data();
        if (data.isDeleted) return;

        const date = parseAnyDate(data.timestamp || data.createdAt || data.date || data.paymentCollectedAt);
        if (date) {
          const m = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const bid = normKey(data.branchName || data.branch || data.branchId || data.location || data.clinicBranch || data.raw?.branchName || data.raw?.branchId || data.raw?.branch || 'kphb') || 'kphb';

          const baseAmt = Number(data.amount || data.amountPaid || data.paymentAmount || 0);
          const items = data.itemsPaid || null;
          const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;
          const amt = baseAmt > 0 ? baseAmt : itemsSum;

          if (m === currentMonthKey) {
            salesMap[bid] = (salesMap[bid] || 0) + amt;
            let rawType = (data.type || 'Consultation').toLowerCase();
            if (rawType.includes('medicine') || rawType.includes('product') || rawType.includes('pharmacy')) {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            } else if (rawType.includes('consultation')) {
              consultRevMap[bid] = (consultRevMap[bid] || 0) + amt;
              const patKey = `${bid}_${data.patientId || data.registrationId || d.id}`;
              if (!processedConsultations.has(patKey)) {
                patMap[bid] = (patMap[bid] || 0) + 1;
                processedConsultations.add(patKey);
              }
            } else if (rawType.includes('nutrition') || rawType.includes('diet')) {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            } else {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            }
          }
        }
      });

      setSalesData(salesMap);
      setConsultationRevenueData(consultRevMap);
      setPharmacyData(pharmMap);
      setConsultationData(patMap);

    } catch (e) { console.error(e); }
  };

  const fetchHistoryData = async () => {
    try {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));
      const snapshot = await getDocs(q);

      const historyList = [];
      snapshot.forEach(doc => {
        historyList.push({ id: doc.id, ...doc.data() });
      });
      setHistoryData(historyList);
    } catch (error) {
      console.error('Error fetching history data:', error);
    }
  };

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchTargets(newMonth);
    fetchAllData(newMonth);
  };

  const handleEditTarget = (branchId, currentTarget) => {
    setEditingTarget(branchId);
    setEditValue(currentTarget.toString());
  };

  const handleSaveTarget = async (branchId) => {
    if (!editingTarget || !editValue) return;

    setSaving(true);
    try {
      const numericTarget = parseInt(editValue.toString().replace(/\D/g, ''), 10) || 0;
      const bKey = normKey(branchId);
      const targetData = targets[bKey] || targets[branchId];
      if (targetData && targetData.id) {
        await updateDoc(doc(db, 'monthly_targets', targetData.id), {
          target: numericTarget,
          editedBy: userData?.name || 'Admin',
          editedById: userData?.uid || '',
          editedAt: serverTimestamp()
        });
      } else {
        // Create new target if it doesn't exist
        const branch = branches.find(b => b.id === branchId || normKey(b.id) === bKey);
        await addDoc(collection(db, 'monthly_targets'), {
          branchId: branchId,
          branchName: branch?.name || branch?.branchName || branchId,
          month: selectedMonth,
          target: numericTarget,
          reached: 0,
          setBy: userData?.name || 'Admin',
          setById: userData?.uid || '',
          setAt: serverTimestamp(),
          canEdit: true // Admin can edit
        });
      }
      setEditingTarget(null);
      setEditValue('');
    } catch (error) {
      console.error('Error saving target:', error);
      alert('Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTarget(null);
    setEditValue('');
  };

  const handleAddTarget = async (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;

    setEditingTarget(branchId);
    setEditValue('');
  };

  const getMonthName = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const calculatePercentage = (reached, target) => {
    if (!target || target === 0) return 0;
    return Math.round((reached / target) * 100);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isCollapsed ? <ChevronRight size={20} color="var(--primary-color)" /> : <ChevronLeft size={20} color="var(--primary-color)" />}
          </button>
        </div>
        <p className="sidebar-text" style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', marginTop: '-12px' }}>
          Super Admin Portal
        </p>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginTop: '20px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Building2 size={18} />
              <span className="sidebar-text">Manage Branches</span>
            </button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Users size={18} />
              <span className="sidebar-text">Global Patient List</span>
            </button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <UserCheck size={18} />
              <span className="sidebar-text">Staff Management</span>
            </button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <IndianRupee size={18} />
              <span className="sidebar-text">Consultation Revenue</span>
            </button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Briefcase size={18} />
              <span className="sidebar-text">Pharmacy Revenue</span>
            </button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <FileImage size={18} />
              <span className="sidebar-text">Manage Banners</span>
            </button>
          </Link>
          <Link to="/attendance" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Clock size={18} />
              <span className="sidebar-text">Global Attendance</span>
            </button>
          </Link>
          <Link to="/working-hours" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Clock size={18} />
              <span className="sidebar-text">Staff Working Hours</span>
            </button>
          </Link>
          <Link to="/targets" style={{ textDecoration: 'none' }}>
            <button
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: '#ffffff', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%' }}
            >
              <Target size={18} />
              <span className="sidebar-text">Target Management</span>
            </button>
          </Link>
        </nav>

        <button
          style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.3)', background: 'transparent', color: 'white', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', marginTop: 'auto', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          onClick={handleLogout}
        >
          <LogOut size={18} />
          <span className="sidebar-text">Sign Out</span>
        </button>
      </aside>

      <main className="main-content">
        <div className="target-management">
          <div className="page-header">
            <h1><Target className="icon" /> Target Management</h1>
            <p className="subtitle">View and manage monthly targets for all branches</p>
          </div>

          <div className="controls-section">
            <div className="month-selector">
              <label>Select Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={handleMonthChange}
                className="month-input"
              />
              <button onClick={() => {
                const today = new Date();
                const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                setSelectedMonth(monthKey);
                fetchTargets(monthKey);
                fetchAllData(monthKey);
              }} className="refresh-btn">
                <RefreshCw size={16} /> Current Month
              </button>
            </div>
          </div>

          <div className="summary-stats">
            <div className="summary-card">
              <span className="summary-label">Total Branches</span>
              <span className="summary-value">{branches.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Target</span>
              <span className="summary-value">₹{branches.reduce((acc, b) => {
                const bKey = normKey(b.id || b.name || b.branchName);
                const tObj = targets[bKey] || targets[b.id] || targets[b.name];
                return acc + (Number(tObj?.target) || 0);
              }, 0).toLocaleString()}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Revenue (Reached)</span>
              <span className="summary-value">₹{Object.values(salesData).reduce((a, b) => a + b, 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="month-display">
            <h2><Calendar className="icon" /> {getMonthName(selectedMonth)}</h2>
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : branches.length === 0 ? (
            <div className="empty-state">
              <Target size={48} color="#64748b" />
              <h3>No branches found</h3>
              <p>Please add branches in the system to manage targets.</p>
            </div>
          ) : (
            <div className="targets-grid">
              {branches.map(branch => {
                const bKey = normKey(branch.branchId || branch.branchName || branch.name || branch.location || branch.id);
                const targetData = targets[bKey] || targets[branch.id] || targets[branch.name];
                const consultations = consultationData[bKey] || 0;
                const consultationRevenue = consultationRevenueData[bKey] || 0;
                const pharmacy = pharmacyData[bKey] || (salesData[bKey] ? Math.max(0, salesData[bKey] - consultationRevenue) : 0);
                const target = targetData?.target || 0;
                const totalRevenue = salesData[bKey] || (consultationRevenue + pharmacy);
                const reached = totalRevenue;
                const percentage = calculatePercentage(reached, target);

                return (
                  <div key={branch.id} className="target-card">
                    <div className="card-header">
                      <h3>{branch.name}</h3>
                      {targetData && (
                        <span className={`status-badge ${targetData.setBy === 'Auto-generated' ? 'auto' : 'manual'}`}>
                          {targetData.setBy}
                        </span>
                      )}
                    </div>

                    <div className="target-stats">
                      <div className="stat-item">
                        <span className="label">Target:</span>
                        {editingTarget === branch.id ? (
                          <div className="edit-input-group">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="edit-input"
                              placeholder="Enter target"
                            />
                            <button
                              onClick={() => handleSaveTarget(branch.id)}
                              disabled={saving}
                              className="save-btn"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="cancel-btn"
                            >
                              <ArrowLeft size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="value">{target || 'Not Set'}</span>
                        )}
                      </div>

                      <div className="stat-item">
                        <span className="label">Total Revenue (Reached):</span>
                        <span className="value">₹{totalRevenue.toLocaleString()}</span>
                      </div>

                      <div className="stat-item">
                        <span className="label">Progress:</span>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                          <span className="percentage">{percentage}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="card-actions">
                      {targetData ? (
                        <button
                          onClick={() => handleEditTarget(branch.id, target)}
                          disabled={saving}
                          className="edit-btn"
                        >
                          <Edit size={16} /> Edit Target
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddTarget(branch.id)}
                          disabled={saving}
                          className="add-btn"
                        >
                          <Target size={16} /> Set Target
                        </button>
                      )}
                    </div>

                    {targetData && targetData.setBy && (
                      <div className="target-info">
                        <small>Set by: {targetData.setBy}</small>
                        {targetData.editedBy && <small> | Edited by: {targetData.editedBy}</small>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {historyData.length > 0 && (
            <div className="history-section">
              <h2><TrendingUp className="icon" /> Last Month Summary</h2>
              <div className="history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Target</th>
                      <th>Reached</th>
                      <th>Progress</th>
                      <th>Set By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(item => {
                      const percentage = calculatePercentage(item.reached, item.target);
                      return (
                        <tr key={item.id}>
                          <td>{item.branchName}</td>
                          <td>{item.target}</td>
                          <td>{item.reached}</td>
                          <td>
                            <div className="progress-bar small">
                              <div
                                className="progress-fill"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                              <span className="percentage">{percentage}%</span>
                            </div>
                          </td>
                          <td>{item.setBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TargetManagement;


