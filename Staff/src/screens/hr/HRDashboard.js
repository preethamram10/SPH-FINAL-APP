import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Platform, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, Surface, ActivityIndicator, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import {
  Users, Calendar, FileText, IndianRupee, Clock, CheckCircle2,
  XCircle, AlertCircle, MapPin, ChevronRight, Briefcase,
  UserCheck, UserX, LogOut, RefreshCw, BarChart3, ClipboardList, Bell, PlusCircle, Video, Target,
  ChevronDown, CalendarDays, Percent
} from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
};
const HRDashboard = ({ navigation, setActiveTab }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [totalStaff, setTotalStaff] = useState(0);
  const [activeToday, setActiveToday] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalReceptionists, setTotalReceptionists] = useState(0);
  const [totalHR, setTotalHR] = useState(0);
  const [pendingDiscountsCount, setPendingDiscountsCount] = useState(0);
  const [pendingLeavesList, setPendingLeavesList] = useState([]);
  const [todayAppts, setTodayAppts] = useState([]);
  const [todayApptLoading, setTodayApptLoading] = useState(true);
  const [allMonthAppts, setAllMonthAppts] = useState([]);
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [selectedCalDate, setSelectedCalDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    const userIds = [auth.currentUser.uid];
    if (userData?.id && userData.id !== auth.currentUser.uid) {
      userIds.push(userData.id);
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', userIds),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadNotifications(snap.size);
    }, (err) => {
      console.warn('Error listening to notifications count:', err);
    });
    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    if (userData && userData.role !== 'hr') {
      Alert.alert('Access Denied', 'You do not have permission to access the HR Dashboard.');
      navigation.replace('MainTab');
    }
  }, [userData, navigation]);

  useEffect(() => {
    const loadCachedStats = async () => {
      try {
        const cached = await AsyncStorage.getItem('hr_dashboard_stats');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.totalStaff) setTotalStaff(parsed.totalStaff);
          if (parsed.activeToday) setActiveToday(parsed.activeToday);
          if (parsed.pendingLeaves) setPendingLeaves(parsed.pendingLeaves);
          if (parsed.totalDoctors) setTotalDoctors(parsed.totalDoctors);
          if (parsed.totalReceptionists) setTotalReceptionists(parsed.totalReceptionists);
          if (parsed.totalHR) setTotalHR(parsed.totalHR);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load cached HR stats:', err);
      }
    };
    loadCachedStats();
  }, []);

  const fetchHRData = useCallback(async () => {
    try {
      // 1. Fetch all staff in ALL branches (filtered by role at DB level)
      const usersQ = query(
        collection(db, 'users'),
        where('role', 'in', ['doctor', 'receptionist', 'hr', 'staff'])
      );

      // 2. Today's attendance (activity_logs with action='login' today) for ALL branches
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logsQ = query(
        collection(db, 'activity_logs'),
        where('timestamp', '>=', today)
      );

      // 3. Pending leave requests for ALL branches
      const leavesQ = query(
        collection(db, 'leave_requests'),
        where('status', '==', 'pending')
      );

      const [usersSnap, logsSnap, leavesSnap] = await Promise.all([
        getDocs(usersQ),
        getDocs(logsQ),
        getDocs(leavesQ)
      ]);

      const allStaff = [];
      usersSnap.forEach(d => {
        allStaff.push({ id: d.id, ...d.data() });
      });
      setTotalStaff(allStaff.length);
      setTotalDoctors(allStaff.filter(s => s.role === 'doctor').length);
      setTotalReceptionists(allStaff.filter(s => s.role === 'receptionist').length);
      setTotalHR(allStaff.filter(s => s.role === 'hr').length);

      const todayLogins = new Set();
      logsSnap.forEach(d => {
        const log = d.data();
        const logTime = log.timestamp?.toDate?.() || new Date(0);
        if (logTime >= today && log.action === 'login') {
          todayLogins.add(log.userId);
        }
      });
      setActiveToday(todayLogins.size);

      const pending = [];
      leavesSnap.forEach(d => {
        const l = d.data();
        pending.push({ id: d.id, ...l });
      });
      setPendingLeaves(pending.length);
      setPendingLeavesList(pending.slice(0, 3));

      // Cache stats in AsyncStorage for Stale-While-Revalidate loading
      try {
        const statsToCache = {
          totalStaff: allStaff.length,
          activeToday: todayLogins.size,
          pendingLeaves: pending.length,
          totalDoctors: allStaff.filter(s => s.role === 'doctor').length,
          totalReceptionists: allStaff.filter(s => s.role === 'receptionist').length,
          totalHR: allStaff.filter(s => s.role === 'hr').length,
        };
        await AsyncStorage.setItem('hr_dashboard_stats', JSON.stringify(statsToCache));
      } catch (cacheErr) {
        console.warn('Error saving HR dashboard stats to cache:', cacheErr);
      }

    } catch (e) {
      console.error('HR data fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const task = setTimeout(() => {
      fetchHRData();
    }, 0);
    return () => clearTimeout(task);
  }, [fetchHRData]);

  useEffect(() => {
    let pats = [];
    let appts = [];

    const updateCount = () => {
      const seen = new Set();
      let count = 0;
      pats.forEach(p => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          count++;
        }
      });
      appts.forEach(a => {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          count++;
        }
      });
      setPendingDiscountsCount(count);
    };

    const q1 = query(collection(db, 'allpatients'), where('medicineDiscountStatus', '==', 'pending'));
    const unsub1 = onSnapshot(q1, snap => {
      pats = snap.docs.map(d => ({ id: d.id }));
      updateCount();
    });

    const q2 = query(collection(db, 'appointments'), where('medicineDiscountStatus', '==', 'pending'));
    const unsub2 = onSnapshot(q2, snap => {
      appts = snap.docs.map(d => ({ id: d.id }));
      updateCount();
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchHRData(); };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: triggerSignOut }
      ],
      { cancelable: true }
    );
  };

  const triggerSignOut = async () => {
    try {
      if (auth.currentUser) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), { expoPushToken: null }).catch(e => console.warn(e));
        addDoc(collection(db, 'activity_logs'), {
          userId: auth.currentUser.uid,
          userName: userData?.name || 'HR Staff',
          userRole: userData?.role || 'hr',
          branchId: userData?.branchId || '',
          action: 'app_logout',
          timestamp: serverTimestamp()
        }).catch(e => console.warn(e));
      }
      await auth.signOut();
    } catch (error) {
      await auth.signOut();
    }
  };



  const quickActions = [
    { label: 'Attendance', icon: Calendar, color: COLORS.secondary, bg: '#eff6ff', screen: 'BranchSelection' },
    { label: 'Global Attendance', icon: Calendar, color: COLORS.secondary, bg: '#eff6ff', screen: 'GlobalAttendance' },
    { label: 'Leaves', icon: FileText, color: COLORS.warning, bg: '#fffbeb', screen: 'LeaveApprovals', badge: pendingLeaves },
    { label: 'Discounts', icon: Percent, color: COLORS.danger, bg: '#fdf2f8', screen: 'FeeDiscounts', badge: pendingDiscountsCount },
    { label: 'Salaries', icon: IndianRupee, color: COLORS.success, bg: '#ecfdf5', screen: 'SalaryManagement' },
    { label: 'Add Staff', icon: PlusCircle, color: '#ec4899', bg: '#fdf2f8', screen: 'AddStaff' },
    { label: 'Staff Management', icon: Users, color: '#8b5cf6', bg: '#faf5ff', screen: 'CompleteProfiles' },
    { label: 'Branches', icon: MapPin, color: COLORS.primary, bg: '#f0fdf4', screen: 'ManageBranches' },
    { label: 'Banners', icon: ClipboardList, color: COLORS.purple, bg: '#f5f3ff', screen: 'ManageBanners' },
    { label: 'Videos', icon: Video, color: COLORS.secondary, bg: '#eff6ff', screen: 'ManageVideos' },
    { label: 'Targets', icon: Target, color: '#f97316', bg: '#fff7ed', screen: 'TargetManagement' },
    { label: 'Appointments', icon: Users, color: '#0ea5e9', bg: '#f0f9ff', screen: 'ReceptionPanel' },
    { label: 'Revenue', icon: BarChart3, color: COLORS.purple, bg: '#faf5ff', screen: 'RevenueDashboard' },
  ];


  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <View style={st.avatarCircle}>
            <Briefcase size={22} color={COLORS.secondary} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={st.userName}>{userData?.name || 'HR Manager'}</Text>
            <Text style={{ fontSize: 12, color: COLORS.muted, fontWeight: '500', marginTop: 1 }}>{userData?.phone || 'No Mobile'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <MapPin size={11} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={st.branch}>{userData?.branchName || 'Main Branch'}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={st.headerBtn} onPress={() => navigation.navigate('Notifications')}>
            <Bell size={18} color={COLORS.text} />
            {unreadNotifications > 0 && <View style={st.headerBtnBadge} />}
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBtn} onPress={handleLogout}>
            <LogOut size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[COLORS.secondary]} tintColor={COLORS.secondary} />
        }
      >
        {/* ── Stats Grid ──────────────────────────────── */}
        <View style={st.statsGrid}>
          <Surface style={st.statCard}>
            <View style={[st.statIcon, { backgroundColor: '#eff6ff' }]}>
              <Users size={14} color={COLORS.secondary} />
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 4 }} />
            ) : (
              <Text style={st.statVal}>{totalStaff}</Text>
            )}
            <Text style={st.statLabel}>Total Staff</Text>
          </Surface>
          <Surface style={st.statCard}>
            <View style={[st.statIcon, { backgroundColor: '#ecfdf5' }]}>
              <UserCheck size={14} color={COLORS.success} />
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.success} style={{ marginVertical: 4 }} />
            ) : (
              <Text style={[st.statVal, { color: COLORS.success }]}>{activeToday}</Text>
            )}
            <Text style={st.statLabel}>Active Today</Text>
          </Surface>
          <Surface style={st.statCard}>
            <View style={[st.statIcon, { backgroundColor: '#fffbeb' }]}>
              <Clock size={14} color={COLORS.warning} />
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.warning} style={{ marginVertical: 4 }} />
            ) : (
              <Text style={[st.statVal, { color: COLORS.warning }]}>{pendingLeaves}</Text>
            )}
            <Text style={st.statLabel}>Pending Leaves</Text>
          </Surface>
          <Surface style={st.statCard}>
            <View style={[st.statIcon, { backgroundColor: '#faf5ff' }]}>
              <BarChart3 size={14} color={COLORS.purple} />
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.purple} style={{ marginVertical: 4 }} />
            ) : (
              <Text style={[st.statVal, { color: COLORS.purple }]}>{totalDoctors}</Text>
            )}
            <Text style={st.statLabel}>Doctors</Text>
          </Surface>
        </View>

        {/* ── Quick Actions Grid ──────────────────────── */}
        <View style={st.sectionHeaderRow}>
          <Text style={st.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={st.actionsGrid}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={st.actionCard}
              onPress={() => navigation.navigate(action.screen)}
            >
              <View style={[st.actionIconBox, { backgroundColor: action.bg, borderRadius: 12 }]}>
                <action.icon size={18} color={action.color} />
                {action.badge ? (
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{action.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={st.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Role Breakdown Bar ──────────────────────── */}
        <Surface style={st.roleBar}>
          <Text style={st.roleBarTitle}>Staff by Role</Text>
          <View style={st.roleRow}>
            <View style={st.roleItem}>
              <View style={[st.roleDot, { backgroundColor: COLORS.secondary }]} />
              <Text style={st.roleText}>Doctors: {totalDoctors}</Text>
            </View>
            <View style={st.roleItem}>
              <View style={[st.roleDot, { backgroundColor: COLORS.primary }]} />
              <Text style={st.roleText}>Receptionists: {totalReceptionists}</Text>
            </View>
            <View style={st.roleItem}>
              <View style={[st.roleDot, { backgroundColor: COLORS.purple }]} />
              <Text style={st.roleText}>HR: {totalHR}</Text>
            </View>
            <View style={st.roleItem}>
              <View style={[st.roleDot, { backgroundColor: COLORS.muted }]} />
              <Text style={st.roleText}>Others: {totalStaff - totalDoctors - totalReceptionists - totalHR}</Text>
            </View>
          </View>
        </Surface>

        {/* ── Pending Leave Requests ──────────────────── */}
        <View style={st.sectionHeaderRow}>
          <Text style={st.sectionTitle}>Pending Leave Requests</Text>
          {pendingLeaves > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('LeaveApprovals')}>
              <Text style={st.viewAll}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {pendingLeavesList.length === 0 ? (
          <Surface style={st.emptyCard}>
            <CheckCircle2 size={24} color={COLORS.success} />
            <Text style={st.emptyText}>All caught up! No pending leave requests.</Text>
          </Surface>
        ) : (
          pendingLeavesList.map(leave => (
            <Surface key={leave.id} style={st.leaveCard}>
              <View style={st.leaveHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={st.leaveName}>{leave.staffName}</Text>
                  <Text style={st.leaveRole}>{leave.staffRole?.toUpperCase()}</Text>
                </View>
                <View style={st.leavePendingBadge}>
                  <Text style={st.leavePendingText}>PENDING</Text>
                </View>
              </View>
              <View style={st.leaveMeta}>
                <Calendar size={13} color={COLORS.muted} />
                <Text style={st.leaveDate}>{leave.startDate} → {leave.endDate}</Text>
                <Text style={st.leaveType}>{leave.category || leave.leaveType || 'General'}</Text>
              </View>
              {leave.reason ? (
                <Text style={st.leaveReason} numberOfLines={2}>"{leave.reason}"</Text>
              ) : null}
            </Surface>
          ))
        )}



        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.secondary + '15',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.secondary + '30'
  },
  greeting: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  branch: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center'
  },
  headerBtnBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444'
  },

  scroll: { padding: 16 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  statCard: {
    width: '23.5%', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8,
    backgroundColor: COLORS.white, elevation: 1, alignItems: 'center', marginBottom: 8
  },
  statIcon: {
    width: 22, height: 22, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2
  },
  statVal: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, marginTop: 1, textAlign: 'center' },

  // Role bar
  roleBar: {
    padding: 14, borderRadius: 12, backgroundColor: COLORS.white,
    elevation: 1, marginBottom: 20
  },
  roleBarTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleItem: { flexDirection: 'row', alignItems: 'center' },
  roleDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  roleText: { fontSize: 11, fontWeight: '600', color: COLORS.muted },

  // Sections
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  viewAll: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },

  // Quick actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 2,
    marginBottom: 20
  },
  actionCard: {
    alignItems: 'center',
    width: '22%',
    marginHorizontal: '1.5%',
    marginBottom: 12
  },
  actionIconBox: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4
  },
  actionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  badge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center'
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: 'white' },

  // Leave cards
  leaveCard: {
    padding: 12, borderRadius: 12, backgroundColor: COLORS.white,
    elevation: 1, marginBottom: 8
  },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  leaveName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  leaveRole: { fontSize: 9, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  leavePendingBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: COLORS.warning + '15'
  },
  leavePendingText: { fontSize: 9, fontWeight: '800', color: COLORS.warning },
  leaveMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  leaveDate: { fontSize: 11, fontWeight: '600', color: COLORS.text, flex: 1 },
  leaveType: { fontSize: 9, fontWeight: '700', color: COLORS.secondary, backgroundColor: '#eff6ff', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  leaveReason: { fontSize: 11, color: COLORS.muted, fontStyle: 'italic', lineHeight: 16 },

  // Empty state
  emptyCard: {
    padding: 16, borderRadius: 12, backgroundColor: COLORS.white,
    elevation: 1, alignItems: 'center', marginBottom: 8
  },
  emptyText: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  // Activity list
  activityCardContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    elevation: 2,
    marginBottom: 20
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  activitySub: { fontSize: 11, color: COLORS.muted, fontWeight: '500', marginTop: 1 },
  activityTime: { fontSize: 12, fontWeight: '700', color: COLORS.muted }
});
export default HRDashboard;
