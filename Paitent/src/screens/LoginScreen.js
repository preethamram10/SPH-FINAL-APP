import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, ToastAndroid } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, User, Phone, Mail, MapPin, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FirebaseRecaptchaModal from '../components/FirebaseRecaptchaModal';
import { scheduleLoginSuccessNotification } from '../utils/notificationHelper';

const LoginScreen = ({ navigation, route }) => {
  const modeParam = route.params?.initialMode;
  const [isLogin, setIsLogin] = useState(modeParam !== 'signup');
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaVisible, setRecaptchaVisible] = useState(false);
  const recaptchaResolverRef = useRef(null);



  const handleSendOTP = async () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!isLogin) {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (!phone || cleanPhone.length < 10) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }
      if (!location.trim()) {
        setError('Please enter your location');
        return;
      }
    } else {
      if (!phone || cleanPhone.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }
    }
    setLoading(true);
    setError('');

    try {
      // Check if user exists if it's login
      if (isLogin) {
        const phoneNum = parseInt(cleanPhone, 10);
        let q = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          q = query(collection(db, 'patients'), where('phone', '==', phoneNum));
          querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
          q = query(collection(db, 'patients'), where('phone', '==', phone.trim()));
          querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
          setError('No account found with this phone number. Please Sign Up.');
          setLoading(false);
          return;
        }
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
      console.log('✅ verificationId set:', verificationId);
      if (Platform.OS === 'android') {
        ToastAndroid.show('OTP Sent successfully to your mobile.', ToastAndroid.SHORT);
      } else {
        Alert.alert('OTP Sent', 'Please check your messages for the verification code.');
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
      if (!verificationId) {
        setError('Verification ID missing. Please request OTP again.');
        setLoading(false);
        return;
      }
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode.trim()
      );
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      if (!isLogin) {
        // Create patient profile for new user
        await setDoc(doc(db, 'patients', user.uid), {
          fullName: name,
          email: email || '',
          phone: phone,
          location: location,
          role: 'patient',
          createdAt: new Date().toISOString()
        });
        try {
          await scheduleLoginSuccessNotification(name);
        } catch (notifErr) {
          console.warn('Login notification error:', notifErr);
        }
      } else {
        // Existing Patient Login: check if patients/{user.uid} exists
        const userRef = doc(db, 'patients', user.uid);
        const userSnap = await getDoc(userRef);
        let patientName = 'Patient';
        if (!userSnap.exists()) {
          const cleanPhone = phone.replace(/\D/g, '').slice(-10);
          const q = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
          const querySnapshot = await getDocs(q);

          let existingData = {};
          if (!querySnapshot.empty) {
            existingData = querySnapshot.docs[0].data();
          }
          patientName = existingData.fullName || existingData.name || 'Patient';

          await setDoc(userRef, {
            fullName: patientName,
            email: existingData.email || '',
            phone: cleanPhone,
            location: existingData.location || '',
            branchId: existingData.branchId || null,
            branchName: existingData.branchName || existingData.location || 'Unknown',
            rewardPoints: existingData.rewardPoints || 0,
            role: 'patient',
            createdAt: existingData.createdAt || new Date().toISOString()
          });
        } else {
          patientName = userSnap.data().fullName || 'Patient';
        }
        try {
          await scheduleLoginSuccessNotification(patientName);
        } catch (notifErr) {
          console.warn('Login notification error:', notifErr);
        }
      }
    } catch (err) {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >


        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {navigation.canGoBack() && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color="#1e293b" />
            </TouchableOpacity>
          )}

          <View style={styles.header}>
            <Image
              source={require('../../assets/SH logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Spiritual Homeo Clinic</Text>
            <Text style={styles.subtitle}>{isLogin ? 'Welcome back!' : 'Create your account'}</Text>
          </View>

          <Surface style={styles.formCard}>
            {!verificationId && !modeParam && (
              <View style={styles.tabToggleContainer}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.toggleTab, isLogin && styles.activeToggleTab]}
                  onPress={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                >
                  <Text style={[styles.toggleTabText, isLogin && styles.activeToggleTabText]}>Existing Patient</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.toggleTab, !isLogin && styles.activeToggleTab]}
                  onPress={() => {
                    setIsLogin(false);
                    setError('');
                  }}
                >
                  <Text style={[styles.toggleTabText, !isLogin && styles.activeToggleTabText]}>New Patient</Text>
                </TouchableOpacity>
              </View>
            )}

            {!verificationId ? (
              <>
                {!isLogin && (
                  <>
                    <TextInput
                      label="Full Name"
                      value={name}
                      onChangeText={setName}
                      mode="outlined"
                      dense
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.secondary}
                      placeholder="Enter your full name"
                      placeholderTextColor="#000000"
                      left={<TextInput.Icon icon={props => <User {...props} size={20} color={COLORS.secondary} />} />}
                    />
                    <TextInput
                      label="Phone Number"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      left={<TextInput.Icon icon={props => <Phone {...props} size={20} color={COLORS.secondary} />} />}
                      right={<TextInput.Affix text="+91" />}
                      mode="outlined"
                      dense
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.secondary}
                      placeholder="Enter 10-digit mobile"
                      placeholderTextColor="#000000"
                    />
                    <TextInput
                      label="Email Address (Optional)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      mode="outlined"
                      dense
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.secondary}
                      placeholder="Enter email address"
                      placeholderTextColor="#000000"
                      left={<TextInput.Icon icon={props => <Mail {...props} size={20} color={COLORS.secondary} />} />}
                    />
                    <TextInput
                      label="Location"
                      value={location}
                      onChangeText={setLocation}
                      mode="outlined"
                      dense
                      style={styles.input}
                      textColor="#000000"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.secondary}
                      placeholder="Enter city or area"
                      placeholderTextColor="#000000"
                      left={<TextInput.Icon icon={props => <MapPin {...props} size={20} color={COLORS.secondary} />} />}
                    />
                  </>
                )}
                {isLogin && (
                  <TextInput
                    label="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    left={<TextInput.Icon icon={props => <Phone {...props} size={20} color={COLORS.secondary} />} />}
                    right={<TextInput.Affix text="+91" />}
                    mode="outlined"
                    dense
                    style={styles.input}
                    textColor="#000000"
                    outlineColor={COLORS.border}
                    activeOutlineColor={COLORS.secondary}
                    placeholder="8374062188"
                    placeholderTextColor="#000000"
                  />
                )}

                {error ? <HelperText type="error" visible={true}>{error}</HelperText> : null}

                <Button
                  mode="contained"
                  onPress={handleSendOTP}
                  loading={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  buttonColor={COLORS.secondary}
                >
                  Send Verification OTP
                </Button>
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
                  dense
                  style={styles.input}
                  textColor="#000000"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.secondary}
                  placeholder="123456"
                  placeholderTextColor="#000000"
                  left={<TextInput.Icon icon={props => <ShieldCheck {...props} size={20} color={COLORS.secondary} />} />}
                />

                {error ? <HelperText type="error" visible={true}>{error}</HelperText> : null}

                <Button
                  mode="contained"
                  onPress={handleVerifyOTP}
                  loading={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  buttonColor={COLORS.secondary}
                >
                  Verify & Continue
                </Button>

                <TouchableOpacity onPress={() => setVerificationId('')}>
                  <Text style={styles.resendText}>Change Phone Number</Text>
                </TouchableOpacity>
              </>
            )}

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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
    flexGrow: 1,
    paddingTop: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  formCard: {
    padding: 24,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  input: {
    marginBottom: 16,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: '#000000',
  },
  otpLabel: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: COLORS.secondary,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonContent: {
    paddingVertical: 10,
  },
  resendText: {
    textAlign: 'center',
    marginTop: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 30,
    padding: 4,
    marginBottom: 24,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 26,
  },
  activeToggleTab: {
    backgroundColor: COLORS.primary,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  toggleTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  activeToggleTabText: {
    color: '#ffffff',
  },
});

export default LoginScreen;

