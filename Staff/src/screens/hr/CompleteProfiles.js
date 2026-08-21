import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Keyboard } from 'react-native';
import { Text, Surface, Searchbar, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ChevronLeft, User, Phone, Plus, Edit2, Trash2, Calendar, Building, Mail, Search } from 'lucide-react-native';

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
  danger: '#ef4444'
};

const CompleteProfiles = ({ navigation }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (['doctor', 'receptionist', 'staff', 'hr'].includes(d.role)) {
          data.push({ id: doc.id, ...d, status: d.status || 'active' });
        }
      });
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    // Add focus listener to refetch when coming back from AddStaff
    const unsubscribe = navigation.addListener('focus', () => {
      fetchEmployees();
    });
    return unsubscribe;
  }, [navigation]);

  const updateStatus = async (staffId, newStatus) => {
    try {
      const userRef = doc(db, 'users', staffId);
      await updateDoc(userRef, { status: newStatus });
      Alert.alert('Success', `Staff status changed to ${newStatus}.`);
      fetchEmployees();
    } catch (e) {
      console.error('Error updating status:', e);
      Alert.alert('Error', 'Failed to update staff status.');
    }
  };

  const confirmDelete = (employee) => {
    Alert.alert(
      'Change Status',
      `Change status for ${employee.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Activate', onPress: () => updateStatus(employee.id, 'active') },
        { text: 'Suspend', onPress: () => updateStatus(employee.id, 'inactive') },
        { text: 'Delete', style: 'destructive', onPress: () => updateStatus(employee.id, 'deleted') },
      ]
    );
  };

  const formatJoiningDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      let d;
      if (dateVal.toDate && typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal.seconds) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        d = new Date(dateVal);
      }
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    } catch (e) {
      return 'N/A';
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.phone?.includes(searchQuery);
    const matchesStatus = emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderStaffCard = ({ item }) => {
    const isDoctor = item.role === 'doctor';
    const isReceptionist = item.role === 'receptionist';
    const isHR = item.role === 'hr';

    let roleColor = '#3b82f6'; // Blue for staff
    let roleBg = '#eff6ff';
    if (isDoctor) {
      roleColor = '#10b981'; // Green
      roleBg = '#f0fdf4';
    } else if (isReceptionist) {
      roleColor = '#ec4899'; // Pink
      roleBg = '#fdf2f8';
    } else if (isHR) {
      roleColor = '#f59e0b'; // Orange
      roleBg = '#fffbeb';
    }

    const joiningDate = formatJoiningDate(item.createdAt);

    return (
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: roleBg, borderColor: roleColor + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {item.name ? item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'S'}
            </Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.staffName}>{item.name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: roleBg }]}>
                <Text style={[styles.badgeText, { color: roleColor }]}>
                  {item.role === 'doctor' ? `${item.doctorType === 'head' ? 'Head ' : 'Employee '}Doctor` : item.role.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: item.status === 'active' ? '#eff6ff' : '#fff1f2' }]}>
                <Text style={[styles.badgeText, { color: item.status === 'active' ? '#3b82f6' : '#ef4444' }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Phone size={13} color={COLORS.muted} style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.phone}</Text>
          </View>
          {item.email ? (
            <View style={styles.detailRow}>
              <Mail size={13} color={COLORS.muted} style={styles.detailIcon} />
              <Text style={styles.detailText}>{item.email}</Text>
            </View>
          ) : null}
          {item.branchName ? (
            <View style={styles.detailRow}>
              <Building size={13} color={COLORS.muted} style={styles.detailIcon} />
              <Text style={styles.detailText}>{item.branchName}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Calendar size={13} color={COLORS.muted} style={styles.detailIcon} />
            <Text style={styles.detailText}>Joined: {joiningDate}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}
            onPress={() => navigation.navigate('EmployeeDetails', {
              employeeId: item.id,
              employeeName: item.name,
              employeeRole: item.role,
              employeePhone: item.phone
            })}
          >
            <User size={13} color={COLORS.secondary} />
            <Text style={[styles.actionBtnText, { color: COLORS.secondary }]}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}
            onPress={() => navigation.navigate('AddStaff', { editEmployeeId: item.id })}
          >
            <Edit2 size={13} color="#d97706" />
            <Text style={[styles.actionBtnText, { color: '#d97706' }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' }]}
            onPress={() => confirmDelete(item)}
          >
            <Trash2 size={13} color="#ef4444" />
            <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Status</Text>
          </TouchableOpacity>
        </View>
      </Surface>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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
        <Text style={styles.headerTitle}>Staff Management</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddStaff')} style={styles.addBtn}>
          <Plus size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.secondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search name, phone, or role..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchInput}
            placeholderTextColor={COLORS.muted}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {['active', 'inactive', 'deleted'].map(status => {
            const label = status === 'active' ? 'Active' : status === 'inactive' ? 'Suspended' : 'Deleted';
            const count = employees.filter(emp => emp.status === status).length;
            const isActive = statusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.secondary} size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredEmployees}
            renderItem={renderStaffCard}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.muted }}>No employees found.</Text>
              </View>
            }
          />
        )}
      </View>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.white,
    elevation: 1,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  filterTabText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  filterTabTextActive: { color: COLORS.secondary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 30 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  headerTextContainer: { flex: 1, gap: 4 },
  staffName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  cardDetails: { gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { opacity: 0.6 },
  detailText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' }
});

export default CompleteProfiles;