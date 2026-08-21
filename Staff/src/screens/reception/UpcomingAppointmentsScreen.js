import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Linking,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Avatar, ActivityIndicator, Button } from 'react-native-paper';
import { db, auth } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  addDoc,
  limit
} from 'firebase/firestore';
import { sendCancellationSMS, sendRescheduleSMS } from '../../utils/smsHelper';
import {
  ChevronLeft,
  Search,
  Calendar,
  X,
  Clock,
  Phone,
  MessageCircle,
  CalendarClock,
  Trash2,
  User,
  MapPin,
  Stethoscope,
  Play,
  ChevronRight,
  ChevronDown,
  Check
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { checkIsInDuration } from './Rejoin/index';

const capitalizeWords = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  danger: '#ef4444',
  success: '#4ade80',
  border: '#e2e8f0',
};

const CANONICAL_DOCTORS = [
  'Dr. Prashanth K Vaidya',
  'Dr. Ramakrishna Chanduri',
  'Dr. Jobedah Parveej',
  'Dr. Padma Priya'
];

const DEFAULT_CLINIC_SLOTS = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
];

const matchDoctorSchedule = (docName, doctorsList = []) => {
  if (!docName || typeof docName !== 'string') return null;

  const norm = (str) => String(str).toLowerCase().replace(/[^a-z]/g, '');
  const targetNorm = norm(docName);

  if (Array.isArray(doctorsList)) {
    for (const docObj of doctorsList) {
      if (docObj && docObj.name && norm(docObj.name) === targetNorm) {
        return docObj;
      }
    }
  }

  for (const [key, sched] of Object.entries(DOCTOR_SCHEDULES)) {
    if (norm(key) === targetNorm || norm(sched.name) === targetNorm) {
      return sched;
    }
  }

  if (targetNorm.includes('prashan') || targetNorm.includes('vaidya')) {
    return DOCTOR_SCHEDULES['1'];
  }
  if (targetNorm.includes('ramakrishna') || targetNorm.includes('chanduri')) {
    return DOCTOR_SCHEDULES['2'];
  }
  if (targetNorm.includes('jobed') || targetNorm.includes('parveej') || targetNorm.includes('jubeid')) {
    return DOCTOR_SCHEDULES['3'];
  }
  if (targetNorm.includes('padma') || targetNorm.includes('priya')) {
    return DOCTOR_SCHEDULES['4'];
  }

  return null;
};

const CANONICAL_BRANCHES = [
  'Kphb',
  'Chandanagar',
  'Dilshuknagar',
  'Nallagandla'
];

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


import { getStandardBranchName } from '../../utils/idGenerator';

const getCanonicalBranchName = (name) => {
  return getStandardBranchName(name);
};

const normalizeBranchName = (name) => {
  return getStandardBranchName(name).toLowerCase();
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

const UpcomingAppointmentsScreen = ({ navigation }) => {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Date Filtering States
  const [selectedDate, setSelectedDate] = useState(new Date()); // default = today, calendar to switch days
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reschedule Modal States
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showReschDatePicker, setShowReschDatePicker] = useState(false);
  const [rescheduleTime, setRescheduleTime] = useState(new Date());
  const [showReschTimePicker, setShowReschTimePicker] = useState(false);
  const [rescheduleDoctor, setRescheduleDoctor] = useState('');
  const [rescheduleBranch, setRescheduleBranch] = useState('');
  const [showDoctorPickerModal, setShowDoctorPickerModal] = useState(false);
  const [showBranchPickerModal, setShowBranchPickerModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [rescheduleAvailableSlots, setRescheduleAvailableSlots] = useState([]);
  const [fetchingRescheduleSlots, setFetchingRescheduleSlots] = useState(false);

  useEffect(() => {
    let unsubExtra = null;
    const fetchRescheduleSlots = async () => {
      if (!rescheduleDoctor || !rescheduleBranch || !rescheduleDate) {
        setRescheduleAvailableSlots([]);
        return;
      }
      setFetchingRescheduleSlots(true);
      try {
        const matchedDoc = matchDoctorSchedule(rescheduleDoctor, doctors);

        if (!matchedDoc) {
          setRescheduleAvailableSlots(DEFAULT_CLINIC_SLOTS.map(t => ({ time: t, sessionsLeft: 3, isAvailable: true })));
          setFetchingRescheduleSlots(false);
          return;
        }

        const year = rescheduleDate.getFullYear();
        const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
        const day = String(rescheduleDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const docId = matchedDoc.id || matchedDoc.name || rescheduleDoctor;

        const qExtra = query(
          collection(db, 'extra_slots'),
          where('doctorId', '==', docId),
          where('dateString', '==', dateString)
        );

        const qAppts = query(
          collection(db, 'allpatients'),
          where('doctorId', '==', docId),
          where('dateString', '==', dateString)
        );
        const snapAppts = await getDocs(qAppts).catch(() => ({ docs: [] }));
        const counts = {};
        snapAppts.forEach(d => {
          const t = d.data().timeSlot || d.data().appointmentTime;
          if (t) counts[t] = (counts[t] || 0) + 1;
        });

        unsubExtra = onSnapshot(qExtra, (snapExtra) => {
          let extraSlotsList = [];
          const targetBranchNorm = normalizeBranchName(rescheduleBranch);
          snapExtra.forEach(dSnap => {
            const data = dSnap.data();
            const bNorm = normalizeBranchName(data.branchName || data.branchId);
            if (bNorm === targetBranchNorm && Array.isArray(data.slots)) {
              extraSlotsList.push(...data.slots);
            }
          });

          const baseGenerated = generateSlotsForSelected(matchedDoc, rescheduleBranch, rescheduleDate);
          const slotsBase = baseGenerated.length > 0 ? baseGenerated : DEFAULT_CLINIC_SLOTS;
          const combined = [...new Set([...slotsBase, ...extraSlotsList])];

          combined.sort((a, b) => {
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

          const isToday = rescheduleDate.toDateString() === new Date().toDateString();
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

          const parseToMin = (t) => {
            const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
            if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };

          const slotsWithMeta = combined.map(timeStr => {
            const booked = counts[timeStr] || 0;
            const sessionsLeft = Math.max(0, 3 - booked);
            const slotMin = parseToMin(timeStr);
            const isPast = isToday && slotMin <= nowMinutes;
            const isFull = sessionsLeft <= 0;
            return {
              time: timeStr,
              bookedCount: booked,
              sessionsLeft,
              isPast,
              isFull,
              isBlocked: isPast || isFull,
              isAvailable: !isPast && !isFull
            };
          });

          setRescheduleAvailableSlots(slotsWithMeta);
          setFetchingRescheduleSlots(false);

          if (combined.length > 0) {
            const currentSlotStr = formatTimeStr(rescheduleTime);
            if (!combined.includes(currentSlotStr)) {
              const firstSlot = combined[0];
              const [timeStr, period] = firstSlot.split(' ');
              let [h, m] = timeStr.split(':').map(Number);
              if (period === 'PM' && h < 12) h += 12;
              if (period === 'AM' && h === 12) h = 0;
              const newT = new Date(rescheduleDate);
              newT.setHours(h, m, 0, 0);
              setRescheduleTime(newT);
            }
          }
        }, (err) => {
          console.warn("Error loading extra slots for reschedule:", err);
          const baseGenerated = generateSlotsForSelected(matchedDoc, rescheduleBranch, rescheduleDate);
          const slotsBase = baseGenerated.length > 0 ? baseGenerated : DEFAULT_CLINIC_SLOTS;
          const slotsWithMeta = slotsBase.map(t => ({ time: t, sessionsLeft: 3, isAvailable: true }));
          setRescheduleAvailableSlots(slotsWithMeta);
          setFetchingRescheduleSlots(false);
        });

      } catch (err) {
        console.error("Reschedule slots fetch error:", err);
        setFetchingRescheduleSlots(false);
      }
    };

    fetchRescheduleSlots();

    return () => {
      if (unsubExtra) unsubExtra();
    };
  }, [rescheduleDoctor, rescheduleBranch, rescheduleDate, doctors]);

  const handleAddRescheduleExtraSlot = async (type) => {
    if (!rescheduleDoctor || !rescheduleBranch || !rescheduleDate) return;

    const matchedDoc = matchDoctorSchedule(rescheduleDoctor, doctors);

    const docId = matchedDoc?.id || rescheduleDoctor;
    const year = rescheduleDate.getFullYear();
    const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(rescheduleDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    let newSlot = '10:00 AM';
    if (type === 'before' && rescheduleAvailableSlots.length > 0) {
      const item = rescheduleAvailableSlots[0];
      const timeStr = typeof item === 'string' ? item : item.time;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        let tot = h * 60 + m - 15;
        if (tot < 0) tot += 1440;
        let nH = Math.floor(tot / 60) % 24;
        let nM = tot % 60;
        let nAmpm = nH >= 12 ? 'PM' : 'AM';
        let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
        newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
      }
    } else if (type === 'after' && rescheduleAvailableSlots.length > 0) {
      const item = rescheduleAvailableSlots[rescheduleAvailableSlots.length - 1];
      const timeStr = typeof item === 'string' ? item : item.time;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        let tot = h * 60 + m + 15;
        let nH = Math.floor(tot / 60) % 24;
        let nM = tot % 60;
        let nAmpm = nH >= 12 ? 'PM' : 'AM';
        let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
        newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
      }
    }

    try {
      const targetBranchNorm = normalizeBranchName(rescheduleBranch);
      const qExtra = query(
        collection(db, 'extra_slots'),
        where('doctorId', '==', docId),
        where('dateString', '==', dateString)
      );
      const snap = await getDocs(qExtra);
      let docRefToUpdate = null;
      snap.forEach(d => {
        const bNorm = normalizeBranchName(d.data().branchName || d.data().branchId);
        if (bNorm === targetBranchNorm) docRefToUpdate = d.ref;
      });

      if (docRefToUpdate) {
        await updateDoc(docRefToUpdate, { slots: [...new Set([...(docRefToUpdate.data().slots || []), newSlot])] });
      } else {
        await addDoc(collection(db, 'extra_slots'), {
          doctorId: docId,
          branchName: rescheduleBranch,
          dateString: dateString,
          slots: [newSlot]
        });
      }
    } catch (err) {
      console.error("Error adding extra slot during reschedule:", err);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList = [];
      snapshot.forEach(docSnap => {
        docsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDoctors(docsList);
    });
    return () => unsubscribe();

  }, []);

  const [activePackageMobiles, setActivePackageMobiles] = useState(new Set());


  useEffect(() => {
    const q = query(collection(db, 'package_members'), limit(300));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mobiles = new Set();
      const today = new Date().toISOString().split('T')[0];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (today >= data.startDate && today <= data.endDate) {
          mobiles.add(data.patientMobile);
        }
      });
      setActivePackageMobiles(mobiles);
    }, (error) => {
      console.error("Error listening to package members in upcoming appointments screen: ", error);
    });

    return () => unsubscribe();
  }, []);


  const generateSlotsForSelected = (doctor, branchName, date) => {
    if (!doctor || !branchName || !date) return [];

    const day = date.getDay();
    let docSched = null;
    if (typeof doctor === 'object' && doctor.timings) {
      docSched = doctor;
    } else if (typeof doctor === 'string') {
      docSched = matchDoctorSchedule(doctor, doctors);
    } else if (doctor && doctor.name) {
      docSched = matchDoctorSchedule(doctor.name, doctors);
    }
    if (!docSched && doctor && doctor.id && DOCTOR_SCHEDULES[doctor.id]) {
      docSched = DOCTOR_SCHEDULES[doctor.id];
    }
    if (!docSched) return [];

    const dayTimings = [];
    (docSched.timings || []).forEach(t => {
      if (normalizeBranchName(t.branch) !== normalizeBranchName(branchName)) return;
      if (t.daySchedule) {
        const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
        if (ivs.length > 0) {
          dayTimings.push({ intervals: ivs });
        }
      } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
        dayTimings.push({ intervals: t.intervals });
      }
    });

    if (dayTimings.length === 0) return [];

    const slots = [];
    dayTimings.forEach(t => {
      t.intervals.forEach(iv => {
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
          const formattedTime = `${displayHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')} ${period}`;

          slots.push(formattedTime);

          currentMin += 30;
          if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60);
            currentMin = currentMin % 60;
          }
        }
      });
    });

    return slots;
  };

  const getFirstAvailableDate = (doctor, branchName, fallbackDate) => {
    if (!doctor || !branchName) return fallbackDate || new Date();
    const start = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const slots = generateSlotsForSelected(doctor, branchName, d);
      if (slots.length > 0) {
        return d;
      }
    }
    return fallbackDate || start;
  };

  useEffect(() => {
    if (userData?.role === 'receptionist') return; // Do not auto-push date for receptionists
    if (rescheduleDoctor && rescheduleBranch) {
      const matchedDoctor = doctors.find(
        (d) => d.name && d.name.toLowerCase() === rescheduleDoctor.toLowerCase()
      ) || Object.values(DOCTOR_SCHEDULES).find(
        (d) => d.name && d.name.toLowerCase() === rescheduleDoctor.toLowerCase()
      );
      if (matchedDoctor) {
        const slots = generateSlotsForSelected(matchedDoctor, rescheduleBranch, rescheduleDate);
        if (slots.length === 0) {
          const nextAvail = getFirstAvailableDate(matchedDoctor, rescheduleBranch, rescheduleDate);
          setRescheduleDate(nextAvail);
        }
      }
    }
  }, [rescheduleDoctor, rescheduleBranch, doctors, userData]);

  // 1. Determine Receptionist Branch Names
  const getBranchNames = () => {
    if (!userData) return [];
    const branchVariations = new Set();
    branchVariations.add(userData.branchId || '');
    if (userData.branchName) branchVariations.add(userData.branchName);

    const checkAndAdd = (name) => {
      if (!name) return;
      const lower = name.toLowerCase();
      if (lower.includes('kphb')) {
        branchVariations.add('KPHB');
        branchVariations.add('KPHB Branch');
      } else if (lower.includes('chnr') || lower.includes('chandanagar') || lower.includes('chandnagar')) {
        branchVariations.add('Chandnagar');
        branchVariations.add('Chandnagar Branch');
        branchVariations.add('Chandanagar');
        branchVariations.add('CHANDNAGAR');
      } else if (lower.includes('dsnr') || lower.includes('dilsukhnagar') || lower.includes('dilshuknagar')) {
        branchVariations.add('Dilshuknagar');
        branchVariations.add('Dilshuknagar Branch');
        branchVariations.add('Dilsukhnagar');
      } else if (lower.includes('nallagandla')) {
        branchVariations.add('Nallagandla');
        branchVariations.add('Nallagandla Branch');
      }
    };

    checkAndAdd(userData.branchId);
    checkAndAdd(userData.branchName);
    return Array.from(branchVariations).filter(Boolean);
  };

  // 2. Fetch Upcoming Appointments
  useEffect(() => {
    if (!userData) return;

    // Compute today's date string once for reference inside the snapshot callback
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayDashDate = `${todayYear}-${todayMonth}-${todayDay}`;

    let ptsList = [];
    const updateCombined = () => {
      setAppointments(ptsList);
      setLoading(false);
    };

    // Query allpatients — fetch ALL today's records matching any active/past status (same set as Dashboard)
    const qPatients = query(
      collection(db, 'allpatients'),
      where('status', 'in', ['waiting', 'confirmed', 'booked', 'pending', 'in-consultation', 'checked-in', 'completed', 'done'])
    );

    const unsubPatients = onSnapshot(qPatients, (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        // Branch filter — skip only if user has a known branch AND appointment is from a different branch
        const role = userData?.role || '';
        const isAdmin = role === 'admin' || role === 'hr' || role === 'superadmin';
        if (!isAdmin) {
          const myBranch1 = normalizeBranchName(userData.branchId);
          const myBranch2 = normalizeBranchName(userData.branchName);
          const dataBranch1 = normalizeBranchName(data.branchId);
          const dataBranch2 = normalizeBranchName(data.branchName);

          // Only apply branch filter when user has a resolvable branch
          if (myBranch1 !== '' || myBranch2 !== '') {
            const branchMatch =
              dataBranch1 === myBranch1 || dataBranch1 === myBranch2 ||
              dataBranch2 === myBranch1 || dataBranch2 === myBranch2;
            if (!branchMatch) return;
          }
        }

        const name = (data.fullName || data.patientName || data.patient || '').toLowerCase().trim();
        // Only exclude records whose ENTIRE name is a dummy placeholder (not partial matches)
        const isDummy = ['test', 'dummy', 'exit', 'demo', 'temp'].includes(name);
        if (isDummy) return;

        // Normalise dateString from any stored format (string OR Firestore Timestamp)
        let dateString = data.dateString;
        if (!dateString && data.appointmentDate) {
          let apptStr = '';
          if (typeof data.appointmentDate === 'string') {
            apptStr = data.appointmentDate;
          } else if (typeof data.appointmentDate?.toDate === 'function') {
            // Firestore Timestamp → convert to DD/MM/YYYY string first
            const d = data.appointmentDate.toDate();
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            apptStr = `${dd}/${mm}/${yyyy}`;
          }
          if (apptStr) {
            const parts = apptStr.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                // DD/MM/YYYY → YYYY-MM-DD
                dateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
              } else if (parts[0].length === 4) {
                // YYYY-MM-DD already
                dateString = `${parts[0]}-${parts[1]}-${parts[2]}`;
              }
            }
          }
        }

        // Drop records without any resolvable date
        if (!dateString) return;

        // Only keep today-and-future appointments (drop stale past records)
        if (dateString < todayDashDate) return;

        list.push({
          id: docSnap.id,
          ...data,
          dateString,
          timeSlot: data.appointmentTime || data.timeSlot || '10:00 AM',
          patientName: data.fullName || data.patientName || data.patient || 'Unknown Patient'
        });
      });
      ptsList = list;
      updateCombined();
    }, (error) => {
      console.error('Error fetching upcoming patients:', error);
      setLoading(false);
    });

    return () => {
      unsubPatients();
    };
    // selectedDate intentionally excluded — date filtering happens in the JS filter below
    // so the listener only needs to re-subscribe when the user/branch changes
  }, [userData]);

  // Helper: Format Time string from Date object
  const formatTimeStr = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    return `${hoursStr}:${minutesStr} ${ampm}`;
  };

  // 3. Reschedule Submit Action
  const handleRescheduleSubmit = async () => {
    if (!selectedAppt) return;
    try {
      const matchedDoctor = doctors.find(
        (d) => d.name && d.name.toLowerCase() === rescheduleDoctor.toLowerCase()
      ) || Object.values(DOCTOR_SCHEDULES).find(
        (d) => d.name && d.name.toLowerCase() === rescheduleDoctor.toLowerCase()
      );
      if (matchedDoctor && rescheduleBranch) {
        const slots = rescheduleAvailableSlots.length > 0 ? rescheduleAvailableSlots : generateSlotsForSelected(matchedDoctor, rescheduleBranch, rescheduleDate);
        if (slots.length === 0) {
          Alert.alert(
            'Doctor Unavailable',
            `Dr. ${rescheduleDoctor} is not scheduled to work at ${rescheduleBranch} on ${rescheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}s.`
          );
          return;
        }

        // Fetch Doctor No Shows and validate
        try {
          const qNoShows = query(
            collection(db, 'doctor_no_shows'),
            where('doctorId', '==', matchedDoctor.id)
          );
          const snapNoShows = await getDocs(qNoShows);
          const activeNoShows = [];
          const normFormBranch = rescheduleBranch.toLowerCase().replace(/\s*branch\s*/i, '').trim();
          snapNoShows.forEach(docSnap => {
            const ns = docSnap.data();
            const nsBranch = (ns.branchName || ns.branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
            if (nsBranch === normFormBranch) {
              activeNoShows.push(ns);
            }
          });

          const timeSlotStr = formatTimeStr(rescheduleTime);
          const year = rescheduleDate.getFullYear();
          const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
          const day = String(rescheduleDate.getDate()).padStart(2, '0');
          const dateStringDash = `${year}-${month}-${day}`;

          if (isSlotBlockedByNoShow(timeSlotStr, dateStringDash, activeNoShows)) {
            Alert.alert(
              'Doctor Unavailable',
              `Cannot reschedule: Dr. ${rescheduleDoctor} is marked as NO SHOW (unavailable) at ${rescheduleBranch} for this time period.`
            );
            return;
          }
        } catch (nsErr) {
          console.error("Error checking doctor no show on mobile reschedule:", nsErr);
        }
      }

      const year = rescheduleDate.getFullYear();
      const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
      const day = String(rescheduleDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const dateSlash = `${day}/${month}/${year}`;
      const timeSlot = formatTimeStr(rescheduleTime);

      const doctorIdToSave = matchedDoctor ? matchedDoctor.id : rescheduleDoctor;

      const updatePayload = {
        date: rescheduleDate.toISOString(),
        dateString,
        appointmentDate: dateSlash,
        timeSlot,
        appointmentTime: timeSlot,
        doctorName: rescheduleDoctor,
        doctor: rescheduleDoctor,
        doctorId: doctorIdToSave,
        branchId: getStandardBranchName(rescheduleBranch),
        branchName: getStandardBranchName(rescheduleBranch),
        isRescheduled: true,
        lastRescheduledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 1. Update allpatients document
      const allPatientsRef = doc(db, 'allpatients', selectedAppt.id);
      await updateDoc(allPatientsRef, updatePayload);

      // Update linked patients document if it exists
      if (selectedAppt.patientId && selectedAppt.patientId !== 'WALKIN_USER') {
        try {
          const pRef = doc(db, 'patients', selectedAppt.patientId);
          await updateDoc(pRef, {
            appointmentDate: dateSlash,
            appointmentTime: timeSlot,
            doctor: rescheduleDoctor,
            branchId: getStandardBranchName(rescheduleBranch),
            branchName: getStandardBranchName(rescheduleBranch)
          });
        } catch (patientErr) {
          console.log('Error updating walk-in patient document:', patientErr);
        }
      }

      const formattedDateStr = rescheduleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

      // 3. Trigger reschedule in-app notification & SMS asynchronously
      (async () => {
        if (selectedAppt.patientId && selectedAppt.patientId !== 'WALKIN_USER') {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: selectedAppt.patientId,
              title: '📅 Appointment Rescheduled',
              body: `Your appointment with ${rescheduleDoctor ? (rescheduleDoctor.toLowerCase().startsWith('dr') ? rescheduleDoctor : `Dr. ${rescheduleDoctor}`) : 'Doctor'} has been rescheduled to ${formattedDateStr} at ${timeSlot}.`,
              type: 'booking_confirmed',
              isRead: false,
              appointmentId: selectedAppt.id,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn("Error creating reschedule notification:", notifErr);
          }
        }
        try {
          sendRescheduleSMS(
            selectedAppt.phone || selectedAppt.patientPhone || '',
            selectedAppt.fullName || selectedAppt.patientName || '',
            rescheduleDoctor,
            formattedDateStr,
            timeSlot,
            rescheduleBranch
          );
        } catch (smsErr) {
          console.warn('[SMS] Reschedule SMS confirmation error:', smsErr);
        }
      })();

      setRescheduleModalVisible(false);
      Alert.alert('Success', 'Appointment rescheduled successfully!');
    } catch (error) {
      console.error('Reschedule submit error:', error);
      Alert.alert('Error', 'Failed to reschedule appointment.');
    }
  };

  const handleStartConsultation = async (appt) => {
    try {
      setLoading(true);
      // 1. Update status to 'in-consultation' in both collections in Firestore
      const apptRefAll = doc(db, 'allpatients', appt.id);
      await updateDoc(apptRefAll, {
        status: 'in-consultation',
        consultationStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Update status in patients collection to 'in-consultation' if patientId exists
      if (appt.patientId && appt.patientId !== 'WALKIN_USER') {
        try {
          const pRef = doc(db, 'patients', appt.patientId);
          await updateDoc(pRef, {
            status: 'in-consultation',
            updatedAt: serverTimestamp()
          });
        } catch (patientErr) {
          console.log('Error updating patient doc status to in-consultation:', patientErr);
        }
      }

      Alert.alert('Success', 'Consultation started successfully!');

      // Navigate to PatientDetails screen
      const targetId = (appt.patientId && appt.patientId !== 'WALKIN_USER') ? appt.patientId : appt.id;
      navigation.navigate('PatientDetails', { patientId: targetId });
    } catch (err) {
      console.error('Error starting consultation:', err);
      Alert.alert('Error', 'Failed to start consultation.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Cancel/Delete Action
  const handleCancelAppointment = (appt) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel ${appt.patientName || appt.fullName}'s appointment?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Update status in allpatients collection to 'cancelled'
              await updateDoc(doc(db, 'allpatients', appt.id), {
                status: 'cancelled',
                updatedAt: serverTimestamp()
              });

              // Legacy collections fallback
              try {
                await updateDoc(doc(db, 'appointments', appt.id), {
                  status: 'cancelled',
                  updatedAt: serverTimestamp()
                });
              } catch (e) { }

              // 2. Update status in patients collection to 'cancelled' if walk-in
              if (appt.patientId && appt.patientId !== 'WALKIN_USER') {
                try {
                  await updateDoc(doc(db, 'patients', appt.patientId), {
                    status: 'cancelled'
                  });
                } catch (patientErr) {
                  console.log('Error updating patient doc status:', patientErr);
                }
              }

              const dateObj = new Date(appt.date);
              const formattedDateStr = isNaN(dateObj.getTime())
                ? appt.dateString || appt.date || ''
                : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

              // 3. Trigger cancellation in-app notification & SMS asynchronously
              (async () => {
                if (appt.patientId && appt.patientId !== 'WALKIN_USER') {
                  try {
                    await addDoc(collection(db, 'notifications'), {
                      userId: appt.patientId,
                      title: '❌ Appointment Cancelled',
                      body: `Your appointment with ${appt.doctorName ? (appt.doctorName.toLowerCase().startsWith('dr') ? appt.doctorName : `Dr. ${appt.doctorName}`) : 'Doctor'} on ${formattedDateStr} at ${appt.timeSlot || ''} has been cancelled.`,
                      type: 'booking_cancelled',
                      isRead: false,
                      appointmentId: appt.id,
                      createdAt: serverTimestamp()
                    });
                  } catch (notifErr) {
                    console.warn("Error creating cancellation notification:", notifErr);
                  }
                }
                try {
                  sendCancellationSMS(
                    appt.phone || appt.patientPhone || '',
                    appt.fullName || appt.patientName || '',
                    appt.doctorName || '',
                    formattedDateStr,
                    appt.timeSlot || '',
                    appt.branchName || 'Clinic'
                  );
                } catch (smsErr) {
                  console.warn('[SMS] Cancellation SMS trigger error:', smsErr);
                }
              })();

              Alert.alert('Success', 'Appointment cancelled successfully.');
            } catch (err) {
              console.error('Error cancelling appointment:', err);
              Alert.alert('Error', 'Failed to cancel appointment.');
            }
          }
        }
      ]
    );
  };

  // 5. Open Reschedule Modal Handler
  const openRescheduleModal = (appt) => {
    setSelectedAppt(appt);
    setRescheduleBranch(getCanonicalBranchName(appt.branchName || appt.branchId) || CANONICAL_BRANCHES[0]);
    const docRaw = appt.doctorName || appt.doctor || appt.doctor_name || '';
    const matchedDoc = matchDoctorSchedule(docRaw, doctors);
    const docNameClean = matchedDoc ? matchedDoc.name : (docRaw || CANONICAL_DOCTORS[0]);
    setRescheduleDoctor(docNameClean);

    // Parse Date
    let defaultDate = new Date();
    if (appt.dateString) {
      const parts = appt.dateString.split('-');
      if (parts.length === 3) {
        defaultDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    setRescheduleDate(defaultDate);

    // Parse Time
    let defaultTime = new Date();
    if (appt.timeSlot) {
      const match = appt.timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hrs = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hrs < 12) hrs += 12;
        if (ampm === 'AM' && hrs === 12) hrs = 0;
        defaultTime.setHours(hrs, mins, 0, 0);
      }
    }
    setRescheduleTime(defaultTime);
    setRescheduleModalVisible(true);
  };

  // 6. Action Launchers (Dialer, WhatsApp)
  const handleCall = (phone) => {
    if (!phone || phone === 'N/A') {
      Alert.alert('Error', 'No phone number available.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Error', 'Failed to open dialer.');
    });
  };

  const handleWhatsApp = (phone, name) => {
    if (!phone || phone === 'N/A') {
      Alert.alert('Error', 'No phone number available.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const message = `Hello ${name}, this is from SPH Clinic regarding your upcoming appointment.`;
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Make sure WhatsApp is installed on your device.');
    });
  };

  // 7. Time slot parser for JS sorting
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 9999;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 9999;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Today's YYYY-MM-DD for the UI filter
  const todayForFilter = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  // 8. JS Sorting & Local Filtering
  const filteredAppointments = appointments
    .filter((appt) => {
      // Calendar Date Filter
      if (selectedDate) {
        // A specific day is selected — show ONLY that day
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const filterDateStr = `${year}-${month}-${day}`;
        if (appt.dateString !== filterDateStr) return false;
      } else {
        // No date selected — show ALL upcoming (today and future)
        if (appt.dateString < todayForFilter) return false;
      }

      // Search Query Filter
      if (searchQuery.trim() !== '') {
        const queryLower = searchQuery.toLowerCase();
        const name = (appt.patientName || appt.fullName || '').toLowerCase();
        const phone = (appt.phone || '').toLowerCase();
        const docName = (appt.doctorName || appt.doctor || '').toLowerCase();
        const regId = (appt.registrationId || '').toLowerCase();
        return (
          name.includes(queryLower) ||
          phone.includes(queryLower) ||
          docName.includes(queryLower) ||
          regId.includes(queryLower)
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by dateString ascending
      if (a.dateString !== b.dateString) {
        return a.dateString.localeCompare(b.dateString);
      }
      // Sort by timeSlot ascending
      return parseTimeToMinutes(a.timeSlot) - parseTimeToMinutes(b.timeSlot);
    });

  // Group appointments by dateString for clean list visual rendering
  const groupedData = {};
  filteredAppointments.forEach(appt => {
    if (!groupedData[appt.dateString]) {
      groupedData[appt.dateString] = [];
    }
    groupedData[appt.dateString].push(appt);
  });

  const sortedDates = Object.keys(groupedData).sort();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Upcoming Appointments</Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              Total: {filteredAppointments.length} Booked
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient, phone, doctor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.muted}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={16} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Calendar Picker Trigger */}
        <TouchableOpacity
          style={[styles.calendarBtn, selectedDate && styles.calendarBtnActive]}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={20} color={selectedDate ? '#fff' : COLORS.secondary} />
        </TouchableOpacity>
      </View>

      {/* Active Date Chip */}
      {selectedDate && (
        <View style={styles.filterChipRow}>
          <Surface style={styles.filterChip} elevation={1}>
            <Calendar size={12} color={COLORS.secondary} style={{ marginRight: 6 }} />
            <Text style={styles.filterChipText}>
              Date: {selectedDate.toLocaleDateString('en-GB')}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              style={styles.filterChipClose}
            >
              <X size={14} color={COLORS.muted} />
            </TouchableOpacity>
          </Surface>
        </View>
      )}

      {/* DatePicker Component */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onValueChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(date);
            }
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Fetching upcoming schedule...</Text>
        </View>
      ) : filteredAppointments.length === 0 ? (
        <View style={styles.centered}>
          <Calendar size={48} color={COLORS.muted} style={{ marginBottom: 16, opacity: 0.5 }} />
          <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
          <Text style={styles.emptySubtitle}>
            {selectedDate
              ? 'Try selecting a different date or clear the filter.'
              : 'There are no active upcoming bookings currently scheduled.'}
          </Text>
          {selectedDate && (
            <Button
              mode="contained"
              buttonColor={COLORS.secondary}
              style={{ marginTop: 16, borderRadius: 12 }}
              onPress={() => setSelectedDate(null)}
            >
              Clear Filter
            </Button>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          showsVerticalScrollIndicator={false}
        >
          {sortedDates.map((dateStr) => {
            // Format Date Header nicely (e.g. 12 Jun 2026)
            let headerText = dateStr;
            try {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                headerText = dateObj.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  weekday: 'short'
                });
              }
            } catch (e) { }

            return (
              <View key={dateStr} style={styles.dateGroup}>
                <View style={styles.dateHeaderRow}>
                  <View style={styles.dateHeaderDot} />
                  <Text style={styles.dateHeader}>{headerText}</Text>
                </View>

                {groupedData[dateStr].map((appt) => (
                  <Surface key={appt.id} style={styles.card} elevation={1}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const targetId = (appt.patientId && appt.patientId !== 'WALKIN_USER') ? appt.patientId : appt.id;
                        navigation.navigate('PatientDetails', { patientId: targetId });
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <Avatar.Text
                          size={36}
                          label={
                            appt.patientName
                              ? appt.patientName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()
                              : 'P'
                          }
                          style={styles.avatar}
                          labelStyle={styles.avatarLabel}
                        />
                        <View style={styles.patientInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.patientName}>
                              {capitalizeWords(appt.patientName || appt.fullName)}
                            </Text>
                            {(() => {
                              const source = appt.source || appt.raw?.source;
                              const followUp = appt.followUpDate || appt.raw?.followUpDate || appt.medicationDurationEnd;
                              const normSource = (source || '').toLowerCase().trim();
                              const rawNormSource = (appt.raw?.source || '').toLowerCase().trim();
                              const isOld = !!followUp || normSource === 'old patient' || normSource === 'old_patient' || normSource === 'old' || rawNormSource === 'old patient' || rawNormSource === 'old_patient' || rawNormSource === 'old';
                              const isNew = !isOld && source && normSource !== 'old patient' && normSource !== 'old_patient' && normSource !== 'old';
                              const isApp = appt.isOnline || appt._type === 'online' || normSource === 'appointments' || normSource === 'online' || normSource === 'userapp' || normSource === 'patient app' || normSource === 'patientapp' || normSource === 'app' || rawNormSource === 'appointments' || rawNormSource === 'online' || rawNormSource === 'userapp' || rawNormSource === 'patient app' || rawNormSource === 'patientapp' || rawNormSource === 'app';
                              const isActive = followUp ? checkIsInDuration(followUp) : false;

                              return (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  {isNew && (
                                    <View style={{ backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 }}>
                                      <Text style={{ color: '#f43f5e', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>NEW</Text>
                                    </View>
                                  )}
                                  {isApp && (
                                    <View style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 }}>
                                      <Text style={{ color: '#7c3aed', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>APP</Text>
                                    </View>
                                  )}
                                  {isOld && (
                                    isActive ? (
                                      <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 }}>
                                        <Text style={{ color: '#d97706', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>IN DURATION</Text>
                                      </View>
                                    ) : (
                                      <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 }}>
                                        <Text style={{ color: '#0369a1', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>RE-BOOKING</Text>
                                      </View>
                                    )
                                  )}
                                </View>
                              );
                            })()}
                            {/* Package Tag */}
                            {appt.phone && activePackageMobiles.has(appt.phone) && (
                              <View style={{
                                backgroundColor: '#ecfdf5',
                                borderColor: '#a7f3d0',
                                borderWidth: 1,
                                borderRadius: 6,
                                paddingHorizontal: 4,
                                paddingVertical: 1,
                                marginLeft: 2
                              }}>
                                <Text style={{
                                  color: '#047857',
                                  fontSize: 7,
                                  fontWeight: '800',
                                  letterSpacing: 0.3
                                }}>PKG</Text>
                              </View>
                            )}
                            {appt.registrationId && (
                              <View style={styles.regIdBadge}>
                                <Text style={styles.regIdText}>{appt.registrationId}</Text>
                              </View>
                            )}

                          </View>
                          <Text style={styles.phoneText}>{appt.phone || 'No Phone'}</Text>
                        </View>

                        {/* Status Badge */}
                        <View
                          style={[
                            styles.statusBadge,
                            appt.status === 'confirmed' || appt.status === 'booked'
                              ? styles.statusConfirmed
                              : appt.status === 'completed' || appt.status === 'done'
                                ? styles.statusCompleted
                                : styles.statusPending
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              appt.status === 'confirmed' || appt.status === 'booked'
                                ? { color: '#0369a1' }
                                : appt.status === 'completed' || appt.status === 'done'
                                  ? { color: '#15803d' }
                                  : { color: '#a16207' }
                            ]}
                          >
                            {(appt.status || 'waiting').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Appt Middle Info */}
                      <View style={styles.cardBody}>
                        <View style={styles.infoRow}>
                          <Stethoscope size={14} color={COLORS.muted} style={{ marginRight: 6 }} />
                          <Text style={styles.infoText}>
                            {appt.doctorName ? `Dr. ${appt.doctorName.replace(/^Dr\.\s*/i, '')}` : 'General Doctor'}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Clock size={14} color={COLORS.muted} style={{ marginRight: 6 }} />
                          <Text style={styles.infoText}>{appt.timeSlot || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <MapPin size={14} color={COLORS.muted} style={{ marginRight: 6 }} />
                          <Text style={styles.infoText}>{getCanonicalBranchName(appt.branchName || appt.branchId) || 'SPH Clinic'}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Start/Resume Consultation Button */}
                    {['booked', 'waiting', 'pending', 'confirmed'].includes(appt.status) ? (
                      <TouchableOpacity
                        style={styles.startConsultationCardBtn}
                        onPress={() => handleStartConsultation(appt)}
                      >
                        <Play size={14} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.startConsultationCardBtnText}>Start Consultation</Text>
                      </TouchableOpacity>
                    ) : appt.status === 'in-consultation' ? (
                      <TouchableOpacity
                        style={[styles.startConsultationCardBtn, { backgroundColor: COLORS.success }]}
                        onPress={() => {
                          const targetId = (appt.patientId && appt.patientId !== 'WALKIN_USER') ? appt.patientId : appt.id;
                          navigation.navigate('PatientDetails', { patientId: targetId });
                        }}
                      >
                        <Play size={14} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.startConsultationCardBtnText}>Resume Consultation</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Actions Row */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={[styles.footerActionBtn, styles.rescheduleBtn]}
                        onPress={() => openRescheduleModal(appt)}
                      >
                        <CalendarClock size={15} color={COLORS.secondary} style={{ marginRight: 4 }} />
                        <Text style={styles.rescheduleBtnText}>Reschedule</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.footerActionBtn, styles.cancelBtn]}
                        onPress={() => handleCancelAppointment(appt)}
                      >
                        <Trash2 size={15} color={COLORS.danger} style={{ marginRight: 4 }} />
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>

                      <View style={{ flex: 1 }} />

                      <TouchableOpacity
                        style={[styles.footerIconBtn, { borderColor: COLORS.secondary, backgroundColor: '#f0f9ff' }]}
                        onPress={() => handleCall(appt.phone)}
                      >
                        <Phone size={15} color={COLORS.secondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.footerIconBtn, { borderColor: '#25d366', backgroundColor: '#ecfdf5' }]}
                        onPress={() => handleWhatsApp(appt.phone, appt.patientName || appt.fullName)}
                      >
                        <MessageCircle size={15} color="#25d366" />
                      </TouchableOpacity>
                    </View>
                  </Surface>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reschedule Modal */}
      <Modal visible={rescheduleModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Appointment</Text>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <X size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {selectedAppt && (
              <Text style={styles.modalPatientLabel}>
                Patient:{' '}
                <Text style={{ fontWeight: '800', color: COLORS.text }}>
                  {selectedAppt.patientName || selectedAppt.fullName}
                </Text>
              </Text>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              style={{ flexGrow: 0, maxHeight: 450 }}
              contentContainerStyle={{ paddingBottom: 24, paddingRight: 2 }}
            >
              {/* 1. Doctor Dropdown Picker */}
              <Text style={styles.formLabel}>Select Doctor</Text>
              <TouchableOpacity
                style={styles.formPickerTrigger}
                onPress={() => setShowDoctorPickerModal(true)}
              >
                <User size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={[styles.formPickerText, { flex: 1 }]}>
                  {rescheduleDoctor || 'Select Doctor'}
                </Text>
                <ChevronDown size={16} color={COLORS.muted} />
              </TouchableOpacity>

              {/* 2. Branch Dropdown Picker */}
              <Text style={[styles.formLabel, { marginTop: 10 }]}>Select Branch</Text>
              <TouchableOpacity
                style={styles.formPickerTrigger}
                disabled={userData?.role === 'receptionist'}
                onPress={() => setShowBranchPickerModal(true)}
              >
                <MapPin size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={[styles.formPickerText, { flex: 1 }]}>
                  {rescheduleBranch || 'Select Branch'}
                </Text>
                <ChevronDown size={16} color={COLORS.muted} />
              </TouchableOpacity>

              {/* 3. Date Selection */}
              <Text style={styles.formLabel}>Select New Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+14 Days', days: 14 },
                    { label: '+30 Days', days: 30 }
                  ].map(item => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + item.days);
                    const isSelected = rescheduleDate.toDateString() === targetDate.toDateString();
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[
                          styles.selectionOption,
                          isSelected && styles.selectionOptionActive,
                          { paddingHorizontal: 10, paddingVertical: 6 }
                        ]}
                        onPress={() => setRescheduleDate(targetDate)}
                      >
                        <Text style={[styles.selectionOptionText, isSelected && styles.selectionOptionTextActive]}>
                          {item.label} ({targetDate.getDate()}/{targetDate.getMonth() + 1})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.formPickerTrigger, { marginBottom: 12 }]}
                onPress={() => setShowReschDatePicker(true)}
              >
                <Calendar size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.formPickerText}>
                  Custom Date: {rescheduleDate.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>

              {showReschDatePicker && (
                <DateTimePicker
                  value={rescheduleDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  maximumDate={new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)}
                  onValueChange={(event, selectedDate) => {
                    setShowReschDatePicker(false);
                    if (selectedDate) {
                      setRescheduleDate(selectedDate);
                    }
                  }}
                  onDismiss={() => setShowReschDatePicker(false)}
                />
              )}

              {/* 4. Available Time Slots */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 4 }}>
                <Text style={styles.formLabel}>Select Time Slot</Text>
                {rescheduleDoctor && rescheduleBranch && rescheduleDate && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleAddRescheduleExtraSlot('before')}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.secondary }}>+ Before</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAddRescheduleExtraSlot('after')}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.secondary }}>+ After</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {fetchingRescheduleSlots ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.secondary} />
                  <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Loading slots...</Text>
                </View>
              ) : rescheduleAvailableSlots.length === 0 ? (
                <View style={{ padding: 12, backgroundColor: '#fef2f2', borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#fecaca' }}>
                  <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '600' }}>
                    No default schedule slots available for Dr. {rescheduleDoctor} at {rescheduleBranch} on this date.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                      style={{ backgroundColor: COLORS.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                      onPress={() => handleAddRescheduleExtraSlot('after')}
                    >
                      <Text style={{ fontSize: 11, color: '#ffffff', fontWeight: '800' }}>+ Add Extra Slot</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {rescheduleAvailableSlots.map(slotObj => {
                    const timeStr = typeof slotObj === 'string' ? slotObj : slotObj.time;
                    const isSelected = formatTimeStr(rescheduleTime) === timeStr;
                    const sessionsLeft = typeof slotObj === 'object' ? slotObj.sessionsLeft : 3;
                    const isPast = typeof slotObj === 'object' ? slotObj.isPast : false;
                    const isFull = typeof slotObj === 'object' ? slotObj.isFull : false;
                    const isBlocked = isPast || isFull;

                    let labelText = `${sessionsLeft} left`;
                    let labelColor = isSelected ? COLORS.secondary : COLORS.muted;
                    if (isPast) {
                      labelText = 'Passed';
                      labelColor = '#94a3b8';
                    } else if (isFull) {
                      labelText = 'Booked';
                      labelColor = '#ef4444';
                    }

                    return (
                      <TouchableOpacity
                        key={timeStr}
                        disabled={isBlocked}
                        style={[
                          styles.selectionOption,
                          isSelected && styles.selectionOptionActive,
                          isBlocked && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', opacity: 0.6 },
                          { paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' }
                        ]}
                        onPress={() => {
                          if (isBlocked) return;
                          const [tStr, period] = timeStr.split(' ');
                          let [h, m] = tStr.split(':').map(Number);
                          if (period === 'PM' && h < 12) h += 12;
                          if (period === 'AM' && h === 12) h = 0;
                          const newT = new Date(rescheduleTime);
                          newT.setHours(h, m, 0, 0);
                          setRescheduleTime(newT);
                        }}
                      >
                        <Text style={[styles.selectionOptionText, isSelected && styles.selectionOptionTextActive, isBlocked && { color: '#94a3b8', textDecorationLine: isPast ? 'line-through' : 'none' }]}>
                          {timeStr}
                        </Text>
                        <Text style={{ fontSize: 9, color: labelColor, fontWeight: '700', marginTop: 2 }}>
                          {labelText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[styles.formPickerTrigger, { marginBottom: 16 }]}
                onPress={() => setShowReschTimePicker(true)}
              >
                <Clock size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.formPickerText}>Custom Time: {formatTimeStr(rescheduleTime)}</Text>
              </TouchableOpacity>

              {showReschTimePicker && (
                <DateTimePicker
                  value={rescheduleTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onValueChange={(event, time) => {
                    setShowReschTimePicker(false);
                    if (time) setRescheduleTime(time);
                  }}
                  onDismiss={() => setShowReschTimePicker(false)}
                />
              )}
            </ScrollView>

            {/* Modal Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setRescheduleModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleRescheduleSubmit}
              >
                <Text style={styles.modalBtnSubmitText}>Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Doctor Dropdown Picker Modal */}
      <Modal visible={showDoctorPickerModal} transparent animationType="fade" onRequestClose={() => setShowDoctorPickerModal(false)}>
        <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => setShowDoctorPickerModal(false)}>
          <View style={[styles.modalContent, { maxHeight: '60%', paddingBottom: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Doctor</Text>
              <TouchableOpacity onPress={() => setShowDoctorPickerModal(false)}>
                <X size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {CANONICAL_DOCTORS.map(docName => {
                const isSelected = rescheduleDoctor === docName;
                return (
                  <TouchableOpacity
                    key={docName}
                    style={{
                      flexDirection: 'row',
                      justify: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff'
                    }}
                    onPress={() => {
                      setRescheduleDoctor(docName);
                      setShowDoctorPickerModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <User size={18} color={isSelected ? COLORS.secondary : COLORS.muted} style={{ marginRight: 12 }} />
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? COLORS.secondary : COLORS.text }}>
                        {docName}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={COLORS.secondary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Branch Dropdown Picker Modal */}
      <Modal visible={showBranchPickerModal} transparent animationType="fade" onRequestClose={() => setShowBranchPickerModal(false)}>
        <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={() => setShowBranchPickerModal(false)}>
          <View style={[styles.modalContent, { maxHeight: '50%', paddingBottom: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowBranchPickerModal(false)}>
                <X size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {CANONICAL_BRANCHES.map(brName => {
                const isSelected = rescheduleBranch === brName;
                return (
                  <TouchableOpacity
                    key={brName}
                    style={{
                      flexDirection: 'row',
                      justify: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff'
                    }}
                    onPress={() => {
                      setRescheduleBranch(brName);
                      setShowBranchPickerModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin size={18} color={isSelected ? COLORS.secondary : COLORS.muted} style={{ marginRight: 12 }} />
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? COLORS.secondary : COLORS.text }}>
                        {brName}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={COLORS.secondary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
    marginTop: 2
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 10
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    padding: 0
  },
  clearSearchBtn: {
    padding: 4
  },
  calendarBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  calendarBtnActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary
  },
  filterChipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary
  },
  filterChipClose: {
    marginLeft: 8,
    padding: 2
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 12
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16
  },
  dateGroup: {
    marginBottom: 20
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  dateHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginRight: 8
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    backgroundColor: '#eff6ff'
  },
  avatarLabel: {
    color: COLORS.secondary,
    fontWeight: '800',
    fontSize: 12
  },
  patientInfo: {
    flex: 1,
    marginLeft: 12
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  regIdBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  regIdText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted
  },
  phoneText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusConfirmed: {
    backgroundColor: '#e0f2fe'
  },
  statusCompleted: {
    backgroundColor: '#dcfce7'
  },
  statusPending: {
    backgroundColor: '#fef9c3'
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  cardBody: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
    gap: 6
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  rescheduleBtn: {
    borderColor: COLORS.secondary + '40',
    backgroundColor: COLORS.secondary + '08'
  },
  rescheduleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary
  },
  cancelBtn: {
    borderColor: COLORS.danger + '30',
    backgroundColor: COLORS.danger + '06'
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger
  },
  footerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '85%',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 14,
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  modalPatientLabel: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 16
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6
  },
  formPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 16
  },
  formPickerText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700'
  },
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16
  },
  selectionOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white
  },
  selectionOptionActive: {
    borderColor: COLORS.secondary,
    backgroundColor: '#eff6ff'
  },
  selectionOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted
  },
  selectionOptionTextActive: {
    color: COLORS.secondary,
    fontWeight: '700'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBtnCancel: {
    backgroundColor: '#f1f5f9'
  },
  modalBtnCancelText: {
    fontWeight: '700',
    color: COLORS.muted
  },
  modalBtnSubmit: {
    backgroundColor: COLORS.secondary
  },
  modalBtnSubmitText: {
    fontWeight: '700',
    color: COLORS.white
  },
  startConsultationCardBtn: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8
  },
  startConsultationCardBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  }
});

export default UpcomingAppointmentsScreen;
