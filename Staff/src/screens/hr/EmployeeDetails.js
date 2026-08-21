import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Linking, Alert, Keyboard, Modal, Platform } from 'react-native';
import { Text, Surface, Avatar, ActivityIndicator, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ChevronLeft, Calendar, Clock, User, Phone, Briefcase, MapPin, Mail, Edit, MoreVertical } from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const EmployeeDetails = ({ route, navigation }) => {
  const { employeeId, employeeName, employeeRole, employeePhone } = route.params;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('active');
  const [toggling, setToggling] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);

  // Admin Actions Dropdown Modal State
  const [showMenu, setShowMenu] = useState(false);

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

  const fetchEmployeeData = async () => {
    try {
      const userRef = doc(db, 'users', employeeId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setEmployeeData(data);
        setStatus(data.status || 'active');
        return data.uid;
      }
      return null;
    } catch (e) {
      console.error('Error fetching employee details:', e);
    }
  };

  const handleToggleAccess = async () => {
    const newStatus = status === 'active' ? 'inactive' : 'active';
    const alertMsg = status === 'active'
      ? `Are you sure you want to suspend access for ${employeeData?.name || employeeName}? They will no longer be able to log in.`
      : `Are you sure you want to restore access for ${employeeData?.name || employeeName}?`;

    Alert.alert(
      status === 'active' ? 'Suspend Access' : 'Restore Access',
      alertMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setToggling(true);
            try {
              const userRef = doc(db, 'users', employeeId);
              await updateDoc(userRef, { status: newStatus });
              setStatus(newStatus);
              Alert.alert('Success', `Access status updated to ${newStatus?.toUpperCase()}.`);
            } catch (error) {
              console.error('Error toggling staff access:', error);
              Alert.alert('Error', 'Failed to update access status.');
            } finally {
              setToggling(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteStaff = async () => {
    Alert.alert(
      'Delete Staff Profile',
      `Are you sure you want to permanently delete ${employeeData?.name || employeeName}? This action is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setToggling(true);
            try {
              const userRef = doc(db, 'users', employeeId);
              await updateDoc(userRef, { status: 'deleted' });
              Alert.alert('Success', 'Staff profile permanently deleted.', [
                { text: 'OK', onPress: () => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('MainTab');
                  }
                }}
              ]);
            } catch (error) {
              console.error('Error deleting staff profile:', error);
              Alert.alert('Error', 'Failed to delete staff profile.');
            } finally {
              setToggling(false);
            }
          }
        }
      ]
    );
  };

  const fetchCompleteLogs = async (uid = null) => {
    setLoading(true);
    try {
      const targetIds = [employeeId];
      if (uid && uid !== employeeId) targetIds.push(uid);

      const q = query(
        collection(db, 'activity_logs'),
        where('userId', 'in', targetIds)
      );

      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData.action === 'login' || docData.action === 'logout') {
          data.push({ id: doc.id, ...docData });
        }
      });

      // Group logs of the same day together
      const grouped = {};
      data.forEach((log) => {
        const dateObj = (log.timestamp && typeof log.timestamp.toDate === 'function') 
          ? log.timestamp.toDate() 
          : (log.timestamp ? new Date(log.timestamp) : new Date());
        
        const dateKey = dateObj.toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            rawDate: dateObj,
            loginTime: null,
            loginLocation: null,
            loginLat: null,
            loginLng: null,
            logoutTime: null,
            logoutLocation: null,
            logoutLat: null,
            logoutLng: null,
          };
        }

        if (log.action === 'login') {
          if (!grouped[dateKey].loginTime || dateObj < new Date(grouped[dateKey].rawDate)) {
            grouped[dateKey].loginTime = timeStr;
            grouped[dateKey].loginLocation = log.location?.address || (log.location?.latitude ? `${log.location.latitude.toFixed(4)}, ${log.location.longitude.toFixed(4)}` : null);
            grouped[dateKey].loginLat = log.location?.latitude || null;
            grouped[dateKey].loginLng = log.location?.longitude || null;
          }
        } else if (log.action === 'logout') {
          if (!grouped[dateKey].logoutTime || dateObj > new Date(grouped[dateKey].rawDate)) {
            grouped[dateKey].logoutTime = timeStr;
            grouped[dateKey].logoutLocation = log.location?.address || (log.location?.latitude ? `${log.location.latitude.toFixed(4)}, ${log.location.longitude.toFixed(4)}` : null);
            grouped[dateKey].logoutLat = log.location?.latitude || null;
            grouped[dateKey].logoutLng = log.location?.longitude || null;
          }
        }
      });

      const sortedGrouped = Object.values(grouped).sort((a, b) => b.rawDate - a.rawDate);
      setLogs(sortedGrouped);
    } catch (error) {
      console.error('Error fetching employee logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData().then(uid => fetchCompleteLogs(uid));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchEmployeeData().then(uid => fetchCompleteLogs(uid));
    });
    return unsubscribe;
  }, [navigation]);

  const renderLogItem = ({ item }) => (
    <Surface style={styles.logItem}>
      {/* Date header */}
      <View style={styles.logDateHeader}>
        <Calendar size={14} color={COLORS.secondary} />
        <Text style={styles.logDateText}>{item.date}</Text>
      </View>

      {/* Side-by-Side Punch Details */}
      <View style={styles.logTimesRow}>
        {/* Left Column: Login */}
        <View style={styles.logColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="#10b981" />
            <Text style={styles.timeLabel}>Checked In</Text>
          </View>
          {item.loginTime ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.timeValueText}>{item.loginTime}</Text>
              {item.loginLocation && (
                <TouchableOpacity
                  style={styles.locationLink}
                  onPress={() => {
                    const url = (item.loginLat && item.loginLng)
                      ? `https://www.google.com/maps/search/?api=1&query=${item.loginLat},${item.loginLng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.loginLocation)}`;
                    Linking.openURL(url).catch(err => console.error("Error opening map:", err));
                  }}
                >
                  <MapPin size={10} color={COLORS.secondary} />
                  <Text style={styles.locationText} numberOfLines={1}>{item.loginLocation}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noDataText}>Not recorded</Text>
          )}
        </View>

        {/* Right Column: Logout */}
        <View style={styles.logColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="#ef4444" />
            <Text style={styles.timeLabel}>Checked Out</Text>
          </View>
          {item.logoutTime ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.timeValueText}>{item.logoutTime}</Text>
              {item.logoutLocation && (
                <TouchableOpacity
                  style={styles.locationLink}
                  onPress={() => {
                    const url = (item.logoutLat && item.logoutLng)
                      ? `https://www.google.com/maps/search/?api=1&query=${item.logoutLat},${item.logoutLng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.logoutLocation)}`;
                    Linking.openURL(url).catch(err => console.error("Error opening map:", err));
                  }}
                >
                  <MapPin size={10} color={COLORS.secondary} />
                  <Text style={styles.locationText} numberOfLines={1}>{item.logoutLocation}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noDataText}>Not recorded</Text>
          )}
        </View>
      </View>
    </Surface>
  );

  const renderHeader = () => (
    <View style={{ paddingBottom: 10 }}>
      {/* Profile Card Info */}
      <Surface style={styles.profileCard}>
        <Avatar.Text
          size={50}
          label={employeeData?.name ? employeeData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST'}
          style={{ backgroundColor: COLORS.secondary }}
          labelStyle={{ fontWeight: '800', fontSize: 16 }}
        />
        <Text style={styles.empName}>{employeeData?.name || employeeName}</Text>
        <Text style={styles.empRole}>
          {employeeData?.role?.toUpperCase()}
          {employeeData?.role === 'doctor' && ` (${employeeData.doctorType === 'head' ? 'HEAD' : 'EMPLOYEE'})`}
        </Text>

        <View style={[styles.statusBadge, {
          backgroundColor: status === 'active' ? '#ecfdf5' : '#fff7ed',
          marginTop: 6
        }]}>
          <Text style={{
            fontSize: 9,
            fontWeight: '800',
            color: status === 'active' ? '#065f46' : '#c2410c',
            letterSpacing: 0.5
          }}>
            {status?.toUpperCase()} ACCESS
          </Text>
        </View>

        {/* 2-Column Info Grid */}
        <View style={styles.infoGrid}>
          {/* Row 1 */}
          <View style={styles.infoGridRow}>
            <View style={styles.infoGridCol}>
              <Phone size={12} color={COLORS.secondary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoVal} numberOfLines={1}>{employeeData?.phone || employeePhone || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.infoGridCol}>
              <Calendar size={12} color={COLORS.secondary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Joined</Text>
                <Text style={styles.infoVal} numberOfLines={1}>{formatJoiningDate(employeeData?.createdAt)}</Text>
              </View>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.infoGridRow}>
            <View style={styles.infoGridCol}>
              <Mail size={12} color={COLORS.secondary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoVal} numberOfLines={1}>{employeeData?.email || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.infoGridCol}>
              <MapPin size={12} color={COLORS.secondary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Branch</Text>
                <Text style={styles.infoVal} numberOfLines={1}>{employeeData?.branchName || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Row 3 (Salary & Shift) */}
          {(employeeData?.role === 'staff' || (employeeData?.role === 'doctor' && employeeData?.doctorType === 'employee')) && (
            <>
              <View style={styles.infoGridRow}>
                <View style={styles.infoGridCol}>
                  <Briefcase size={12} color={COLORS.secondary} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Salary</Text>
                    <Text style={[styles.infoVal, { color: COLORS.secondary, fontWeight: '700' }]} numberOfLines={1}>
                      Rs {Number(employeeData.salary || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoGridCol}>
                  <Clock size={12} color={COLORS.secondary} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Shift Type</Text>
                    <Text style={styles.infoVal} numberOfLines={1}>
                      {employeeData.shiftType === 'multi' ? 'Multi' : 'Single'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Row 4 (Timings) */}
              <View style={styles.infoGridRow}>
                <View style={styles.infoGridCol}>
                  <Clock size={12} color={COLORS.secondary} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Shift 1 Timing</Text>
                    <Text style={styles.infoVal} numberOfLines={1}>
                      {employeeData.loginTime || '09:00 AM'} - {employeeData.logoutTime || '06:00 PM'}
                    </Text>
                  </View>
                </View>
                {employeeData.shiftType === 'multi' && (
                  <View style={styles.infoGridCol}>
                    <Clock size={12} color={COLORS.secondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Shift 2 Timing</Text>
                      <Text style={styles.infoVal} numberOfLines={1}>
                        {employeeData.loginTime2 || '04:00 PM'} - {employeeData.logoutTime2 || '09:00 PM'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </Surface>

      {/* Stats Counters */}
      <View style={styles.statsRow}>
        <Surface style={styles.statBox}>
          <Text style={styles.statLabel}>Days Logged</Text>
          <Text style={styles.statValue}>{logs.length}</Text>
        </Surface>
        <Surface style={styles.statBox}>
          <Text style={styles.statLabel}>Active Days</Text>
          <Text style={styles.statValue}>
            {new Set(logs.map(l => l.date).filter(Boolean)).size}
          </Text>
        </Surface>
      </View>

      <Text style={styles.sectionTitle}>Attendance History</Text>
    </View>
  );

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
        <Text style={styles.headerTitle}>Employee Report</Text>
        {/* Menu vertical button on the right */}
        <TouchableOpacity 
          onPress={() => setShowMenu(true)} 
          style={styles.menuBtn}
        >
          <MoreVertical size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={item => item.date}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No activity logs found for this user.</Text>
          }
        />
      )}

      {/* Admin Actions Bottom Sheet Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        onRequestClose={() => setShowMenu(false)}
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.menuModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuModalContent}>
            <View style={styles.menuDragHandle} />
            <Text style={styles.menuModalTitle}>Admin Actions</Text>

            <TouchableOpacity 
              onPress={() => {
                setShowMenu(false);
                navigation.navigate('AddStaff', { editEmployeeId: employeeId });
              }}
              style={styles.menuItem}
            >
              <Edit size={18} color={COLORS.secondary} />
              <Text style={styles.menuItemText}>Edit Profile Details</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                setShowMenu(false);
                handleToggleAccess();
              }}
              style={styles.menuItem}
            >
              <User size={18} color="#f59e0b" />
              <Text style={styles.menuItemText}>
                {status === 'active' ? 'Suspend Access' : 'Restore Access'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                setShowMenu(false);
                handleDeleteStaff();
              }}
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
            >
              <User size={18} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setShowMenu(false)}
              style={styles.menuCancelBtn}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  menuBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  listContent: { paddingVertical: 16, paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  empName: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  empRole: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, marginTop: 1 },
  
  // 2-Column Info Grid Styling
  infoGrid: {
    width: '100%',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  infoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoGridCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 6,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '700',
  },
  infoVal: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 1,
  },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: COLORS.border },
  statLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  
  // Grouped Log Item Card
  logItem: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    marginBottom: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  logDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  logTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  logColumn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  timeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
  },
  timeValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  noDataText: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 9,
    color: COLORS.secondary,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 20, color: COLORS.muted },

  // Administrative Action Sheet Styling
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  menuDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuModalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuCancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});

export default EmployeeDetails;
