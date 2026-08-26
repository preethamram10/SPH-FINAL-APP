import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Package, User, Phone, Search, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PackageMembers = () => {
  const { userData } = useAuth();
  
  const normalizeBranch = (branch) => {
    if (!branch) return '';
    const str = String(branch).toLowerCase().trim();
    if (str.includes('kphb')) return 'kphb';
    if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
    if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
    if (str.includes('nallagandla')) return 'nallagandla';
    return str.replace(/\s*branch\s*/i, '').trim();
  };

  const matchBranch = (item) => {
    if (!item) return false;
    // Admin, HR, and Super Admin can view all package members across all clinic branches
    if (!userData?.branchId || userData?.role === 'admin' || userData?.role === 'hr' || userData?.role === 'superadmin' || userData?.role === 'super_admin' || userData?.branchId === 'all') return true;
    const normVal = normalizeBranch(item.branchId);
    const normName = normalizeBranch(item.branchName);
    const normUserId = normalizeBranch(userData.branchId);
    const normUserName = normalizeBranch(userData.branchName);
    return normVal === normUserId || normVal === normUserName || 
           normName === normUserId || normName === normUserName ||
           item.branchId === userData.branchId || item.branchId === userData.branchName ||
           item.branchName === userData.branchName || item.branchName === userData.branchId;
  };

  const [loading, setLoading] = useState(true);
  const [packageMembers, setPackageMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Member Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientMobile, setPatientMobile] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [packagePurpose, setPackagePurpose] = useState('');

  // Date States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]
  );

  // Patient autocomplete states
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // Collect Balance Modal State
  const [collectModalVisible, setCollectModalVisible] = useState(false);
  const [selectedMemberForPay, setSelectedMemberForPay] = useState(null);
  const [collectAmountInput, setCollectAmountInput] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPaid: 0,
    totalPending: 0
  });

  useEffect(() => {
    // Realtime listener for package members
    const q = query(collection(db, 'package_members'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      let paidSum = 0;
      let pendingSum = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!matchBranch(data)) return;

        const total = parseFloat(data.totalAmount) || 0;
        const paid = parseFloat(data.paidAmount) || 0;
        const balance = total - paid;

        paidSum += paid;
        pendingSum += balance;

        list.push({
          id: doc.id,
          ...data,
          balanceAmount: balance
        });
      });

      // Sort list by creation date descending
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setPackageMembers(list);
      setFilteredMembers(list);
      setStats({
        totalMembers: list.length,
        totalPaid: paidSum,
        totalPending: pendingSum
      });
      setLoading(false);
    }, (error) => {
      console.error("Error reading package members: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleLiveSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredMembers(packageMembers);
      return;
    }
    const queryLower = text.toLowerCase();
    const filtered = packageMembers.filter(member =>
      String(member.patientName || '').toLowerCase().includes(queryLower) ||
      String(member.patientMobile || '').includes(queryLower)
    );
    setFilteredMembers(filtered);
  };

  const searchPatients = async (text) => {
    setPatientSearch(text);
    if (text.length < 3) {
      setPatientSearchResults([]);
      return;
    }

    try {
      const q = query(collection(db, 'allpatients'));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.fullName?.toLowerCase().includes(text.toLowerCase()) || d.phone?.includes(text)) {
          list.push({ id: doc.id, ...d });
        }
      });
      setPatientSearchResults(list.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectPatient = (p) => {
    setSelectedPatientId(p.id);
    setPatientName(p.fullName);
    setPatientMobile(p.phone);
    setPatientSearch('');
    setPatientSearchResults([]);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!patientName.trim() || !patientMobile.trim() || !totalAmount.trim()) {
      alert('Please fill in patient name, phone, and total amount.');
      return;
    }

    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const balance = total - paid;

    if (paid > total) {
      alert('Paid amount cannot exceed total package amount.');
      return;
    }

    try {
      await addDoc(collection(db, 'package_members'), {
        patientId: selectedPatientId || '',
        patientName: patientName.trim(),
        patientMobile: patientMobile.trim(),
        packageName: 'Standard Homeopathy Package',
        purpose: packagePurpose.trim(),
        totalAmount: total,
        paidAmount: 0,
        balanceAmount: total,
        advancePending: paid,
        startDate: startDate,
        endDate: endDate,
        status: 'active',
        branchId: userData?.branchId || 'KPHB',
        branchName: userData?.branchName || 'KPHB Branch',
        createdAt: serverTimestamp(),
        createdBy: userData?.uid || 'doctor',
        createdByName: userData?.name || 'Doctor'
      });

      // Clear states
      setPatientName('');
      setPatientMobile('');
      setTotalAmount('');
      setPaidAmount('0');
      setPackagePurpose('');
      setSelectedPatientId(null);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate(new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]);
      setModalVisible(false);

      alert('Package member added successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save package membership.');
    }
  };

  const isPackageActive = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= startDateStr && today <= endDateStr;
  };

  const handleSaveBalancePayment = async (e) => {
    e.preventDefault();
    if (!selectedMemberForPay || !collectAmountInput) return;
    const payVal = parseFloat(collectAmountInput) || 0;
    if (payVal <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const currentPaid = parseFloat(selectedMemberForPay.paidAmount) || 0;
    const currentBal = parseFloat(selectedMemberForPay.balanceAmount) || 0;
    const newPaid = currentPaid + payVal;
    const newBal = Math.max(0, currentBal - payVal);

    try {
      await updateDoc(doc(db, 'package_members', selectedMemberForPay.id), {
        paidAmount: newPaid,
        balanceAmount: newBal,
        status: newBal <= 0 ? 'completed' : 'active',
        updatedAt: serverTimestamp()
      });

      if (selectedMemberForPay.patientId) {
        try {
          await updateDoc(doc(db, 'allpatients', selectedMemberForPay.patientId), {
            packagePaid: newPaid,
            packageBalance: newBal
          });
        } catch (err) {}
      }

      setCollectModalVisible(false);
      setSelectedMemberForPay(null);
      setCollectAmountInput('');
      alert('Package balance payment updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update balance payment.');
    }
  };

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h2>Package Members</h2>
          <p style={{ color: 'var(--text-muted)' }}>Homeopathy Subscriptions & Installments</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>{stats.totalMembers}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Members</p>
        </div>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--primary-color)' }}>₹{stats.totalPaid}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Paid</p>
        </div>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <h3 style={{ color: '#ef4444' }}>₹{stats.totalPending}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Pending</p>
        </div>
      </div>

      {/* Searchbar */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search member name, phone or package..."
          className="glass-input"
          value={searchQuery}
          onChange={(e) => handleLiveSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container glass-panel">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Contact</th>
              <th>Duration</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Added By</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No members found.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const active = isPackageActive(member.startDate, member.endDate);
                return (
                  <tr key={member.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div>{member.patientName}</div>
                      {member.purpose && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>🎯 {member.purpose}</div>
                      )}
                    </td>
                    <td>{member.patientMobile}</td>
                    <td>{member.startDate} to {member.endDate}</td>
                    <td>₹{member.totalAmount}</td>
                    <td style={{ color: 'var(--primary-color)', fontWeight: 600 }}>₹{member.paidAmount}</td>
                    <td style={{ color: member.balanceAmount > 0 ? '#ef4444' : 'var(--primary-color)', fontWeight: 600 }}>
                      ₹{member.balanceAmount}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{member.createdByName || member.createdBy || 'Staff'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>📍 {member.branchName || member.branchId || 'Clinic'}</div>
                    </td>
                    <td>
                      <span className={`badge ${active ? 'badge-primary' : 'badge-secondary'}`}>
                        {active ? 'ACTIVE' : 'EXPIRED'}
                      </span>
                    </td>
                    <td>
                      {member.balanceAmount > 0 ? (
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: '#10b981', borderColor: '#10b981' }}
                          onClick={() => {
                            setSelectedMemberForPay(member);
                            setCollectAmountInput(String(member.balanceAmount));
                            setCollectModalVisible(true);
                          }}
                        >
                          💳 Collect Balance
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>✓ Paid Full</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalVisible && (
        <div className="modal-backdrop" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '500px', padding: '32px', position: 'relative', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>Add Package Member</h3>
              <button onClick={() => setModalVisible(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMember}>
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Search Patient (Min 3 chars)</label>
                <input
                  type="text"
                  placeholder="Type patient name or phone..."
                  value={patientSearch}
                  onChange={(e) => searchPatients(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                {patientSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
                    {patientSearchResults.map((p) => (
                      <div
                        key={p.id}
                        style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onClick={() => handleSelectPatient(p)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                          <span>{p.fullName}</span>
                          {(p.source === 'appointments' || p._type === 'online' || p.source === 'UserApp') && (
                            <span style={{ fontSize: '9px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>APP</span>
                          )}
                          {p.packageId && (
                            <span style={{ fontSize: '9px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>PKG</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '12px' }}>
                          <span>{p.phone}</span>
                          {p.branchName && <span>• {p.branchName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Patient Name *</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Patient Mobile *</label>
                <input
                  type="text"
                  required
                  value={patientMobile}
                  onChange={(e) => setPatientMobile(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Package Purpose / Disease</label>
                <input
                  type="text"
                  placeholder="e.g. Asthmatic Treatment, Allergy Control"
                  value={packagePurpose}
                  onChange={(e) => setPackagePurpose(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Total Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Advance Paid (₹)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(37, 142, 200, 0.2)' }}>
                Register Package Membership
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Collect Balance Modal */}
      {collectModalVisible && selectedMemberForPay && (
        <div className="modal-backdrop" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '420px', padding: '28px', position: 'relative', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>Collect Package Balance</h3>
              <button onClick={() => setCollectModalVisible(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '32px', height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{selectedMemberForPay.patientName}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>📱 {selectedMemberForPay.patientMobile}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Current Pending Balance:</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>₹{selectedMemberForPay.balanceAmount}</span>
              </div>
            </div>

            <form onSubmit={handleSaveBalancePayment}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>Amount Collected Today (₹) *</label>
                <input
                  type="number"
                  required
                  style={{ width: '100%', backgroundColor: '#fff', border: '1.5px solid #10b981', color: '#0f172a', padding: '12px 16px', borderRadius: '8px', fontSize: '16px', fontWeight: '800', outline: 'none' }}
                  value={collectAmountInput}
                  onChange={(e) => setCollectAmountInput(e.target.value)}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  New Remaining Balance: <strong>₹{Math.max(0, parseFloat(selectedMemberForPay.balanceAmount || 0) - parseFloat(collectAmountInput || 0))}</strong>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: '700', borderRadius: '8px', backgroundColor: '#10b981', borderColor: '#10b981' }}>
                Confirm Balance Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageMembers;
