import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, ToastAndroid } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, PhoneAuthProvider, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import FirebaseRecaptchaModal from '../components/FirebaseRecaptchaModal';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff, Phone, ShieldCheck } from 'lucide-react-native';
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const SIZES = {
  padding: 20,
  radius: 12,
};

const LoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [staffData, setStaffData] = useState(null);
  const [recaptchaVisible, setRecaptchaVisible] = useState(false);
  const recaptchaResolverRef = useRef(null);

  const [loginMode, setLoginMode] = useState('phone'); // 'phone' or 'email'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSendOTP = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Ultra-fast parallel staff profile pre-check with 800ms max timeout
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const phoneNum = parseInt(cleanPhone, 10);
      let querySnapshot = null;

      try {
        const q1 = query(collection(db, 'users'), where('phone', '==', phoneNum));
        const q2 = query(collection(db, 'users'), where('phone', '==', cleanPhone));
        const q3 = query(collection(db, 'users'), where('phone', '==', `+91${cleanPhone}`));
        const q4 = query(collection(db, 'users'), where('phone', '==', `91${cleanPhone}`));
        const q5 = query(collection(db, 'users'), where('phone', '==', phone.trim()));

        const runQueryWithTimeout = (q) => Promise.race([
          getDocs(q),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 800))
        ]);

        const [snap1, snap2, snap3, snap4, snap5] = await Promise.all([
          runQueryWithTimeout(q1).catch(() => ({ docs: [] })),
          runQueryWithTimeout(q2).catch(() => ({ docs: [] })),
          runQueryWithTimeout(q3).catch(() => ({ docs: [] })),
          runQueryWithTimeout(q4).catch(() => ({ docs: [] })),
          runQueryWithTimeout(q5).catch(() => ({ docs: [] }))
        ]);

        const allDocs = [
          ...(snap1?.docs || []),
          ...(snap2?.docs || []),
          ...(snap3?.docs || []),
          ...(snap4?.docs || []),
          ...(snap5?.docs || [])
        ];

        if (allDocs.length > 0) {
          const staffDoc = allDocs.find(d => {
            const r = String(d.data().role || '').toLowerCase().trim();
            return r !== 'patient' && r !== 'user' && r !== '';
          }) || allDocs[0];
          querySnapshot = staffDoc.data();
        }
      } catch (timeoutErr) {
        console.warn('Staff profile check timed out, proceeding to OTP directly');
      }

      if (querySnapshot) {
        const roleLower = String(querySnapshot.role || '').toLowerCase().trim();
        const statusLower = String(querySnapshot.status || '').toLowerCase().trim();

        const validStaffRoles = [
          'doctor', 'receptionist', 'reception', 'staff', 'hr', 'branch',
          'admin', 'manager', 'dietician', 'pharmacist', 'nurse', 'receptionist_admin'
        ];

        const isAllowedStaff = validStaffRoles.some(r => roleLower.includes(r)) || (roleLower !== '' && roleLower !== 'patient' && roleLower !== 'user');

        if (!isAllowedStaff) {
          setError('Unauthorized: Mobile OTP login is restricted to Doctors and Receptionists.');
          setLoading(false);
          return;
        }
        if (statusLower === 'inactive' || statusLower === 'suspended' || statusLower === 'disabled') {
          setError('Unauthorized: Your staff account access has been suspended/revoked.');
          setLoading(false);
          return;
        }
        setStaffData(querySnapshot);
      }

      const applicationVerifier = {
        type: 'recaptcha',
        verify: () => new Promise((resolve, reject) => {
          recaptchaResolverRef.current = { resolve, reject };
          setRecaptchaVisible(true);
        }),
        _reset: () => { },
        reset: () => { }
      };
      const formattedPhone = `+91${cleanPhone}`;
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhone,
        applicationVerifier
      );
      setVerificationId(verificationId);
      if (Platform.OS === 'android') {
        ToastAndroid.show('OTP Sent successfully to your mobile.', ToastAndroid.SHORT);
      } else {
        Alert.alert('OTP Sent', 'Staff verification code sent to your mobile.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode.trim()
      );
      const userCredential = await signInWithCredential(auth, credential);

      // Get location for login log
      let locationData = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = null;
          try {
            loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          } catch (locErr) {
            console.log('GPS active query failed during login, trying last known position...', locErr);
            try {
              loc = await Location.getLastKnownPositionAsync();
            } catch (fallbackErr) {
              console.warn('Fallback GPS query failed:', fallbackErr);
            }
            if (!loc) {
              loc = { coords: { latitude: 17.3850, longitude: 78.4867, accuracy: 100 } };
            }
          }
          let address = 'Hyderabad, Telangana';
          try {
            const addr = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (addr && addr[0]) {
              address = `${addr[0].name || ''} ${addr[0].city || ''}`.trim() || 'Hyderabad';
            }
          } catch (addrErr) {
            console.warn('Reverse geocode failed during login:', addrErr);
          }
          locationData = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            address: address
          };
        }
      } catch (e) {
        console.warn('Location error during login:', e);
      }
      // Log login activity
      await addDoc(collection(db, 'activity_logs'), {
        userId: userCredential.user.uid,
        userName: staffData?.name || 'Staff Member',
        userRole: staffData?.role || 'staff',
        branchId: staffData?.branchId || '',
        action: 'app_login',
        timestamp: serverTimestamp(),
        location: locationData
      });
    } catch (err) {
      console.warn('OTP verification/login failed:', err.message || err);
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please enter both Email ID and Password');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const emailToUse = email.toLowerCase().trim();
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);

      // Verify user document in users
      let foundStaff = null;
      let foundStaffDocId = null;

      // 1. Try fetching by UID first
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        foundStaff = docSnap.data();
        foundStaffDocId = docSnap.id;
      } else {
        // 2. Try querying by uid field
        const qUid = query(collection(db, 'users'), where('uid', '==', userCredential.user.uid));
        const querySnapshotUid = await getDocs(qUid);
        if (!querySnapshotUid.empty) {
          foundStaff = querySnapshotUid.docs[0].data();
          foundStaffDocId = querySnapshotUid.docs[0].id;
        } else {
          // 3. Query by email (exact case match)
          const q = query(collection(db, 'users'), where('email', '==', emailToUse));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            foundStaff = querySnapshot.docs[0].data();
            foundStaffDocId = querySnapshot.docs[0].id;
          } else {
            // 4. Fallback: case-insensitive in-memory match for all staff/hr/doctor/receptionist
            const qAll = query(collection(db, 'users'), where('role', 'in', ['staff', 'hr', 'doctor', 'receptionist']));
            const querySnapshotAll = await getDocs(qAll);
            const matchedDoc = querySnapshotAll.docs.find(d => d.data().email?.toLowerCase().trim() === emailToUse);
            if (matchedDoc) {
              foundStaff = matchedDoc.data();
              foundStaffDocId = matchedDoc.id;
            }
          }
        }
      }

      if (!foundStaff) {
        setError('Unauthorized: No staff account found with this email.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Associate UID field in Firestore user document if missing or mismatched
      if (foundStaffDocId && (!foundStaff.uid || foundStaff.uid !== userCredential.user.uid)) {
        try {
          await updateDoc(doc(db, 'users', foundStaffDocId), {
            uid: userCredential.user.uid
          });
          foundStaff.uid = userCredential.user.uid;
        } catch (updateErr) {
          console.warn('Could not associate UID with user document:', updateErr);
        }
      }

      const roleLower = String(foundStaff.role || '').toLowerCase().trim();
      if (roleLower !== 'staff' && roleLower !== 'hr' && roleLower !== 'receptionist' && roleLower !== 'doctor') {
        setError('Unauthorized: Email login is restricted to Staff, HR, Receptionists, and Doctors.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      const statusLower = String(foundStaff.status || '').toLowerCase().trim();
      if (statusLower === 'inactive') {
        setError('Unauthorized: Your staff account access has been suspended/revoked.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Get location for login log
      let locationData = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = null;
          try {
            loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          } catch (locErr) {
            console.log('GPS active query failed during email login, trying last known position...', locErr);
            try {
              loc = await Location.getLastKnownPositionAsync();
            } catch (fallbackErr) {
              console.warn('Fallback GPS query failed:', fallbackErr);
            }
            if (!loc) {
              loc = { coords: { latitude: 17.3850, longitude: 78.4867, accuracy: 100 } };
            }
          }
          let address = 'Hyderabad, Telangana';
          try {
            const addr = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (addr && addr[0]) {
              address = `${addr[0].name || ''} ${addr[0].city || ''}`.trim() || 'Hyderabad';
            }
          } catch (addrErr) {
            console.warn('Reverse geocode failed during email login:', addrErr);
          }
          locationData = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            address: address
          };
        }
      } catch (e) {
        console.warn('Location error during email login:', e);
      }

      // Log login activity
      await addDoc(collection(db, 'activity_logs'), {
        userId: userCredential.user.uid,
        userName: foundStaff?.name || 'Staff Member',
        userRole: foundStaff?.role || 'staff',
        branchId: foundStaff?.branchId || '',
        action: 'app_login',
        timestamp: serverTimestamp(),
        location: locationData
      });
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
        console.warn('Failed login attempt: Invalid credentials.');
      } else {
        setError('Login failed. Please check your email and password.');
        console.warn('Email login error:', err.message || err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setError('Please enter your email ID');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const emailToUse = resetEmail.toLowerCase().trim();

      // Check if user has 'doctor' role
      const q = query(collection(db, 'users'), where('email', '==', emailToUse));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        const roleLower = String(userData.role || '').toLowerCase().trim();
        if (roleLower === 'doctor') {
          setError('Password reset is not permitted for Doctor accounts.');
          setLoading(false);
          return;
        }
      }

      await sendPasswordResetEmail(auth, emailToUse);
      setMessage('Password reset link sent to: ' + emailToUse + '. Please check your inbox.');
      Alert.alert('Reset Link Sent', 'Please check your email inbox or spam folder for the password reset link.');
    } catch (err) {
      console.warn('Password reset error:', err.message || err);
      if (err.code === 'auth/user-not-found') {
        setError('No staff account found with this email.');
      } else {
        setError('Failed to send reset link: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        enabled={true}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('../../assets/SH logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>SPH Staff Portal</Text>
            <Text style={styles.subtitle}>Authorized Access Only</Text>
          </View>

          <Surface style={styles.formCard}>
            {showForgotPassword ? (
              <>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 12 }}>
                  Reset Password
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 16 }}>
                  Enter your email address below to receive a password reset link.
                </Text>

                <TextInput
                  label="Email ID"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  mode="outlined"
                  style={styles.input}
                  textColor="#000000"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  placeholder="e.g. staff@sph.com"
                  left={<TextInput.Icon icon={() => <Mail size={20} color={COLORS.muted} />} />}
                />

                {message ? <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10 }}>{message}</Text> : null}
                {error ? <HelperText type="error" visible={true} style={{ marginBottom: 10 }}>{error}</HelperText> : null}

                <Button
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  buttonColor={COLORS.secondary}
                >
                  Send Reset Link
                </Button>

                <TouchableOpacity
                  onPress={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setMessage('');
                  }}
                  style={{ marginTop: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            ) : loginMode === 'email' ? (
              <>
                <TextInput
                  label="Email ID"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  mode="outlined"
                  style={styles.input}
                  textColor="#000000"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  placeholder="e.g. staff@sph.com"
                  left={<TextInput.Icon icon={() => <Mail size={20} color={COLORS.muted} />} />}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  mode="outlined"
                  style={styles.input}
                  textColor="#000000"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  placeholder="Enter password"
                  left={<TextInput.Icon icon={() => <Lock size={20} color={COLORS.muted} />} />}
                  right={<TextInput.Icon icon={() => showPassword ? <EyeOff size={20} color={COLORS.muted} /> : <Eye size={20} color={COLORS.muted} />} onPress={() => setShowPassword(!showPassword)} />}
                />

                <TouchableOpacity
                  onPress={() => {
                    setShowForgotPassword(true);
                    setError('');
                    setMessage('');
                  }}
                  style={{ alignSelf: 'flex-end', marginBottom: 12 }}
                >
                  <Text style={{ color: COLORS.secondary, fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
                </TouchableOpacity>

                {error ? <HelperText type="error" visible={true} style={{ marginBottom: 10 }}>{error}</HelperText> : null}

                <Button
                  mode="contained"
                  onPress={handleEmailLogin}
                  loading={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  buttonColor={COLORS.secondary}
                >
                  Sign In
                </Button>

                <TouchableOpacity
                  onPress={() => {
                    setLoginMode('phone');
                    setError('');
                  }}
                  style={{ marginTop: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Doctor or Receptionist? Sign In with OTP</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {!verificationId ? (
                  <>
                    <TextInput
                      label="Staff Mobile Number"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      mode="outlined"
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.primary}
                      placeholder="10-digit number"
                      left={<TextInput.Icon icon={() => <Phone size={20} color={COLORS.muted} />} />}
                    />

                    {error ? <HelperText type="error" visible={true} style={{ marginBottom: 10 }}>{error}</HelperText> : null}

                    <Button
                      mode="contained"
                      onPress={handleSendOTP}
                      loading={loading}
                      style={styles.button}
                      contentStyle={styles.buttonContent}
                      buttonColor={COLORS.secondary}
                    >
                      Send OTP
                    </Button>

                    <TouchableOpacity
                      onPress={() => {
                        setLoginMode('email');
                        setError('');
                      }}
                      style={{ marginTop: 16, alignItems: 'center' }}
                    >
                      <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Staff or HR? Sign In with Email</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.otpLabel}>Enter the 6-digit code sent to +91 {phone}</Text>
                    <TextInput
                      label="Verification Code"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      mode="outlined"
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.primary}
                      placeholder="123456"
                      left={<TextInput.Icon icon={() => <ShieldCheck size={20} color={COLORS.muted} />} />}
                    />

                    {error ? <HelperText type="error" visible={true} style={{ marginBottom: 10 }}>{error}</HelperText> : null}

                    <Button
                      mode="contained"
                      onPress={handleVerifyOTP}
                      loading={loading}
                      style={styles.button}
                      contentStyle={styles.buttonContent}
                      buttonColor={COLORS.secondary}
                    >
                      Verify & Login
                    </Button>

                    <TouchableOpacity
                      onPress={() => {
                        setVerificationId('');
                        setVerificationCode('');
                        setError('');
                      }}
                      style={{ marginTop: 16, alignItems: 'center' }}
                    >
                      <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Change Phone Number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center' }}>
                If you are not an authorized staff member, please contact your Branch Administrator.
              </Text>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
      <FirebaseRecaptchaModal
        visible={recaptchaVisible}
        firebaseConfig={firebaseConfig}
        onVerify={(token) => {
          if (recaptchaResolverRef.current) {
            recaptchaResolverRef.current.resolve(token);
          }
          setRecaptchaVisible(false);
        }}
        onCancel={() => {
          if (recaptchaResolverRef.current) {
            recaptchaResolverRef.current.reject(new Error('reCAPTCHA verification cancelled.'));
          }
          setRecaptchaVisible(false);
          setLoading(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SIZES.padding, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.muted, marginTop: 8, textAlign: 'center' },
  formCard: { padding: 24, borderRadius: SIZES.radius * 2, elevation: 4, backgroundColor: COLORS.white },
  input: { marginBottom: 16, backgroundColor: COLORS.white, color: '#000000' },
  otpLabel: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 20 },
  button: { marginTop: 8, borderRadius: SIZES.radius },
  buttonContent: { paddingVertical: 8 },
  resendText: { textAlign: 'center', marginTop: 16, color: COLORS.secondary, fontWeight: '600' },
});

export default LoginScreen;

