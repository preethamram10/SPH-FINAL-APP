import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { IndianRupee, MapPin, Calendar, User, Phone, Search } from 'lucide-react';

import { getStandardBranchName } from '../utils/idGenerator';

const PendingPayments = () => {
  const [pendingRecords, setPendingRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all'); // 'this_month' or 'all'

  useEffect(() => {
    fetchBranches();
    fetchPendingPayments();
  }, []);

  const normalizeBranchName = (val) => {
    return getStandardBranchName(val || 'Kphb');
  };

  const isPhoneMatch = (p1, p2) => {
    const clean1 = (p1 || '').replace(/\D/g, '').slice(-10);
    const clean2 = (p2 || '').replace(/\D/g, '').slice(-10);
    return clean1 && clean1 === clean2;
  };

  const handleClearPending = async (patient) => {
    if (!window.confirm(`Are you sure you want to clear all pending balances for ${patient.name}?`)) return;
    try {
      setLoading(true);
      const allPatsSnap = await getDocs(collection(db, 'allpatients'));
      const batchPromises = [];
      allPatsSnap.forEach(d => {
        const data = d.data();
        const amt = Number(data.pendingAmount) || 0;
        if (amt > 0) {
          const docPhone = data.phone || data.patientPhone || data.phoneNumber || data.contact || '';
          if (isPhoneMatch(patient.phone, docPhone) || d.id === patient.id) {
            batchPromises.push(updateDoc(doc(db, 'allpatients', d.id), { pendingAmount: 0 }));
          }
        }
      });
      await Promise.all(batchPromises);
      alert('Pending balance cleared successfully!');
      fetchPendingPayments();
    } catch (err) {
      console.error('Error clearing pending balance:', err);
      alert('Failed to clear pending balance.');
      setLoading(false);
    }
  };

  const parseAnyDateObj = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal.toDate) return dateVal.toDate();
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
    if (typeof dateVal === 'string') {
      const cleanStr = dateVal.trim();
      
      // Try standard JS Date parsing first (handles MM/DD/YYYY naturally)
      const nativeDate = new Date(cleanStr);
      if (!isNaN(nativeDate.getTime())) {
        const parts = cleanStr.split(',')[0].split('/');
        if (parts.length === 3 && parseInt(parts[0].trim(), 10) > 12) {
          // Definitely DD/MM/YYYY, fall back to manual split below
        } else {
          return nativeDate;
        }
      }

      if (cleanStr.includes('T') && (cleanStr.endsWith('Z') || cleanStr.includes('+'))) {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d;
      }
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split(',')[0].split('/');
        if (parts.length === 3) {
          let d = parseInt(parts[0], 10);
          let m = parseInt(parts[1], 10);
          let y = parseInt(parts[2], 10);
          if (d > 1000) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
            d = parseInt(parts[2], 10);
          }
          const dateObj = new Date(y, m - 1, d);
          if (!isNaN(dateObj.getTime())) return dateObj;
        }
      }
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const fetchBranches = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'branch')));
      const branchData = [];
      snap.forEach(doc => branchData.push({ id: doc.id, name: doc.data().name || doc.data().branchName || doc.id, ...doc.data() }));

      const canonicals = [
        { id: 'kphb', name: 'KPHB Branch', branchName: 'KPHB' },
        { id: 'chandanagar', name: 'Chandanagar Branch', branchName: 'Chandanagar' },
        { id: 'dilshuknagar', name: 'Dilshuknagar Branch', branchName: 'Dilshuknagar' },
        { id: 'nallagandla', name: 'Nallagandla Branch', branchName: 'Nallagandla' }
      ];

      canonicals.forEach(c => {
        const normC = c.branchName.toLowerCase();
        const exists = branchData.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(normC));
        if (!exists) {
          branchData.push(c);
        }
      });

      setBranches(branchData);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([
        { id: 'kphb', name: 'KPHB Branch', branchName: 'KPHB' },
        { id: 'chandanagar', name: 'Chandanagar Branch', branchName: 'Chandanagar' },
        { id: 'dilshuknagar', name: 'Dilshuknagar Branch', branchName: 'Dilshuknagar' },
        { id: 'nallagandla', name: 'Nallagandla Branch', branchName: 'Nallagandla' }
      ]);
    }
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const allPatientsSnap = await getDocs(collection(db, 'allpatients'));

      const patientGroups = new Map(); // phone -> accumulated data

      allPatientsSnap.forEach(doc => {
        const data = doc.data();
        const phone = (data.phone || data.patientPhone || data.phoneNumber || data.contact || '').trim();
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        
        // Use phone number (or doc.id if phone is missing) as the unique patient key
        const key = cleanPhone || doc.id;

        const amount = Number(data.pendingAmount) || 0;
        const dateStr = data.paymentCollectedAt || data.appointmentDate || data.createdAt || data.dateString || '';
        const parsedDate = parseAnyDateObj(dateStr);
        const rawDate = parsedDate ? parsedDate.getTime() : 0;

        if (!patientGroups.has(key)) {
          patientGroups.set(key, {
            id: doc.id,
            name: data.fullName || data.patientName || data.name || 'Unknown',
            phone: phone || '-',
            branchName: normalizeBranchName(data.branchName || data.branchId),
            branchId: data.branchId || '',
            amount: 0,
            latestDateStr: dateStr,
            latestRawDate: rawDate,
            doctorName: data.doctor || data.doctorName || 'N/A',
            regId: data.registrationId || data.regId || data.regID || 'N/A'
          });
        }

        const group = patientGroups.get(key);
        group.amount += amount;

        // Update to the latest visit date
        if (rawDate > group.latestRawDate) {
          group.latestRawDate = rawDate;
          group.latestDateStr = dateStr;
          // Prefer non-default names/details if available
          if (data.fullName || data.patientName) {
            group.name = data.fullName || data.patientName;
          }
          if (data.doctor || data.doctorName) {
            group.doctorName = data.doctor || data.doctorName;
          }
          if (data.registrationId || data.regId) {
            group.regId = data.registrationId || data.regId;
          }
        }
      });

      // Filter to only patients who have a total pending amount > 0
      const mergedRecords = Array.from(patientGroups.values())
        .filter(p => p.amount > 0)
        .map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          branchName: p.branchName,
          branchId: p.branchId,
          amount: p.amount,
          dateStr: p.latestDateStr,
          rawDate: p.latestRawDate,
          doctorName: p.doctorName,
          regId: p.regId
        }))
        .sort((a, b) => b.rawDate - a.rawDate);

      setPendingRecords(mergedRecords);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = pendingRecords.filter(record => {
    let matchesBranch = selectedBranch === 'all';
    if (!matchesBranch) {
        const branchObj = branches.find(b => b.id === selectedBranch);
        const selectedBranchNormalizedName = branchObj ? normalizeBranchName(branchObj.name) : '';
        matchesBranch = record.branchId === selectedBranch || record.branchName === selectedBranchNormalizedName;
    }
    const matchesSearch = !searchTerm || record.name.toLowerCase().includes(searchTerm.toLowerCase()) || record.phone.includes(searchTerm);
    
    let matchesPeriod = true;
    if (periodFilter === 'this_month') {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const dt = parseAnyDateObj(record.dateStr);
      matchesPeriod = dt && dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    }

    return matchesBranch && matchesSearch && matchesPeriod;
  });

  const totalPending = filteredRecords.reduce((sum, r) => sum + r.amount, 0);

  // Calculate branch-wise totals based on filtered period records
  const branchTotals = filteredRecords.reduce((acc, record) => {
    const bName = record.branchName || 'Main Branch';
    if (!acc[bName]) acc[bName] = 0;
    acc[bName] += record.amount;
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IndianRupee size={24} color="var(--primary-color)" />
          Pending Payments (Pay Later)
        </h2>
        
        {/* Toggle Button for period */}
        <div style={{ display: 'flex', gap: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-dark)' }}>
          <button
            onClick={() => setPeriodFilter('this_month')}
            style={{
              padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRadius: '6px',
              background: periodFilter === 'this_month' ? 'var(--primary-color)' : 'transparent',
              color: periodFilter === 'this_month' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriodFilter('all')}
            style={{
              padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRadius: '6px',
              background: periodFilter === 'all' ? 'var(--primary-color)' : 'transparent',
              color: periodFilter === 'all' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: 'bold', marginBottom: '8px' }}>
            {periodFilter === 'this_month' ? 'Total Pending (This Month)' : 'Total Pending (All Time)'}
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#ef4444' }}>₹{totalPending.toLocaleString('en-IN')}</div>
        </div>
        
        {Object.entries(branchTotals).map(([branchName, amount]) => (
          <div key={branchName} className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '8px' }}>{branchName}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>₹{amount.toLocaleString('en-IN')}</div>
          </div>
        ))}
        {Object.keys(branchTotals).length === 0 && (
          <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No branch totals for this period.
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Search Patient</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="glass-input"
              placeholder="Name or Phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', margin: 0 }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Filter Branch</label>
          <select
            className="glass-input"
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            style={{ margin: 0, background: 'var(--bg-dark)' }}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container glass-panel">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading pending payments...</div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending payments found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reg ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Patient Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Branch</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Doctor</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending Amount</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                    {record.dateStr ? (parseAnyDateObj(record.dateStr)?.toLocaleDateString() || record.dateStr) : 'N/A'}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-main)', fontWeight: '500' }}>{record.regId}</td>
                  <td style={{ padding: '12px', color: 'var(--text-main)', fontWeight: '600' }}>{record.name}</td>
                  <td style={{ padding: '12px', color: 'var(--text-main)' }}>{record.phone}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {record.branchName}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-main)' }}>{record.doctorName}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    ₹{record.amount.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleClearPending(record)}
                      style={{
                        padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    >
                      Clear Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PendingPayments;
