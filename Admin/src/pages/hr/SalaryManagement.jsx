import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Coins, User, Clock, Trash2, Calendar, AlertTriangle, X } from 'lucide-react';

const LATE_THRESHOLD_MINUTES = 15;
const LATE_DAYS_PER_DEDUCTION = 3;
const DEDUCTION_PER_BLOCK = 500;

const SalaryManagement = () => {
  const { userData } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('process');

  // Auto-deduction state
  const [autoCalcLoading, setAutoCalcLoading] = useState(false);
  const [lateDaysCount, setLateDaysCount] = useState(0);
  const [autoDeduction, setAutoDeduction] = useState(0);
  const [lateLogDetails, setLateLogDetails] = useState([]);
  const [leaveCutsCount, setLeaveCutsCount] = useState(0);
  const [leaveDeduction, setLeaveDeduction] = useState(0);

  const [salaryData, setSalaryData] = useState({
    amount: '',
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    bonus: '0',
    deductions: '0',
    notes: '',
    amountDate: new Date().toISOString().split('T')[0],
    professionType: '',
    salaryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  });

  const fetchSalaryHistory = async (staffId) => {
    setHistoryLoading(true);
    try {
      const q = query(collection(db, 'salaries'), where('staffId', '==', staffId));
      const snap = await getDocs(q);
      const history = [];
      snap.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
      });
      history.sort((a, b) => {
        const tA = a.processedAt?.toDate?.() || 0;
        const tB = b.processedAt?.toDate?.() || 0;
        return tB - tA;
      });
      setSalaryHistory(history);
    } catch (error) {
      console.error('Error fetching salary history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // YYYY-MM-DD
  };

  const calculateAutoDeduction = async (staffMember) => {
    if (!staffMember) return;
    setAutoCalcLoading(true);
    setLateDaysCount(0);
    setAutoDeduction(0);
    setLateLogDetails([]);
    setLeaveCutsCount(0);
    setLeaveDeduction(0);

    try {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const targetMonthIdx = monthNames.indexOf(salaryData.month) !== -1 ? monthNames.indexOf(salaryData.month) : new Date().getMonth();
      const targetYear = parseInt(salaryData.year) || new Date().getFullYear();

      const startOfMonth = new Date(targetYear, targetMonthIdx, 1);
      const endOfMonth = new Date(targetYear, targetMonthIdx + 1, 0);
      const daysInMonth = endOfMonth.getDate();

      // 1. Fetch activity logs for the selected month
      const qLogs = query(
        collection(db, 'activity_logs'),
        where('userId', '==', staffMember.id),
        where('action', '==', 'login')
      );
      const snap = await getDocs(qLogs);

      const scheduledLoginTime = staffMember.loginTime || '09:30 AM';
      
      const isPM = scheduledLoginTime.toLowerCase().includes('pm');
      const isAM = scheduledLoginTime.toLowerCase().includes('am');
      const digitsOnly = scheduledLoginTime.replace(/[a-zA-Z]/g, '').trim();
      const parts = digitsOnly.split(':').map(Number);
      let schedHr = parts[0] || 0;
      const schedMin = parts[1] || 0;
      
      if (isPM && schedHr < 12) schedHr += 12;
      if (isAM && schedHr === 12) schedHr = 0;

      const lateDays = [];

      snap.forEach(doc => {
        const log = doc.data();
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : null;
        if (!logDate) return;
        if (logDate < startOfMonth || logDate > endOfMonth) return;

        const logHr = logDate.getHours();
        const logMin = logDate.getMinutes();
        const logTotalMin = logHr * 60 + logMin;
        const schedTotalMin = schedHr * 60 + schedMin;
        const diffMin = logTotalMin - schedTotalMin;

        if (diffMin > LATE_THRESHOLD_MINUTES) {
          lateDays.push({
            date: logDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            lateBy: diffMin,
          });
        }
      });

      const lateCount = lateDays.length;
      const deductionBlocks = Math.floor(lateCount / LATE_DAYS_PER_DEDUCTION);
      const totalLateDeduction = deductionBlocks * DEDUCTION_PER_BLOCK;

      setLateDaysCount(lateCount);
      setAutoDeduction(totalLateDeduction);
      setLateLogDetails(lateDays);

      // 2. Fetch approved leaves for the selected month
      const qLeaves = query(
        collection(db, 'leave_requests'),
        where('userId', '==', staffMember.id),
        where('status', '==', 'approved')
      );
      const leaveSnap = await getDocs(qLeaves);

      let totalCuts = 0;
      leaveSnap.forEach(docSnap => {
        const leave = docSnap.data();
        if (leave.startDate) {
          const start = parseDateString(leave.startDate);
          const end = parseDateString(leave.endDate) || start;
          if (start && end) {
            let temp = new Date(start.getTime());
            while (temp <= end) {
              if (temp >= startOfMonth && temp <= endOfMonth) {
                const dayOfWeek = temp.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
                if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
                  totalCuts += 2; // Double cut on Fri, Sat, Sun
                } else {
                  totalCuts += 1;
                }
              }
              temp.setDate(temp.getDate() + 1);
            }
          }
        }
      });

      setLeaveCutsCount(totalCuts);

      const baseSalary = parseFloat(staffMember.salary || 0);
      if (totalCuts > 4 && baseSalary > 0) {
        const excessLeaves = totalCuts - 4;
        const computedLeaveDeduction = Math.round((baseSalary / daysInMonth) * excessLeaves);
        setLeaveDeduction(computedLeaveDeduction);
      } else {
        setLeaveDeduction(0);
      }

    } catch (error) {
      console.error('Error calculating deductions:', error);
    } finally {
      setAutoCalcLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStaff) {
      fetchSalaryHistory(selectedStaff.id);
      calculateAutoDeduction(selectedStaff);
    }
  }, [selectedStaff, salaryData.month, salaryData.year]);

  const fetchStaff = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      let q;
      if (userData?.branchId) {
        q = query(collection(db, 'users'), where('branchId', '==', userData.branchId));
      } else {
        q = query(collection(db, 'users'));
      }
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
         if (d.role && ['doctor', 'receptionist', 'hr', 'staff'].includes(d.role.toLowerCase().trim())) {
          data.push({ id: doc.id, ...d });
        }
      });
      setStaff(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData) fetchStaff();
  }, [userData]);

  useEffect(() => {
    const totalAutoDeductions = autoDeduction + leaveDeduction;
    setSalaryData(prev => ({ ...prev, deductions: String(totalAutoDeductions) }));
  }, [autoDeduction, leaveDeduction]);

  useEffect(() => {
    if (selectedStaff?.salary) {
      setSalaryData(prev => ({ ...prev, amount: String(selectedStaff.salary) }));
    }
  }, [selectedStaff]);

  const handleProcessSalary = async (e) => {
    e.preventDefault();
    if (!salaryData.amount) {
      alert('Please enter base salary amount.');
      return;
    }

    try {
      const grossSalary = parseFloat(salaryData.amount);
      const bonus = parseFloat(salaryData.bonus || 0);
      const deductions = parseFloat(salaryData.deductions || 0);
      const netSalary = grossSalary + bonus - deductions;

      await addDoc(collection(db, 'salaries'), {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        staffRole: selectedStaff.role,
        branchId: userData.branchId || 'KPHB',
        amount: grossSalary,
        bonus,
        deductions,
        lateDeduction: autoDeduction,
        lateDaysCount,
        leaveDeduction,
        leaveCutsCount,
        netSalary,
        month: salaryData.month,
        year: salaryData.year,
        notes: salaryData.notes,
        amountDate: salaryData.amountDate,
        professionType: salaryData.professionType,
        salaryTime: salaryData.salaryTime,
        processedBy: userData.name || 'HR Manager',
        processedAt: serverTimestamp(),
        status: 'paid'
      });

      alert(`Salary processed successfully for ${selectedStaff.name}`);
      setShowModal(false);
      setSelectedStaff(null);
    } catch (error) {
      console.error('Error processing salary:', error);
      alert('Failed to process salary.');
    }
  };

  const openProcessModal = (item) => {
    setSelectedStaff(item);
    setSalaryData({
      amount: item.salary ? String(item.salary) : '',
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear().toString(),
      bonus: '0',
      deductions: '0',
      notes: '',
      amountDate: new Date().toISOString().split('T')[0],
      professionType: item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Staff',
      salaryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
    setActiveSubTab('process');
    setShowModal(true);
  };

  const netPayable = (
    parseFloat(salaryData.amount || 0) +
    parseFloat(salaryData.bonus || 0) -
    parseFloat(salaryData.deductions || 0)
  );

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Salary Management</h2>
          <p style={{ color: 'var(--text-muted)' }}>Calculate work attendance deductions & process monthly payrolls</p>
        </div>
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
                <th>Base Salary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td style={{ fontWeight: 600 }}>{member.name}</td>
                  <td><span className="badge badge-secondary">{member.role?.toUpperCase()}</span></td>
                  <td>₹{member.salary ? Number(member.salary).toLocaleString('en-IN') : 'Not Set'}</td>
                  <td>
                    <button className="btn-primary" onClick={() => openProcessModal(member)}>
                      Process Payout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedStaff && (
        <div className="modal-backdrop" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '650px', padding: '32px', maxHeight: '90%', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <span onClick={() => setActiveSubTab('process')} style={{ cursor: 'pointer', fontWeight: activeSubTab === 'process' ? 'bold' : 'normal', color: activeSubTab === 'process' ? 'var(--primary-color)' : 'var(--text-muted)' }}>Process Payout</span>
                <span onClick={() => setActiveSubTab('history')} style={{ cursor: 'pointer', fontWeight: activeSubTab === 'history' ? 'bold' : 'normal', color: activeSubTab === 'history' ? 'var(--primary-color)' : 'var(--text-muted)' }}>History ({salaryHistory.length})</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {activeSubTab === 'process' ? (
              <form onSubmit={handleProcessSalary}>
                {/* Shift Timings */}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc11', borderRadius: '8px', border: '1px solid #ffffff11' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedStaff.name} ({selectedStaff.role?.toUpperCase()})</div>
                  {selectedStaff.loginTime && (
                    <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}>
                      <Clock size={12} />
                      Shift Assigned: {selectedStaff.loginTime} – {selectedStaff.logoutTime}
                    </div>
                  )}
                </div>

                {/* Auto calculation */}
                {autoCalcLoading ? (
                  <div style={{ padding: '12px', background: '#f59e0b22', border: '1px solid #f59e0b', borderRadius: '8px', marginBottom: '16px' }}>
                    Auto-calculating attendance metrics...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {/* Late clock-in alerts */}
                    {lateDaysCount > 0 ? (
                      <div style={{ padding: '12px', background: '#ef444422', border: '1px solid #ef4444', borderRadius: '8px' }}>
                        <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        Late clock-in: <strong>{lateDaysCount} days</strong> this month. Auto late deduction: <strong>₹{autoDeduction}</strong>
                      </div>
                    ) : (
                      <div style={{ padding: '10px', background: '#10b98122', border: '1px solid #10b981', borderRadius: '8px', fontSize: '13px' }}>
                        No late entries recorded for this month.
                      </div>
                    )}

                    {/* Leave limits and LOP alerts */}
                    {leaveCutsCount > 0 ? (
                      <div style={{ padding: '12px', background: leaveCutsCount > 4 ? '#ef444422' : '#10b98122', border: '1px solid ' + (leaveCutsCount > 4 ? '#ef4444' : '#10b981'), borderRadius: '8px' }}>
                        <Calendar size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        Leaves taken: <strong>{leaveCutsCount} day cuts</strong> (including weekend double cuts). 
                        {leaveCutsCount > 4 ? (
                          <span> LOP Deduction: <strong>₹{leaveDeduction}</strong></span>
                        ) : (
                          <span> (Within monthly limit of 4 free leaves)</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '10px', background: '#10b98122', border: '1px solid #10b981', borderRadius: '8px', fontSize: '13px' }}>
                        No leaves taken this month.
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Base Salary (₹)</label>
                  <input
                    type="number"
                    className="glass-input"
                    value={salaryData.amount}
                    onChange={(e) => setSalaryData({ ...salaryData, amount: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Bonus (₹)</label>
                    <input
                      type="number"
                      className="glass-input"
                      value={salaryData.bonus}
                      onChange={(e) => setSalaryData({ ...salaryData, bonus: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deductions (₹)</label>
                    <input
                      type="number"
                      className="glass-input"
                      value={salaryData.deductions}
                      onChange={(e) => setSalaryData({ ...salaryData, deductions: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Pay Period (Month & Year)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                    <input type="text" className="glass-input" value={salaryData.month} onChange={(e) => setSalaryData({ ...salaryData, month: e.target.value })} />
                    <input type="number" className="glass-input" value={salaryData.year} onChange={(e) => setSalaryData({ ...salaryData, year: e.target.value })} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Internal Audit Notes</label>
                  <textarea className="glass-input" rows={2} value={salaryData.notes} onChange={(e) => setSalaryData({ ...salaryData, notes: e.target.value })} />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                  <div className="flex-between" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    <span>Net Payable:</span>
                    <span style={{ color: 'var(--primary-color)' }}>₹{netPayable.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  Generate Payslip & Pay
                </button>
              </form>
            ) : (
              <div>
                {historyLoading ? (
                  <div>Loading history...</div>
                ) : salaryHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No past salary logs found for this staff member.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {salaryHistory.map((h) => (
                      <div key={h.id} className="glass-panel" style={{ padding: '16px' }}>
                        <div className="flex-between" style={{ marginBottom: '6px' }}>
                          <strong>{h.month} {h.year}</strong>
                          <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>₹{h.netSalary}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Base: ₹{h.amount} | Bonus: ₹{h.bonus} | Ded: ₹{h.deductions}
                        </p>
                        {h.notes && <p style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '6px', marginBottom: 0 }}>Notes: "{h.notes}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryManagement;
