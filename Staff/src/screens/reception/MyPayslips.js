import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Surface, ActivityIndicator, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, IndianRupee, Calendar, Clipboard } from 'lucide-react-native';
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};
const MyPayslips = ({ navigation }) => {
  const { userData } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchMyPayslips = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'salaries'),
        where('staffId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      // Sort by date/processed time
      data.sort((a, b) => {
        const timeA = a.processedAt?.toDate?.() || new Date(a.amountDate || 0);
        const timeB = b.processedAt?.toDate?.() || new Date(b.amountDate || 0);
        return timeB - timeA;
      });

      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPayslips();
  }, []);

  const renderPayslip = ({ item }) => (
    <Surface style={styles.payslipCard}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color={COLORS.secondary} />
          <Text style={styles.dateText}>{item.month} {item.year}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status?.toUpperCase() || 'PAID'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Base Salary</Text>
          <Text style={styles.detailValue}>₹{item.amount}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Bonus</Text>
          <Text style={[styles.detailValue, { color: '#10b981' }]}>+₹{item.bonus || 0}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Deductions</Text>
          <Text style={[styles.detailValue, { color: '#ef4444' }]}>-₹{item.deductions || 0}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.netSalaryRow}>
        <Text style={styles.netSalaryLabel}>Net Payout</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IndianRupee size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
          <Text style={styles.netSalaryValue}>{item.netSalary}</Text>
        </View>
      </View>

      {item.notes ? (
        <View style={styles.notesBox}>
          <Clipboard size={14} color={COLORS.muted} style={{ marginTop: 2, marginRight: 6 }} />
          <Text style={styles.notesText}>{item.notes}</Text>
        </View>
      ) : null}

      <Text style={styles.processedText}>
        Processed on {item.amountDate} {item.salaryTime ? `at ${item.salaryTime}` : ''}
      </Text>
    </Surface>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Payslips</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>Fetching Payslip Records...</Text>
        </View>
      ) : payslips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IndianRupee size={48} color={COLORS.muted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No payslip history found.</Text>
        </View>
      ) : (
        <FlatList
          data={payslips}
          renderItem={renderPayslip}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.muted, fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: COLORS.muted, fontSize: 15, fontWeight: '500' },
  listContent: { padding: 16 },
  payslipCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginBottom: 16,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dateText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ecfdf5'
  },
  statusText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 4 },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  netSalaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  netSalaryLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  netSalaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 10,
    marginTop: 12
  },
  notesText: { fontSize: 12, color: COLORS.text, flex: 1 },
  processedText: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'right',
    marginTop: 12,
    fontStyle: 'italic'
  }
});

export default MyPayslips;
