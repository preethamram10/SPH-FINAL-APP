import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection, query, where, addDoc, serverTimestamp,
  doc, updateDoc, getDocs, onSnapshot, limit, orderBy
} from 'firebase/firestore';
import {
  Target, Calendar, TrendingUp, Edit, Save, RefreshCw,
  ArrowLeft
} from 'lucide-react';
const normKey = (val) => {
  if (!val) return '';
  const s = String(val).toLowerCase().trim();
  if (s.includes('kphb') || s.includes('kphp') || s.includes('kph')) return 'kphb';
  if (s.includes('chnr') || s.includes('chand') || s.includes('chn')) return 'chandanagar';
  if (s.includes('dsnr') || s.includes('dil') || s.includes('dsn')) return 'dilshuknagar';
  if (s.includes('nalla') || s.includes('ngl') || s.includes('nlg')) return 'nallagandla';
  return s.replace(/\s*branch\s*/i, '').trim();
};
const HRTargetTab = () => {
  const { userData } = useAuth();
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
  const [unsubTargets, setUnsubTargets] = useState(null);
  useEffect(() => {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(monthKey);
    fetchBranches();
    const unsub = fetchTargets(monthKey);
    setUnsubTargets(() => unsub);
    fetchAllData(monthKey);
    return () => { if (unsub) unsub(); };
  }, []);

  // Auto-sync live revenue to Firebase monthly_targets collection
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
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'branch')));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));

      const snap2 = await getDocs(collection(db, 'branches'));
      snap2.forEach(d => {
        const data = d.data();
        const exists = list.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes((data.name || d.id || '').toLowerCase()));
        if (!exists) list.push({ id: d.id, ...data });
      });

      const canonicals = [
        { id: 'Kphb', name: 'Kphb', branchName: 'Kphb Branch' },
        { id: 'Chandanagar', name: 'Chandanagar', branchName: 'Chandanagar Branch' },
        { id: 'Dilshuknagar', name: 'Dilshuknagar', branchName: 'Dilshuknagar Branch' },
        { id: 'Nallagandla', name: 'Nallagandla', branchName: 'Nallagandla Branch' }
      ];

      canonicals.forEach(c => {
        const exists = list.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(c.name.toLowerCase()));
        if (!exists) list.push(c);
      });

      setBranches(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  const fetchTargets = (monthKey) => {
    try {
      const q = query(collection(db, 'monthly_targets'), where('month', '==', monthKey));
      return onSnapshot(q, (snap) => {
        const map = {};
        snap.forEach(d => {
          const data = d.data();
          const key1 = normKey(data.branchId);
          const key2 = normKey(data.branchName);
          if (key1) map[key1] = { id: d.id, ...data };
          if (key2) map[key2] = { id: d.id, ...data };
          if (data.branchId) map[data.branchId] = { id: d.id, ...data };
        });
        setTargets(map);
      });
    } catch (e) { console.error(e); }
  };
  const fetchAllData = async (currentMonthKey) => {
    try {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

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
      const lastMonthMap = {};
      const patMap = {}; // Consultations count

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
            let rawType = (data.typeLabel || data.type || 'Consultation').toLowerCase();
            if (rawType.includes('medicine') || rawType.includes('product') || rawType.includes('pharmacy') || rawType.includes('consultation & medicine')) {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            } else if (rawType.includes('consultation')) {
              consultRevMap[bid] = (consultRevMap[bid] || 0) + amt;
              patMap[bid] = (patMap[bid] || 0) + 1;
            } else if (rawType.includes('nutrition') || rawType.includes('diet')) {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            } else {
              pharmMap[bid] = (pharmMap[bid] || 0) + amt;
            }
          } else if (m === lastMonthKey) {
            lastMonthMap[bid] = (lastMonthMap[bid] || 0) + amt;
          }
        }
      });

      setSalesData(salesMap);
      setConsultationRevenueData(consultRevMap);
      setPharmacyData(pharmMap);
      setConsultationData(patMap);

      // Fetch last month's targets
      const targetSnap = await getDocs(query(collection(db, 'monthly_targets'), where('month', '==', lastMonthKey)));
      const list = [];
      targetSnap.forEach(d => list.push({ id: d.id, ...d.data() }));
      const updatedList = list.map(item => {
        const reached = lastMonthMap[normKey(item.branchId)] || lastMonthMap[normKey(item.branchName)] || 0;
        return { ...item, reached };
      });
      setHistoryData(updatedList);

    } catch (e) { console.error(e); }
  };
  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    if (unsubTargets) unsubTargets();
    const unsub = fetchTargets(newMonth);
    setUnsubTargets(() => unsub);
    fetchAllData(newMonth);
  };
  const resetToCurrentMonth = () => {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(monthKey);
    if (unsubTargets) unsubTargets();
    const unsub = fetchTargets(monthKey);
    setUnsubTargets(() => unsub);
    fetchAllData(monthKey);
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
          editedBy: userData?.name || 'HR Manager',
          editedById: userData?.uid || '',
          editedAt: serverTimestamp()
        });
      } else {
        const branch = branches.find(b => b.id === branchId || normKey(b.id) === bKey);
        await addDoc(collection(db, 'monthly_targets'), {
          branchId: branchId,
          branchName: branch?.name || branch?.branchName || branchId,
          month: selectedMonth,
          target: numericTarget,
          reached: 0,
          setBy: userData?.name || 'HR Manager',
          setById: userData?.uid || '',
          setAt: serverTimestamp()
        });
      }
      setEditingTarget(null);
      setEditValue('');
    } catch (e) {
      alert('Failed to save target: ' + e.message);
    } finally {
      setSaving(false);
    }
  };
  const handleCancelEdit = () => { setEditingTarget(null); setEditValue(''); };

  const getMonthName = (key) => {
    if (!key) return '';
    const [y, m] = key.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const calcPct = (reached, target) => {
    if (!target) return 0;
    return Math.round((reached / target) * 100);
  };

  return (
    <div className="target-management fade-in">
      <div className="page-header">
        <h2><Target className="icon" style={{ display: 'inline', marginRight: '10px' }} />Target Management</h2>
        <p className="subtitle">View and manage monthly targets for all branches</p>
      </div>

      {/* Month selector */}
      <div className="controls-section">
        <div className="month-selector">
          <label>Select Month:</label>
          <input type="month" value={selectedMonth} onChange={handleMonthChange} className="month-input" />
          <button onClick={resetToCurrentMonth} className="refresh-btn">
            <RefreshCw size={16} /> Current Month
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="summary-stats">
        <div className="summary-card">
          <span className="summary-label">Total Branches</span>
          <span className="summary-value">{branches.length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Consultations</span>
          <span className="summary-value">{Object.values(consultationData).reduce((a, b) => a + b, 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Consultation Revenue</span>
          <span className="summary-value">₹{Object.values(consultationRevenueData).reduce((a, b) => a + b, 0).toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Pharmacy Revenue</span>
          <span className="summary-value">₹{Object.values(pharmacyData).reduce((a, b) => a + b, 0).toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">₹{(Object.values(consultationRevenueData).reduce((a, b) => a + b, 0) + Object.values(pharmacyData).reduce((a, b) => a + b, 0)).toLocaleString()}</span>
        </div>
      </div>

      <div className="month-display">
        <h2><Calendar className="icon" style={{ display: 'inline', marginRight: '8px' }} />{getMonthName(selectedMonth)}</h2>
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
            const totalRevenue = salesData[bKey] || (consultationRevenue + pharmacy);
            const target = targetData?.target || 0;
            const reached = totalRevenue;
            const pct = calcPct(reached, target);

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
                        <button onClick={() => handleSaveTarget(branch.id)} disabled={saving} className="save-btn">
                          <Save size={16} />
                        </button>
                        <button onClick={handleCancelEdit} className="cancel-btn">
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
                      <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                      <span className="percentage">{pct}%</span>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  {targetData ? (
                    <button onClick={() => handleEditTarget(branch.id, target)} disabled={saving} className="edit-btn">
                      <Edit size={16} /> Edit Target
                    </button>
                  ) : (
                    <button onClick={() => { setEditingTarget(branch.id); setEditValue(''); }} disabled={saving} className="add-btn">
                      <Target size={16} /> Set Target
                    </button>
                  )}
                </div>

                {targetData?.setBy && (
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
          <h2><TrendingUp className="icon" style={{ display: 'inline', marginRight: '8px' }} />Last Month Summary</h2>
          <div className="history-table">
            <table>
              <thead>
                <tr>
                  <th>Branch</th><th>Target</th><th>Reached</th><th>Progress</th><th>Set By</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map(item => {
                  const pct = calcPct(item.reached, item.target);
                  return (
                    <tr key={item.id}>
                      <td>{item.branchName}</td>
                      <td>{item.target}</td>
                      <td>{item.reached}</td>
                      <td>
                        <div className="progress-bar small">
                          <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                          <span className="percentage">{pct}%</span>
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
  );
};

export default HRTargetTab;
