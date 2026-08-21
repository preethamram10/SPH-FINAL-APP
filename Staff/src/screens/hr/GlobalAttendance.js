import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Keyboard, TextInput } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, User, Search, Stethoscope, Briefcase } from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const GlobalAttendance = ({ navigation }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['doctor', 'staff', 'receptionist', 'hr']));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
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
  }, []);

  const employeeDoctors = employees.filter(emp => emp.role === 'doctor' && emp.doctorType === 'employee');
  const allStaff = employees.filter(emp => ['staff', 'receptionist', 'hr'].includes(emp.role) || (emp.role === 'doctor' && emp.doctorType !== 'head' && emp.doctorType !== 'employee'));

  const displayedList = [...employeeDoctors, ...allStaff].filter(emp =>
    emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderEmployeeItem = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('EmployeeDetails', {
          employeeId: item.id,
          employeeName: item.name,
          employeeRole: item.role,
          employeePhone: item.phone
        })}
      >
        <Surface style={styles.logCardCompact}>
          <View style={styles.cardRow}>
            {/* Left: Avatar */}
            <View style={[styles.avatarCompact, { backgroundColor: item.role === 'doctor' ? COLORS.primary + '15' : COLORS.secondary + '15' }]}>
              <User size={14} color={item.role === 'doctor' ? COLORS.primary : COLORS.secondary} />
            </View>

            {/* Middle: Name & Role Badge */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.userNameCompact} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.roleBadgeCompact, { backgroundColor: item.role === 'doctor' ? '#f5f3ff' : '#f0f9ff' }]}>
                  <Text style={[styles.roleTextBadgeCompact, { color: item.role === 'doctor' ? '#7c3aed' : '#0369a1' }]}>
                    {item.role?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '500', marginTop: 1 }}>{item.phone || item.email || 'No Contact'}</Text>
            </View>

            {/* Right: Details Link */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#258ec8' }}>VIEW PROFILE</Text>
              <ChevronRight size={12} color="#258ec8" />
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    return (
      <View style={{ paddingBottom: 4 }}>
        {/* Branch Stats Overview */}
        <View style={styles.overviewSection}>
          <View style={styles.statsRow}>
            <Surface style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#f5f3ff' }]}>
                <Stethoscope size={16} color="#7c3aed" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statVal}>{employeeDoctors.length}</Text>
                <Text style={styles.statLabel}>Doctors</Text>
              </View>
            </Surface>

            <Surface style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#f0f9ff' }]}>
                <Briefcase size={16} color="#0284c7" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statVal}>{allStaff.length}</Text>
                <Text style={styles.statLabel}>Support Staff</Text>
              </View>
            </Surface>
          </View>
        </View>

        {/* Custom Search bar */}
        <View style={styles.customSearchContainer}>
          <Search size={16} color="#94a3b8" style={{ marginLeft: 12 }} />
          <TextInput
            placeholder="Search directory by name..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.customSearchInput}
            placeholderTextColor="#94a3b8"
            underlineColorAndroid="transparent"
          />
        </View>
      </View>
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
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Global Attendance</Text>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>Directory</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={displayedList}
            ListHeaderComponent={renderHeader}
            renderItem={renderEmployeeItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.muted }}>No employees found in directory.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1'
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  content: { flex: 1, paddingVertical: 12, paddingHorizontal: 16 },
  listContent: { paddingBottom: 20 },
  
  // Overview section
  overviewSection: {
    paddingVertical: 4,
    marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statInfo: { justifyContent: 'center' },
  statVal: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 9, color: '#64748b', fontWeight: '700', marginTop: 1 },

  // Custom Searchbar
  customSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 10,
    height: 40,
  },
  customSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingHorizontal: 8,
    height: '100%',
  },

  // Compact Log Card
  logCardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    marginBottom: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userNameCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleTextBadgeCompact: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statusText: { fontSize: 9, fontWeight: '800', color: '#258ec8' }
});

export default GlobalAttendance;
