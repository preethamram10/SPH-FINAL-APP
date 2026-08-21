import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Keyboard } from 'react-native';
import { Text, TextInput, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { ChevronLeft, Building, PlusCircle, Check, IndianRupee, Clock, User, Phone, Mail, Lock, Heart, Award, Info } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};
const AddStaff = ({ navigation, route }) => {
  const editEmployeeId = route.params?.editEmployeeId;
  const isEditMode = !!editEmployeeId;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('staff');
  const [doctorType, setDoctorType] = useState('employee'); // 'head' | 'employee'
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(true);
  const [tempBranchId, setTempBranchId] = useState(null);
  // Salary & schedule fields
  const [salary, setSalary] = useState('');
  const [shiftType, setShiftType] = useState('single'); // 'single' | 'multi'
  const [loginTime, setLoginTime] = useState(new Date(new Date().setHours(9, 0, 0, 0)));
  const [logoutTime, setLogoutTime] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [loginTime2, setLoginTime2] = useState(new Date(new Date().setHours(16, 0, 0, 0)));
  const [logoutTime2, setLogoutTime2] = useState(new Date(new Date().setHours(21, 0, 0, 0)));
  const [showLoginPicker, setShowLoginPicker] = useState(false);
  const [showLogoutPicker, setShowLogoutPicker] = useState(false);
  const [showLogin2Picker, setShowLogin2Picker] = useState(false);
  const [showLogout2Picker, setShowLogout2Picker] = useState(false);
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  const timeToString = (date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = String(hours).padStart(2, '0');
    return `${strHours}:${minutes} ${ampm}`;
  };
  const stringToTime = (str) => {
    if (!str) return new Date();
    const isPM = str.toLowerCase().includes('pm');
    const isAM = str.toLowerCase().includes('am');
    const parts = str.replace(/[a-zA-Z]/g, '').trim().split(':').map(Number);
    let hrs = parts[0] || 0;
    const mins = parts[1] || 0;

    if (isPM && hrs < 12) hrs += 12;
    if (isAM && hrs === 12) hrs = 0;

    const d = new Date();
    d.setHours(hrs, mins, 0, 0);
    return d;
  };
  const fetchBranches = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'branch'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setBranches(data);
      if (data.length > 0 && !isEditMode) {
        setSelectedBranch(data[0]);
      }
    } catch (e) {
      console.error('Error fetching branches:', e);
    } finally {
      setFetchingBranches(false);
    }
  };
  useEffect(() => {
    fetchBranches();
  }, []);
  // Fetch staff data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      const fetchEmployee = async () => {
        setLoading(true);
        try {
          const docRef = doc(db, 'users', editEmployeeId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || '');
            setPhone(data.phone || '');
            setEmail(data.email || '');
            setRole(data.role || 'staff');
            setDoctorType(data.doctorType || 'employee');
            setSalary(data.salary ? String(data.salary) : '');
            setShiftType(data.shiftType || 'single');
            setLoginTime(stringToTime(data.loginTime || '09:00 AM'));
            setLogoutTime(stringToTime(data.logoutTime || '06:00 PM'));
            setLoginTime2(stringToTime(data.loginTime2 || '04:00 PM'));
            setLogoutTime2(stringToTime(data.logoutTime2 || '09:00 PM'));
            if (data.branchId) {
              setTempBranchId(data.branchId);
            }
          }
        } catch (e) {
          console.error('Error fetching employee:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchEmployee();
    }
  }, [editEmployeeId]);
  // Match tempBranchId once branches are loaded
  useEffect(() => {
    if (branches.length > 0 && tempBranchId) {
      const match = branches.find(b => b.id === tempBranchId);
      if (match) {
        setSelectedBranch(match);
      }
    }
  }, [branches, tempBranchId]);
  const handleSaveStaff = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter staff full name.');
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!phone.trim() || cleanPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const isEmailRole = ['staff', 'hr'].includes(role);
    const emailToUse = email.trim().toLowerCase();
    if (isEmailRole) {
      if (!email.trim() || !email.includes('@')) {
        Alert.alert('Error', 'Please enter a valid email address.');
        return;
      }
      if (!password || password.trim().length < 6) {
        Alert.alert('Error', 'Please enter a password of at least 6 characters.');
        return;
      }
    }
    if (['staff', 'receptionist'].includes(role) && !selectedBranch) {
      Alert.alert('Error', 'Please select a branch.');
      return;
    }
    if ((role === 'staff' || (role === 'doctor' && doctorType === 'employee')) && (!salary.trim() || isNaN(parseFloat(salary)))) {
      Alert.alert('Error', 'Please enter a valid monthly salary amount.');
      return;
    }
    setLoading(true);
    try {
      // 1. Check duplicate phone number
      const phoneCheckQ = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const phoneSnap = await getDocs(phoneCheckQ);
      if (!phoneSnap.empty) {
        Alert.alert('Duplicate Phone', 'A staff member with this phone number already exists.');
        setLoading(false);
        return;
      }
      // 2. Check duplicate email for email roles
      if (isEmailRole) {
        const emailCheckQ = query(collection(db, 'users'), where('email', '==', emailToUse));
        const emailSnap = await getDocs(emailCheckQ);
        if (!emailSnap.empty) {
          Alert.alert('Duplicate Email', 'A staff member with this email address already exists.');
          setLoading(false);
          return;
        }

        // Secondary Auth App creation so we don't log out current HR manager
        let secondaryApp;
        if (getApps().some(app => app.name === 'SecondaryApp_Staff')) {
          secondaryApp = getApp('SecondaryApp_Staff');
        } else {
          secondaryApp = initializeApp(auth.app.options, 'SecondaryApp_Staff');
        }
        let secondaryAuth;
        try {
          secondaryAuth = initializeAuth(secondaryApp, {
            persistence: inMemoryPersistence
          });
        } catch (error) {
          secondaryAuth = getSecondaryAuth(secondaryApp);
        }
        // Create Auth User
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, password);
        const newUserId = userCredential.user.uid;
        // Set doc in Firestore
        const docData = {
          uid: newUserId,
          name: name.trim(),
          phone: cleanPhone,
          email: emailToUse,
          role: role,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        if (['staff', 'receptionist'].includes(role)) {
          docData.branchId = selectedBranch.id;
          docData.branchName = selectedBranch.name;
        }
        if (role === 'staff') {
          docData.salary = parseFloat(salary);
          docData.shiftType = shiftType || 'single';
          docData.loginTime = timeToString(loginTime);
          docData.logoutTime = timeToString(logoutTime);
          if (shiftType === 'multi') {
            docData.loginTime2 = timeToString(loginTime2);
            docData.logoutTime2 = timeToString(logoutTime2);
          }
        }
        await setDoc(doc(db, 'users', newUserId), docData);
        await secondaryAuth.signOut();
      } else {
        // Phone-based Doctor or Receptionist Role
        const docData = {
          name: name.trim(),
          phone: cleanPhone,
          role: role,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        if (['staff', 'receptionist'].includes(role)) {
          docData.branchId = selectedBranch.id;
          docData.branchName = selectedBranch.name;
        }
        if (role === 'doctor') {
          docData.doctorType = doctorType;
          if (doctorType === 'employee') {
            docData.salary = parseFloat(salary);
            docData.shiftType = shiftType || 'single';
            docData.loginTime = timeToString(loginTime);
            docData.logoutTime = timeToString(logoutTime);
            if (shiftType === 'multi') {
              docData.loginTime2 = timeToString(loginTime2);
              docData.logoutTime2 = timeToString(logoutTime2);
            }
          }
        }

        await addDoc(collection(db, 'users'), docData);
      }

      Alert.alert('Success', `${name} has been added successfully!`);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTab');
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'Failed to add staff: This email address is already in use by another user account. Please use a different email address.');
      } else {
        Alert.alert('Error', 'Failed to add staff member: ' + (error.message || error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter staff full name.');
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!phone.trim() || cleanPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    const isEmailRole = ['staff', 'hr'].includes(role);
    const emailToUse = email.trim().toLowerCase();

    if (isEmailRole) {
      if (!email.trim() || !email.includes('@')) {
        Alert.alert('Error', 'Please enter a valid email address.');
        return;
      }
    }

    if (['staff', 'receptionist'].includes(role) && !selectedBranch) {
      Alert.alert('Error', 'Please select a branch.');
      return;
    }

    if ((role === 'staff' || (role === 'doctor' && doctorType === 'employee')) && (!salary.trim() || isNaN(parseFloat(salary)))) {
      Alert.alert('Error', 'Please enter a valid monthly salary amount.');
      return;
    }

    setLoading(true);
    try {
      // Check duplicate phone number excluding edited user
      const phoneCheckQ = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const phoneSnap = await getDocs(phoneCheckQ);
      const otherPhoneUser = phoneSnap.docs.find(d => d.id !== editEmployeeId);
      if (otherPhoneUser) {
        Alert.alert('Duplicate Phone', 'Another staff member with this phone number already exists.');
        setLoading(false);
        return;
      }

      // Check duplicate email for email roles excluding edited user
      if (isEmailRole) {
        const emailCheckQ = query(collection(db, 'users'), where('email', '==', emailToUse));
        const emailSnap = await getDocs(emailCheckQ);
        const otherEmailUser = emailSnap.docs.find(d => d.id !== editEmployeeId);
        if (otherEmailUser) {
          Alert.alert('Duplicate Email', 'Another staff member with this email address already exists.');
          setLoading(false);
          return;
        }
      }

      const updatePayload = {
        name: name.trim(),
        phone: cleanPhone,
        role: role,
      };

      if (['staff', 'hr'].includes(role)) {
        updatePayload.email = emailToUse;
      } else {
        updatePayload.email = deleteField();
      }

      if (['staff', 'receptionist'].includes(role)) {
        updatePayload.branchId = selectedBranch.id;
        updatePayload.branchName = selectedBranch.name;
      } else {
        updatePayload.branchId = deleteField();
        updatePayload.branchName = deleteField();
      }

      if (role === 'doctor') {
        updatePayload.doctorType = doctorType;
      } else {
        updatePayload.doctorType = deleteField();
      }

      if (role === 'staff' || (role === 'doctor' && doctorType === 'employee')) {
        updatePayload.salary = parseFloat(salary) || 0;
        updatePayload.shiftType = shiftType || 'single';
        updatePayload.loginTime = timeToString(loginTime);
        updatePayload.logoutTime = timeToString(logoutTime);
        if (shiftType === 'multi') {
          updatePayload.loginTime2 = timeToString(loginTime2);
          updatePayload.logoutTime2 = timeToString(logoutTime2);
        } else {
          updatePayload.loginTime2 = deleteField();
          updatePayload.logoutTime2 = deleteField();
        }
      } else {
        updatePayload.salary = deleteField();
        updatePayload.shiftType = deleteField();
        updatePayload.loginTime = deleteField();
        updatePayload.logoutTime = deleteField();
        updatePayload.loginTime2 = deleteField();
        updatePayload.logoutTime2 = deleteField();
      }

      await updateDoc(doc(db, 'users', editEmployeeId), updatePayload);

      Alert.alert('Success', `Staff details updated successfully.`);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTab');
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      Alert.alert('Error', 'Failed to update staff details: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Staff Member' : 'Add New Staff'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 1. Assign Staff Role */}
        <Surface style={styles.formCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.formTitle}>Assign Staff Role</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
            {[
              { value: 'staff', label: 'Regular Staff', color: '#3b82f6', bg: '#eff6ff' },
              { value: 'receptionist', label: 'Receptionist', color: '#ec4899', bg: '#fdf2f8' },
              { value: 'doctor', label: 'Doctor', color: '#10b981', bg: '#f0fdf4' },
              { value: 'hr', label: 'HR Manager', color: '#f59e0b', bg: '#fffbeb' },
            ].map(r => {
              const isSelected = role === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleGridBtn,
                    isSelected ? { borderColor: r.color, backgroundColor: r.bg } : styles.roleGridBtnInactive
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[
                    styles.roleGridBtnText,
                    isSelected && { color: r.color, fontWeight: '800' }
                  ]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Doctor Category */}
          {role === 'doctor' && (
            <View style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <Text style={[styles.formTitle, { marginBottom: 12 }]}>Doctor Category</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.categoryBtn, doctorType === 'head' ? styles.categoryBtnActive : styles.categoryBtnInactive]}
                  onPress={() => setDoctorType('head')}
                >
                  <Text style={[styles.categoryBtnText, doctorType === 'head' && styles.categoryBtnTextActive]}>Head Doctor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.categoryBtn, doctorType === 'employee' ? styles.categoryBtnActive : styles.categoryBtnInactive]}
                  onPress={() => setDoctorType('employee')}
                >
                  <Text style={[styles.categoryBtnText, doctorType === 'employee' && styles.categoryBtnTextActive]}>Employee Doctor</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Surface>

        {/* 2. Personal Details */}
        <Surface style={styles.formCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: COLORS.secondary }]} />
            <Text style={styles.formTitle}>Staff Personal Details</Text>
          </View>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            activeOutlineColor={COLORS.secondary}
            outlineColor={COLORS.border}
            outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
            style={styles.input}
            textColor={COLORS.text}
            theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
            left={<TextInput.Icon icon={() => <User size={18} color={COLORS.secondary} />} />}
          />
          <TextInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            mode="outlined"
            activeOutlineColor={COLORS.secondary}
            outlineColor={COLORS.border}
            outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
            style={styles.input}
            textColor={COLORS.text}
            theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
            left={<TextInput.Icon icon={() => <Phone size={18} color={COLORS.secondary} />} />}
          />
          {['staff', 'hr'].includes(role) && (
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
              style={styles.input}
              textColor={COLORS.text}
              theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
              left={<TextInput.Icon icon={() => <Mail size={18} color={COLORS.secondary} />} />}
            />
          )}
          {!isEditMode && ['staff', 'hr'].includes(role) && (
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
              style={styles.input}
              textColor={COLORS.text}
              theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
              left={<TextInput.Icon icon={() => <Lock size={18} color={COLORS.secondary} />} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          )}
        </Surface>

        {/* 3. Branch Assignment */}
        {['staff', 'receptionist'].includes(role) && (
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.formTitle}>Select Clinic Branch Assignment</Text>
            </View>
            {fetchingBranches ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : branches.length === 0 ? (
              <Text style={styles.emptyText}>No branches available.</Text>
            ) : (
              <View style={styles.branchesGrid}>
                {branches.map((b) => {
                  const isSelected = selectedBranch?.id === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.branchCard, isSelected && styles.selectedBranchCard]}
                      onPress={() => setSelectedBranch(b)}
                    >
                      <View style={[styles.branchCardIcon, isSelected && { backgroundColor: COLORS.secondary + '15' }]}>
                        <Building size={16} color={isSelected ? COLORS.secondary : COLORS.muted} />
                      </View>
                      <Text numberOfLines={1} style={[styles.branchCardName, isSelected && styles.selectedBranchCardName]}>
                        {b.name}
                      </Text>
                      {isSelected ? (
                        <View style={styles.checkBadge}>
                          <Check size={10} color="white" />
                        </View>
                      ) : (
                        <View style={styles.uncheckBadge} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Surface>
        )}

        {/* 4. Salary & Work Schedule */}
        {(role === 'staff' || (role === 'doctor' && doctorType === 'employee')) && (
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.formTitle}>Salary & Work Schedule</Text>
            </View>

            <TextInput
              label="Monthly Base Salary (Rs)"
              value={salary}
              onChangeText={setSalary}
              keyboardType="numeric"
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
              style={styles.input}
              textColor={COLORS.text}
              theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
              left={<TextInput.Icon icon={() => <IndianRupee size={18} color={COLORS.secondary} />} />}
            />

            <Text style={styles.scheduleLabel}>Shift Type</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.categoryBtn, shiftType === 'single' ? styles.categoryBtnActive : styles.categoryBtnInactive]}
                onPress={() => setShiftType('single')}
              >
                <Text style={[styles.categoryBtnText, shiftType === 'single' && styles.categoryBtnTextActive]}>Single Strict</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryBtn, shiftType === 'multi' ? styles.categoryBtnActive : styles.categoryBtnInactive]}
                onPress={() => setShiftType('multi')}
              >
                <Text style={[styles.categoryBtnText, shiftType === 'multi' && styles.categoryBtnTextActive]}>Multi Strict</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.scheduleLabel}>Shift Timings</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowLoginPicker(true)}>
                <Clock size={16} color={COLORS.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeBtnLabel}>Login Time {shiftType === 'multi' && '1'}</Text>
                  <Text style={styles.timeBtnValue}>{formatTime(loginTime)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowLogoutPicker(true)}>
                <Clock size={16} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeBtnLabel}>Logout Time {shiftType === 'multi' && '1'}</Text>
                  <Text style={styles.timeBtnValue}>{formatTime(logoutTime)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {shiftType === 'multi' && (
              <View style={[styles.timeRow, { marginTop: 4 }]}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setShowLogin2Picker(true)}>
                  <Clock size={16} color={COLORS.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeBtnLabel}>Login Time 2</Text>
                    <Text style={styles.timeBtnValue}>{formatTime(loginTime2)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setShowLogout2Picker(true)}>
                  <Clock size={16} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeBtnLabel}>Logout Time 2</Text>
                    <Text style={styles.timeBtnValue}>{formatTime(logoutTime2)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.ruleCard}>
              <Info size={16} color="#f97316" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ruleTitle}>Deduction Rule</Text>
                <Text style={styles.ruleText}>
                  Every 3 days late (more than 15 min late clock-in) = Rs 500 deduction from monthly salary
                </Text>
              </View>
            </View>
          </Surface>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={isEditMode ? handleUpdateStaff : handleSaveStaff}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.secondary,
            paddingVertical: 14,
            borderRadius: 14,
            gap: 8,
            marginTop: 20,
            elevation: 3,
            shadowColor: COLORS.secondary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <PlusCircle size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
                {isEditMode ? 'Save Changes' : 'Add Staff & Grant Access'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
      {showLoginPicker && (
        <DateTimePicker
          value={loginTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedTime) => {
            setShowLoginPicker(false);
            if (selectedTime) setLoginTime(selectedTime);
          }}
        />
      )}
      {showLogoutPicker && (
        <DateTimePicker
          value={logoutTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedTime) => {
            setShowLogoutPicker(false);
            if (selectedTime) setLogoutTime(selectedTime);
          }}
        />
      )}
      {showLogin2Picker && (
        <DateTimePicker
          value={loginTime2}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedTime) => {
            setShowLogin2Picker(false);
            if (selectedTime) setLoginTime2(selectedTime);
          }}
        />
      )}
      {showLogout2Picker && (
        <DateTimePicker
          value={logoutTime2}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedTime) => {
            setShowLogout2Picker(false);
            if (selectedTime) setLogoutTime2(selectedTime);
          }}
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: 16 },
  formCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionAccent: { width: 4, height: 16, borderRadius: 2, backgroundColor: COLORS.secondary },
  branchesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  branchCard: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    position: 'relative'
  },
  selectedBranchCard: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + '0a'
  },
  branchCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  branchCardName: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  selectedBranchCardName: { color: COLORS.secondary, fontWeight: '700' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  uncheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white
  },
  emptyText: { color: COLORS.muted, fontStyle: 'italic', marginVertical: 8 },
  categoryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBtnActive: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + '10',
  },
  categoryBtnInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  categoryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  categoryBtnTextActive: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  roleGridBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleGridBtnInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  roleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000006',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleGridBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  input: { backgroundColor: COLORS.white, marginBottom: 12 },
  scheduleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 10, marginTop: 4 },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background
  },
  timeBtnLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '600' },
  timeBtnValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  ruleCard: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 12,
    gap: 8
  },
  ruleTitle: { fontSize: 12, fontWeight: '700', color: '#f97316', marginBottom: 4 },
  ruleText: { fontSize: 11, color: '#c2410c', lineHeight: 16 },
});

export default AddStaff;
