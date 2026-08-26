import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  Share2, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  RefreshCw, 
  ArrowLeft,
  Download,
  Globe,
  FileText,
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStandardBranchName } from '../../utils/idGenerator';

const FOUR_CANONICAL_BRANCHES = [
  'Nallagandla',
  'Kphb',
  'Dilshuknagar',
  'Chandanagar'
];

const normalizeBranchName = (rawBranch) => {
  return getStandardBranchName(rawBranch || 'Dilshuknagar');
};

const PatientClassificationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all'); // 'all', 'today', 'this_month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'old' | 'sources'
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Fetch all patient records from Firestore
  const fetchPatientRecords = async () => {
    setLoading(true);
    try {
      const patientMap = new Map();

      // 1. Fetch from 'allpatients'
      try {
        const snapAll = await getDocs(collection(db, 'allpatients'));
        snapAll.forEach(docSnap => {
          const data = docSnap.data();
          const id = docSnap.id;
          const phone = (data.phone || '').replace(/\D/g, '').slice(-10);
          const key = id || phone || data.registrationId;
          if (key) {
            patientMap.set(key, { id, ...data, _collection: 'allpatients' });
          }
        });
      } catch (e) {
        console.warn('Could not fetch allpatients:', e);
      }

      // 2. Fetch from 'patients' (walk-ins / clinic registrations)
      try {
        const snapPat = await getDocs(collection(db, 'patients'));
        snapPat.forEach(docSnap => {
          const data = docSnap.data();
          const id = docSnap.id;
          const phone = (data.phone || '').replace(/\D/g, '').slice(-10);
          const key = id || phone || data.registrationId;
          if (key && !patientMap.has(key)) {
            patientMap.set(key, { id, ...data, _collection: 'patients' });
          } else if (key && patientMap.has(key)) {
            // Merge extra details
            const existing = patientMap.get(key);
            patientMap.set(key, {
              ...data,
              ...existing,
              source: existing.source || data.source || data.acquisitionSource || data.leadSource,
              patientType: existing.patientType || data.patientType || data.type
            });
          }
        });
      } catch (e) {
        console.warn('Could not fetch patients collection:', e);
      }

      // 3. Fetch from 'appointments' (online bookings)
      try {
        const snapAppt = await getDocs(collection(db, 'appointments'));
        snapAppt.forEach(docSnap => {
          const data = docSnap.data();
          const id = docSnap.id;
          const phone = (data.phone || '').replace(/\D/g, '').slice(-10);
          const key = data.patientId || id || phone;
          if (key && !patientMap.has(key)) {
            patientMap.set(key, { id, ...data, _collection: 'appointments' });
          }
        });
      } catch (e) {
        console.warn('Could not fetch appointments collection:', e);
      }

      // Format patient records
      const formattedList = Array.from(patientMap.values()).map(item => {
        // Source normalization
        const rawSource = (
          item.source || 
          item.acquisitionSource || 
          item.leadSource || 
          item.patientSource || 
          item.sourceOfPatient || 
          item.howDidYouHear || 
          'Walk-in'
        ).trim();

        let cleanSource = rawSource;
        const lowerSrc = rawSource.toLowerCase();
        if (lowerSrc.includes('google')) cleanSource = 'Google';
        else if (lowerSrc.includes('insta')) cleanSource = 'Instagram';
        else if (lowerSrc.includes('you') || lowerSrc.includes('yt')) cleanSource = 'Youtube';
        else if (lowerSrc.includes('face') || lowerSrc.includes('fb')) cleanSource = 'Facebook';
        else if (lowerSrc.includes('walk')) cleanSource = 'Walk-in';
        else if (lowerSrc.includes('ref') || lowerSrc.includes('friend') || lowerSrc.includes('relative')) cleanSource = 'Reference';
        else if (lowerSrc.includes('web') || lowerSrc.includes('site')) cleanSource = 'Website';
        else if (lowerSrc.includes('pamphlet') || lowerSrc.includes('banner') || lowerSrc.includes('flyer')) cleanSource = 'Pamphlet';
        else if (lowerSrc.includes('tv')) cleanSource = 'TV';

        // Patient Type normalization (New vs Old / Revisit)
        const pType = (item.patientType || item.type || item.visitType || item.appointmentType || '').toLowerCase();
        const isRevisit = item.isRevisit === true || item.isNewPatient === false || pType === 'old' || pType === 'revisit' || (item.visitCount && Number(item.visitCount) > 1);

        const category = isRevisit ? 'old' : 'new';

        // Registration / Record Date parsing
        let recordDate = null;
        if (item.createdAt?.toDate) {
          recordDate = item.createdAt.toDate();
        } else if (item.createdAt?.seconds) {
          recordDate = new Date(item.createdAt.seconds * 1000);
        } else if (item.date) {
          recordDate = new Date(item.date);
        } else if (item.timestamp?.toDate) {
          recordDate = item.timestamp.toDate();
        } else {
          recordDate = new Date();
        }

        const normBranch = normalizeBranchName(item.branchName || item.branchId);

        return {
          id: item.id,
          fullName: item.fullName || item.patientName || item.name || 'Unknown Patient',
          phone: item.phone || 'N/A',
          registrationId: item.registrationId || item.patientId || item.id || 'N/A',
          branchName: normBranch,
          branchId: normBranch,
          source: cleanSource,
          category: category, // 'new' | 'old'
          doctorName: item.doctorName || item.doctor || 'General Doctor',
          date: recordDate,
          dateStr: recordDate ? recordDate.toISOString().split('T')[0] : '',
          visitCount: Number(item.visitCount || (isRevisit ? 2 : 1)),
          age: item.age || 'N/A',
          gender: item.gender || 'N/A',
          city: item.city || item.address || 'N/A'
        };
      });

      setPatients(formattedList);
    } catch (err) {
      console.error('Error fetching patient records for analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientRecords();
  }, []);

  // Filter patients by Branch & Date
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // Branch filter
      if (selectedBranch !== 'all') {
        const pBranch = (p.branchName || p.branchId || '').toLowerCase();
        if (!pBranch.includes(selectedBranch.toLowerCase())) {
          return false;
        }
      }

      // Date filter
      if (selectedDateFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (p.dateStr !== todayStr) return false;
      } else if (selectedDateFilter === 'this_month') {
        const now = new Date();
        const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDayStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        if (p.dateStr < firstDayStr || p.dateStr > lastDayStr) return false;
      } else if (selectedDateFilter === 'custom') {
        if (customStartDate && p.dateStr < customStartDate) return false;
        if (customEndDate && p.dateStr > customEndDate) return false;
      }

      return true;
    });
  }, [patients, selectedBranch, selectedDateFilter, customStartDate, customEndDate]);

  // Split into New Patients and Old Patients
  const newPatients = useMemo(() => {
    return filteredPatients.filter(p => p.category === 'new');
  }, [filteredPatients]);

  const oldPatients = useMemo(() => {
    return filteredPatients.filter(p => p.category === 'old');
  }, [filteredPatients]);

  // Calculate New Patient Counts by Acquisition Source ("how many comes which source new patient i need just number")
  const newPatientSourceCounts = useMemo(() => {
    const counts = {
      'Google': 0,
      'Instagram': 0,
      'Youtube': 0,
      'Facebook': 0,
      'Walk-in': 0,
      'Reference': 0,
      'Website': 0,
      'Pamphlet': 0,
      'TV': 0,
      'Others': 0
    };

    newPatients.forEach(p => {
      const src = p.source;
      if (counts.hasOwnProperty(src)) {
        counts[src] += 1;
      } else {
        counts['Others'] += 1;
      }
    });

    return counts;
  }, [newPatients]);

  // Branch-Wise New Patient Acquisition Breakdown (4 Unique Branches)
  const branchSourceBreakdown = useMemo(() => {
    const map = {};

    FOUR_CANONICAL_BRANCHES.forEach(b => {
      map[b] = {
        total: 0,
        sources: {
          'Google': 0,
          'Instagram': 0,
          'Youtube': 0,
          'Facebook': 0,
          'Walk-in': 0,
          'Reference': 0,
          'Website': 0,
          'Pamphlet': 0,
          'Others': 0
        }
      };
    });

    newPatients.forEach(p => {
      const bName = normalizeBranchName(p.branchName || p.branchId);
      if (!map[bName]) {
        map[bName] = {
          total: 0,
          sources: {
            'Google': 0,
            'Instagram': 0,
            'Youtube': 0,
            'Facebook': 0,
            'Walk-in': 0,
            'Reference': 0,
            'Website': 0,
            'Pamphlet': 0,
            'Others': 0
          }
        };
      }
      map[bName].total += 1;
      const src = p.source;
      if (map[bName].sources.hasOwnProperty(src)) {
        map[bName].sources[src] += 1;
      } else {
        map[bName].sources['Others'] += 1;
      }
    });

    return map;
  }, [newPatients]);

  // Tab List Search Filtering
  const displayedPatients = useMemo(() => {
    let list = newPatients;
    
    if (sourceFilter !== 'all') {
      list = list.filter(p => p.source === sourceFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.fullName && p.fullName.toLowerCase().includes(term)) ||
        (p.phone && p.phone.includes(term)) ||
        (p.registrationId && p.registrationId.toLowerCase().includes(term)) ||
        (p.source && p.source.toLowerCase().includes(term))
      );
    }

    return list;
  }, [activeTab, newPatients, oldPatients, filteredPatients, sourceFilter, searchTerm]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Category,Name,Phone,Reg ID,Branch,Doctor,Source,Visit Count,Date'];
    const rows = displayedPatients.map(p => 
      `"${p.category.toUpperCase()}","${p.fullName}","${p.phone}","${p.registrationId}","${p.branchName}","${p.doctorName}","${p.source}",${p.visitCount},"${p.dateStr}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Patient_Classification_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSourceIcon = (srcName) => {
    switch (srcName) {
      case 'Google': return <Globe size={18} style={{ color: '#4285F4' }} />;
      case 'Instagram': return <Share2 size={18} style={{ color: '#E1306C' }} />;
      case 'Youtube': return <TrendingUp size={18} style={{ color: '#FF0000' }} />;
      case 'Facebook': return <Globe size={18} style={{ color: '#1877F2' }} />;
      case 'Reference': return <UserCheck size={18} style={{ color: '#10b981' }} />;
      case 'Walk-in': return <Users size={18} style={{ color: '#8b5cf6' }} />;
      case 'Website': return <Globe size={18} style={{ color: '#258ec8' }} />;
      case 'Pamphlet': return <FileText size={18} style={{ color: '#f59e0b' }} />;
      default: return <HelpCircle size={18} style={{ color: '#64748b' }} />;
    }
  };

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <button 
            onClick={() => navigate(-1)} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
            👥 New & Old Patient Analytics
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Comprehensive patient classification list and new patient acquisition source numbers
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Branch Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Building2 size={16} color="#64748b" />
            <select 
              value={selectedBranch} 
              onChange={e => setSelectedBranch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}
            >
              <option value="all">All 4 Branches</option>
              <option value="Nallagandla">Nallagandla Branch</option>
              <option value="KPHB">KPHB Branch</option>
              <option value="Dilshuknagar">Dilshuknagar Branch</option>
              <option value="Chandanagar">Chandanagar Branch</option>
            </select>
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Calendar size={16} color="#64748b" />
            <select 
              value={selectedDateFilter} 
              onChange={e => setSelectedDateFilter(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {selectedDateFilter === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={e => setCustomStartDate(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={e => setCustomEndDate(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
            </div>
          )}

          {/* Refresh */}
          <button 
            onClick={fetchPatientRecords} 
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Key Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Registrations */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Users size={24} color="#258ec8" />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Records</span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '2px 0 0 0' }}>{filteredPatients.length}</h2>
          </div>
        </div>

        {/* New Patients Count */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <UserPlus size={24} color="#10b981" />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Patients (1st Visit)</span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', margin: '2px 0 0 0' }}>{newPatients.length}</h2>
          </div>
        </div>

        {/* New Patient Share (%) */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f3e8ff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <TrendingUp size={24} color="#8b5cf6" />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Patient Ratio</span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#8b5cf6', margin: '2px 0 0 0' }}>
              {filteredPatients.length > 0 ? ((newPatients.length / filteredPatients.length) * 100).toFixed(1) + '%' : '0%'}
            </h2>
          </div>
        </div>

      </div>

      {/* NEW PATIENTS SOURCE NUMBERS CARD GRID (Exact requirement: "how many comes which source new patient i need just number") */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={18} color="#258ec8" /> New Patients Count by Acquisition Source
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Exact count of first-time new patients coming from each referral channel
            </p>
          </div>
        </div>

        {/* Source Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
          {Object.entries(newPatientSourceCounts).map(([srcName, count]) => (
            <div 
              key={srcName}
              onClick={() => { setSourceFilter(sourceFilter === srcName ? 'all' : srcName); }}
              style={{
                backgroundColor: sourceFilter === srcName ? 'rgba(37, 142, 200, 0.1)' : '#f8fafc',
                border: sourceFilter === srcName ? '2px solid #258ec8' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getSourceIcon(srcName)}
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{srcName}</span>
              </div>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '800', 
                color: count > 0 ? '#10b981' : '#94a3b8',
                backgroundColor: count > 0 ? '#f0fdf4' : '#f1f5f9',
                padding: '2px 10px',
                borderRadius: '20px'
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 📍 4 UNIQUE BRANCHES NEW PATIENT ACQUISITION & SOURCES BREAKDOWN */}
      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', marginBottom: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={22} color="#10b981" /> 🏥 4 Standard Branches — New Patients & Acquisition Sources
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Detailed marketing source performance breakdown across Nallagandla, KPHB, Dilshuknagar, and Chandanagar
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {FOUR_CANONICAL_BRANCHES.map(bName => {
            const bData = branchSourceBreakdown[bName] || { total: 0, sources: {} };

            return (
              <div 
                key={bName}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Header Banner - Clean Minimalist Style */}
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>📍 {bName}</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Acquisition Channel Analysis</span>
                  </div>
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'block', lineHeight: '1.2' }}>{bData.total}</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#64748b' }}>New Patients</span>
                  </div>
                </div>

                {/* Sources List */}
                <div style={{ padding: '16px', flex: 1, backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(bData.sources).map(([src, count]) => {
                      const isActive = count > 0;
                      return (
                        <div 
                          key={src}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: isActive ? '#f8fafc' : '#ffffff',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: isActive ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                            opacity: isActive ? 1 : 0.6
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getSourceIcon(src)}
                            <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '500', color: '#1e293b' }}>{src}</span>
                          </div>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: isActive ? '#0f172a' : '#94a3b8',
                            backgroundColor: isActive ? '#e2e8f0' : '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PatientClassificationPage;
