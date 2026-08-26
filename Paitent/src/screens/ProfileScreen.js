import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, Platform, Modal } from 'react-native';
import { Text, Surface, Avatar, IconButton, Badge, Portal, TextInput, Button } from 'react-native-paper';
import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { 
  User, Phone, Mail, Calendar, Edit3, Camera, 
  Bell, ChevronLeft, ChevronRight, LayoutGrid, 
  History, FileHeart, CreditCard, ShieldCheck, 
  MapPin, HelpCircle, Info, LogOut, FileText, Coins, HeartPulse 
} from 'lucide-react-native';
import { auth, db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';

const ProfileScreen = ({ navigation }) => {
  const { userData } = useAuth();
  const [editVisible, setEditVisible] = useState(false);
  const [editedName, setEditedName] = useState(userData?.fullName || '');
  const [editedEmail, setEditedEmail] = useState(userData?.email || '');
  const [loading, setLoading] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'patients', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setRewardPoints(docSnap.data().rewardPoints || 0);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => auth.signOut() }
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(db, 'patients', auth.currentUser.uid);
      await updateDoc(userRef, {
        fullName: editedName,
        email: editedEmail,
      });
      setEditVisible(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const QuickAccessItem = ({ icon: Icon, label, color, onPress }) => (
    <TouchableOpacity style={styles.quickAccessItem} onPress={onPress}>
      <View style={styles.quickIconContainer}>
        <Icon size={26} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const SettingItem = ({ icon: Icon, title, subtitle, color, onPress }) => (
    <TouchableOpacity onPress={onPress} style={styles.settingItem}>
      <View style={styles.settingIconContainer}>
        <Icon size={22} color={color} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={COLORS.muted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon={() => <Bell size={24} color={COLORS.text} />} onPress={() => {}} />
          <Badge size={16} style={styles.badge}>2</Badge>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Surface style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar.Text 
              size={80} 
              label={userData?.fullName?.charAt(0) || 'P'} 
              style={styles.avatarBg}
            />
            <Surface style={styles.cameraBtn}>
              <Camera size={14} color={COLORS.white} />
            </Surface>
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>{userData?.fullName || 'Guest Patient'}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)}>
                <Edit3 size={14} color={COLORS.secondary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Phone size={14} color={COLORS.muted} />
              <Text style={styles.detailText}>+91 {userData?.phone || '83740 62188'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Mail size={14} color={COLORS.muted} />
              <Text style={styles.detailText} numberOfLines={1}>{userData?.email || 'Not Provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Coins size={14} color="#f59e0b" />
              <Text style={[styles.detailText, { color: '#b45309', fontWeight: 'bold' }]}>Reward Points: {rewardPoints} pts</Text>
            </View>
            <View style={styles.detailRow}>
              <Calendar size={14} color={COLORS.muted} />
              <Text style={styles.detailText}>{userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Joined Today'}</Text>
            </View>
          </View>
        </Surface>

        {/* Quick Access */}
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.quickAccessCard}>
          <QuickAccessItem 
            icon={LayoutGrid} 
            label="Appointments" 
            color={COLORS.secondary} 
            onPress={() => navigation.navigate('MyAppointments', { initialTab: 'Upcoming' })}
          />
          <QuickAccessItem 
            icon={History} 
            label="Bookings" 
            color="#10b981" 
            onPress={() => navigation.navigate('MyAppointments', { initialTab: 'History' })}
          />
          <QuickAccessItem 
            icon={FileHeart} 
            label="Records" 
            color="#ef4444" 
            onPress={() => navigation.navigate('Reports')}
          />
          <QuickAccessItem 
            icon={Coins} 
            label="My Wallet" 
            color="#f59e0b" 
            onPress={() => navigation.navigate('WalletDetails')}
          />
        </View>

        {/* Account Settings */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <Surface style={styles.settingsCard}>
          <SettingItem 
            icon={User} 
            title="Personal Information" 
            subtitle="Update your name and email" 
            color={COLORS.secondary} 
            onPress={() => setEditVisible(true)} 
          />
          <SettingItem 
            icon={Coins} 
            title="Reward Wallet" 
            subtitle={`View coupons & ${rewardPoints} points`} 
            color="#f59e0b" 
            onPress={() => navigation.navigate('WalletDetails')} 
          />
          <SettingItem 
            icon={HeartPulse} 
            title="Diet Plan" 
            subtitle="View your customized diet plans" 
            color="#ec4899" 
            onPress={() => navigation.navigate('DietPlan')} 
          />
          <SettingItem 
            icon={FileText} 
            title="Medicine Forms" 
            subtitle="View and download medicine forms" 
            color="#ec4899" 
            onPress={() => navigation.navigate('MedicineFormView')} 
          />
          <SettingItem 
            icon={ShieldCheck} 
            title="Privacy & Security" 
            subtitle="Manage your account security" 
            color="#10b981" 
            onPress={() => {}} 
          />
          <SettingItem 
            icon={Bell} 
            title="Notifications" 
            subtitle="Manage notification preferences" 
            color="#f59e0b" 
            onPress={() => navigation.navigate('Notifications')} 
          />
          <SettingItem 
            icon={MapPin} 
            title="Saved Addresses" 
            subtitle="Manage your saved addresses" 
            color="#6366f1" 
            onPress={() => {}} 
          />
          <SettingItem 
            icon={HelpCircle} 
            title="Help & Support" 
            subtitle="Get help and contact support" 
            color={COLORS.secondary} 
            onPress={() => navigation.navigate('HelpSupport')} 
          />
          <SettingItem 
            icon={Info} 
            title="About Us" 
            subtitle="Learn more about our app" 
            color="#64748b" 
            onPress={() => navigation.navigate('TermsConditions')} 
          />
        </Surface>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal 
        visible={editVisible} 
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              label="Full Name"
              value={editedName}
              onChangeText={setEditedName}
              mode="outlined"
              style={styles.modalInput}
              outlineColor="#e2e8f0"
              activeOutlineColor={COLORS.secondary}
            />
            <TextInput
              label="Email Address"
              value={editedEmail}
              onChangeText={setEditedEmail}
              mode="outlined"
              style={styles.modalInput}
              outlineColor="#e2e8f0"
              activeOutlineColor={COLORS.secondary}
              keyboardType="email-address"
            />
            <Button 
              mode="contained" 
              onPress={handleUpdateProfile} 
              loading={loading}
              style={styles.saveBtn}
              buttonColor={COLORS.secondary}
            >
              Save Changes
            </Button>
            <Button onPress={() => setEditVisible(false)} textColor={COLORS.muted}>
              Cancel
            </Button>
          </Surface>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfdfe' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444' },
  content: { padding: 16 },
  profileCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    marginBottom: 20,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  avatarContainer: { position: 'relative' },
  avatarBg: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.secondary },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.secondary,
    padding: 5,
    borderRadius: 15,
    elevation: 2,
  },
  infoContainer: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  userName: { fontSize: 16, fontWeight: '800', color: '#1e293b', flex: 1 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginLeft: 8
  },
  editBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, marginLeft: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailText: { fontSize: 13, color: '#64748b', marginLeft: 8, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16, marginTop: 8 },
  quickAccessCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  quickAccessItem: { alignItems: 'center', width: '22%' },
  quickIconContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 10, color: '#64748b', textAlign: 'center', fontWeight: '600' },
  settingsCard: {
    borderRadius: 24,
    backgroundColor: COLORS.white,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingIconContainer: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  settingTextContainer: { flex: 1, marginLeft: 16 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  settingSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#ef4444', marginLeft: 10 },
  footerSpacing: { height: 40 },
  modal: { backgroundColor: COLORS.white, padding: 24, margin: 20, borderRadius: 24, width: '90%', alignSelf: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 20 },
  modalInput: { marginBottom: 16, backgroundColor: COLORS.white },
  saveBtn: { marginTop: 8, marginBottom: 8, borderRadius: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileScreen;
