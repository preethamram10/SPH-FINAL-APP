import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput as RNTextInput, ScrollView } from 'react-native';
import { Text, Surface, ActivityIndicator, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import {
  ChevronLeft, FileText, User, Phone, Clock,
  CheckCircle2, ClipboardList, ChevronRight, Calendar, Search, X
} from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  success: '#10b981',
  warning: '#f59e0b',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  danger: '#ef4444',
};

const getFilterRowIcon = (filterKey, isActive) => {
  const color = isActive ? '#ffffff' : COLORS.muted;
  const size = 13;
  switch (filterKey) {
    case 'pending': return <Clock size={size} color={color} />;
    case 'completed': return <CheckCircle2 size={size} color={color} />;
    default: return <ClipboardList size={size} color={color} />;
  }
};

const MedicineRequestList = ({ navigation, setActiveTab }) => {
  const { userData } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  useEffect(() => {
    if (!showPatientModal) return;
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const fetchGlobalPatients = async () => {
      setIsSearching(true);
      try {
        const queryText = debouncedSearch.trim();
        const textLower = queryText.toLowerCase();
        const textCapitalized = queryText.charAt(0).toUpperCase() + queryText.slice(1).toLowerCase();
        const textUpper = queryText.toUpperCase();

        const promises = [];
        if (/^\d+$/.test(queryText)) {
          const cleanPhone = queryText.slice(-10);
          promises.push(getDocs(query(collection(db, 'patients'), where('phone', '==', cleanPhone))));
        } else {
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\\uf8ff'), limit(20))));
        }

        const snaps = await Promise.all(promises);
        const results = [];
        const seenIds = new Set();
        snaps.forEach(snap => {
          snap.forEach(docSnap => {
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              results.push({ id: docSnap.id, ...docSnap.data() });
            }
          });
        });
        setSearchResults(results);
      } catch (err) {
        console.error("Error globally searching patients for picker:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchGlobalPatients();
  }, [debouncedSearch, showPatientModal]);

  const selectPatient = (p) => {
    setShowPatientModal(false);
    navigation.navigate('MedicineFormEditor', {
      request: {
        patientId: p.id,
        patientName: p.fullName || '',
        phone: p.phone || '',
        age: p.age || p.patientAge || '',
        gender: p.gender || 'Mr.',
        branchId: p.branchId || userData?.branchId,
        branchName: p.branchName || userData?.branchName
      }
    });
  };

  useEffect(() => {
    if (!userData?.branchId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'medicine_requests'), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const requestBranchId = data.branchId || '';
        const requestBranchName = data.branchName || '';
        const staffBranchId = userData.branchId || '';
        const staffBranchName = userData.branchName || '';

        // Match if request branch matches staff branch (case-insensitive), or if request branch is empty
        const matchesBranch =
          !requestBranchId ||
          requestBranchId.toLowerCase() === staffBranchId.toLowerCase() ||
          (requestBranchName && staffBranchName && requestBranchName.toLowerCase() === staffBranchName.toLowerCase());

        if (matchesBranch && data.medicines && data.medicines.length > 0) {
          list.push({ id: doc.id, ...data });
        }
      });

      // Sort by requestedAt descending (newest first)
      list.sort((a, b) => {
        const tA = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime()
          : (a.requestedAt ? new Date(a.requestedAt).getTime() : 0);
        const tB = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime()
          : (b.requestedAt ? new Date(b.requestedAt).getTime() : 0);
        return tB - tA;
      });

      setRequests(list);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to medicine_requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const filtered = requests.filter(r =>
    activeFilter === 'all' ? true : (r.status || 'pending') === activeFilter
  );

  const pendingCount = requests.filter(r => (r.status || 'pending') === 'pending').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  const formatDate = (ts) => {
    if (!ts) return 'Just now';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'Completed' };
      case 'pending':
      default: return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'Pending' };
    }
  };

  const RequestCard = ({ item }) => {
    const st = getStatusStyle(item.status || 'pending');
    const isCompleted = item.status === 'completed';
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('MedicineFormEditor', { request: item })}
      >
        <Surface
          style={[
            styles.card,
            { borderLeftWidth: 4, borderLeftColor: st.text }
          ]}
        >
          <View style={styles.cardBody}>
            {/* Top row: Name + Status Badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Avatar.Text
                  size={36}
                  label={(item.patientName || 'P').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  style={{ backgroundColor: 'rgba(37, 142, 200, 0.08)' }}
                  labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: 11 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.patientName || 'Patient'}</Text>
                  <View style={styles.infoRow}>
                    <Phone size={11} color={COLORS.muted} />
                    <Text style={styles.infoText}>{item.phone || 'N/A'}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
              </View>
            </View>

            {/* Doctor info */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <User size={12} color={COLORS.muted} />
                <Text style={styles.metaText}>{item.doctorName || 'General Doctor'}</Text>
              </View>
              {item.subject ? (
                <View style={styles.metaItem}>
                  <FileText size={12} color={COLORS.muted} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.subject}</Text>
                </View>
              ) : null}
            </View>

            {/* Bottom Actions Row */}
            <View style={styles.cardFooter}>
              <View style={styles.metaItem}>
                <Clock size={11} color={COLORS.muted} />
                <Text style={styles.dateText}>{formatDate(item.requestedAt)}</Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: isCompleted ? '#f1f5f9' : 'rgba(37, 142, 200, 0.08)',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: isCompleted ? COLORS.muted : COLORS.secondary
                  }}
                >
                  {isCompleted ? 'View Form' : 'Fill Form'}
                </Text>
                <ChevronRight size={12} color={isCompleted ? COLORS.muted : COLORS.secondary} />
              </View>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else if (setActiveTab) {
              setActiveTab('Dashboard');
            }
          }}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Medicine Requests</Text>
          <Text style={styles.headerSub}>Patient-requested medicine forms</Text>
        </View>
      </View>

      {/* Global Search Bar to create new form */}
      <View style={styles.searchBarContainer}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowPatientModal(true)}
          activeOpacity={0.8}
        >
          <Search size={18} color={COLORS.muted} />
          <Text style={styles.searchBarText}>Search any patient to create form...</Text>
        </TouchableOpacity>
      </View>

      {/* Patient Picker Modal */}
      <Modal visible={showPatientModal} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Patient</Text>
              <TouchableOpacity onPress={() => setShowPatientModal(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <RNTextInput
              placeholder="Search by name, phone or reg ID..."
              placeholderTextColor="#000000"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInputModal}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.patientListItem} onPress={() => selectPatient(item)}>
                    <Text style={styles.patientListName}>{item.fullName}</Text>
                    <Text style={styles.patientListPhone}>{item.phone}</Text>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 400, marginTop: 12 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftColor: COLORS.warning, borderLeftWidth: 3 }]}>
          <Text style={[styles.statVal, { color: COLORS.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: '#2563eb', borderLeftWidth: 3 }]}>
          <Text style={[styles.statVal, { color: '#2563eb' }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: COLORS.secondary, borderLeftWidth: 3 }]}>
          <Text style={[styles.statVal, { color: COLORS.secondary }]}>{requests.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filter pills scroll segment */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          {[
            { key: 'pending', label: 'Pending Requests' },
            { key: 'completed', label: 'Completed Forms' },
            { key: 'all', label: 'All Requests' },
          ].map(f => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                {getFilterRowIcon(f.key, isActive)}
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <ClipboardList size={44} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No {activeFilter !== 'all' ? activeFilter : ''} requests</Text>
          <Text style={styles.emptySub}>
            When patients request medicine forms from their app, they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <RequestCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.muted, fontWeight: '500', marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  statBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 9.5, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.3 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, marginBottom: 6 },
  filterChipsContainer: { paddingRight: 16, gap: 8, paddingVertical: 4 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6
  },
  filterPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterPillText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  filterPillTextActive: { color: COLORS.white },

  list: { paddingHorizontal: 16, paddingTop: 8 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardBody: { flex: 1, padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoText: { fontSize: 11.5, color: COLORS.muted, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 11, color: COLORS.muted, fontWeight: '500', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10, marginTop: 4 },
  dateText: { fontSize: 11, color: COLORS.muted, marginLeft: 4 },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  searchBarContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: COLORS.white },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  searchBarText: { fontSize: 14, color: COLORS.muted, marginLeft: 10, fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '60%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  searchInputModal: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14 },
  patientListItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  patientListName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  patientListPhone: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});

export default MedicineRequestList;
