import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform, KeyboardAvoidingView, ActivityIndicator, Modal, TextInput as RNTextInput, NativeModules } from 'react-native';
import { Text, Surface, TextInput, Button, Avatar, RadioButton, IconButton, Badge, Menu, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, increment, limit, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import {
  User, Phone, Mail, Megaphone, BookOpen,
  Calendar as CalendarIcon, MapPin, Search,
  ChevronDown, Bell, ChevronLeft, ArrowRight,
  ShieldCheck, CheckCircle2, Clock, Users,
  Info, Coins, CreditCard, X, ArrowRightLeft, UserPlus
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import RazorpayCheckout from 'react-native-razorpay';
import { scheduleWalkInBookingNotification } from '../../utils/notificationHelper';
import { generateRegistrationId, getStandardBranchName } from '../../utils/idGenerator';
import { notifyAllHRs } from '../../utils/notificationService';
import { sendBookingSMS } from '../../utils/smsHelper';
const COLORS = {
  primary: '#0ea5e9',
  secondary: '#3b82f6',
  background: '#f8fafc',
  white: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
};
const SIZES = {
  padding: 16,
};
import {
  scheduleBookingSuccessNotification,
  scheduleAppointmentReminder,
  schedulePaymentSuccessNotification
} from '../../utils/notificationHelper';
import { checkIsInDuration } from './Rejoin/index';

const DOCTOR_SCHEDULES = {
  '1': {
    id: '1',
    name: 'Dr. Prashanth K Vaidya',
    specialty: 'Homeopathic Physician',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300',
    branches: ['Kphb', 'Chandanagar', 'Nallagandla'],
    timings: [
      { branch: 'Kphb', dayOfWeek: [1, 3, 5, 6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] }, // Mon, Wed, Fri, Sat
      { branch: 'Chandanagar', dayOfWeek: [1, 3, 5, 6], intervals: [['10:00', '12:00'], ['19:30', '21:00']] }, // Mon, Wed, Fri, Sat
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['11:00', '13:00']] }, // Sun
      { branch: 'Nallagandla', dayOfWeek: [4], intervals: [['11:00', '13:00'], ['18:00', '20:00']] }, // Thu
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['18:00', '20:00']] } // Sun
    ]
  },
  '2': {
    id: '2',
    name: 'Dr. Ramakrishna Chanduri',
    specialty: 'Homeopathic Physician',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300',
    branches: ['Dilshuknagar', 'Nallagandla'],
    timings: [
      { branch: 'Dilshuknagar', dayOfWeek: [0, 1, 2, 3, 4], intervals: [['10:00', '14:00'], ['17:00', '20:00']] }, // Sun - Thu
      { branch: 'Nallagandla', dayOfWeek: [5, 6], intervals: [['10:00', '20:00']] } // Fri, Sat
    ]
  },
  '3': {
    id: '3',
    name: 'Dr. Jobedah Parveej',
    specialty: 'Homeopathic Physician',
    image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=300',
    branches: ['Nallagandla', 'Kphb'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [1], intervals: [['11:00', '13:00'], ['18:00', '19:30']] }, // Mon
      { branch: 'Kphb', dayOfWeek: [2, 3, 5], intervals: [['12:30', '14:00']] }, // Tue, Wed, Fri
      { branch: 'Kphb', dayOfWeek: [6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] } // Sat
    ]
  },
  '4': {
    id: '4',
    name: 'Dr. Padma Priya',
    specialty: 'Homeopathic Physician',
    image: 'https://images.unsplash.com/photo-1559839734-2b71f153678e?auto=format&fit=crop&q=80&w=300',
    branches: ['Nallagandla', 'Chandanagar'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [2, 3], intervals: [['10:00', '20:00']] }, // Tue, Wed
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['10:00', '17:00']] }, // Sun
      { branch: 'Chandanagar', dayOfWeek: [1, 5], intervals: [['12:00', '20:00']] }, // Mon, Fri
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['17:30', '20:00']] }, // Sun
      { branch: 'Chandanagar', dayOfWeek: [4], intervals: [['10:00', '20:00']] } // Thu
    ]
  }
};
const getCanonicalBranchName = (name) => {
  return getStandardBranchName(name);
};

const normalizeBranchName = (name) => {
  return getStandardBranchName(name).toLowerCase();
};

const isDoctorAvailableAtBranchOnDate = (doctor, branchName, date) => {
  if (!doctor || !branchName || !date) return false;
  const day = date.getDay();
  if (!doctor.timings || !Array.isArray(doctor.timings)) return false;

  return doctor.timings.some(t => {
    const matchBranch = normalizeBranchName(t.branch) === normalizeBranchName(branchName);
    if (!matchBranch) return false;

    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      return ivs.length > 0;
    } else if (t.dayOfWeek) {
      return t.dayOfWeek.includes(day);
    }
    return false;
  });
};

const isSlotBlockedByNoShow = (slotTimeStr, dateString, noShows) => {
  if (!noShows || noShows.length === 0) return false;

  const parseTimeToMinutes = (timeStr) => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const slotMin = parseTimeToMinutes(slotTimeStr);

  for (const ns of noShows) {
    if (ns.type === 'date_range') {
      if (dateString < ns.startDate || dateString > ns.endDate) {
        continue;
      }
    } else {
      if (ns.date !== dateString) {
        continue;
      }
    }

    if (ns.type === 'session') {
      if (ns.session === 'all') {
        return true;
      }
      if (ns.session === 'morning') {
        if (slotMin < 840) return true; // before 2:00 PM
      }
      if (ns.session === 'evening') {
        if (slotMin >= 840) return true; // after 2:00 PM
      }
    } else if (ns.type === 'time_range') {
      const parse24hToMinutes = (tStr) => {
        if (!tStr) return 0;
        const parts = tStr.split(':');
        if (parts.length < 2) return 0;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      };
      const nsStart = parse24hToMinutes(ns.startTime);
      const nsEnd = parse24hToMinutes(ns.endTime);
      if (slotMin >= nsStart && slotMin < nsEnd) {
        return true;
      }
    } else {
      // type === 'date'
      return true;
    }
  }
  return false;
};
const RegisterPatient = ({ route, navigation, setActiveTab }) => {
  const { userData } = useAuth();
  // Form State
  const initialPatientData = {
    fullName: '',
    patientName: '',
    regID: '',
    phone: '',
    email: '',
    source: '',
    modeOfConsultation: 'In-Clinic',
    subject: '',
    date: new Date(),
    branch: null,
    doctor: null,
    timeSlot: null,
    patientId: null
  };
  const [patientData, setPatientData] = useState(initialPatientData);

  const resetForm = () => {
    const branchVal = (userData && userData.role === 'receptionist') ? (userData.branchName || userData.branchId) : null;
    setPatientData({
      ...initialPatientData,
      branch: branchVal ? { id: branchVal, name: getCanonicalBranchName(branchVal) } : null
    });
    setSearchDoctor('');
    setAvailableSlots([]);
    setGlobalSearchText('');
    setGlobalSearchResults([]);
    setSelectedAppointment(null);
    setBookingMode('new');
  };
  // UI State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCustomSlotPicker, setShowCustomSlotPicker] = useState(false);
  const [branches, setBranches] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchDoctor, setSearchDoctor] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  // Direct walk-in checkout states
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('cash'); // 'cash' | 'upi' | 'card' | 'split' | 'phone_link'
  const [splitAmountCash, setSplitAmountCash] = useState('');
  const [splitAmountUpi, setSplitAmountUpi] = useState('');
  const [createdAppointmentId, setCreatedAppointmentId] = useState(null);
  const [createdPatientId, setCreatedPatientId] = useState(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // Shared Mobile Phone / Multiple Family Members State
  const [existingProfilesModalVisible, setExistingProfilesModalVisible] = useState(false);
  const [existingProfilesList, setExistingProfilesList] = useState([]);
  const [checkedPhone, setCheckedPhone] = useState('');
  const [bypassPhoneCheck, setBypassPhoneCheck] = useState(false);
  const [checkingProfilesLoading, setCheckingProfilesLoading] = useState(false);

  const findProfilesByPhone = async (rawPhone) => {
    if (!rawPhone) return [];
    const clean = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (clean.length < 10) return [];

    const possibleValues = [
      clean,
      rawPhone.trim(),
      `+91${clean}`,
      `+91 ${clean}`,
      `91${clean}`
    ];
    const numClean = Number(clean);
    if (!isNaN(numClean)) possibleValues.push(numClean);

    const safeQuery = (q) => getDocs(q).catch(err => {
      console.warn("Query fallback skipped:", err?.message || err);
      return null;
    });

    const promises = [];

    // 1. Direct equality queries across all possible phone values
    for (const val of possibleValues) {
      promises.push(safeQuery(query(collection(db, 'allpatients'), where('phone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'patients'), where('phone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'allpatients'), where('patientPhone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'patients'), where('patientPhone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'users'), where('phone', '==', val), limit(20))));
    }

    // 2. Comprehensive fallback scan of recent records to guarantee matching regardless of format
    promises.push(safeQuery(query(collection(db, 'allpatients'), limit(150))));
    promises.push(safeQuery(query(collection(db, 'patients'), limit(150))));

    const snapshots = await Promise.all(promises);
    const profilesMap = new Map();

    snapshots.forEach(snap => {
      if (!snap || snap.empty) return;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const pName = data.fullName || data.patientName || data.name;
        const docPhone = data.phone || data.patientPhone || data.phoneNumber || data.mobile || '';
        const cleanDocPhone = String(docPhone).replace(/\D/g, '').slice(-10);

        if (pName && cleanDocPhone.length === 10 && cleanDocPhone === clean) {
          const key = (data.registrationId || data.regId || docSnap.id).toLowerCase();
          if (!profilesMap.has(key)) {
            profilesMap.set(key, {
              id: docSnap.id,
              fullName: pName,
              registrationId: data.registrationId || data.regId || docSnap.id,
              phone: docPhone || clean,
              gender: data.gender || '',
              age: data.age || '',
              source: data.source || 'Registered Patient',
              branchName: data.branchName || ''
            });
          }
        }
      });
    });

    return Array.from(profilesMap.values());
  };

  const handleManualPhoneCheck = async (phoneVal) => {
    const clean = phoneVal.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      Alert.alert("Invalid Phone", "Please enter a 10-digit mobile number.");
      return;
    }
    setCheckingProfilesLoading(true);
    try {
      const list = await findProfilesByPhone(phoneVal);
      if (list.length > 0) {
        setExistingProfilesList(list);
        setCheckedPhone(clean);
        setExistingProfilesModalVisible(true);
      } else {
        Alert.alert("No Profiles Found", `No existing patient profiles found for +91 ${clean}. Entering details will create a new patient profile.`);
      }
    } catch (err) {
      console.error("Manual check error:", err);
      Alert.alert("Check Failed", "Unable to check profiles right now. Please try again.");
    } finally {
      setCheckingProfilesLoading(false);
    }
  };

  const handlePhoneInputChange = (text) => {
    setPatientData(prev => ({ ...prev, phone: text }));
    setBypassPhoneCheck(false);
    
    const clean = text.replace(/\D/g, '').slice(-10);
    if (clean.length === 10) {
      handleManualPhoneCheck(text);
    }
  };

  const handleSelectExistingProfile = (prof) => {
    setPatientData(prev => ({
      ...prev,
      patientId: prof.id,
      fullName: prof.fullName,
      patientName: prof.fullName,
      regID: prof.registrationId || prev.regID,
      source: 'Old Patient'
    }));
    setBypassPhoneCheck(true);
    setExistingProfilesModalVisible(false);
  };

  const handleCreateNewFamilyProfile = () => {
    setPatientData(prev => ({
      ...prev,
      patientId: null,
      regID: ''
    }));
    setBypassPhoneCheck(true);
    setExistingProfilesModalVisible(false);
  };

  const stopRzpPolling = () => { };
  const [processingRzp, setProcessingRzp] = useState(false);

  const handleCompleteRzpCheckout = async () => {
    const amount = Number(checkoutAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid consultation fee amount.');
      return;
    }
    if (!NativeModules.RNRazorpayCheckout) {
      Alert.alert(
        'Razorpay Module Missing',
        'The Razorpay native module is not loaded. If you are running in Expo Go, please build the app as a Development Build (e.g. run "npx expo run:android" or "npm run android") to include native libraries.'
      );
      return;
    }

    setProcessingRzp(true);
    try {
      const options = {
        description: `Walk-in Consultation Fee - ${patientData.patientName}`,
        image: 'https://i.imgur.com/3g7A6tw.png',
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        amount: Math.round(amount * 100), // amount in paise
        name: 'Spiritual Homeopathy Clinic',
        prefill: {
          email: patientData.email || '',
          contact: patientData.phone || '',
          name: patientData.patientName || 'Patient'
        },
        theme: { color: '#0ea5e9' }
      };

      RazorpayCheckout.open(options).then(async (data) => {
        const paymentId = data.razorpay_payment_id;
        await handleConfirmDirectPayment(paymentId);
        setProcessingRzp(false);
      }).catch((error) => {
        setProcessingRzp(false);
        console.error('Razorpay error:', error);
        if (error.code !== 'payment_cancelled') {
          Alert.alert('Payment Failed', error.description || 'Payment could not be processed. Please try again.');
        }
      });
    } catch (e) {
      console.error('Error initiating Razorpay checkout:', e);
      Alert.alert('Payment Setup Error', 'Failed to initiate payment. Please try again.');
      setProcessingRzp(false);
    }
  };

  // Dropdown Menus — use functional setState to avoid stale closure on some Android versions
  const [menuVisible, setMenuVisible] = useState({ source: false, subject: false, branch: false, doctor: false, appointment: false, mode: false });

  // Dropdown widths — use ref to avoid triggering re-renders that collapse open menus
  const dropdownWidthsRef = React.useRef({});
  const onDropdownLayout = (key) => (event) => {
    const { width } = event.nativeEvent.layout;
    dropdownWidthsRef.current[key] = width;
  };

  // Reschedule State
  const [bookingMode, setBookingMode] = useState('new'); // 'new' | 'reschedule'
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const fetchActiveAppointments = async () => {
    try {
      const q = query(
        collection(db, 'allpatients'),
        where('status', 'in', ['waiting', 'confirmed', 'booked', 'pending', 'in-consultation'])
      );
      const snap = await getDocs(q);
      const apps = [];
      snap.forEach(d => {
        const data = d.data();
        if (userData?.branchId) {
          if (data.branchId === userData.branchId || data.branchName === userData.branchName) {
            apps.push({ id: d.id, ...data });
          }
        } else {
          apps.push({ id: d.id, ...data });
        }
      });
      setExistingAppointments(apps);
    } catch (error) {
      console.error('Error fetching active appointments for reschedule:', error);
    }
  };
  // Global Patient Search
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const searchTimeoutRef = React.useRef(null);
  const handleSearchPatient = (text) => {
    setGlobalSearchText(text);
    if (!text || text.trim().length < 1) {
      setGlobalSearchResults([]);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const results = [];
        const queryText = text.trim();
        const textLower = queryText.toLowerCase();
        const textUpper = queryText.toUpperCase();
        const textCapitalized = queryText.charAt(0).toUpperCase() + queryText.slice(1).toLowerCase();

        const promises = [];

        // 1. Phone number search
        if (/^\d+$/.test(queryText)) {
          const qPhone = query(collection(db, 'allpatients'), where('phone', '>=', queryText), where('phone', '<=', queryText + '\uf8ff'), limit(10));
          promises.push(getDocs(qPhone));
          const qPhonePat = query(collection(db, 'patients'), where('phone', '>=', queryText), where('phone', '<=', queryText + '\uf8ff'), limit(10));
          promises.push(getDocs(qPhonePat));
        } else {
          // 2. Full Name search (various case variations)
          const qNameCap = query(collection(db, 'allpatients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\uf8ff'), limit(10));
          promises.push(getDocs(qNameCap));
          const qNameCapPat = query(collection(db, 'patients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\uf8ff'), limit(10));
          promises.push(getDocs(qNameCapPat));

          const qNameLower = query(collection(db, 'allpatients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\uf8ff'), limit(5));
          promises.push(getDocs(qNameLower));
          const qNameLowerPat = query(collection(db, 'patients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\uf8ff'), limit(5));
          promises.push(getDocs(qNameLowerPat));

          const qNameUpper = query(collection(db, 'allpatients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\uf8ff'), limit(5));
          promises.push(getDocs(qNameUpper));
          const qNameUpperPat = query(collection(db, 'patients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\uf8ff'), limit(5));
          promises.push(getDocs(qNameUpperPat));
        }
        // 3. Registration ID search
        const qReg = query(collection(db, 'allpatients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\uf8ff'), limit(10));
        promises.push(getDocs(qReg));
        const qRegPat = query(collection(db, 'patients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\uf8ff'), limit(10));
        promises.push(getDocs(qRegPat));

        const snaps = await Promise.all(promises);
        snaps.forEach((snap) => {
          snap.forEach((docSnap) => {
            const collectionName = docSnap.ref?.parent?.id || 'allpatients';
            results.push({ id: docSnap.id, source: collectionName, ...docSnap.data() });
          });
        });
        // Deduplicate results by document ID
        const uniqueResults = [];
        const seenIds = new Set();
        results.forEach((r) => {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            uniqueResults.push(r);
          }
        });

        setGlobalSearchResults(uniqueResults);
      } catch (e) {
        console.log('Search error', e);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 400); // 400ms debounce
  };
  // Fetch doctors dynamically from Firestore
  useEffect(() => {
    const fetchFirestoreDoctors = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
        const snap = await getDocs(q);
        const list = [];
        const normalizeName = (name) => {
          return name.toLowerCase().replace(/^dr\.\s*/, '').replace(/^dr\s*/, '').replace(/[^a-z0-9]/g, '');
        };
        snap.forEach(doc => {
          const u = doc.data();
          const docName = u.name || '';

          // Check if doctor matches one of our hardcoded templates (case-insensitive robust name check)
          const matchedKey = Object.keys(DOCTOR_SCHEDULES).find(key => {
            const hDoc = DOCTOR_SCHEDULES[key];
            return normalizeName(hDoc.name) === normalizeName(docName);
          });

          let doctorData = {};
          if (matchedKey) {
            doctorData = {
              ...DOCTOR_SCHEDULES[matchedKey],
              id: doc.id,
              name: docName || DOCTOR_SCHEDULES[matchedKey].name,
              consultationFee: u.consultationFee !== undefined ? Number(u.consultationFee) : ''
            };
          } else {
            const doctorBranches = u.branchName ? [u.branchName] : ['KPHB', 'Chandnagar', 'Nallagandla', 'Dilshuknagar'];
            const timings = doctorBranches.map(brName => ({
              branch: brName,
              dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
              intervals: [['10:00', '14:00'], ['17:00', '20:00']]
            }));
            doctorData = {
              id: doc.id,
              name: docName,
              specialty: u.specialty || 'Homeopathic Physician',
              image: u.image || 'https://images.unsplash.com/photo-1559839734-2b71f153678e?auto=format&fit=crop&q=80&w=300',
              branches: doctorBranches,
              consultationFee: u.consultationFee !== undefined ? Number(u.consultationFee) : '',
              timings: timings
            };
          }

          // If the Firestore document has custom schedules/timings configured, prioritize them!
          if (u.timings && Array.isArray(u.timings) && u.timings.length > 0) {
            const customBranches = [...new Set(u.timings.map(t => t.branch))];
            doctorData.timings = u.timings;
            doctorData.branches = customBranches;
          }

          list.push(doctorData);
        });
        setDoctors(list);
      } catch (error) {
        console.error("Error fetching doctors from database:", error);
        setDoctors([]);
      }
    };
    fetchFirestoreDoctors();
  }, []);
  // 1. Initial Doctor Setup & Prefill from Navigation Param
  useEffect(() => {
    const routeDoctorId = route?.params?.doctorId;
    const prefillPatient = route?.params?.prefillPatient;

    if (prefillPatient) {
      let docObj = null;
      if (prefillPatient.doctor && doctors.length > 0) {
        const targetName = prefillPatient.doctor.toLowerCase().replace(/^dr\.\s*/, '').replace(/^dr\s*/, '').replace(/[^a-z0-9]/g, '');
        docObj = doctors.find(d => (d.name || '').toLowerCase().replace(/^dr\.\s*/, '').replace(/^dr\s*/, '').replace(/[^a-z0-9]/g, '') === targetName);
      }

      setPatientData(prev => ({
        ...prev,
        fullName: prefillPatient.fullName || '',
        patientName: prefillPatient.fullName || '',
        phone: prefillPatient.phone || '',
        patientId: prefillPatient.id || null,
        regID: prefillPatient.registrationId || prefillPatient.regId || prev.regID,
        doctor: docObj || prev.doctor,
        date: prefillPatient.followUpDate ? new Date(prefillPatient.followUpDate) : new Date(),
        branch: prefillPatient.branchName || prefillPatient.branchId ? {
          id: prefillPatient.branchName || prefillPatient.branchId,
          name: getCanonicalBranchName(prefillPatient.branchName || prefillPatient.branchId)
        } : prev.branch,
        pendingAmount: prefillPatient.pendingAmount || 0,
      }));
    } else if (routeDoctorId) {
      let docObj = null;
      if (DOCTOR_SCHEDULES[routeDoctorId]) {
        docObj = DOCTOR_SCHEDULES[routeDoctorId];
      } else {
        docObj = doctors.find(d => d.id === routeDoctorId);
      }

      if (docObj) {
        const branchVal = userData?.role === 'receptionist' ? (userData.branchName || userData.branchId) : null;
        setPatientData(prev => ({
          ...prev,
          doctor: docObj,
          branch: branchVal ? { id: branchVal, name: getCanonicalBranchName(branchVal) } : null,
          timeSlot: null
        }));
      }
    }
  }, [route?.params?.doctorId, route?.params?.prefillPatient, userData, doctors]);

  // Pre-populate branch for receptionist when userData loads
  useEffect(() => {
    if (userData && userData.role === 'receptionist') {
      const branchVal = userData.branchName || userData.branchId;
      if (branchVal) {
        setPatientData(prev => ({
          ...prev,
          branch: { id: branchVal, name: getCanonicalBranchName(branchVal) }
        }));
      }
    }
  }, [userData]);

  // 2. Dynamic slots listener
  useEffect(() => {
    let unsubAppointments = null;

    const setupRealtimeSlots = async () => {
      if (!patientData.doctor || !patientData.branch || !patientData.date) {
        setAvailableSlots([]);
        return;
      }
      setFetchingSlots(true);
      try {
        const year = patientData.date.getFullYear();
        const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
        const day = String(patientData.date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // Fetch Doctor No Shows once
        const qNoShows = query(
          collection(db, 'doctor_no_shows'),
          where('doctorId', '==', patientData.doctor.id)
        );
        const snapNoShows = await getDocs(qNoShows);
        const activeNoShows = [];
        const normFormBranch = normalizeBranchName(patientData.branch.name);
        snapNoShows.forEach(docSnap => {
          const ns = docSnap.data();
          const nsBranch = normalizeBranchName(ns.branchName || ns.branchId);
          if (nsBranch === normFormBranch) {
            activeNoShows.push(ns);
          }
        });

        const today = new Date();
        const isSelectedDateToday =
          patientData.date.getDate() === today.getDate() &&
          patientData.date.getMonth() === today.getMonth() &&
          patientData.date.getFullYear() === today.getFullYear();

        const parseTimeToMinutes = (timeStr) => {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 0;
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          return hours * 60 + minutes;
        };

        const currentMinutes = today.getHours() * 60 + today.getMinutes();

        // Real-time listener for appointments (now stored in allpatients)
        const qAppts = query(
          collection(db, 'allpatients'),
          where('doctorId', '==', patientData.doctor.id),
          where('dateString', '==', dateString)
        );

        const qExtra = query(
          collection(db, 'extra_slots'),
          where('doctorId', '==', patientData.doctor.id),
          where('dateString', '==', dateString)
        );

        let latestCounts = {};
        let latestExtraSlots = [];

        const updateCombinedList = () => {
          const generatedList = generateSlotsForSelected(patientData.doctor, patientData.branch.name, patientData.date);
          const existingDbSlots = Object.keys(latestCounts).filter(t => t && t !== 'null' && t !== 'undefined');
          const combinedList = [...new Set([...generatedList, ...existingDbSlots, ...latestExtraSlots])];

          combinedList.sort((a, b) => {
            const parseToMin = (t) => {
              const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
              if (!m) return 0;
              let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
              if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
              if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
              return h * 60 + min;
            };
            return parseToMin(a) - parseToMin(b);
          });

          const slotsWithAvailability = combinedList.map(time => {
            const booked = latestCounts[time] || 0;
            const sessionsLeft = 3 - booked;
            const isPastSlot = isSelectedDateToday && parseTimeToMinutes(time) <= currentMinutes;
            const isNoShowBlocked = isSlotBlockedByNoShow(time, dateString, activeNoShows);
            const isFull = booked >= 3;
            return {
              time,
              bookedCount: booked,
              sessionsLeft: sessionsLeft > 0 ? sessionsLeft : 0,
              isAvailable: !isPastSlot && !isNoShowBlocked,
              isFull: isFull,
              isBlockedByNoShow: isNoShowBlocked,
              isExtra: !generatedList.includes(time) && booked === 0
            };
          });

          setAvailableSlots(slotsWithAvailability);
          setFetchingSlots(false);
        };

        const unsubAppointmentsReal = onSnapshot(qAppts, (snapshot) => {
          const bookings = snapshot.docs.map(doc => doc.data());
          const counts = {};
          const targetBranch = normalizeBranchName(patientData.branch.name);

          bookings.forEach(b => {
            if (b.status === 'cancelled') return;
            const bBranch = normalizeBranchName(b.branchName || b.branchId);
            if (bBranch === targetBranch) {
              const timeSlotKey = b.timeSlot || b.appointmentTime;
              if (timeSlotKey) {
                counts[timeSlotKey] = (counts[timeSlotKey] || 0) + 1;
              }
            }
          });
          latestCounts = counts;
          updateCombinedList();
        }, (error) => {
          console.error("Error setting up slots listener:", error);
          setFetchingSlots(false);
        });

        const unsubExtraReal = onSnapshot(qExtra, (snapshot) => {
          let slots = [];
          const targetBranch = normalizeBranchName(patientData.branch.name);
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const bBranch = normalizeBranchName(data.branchName || data.branchId);
            if (bBranch === targetBranch && data.slots) {
              slots = [...slots, ...data.slots];
            }
          });
          latestExtraSlots = slots;
          updateCombinedList();
        });

        unsubAppointments = () => {
          unsubAppointmentsReal();
          unsubExtraReal();
        };

      } catch (error) {
        console.error("Error fetching slots:", error);
        setFetchingSlots(false);
      }
    };

    setupRealtimeSlots();

    return () => {
      if (unsubAppointments) unsubAppointments();
    };
  }, [patientData.doctor, patientData.branch, patientData.date]);

  // Resolve template doctor ID to real Firestore document ID when doctors load
  useEffect(() => {
    if (patientData.doctor && doctors.length > 0) {
      const dbDoc = doctors.find(d => d.name.toLowerCase() === patientData.doctor.name.toLowerCase());
      if (dbDoc && dbDoc.id !== patientData.doctor.id) {
        setPatientData(prev => ({ ...prev, doctor: dbDoc }));
      }
    }
  }, [doctors, patientData.doctor]);




  // 4. Dynamic Consultation Fee Setup removed as requested to keep fee manual

  const getFirstAvailableDate = (doctor, branchName, fallbackDate) => {
    if (!doctor || !branchName) return fallbackDate || new Date();
    const start = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const slots = generateSlotsForSelected(doctor, branchName, d);
      if (slots.length > 0) return d;
    }
    return fallbackDate || start;
  };

  // Adjust date to first available day when doctor or branch changes
  useEffect(() => {
    if (patientData.doctor && patientData.branch) {
      const slots = generateSlotsForSelected(patientData.doctor, patientData.branch.name, patientData.date);
      if (slots.length === 0) {
        const nextAvail = getFirstAvailableDate(patientData.doctor, patientData.branch.name, patientData.date);
        setPatientData(prev => ({ ...prev, date: nextAvail, timeSlot: null }));
      }
    }
  }, [patientData.doctor, patientData.branch]);

  const generateSlotsForSelected = (doctor, branchName, date) => {
    if (!doctor || !branchName || !date) return [];
    const day = date.getDay();
    const docSched = (doctor && doctor.timings) ? doctor : (DOCTOR_SCHEDULES[doctor.id] || doctor);
    if (!docSched) return [];

    const dayTimings = [];
    (docSched.timings || []).forEach(t => {
      if (normalizeBranchName(t.branch) !== normalizeBranchName(branchName)) return;
      if (t.daySchedule) {
        const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
        if (ivs.length > 0) dayTimings.push({ intervals: ivs });
      } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
        dayTimings.push({ intervals: t.intervals });
      }
    });

    if (dayTimings.length === 0) return [];

    const slots = [];
    dayTimings.forEach(t => {
      (t.intervals || []).forEach(iv => {
        const startStr = Array.isArray(iv) ? iv[0] : iv.start;
        const endStr = Array.isArray(iv) ? iv[1] : iv.end;
        if (!startStr || !endStr || typeof startStr !== 'string' || typeof endStr !== 'string') return;
        const [startHour, startMin] = startStr.split(':').map(Number);
        const [endHour, endMin] = endStr.split(':').map(Number);
        let currentHour = startHour;
        let currentMin = startMin;
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const period = currentHour >= 12 ? 'PM' : 'AM';
          const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
          slots.push(`${displayHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')} ${period}`);
          currentMin += 15;
          if (currentMin >= 60) { currentHour += Math.floor(currentMin / 60); currentMin = currentMin % 60; }
        }
      });
    });
    return slots;
  };

  const getOtherBranchAvailability = (doctor, selectedBranchName, date) => {
    if (!doctor || !date || !selectedBranchName) return '';
    const day = date.getDay();
    const docSched = (doctor && doctor.timings) ? doctor : (DOCTOR_SCHEDULES[doctor.id] || doctor);
    const docNameFormatted = doctor.name ? (doctor.name.startsWith('Dr.') || doctor.name.startsWith('Dr ') ? doctor.name : `Dr. ${doctor.name}`) : '';
    if (!docSched || !docSched.timings) return '';
    const weekdayName = date.toLocaleDateString('en-US', { weekday: 'long' });

    const availableOtherBranches = [];
    docSched.timings.forEach(t => {
      if (normalizeBranchName(t.branch) === normalizeBranchName(selectedBranchName)) return;
      if (t.daySchedule) {
        const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
        if (ivs.length > 0) availableOtherBranches.push({ branch: t.branch, intervals: ivs });
      } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
        availableOtherBranches.push({ branch: t.branch, intervals: t.intervals });
      }
    });

    if (availableOtherBranches.length > 0) {
      const branchStrings = availableOtherBranches.map(t => {
        const intervalsStr = t.intervals.map(iv => {
          const start = Array.isArray(iv) ? iv[0] : iv.start;
          const end = Array.isArray(iv) ? iv[1] : iv.end;
          const fmt = (tStr) => {
            if (!tStr || typeof tStr !== 'string') return 'N/A';
            const parts = tStr.split(':');
            if (parts.length < 2) return 'N/A';
            const h = Number(parts[0]);
            const m = Number(parts[1]);
            if (isNaN(h) || isNaN(m)) return 'N/A';
            const p = h >= 12 ? 'PM' : 'AM';
            const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            return `${dh}:${m.toString().padStart(2, '0')} ${p}`;
          };
          return `${fmt(start)} - ${fmt(end)}`;
        }).join(', ');
        return `${t.branch} (${intervalsStr})`;
      });
      return `On ${weekdayName}s, ${docNameFormatted} is available at: ${branchStrings.join(' | ')}.`;
    }

    const allWorkDays = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    docSched.timings.forEach(t => {
      if (!allWorkDays[t.branch]) allWorkDays[t.branch] = [];
      if (t.daySchedule) {
        [0, 1, 2, 3, 4, 5, 6].forEach(d => {
          const ivs = t.daySchedule[d] || t.daySchedule[String(d)] || [];
          if (ivs.length > 0 && !allWorkDays[t.branch].includes(days[d])) allWorkDays[t.branch].push(days[d]);
        });
      } else if (t.dayOfWeek) {
        t.dayOfWeek.forEach(d => { if (!allWorkDays[t.branch].includes(days[d])) allWorkDays[t.branch].push(days[d]); });
      }
    });
    const generalSchedules = Object.keys(allWorkDays).map(brName => `${brName} (${allWorkDays[brName].join(', ')})`);
    if (generalSchedules.length > 0) return `Weekly Schedule for ${docNameFormatted}: ${generalSchedules.join(' | ')}.`;
    return '';
  };

  const handleConfirm = async () => {
    if (!patientData.patientName || !patientData.branch || !patientData.doctor || !patientData.timeSlot) {
      Alert.alert('Error', 'Please fill in all fields including time slot.');
      return;
    }

    // Check if the selected slot is in the past
    const today = new Date();
    const isSelectedDateToday =
      patientData.date.getDate() === today.getDate() &&
      patientData.date.getMonth() === today.getMonth() &&
      patientData.date.getFullYear() === today.getFullYear();

    if (isSelectedDateToday) {
      const parseTimeToMinutes = (timeStr) => {
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      if (parseTimeToMinutes(patientData.timeSlot) <= currentMinutes) {
        Alert.alert('Error', 'The selected time slot has already passed. Please choose a future slot.');
        return;
      }
    }

    setLoading(true);
    try {
      const year = patientData.date.getFullYear();
      const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
      const day = String(patientData.date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const dateSlash = `${day}/${month}/${year}`;

      // Check if slot falls in a Doctor No Show block
      const qNoShows = query(
        collection(db, 'doctor_no_shows'),
        where('doctorId', '==', patientData.doctor.id)
      );
      const snapNoShows = await getDocs(qNoShows);
      const activeNoShows = [];
      const normFormBranch = (patientData.branch.name || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
      snapNoShows.forEach(docSnap => {
        const ns = docSnap.data();
        const nsBranch = (ns.branchName || ns.branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
        if (nsBranch === normFormBranch) {
          activeNoShows.push(ns);
        }
      });

      if (isSlotBlockedByNoShow(patientData.timeSlot, dateString, activeNoShows)) {
        Alert.alert('Cannot Book', `Dr. ${patientData.doctor.name} is marked as NO SHOW (unavailable) for this time period.`);
        setLoading(false);
        return;
      }

      if (bookingMode === 'reschedule' && selectedAppointment) {
        // Update existing appointment in allpatients
        const apptRef = doc(db, 'allpatients', selectedAppointment.id);
        await updateDoc(apptRef, {
          date: patientData.date.toISOString(),
          dateString,
          appointmentDate: dateSlash,
          timeSlot: patientData.timeSlot,
          appointmentTime: patientData.timeSlot,
          doctorId: patientData.doctor.id,
          doctorName: patientData.doctor.name,
          doctor: patientData.doctor.name,
          branchId: patientData.branch.id,
          branchName: patientData.branch.name,
          modeOfConsultation: patientData.modeOfConsultation || 'In-Clinic',
          updatedAt: serverTimestamp()
        });

        Alert.alert('Success', 'Appointment rescheduled successfully!');
        resetForm();
        if (setActiveTab) setActiveTab('Dashboard'); else navigation.goBack();
        setLoading(false);
        return;
      }
      // Calculate queueOrder by querying existing bookings for this doctor, branch, and date from allpatients
      let nextQueueOrder = 1;
      try {
        const qPatients = query(
          collection(db, 'allpatients'),
          where('appointmentDate', '==', dateSlash),
          where('branchId', '==', patientData.branch.id),
          where('doctor', '==', patientData.doctor.name)
        );

        const snapPatients = await getDocs(qPatients);
        nextQueueOrder = snapPatients.size + 1;
      } catch (err) {
        console.error('Error calculating queue order:', err);
      }

      // Check if phone number has existing profiles before creating
      if (!bypassPhoneCheck && !patientData.patientId && patientData.phone) {
        const foundProfiles = await findProfilesByPhone(patientData.phone);
        if (foundProfiles.length > 0) {
          setExistingProfilesList(foundProfiles);
          setCheckedPhone(patientData.phone.replace(/\D/g, '').slice(-10));
          setExistingProfilesModalVisible(true);
          setLoading(false);
          return;
        }
      }

      let finalPatientId = patientData.patientId;
      let regId = patientData.patientId && patientData.regID ? patientData.regID : null;
      const rawPhone = (patientData.phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

      let existingInDuration = false;
      let existingFollowUpDate = '';

      if (finalPatientId) {
        try {
          const patientSnap = await getDoc(doc(db, 'patients', finalPatientId));
          if (patientSnap.exists() && patientSnap.data().followUpDate) {
            const fUp = patientSnap.data().followUpDate;
            if (checkIsInDuration(fUp)) {
              existingInDuration = true;
              existingFollowUpDate = fUp;
            }
          } else {
            const allPatSnap = await getDoc(doc(db, 'allpatients', finalPatientId));
            if (allPatSnap.exists() && allPatSnap.data().followUpDate) {
              const fUp = allPatSnap.data().followUpDate;
              if (checkIsInDuration(fUp)) {
                existingInDuration = true;
                existingFollowUpDate = fUp;
              }
            }
          }
        } catch (err) {
          console.warn("Could not check in-duration for walk-in patient:", err);
        }
      }

      const branchForId = patientData.branch.name || patientData.branch.id || 'KPHB';
      regId = regId || await generateRegistrationId(branchForId);

      // Save to state so subsequent checkout flows can use it
      setPatientData(prev => ({ ...prev, regID: regId }));

      const appointmentData = {
        patientId: finalPatientId || auth.currentUser?.uid || 'WALKIN_USER',
        patientName: patientData.patientName,
        phone: patientData.phone,
        email: patientData.email,
        branchId: patientData.branch.id,
        branchName: patientData.branch.name,
        doctorId: patientData.doctor.id,
        doctorName: patientData.doctor.name,
        specialty: patientData.doctor.specialty || '',
        doctorImage: patientData.doctor.image || '',
        date: patientData.date.toISOString(),
        dateString,
        timeSlot: patientData.timeSlot,
        subject: patientData.subject,
        symptoms: patientData.subject, // Ensuring backward parity
        status: 'confirmed',
        paymentStatus: 'pending',
        paymentId: 'WALKIN_PENDING',
        registrationId: regId,
        amountPaid: 0,
        createdAt: serverTimestamp(),
        bookedAt: serverTimestamp(), // Ensuring backward parity
        checkedInAt: serverTimestamp(), // Set checkedInAt to prevent duplicates on dashboard
        source: patientData.source || 'Walk-in',
        modeOfConsultation: patientData.modeOfConsultation || 'In-Clinic',
        queueOrder: nextQueueOrder,
        pendingAmount: patientData.pendingAmount || 0
      };
      // 1. Create OR Update Patient Walk-in/Booking record in allpatients exclusively
      let patientDocId = finalPatientId;
      if (!patientDocId) {
        // Create NEW patient
        const patientDoc = await addDoc(collection(db, 'allpatients'), {
          fullName: patientData.patientName,
          patientName: patientData.patientName, // for compatibility
          phone: patientData.phone,
          email: patientData.email,
          source: patientData.source,
          modeOfConsultation: patientData.modeOfConsultation || 'In-Clinic',
          complaint: patientData.subject,
          doctor: patientData.doctor.name,
          doctorId: patientData.doctor.id,
          appointmentDate: dateSlash,
          dateString: dateString,
          appointmentTime: patientData.timeSlot,
          timeSlot: patientData.timeSlot,
          patientPhoto: '',
          branchId: patientData.branch.id,
          branchName: patientData.branch.name,
          registeredBy: userData?.name || 'Reception',
          status: 'waiting',
          paymentStatus: 'pending',
          registrationId: regId,
          rewardPoints: 0,
          createdAt: serverTimestamp(),
          queueOrder: nextQueueOrder,
          pendingAmount: patientData.pendingAmount || 0
        });
        patientDocId = patientDoc.id;
      } else {
        // Update EXISTING patient — reset pendingAmount so previous visit's balance doesn't carry forward
        await setDoc(doc(db, 'allpatients', patientDocId), {
          id: patientDocId,
          patientId: patientDocId,
          patientName: patientData.patientName,
          fullName: patientData.patientName,
          phone: cleanPhone,
          patientPhone: cleanPhone,
          email: patientData.email,
          registrationId: regId,
          source: patientData.patientId ? 'Old Patient' : (patientData.source || 'Walk-in'),
          appointmentDate: dateSlash,
          dateString: dateString,
          appointmentTime: patientData.timeSlot,
          timeSlot: patientData.timeSlot,
          doctor: patientData.doctor.name,
          doctorName: patientData.doctor.name,
          doctorId: patientData.doctor.id,
          branchId: patientData.branch.id,
          branchName: patientData.branch.name,
          modeOfConsultation: patientData.modeOfConsultation || 'In-Clinic',
          status: 'waiting',
          paymentStatus: 'pending',
          paymentId: '',
          consultationFee: existingInDuration ? 0 : '',
          isInDuration: existingInDuration,
          followUpDate: existingFollowUpDate || '',
          pendingAmount: 0,      // clear any unpaid balance from previous visits
          amountPaid: 0,         // reset paid amount for fresh visit
          paymentCollectedAt: null,
          paymentRequested: false,
          amount: 0,
          discount: 0,
          totalAmount: 0,
          doctorMedicineFee: 0,
          medicineFee: 0,
          clinicalNotes: '',
          doctorNotes: '',
          diagnosis: '',
          dietPlan: '',
          prescriptions: [],
          medicines: [],
          investigations: '',
          allergies: '',
          medicinesArray: [],
          prescriptionUrls: [],
          prescriptionUrl: '',
          labFee: 0,
          packageId: null,
          packageDetails: null,
          prescriptionNotes: '',
          diagnosisNotes: '',
          medicalHistory: '',
          collectFee: 0,
          medicineFeeRequested: 0,
          followUpDate: existingFollowUpDate || '',
          followUpInterval: '',
          prescribedAt: null,
          complaint: patientData.subject,
          symptoms: patientData.subject,
          subject: patientData.subject
        }, { merge: true });
      }
      setCreatedPatientId(patientDocId);
      // We no longer use appointments collection, so just use patientDocId for both
      setCreatedAppointmentId(patientDocId);
      // Trigger notifications & SMS asynchronously in background (non-blocking)
      (async () => {
        try {
          const formattedDateStr = patientData.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          if (scheduleBookingSuccessNotification) {
            scheduleBookingSuccessNotification(patientData.doctor.name, formattedDateStr, patientData.timeSlot).catch(() => { });
          }
          if (scheduleAppointmentReminder) {
            scheduleAppointmentReminder(patientData.doctor.name, dateString, patientData.timeSlot).catch(() => { });
          }
          if (scheduleWalkInBookingNotification) {
            scheduleWalkInBookingNotification(
              patientData.patientName,
              patientData.doctor?.name || 'Doctor',
              formattedDateStr,
              patientData.timeSlot || ''
            ).catch(() => { });
          }
          notifyAllHRs(
            '📅 New Appointment Alert',
            `${patientData.patientName} booked with ${patientData.doctor?.name ? (patientData.doctor.name.toLowerCase().startsWith('dr') ? patientData.doctor.name : `Dr. ${patientData.doctor.name}`) : 'Doctor'} on ${formattedDateStr} at ${patientData.timeSlot || 'N/A'} (${patientData.branch?.name || 'Unknown'}).`,
            'new_booking_hr_alert',
            {
              patientName: patientData.patientName,
              doctorName: patientData.doctor?.name || 'Doctor',
              branchName: patientData.branch?.name || 'Unknown',
              dateString: formattedDateStr
            }
          ).catch(() => { });

          sendBookingSMS(
            patientData.phone,
            patientData.patientName,
            patientData.doctor?.name || 'Doctor',
            formattedDateStr,
            patientData.timeSlot || '',
            patientData.branch?.name || 'Clinic',
            false
          );
        } catch (bgErr) {
          console.warn('Non-critical: Background booking notification error:', bgErr);
        }
      })();

      Alert.alert('Success', 'Appointment booked successfully!');
      resetForm();
      if (setActiveTab) {
        setActiveTab('Dashboard');
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Error', 'Failed to book appointment: ' + (error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleDirectPayLater = () => {
    setCheckoutModalVisible(false);
    Alert.alert('Booking Saved', 'Appointment booked. Payment is pending.');
    resetForm();
    if (setActiveTab) {
      setActiveTab('Dashboard');
    } else {
      navigation.goBack();
    }
  };

  const handleSuccessClose = () => {
    setCheckoutModalVisible(false);
    setShowSuccessScreen(false);
    resetForm();
    if (setActiveTab) {
      setActiveTab('Dashboard');
    } else {
      navigation.goBack();
    }
  };

  const handleConfirmDirectPayment = async (razorpayPaymentId) => {
    if (!createdPatientId || !createdAppointmentId) {
      Alert.alert('Error', 'Invalid patient or appointment reference.');
      return;
    }

    setLoading(true);
    try {
      const amount = Number(checkoutAmount);
      const day = String(patientData.date.getDate()).padStart(2, '0');
      const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
      const year = patientData.date.getFullYear();
      const dateSlash = `${day}/${month}/${year}`;
      // ⚠️ NO reward points for walk-in reception bookings
      // Reward points are ONLY earned when patients pay via the Patient App

      // 1. Update appointment document
      const updateDataAppt = {
        paymentStatus: 'paid',
        amountPaid: amount,
        paymentMethod: checkoutPaymentMethod,
        paymentCollectedAt: serverTimestamp(),
        paymentId: razorpayPaymentId || 'WALKIN_' + checkoutPaymentMethod.toUpperCase()
      };

      if (checkoutPaymentMethod === 'split') {
        updateDataAppt.paymentSplitDetails = {
          cash: Number(splitAmountCash) || 0,
          upi: Number(splitAmountUpi) || 0
        };
      }

      // 1. Update the patient/visit record directly in the allpatients collection
      const allPatientsRef = doc(db, 'allpatients', createdPatientId);
      await updateDoc(allPatientsRef, updateDataAppt);
      await updateDoc(allPatientsRef, {
        paymentStatus: 'paid',
        paymentAmount: amount,
        paymentMethod: checkoutPaymentMethod,
        paymentCollectedAt: serverTimestamp()
      });

      // 3. Add to revenue transactions log
      await addDoc(collection(db, 'alltransactions'), {
        type: 'consultation',
        patientId: createdPatientId,
        patientName: patientData.patientName,
        phone: patientData.phone || '',
        registrationId: regId || '',
        regId: regId || '',
        source: patientData.source || 'Walk-in',
        doctor: patientData.doctor?.name || '',
        amount: amount,
        method: checkoutPaymentMethod,
        branchId: patientData.branch?.id || '',
        branchName: patientData.branch?.name || '',
        recordedBy: userData?.name || 'Reception',
        paymentId: razorpayPaymentId || '',
        timestamp: serverTimestamp()
      });

      // 4. Add to patient_list
      await addDoc(collection(db, 'patient_list'), {
        patientId: createdPatientId,
        fullName: patientData.patientName,
        phone: patientData.phone || '',
        email: patientData.email || '',
        regId: patientData.regID || '',
        doctor: patientData.doctor?.name || '',
        branchId: patientData.branch?.id || '',
        branchName: patientData.branch?.name || '',
        paymentStatus: 'paid',
        paymentAmount: amount,
        paymentMethod: checkoutPaymentMethod,
        paymentCollectedAt: serverTimestamp(),
        appointmentDate: dateSlash,
        appointmentTime: patientData.timeSlot || '',
        followUpDate: '',
        followUpInterval: '',
        addedBy: userData?.name || 'Reception',
        timestamp: serverTimestamp()
      });

      // 5. Update monthly target reached count
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const branchId = userData?.branchId || patientData.branch?.id;
      if (branchId) {
        const targetsRef = collection(db, 'monthly_targets');
        const q = query(targetsRef, where('month', '==', monthKey), where('branchId', '==', branchId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const targetDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'monthly_targets', targetDoc.id), {
            reached: (targetDoc.data().reached || 0) + Number(amount || 0)
          });
        }
      }

      // Show confirmation success screen
      stopRzpPolling();

      // Trigger payment collected notification (staff side)
      try {
        await scheduleWalkInPaymentNotification(
          patientData.patientName,
          amount,
          checkoutPaymentMethod
        );
      } catch (notifErr) {
        console.warn('Walk-in payment notification error:', notifErr);
      }

      setPaymentSuccessData({
        amount: amount,
        method: checkoutPaymentMethod,
        paymentId: razorpayPaymentId || ('WALKIN_' + checkoutPaymentMethod.toUpperCase())
      });
      setShowSuccessScreen(true);

      // Trigger local success notification on receptionist's device
      try {
        await schedulePaymentSuccessNotification(
          patientData.patientName,
          amount,
          checkoutPaymentMethod
        );
      } catch (notifErr) {
        console.warn("Error scheduling payment success notification for receptionist:", notifErr);
      }

    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', 'Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMenu = (key) => setMenuVisible(prev => ({ ...prev, [key]: !prev[key] }));


  const SectionHeader = ({ number, title }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} enabled={Platform.OS === 'ios'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveTab ? setActiveTab('Dashboard') : navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Global Search Bar */}
          <Surface style={{ marginHorizontal: 12, marginBottom: 16, borderRadius: 24, elevation: 0, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 }}>
              <Search size={20} color="#94a3b8" />
              <RNTextInput
                style={{ flex: 1, marginLeft: 12, fontSize: 15, color: '#000000' }}
                placeholder="Search global patients by name, phone, or reg ID..."
                placeholderTextColor="#000000"
                value={globalSearchText}
                onChangeText={handleSearchPatient}
              />
              {isSearchingGlobal && <ActivityIndicator size="small" color="#0ea5e9" />}
              {globalSearchText.length > 0 && !isSearchingGlobal && (
                <TouchableOpacity onPress={() => { setGlobalSearchText(''); setGlobalSearchResults([]); }}>
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </Surface>

          {/* Search Results Dropdown */}
          {globalSearchResults.length > 0 && (
            <Surface style={{ marginHorizontal: 12, marginBottom: 16, borderRadius: 12, elevation: 0, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', maxHeight: 250 }}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                {globalSearchResults.map((patient, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{ padding: 12, borderBottomWidth: index === globalSearchResults.length - 1 ? 0 : 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                      setPatientData(prev => ({
                        ...prev,
                        patientName: patient.fullName || '',
                        phone: patient.phone || '',
                        email: patient.email || '',
                        subject: patient.complaint || patient.subject || patient.symptoms || '',
                        source: 'Old Patient',
                        regID: patient.registrationId || patient.regId || prev.regID,
                        patientId: patient.id || null
                      }));
                      setGlobalSearchText('');
                      setGlobalSearchResults([]);
                    }}
                  >
                    <Avatar.Text size={36} label={(patient.fullName || 'P').substring(0, 2).toUpperCase()} style={{ backgroundColor: '#e0f2fe' }} labelStyle={{ color: '#0ea5e9', fontSize: 12, fontWeight: 'bold' }} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 14 }}>{patient.fullName}</Text>
                        {(() => {
                          const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                          if (!followUp) return null;
                          const isActive = checkIsInDuration(followUp);
                          return isActive ? (
                            <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6 }}>
                              <Text style={{ color: '#d97706', fontSize: 8, fontWeight: '800' }}>IN DURATION</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6 }}>
                              <Text style={{ color: '#0369a1', fontSize: 8, fontWeight: '800' }}>RE-BOOKING</Text>
                            </View>
                          );
                        })()}
                      </View>
                      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        {patient.registrationId || patient.regId || 'N/A'} • {patient.phone} • {patient.branchName || 'Unknown Branch'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Surface>
          )}

          {/* Section 0: Select Appointment (Reschedule Mode) */}
          {bookingMode === 'reschedule' && (
            <Surface style={styles.sectionCard}>
              <SectionHeader number="0" title="Select Appointment" />
              <View style={styles.fullWidthInput}>
                <Menu
                  visible={menuVisible.appointment}
                  onDismiss={() => toggleMenu('appointment')}
                  style={{ marginTop: 42 }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}
                  anchor={
                    <TouchableOpacity
                      onLayout={onDropdownLayout('appointment')}
                      style={styles.dropdown}
                      onPress={() => toggleMenu('appointment')}
                    >
                      <CalendarIcon size={16} color="#94a3b8" />
                      <Text style={[styles.dropdownText, !selectedAppointment && { color: '#94a3b8' }]} numberOfLines={1}>
                        {selectedAppointment ? `${selectedAppointment.patientName || selectedAppointment.fullName} - ${selectedAppointment.dateString}` : 'Select Pending Appointment'}
                      </Text>
                      <ChevronDown size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  }
                >
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                    {existingAppointments.map((appt) => (
                      <Menu.Item
                        key={appt.id}
                        onPress={() => {
                          setSelectedAppointment(appt);
                          setPatientData(prev => ({
                            ...prev,
                            patientName: appt.patientName || appt.fullName || '',
                            phone: appt.phone || appt.patientPhone || '',
                            email: appt.email || '',
                            subject: appt.subject || appt.symptoms || '',
                            source: 'Old Patient',
                            modeOfConsultation: appt.modeOfConsultation || 'In-Clinic'
                          }));
                          toggleMenu('appointment');
                        }}
                        title={`${appt.patientName || appt.fullName} (${appt.dateString})`}
                        titleStyle={{ color: '#000000', fontWeight: '500', fontSize: 13 }}
                      />
                    ))}
                  </ScrollView>
                </Menu>
              </View>
            </Surface>
          )}

          {/* Section 1: Patient Details */}
          <Surface style={styles.sectionCard}>
            <SectionHeader number="1" title="Patient Details" />
            <View style={styles.inputRow}>
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Patient Name</Text>
                <TextInput textColor="#000000" placeholderTextColor="#000000" placeholder="Enter patient's name" value={patientData.patientName} onChangeText={(text) => setPatientData({ ...patientData, patientName: text })} mode="outlined" style={styles.input} outlineColor="#e2e8f0" activeOutlineColor={COLORS.secondary} />
              </View>
              <View style={styles.spacer} />
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Diseases</Text>
                <TextInput textColor="#000000" placeholderTextColor="#000000" placeholder="Enter diseases" value={patientData.subject} onChangeText={(text) => setPatientData({ ...patientData, subject: text })} mode="outlined" style={styles.input} outlineColor="#e2e8f0" activeOutlineColor={COLORS.secondary} />
              </View>
            </View>

            <View style={[styles.inputRow, { marginTop: 16 }]}>
              <View style={styles.flex1}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Phone (+91)</Text>
                  {patientData.phone.replace(/\D/g, '').length >= 10 && (
                    <TouchableOpacity 
                      onPress={() => handleManualPhoneCheck(patientData.phone)}
                      disabled={checkingProfilesLoading}
                    >
                      {checkingProfilesLoading ? (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8' }}>Checking...</Text>
                      ) : (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.secondary }}>Check Profiles</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput textColor="#000000" placeholderTextColor="#000000" placeholder="Phone" value={patientData.phone} onChangeText={handlePhoneInputChange} mode="outlined" keyboardType="phone-pad" style={styles.input} outlineColor="#e2e8f0" activeOutlineColor={COLORS.secondary} />
              </View>
              <View style={styles.spacer} />
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput textColor="#000000" placeholderTextColor="#000000" placeholder="Email" value={patientData.email} onChangeText={(text) => setPatientData({ ...patientData, email: text })} mode="outlined" style={styles.input} outlineColor="#e2e8f0" activeOutlineColor={COLORS.secondary} />
              </View>
            </View>

            <View style={[styles.inputRow, { marginTop: 16 }]}>
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Marketing Source</Text>
                <Menu
                  visible={menuVisible.source}
                  onDismiss={() => toggleMenu('source')}
                  style={{ marginTop: 42 }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}
                  anchor={
                    <TouchableOpacity
                      onLayout={onDropdownLayout('source')}
                      style={[styles.dropdown, !!patientData.patientId && { backgroundColor: '#f1f5f9', opacity: 0.7 }]}
                      onPress={() => !patientData.patientId && toggleMenu('source')}
                      disabled={!!patientData.patientId}
                    >
                      <Megaphone size={16} color="#94a3b8" />
                      <Text style={[styles.dropdownText, !patientData.source && { color: '#94a3b8' }]} numberOfLines={1}>
                        {patientData.patientId ? 'Old Patient' : (patientData.source || 'Select')}
                      </Text>
                      <ChevronDown size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  }
                >
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                    {['Instagram', 'Facebook', 'Website', 'Google', 'Practo', 'Referral', 'Youtube', 'Walk-in', 'Old Patient'].map((item) => (
                      <Menu.Item
                        key={item}
                        onPress={() => { setPatientData({ ...patientData, source: item }); toggleMenu('source'); }}
                        title={item}
                        titleStyle={{ color: '#000000', fontWeight: '500', fontSize: 13 }}
                      />
                    ))}
                  </ScrollView>
                </Menu>
              </View>
              <View style={styles.spacer} />
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>Mode of Consultation</Text>
                <Menu
                  visible={menuVisible.mode}
                  onDismiss={() => toggleMenu('mode')}
                  style={{ marginTop: 42 }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}
                  anchor={
                    <TouchableOpacity
                      onLayout={onDropdownLayout('mode')}
                      style={styles.dropdown}
                      onPress={() => toggleMenu('mode')}
                    >
                      <Users size={16} color="#94a3b8" />
                      <Text style={[styles.dropdownText, !patientData.modeOfConsultation && { color: '#94a3b8' }]} numberOfLines={1}>
                        {patientData.modeOfConsultation || 'Select'}
                      </Text>
                      <ChevronDown size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  }
                >
                  <ScrollView style={{ maxHeight: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                    {['In-Clinic', 'Online'].map((item) => (
                      <Menu.Item
                        key={item}
                        onPress={() => { setPatientData({ ...patientData, modeOfConsultation: item }); toggleMenu('mode'); }}
                        title={item}
                        titleStyle={{ color: '#000000', fontWeight: '500', fontSize: 13 }}
                      />
                    ))}
                  </ScrollView>
                </Menu>
              </View>
            </View>
          </Surface>

          {/* Section 2: Appointment Information */}
          <Surface style={styles.sectionCard}>
            <SectionHeader number="2" title="Appointment Information" />
            <View style={styles.fullWidthInput}>
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowDatePicker(true)}>
                <CalendarIcon size={16} color="#94a3b8" /><Text style={styles.dropdownText}>{patientData.date.toLocaleDateString()}</Text><CalendarIcon size={16} color="#94a3b8" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={patientData.date}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onValueChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      let updatedDoctor = patientData.doctor;
                      if (patientData.doctor && patientData.branch) {
                        const slots = generateSlotsForSelected(patientData.doctor, patientData.branch.name, selectedDate);
                        if (slots.length === 0) {
                          updatedDoctor = null; // Clear doctor selection if unavailable
                        }
                      }
                      setPatientData({ ...patientData, date: selectedDate, doctor: updatedDoctor, timeSlot: null });
                    }
                  }}
                  onDismiss={() => setShowDatePicker(false)}
                />
              )}
            </View>

            {/* 1. Doctor Selection Dropdown */}
            <View style={styles.fullWidthInput}>
              <Text style={styles.inputLabel}>Select Doctor</Text>
              <Menu
                visible={menuVisible.doctor}
                onDismiss={() => toggleMenu('doctor')}
                style={{ marginTop: 42 }}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}
                anchor={
                  <TouchableOpacity
                    onLayout={onDropdownLayout('doctor')}
                    style={styles.dropdown}
                    onPress={() => toggleMenu('doctor')}
                  >
                    <User size={16} color="#94a3b8" />
                    <Text style={[styles.dropdownText, !patientData.doctor && { color: '#94a3b8' }]} numberOfLines={1}>
                      {patientData.doctor?.name || 'Select Doctor'}
                    </Text>
                    <ChevronDown size={16} color="#94a3b8" />
                  </TouchableOpacity>
                }
              >
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                  {doctors
                    .filter((doc) => {
                      if (patientData.modeOfConsultation === 'Online') return true;
                      if (userData?.role === 'receptionist') {
                        const recBranch = userData.branchName || userData.branchId;
                        if (!recBranch) return true;
                        return isDoctorAvailableAtBranchOnDate(doc, recBranch, patientData.date);
                      }
                      return true;
                    })
                    .map((doc) => (
                      <Menu.Item
                        key={doc.id}
                        onPress={() => {
                          const branchVal = userData?.role === 'receptionist'
                            ? (userData.branchName || userData.branchId)
                            : null;
                          setPatientData({
                            ...patientData,
                            doctor: doc,
                            branch: branchVal ? { id: branchVal, name: getCanonicalBranchName(branchVal) } : null,
                            timeSlot: null
                          });
                          toggleMenu('doctor');
                        }}
                        title={doc.name}
                        titleStyle={{ color: '#000000', fontWeight: '500', fontSize: 13 }}
                      />
                    ))}
                </ScrollView>
              </Menu>
            </View>

            {/* 2. Branch Selection Dropdown - Dynamically populated based on selected doctor */}
            {patientData.doctor && (
              <View style={styles.fullWidthInput}>
                <Text style={styles.inputLabel}>Select Branch</Text>
                <Menu
                  visible={menuVisible.branch}
                  onDismiss={() => toggleMenu('branch')}
                  style={{ marginTop: 42 }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}
                  anchor={
                    <TouchableOpacity
                      onLayout={onDropdownLayout('branch')}
                      style={[
                        styles.dropdown,
                        userData?.role === 'receptionist' && { backgroundColor: '#f1f5f9' }
                      ]}
                      onPress={() => {
                        if (userData?.role === 'receptionist') return;
                        toggleMenu('branch');
                      }}
                    >
                      <MapPin size={16} color="#94a3b8" />
                      <Text style={[styles.dropdownText, !patientData.branch && { color: '#94a3b8' }]} numberOfLines={1}>
                        {patientData.branch?.name || 'Select Branch'}
                      </Text>
                      {userData?.role !== 'receptionist' && <ChevronDown size={16} color="#94a3b8" />}
                    </TouchableOpacity>
                  }
                >
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} persistentScrollbar={true} indicatorStyle="black" nestedScrollEnabled={true}>
                    {patientData.doctor.branches?.map((branchName) => (
                      <Menu.Item
                        key={branchName}
                        onPress={() => { setPatientData({ ...patientData, branch: { id: getStandardBranchName(branchName), name: getStandardBranchName(branchName) }, timeSlot: null }); toggleMenu('branch'); }}
                        title={branchName}
                        titleStyle={{ color: '#000000', fontWeight: '500', fontSize: 13 }}
                      />
                    ))}
                  </ScrollView>
                </Menu>
              </View>
            )}

            {/* Time Slot Selection */}
            <View style={{ marginTop: 24 }}>
              <View style={styles.slotHeader}>
                <Clock size={16} color={COLORS.secondary} />
                <Text style={styles.subLabel}>  Available Slots</Text>
              </View>

              {!patientData.doctor || !patientData.branch ? (
                <View style={styles.noDoctorMsg}>
                  <Info size={14} color="#94a3b8" />
                  <Text style={styles.noDoctorText}> Please select a doctor and branch to check availability.</Text>
                </View>
              ) : patientData.modeOfConsultation === 'Online' ? (
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: '#f0f9ff', borderColor: COLORS.primary, height: 50 }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Clock size={18} color={COLORS.primary} />
                    <Text style={[styles.dropdownText, { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 }]} numberOfLines={1}>
                      {patientData.timeSlot || 'Select Custom Time'}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={new Date()}
                      mode="time"
                      display="default"
                      onValueChange={(event, selectedTime) => {
                        setShowTimePicker(false);
                        if (selectedTime) {
                          let hours = selectedTime.getHours();
                          let minutes = selectedTime.getMinutes();
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12;
                          hours = hours ? hours : 12; // the hour '0' should be '12'
                          const strTime = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ' ' + ampm;
                          setPatientData({ ...patientData, timeSlot: strTime });
                        }
                      }}
                      onDismiss={() => setShowTimePicker(false)}
                    />
                  )}
                </View>
              ) : fetchingSlots ? (
                <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 10 }} />
              ) : availableSlots.length === 0 ? (
                <View style={[styles.noDoctorMsg, { flexDirection: 'column', alignItems: 'stretch', padding: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Info size={16} color="#ef4444" />
                    <Text style={[styles.noDoctorText, { color: '#ef4444', fontWeight: '800', marginLeft: 8 }]}>
                      {`${patientData.doctor.name.startsWith('Dr.') || patientData.doctor.name.startsWith('Dr ') ? patientData.doctor.name : `Dr. ${patientData.doctor.name}`} is not available on ${patientData.date.toLocaleDateString('en-US', { weekday: 'long' })}s at ${patientData.branch.name}.`}
                    </Text>
                  </View>
                  <Text style={[styles.noDoctorText, { color: '#475569', fontSize: 11, lineHeight: 16, marginTop: 4, paddingLeft: 24 }]}>
                    {getOtherBranchAvailability(patientData.doctor, patientData.branch.name, patientData.date)}
                  </Text>
                </View>
              ) : (
                <View style={styles.slotGrid}>
                  <TouchableOpacity
                    style={[styles.slotChip, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderStyle: 'dashed' }]}
                    onPress={() => setShowCustomSlotPicker(true)}
                  >
                    <Text style={[styles.slotText, { color: '#0284c7' }]}>+ Add Custom Slot</Text>
                  </TouchableOpacity>

                  {showCustomSlotPicker && (
                    <DateTimePicker
                      value={new Date()}
                      mode="time"
                      display="default"
                      onValueChange={async (event, selectedTime) => {
                        setShowCustomSlotPicker(false);
                        if (selectedTime) {
                          let hours = selectedTime.getHours();
                          let minutes = selectedTime.getMinutes();
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12;
                          hours = hours ? hours : 12; // the hour '0' should be '12'
                          const newSlot = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ' ' + ampm;

                          try {
                            const targetBranch = normalizeBranchName(patientData.branch.name);
                            const year = patientData.date.getFullYear();
                            const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
                            const day = String(patientData.date.getDate()).padStart(2, '0');
                            const dateString = `${year}-${month}-${day}`;

                            const qExtra = query(
                              collection(db, 'extra_slots'),
                              where('doctorId', '==', patientData.doctor.id),
                              where('dateString', '==', dateString)
                            );
                            const snap = await getDocs(qExtra);
                            let docRefToUpdate = null;
                            snap.forEach(d => {
                              const dbBranch = normalizeBranchName(d.data().branchName || d.data().branchId);
                              if (dbBranch === targetBranch) docRefToUpdate = d.ref;
                            });

                            if (docRefToUpdate) {
                              await updateDoc(docRefToUpdate, { slots: arrayUnion(newSlot) });
                            } else {
                              await addDoc(collection(db, 'extra_slots'), {
                                doctorId: patientData.doctor.id,
                                branchName: targetBranch,
                                dateString: dateString,
                                slots: [newSlot]
                              });
                            }
                          } catch (e) { console.error(e); }
                        }
                      }}
                      onDismiss={() => setShowCustomSlotPicker(false)}
                    />
                  )}

                  {availableSlots.map((slot, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.slotChip,
                        !slot.isAvailable && styles.slotDisabled,
                        patientData.timeSlot === slot.time && styles.slotSelected,
                        slot.isFull && slot.isAvailable && { borderColor: COLORS.warning, borderWidth: 1.5 }
                      ]}
                      disabled={!slot.isAvailable}
                      onPress={() => setPatientData({ ...patientData, timeSlot: slot.time })}
                    >
                      <Text style={[
                        styles.slotText,
                        !slot.isAvailable && styles.slotTextDisabled,
                        patientData.timeSlot === slot.time && styles.slotTextSelected
                      ]}>
                        {slot.time}
                      </Text>
                      {slot.isAvailable ? (
                        <Text style={[
                          styles.sessionsLeftText,
                          patientData.timeSlot === slot.time && styles.sessionsLeftTextSelected,
                          slot.isFull && { color: COLORS.warning, fontWeight: '700' }
                        ]}>
                          {slot.isFull ? `+${slot.bookedCount - 2} Booked` : `${slot.sessionsLeft} left`}
                        </Text>
                      ) : slot.isBlockedByNoShow ? (
                        <View style={[styles.fullBadge, { backgroundColor: '#fee2e2' }]}><Text style={[styles.fullText, { color: '#ef4444' }]}>No Show</Text></View>
                      ) : (
                        <View style={styles.fullBadge}><Text style={styles.fullText}>Passed</Text></View>
                      )}
                      {slot.isExtra && (
                        <TouchableOpacity
                          style={{
                            position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444',
                            borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10
                          }}
                          onPress={async () => {
                            try {
                              const targetBranch = normalizeBranchName(patientData.branch.name);
                              const year = patientData.date.getFullYear();
                              const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
                              const day = String(patientData.date.getDate()).padStart(2, '0');
                              const dateString = `${year}-${month}-${day}`;

                              const qExtra = query(
                                collection(db, 'extra_slots'),
                                where('doctorId', '==', patientData.doctor.id),
                                where('dateString', '==', dateString)
                              );
                              const snap = await getDocs(qExtra);
                              snap.forEach(d => {
                                const dbBranch = normalizeBranchName(d.data().branchName || d.data().branchId);
                                if (dbBranch === targetBranch) {
                                  updateDoc(d.ref, { slots: arrayRemove(slot.time) });
                                }
                              });
                            } catch (err) { console.error(err); }
                          }}
                        >
                          <X size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.slotChip, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderStyle: 'dashed' }]}
                    onPress={async () => {
                      let lastTime = '08:00 PM';
                      if (availableSlots.length > 0) {
                        lastTime = availableSlots[availableSlots.length - 1].time;
                      }
                      const match = lastTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
                      if (match) {
                        let hours = parseInt(match[1], 10);
                        const minutes = parseInt(match[2], 10);
                        const ampm = match[3].toUpperCase();
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        let totalMin = hours * 60 + minutes + 15;
                        let newH = Math.floor(totalMin / 60) % 24;
                        let newM = totalMin % 60;
                        let newAmpm = newH >= 12 ? 'PM' : 'AM';
                        let displayH = newH > 12 ? newH - 12 : (newH === 0 ? 12 : newH);
                        const newSlot = `${displayH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')} ${newAmpm}`;

                        try {
                          const targetBranch = normalizeBranchName(patientData.branch.name);
                          const year = patientData.date.getFullYear();
                          const month = String(patientData.date.getMonth() + 1).padStart(2, '0');
                          const day = String(patientData.date.getDate()).padStart(2, '0');
                          const dateString = `${year}-${month}-${day}`;

                          const qExtra = query(
                            collection(db, 'extra_slots'),
                            where('doctorId', '==', patientData.doctor.id),
                            where('dateString', '==', dateString)
                          );
                          const snap = await getDocs(qExtra);
                          let docRefToUpdate = null;
                          snap.forEach(d => {
                            const dbBranch = normalizeBranchName(d.data().branchName || d.data().branchId);
                            if (dbBranch === targetBranch) docRefToUpdate = d.ref;
                          });

                          if (docRefToUpdate) {
                            await updateDoc(docRefToUpdate, { slots: arrayUnion(newSlot) });
                          } else {
                            await addDoc(collection(db, 'extra_slots'), {
                              doctorId: patientData.doctor.id,
                              branchName: targetBranch,
                              dateString: dateString,
                              slots: [newSlot]
                            });
                          }
                        } catch (e) { console.error(e); }
                      }
                    }}
                  >
                    <Text style={[styles.slotText, { color: '#0284c7' }]}>+ Add Slot</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Surface>

          {/* Confirm Button — using TouchableOpacity to avoid react-native-paper Button clipping nested Views on some devices */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
            style={[styles.confirmBtn, {
              backgroundColor: COLORS.secondary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 16,
              paddingHorizontal: 20,
              opacity: loading ? 0.7 : 1,
            }]}
          >
            <View style={styles.row}>
              <ShieldCheck size={20} color={COLORS.white} />
              <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
            </View>
            {loading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <ArrowRight size={20} color={COLORS.white} />
            }
          </TouchableOpacity>

          <View style={styles.footerSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Direct Payment Checkout Modal */}
      <Modal visible={checkoutModalVisible} transparent animationType="slide" onRequestClose={handleDirectPayLater}>
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            {!showSuccessScreen ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.paymentModalTitle}>Reception Checkout</Text>
                  <TouchableOpacity onPress={handleDirectPayLater} style={styles.closeBtn}>
                    <X size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.paymentModalSub}>Patient: {patientData.patientName}</Text>
                <Text style={[styles.paymentModalSub, { marginTop: 2 }]}>Mobile: {patientData.phone || 'N/A'}</Text>

                <Divider style={{ marginVertical: 16 }} />

                <Text style={styles.fieldLabel}>Consultation Fee (₹)</Text>
                <RNTextInput
                  style={styles.numericInput}
                  value={checkoutPaymentMethod === 'free' ? '0' : checkoutAmount}
                  onChangeText={setCheckoutAmount}
                  keyboardType="numeric"
                  placeholder="Enter consultation fee"
                  editable={checkoutPaymentMethod !== 'free'}
                />

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Select Payment Method</Text>

                {(() => {
                  const isFromApp = patientData.source === 'UserApp' || patientData.source === 'Online' || patientData.source === 'Patient App';
                  if (isFromApp) {
                    return (
                      <View style={styles.methodRow}>
                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'phone_link' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('phone_link')}
                        >
                          <Phone size={18} color={checkoutPaymentMethod === 'phone_link' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'phone_link' && styles.methodButtonTextActive]}>  Razorpay</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'cash' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('cash')}
                        >
                          <Coins size={18} color={checkoutPaymentMethod === 'cash' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'cash' && styles.methodButtonTextActive]}>  Cash</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'split' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('split')}
                        >
                          <ArrowRightLeft size={18} color={checkoutPaymentMethod === 'split' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'split' && styles.methodButtonTextActive]}>  Split</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'free' && styles.methodButtonActive]}
                          onPress={() => {
                            const total = Number(checkoutAmount) || 0;
                            if (total > 0) {
                              Alert.alert("Invalid Option", "The 'Free' payment method can only be selected when the total billing amount is ₹0.");
                              return;
                            }
                            setCheckoutPaymentMethod('free');
                            setCheckoutAmount('0');
                          }}
                        >
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'free' && styles.methodButtonTextActive]}>Free</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  } else {
                    return (
                      <View style={styles.methodRow}>
                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'upi' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('upi')}
                        >
                          <Coins size={18} color={checkoutPaymentMethod === 'upi' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'upi' && styles.methodButtonTextActive]}>  UPI</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'cash' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('cash')}
                        >
                          <Coins size={18} color={checkoutPaymentMethod === 'cash' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'cash' && styles.methodButtonTextActive]}>  Cash</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'split' && styles.methodButtonActive]}
                          onPress={() => setCheckoutPaymentMethod('split')}
                        >
                          <ArrowRightLeft size={18} color={checkoutPaymentMethod === 'split' ? '#ffffff' : '#64748b'} />
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'split' && styles.methodButtonTextActive]}>  Split</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.methodButton, checkoutPaymentMethod === 'free' && styles.methodButtonActive]}
                          onPress={() => {
                            const total = Number(checkoutAmount) || 0;
                            if (total > 0) {
                              Alert.alert("Invalid Option", "The 'Free' payment method can only be selected when the total billing amount is ₹0.");
                              return;
                            }
                            setCheckoutPaymentMethod('free');
                            setCheckoutAmount('0');
                          }}
                        >
                          <Text style={[styles.methodButtonText, checkoutPaymentMethod === 'free' && styles.methodButtonTextActive]}>Free</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                })()}

                {checkoutPaymentMethod === 'phone_link' && (
                  <View style={{ alignItems: 'center', marginVertical: 12, backgroundColor: '#f0fdf4', borderRadius: 16, padding: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#86efac', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#166534', textAlign: 'center', fontWeight: '700', marginBottom: 12 }}>
                      Send Payment Link via SMS/WhatsApp
                    </Text>
                    <Text style={{ fontSize: 11, color: '#15803d', textAlign: 'center', marginBottom: 20 }}>
                      The patient will receive a link on their phone to complete the payment securely.
                    </Text>
                  </View>
                )}

                {checkoutPaymentMethod === 'split' && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 6 }}>Cash Amount (₹)</Text>
                      <RNTextInput
                        style={[styles.numericInput, { height: 40, fontSize: 14, marginBottom: 0 }]}
                        value={splitAmountCash}
                        onChangeText={(text) => {
                          setSplitAmountCash(text);
                          const total = Number(checkoutAmount) || 0;
                          const cash = Number(text) || 0;
                          if (cash <= total) {
                            setSplitAmountUpi(String(total - cash));
                          }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 6 }}>UPI Amount (₹)</Text>
                      <RNTextInput
                        style={[styles.numericInput, { height: 40, fontSize: 14, marginBottom: 0 }]}
                        value={splitAmountUpi}
                        onChangeText={(text) => {
                          setSplitAmountUpi(text);
                          const total = Number(checkoutAmount) || 0;
                          const upi = Number(text) || 0;
                          if (upi <= total) {
                            setSplitAmountCash(String(total - upi));
                          }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </View>
                )}

                {checkoutPaymentMethod === 'upi' && (
                  <View style={{ alignItems: 'center', marginVertical: 12, backgroundColor: '#f8fafc', borderRadius: 16, padding: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', fontWeight: '700', marginBottom: 12 }}>
                      Pay using Razorpay Payment Gateway
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 20 }}>
                      Launches the secure payment checkout sheet for cards, netbanking, and UPI.
                    </Text>
                    <Button
                      mode="contained"
                      onPress={handleCompleteRzpCheckout}
                      loading={processingRzp}
                      style={{ borderRadius: 12, width: '100%', paddingVertical: 4 }}
                      buttonColor={COLORS.secondary}
                    >
                      <Text style={{ fontWeight: '800', color: '#fff', fontSize: 14 }}>⚡ Launch Razorpay Checkout</Text>
                    </Button>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <Button
                    mode="outlined"
                    onPress={handleDirectPayLater}
                    style={styles.payLaterBtn}
                    textColor="#64748b"
                    outlineColor="#e2e8f0"
                  >
                    Pay Later
                  </Button>

                  {checkoutPaymentMethod === 'upi' ? (
                    <Button
                      mode="contained"
                      onPress={handleCompleteRzpCheckout}
                      style={styles.payNowBtn}
                      loading={processingRzp}
                      buttonColor={COLORS.secondary}
                    >
                      ⚡ Pay with Razorpay
                    </Button>
                  ) : (
                    <Button
                      mode="contained"
                      onPress={() => handleConfirmDirectPayment(null)}
                      style={styles.payNowBtn}
                      loading={loading}
                      buttonColor="#10b981"
                    >
                      ✓ Confirm Paid
                    </Button>
                  )}
                </View>
              </ScrollView>
            ) : (
              /* Payment Confirmation Success Screen */
              <View style={styles.successContainer}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <CheckCircle2 size={48} color="#10b981" />
                </View>
                <Text style={styles.successTitle}>Payment Confirmed!</Text>
                <Text style={styles.successMsg}>
                  Walk-in consultation payment collected successfully
                </Text>

                <View style={{ width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Patient</Text>
                    <Text style={{ fontSize: 13, color: '#1e293b', fontWeight: '700' }}>{patientData.patientName}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Amount</Text>
                    <Text style={{ fontSize: 18, color: '#10b981', fontWeight: '900' }}>₹{paymentSuccessData?.amount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Method</Text>
                    <Text style={{ fontSize: 13, color: '#1e293b', fontWeight: '700', textTransform: 'uppercase' }}>{paymentSuccessData?.method}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 }} />
                  <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>Ref: {paymentSuccessData?.paymentId}</Text>
                </View>

                <View style={{ width: '100%', backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fef3c7' }}>
                  <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '700', textAlign: 'center' }}>
                    ℹ️ Reward points are earned only when patients pay via the Patient App
                  </Text>
                </View>

                <Button
                  mode="contained"
                  onPress={handleSuccessClose}
                  style={styles.successDoneBtn}
                  buttonColor={COLORS.secondary}
                >
                  Done
                </Button>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Existing Mobile Profiles Modal */}
      <Modal
        visible={existingProfilesModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExistingProfilesModalVisible(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <View style={[styles.paymentModalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={20} color={COLORS.secondary} />
                <Text style={styles.paymentModalTitle}>Existing Profiles Found</Text>
              </View>
              <TouchableOpacity onPress={() => setExistingProfilesModalVisible(false)} style={styles.closeBtn}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#fffbe6', padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#ffe58f' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#d48806' }}>
                Phone Number: +91 {checkedPhone}
              </Text>
              <Text style={{ fontSize: 11, color: '#8c6b00', marginTop: 2, fontWeight: '500' }}>
                This mobile number is already registered for {existingProfilesList.length} family member profile(s). Choose an existing profile or add a new family member profile below.
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={{ maxHeight: 260 }}>
              {existingProfilesList.map((prof) => (
                <Surface key={prof.id} style={{ padding: 14, borderRadius: 14, backgroundColor: '#ffffff', marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b' }}>{prof.fullName}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.secondary, marginTop: 2 }}>
                        Reg ID: {prof.registrationId}
                      </Text>
                      {prof.branchName ? (
                        <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Branch: {prof.branchName}</Text>
                      ) : null}
                    </View>
                    <Button
                      mode="contained"
                      compact
                      buttonColor={COLORS.secondary}
                      onPress={() => handleSelectExistingProfile(prof)}
                      style={{ borderRadius: 8 }}
                      labelStyle={{ fontSize: 11, fontWeight: '800' }}
                    >
                      Book for {prof.fullName.split(' ')[0]}
                    </Button>
                  </View>
                </Surface>
              ))}
            </ScrollView>

            <Divider style={{ marginVertical: 14 }} />

            <Button
              mode="contained-tonal"
              icon={({ size }) => <UserPlus size={size} color="#16a34a" />}
              buttonColor="#f0fdf4"
              textColor="#16a34a"
              onPress={handleCreateNewFamilyProfile}
              style={{ borderRadius: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#bbf7d0' }}
              labelStyle={{ fontSize: 13, fontWeight: '800' }}
            >
              + Create New Profile / Add Family Member
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfdfe' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#ef4444' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  banner: { backgroundColor: '#eff6ff', borderRadius: 24, padding: 20, flexDirection: 'row', marginBottom: 24, height: 140, elevation: 0, borderWidth: 1, borderColor: '#dbeafe', overflow: 'hidden' },
  bannerTextContainer: { flex: 1.2, justifyContent: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  bannerHighlight: { fontSize: 18, fontWeight: '800', color: COLORS.secondary, marginTop: 2 },
  bannerSub: { fontSize: 10, color: '#64748b', marginTop: 8, fontWeight: '500', lineHeight: 14 },
  bannerImage: { flex: 0.8, width: '100%', height: '120%', position: 'absolute', right: -10, bottom: -10 },
  sectionCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  numberBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numberText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#f1f5f9', marginLeft: 12 },
  inputRow: { flexDirection: 'row', width: '100%' },
  flex1: { flex: 1 },
  spacer: { width: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  input: { backgroundColor: '#fcfdfe', height: 42, fontSize: 12 },
  disabledInput: { backgroundColor: '#f8fafc' },
  regIdBox: { position: 'relative' },
  verifiedIcon: { position: 'absolute', right: 12, top: '50%', marginTop: -8 },
  fullWidthInput: { marginTop: 16 },
  dropdown: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fcfdfe' },
  dropdownText: { flex: 1, marginLeft: 10, fontSize: 12, color: '#1e293b', fontWeight: '500' },
  subLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: '#f8fafc', marginBottom: 12 },
  searchField: { flex: 1, marginLeft: 10, fontSize: 12, color: '#1e293b' },
  doctorList: { marginTop: 4 },
  doctorItem: { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderRadius: 10 },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  selectedDoctor: { backgroundColor: '#f0f9ff', borderBottomWidth: 0 },
  docInfo: { flex: 1, marginLeft: 10 },
  docName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  docSpecLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  slotHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  noDoctorMsg: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginBottom: 12 },
  noDoctorText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  slotChip: { width: '22%', margin: '1.5%', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#fff', position: 'relative' },
  slotSelected: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  slotDisabled: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', opacity: 0.6 },
  slotText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  slotTextSelected: { color: '#fff' },
  slotTextDisabled: { color: '#94a3b8' },
  sessionsLeftText: { fontSize: 8, color: '#64748b', marginTop: 2, fontWeight: '600' },
  sessionsLeftTextSelected: { color: 'rgba(255, 255, 255, 0.8)' },
  fullBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', paddingHorizontal: 4, borderRadius: 4 },
  fullText: { fontSize: 8, color: '#fff', fontWeight: '800' },
  confirmBtn: { borderRadius: 16, marginTop: 8 },
  confirmBtnContent: { height: 56 },
  confirmBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16 },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginLeft: 12, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  footerSpacing: { height: 40 },

  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    flex: 1,
    marginHorizontal: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  paymentModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  paymentModalContent: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  paymentModalSub: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  numericInput: {
    backgroundColor: '#f8fafc',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  methodButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 4,
  },
  methodButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  methodButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  methodButtonTextActive: {
    color: '#ffffff',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  qrTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  qrSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  payLaterBtn: {
    flex: 1,
    borderColor: '#e2e8f0',
    marginRight: 4,
  },
  payNowBtn: {
    flex: 1.2,
    marginLeft: 4,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 8,
  },
  successMsg: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 12,
    fontWeight: '500',
    marginBottom: 16,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 0,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  couponBadge: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    elevation: 0,
  },
  couponLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  couponCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16a34a',
    marginVertical: 4,
    letterSpacing: 1,
  },
  couponEx: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  successDoneBtn: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    borderRadius: 14,
  },
});

export default RegisterPatient;
