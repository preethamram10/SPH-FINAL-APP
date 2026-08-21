import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { Text, Surface, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Calendar, FileText, CheckCircle, XCircle, Clock, Percent } from 'lucide-react-native';
import { createNotification, notifyAllReceptionists } from '../../utils/notificationService';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

const FeeDiscounts = ({ navigation }) => {
  const { userData } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    setLoading(true);
    let pats = [];
    let appts = [];

    const updateCombined = () => {
      const combined = [];
      const seenIds = new Set();

      pats.forEach(p => {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          combined.push(p);
        }
      });

      appts.forEach(a => {
        if (!seenIds.has(a.id)) {
          seenIds.add(a.id);
          combined.push(a);
        }
      });

      // Sort by updatedAt descending
      combined.sort((a, b) => {
        const timeA = (a.updatedAt && typeof a.updatedAt.toDate === 'function') ? a.updatedAt.toDate() : (a.updatedAt ? new Date(a.updatedAt) : 0);
        const timeB = (b.updatedAt && typeof b.updatedAt.toDate === 'function') ? b.updatedAt.toDate() : (b.updatedAt ? new Date(b.updatedAt) : 0);
        return timeB - timeA;
      });

      setRequests(combined);
      setLoading(false);
    };

    const qPatients = query(collection(db, 'allpatients'), where('medicineDiscountStatus', 'in', ['pending', 'approved', 'rejected']));
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          firestoreCollection: 'allpatients',
          ...data
        });
      });
      pats = list;
      updateCombined();
    }, (error) => {
      console.error('Error fetching patient discounts in mobile:', error);
      setLoading(false);
    });

    const qAppts = query(collection(db, 'appointments'), where('medicineDiscountStatus', 'in', ['pending', 'approved', 'rejected']));
    const unsubscribeAppts = onSnapshot(qAppts, (appSnap) => {
      const list = [];
      appSnap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          firestoreCollection: 'appointments',
          ...data
        });
      });
      appts = list;
      updateCombined();
    }, (error) => {
      console.error('Error fetching appointment discounts in mobile:', error);
    });

    return () => {
      unsubscribePatients();
      unsubscribeAppts();
    };
  }, []);

  const handleStatusUpdate = async (item, newStatus) => {
    try {
      const docRef = doc(db, item.firestoreCollection || 'allpatients', item.id);
      const isConsult = item.medicineDiscountType === 'consultation';

      if (newStatus === 'approved') {
        await updateDoc(docRef, {
          ...(isConsult ? { consultationFee: Number(item.medicineDiscountRequested) } : { medicineFeeRequested: Number(item.medicineDiscountRequested) }),
          medicineDiscountStatus: 'approved',
          updatedAt: new Date()
        });
      } else {
        await updateDoc(docRef, {
          medicineDiscountStatus: 'rejected',
          updatedAt: new Date()
        });
      }

      const typeLabel = isConsult ? 'Consultation' : 'Medicine';
      const notifTitle = newStatus === 'approved' ? `✓ ${typeLabel} Discount Approved` : `✕ ${typeLabel} Discount Rejected`;
      const notifBody = newStatus === 'approved'
        ? `${typeLabel} discount request for ${item.fullName || 'Patient'} was approved! New Amount: ₹${item.medicineDiscountRequested}.`
        : `${typeLabel} discount request for ${item.fullName || 'Patient'} was rejected. Fee remains ₹${item.medicineDiscountOriginal || (isConsult ? item.consultationFee : item.medicineFeeRequested)}.`;

      if (item.medicineDiscountRequestedBy) {
        await createNotification(item.medicineDiscountRequestedBy, notifTitle, notifBody, `medicine_discount_${newStatus}`, { patientId: item.id });
      } else {
        await notifyAllReceptionists(notifTitle, notifBody, `medicine_discount_${newStatus}`, { patientId: item.id });
      }

      Alert.alert('Success', `Discount request ${newStatus} successfully.`);
    } catch (error) {
      console.error('Error updating discount status:', error);
      Alert.alert('Error', 'Failed to update discount status.');
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending') {
      return r.medicineDiscountStatus === 'pending';
    } else {
      return r.medicineDiscountStatus === 'approved' || r.medicineDiscountStatus === 'rejected';
    }
  });

  const renderRequestItem = ({ item }) => {
    const isConsult = item.medicineDiscountType === 'consultation';
    const originalFee = item.medicineDiscountOriginal || (isConsult ? item.consultationFee : item.medicineFeeRequested) || 0;
    const requestedFee = item.medicineDiscountRequested || 0;
    const discountAmount = Math.max(0, originalFee - requestedFee);

    return (
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{item.fullName || 'Unknown Patient'}</Text>
            <Text style={styles.metaText}>Branch: {item.branchName || 'N/A'}</Text>
            <Text style={styles.metaText}>Doctor: {item.doctor || 'N/A'}</Text>
          </View>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              item.medicineDiscountStatus === 'pending'
                ? styles.chipPending
                : item.medicineDiscountStatus === 'approved'
                ? styles.chipApproved
                : styles.chipRejected,
            ]}
            textStyle={styles.chipText}
          >
            {item.medicineDiscountStatus?.toUpperCase()}
          </Chip>
        </View>

        <View style={styles.typeBadgeContainer}>
          <Text style={[styles.typeBadgeText, isConsult ? styles.badgeConsult : styles.badgeMedicine]}>
            {isConsult ? 'Consultation Fee Discount' : 'Medicine Fee Discount'}
          </Text>
        </View>

        <View style={styles.feeBreakdown}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Original Fee:</Text>
            <Text style={[styles.feeVal, styles.originalVal]}>₹{originalFee}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Proposed Fee:</Text>
            <Text style={[styles.feeVal, styles.proposedVal]}>₹{requestedFee}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Discount Amount:</Text>
            <Text style={[styles.feeVal, styles.discountVal]}>- ₹{discountAmount}</Text>
          </View>
        </View>

        {item.medicineDiscountNote ? (
          <View style={styles.noteContainer}>
            <FileText size={14} color={COLORS.muted} style={{ marginRight: 4, marginTop: 1 }} />
            <Text style={styles.noteText}>Reason: "{item.medicineDiscountNote}"</Text>
          </View>
        ) : null}

        {item.medicineDiscountStatus === 'pending' && (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={() => handleStatusUpdate(item, 'rejected')}
              textColor={COLORS.danger}
              style={[styles.btn, styles.btnReject]}
              contentStyle={styles.btnContent}
              icon={() => <XCircle size={16} color={COLORS.danger} />}
            >
              Reject
            </Button>
            <Button
              mode="contained"
              onPress={() => handleStatusUpdate(item, 'approved')}
              style={[styles.btn, styles.btnApprove]}
              contentStyle={styles.btnContent}
              icon={() => <CheckCircle size={16} color="#fff" />}
            >
              Approve
            </Button>
          </View>
        )}
      </Surface>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            Keyboard.dismiss();
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTab');
            }
          }} 
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fee Discount Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Percent size={48} color={COLORS.muted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No discount requests found.</Text>
            </View>
          }
        />
      )}
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
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.secondary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  activeTabText: { color: COLORS.secondary },
  list: { padding: 16 },
  card: { padding: 16, borderRadius: 12, backgroundColor: COLORS.white, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  patientName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  metaText: { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  statusChip: { borderRadius: 8, height: 26, justifyContent: 'center' },
  chipText: { fontSize: 10, fontWeight: '800' },
  chipPending: { backgroundColor: '#fffbeb' },
  chipApproved: { backgroundColor: '#ecfdf5' },
  chipRejected: { backgroundColor: '#fdf2f8' },
  typeBadgeContainer: { marginBottom: 12 },
  typeBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  badgeConsult: { color: COLORS.secondary, backgroundColor: '#eff6ff' },
  badgeMedicine: { color: '#8b5cf6', backgroundColor: '#faf5ff' },
  feeBreakdown: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, gap: 6, marginBottom: 12 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 12, color: COLORS.muted },
  feeVal: { fontSize: 13, fontWeight: '700' },
  originalVal: { textDecorationLine: 'line-through', color: COLORS.muted },
  proposedVal: { color: COLORS.success, fontSize: 14, fontWeight: '800' },
  discountVal: { color: COLORS.danger },
  noteContainer: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, marginBottom: 14 },
  noteText: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', flex: 1, lineHeight: 16 },
  actionButtons: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  btn: { flex: 1, borderRadius: 8 },
  btnReject: { borderColor: COLORS.danger },
  btnApprove: { backgroundColor: COLORS.success },
  btnContent: { height: 38 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },
});

export default FeeDiscounts;
