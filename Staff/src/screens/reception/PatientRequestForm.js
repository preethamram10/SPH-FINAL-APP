import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, FlatList, Modal } from 'react-native';
import { Text, Surface, TextInput, Button, ActivityIndicator, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, limit } from 'firebase/firestore';
import * as LucideIcons from 'lucide-react-native';

const ChevronLeft = LucideIcons.ChevronLeft;
const User = LucideIcons.User;
const Phone = LucideIcons.Phone;
const ClipboardList = LucideIcons.ClipboardList || LucideIcons.Clipboard;
const HelpCircle = LucideIcons.HelpCircle;
const FileText = LucideIcons.FileText;
const CheckCircle2 = LucideIcons.CheckCircle2 || LucideIcons.CheckCircle || LucideIcons.Check;
const Trash2 = LucideIcons.Trash2;
const ArrowRight = LucideIcons.ArrowRight;
const X = LucideIcons.X;
import { useAuth } from '../../context/AuthContext';

const COLORS = {
  primary: '#0ea5e9',      // Premium Soft Blue
  secondary: '#3b82f6',
  success: '#10b981',      // Success Green
  warning: '#f59e0b',      // Pending Amber
  text: '#1e293b',         // Deep slate dark text
  muted: '#64748b',        // Muted grey text
  background: '#f8fafc',   // Off-white background
  white: '#ffffff',
  border: '#e2e8f0',       // Border line grey
  danger: '#ef4444'
};

const PatientRequestForm = ({ navigation }) => {
  const { userData } = useAuth();
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [requestType, setRequestType] = useState('Report Query');
  const [urgency, setUrgency] = useState('Medium');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);

  const requestTypes = ['Report Query', 'Refund Request', 'Medicine Query', 'Booking Callback', 'Feedback', 'Other'];
  const urgencyLevels = ['Low', 'Medium', 'High'];

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

  // Global server-side search across all branches
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
          promises.push(getDocs(query(collection(db, 'allpatients'), where('phone', '==', cleanPhone))));
          promises.push(getDocs(query(collection(db, 'patients'), where('phone', '==', cleanPhone))));
        } else {
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\\uf8ff'), limit(20))));
        }

        const snaps = await Promise.all(promises);
        const results = [];
        snaps.forEach(snap => {
          snap.forEach(docSnap => {
            results.push({ id: docSnap.id, ...docSnap.data() });
          });
        });

        // Deduplicate
        const uniqueResults = [];
        const phones = new Set();
        
        results.forEach(r => {
          const clean = (r.phone || '').replace(/\D/g, '').slice(-10);
          if (clean && !phones.has(clean)) {
            phones.add(clean);
            uniqueResults.push(r);
          }
        });
        setSearchResults(uniqueResults);
      } catch (err) {
        console.error("Error globally searching patients for picker:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchGlobalPatients();
  }, [debouncedSearch, showPatientModal]);

  const selectPatient = (p) => {
    setPatientName(p.fullName || '');
    setPhone(p.phone || '');
    setShowPatientModal(false);
  };

  // Monitor real-time requests for the active branch
  useEffect(() => {
    if (!userData?.branchId) {
      setFetching(false);
      return;
    }

    const q = query(
      collection(db, 'patient_requests'),
      where('branchId', '==', userData.branchId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort in-memory: latest requests first (descending by createdAt)
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      setRequests(list);
      setFetching(false);
    }, (error) => {
      console.error("Error listening to patient requests:", error);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleSubmitRequest = async () => {
    if (!patientName.trim()) {
      Alert.alert('Error', 'Please enter patient name.');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!details.trim()) {
      Alert.alert('Error', 'Please enter request details.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'patient_requests'), {
        patientName: patientName.trim(),
        phone: phone.trim(),
        requestType,
        urgency,
        details: details.trim(),
        branchId: userData?.branchId || 'Unknown',
        branchName: userData?.branchName || 'Unknown',
        status: 'Pending',
        registeredBy: userData?.name || 'Receptionist',
        createdAt: serverTimestamp()
      });

      Alert.alert('Success', 'Patient request submitted successfully!');
      setPatientName('');
      setPhone('');
      setDetails('');
      setRequestType('Report Query');
      setUrgency('Medium');
    } catch (error) {
      console.error("Error saving patient request:", error);
      Alert.alert('Error', 'Failed to submit patient request.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'In-Progress' : currentStatus === 'In-Progress' ? 'Completed' : 'Pending';
    try {
      await updateDoc(doc(db, 'patient_requests', id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error updating request status:", e);
    }
  };

  const handleDeleteRequest = (id) => {
    Alert.alert(
      "Delete Request",
      "Are you sure you want to permanently delete this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'patient_requests', id));
            } catch (e) {
              console.error("Error deleting request:", e);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return COLORS.success;
      case 'In-Progress': return COLORS.primary;
      case 'Pending':
      default: return COLORS.warning;
    }
  };

  const getUrgencyColor = (lvl) => {
    switch (lvl) {
      case 'High': return COLORS.danger;
      case 'Medium': return COLORS.warning;
      case 'Low':
      default: return COLORS.muted;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Request Form</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Form Card */}
        <Surface style={styles.formCard}>
          <Text style={styles.formTitle}>Submit New Request</Text>
          
          <Text style={styles.label}>Patient</Text>
          <TouchableOpacity onPress={() => setShowPatientModal(true)} style={styles.pickerTrigger}>
            <User size={18} color={COLORS.muted} style={{ marginRight: 8 }} />
            <Text style={[styles.pickerTriggerText, !patientName && { color: COLORS.muted }]}>
              {patientName ? `${patientName} (${phone})` : 'Select Patient'}
            </Text>
          </TouchableOpacity>

          <Modal visible={showPatientModal} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.pickerModalContent}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Select Patient</Text>
                  <TouchableOpacity onPress={() => setShowPatientModal(false)}>
                    <X size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="Search by name, phone or reg ID..."
                  placeholderTextColor="#000000"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  mode="outlined"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
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
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    indicatorStyle="black"
                  />
                )}
              </View>
            </View>
          </Modal>

          <Text style={styles.label}>Request Type</Text>
          <View style={styles.chipRow}>
            {requestTypes.map(type => (
              <Chip
                key={type}
                selected={requestType === type}
                onPress={() => setRequestType(type)}
                style={[
                  styles.chip,
                  requestType === type ? { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary } : null
                ]}
                textStyle={[
                  styles.chipText,
                  requestType === type ? { color: COLORS.primary, fontWeight: '700' } : null
                ]}
                mode="outlined"
              >
                {type}
              </Chip>
            ))}
          </View>

          <Text style={styles.label}>Urgency Level</Text>
          <View style={styles.chipRow}>
            {urgencyLevels.map(lvl => (
              <Chip
                key={lvl}
                selected={urgency === lvl}
                onPress={() => setUrgency(lvl)}
                style={[
                  styles.chip,
                  urgency === lvl ? { backgroundColor: getUrgencyColor(lvl) + '15', borderColor: getUrgencyColor(lvl) } : null
                ]}
                textStyle={[
                  styles.chipText,
                  urgency === lvl ? { color: getUrgencyColor(lvl), fontWeight: '700' } : null
                ]}
                mode="outlined"
              >
                {lvl}
              </Chip>
            ))}
          </View>

          <TextInput
            label="Request Details / Notes"
            value={details}
            onChangeText={setDetails}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={[styles.input, { height: 100 }]}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <Button
            mode="contained"
            onPress={handleSubmitRequest}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
            buttonColor={COLORS.secondary}
          >
            Submit Request
          </Button>
        </Surface>

        {/* List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Recent Branch Requests</Text>
          <Text style={styles.listCount}>{requests.length} Total</Text>
        </View>

        {fetching ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : requests.length === 0 ? (
          <Surface style={styles.emptyCard}>
            <ClipboardList size={36} color={COLORS.border} />
            <Text style={styles.emptyText}>No requests logged for this branch yet.</Text>
          </Surface>
        ) : (
          requests.map(item => (
            <Surface key={item.id} style={styles.requestCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardName}>{item.patientName}</Text>
                  <Text style={styles.cardPhone}>{item.phone}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={[styles.badge, { backgroundColor: getUrgencyColor(item.urgency) + '15' }]}>
                    <Text style={[styles.badgeText, { color: getUrgencyColor(item.urgency) }]}>{item.urgency} Urgency</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '15' }]}
                    onPress={() => handleUpdateStatus(item.id, item.status)}
                  >
                    <Text style={[styles.badgeText, { color: getStatusColor(item.status), fontWeight: '700' }]}>{item.status}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTypeLabel}>Type: <Text style={styles.cardTypeValue}>{item.requestType}</Text></Text>
                <Text style={styles.cardDetails}>{item.details}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>
                  Logged by {item.registeredBy} on{' '}
                  {item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('en-GB') : new Date(item.createdAt).toLocaleDateString('en-GB')) : 'Today'}
                </Text>
                <TouchableOpacity onPress={() => handleDeleteRequest(item.id)} style={styles.deleteBtn}>
                  <Trash2 size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </Surface>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  scrollContent: { padding: 16 },
  formCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 3,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: COLORS.white },
  label: { fontSize: 13, color: COLORS.muted, fontWeight: '600', marginTop: 6, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderColor: COLORS.border, borderRadius: 8 },
  chipText: { fontSize: 12, color: COLORS.text },
  submitBtn: { marginTop: 12, paddingVertical: 4, borderRadius: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  listCount: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderStyle: 'dashed'
  },
  emptyText: { fontSize: 13, color: COLORS.muted, marginTop: 8, fontWeight: '500' },
  requestCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    elevation: 2,
    shadowColor: 'rgba(0,0,0,0.02)'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardPhone: { fontSize: 12, color: COLORS.muted, fontWeight: '500', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  cardBody: { paddingVertical: 12 },
  cardTypeLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  cardTypeValue: { color: COLORS.text, fontWeight: '700' },
  cardDetails: { fontSize: 13, color: COLORS.text, marginTop: 6, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  cardDate: { fontSize: 11, color: COLORS.muted },
  deleteBtn: { padding: 4 },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, marginBottom: 12 },
  pickerTriggerText: { fontSize: 15, color: COLORS.text, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '60%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  searchInput: { backgroundColor: COLORS.white },
  patientListItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  patientListName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  patientListPhone: { fontSize: 12, color: COLORS.muted, marginTop: 2 }
});

export default PatientRequestForm;
