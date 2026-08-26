import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Keyboard, TouchableOpacity, Alert } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { addDoc, collection, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Home, CalendarPlus, Users, ClipboardList, LogOut, Briefcase, Lock, Package, Pill, History, IndianRupee, Clock, FileText } from 'lucide-react-native';

import MedicineRequestList from './MedicineRequestList';
import Dashboard from '../Dashboard';
import RegisterPatient from './RegisterPatient';
import ReceptionPanel from './ReceptionPanel';
import HRDashboard from '../hr/HRDashboard';
import PackageMembers from './PackageMembers';
import DoctorConsultationHistory from './DoctorConsultationHistory';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  muted: '#64748b',
  white: '#ffffff',
  success: '#4ade80',
};

const NavItem = React.memo(({ icon, label, active, onPress, color, badgeCount }) => (
  <TouchableOpacity
    style={styles.navItem}
    activeOpacity={0.6}
    delayPressIn={0}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    onPress={onPress}
  >
    <View style={{ position: 'relative' }}>
      {icon}
      {badgeCount > 0 && (
        <View style={styles.badgeDot}>
          <Text style={styles.badgeDotText}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
    <Text style={[styles.navText, active && { color }]}>{label}</Text>
  </TouchableOpacity>
));

const MainTabScreen = ({ navigation, route }) => {
  const { userData } = useAuth();
  const roleLower = String(userData?.role || '').toLowerCase().trim();
  const isHR = roleLower === 'hr';
  const isDoctor = roleLower === 'doctor';
  const isRegularStaff = roleLower === 'staff';
  const isReception = ['receptionist', 'reception', 'receptionist_admin', 'admin', 'superadmin', 'manager', 'management'].includes(roleLower);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [targetsSet, setTargetsSet] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [pendingMedReqCount, setPendingMedReqCount] = useState(0);
  const [isPunchedIn, setIsPunchedIn] = useState(true);
  const [loadingPunch, setLoadingPunch] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  useEffect(() => {
    // Punch-in locks are bypassed: always unlocked
    setIsPunchedIn(true);
    setLoadingPunch(false);
  }, []);

  useEffect(() => {
    if (!userData) return;
    const roleLower = String(userData?.role || '').toLowerCase().trim();
    if (roleLower === 'hr' && !route?.params?.tab) {
      setActiveTab('HRDashboard');
    }
  }, [userData, route?.params?.tab]);

  useEffect(() => {
    checkTargetsForCurrentMonth();
  }, [userData?.branchId]);

  // Real-time listener for pending medicine requests count
  useEffect(() => {
    if (!userData?.branchId) return;
    const q = query(
      collection(db, 'medicine_requests'),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        const requestBranchId = data.branchId || '';
        const requestBranchName = data.branchName || '';
        const staffBranchId = userData.branchId || '';
        const staffBranchName = userData.branchName || '';

        const matchesBranch =
          !requestBranchId ||
          requestBranchId.toLowerCase() === staffBranchId.toLowerCase() ||
          (requestBranchName && staffBranchName && requestBranchName.toLowerCase() === staffBranchName.toLowerCase());

        if (matchesBranch && data.medicines && data.medicines.length > 0) {
          count++;
        }
      });
      setPendingMedReqCount(count);
    }, () => { });
    return () => unsub();
  }, [userData?.branchId]);

  const checkTargetsForCurrentMonth = async () => {
    if (isHR) {
      setLoadingTargets(false);
      return;
    }

    try {
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setTargetsSet(false);
      } else {
        const staffBranch = (userData?.branchName || userData?.branchId || userData?.branch || '').toLowerCase().trim();
        const hasTarget = snapshot.docs.some(docItem => {
          const d = docItem.data();
          const bId = (d.branchId || '').toLowerCase().trim();
          const bName = (d.branchName || '').toLowerCase().trim();
          return !staffBranch || bId.includes(staffBranch) || staffBranch.includes(bId) || bName.includes(staffBranch) || staffBranch.includes(bName);
        });
        setTargetsSet(hasTarget);
      }
    } catch (error) {
      console.error('Error checking targets:', error);
      setTargetsSet(true);
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
        addDoc(collection(db, 'activity_logs'), {
          userId: auth.currentUser.uid,
          userName: userData?.name || 'Staff Member',
          userRole: userData?.role || 'staff',
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


  const handleTabPress = React.useCallback((tab) => {
    requestAnimationFrame(() => {
      setActiveTab(tab);
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Dynamic Screen Container */}
      <View style={styles.content}>
        {/* Primary screens kept permanently mounted for instant 0ms tab switching */}
        <View style={{ flex: 1, display: activeTab === 'Dashboard' ? 'flex' : 'none' }}>
          <Dashboard navigation={navigation} setActiveTab={handleTabPress} />
        </View>
        <View style={{ flex: 1, display: activeTab === 'RegisterPatient' ? 'flex' : 'none' }}>
          <RegisterPatient navigation={navigation} setActiveTab={handleTabPress} />
        </View>
        <View style={{ flex: 1, display: activeTab === 'ReceptionPanel' ? 'flex' : 'none' }}>
          <ReceptionPanel navigation={navigation} setActiveTab={handleTabPress} mode="all" />
        </View>
        <View style={{ flex: 1, display: activeTab === 'MedicineRequestList' ? 'flex' : 'none' }}>
          <MedicineRequestList navigation={navigation} setActiveTab={handleTabPress} />
        </View>
        {isHR && activeTab === 'HRDashboard' && (
          <HRDashboard navigation={navigation} setActiveTab={handleTabPress} />
        )}
        {isDoctor && activeTab === 'PackageMembers' && (
          <PackageMembers navigation={navigation} setActiveTab={handleTabPress} />
        )}
      </View>

      {/* UNIVERSAL STATIONARY BOTTOM NAVIGATION BAR */}
      {!keyboardVisible && (
        <View style={[
          styles.bottomNav,
          {
            paddingBottom: Math.max(insets.bottom, 15),
            height: 65 + Math.max(insets.bottom, 15)
          }
        ]}>
          <NavItem
            icon={<Home size={20} color={activeTab === 'Dashboard' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />}
            label="Dashboard"
            active={activeTab === 'Dashboard'}
            color={COLORS.secondary}
            onPress={() => handleTabPress('Dashboard')}
          />

          {!isDoctor && !isRegularStaff && (
            <NavItem
              icon={<CalendarPlus size={20} color={activeTab === 'RegisterPatient' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />}
              label="Book Appt"
              active={activeTab === 'RegisterPatient'}
              color={COLORS.secondary}
              onPress={() => handleTabPress('RegisterPatient')}
            />
          )}

          {!isHR && !isRegularStaff && (
            <NavItem
              icon={<Users size={20} color={activeTab === 'ReceptionPanel' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />}
              label="All Patients"
              active={activeTab === 'ReceptionPanel'}
              color={COLORS.secondary}
              onPress={() => handleTabPress('ReceptionPanel')}
            />
          )}

          {!isHR && !isDoctor && !isRegularStaff && (
            <NavItem
              icon={<Pill size={20} color={activeTab === 'MedicineRequestList' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />}
              label="Medicine Req"
              active={activeTab === 'MedicineRequestList'}
              color={COLORS.secondary}
              badgeCount={pendingMedReqCount}
              onPress={() => handleTabPress('MedicineRequestList')}
            />
          )}

          {isRegularStaff && (
            <>
              <NavItem
                icon={<Clock size={20} color={COLORS.muted} style={{ marginBottom: 4 }} />}
                label="Attendance"
                active={false}
                color={COLORS.secondary}
                onPress={() => navigation.navigate('MyAttendance')}
              />

              <NavItem
                icon={<CalendarPlus size={20} color={COLORS.muted} style={{ marginBottom: 4 }} />}
                label="Apply Leave"
                active={false}
                color={COLORS.secondary}
                onPress={() => navigation.navigate('ApplyLeave')}
              />

              <NavItem
                icon={<FileText size={20} color={COLORS.muted} style={{ marginBottom: 4 }} />}
                label="Payslips"
                active={false}
                color={COLORS.secondary}
                onPress={() => navigation.navigate('MyPayslips')}
              />
            </>
          )}

          {isHR && (
            <TouchableOpacity
              style={styles.navItem}
              activeOpacity={1}
              onPress={() => {
                if (!isPunchedIn) {
                  alert('Please punch in (check-in) on the Dashboard first to unlock HR Portal.');
                  return;
                }
                setActiveTab('HRDashboard');
              }}
              disabled={loadingPunch}
            >
              {!isPunchedIn ? (
                <Lock size={20} color={COLORS.danger} style={{ marginBottom: 4 }} />
              ) : (
                <Briefcase size={20} color={activeTab === 'HRDashboard' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />
              )}
              <Text style={[styles.navText, activeTab === 'HRDashboard' && { color: COLORS.secondary }, !isPunchedIn && { color: COLORS.danger }]}>
                {!isPunchedIn ? 'Locked' : 'HR'}
              </Text>
            </TouchableOpacity>
          )}

          {isDoctor && (
            <TouchableOpacity style={styles.navItem} activeOpacity={1} onPress={() => setActiveTab('PackageMembers')}>
              <Package size={20} color={activeTab === 'PackageMembers' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />
              <Text style={[styles.navText, activeTab === 'PackageMembers' && { color: COLORS.secondary }]}>Packages</Text>
            </TouchableOpacity>
          )}

          {isDoctor && userData?.doctorType === 'head' && (
            <TouchableOpacity style={styles.navItem} activeOpacity={1} onPress={() => navigation.navigate('RevenueDashboard')}>
              <IndianRupee size={20} color={COLORS.muted} style={{ marginBottom: 4 }} />
              <Text style={styles.navText}>Revenue</Text>
            </TouchableOpacity>
          )}

          {!isDoctor && (
            <TouchableOpacity style={styles.navItem} activeOpacity={1} onPress={handleLogout}>
              <LogOut size={20} color={COLORS.danger} style={{ marginBottom: 4 }} />
              <Text style={[styles.navText, { color: COLORS.danger }]}>Logout</Text>
            </TouchableOpacity>
          )}

          {/* History tab removed as requested
          {isDoctor && (
            <TouchableOpacity style={styles.navItem} activeOpacity={1} onPress={() => setActiveTab('DoctorHistory')}>
              <History size={20} color={activeTab === 'DoctorHistory' ? COLORS.secondary : COLORS.muted} style={{ marginBottom: 4 }} />
              <Text style={[styles.navText, activeTab === 'DoctorHistory' && { color: COLORS.secondary }]}>History</Text>
            </TouchableOpacity>
          )}
          */}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1 },
  bottomNav: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeDotText: { fontSize: 8, fontWeight: '900', color: '#fff' },
});

export default MainTabScreen;
