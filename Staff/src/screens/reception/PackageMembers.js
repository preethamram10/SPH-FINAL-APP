import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList, TextInput, Text } from 'react-native';
import { Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Package, User, Phone, Calendar, Search, Plus, CreditCard, X, ArrowUpRight, DollarSign, CalendarDays } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
  primary: '#a8ce3a',      // Lime Green
  secondary: '#258ec8',    // Soft Blue
  success: '#10b981',      // Success Green
  warning: '#f59e0b',      // Pending Amber
  danger: '#ef4444',       // Danger Red
  text: '#0f172a',         // Deep slate text
  muted: '#64748b',        // Muted grey
  background: '#f8fafc',   // Off-white background
  white: '#ffffff',
  border: '#e2e8f0',       // Border line grey
};
const PackageMembers = () => {
  const { userData } = useAuth();
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
  // Date Picker States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 3))); // Default 3 months
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  // Patient autocomplete states
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

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
  }, []);

  const handleLiveSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredMembers(packageMembers);
      return;
    }
    const queryLower = text.toLowerCase();
    const filtered = packageMembers.filter(member =>
      member.patientName?.toLowerCase().includes(queryLower) ||
      member.patientMobile?.includes(queryLower)
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
      const q = query(collection(db, 'patients'));
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

  const handleSaveMember = async () => {
    if (!patientName.trim() || !patientMobile.trim() || !totalAmount.trim()) {
      Alert.alert('Error', 'Please fill in patient name, phone, and total amount.');
      return;
    }

    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const balance = total - paid;

    if (paid > total) {
      Alert.alert('Error', 'Paid amount cannot exceed total package amount.');
      return;
    }

    try {
      await addDoc(collection(db, 'package_members'), {
        patientId: selectedPatientId || '',
        patientName: patientName.trim(),
        patientMobile: patientMobile.trim(),
        packageName: 'Standard Homeopathy Package',
        totalAmount: total,
        paidAmount: paid,
        balanceAmount: balance,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        status: 'active',
        branchId: userData?.branchId || 'Unknown',
        branchName: userData?.branchName || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'doctor',
        createdByName: userData?.name || 'Doctor'
      });

      // Clear states
      setPatientName('');
      setPatientMobile('');
      setTotalAmount('');
      setPaidAmount('0');
      setSelectedPatientId(null);
      setStartDate(new Date());
      setEndDate(new Date(new Date().setMonth(new Date().getMonth() + 3)));
      setModalVisible(false);

      Alert.alert('Success', 'Package member added successfully!');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save package membership.');
    }
  };

  const isPackageActive = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= startDateStr && today <= endDateStr;
  };

  const renderMemberCard = ({ item }) => {
    const isActive = isPackageActive(item.startDate, item.endDate);
    const initials = item.patientName
      ? item.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'P';

    return (
      <View style={styles.memberCard}>
        <View style={styles.cardHeader}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.secondary + '15',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLORS.secondary, fontWeight: '800', fontSize: 12 }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.patientNameText}>{item.patientName}</Text>
              <View
                style={{
                  backgroundColor: isActive ? COLORS.success + '15' : COLORS.danger + '15',
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: isActive ? COLORS.success + '30' : COLORS.danger + '30',
                }}
              >
                <Text style={{ color: isActive ? COLORS.success : COLORS.danger, fontSize: 9, fontWeight: '800' }}>
                  {isActive ? 'ACTIVE' : 'EXPIRED'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Phone size={10} color={COLORS.muted} style={{ marginRight: 4 }} />
              <Text style={styles.patientInfoText}>{item.patientMobile}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.packageDetailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{item.startDate} to {item.endDate}</Text>
          </View>
        </View>

        <View style={styles.amountsGrid}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountVal}>₹{item.totalAmount}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={[styles.amountVal, { color: COLORS.success }]}>₹{item.paidAmount}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Balance</Text>
            <Text style={[styles.amountVal, { color: item.balanceAmount > 0 ? COLORS.danger : COLORS.success }]}>
              ₹{item.balanceAmount}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Package Members 📦</Text>
          <Text style={styles.headerSubtitle}>Homeopathy Subscriptions & Installments</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={18} color="white" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{stats.totalMembers}</Text>
          <Text style={styles.statLabel}>Total Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: COLORS.success }]}>₹{stats.totalPaid}</Text>
          <Text style={styles.statLabel}>Total Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: COLORS.danger }]}>₹{stats.totalPending}</Text>
          <Text style={styles.statLabel}>Total Pending</Text>
        </View>
      </View>

      {/* Searchbar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
          <Search size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search member name, phone or package..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleLiveSearch}
            style={styles.searchFieldInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleLiveSearch('')}>
              <X size={16} color="#64748b" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 40 }} />
        ) : filteredMembers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={44} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No package members found.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={item => item.id}
            renderItem={renderMemberCard}
            contentContainerStyle={styles.contentScroll}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add Member Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Package Member</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Search Patient autocomplete */}
              <Text style={styles.fieldLabel}>Search Existing Patient (Optional)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Type 3 letters of patient name..."
                value={patientSearch}
                onChangeText={searchPatients}
              />

              {patientSearchResults.length > 0 && (
                <View style={styles.autocompleteBox}>
                  {patientSearchResults.map((p) => (
                    <TouchableOpacity key={p.id} style={styles.autocompleteItem} onPress={() => handleSelectPatient(p)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        <Text style={{ fontWeight: '600', fontSize: 13, color: COLORS.text }}>{p.fullName}</Text>
                        {(p.source === 'appointments' || p._type === 'online' || p.source === 'UserApp') && (
                          <View style={{
                            backgroundColor: '#f5f3ff',
                            borderColor: '#ddd6fe',
                            borderWidth: 1,
                            borderRadius: 6,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          }}>
                            <Text style={{ color: '#7c3aed', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>APP</Text>
                          </View>
                        )}
                        {p.packageId && (
                          <View style={{
                            backgroundColor: '#ecfdf5',
                            borderColor: '#a7f3d0',
                            borderWidth: 1,
                            borderRadius: 6,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          }}>
                            <Text style={{ color: '#059669', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>PKG</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{p.phone} • {p.age} yrs</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Patient Name *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter patient full name"
                value={patientName}
                onChangeText={setPatientName}
              />

              <Text style={styles.fieldLabel}>Patient Mobile (Phone) *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter patient phone number"
                keyboardType="phone-pad"
                value={patientMobile}
                onChangeText={setPatientMobile}
              />

              <Text style={styles.fieldLabel}>Total Amount (₹) *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Total package cost"
                keyboardType="numeric"
                value={totalAmount}
                onChangeText={setTotalAmount}
              />

              <Text style={styles.fieldLabel}>Advance Paid (₹)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Initial advance amount paid"
                keyboardType="numeric"
                value={paidAmount}
                onChangeText={setPaidAmount}
              />

              {/* Start & End Dates */}
              <Text style={styles.fieldLabel}>Package Duration</Text>
              <View style={styles.durationRow}>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowStartPicker(true)}>
                  <CalendarDays size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                  <View>
                    <Text style={styles.dateLabel}>Start Date</Text>
                    <Text style={styles.dateValText}>{startDate.toISOString().split('T')[0]}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(true)}>
                  <CalendarDays size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                  <View>
                    <Text style={styles.dateLabel}>End Date</Text>
                    <Text style={styles.dateValText}>{endDate.toISOString().split('T')[0]}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onValueChange={(event, selectedDate) => {
                    setShowStartPicker(false);
                    if (selectedDate) setStartDate(selectedDate);
                  }}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onValueChange={(event, selectedDate) => {
                    setShowEndPicker(false);
                    if (selectedDate) setEndDate(selectedDate);
                  }}
                />
              )}

              <Button
                mode="contained"
                buttonColor={COLORS.secondary}
                textColor="white"
                onPress={handleSaveMember}
                style={styles.saveBtn}
              >
                Add Member to Package
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  addBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    elevation: 2,
    alignItems: 'center',
  },
  statVal: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },

  // Searchbar
  searchContainer: { paddingHorizontal: 16, marginTop: 12 },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: COLORS.white,
    height: 40,
    paddingHorizontal: 12,
  },
  searchFieldInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    height: '100%',
  },

  contentScroll: { padding: 16, paddingBottom: 100 },
  memberCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  patientNameText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  patientInfoText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  packageDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  detailItem: { flex: 1, marginRight: 8 },
  detailLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 2 },

  amountsGrid: { flexDirection: 'row', gap: 8, backgroundColor: '#f8fafc', padding: 8, borderRadius: 12 },
  amountBox: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 8, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  amountVal: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginTop: 2 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  inputField: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  durationRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dateSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  dateLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700' },
  dateValText: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  saveBtn: { marginTop: 20, borderRadius: 10, paddingVertical: 4 },

  autocompleteBox: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
    elevation: 2,
  },
  autocompleteItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  }
});

export default PackageMembers;