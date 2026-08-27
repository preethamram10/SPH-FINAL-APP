import React, { useState, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import {
  ChevronLeft, Search, X, FileText, User, Calendar,
  ChevronDown, CheckCircle2, Circle, RotateCcw
} from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  danger: '#ef4444',
};

const PATIENT_SOURCES = [
  'Walk-in', 'Instagram', 'Facebook', 'Website', 'Google', 'Online', 'Practo', 'Referral', 'Youtube'
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function normalizeDoctorName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/^dr\.\s*/i, '').replace(/^dr\s*/i, '').replace(/\./g, '').replace(/\s+/g, '').trim();
}

const parseHTMLDate = (str) => {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return null;
};

const parseGBDate = (str) => {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  return null;
};

const getDateFromPatient = (p) => {
  const raw = p.completedAt || p.prescribedAt || p.appointmentDate || p.createdAt;
  if (!raw) return null;
  if (raw?.toDate) return raw.toDate();
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  if (typeof raw === 'string') {
    if (raw.includes('/')) return parseGBDate(raw);
    if (raw.includes('-') && raw.split('-')[0].length === 4 && raw.length <= 10) return parseHTMLDate(raw);
    return new Date(raw);
  }
  return null;
};
const DoctorConsultationHistory = ({ navigation }) => {
  const { userData } = useAuth();
  const [patients, setPatients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  // Picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState('');
  const [rawDateInput, setRawDateInput] = useState('');


  useEffect(() => {
    // Fetch branches
    const qBranches = query(collection(db, 'users'), where('role', '==', 'branch'));
    const unsubBranches = onSnapshot(qBranches, snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() })); setBranches(list);
    });

    let patientsList = [];
    let appointmentsList = [];

    const combineAndSet = () => {
      const combined = [...patientsList, ...appointmentsList];
      setPatients(combined);
    };

    // Fetch completed patients
    const qPatients = query(collection(db, 'patients'), where('status', 'in', ['completed', 'done', 'dispatched']), limit(300));
    const unsubPatients = onSnapshot(qPatients, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, _type: 'walkin', ...d.data() }));
      patientsList = list;
      combineAndSet();
      setLoading(false);
    }, () => setLoading(false));

    // Fetch completed appointments from allpatients
    const qAppts = query(collection(db, 'allpatients'), where('status', 'in', ['completed', 'done', 'dispatched']), limit(300));
    const unsubAppts = onSnapshot(qAppts, snap => {
      const list = [];
      snap.forEach(d => {
        const appt = d.data();
        list.push({
          id: d.id,
          _type: 'online',
          ...appt,
          fullName: appt.fullName || appt.patientName || 'Online Patient',
          phone: appt.phone || 'N/A',
          registrationId: appt.registrationId || 'ONLINE',
          appointmentDate: appt.appointmentDate || appt.dateString || 'No Date',
          appointmentTime: appt.appointmentTime || appt.timeSlot || 'N/A',
          doctor: appt.doctor || appt.doctorName || 'Doctor'
        });
      });
      appointmentsList = list;
      combineAndSet();
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubBranches();
      unsubPatients();
      unsubAppts();
    };
  }, []);

  const handleResetFilters = () => {
    setSearchQuery(''); setBranchFilter('all'); setDateFilter('');
    setYearFilter('all'); setMonthFilter('all'); setSourceFilter('all'); setMethodFilter('all');
  };

  const doctorHistory = useMemo(() => {
    if (!userData) return [];
    const docNorm = normalizeDoctorName(userData.name || '');
    const filterBranchObj = branchFilter !== 'all' ? branches.find(b => b.id === branchFilter) : null;
    const branchName = filterBranchObj?.name;

    return patients.filter(p => {
      // Doctor match
      const patDocNorm = normalizeDoctorName(p.doctor || '');
      const isMine = !docNorm || !patDocNorm || patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm);
      if (!isMine) return false;

      // Search
      if (searchQuery.trim()) {
        const sq = searchQuery.toLowerCase();
        const match = (p.fullName && p.fullName.toLowerCase().includes(sq)) ||
          (p.phone && p.phone.includes(searchQuery.trim())) ||
          (p.registrationId && String(p.registrationId).toLowerCase().includes(sq));
        if (!match) return false;
      }

      // Branch
      if (branchFilter !== 'all') {
        const match = p.branchId === branchFilter ||
          (p.branchName && branchName && p.branchName === branchName);
        if (!match) return false;
      }

      // Date / Year / Month
      if (dateFilter || yearFilter !== 'all') {
        const d = getDateFromPatient(p);
        if (d && !isNaN(d.getTime())) {
          if (dateFilter) {
            const fd = parseHTMLDate(dateFilter);
            if (fd) {
              const dc = new Date(d); dc.setHours(0, 0, 0, 0); fd.setHours(0, 0, 0, 0);
              if (dc.getTime() !== fd.getTime()) return false;
            }
          } else if (yearFilter !== 'all') {
            if (d.getFullYear() !== parseInt(yearFilter, 10)) return false;
            if (monthFilter !== 'all') {
              if (d.getMonth() + 1 !== parseInt(monthFilter, 10)) return false;
            }
          }
        } else { return false; }
      }

      // Source
      if (sourceFilter !== 'all') {
        const pSource = (p.source === 'appointments' || p.source === 'UserApp' || p._type === 'online' || p.source === 'Patient App' || p.source === 'Online') ? 'Online' : (p.source || 'Walk-in');
        if (pSource !== sourceFilter) return false;
      }

      // Payment mode
      if (methodFilter !== 'all') {
        if (p.paymentStatus !== 'paid' || p.paymentMethod !== methodFilter) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = getDateFromPatient(a) || new Date(0);
      const db2 = getDateFromPatient(b) || new Date(0);
      return db2 - da;
    });
  }, [patients, userData, searchQuery, branchFilter, dateFilter, yearFilter, monthFilter, sourceFilter, methodFilter, branches]);

  // Revenue stats
  const revStats = useMemo(() => {
    const paid = doctorHistory.filter(p => p.paymentStatus === 'paid');
    const total = paid.reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);
    const cash = paid.reduce((s, p) => {
      if (p.paymentMethod === 'cash') return s + (Number(p.paymentAmount) || 0);
      if (p.paymentMethod === 'split' && p.paymentSplitDetails?.cash) return s + Number(p.paymentSplitDetails.cash);
      return s;
    }, 0);
    const upi = paid.reduce((s, p) => {
      if (p.paymentMethod === 'upi') return s + (Number(p.paymentAmount) || 0);
      if (p.paymentMethod === 'split' && p.paymentSplitDetails?.upi) return s + Number(p.paymentSplitDetails.upi);
      return s;
    }, 0);
    const card = paid.filter(p => p.paymentMethod === 'card').reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);
    const srcStats = {};
    paid.forEach(p => { const s = p.source || 'Walk-in'; srcStats[s] = (srcStats[s] || 0) + (Number(p.paymentAmount) || 0); });
    const topChannels = Object.entries(srcStats).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { total, txCount: paid.length, cash, upi, card, topChannels };
  }, [doctorHistory]);

  // Picker modal helpers
  const getPickerItems = () => {
    if (pickerType === 'branch') return [{ id: 'all', name: 'All Branches' }, ...branches];
    if (pickerType === 'year') return [
      { id: 'all', name: 'All Years' },
      { id: '2026', name: '2026' }, { id: '2025', name: '2025' },
      { id: '2024', name: '2024' }, { id: '2023', name: '2023' }
    ];
    if (pickerType === 'month') return [
      { id: 'all', name: 'All Months' },
      ...MONTHS.map((m, i) => ({ id: String(i + 1), name: m }))
    ];
    if (pickerType === 'source') return [{ id: 'all', name: 'All Sources' }, ...PATIENT_SOURCES.map(s => ({ id: s, name: s }))];
    if (pickerType === 'method') return [
      { id: 'all', name: 'All Modes' },
      { id: 'cash', name: 'Cash' }, { id: 'upi', name: 'UPI' }, { id: 'card', name: 'Card' },
      { id: 'split', name: 'Split' }, { id: 'phone_link', name: 'Phone Link' }
    ];
    return [];
  };

  const getCurrentVal = (type) => {
    if (type === 'branch') return branchFilter;
    if (type === 'year') return yearFilter;
    if (type === 'month') return monthFilter;
    if (type === 'source') return sourceFilter;
    if (type === 'method') return methodFilter;
    return 'all';
  };

  const getLabel = (type) => {
    if (type === 'branch') return branchFilter === 'all' ? 'All Branches' : (branches.find(b => b.id === branchFilter)?.name || 'Branch');
    if (type === 'year') return yearFilter === 'all' ? 'All Years' : yearFilter;
    if (type === 'month') return monthFilter === 'all' ? 'All Months' : MONTHS[parseInt(monthFilter, 10) - 1];
    if (type === 'source') return sourceFilter === 'all' ? 'All Sources' : sourceFilter;
    if (type === 'method') return methodFilter === 'all' ? 'All Modes' : methodFilter.toUpperCase();
    return '';
  };

  const handlePickerSelect = (id) => {
    if (pickerType === 'branch') setBranchFilter(id);
    else if (pickerType === 'year') { setYearFilter(id); setDateFilter(''); }
    else if (pickerType === 'month') { setMonthFilter(id); setDateFilter(''); if (yearFilter === 'all') setYearFilter(new Date().getFullYear().toString()); }
    else if (pickerType === 'source') setSourceFilter(id);
    else if (pickerType === 'method') setMethodFilter(id);
    setPickerVisible(false);
  };

  const hasFilters = searchQuery || branchFilter !== 'all' || dateFilter ||
    yearFilter !== 'all' || monthFilter !== 'all' || sourceFilter !== 'all' || methodFilter !== 'all';

  const formatDate = (p) => {
    const d = getDateFromPatient(p);
    if (d && !isNaN(d.getTime())) return d.toLocaleDateString('en-IN');
    return p.appointmentDate || 'N/A';
  };

  const renderItem = ({ item }) => (
    <Surface style={st.card}>
      <View style={st.cardTop}>
        <View style={st.avatarWrap}>
          <View style={st.avatar}><User size={18} color={COLORS.secondary} /></View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginRight: 8 }}>
              <Text style={[st.patientName, { flexShrink: 1 }]} numberOfLines={1}>{item.fullName || 'Unknown'}</Text>
              {(item.isOnline || item.source === 'appointments' || item._type === 'online' || item.source === 'UserApp' || item.source === 'Patient App' || item.raw?.source === 'appointments' || item.raw?.source === 'UserApp' || item.raw?.source === 'Patient App') && (
                <View style={{
                  backgroundColor: '#f5f3ff',
                  borderColor: '#ddd6fe',
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                }}>
                  <Text style={{
                    color: '#7c3aed',
                    fontSize: 7,
                    fontWeight: '800',
                    letterSpacing: 0.3
                  }}>APP</Text>
                </View>
              )}
              {item.packageId && (
                <View style={{
                  backgroundColor: '#ecfdf5',
                  borderColor: '#a7f3d0',
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                }}>
                  <Text style={{
                    color: '#059669',
                    fontSize: 7,
                    fontWeight: '800',
                    letterSpacing: 0.3
                  }}>PKG</Text>
                </View>
              )}
            </View>
            <Text style={st.patientPhone}>{item.phone || 'No Phone'}</Text>
          </View>
        </View>
        <View style={[st.statusBadge, { backgroundColor: item.paymentStatus === 'paid' ? '#ecfdf5' : '#f1f5f9' }]}>
          <Text style={[st.statusText, { color: item.paymentStatus === 'paid' ? COLORS.success : COLORS.muted }]}>
            {item.paymentStatus === 'paid' ? `₹${item.paymentAmount || 0}` : 'UNPAID'}
          </Text>
        </View>
      </View>
      <View style={st.divider} />
      <View style={{ gap: 4 }}>
        <View style={st.detailRow}>
          <Calendar size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
          <Text style={st.detailLabel}>Date: </Text>
          <Text style={st.detailVal}>{formatDate(item)}</Text>
        </View>
        {item.registrationId ? (
          <View style={st.detailRow}>
            <FileText size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
            <Text style={st.detailLabel}>Reg ID: </Text>
            <Text style={[st.detailVal, { color: COLORS.secondary }]}>{item.registrationId}</Text>
          </View>
        ) : null}
        {(item.subject || item.complaint) ? (
          <View style={st.detailRow}>
            <Text style={st.detailLabel}>Complaint: </Text>
            <Text style={[st.detailVal, { flex: 1 }]} numberOfLines={2}>{item.subject || item.complaint}</Text>
          </View>
        ) : null}
        {item.prescriptionNotes ? (
          <View style={st.notesBox}>
            <Text style={st.notesLabel}>Prescription Notes</Text>
            <Text style={st.notesText} numberOfLines={3}>{item.prescriptionNotes}</Text>
          </View>
        ) : null}
      </View>
    </Surface>
  );

  const ListHeader = () => (
    <View>
      {/* ── REVENUE STATS ── */}
      <View style={st.statsRow}>
        {/* Total Revenue */}
        <Surface style={[st.statCard, { borderLeftColor: COLORS.primary }]}>
          <Text style={st.statLabel}>Total Revenue</Text>
          <Text style={[st.statVal, { color: COLORS.primary }]}>₹{revStats.total.toLocaleString('en-IN')}</Text>
          <Text style={st.statSub}>{revStats.txCount} Transactions</Text>
        </Surface>

        {/* By Mode */}
        <Surface style={[st.statCard, { borderLeftColor: COLORS.warning }]}>
          <Text style={st.statLabel}>By Mode</Text>
          <View style={{ gap: 3, marginTop: 4 }}>
            <View style={st.modeRow}><Text style={st.modeLabel}>Cash</Text><Text style={[st.modeVal, { color: COLORS.warning }]}>₹{revStats.cash}</Text></View>
            <View style={st.modeRow}><Text style={st.modeLabel}>UPI</Text><Text style={[st.modeVal, { color: COLORS.secondary }]}>₹{revStats.upi}</Text></View>
            <View style={st.modeRow}><Text style={st.modeLabel}>Card</Text><Text style={[st.modeVal, { color: COLORS.success }]}>₹{revStats.card}</Text></View>
          </View>
        </Surface>
      </View>

      {/* By Channel */}
      <Surface style={[st.statCardFull, { borderLeftColor: COLORS.purple }]}>
        <Text style={st.statLabel}>By Channel (Top 4)</Text>
        {revStats.topChannels.length === 0 ? (
          <Text style={{ fontSize: 11, color: COLORS.muted, fontStyle: 'italic', marginTop: 4 }}>No paid transactions</Text>
        ) : (
          <View style={{ gap: 3, marginTop: 4 }}>
            {revStats.topChannels.map(([src, amt]) => (
              <View key={src} style={st.modeRow}>
                <Text style={st.modeLabel}>{src}</Text>
                <Text style={[st.modeVal, { color: COLORS.purple }]}>₹{amt}</Text>
              </View>
            ))}
          </View>
        )}
      </Surface>

      {/* ── SEARCH ── */}
      <Surface style={st.searchBox}>
        <Search size={16} color={COLORS.muted} style={{ marginLeft: 10 }} />
        <TextInput
          style={st.searchInput}
          placeholder="Search Patient — Name or phone..."
          placeholderTextColor={COLORS.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 10 }}>
            <X size={16} color={COLORS.muted} />
          </TouchableOpacity>
        ) : null}
      </Surface>

      {/* ── FILTERS GRID ── */}
      <View style={st.filtersGrid}>
        {[
          { type: 'branch', label: 'Filter Branch' },
          { type: 'source', label: 'Patient Source' },
          { type: 'year', label: 'Filter by Year' },
          { type: 'month', label: 'Filter by Month' },
          { type: 'method', label: 'Payment Mode' },
        ].map(({ type, label }) => (
          <TouchableOpacity key={type} style={st.filterBtn} onPress={() => { setPickerType(type); setPickerVisible(true); }}>
            <View style={{ flex: 1 }}>
              <Text style={st.filterBtnLabel}>{label}</Text>
              <Text style={st.filterBtnVal} numberOfLines={1}>{getLabel(type)}</Text>
            </View>
            <ChevronDown size={14} color={COLORS.muted} />
          </TouchableOpacity>
        ))}

        {/* Date filter */}
        <TouchableOpacity style={st.filterBtn} onPress={() => {
          setRawDateInput(dateFilter ? dateFilter.split('-').reverse().join('/') : '');
          setPickerType('date');
          setPickerVisible(true);
        }}>
          <View style={{ flex: 1 }}>
            <Text style={st.filterBtnLabel}>Filter by Date</Text>
            <Text style={st.filterBtnVal} numberOfLines={1}>
              {dateFilter ? dateFilter.split('-').reverse().join('/') : 'Select Date'}
            </Text>
          </View>
          <Calendar size={14} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      {/* Reset + count row */}
      <View style={st.resetRow}>
        <TouchableOpacity style={st.resetBtn} onPress={handleResetFilters}>
          <RotateCcw size={14} color={COLORS.white} style={{ marginRight: 6 }} />
          <Text style={st.resetBtnText}>Reset</Text>
        </TouchableOpacity>
        <View style={st.countBadge}>
          <Text style={st.countText}>{doctorHistory.length} records</Text>
        </View>
      </View>

      <Text style={st.sectionTitle}>Consultations</Text>
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null} style={st.backBtn}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Consultation History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={{ marginTop: 12, color: COLORS.muted }}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={doctorHistory}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={st.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.emptyCard}>
              <FileText size={40} color={COLORS.muted} />
              <Text style={st.emptyText}>No consultations found</Text>
              <Text style={st.emptySub}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}

      {/* Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>
                {pickerType === 'branch' ? 'Filter Branch' : pickerType === 'year' ? 'Filter by Year' :
                  pickerType === 'month' ? 'Filter by Month' : pickerType === 'source' ? 'Patient Source' :
                    pickerType === 'date' ? 'Filter by Date (DD/MM/YYYY)' : 'Payment Mode'}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {pickerType === 'date' ? (
              <View style={{ paddingBottom: 20 }}>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 16, color: COLORS.text, marginBottom: 12 }}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={rawDateInput}
                  onChangeText={setRawDateInput}
                />
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.secondary, borderRadius: 10, padding: 14, alignItems: 'center' }}
                  onPress={() => {
                    const parts = rawDateInput.split('/');
                    if (parts.length === 3 && parts[2].length === 4) {
                      const [d, m, y] = parts;
                      setDateFilter(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
                      setYearFilter('all'); setMonthFilter('all');
                    }
                    setPickerVisible(false);
                  }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Apply Date</Text>
                </TouchableOpacity>
                {dateFilter ? (
                  <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => { setDateFilter(''); setPickerVisible(false); }}>
                    <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 13 }}>Clear Date Filter</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <FlatList
                data={getPickerItems()}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const selected = getCurrentVal(pickerType) === item.id;
                  return (
                    <TouchableOpacity style={st.pickerItem} onPress={() => handlePickerSelect(item.id)}>
                      <Text style={[st.pickerItemText, selected && { color: COLORS.secondary, fontWeight: '700' }]}>{item.name}</Text>
                      {selected ? <CheckCircle2 size={18} color={COLORS.secondary} /> : <Circle size={18} color={COLORS.border} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 40 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.white, elevation: 2, borderLeftWidth: 4 },
  statCardFull: { padding: 14, borderRadius: 14, backgroundColor: COLORS.white, elevation: 2, borderLeftWidth: 4, marginBottom: 10 },
  statLabel: { fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  statVal: { fontSize: 20, fontWeight: '900', marginVertical: 4 },
  statSub: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeLabel: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  modeVal: { fontSize: 11, fontWeight: '800' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, height: 44, marginBottom: 10, elevation: 1 },
  searchInput: { flex: 1, height: '100%', paddingHorizontal: 10, fontSize: 13, color: COLORS.text },

  // Filters
  filtersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterBtn: { width: '47%', height: 52, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  filterBtnLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '600' },
  filterBtnVal: { fontSize: 12, color: COLORS.text, fontWeight: '700', marginTop: 1 },

  // Reset row
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  resetBtn: { backgroundColor: COLORS.danger, borderRadius: 10, height: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', elevation: 1 },
  resetBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  countBadge: { backgroundColor: COLORS.secondary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.secondary + '30' },
  countText: { fontSize: 12, color: COLORS.secondary, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Patient cards
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.secondary + '15', justifyContent: 'center', alignItems: 'center' },
  patientName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  patientPhone: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  detailLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  detailVal: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  notesBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginTop: 6, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
  notesLabel: { fontSize: 9, fontWeight: '800', color: COLORS.muted, marginBottom: 3, textTransform: 'uppercase' },
  notesText: { fontSize: 12, color: COLORS.text, lineHeight: 17 },

  // Empty state
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 15, fontWeight: '700', color: COLORS.text },
  emptySub: { marginTop: 4, fontSize: 13, color: COLORS.muted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  pickerItemText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
});

export default DoctorConsultationHistory;
