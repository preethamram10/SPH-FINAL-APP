import React from 'react';
import { LogBox, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useNetInfo } from '@react-native-community/netinfo';

// v5 - updated RE-BOOKING tag logic
LogBox.ignoreLogs([
  'expo-notifications',
  '@firebase/firestore',
  'WebChannelConnection RPC',
]);

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('@firebase/firestore') ||
    args[0].includes('WebChannelConnection') ||
    args[0].includes('expo-notifications')
  )) return;
  originalConsoleWarn(...args);
};
// Screens
import LoginScreen from './src/screens/LoginScreen';
import Dashboard from './src/screens/Dashboard';
import AttendanceList from './src/screens/hr/AttendanceList';
import LeaveApprovals from './src/screens/hr/LeaveApprovals';
import FeeDiscounts from './src/screens/hr/FeeDiscounts';
import SalaryManagement from './src/screens/hr/SalaryManagement';
import LeaveRequest from './src/screens/LeaveRequest';
import AddStaff from './src/screens/hr/AddStaff';
import BranchSelection from './src/screens/hr/BranchSelection';
import EmployeeDetails from './src/screens/hr/EmployeeDetails';
import GlobalAttendance from './src/screens/hr/GlobalAttendance';
import ReceptionPanel from './src/screens/reception/ReceptionPanel';
import RegisterPatient from './src/screens/reception/RegisterPatient';
import PatientDetails from './src/screens/reception/PatientDetails';
import MainTabScreen from './src/screens/reception/MainTabScreen';
import PatientProfile from './src/screens/reception/PatientProfile';
import HRDashboard from './src/screens/hr/HRDashboard';
import ApplyLeave from './src/screens/reception/ApplyLeave';
import MyAttendance from './src/screens/reception/MyAttendance';
import ShippingForm from './src/screens/reception/ShippingForm';
import Notifications from './src/screens/reception/Notifications';
import ManageBanners from './src/screens/hr/ManageBanners';
import ManageVideos from './src/screens/hr/ManageVideos';
import TargetManagement from './src/screens/hr/TargetManagement';
import MyPayslips from './src/screens/reception/MyPayslips';
import ManageBranches from './src/screens/hr/ManageBranches';
import CompleteProfiles from './src/screens/hr/CompleteProfiles';
import FollowUps from './src/screens/FollowUps';
import PatientRequestForm from './src/screens/reception/PatientRequestForm';
import RewardPointClaim from './src/screens/reception/RewardPointClaim';
import MedicineRequestList from './src/screens/reception/MedicineRequestList';
import MedicineFormEditor from './src/screens/reception/MedicineFormEditor';
import RevenueDashboard from './src/screens/hr/RevenueDashboard';
import UpcomingAppointments from './src/screens/reception/UpcomingAppointmentsScreen';
import DoctorNoShow from './src/screens/reception/DoctorNoShow';
import MyDeductions from './src/screens/reception/MyDeductions';
import AttendanceMetricDetails from './src/screens/reception/AttendanceMetricDetails';
import MediaManager from './src/screens/reception/MediaManager';
import EmployeeDailyReport from './src/screens/reception/EmployeeDailyReport';
import ClinicCleaningPhotos from './src/screens/reception/ClinicCleaningPhotos';
import CleaningLockScreen from './src/screens/reception/CleaningLockScreen';
import { useCleaningLock } from './src/hooks/useCleaningLock';
import { useScheduleCleaningReminder } from './src/hooks/useScheduleCleaningReminder';
import { registerForPushNotificationsAsync } from './src/utils/notificationHelper';

import { triggerLocalNotification } from './src/utils/notificationHelper';
import { db } from './src/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

const Stack = createNativeStackNavigator();


const Navigation = () => {
  const { user, userData, loading: authLoading } = useAuth();
  const { isLocked, loadingLock } = useCleaningLock();
  useScheduleCleaningReminder(); // Sets up local notification schedule

  React.useEffect(() => {
    if (!user) return;
    const userRole = String(userData?.role || '').toLowerCase();
    const userBranchNorm = String(userData?.branchId || userData?.branchName || userData?.branch || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
    const startTime = Date.now();

    const unsub = onSnapshot(collection(db, 'notifications'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          const docTime = d.createdAt?.seconds ? d.createdAt.seconds * 1000 : (d.timestamp?.seconds ? d.timestamp.seconds * 1000 : Date.now());

          if (docTime >= startTime - 5000) {
            const targetUid = d.userId;
            const targetRole = String(d.targetRole || '').toLowerCase();
            const targetBranch = String(d.branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();

            const isForUser = targetUid === user.uid || (userData?.id && targetUid === userData.id);
            const isForRole = targetRole && userRole.includes(targetRole);
            const isForBranch = targetBranch && (targetBranch === userBranchNorm || userBranchNorm.includes(targetBranch));

            if (isForUser || isForRole || isForBranch) {
              triggerLocalNotification(
                d.title || 'New Notification 🔔',
                d.body || d.message || 'You have a new update.',
                d
              );
            }
          }
        }
      });
    }, (err) => {
      console.warn('[App.js] Notification listener warning:', err);
    });

    return () => unsub();
  }, [user, userData]);

  if (authLoading || (user && loadingLock)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (user && isLocked) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="CleaningLock" component={CleaningLockScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTab" component={MainTabScreen} />
          <Stack.Screen name="UpcomingAppointments" component={UpcomingAppointments} />
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="AttendanceList" component={AttendanceList} />
          <Stack.Screen name="LeaveApprovals" component={LeaveApprovals} />
          <Stack.Screen name="FeeDiscounts" component={FeeDiscounts} />
          <Stack.Screen name="SalaryManagement" component={SalaryManagement} />
          <Stack.Screen name="LeaveRequest" component={LeaveRequest} />
          <Stack.Screen name="BranchSelection" component={BranchSelection} />
          <Stack.Screen name="AddStaff" component={AddStaff} />
          <Stack.Screen name="EmployeeDetails" component={EmployeeDetails} />
          <Stack.Screen name="GlobalAttendance" component={GlobalAttendance} />
          <Stack.Screen name="ReceptionPanel" component={ReceptionPanel} />
          <Stack.Screen name="RegisterPatient" component={RegisterPatient} />
          <Stack.Screen name="PatientDetails" component={PatientDetails} />
          <Stack.Screen name="PatientProfile" component={PatientProfile} />
          <Stack.Screen name="HRDashboard" component={HRDashboard} />
          <Stack.Screen name="ApplyLeave" component={ApplyLeave} />
          <Stack.Screen name="MyAttendance" component={MyAttendance} />
          <Stack.Screen name="ShippingForm" component={ShippingForm} />
          <Stack.Screen name="Notifications" component={Notifications} />
          <Stack.Screen name="ManageBanners" component={ManageBanners} />
          <Stack.Screen name="ManageVideos" component={ManageVideos} />
          <Stack.Screen name="TargetManagement" component={TargetManagement} />
          <Stack.Screen name="MyPayslips" component={MyPayslips} />
          <Stack.Screen name="ManageBranches" component={ManageBranches} />
          <Stack.Screen name="CompleteProfiles" component={CompleteProfiles} />
          <Stack.Screen name="FollowUps" component={FollowUps} />
          <Stack.Screen name="PatientRequestForm" component={PatientRequestForm} />
          <Stack.Screen name="RewardPointClaim" component={RewardPointClaim} />
          <Stack.Screen name="MedicineRequestList" component={MedicineRequestList} />
          <Stack.Screen name="MedicineFormEditor" component={MedicineFormEditor} />
          <Stack.Screen name="RevenueDashboard" component={RevenueDashboard} />
          <Stack.Screen name="DoctorNoShow" component={DoctorNoShow} />
          <Stack.Screen name="MediaManager" component={MediaManager} />
          <Stack.Screen name="EmployeeDailyReport" component={EmployeeDailyReport} />
          <Stack.Screen name="ClinicCleaningPhotos" component={ClinicCleaningPhotos} />
          <Stack.Screen name="MyDeductions" component={MyDeductions} />
          <Stack.Screen name="AttendanceMetricDetails" component={AttendanceMetricDetails} />
        </>

      )}
    </Stack.Navigator>
  );
};
export default function App() {
  const netInfo = useNetInfo();

  if (netInfo.isConnected === false) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <PaperProvider>
        <AuthProvider>
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}