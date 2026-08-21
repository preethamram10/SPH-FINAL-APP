import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Modal, Keyboard, TextInput, Linking, Platform } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, Calendar, Clock, User, ChevronRight, UserCheck, UserX, Camera, Users, Search } from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const AttendanceList = ({ route, navigation }) => {
  const { userData } = useAuth();
  const branchId = route.params?.branchId || userData.branchId;
  const branchName = route.params?.branchName || userData.branchName;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [todayLogins, setTodayLogins] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // 1. Fetch branch staff
      let q;
      if (branchId === 'doctors') {
        q = query(
          collection(db, 'users'),
          where('role', '==', 'doctor')
        );
      } else {
        q = query(
          collection(db, 'users'),
          where('branchId', '==', branchId)
        );
      }
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (branchId === 'doctors') {
          if (d.doctorType === 'employee') {
            const status = d.status || 'active';
            data.push({ id: doc.id, ...d, status });
          }
        } else {
          // Only include staff roles (excluding receptionists and head doctors)
          if (['doctor', 'staff'].includes(d.role)) {
            if (d.role === 'doctor' && d.doctorType !== 'employee') return;
            const status = d.status || 'active';
            data.push({ id: doc.id, ...d, status });
          }
        }
      });
      setEmployees(data);

      // 2. Fetch today's real-time logins/logouts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logsQ = query(
        collection(db, 'activity_logs'),
        where('timestamp', '>=', today)
      );
      const logsSnapshot = await getDocs(logsQ);
      const logins = {};
      logsSnapshot.forEach((doc) => {
        const log = doc.data();
        if (log.userId) {
          const time = log.timestamp?.toDate?.() || new Date(log.timestamp);
          const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          if (!logins[log.userId]) {
            logins[log.userId] = { checkInTime: null, checkOutTime: null, photoUrl: null, checkInLocation: null, checkOutLocation: null, checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null };
          }

          if (log.action === 'login') {
            if (!logins[log.userId].checkInTime) {
              logins[log.userId].checkInTime = timeStr;
              logins[log.userId].photoUrl = log.photoUrl;
              logins[log.userId].checkInLocation = log.location?.address || (log.location?.latitude ? `${log.location.latitude.toFixed(4)}, ${log.location.longitude.toFixed(4)}` : null);
              logins[log.userId].checkInLat = log.location?.latitude || null;
              logins[log.userId].checkInLng = log.location?.longitude || null;
            }
          } else if (log.action === 'logout') {
            logins[log.userId].checkOutTime = timeStr;
            logins[log.userId].checkOutLocation = log.location?.address || (log.location?.latitude ? `${log.location.latitude.toFixed(4)}, ${log.location.longitude.toFixed(4)}` : null);
            logins[log.userId].checkOutLat = log.location?.latitude || null;
            logins[log.userId].checkOutLng = log.location?.longitude || null;
          }
        }
      });
      setTodayLogins(logins);
    } catch (error) {
      console.error('Error fetching employees or activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [branchId]);

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = emp.status === 'active';
    const matchesSearch = emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.role?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const renderEmployeeItem = ({ item }) => {
    const checkInData = todayLogins[item.id] || todayLogins[item.uid];
    const isPresent = !!(checkInData && checkInData.checkInTime);
    const checkInTime = isPresent ? checkInData.checkInTime : null;
    const checkOutTime = isPresent ? checkInData.checkOutTime : null;
    const photoUrl = isPresent ? checkInData.photoUrl : null;
    const checkInLocation = isPresent ? checkInData.checkInLocation : null;
    const checkOutLocation = isPresent ? checkInData.checkOutLocation : null;

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
        <Surface style={styles.empCardCompact}>
          <View style={styles.cardRow}>
            {/* Left: Avatar */}
            <View style={[styles.avatarBoxCompact, { backgroundColor: item.role === 'doctor' ? COLORS.primary + '15' : COLORS.secondary + '15' }]}>
              <User size={14} color={item.role === 'doctor' ? COLORS.primary : COLORS.secondary} />
            </View>

            {/* Middle: Name & Role Tag & Times */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.empNameCompact} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.roleBadgeCompact, { backgroundColor: item.role === 'doctor' ? '#f5f3ff' : '#f0f9ff' }]}>
                  <Text style={[styles.roleTextBadgeCompact, { color: item.role === 'doctor' ? '#7c3aed' : '#0369a1' }]}>
                    {item.role?.toUpperCase()}
                  </Text>
                </View>
              </View>
              {isPresent ? (
                <View>
                  <Text style={styles.timeTextCompact} numberOfLines={1}>
                    In: <Text style={styles.timeValCompact}>{checkInTime}</Text>{checkOutTime ? ` | Out: ${checkOutTime}` : ''}
                  </Text>
                  {checkInLocation && (
                    <Text style={{ fontSize: 9, color: COLORS.secondary, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                      📍 {checkInLocation}
                      {checkOutLocation && checkOutLocation !== checkInLocation ? ` / Out: ${checkOutLocation}` : ''}
                    </Text>
                  )}
                  {/* Map Pin Action Buttons (Direct Redirect) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {checkInLocation && (
                      <TouchableOpacity 
                        onPress={() => {
                          const lat = checkInData.checkInLat;
                          const lng = checkInData.checkInLng;
                          const url = (lat && lng) 
                            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(checkInLocation)}`;
                          Linking.openURL(url).catch(err => console.error("Error opening map:", err));
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#eff6ff', borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' }}
                      >
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#1d4ed8' }}>📍 IN MAP</Text>
                      </TouchableOpacity>
                    )}
                    {checkOutLocation && (
                      <TouchableOpacity 
                        onPress={() => {
                          const lat = checkInData.checkOutLat;
                          const lng = checkInData.checkOutLng;
                          const url = (lat && lng) 
                            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(checkOutLocation)}`;
                          Linking.openURL(url).catch(err => console.error("Error opening map:", err));
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#fef2f2', borderRadius: 4, borderWidth: 1, borderColor: '#fca5a5' }}
                      >
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#b91c1c' }}>📍 OUT MAP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '500', marginTop: 1 }}>Not checked in today</Text>
              )}
            </View>

            {/* Right: Presence and optional Selfie */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {photoUrl && (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImage(photoUrl)}>
                  <Image source={{ uri: photoUrl }} style={styles.selfieImageCompact} />
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.statusDot, { backgroundColor: isPresent ? '#10b981' : '#ef4444', marginRight: 4 }]} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: isPresent ? '#10b981' : '#ef4444' }}>
                  {isPresent ? 'PRESENT' : 'ABSENT'}
                </Text>
              </View>
              <ChevronRight size={14} color={COLORS.muted} style={{ marginLeft: 2 }} />
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    const activeStaff = employees.filter(emp => emp.status === 'active');
    const totalActive = activeStaff.length;
    const presentCount = activeStaff.filter(emp => !!(todayLogins[emp.id] || todayLogins[emp.uid])).length;
    const absentCount = totalActive - presentCount;
    const attendanceRate = totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0;

    return (
      <View style={{ paddingBottom: 4 }}>
        {/* Branch Stats Overview */}
        <View style={styles.overviewSection}>
          <View style={styles.statsRow}>
            <Surface style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#eff6ff' }]}>
                <Users size={16} color="#3b82f6" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statVal}>{totalActive}</Text>
                <Text style={styles.statLabel}>Total Staff</Text>
              </View>
            </Surface>

            <Surface style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#ecfdf5' }]}>
                <UserCheck size={16} color="#10b981" />
              </View>
              <View style={styles.statInfo}>
                <Text style={[styles.statVal, { color: '#10b981' }]}>{presentCount}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
            </Surface>

            <Surface style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#fef2f2' }]}>
                <UserX size={16} color="#ef4444" />
              </View>
              <View style={styles.statInfo}>
                <Text style={[styles.statVal, { color: '#ef4444' }]}>{absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </Surface>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.progressLabel}>Today's Attendance Rate</Text>
              <Text style={styles.progressPct}>{attendanceRate}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${attendanceRate}%`, backgroundColor: attendanceRate > 75 ? '#10b981' : '#f59e0b' }]} />
            </View>
          </View>
        </View>

        {/* Custom Search bar */}
        <View style={styles.customSearchContainer}>
          <Search size={16} color="#94a3b8" style={{ marginLeft: 12 }} />
          <TextInput
            placeholder="Search staff by name or role..."
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
          <Text style={styles.headerTitle}>Attendance</Text>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>{branchName}</Text>
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
            data={filteredEmployees}
            ListHeaderComponent={renderHeader}
            renderItem={renderEmployeeItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.muted }}>No employees found in this branch.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Selfie Preview Modal */}
      <Modal visible={!!previewImage} transparent={true} onRequestClose={() => setPreviewImage(null)} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setPreviewImage(null)}
          >
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={{ width: '90%', height: '80%', resizeMode: 'contain' }} />
          )}
        </View>
      </Modal>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1'
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  content: { flex: 1, paddingVertical: 12, paddingHorizontal: 16 },
  
  // Overview section
  overviewSection: {
    paddingVertical: 4,
    marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
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
  
  progressContainer: { marginTop: 10, paddingTop: 4 },
  progressLabel: { fontSize: 10, fontWeight: '700', color: '#475569' },
  progressPct: { fontSize: 10, fontWeight: '800', color: '#0f172a' },
  progressBarBg: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 3, marginTop: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  // Custom Search bar
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

  // Compact Employee card
  empCardCompact: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarBoxCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empNameCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
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
  timeTextCompact: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  timeValCompact: {
    fontWeight: '700',
    color: '#334155',
  },
  selfieImageCompact: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  listContent: { paddingBottom: 20 },
});

export default AttendanceList;
