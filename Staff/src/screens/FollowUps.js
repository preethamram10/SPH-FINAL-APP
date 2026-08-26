import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList, Linking } from 'react-native';
import { Text, Surface, ActivityIndicator, Avatar, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronRight, ChevronLeft, CalendarClock, Phone, MessageCircle, User, RefreshCw, CalendarPlus, X, Calendar, UserCheck, History, Clock, Building2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon = ({ size = 16, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);
import DateTimePicker from '@react-native-community/datetimepicker';
import { sendRescheduleSMS } from '../utils/smsHelper';
import { getStandardBranchName } from '../utils/idGenerator';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const normalizeBranchCode = (branch) => {
  if (!branch) return '';
  const str = String(branch).toLowerCase().trim();
  if (str.includes('kphb') || str.includes('kphp')) return 'kphb';
  if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandanagar';
  if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
  if (str.includes('nallagandla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
  return str.replace(/\s*branch\s*/i, '').trim();
};

const DOCTOR_SCHEDULES = {
  'Dr. Prashanth K Vaidya': {
    branches: ['Kphb', 'Chandanagar', 'Nallagandla'],
    timings: [
      { branch: 'Kphb', dayOfWeek: [1, 3, 5, 6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] },
      { branch: 'Chandanagar', dayOfWeek: [1, 3, 5, 6], intervals: [['10:00', '12:00'], ['19:30', '21:00']] },
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['11:00', '13:00']] },
      { branch: 'Nallagandla', dayOfWeek: [4], intervals: [['11:00', '13:00'], ['18:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['18:00', '20:00']] }
    ]
  },
  'Dr. Ramakrishna Chanduri': {
    branches: ['Dilshuknagar', 'Nallagandla'],
    timings: [
      { branch: 'Dilshuknagar', dayOfWeek: [0, 1, 2, 3, 4], intervals: [['10:00', '14:00'], ['17:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [5, 6], intervals: [['10:00', '20:00']] }
    ]
  },
  'Dr. Jobedah Parveej': {
    branches: ['Nallagandla', 'Kphb'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [1], intervals: [['11:00', '13:00'], ['18:00', '19:30']] },
      { branch: 'Kphb', dayOfWeek: [2, 3, 5], intervals: [['12:30', '14:00']] },
      { branch: 'Kphb', dayOfWeek: [6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] }
    ]
  },
  'Dr. Padma Priya': {
    branches: ['Nallagandla', 'Chandanagar'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [2, 3], intervals: [['10:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['10:00', '17:00']] },
      { branch: 'Chandanagar', dayOfWeek: [1, 5], intervals: [['12:00', '20:00']] },
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['17:30', '20:00']] },
      { branch: 'Chandanagar', dayOfWeek: [4], intervals: [['10:00', '20:00']] }
    ]
  }
};
const generateSlotsForSelectedInFollowUp = (docName, branchName, dateObj) => {
  if (!docName || !branchName || !dateObj) return [];
  const day = dateObj.getDay();
  const sched = DOCTOR_SCHEDULES[docName];
  if (!sched || !sched.timings) return [];

  const normTargetBranch = (branchName || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
  const dayTimings = [];
  sched.timings.forEach(t => {
    const normBranch = (t.branch || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
    if (normBranch.includes(normTargetBranch) || normTargetBranch.includes(normBranch)) {
      if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
        dayTimings.push({ intervals: t.intervals });
      }
    }
  });

  if (dayTimings.length === 0) return [];
  const slots = [];
  dayTimings.forEach(t => {
    (t.intervals || []).forEach(iv => {
      const [startHour, startMin] = iv[0].split(':').map(Number);
      const [endHour, endMin] = iv[1].split(':').map(Number);
      let cH = startHour, cM = startMin;
      while (cH < endHour || (cH === endHour && cM < endMin)) {
        const period = cH >= 12 ? 'PM' : 'AM';
        const displayH = cH > 12 ? cH - 12 : (cH === 0 ? 12 : cH);
        slots.push(`${displayH.toString().padStart(2, '0')}:${cM.toString().padStart(2, '0')} ${period}`);
        cM += 30;
        if (cM >= 60) { cH += Math.floor(cM / 60); cM = cM % 60; }
      }
    });
  });

  return slots;
};

const normalizeDateToYYYYMMDD = (dateVal) => {
  if (!dateVal) return '';
  if (dateVal.seconds) {
    const d = new Date(dateVal.seconds * 1000);
    return d.toISOString().split('T')[0];
  }
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) return dateVal.split('T')[0];
    if (dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) return dateVal;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) { }
  return '';
};

const getFilterIcon = (mode, isActive) => {
  const color = isActive ? '#ffffff' : COLORS.muted;
  const size = 13;
  switch (mode) {
    case 'today': return <Calendar size={size} color={color} />;
    case 'tomorrow': return <CalendarClock size={size} color={color} />;
    case 'last_month': return <History size={size} color={color} />;
    case 'last_2_months': return <History size={size} color={color} />;
    case 'last_4_months': return <History size={size} color={color} />;
    case 'upcoming_month': return <CalendarPlus size={size} color={color} />;
    case 'select_month': return <Calendar size={size} color={color} />;
    case 'custom': return <Calendar size={size} color={color} />;
    default: return <UserCheck size={size} color={color} />;
  }
};

const getUrgencyIndicatorColor = (dateStr) => {
  if (!dateStr) return COLORS.border;
  const normalized = normalizeDateToYYYYMMDD(dateStr);
  const todayStr = new Date().toISOString().split('T')[0];
  if (normalized === todayStr) return '#f59e0b'; // Today - Yellow
  if (normalized < todayStr) return '#ef4444'; // Overdue - Red
  return '#258ec8'; // Future - Blue
};

const getUrgencyBadge = (dateStr) => {
  if (!dateStr) return null;
  const normalized = normalizeDateToYYYYMMDD(dateStr);
  const todayStr = new Date().toISOString().split('T')[0];
  if (normalized === todayStr) {
    return (
      <View style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }}>
        <Text style={{ color: '#d97706', fontSize: 9, fontWeight: '800' }}>TODAY</Text>
      </View>
    );
  }
  if (normalized < todayStr) {
    return (
      <View style={{ backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }}>
        <Text style={{ color: '#dc2626', fontSize: 9, fontWeight: '800' }}>OVERDUE</Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: '#f0f9ff', borderColor: '#e0f2fe', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }}>
      <Text style={{ color: '#0284c7', fontSize: 9, fontWeight: '800' }}>SCHEDULED</Text>
    </View>
  );
};

const cleanDoctorName = (name) => {
  if (!name || typeof name !== 'string') return 'Unassigned';
  let cleaned = name.trim();
  const lowerCleaned = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lowerCleaned.includes('prashan') || lowerCleaned.includes('vaidya') || lowerCleaned.includes('vidya')) {
    return 'Dr. Prashanth K Vaidya';
  }
  if (lowerCleaned.includes('ramakrishna') || lowerCleaned.includes('chanduri')) {
    return 'Dr. Ramakrishna Chanduri';
  }
  if (lowerCleaned.includes('jobed') || lowerCleaned.includes('parveej') || lowerCleaned.includes('jubeid')) {
    return 'Dr. Jobedah Parveej';
  }
  if (lowerCleaned.includes('padma') || lowerCleaned.includes('priya')) {
    return 'Dr. Padma Priya';
  }

  const prefixRegex = /^(dr\.|dr\b|doctor\b)\s*/i;
  while (prefixRegex.test(cleaned)) {
    cleaned = cleaned.replace(prefixRegex, '');
  }
  if (!cleaned || cleaned.toLowerCase() === 'doctor') return 'Doctor';

  cleaned = cleaned.split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `Dr. ${cleaned}`;
};

const FollowUps = ({ navigation }) => {
  const { userData } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followUpDateFilter, setFollowUpDateFilter] = useState(new Date());
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [followUpFilterMode, setFollowUpFilterMode] = useState('all'); // 'all', 'today', 'tomorrow', 'custom', 'last_month', etc.
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [reschedulePatient, setReschedulePatient] = useState(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDoctor, setRescheduleDoctor] = useState('Dr. Ramakrishna Chanduri');
  const [rescheduleBranch, setRescheduleBranch] = useState('KPHB');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('10:00 AM');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    // 6 months back, current, 6 months forward
    for (let i = -6; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ value: `${year}-${monthNum}`, label });
    }
    return options;
  };

  useEffect(() => {
    let unsubFollowups = null;
    let unsubAllPatients = null;

    const isBranchMatch = (data) => {
      const userBranchRaw = userData?.branchId || userData?.branchName || userData?.branch || userData?.assignedBranch || userData?.clinic;
      const normUserBranch = normalizeBranchCode(userBranchRaw);

      const docBranchRaw = data.branchId || data.branchName || data.branch;
      const normDocBranch = normalizeBranchCode(docBranchRaw);

      if (normUserBranch) {
        return normDocBranch === normUserBranch;
      }

      return normDocBranch === 'kphb';
    };

    const followupsMap = new Map();
    const allPatientsMap = new Map();

    const updateList = () => {
      const combinedMap = new Map();

      // 1. Centralized followups collection records
      followupsMap.forEach((item, id) => {
        if (isBranchMatch(item)) {
          combinedMap.set(item.patientId || id, { id, ...item, _source: 'followups' });
        }
      });

      // 2. Allpatients records with set followUpDate
      allPatientsMap.forEach((item, id) => {
        if (item.followUpDate && item.followUpInterval !== 'No Follow-up' && isBranchMatch(item)) {
          const key = id;
          if (!combinedMap.has(key)) {
            combinedMap.set(key, {
              id,
              patientId: id,
              patientName: item.fullName || item.patientName || 'Patient',
              fullName: item.fullName || item.patientName || 'Patient',
              phone: item.phone || '',
              email: item.email || '',
              doctor: item.doctor || item.doctorName || '',
              branchId: item.branchId || item.branchName || item.branch || '',
              branchName: item.branchName || item.branchId || item.branch || '',
              followUpDate: item.followUpDate,
              followUpInterval: item.followUpInterval || '15 days',
              complaint: item.complaint || item.subject || 'Consultation',
              status: item.status || 'pending',
              _source: 'allpatients'
            });
          }
        }
      });

      setPatients(Array.from(combinedMap.values()));
      setLoading(false);
    };

    // Subscribe to followups collection
    const qFollowups = query(collection(db, 'followups'));
    unsubFollowups = onSnapshot(qFollowups, (snapshot) => {
      followupsMap.clear();
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.followUpInterval !== 'No Follow-up' && d.followUpDate) {
          followupsMap.set(docSnap.id, d);
        }
      });
      updateList();
    }, (err) => {
      console.error("Error listening to followups: ", err);
      setLoading(false);
    });

    // Subscribe to allpatients collection
    const qAllPatients = query(collection(db, 'allpatients'));
    unsubAllPatients = onSnapshot(qAllPatients, (snapshot) => {
      allPatientsMap.clear();
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.followUpDate && d.followUpInterval !== 'No Follow-up') {
          allPatientsMap.set(docSnap.id, d);
        }
      });
      updateList();
    }, (err) => {
      console.error("Error listening to allpatients: ", err);
      setLoading(false);
    });

    return () => {
      if (unsubFollowups) unsubFollowups();
      if (unsubAllPatients) unsubAllPatients();
    };
  }, [userData]);

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert('Error', 'No phone number available.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    Alert.alert(
      'Call Patient',
      `Call ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const url = `tel:${cleanPhone}`;
            Linking.canOpenURL(url).then(supported => {
              if (supported) {
                Linking.openURL(url);
              } else {
                Alert.alert('Error', 'Calling is not supported on this device.');
              }
            }).catch(err => {
              console.error('Call error:', err);
            });
          }
        }
      ]
    );
  };

  const handleWhatsApp = (phone, name) => {
    if (!phone) {
      Alert.alert('Error', 'No phone number available.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const text = `Hi ${name || 'Patient'}, this is Spiritual Homeopathy clinic regarding your follow-up appointment.`;
    Alert.alert(
      'WhatsApp Patient',
      `Message ${phone} on WhatsApp?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Message',
          onPress: () => {
            const url = `whatsapp://send?text=${encodeURIComponent(text)}&phone=91${cleanPhone}`;
            Linking.canOpenURL(url).then(supported => {
              if (supported) {
                Linking.openURL(url);
              } else {
                Linking.openURL(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(text)}`);
              }
            }).catch(err => {
              console.error('WhatsApp error:', err);
            });
          }
        }
      ]
    );
  };

  const handleRescheduleSubmit = async () => {
    if (!reschedulePatient) return;
    const year = rescheduleDate.getFullYear();
    const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(rescheduleDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateSlash = `${day}/${month}/${year}`;

    try {
      const followUpRef = doc(db, 'followups', reschedulePatient.id);
      await updateDoc(followUpRef, {
        followUpDate: dateStr,
        dateString: dateStr,
        date: dateStr,
        appointmentDate: dateSlash,
        timeSlot: rescheduleTimeSlot,
        appointmentTime: rescheduleTimeSlot,
        doctor: rescheduleDoctor,
        doctorName: rescheduleDoctor,
        branchName: rescheduleBranch,
        branchId: rescheduleBranch,
        status: 'booked',
        isRescheduled: true,
        updatedAt: serverTimestamp()
      });

      if (reschedulePatient.patientId) {
        try {
          await updateDoc(doc(db, 'allpatients', reschedulePatient.patientId), {
            followUpDate: dateStr,
            dateString: dateStr,
            date: dateStr,
            appointmentDate: dateSlash,
            timeSlot: rescheduleTimeSlot,
            appointmentTime: rescheduleTimeSlot,
            doctor: rescheduleDoctor,
            doctorName: rescheduleDoctor,
            branchName: rescheduleBranch,
            branchId: rescheduleBranch,
            status: 'booked',
            isRescheduled: true,
            updatedAt: serverTimestamp()
          });
        } catch (err) { }
      }

      try {
        if (sendRescheduleSMS) {
          await sendRescheduleSMS(
            reschedulePatient.phone,
            reschedulePatient.patientName || reschedulePatient.fullName,
            rescheduleDoctor,
            dateStr,
            rescheduleTimeSlot,
            rescheduleBranch
          );
        }
      } catch (smsErr) { }

      Alert.alert('Rescheduled', `Follow-up for ${reschedulePatient.patientName || reschedulePatient.fullName} successfully rescheduled to ${dateSlash} at ${rescheduleTimeSlot}.`);
    } catch (err) {
      console.error('Error rescheduling follow-up:', err);
      Alert.alert('Error', 'Failed to reschedule follow-up.');
    } finally {
      setRescheduleModalVisible(false);
      setReschedulePatient(null);
    }
  };

  const filteredPatients = React.useMemo(() => {
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = todayObj.toISOString().split('T')[0];

    const tomorrowObj = new Date(todayObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const customStr = followUpDateFilter.toISOString().split('T')[0];

    const filtered = patients.filter(p => {
      const fDateStr = normalizeDateToYYYYMMDD(p.followUpDate);
      if (!fDateStr) return false;

      if (followUpFilterMode === 'today') {
        return fDateStr === todayStr;
      } else if (followUpFilterMode === 'tomorrow') {
        return fDateStr === tomorrowStr;
      } else if (followUpFilterMode === 'custom') {
        return fDateStr === customStr;
      } else if (followUpFilterMode === 'last_month') {
        const firstOfLastMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(todayObj.getFullYear(), todayObj.getMonth(), 0, 23, 59, 59);
        const fTime = new Date(fDateStr + 'T00:00:00').getTime();
        return fTime >= firstOfLastMonth.getTime() && fTime <= lastOfLastMonth.getTime();
      } else if (followUpFilterMode === 'last_2_months') {
        const limitDate = new Date(todayObj);
        limitDate.setMonth(limitDate.getMonth() - 2);
        const fTime = new Date(fDateStr + 'T00:00:00').getTime();
        return fTime >= limitDate.getTime() && fTime <= todayObj.getTime() + 24 * 60 * 60 * 1000;
      } else if (followUpFilterMode === 'last_4_months') {
        const limitDate = new Date(todayObj);
        limitDate.setMonth(limitDate.getMonth() - 4);
        const fTime = new Date(fDateStr + 'T00:00:00').getTime();
        return fTime >= limitDate.getTime() && fTime <= todayObj.getTime() + 24 * 60 * 60 * 1000;
      } else if (followUpFilterMode === 'upcoming_month') {
        const firstOfNextMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 1);
        const lastOfNextMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + 2, 0, 23, 59, 59);
        const fTime = new Date(fDateStr + 'T00:00:00').getTime();
        return fTime >= firstOfNextMonth.getTime() && fTime <= lastOfNextMonth.getTime();
      } else if (followUpFilterMode === 'select_month') {
        return fDateStr.startsWith(selectedMonth);
      }
      return true; // Show all
    });

    filtered.sort((a, b) => {
      const dateA = normalizeDateToYYYYMMDD(a.followUpDate) || '';
      const dateB = normalizeDateToYYYYMMDD(b.followUpDate) || '';
      return dateA.localeCompare(dateB);
    });

    return filtered;
  }, [patients, followUpFilterMode, followUpDateFilter, selectedMonth]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation && navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else if (navigation && navigation.navigate) {
              navigation.navigate('Dashboard');
            }
          }}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Ups</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={
          /* Premium Filter Section Card */
          <Surface style={styles.filterCard}>
            <View style={styles.filterHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color={COLORS.secondary} />
                <Text style={styles.filterTitleLabel}>Follow-up Schedule</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredPatients.length} Patients</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsContainer}
            >
              {[
                { key: 'custom', label: 'Select Date', icon: 'custom' },
                { key: 'select_month', label: 'Select Month', icon: 'select_month' },
                { key: 'all', label: 'All Schedule', icon: 'all' },
                { key: 'today', label: 'Today', icon: 'today' },
                { key: 'tomorrow', label: 'Tomorrow', icon: 'tomorrow' },
                { key: 'last_month', label: 'Last Month', icon: 'last_month' },
                { key: 'last_2_months', label: 'Last 2 M', icon: 'last_2_months' },
                { key: 'last_4_months', label: 'Last 4 M', icon: 'last_4_months' },
                { key: 'upcoming_month', label: 'Upcoming M', icon: 'upcoming_month' },
              ].map((chip) => {
                const isActive = followUpFilterMode === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    onPress={() => {
                      if (chip.key === 'select_month' && selectedMonth === '') {
                        const today = new Date();
                        const year = today.getFullYear();
                        const monthNum = String(today.getMonth() + 1).padStart(2, '0');
                        setSelectedMonth(`${year}-${monthNum}`);
                      }
                      setFollowUpFilterMode(chip.key);
                      if (chip.key === 'custom') {
                        setShowFollowUpDatePicker(true);
                      } else if (chip.key === 'select_month') {
                        setShowMonthPicker(true);
                      }
                    }}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                  >
                    {getFilterIcon(chip.icon, isActive)}
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active Custom Filter Feedback Panel */}
            {followUpFilterMode === 'custom' && (
              <TouchableOpacity
                onPress={() => setShowFollowUpDatePicker(true)}
                style={styles.activeFilterPanel}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.activeFilterIconCircle}>
                    <CalendarClock size={16} color={COLORS.secondary} />
                  </View>
                  <View>
                    <Text style={styles.activeFilterLabel}>Selected Target Date</Text>
                    <Text style={styles.activeFilterValue}>
                      {followUpDateFilter.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activeFilterChangeBtn}>Change Date</Text>
              </TouchableOpacity>
            )}

            {followUpFilterMode === 'select_month' && (
              <TouchableOpacity
                onPress={() => setShowMonthPicker(true)}
                style={styles.activeFilterPanel}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.activeFilterIconCircle}>
                    <Calendar size={16} color={COLORS.secondary} />
                  </View>
                  <View>
                    <Text style={styles.activeFilterLabel}>Selected Target Month</Text>
                    <Text style={styles.activeFilterValue}>
                      {selectedMonth ? getMonthOptions().find(o => o.value === selectedMonth)?.label : 'Select Month'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activeFilterChangeBtn}>Change Month</Text>
              </TouchableOpacity>
            )}
          </Surface>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : (
            <Surface style={styles.emptyCard}>
              <User size={48} color={COLORS.muted} />
              <Text style={styles.emptyText}>No follow-ups for this filter.</Text>
            </Surface>
          )
        }
        renderItem={({ item: patient }) => (
          <Surface
            key={patient.id}
            style={[
              styles.patientCard,
              { borderLeftWidth: 4, borderLeftColor: getUrgencyIndicatorColor(patient.followUpDate) }
            ]}
          >
            <View style={styles.cardHeader}>
              <Avatar.Text
                size={36}
                label={(patient.patientName || patient.fullName) ? (patient.patientName || patient.fullName).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                style={{ backgroundColor: 'rgba(37, 142, 200, 0.08)' }}
                labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: 11 }}
              />
              <View style={styles.patientInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={styles.patientName}>{patient.patientName || patient.fullName}</Text>
                  {getUrgencyBadge(patient.followUpDate)}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Building2 size={12} color={COLORS.secondary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.secondary }}>
                      {getStandardBranchName(patient.branchName || patient.branchId || patient.branch || userData?.branchName || 'Branch')} Branch
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <User size={12} color={COLORS.muted} />
                    <Text style={styles.doctorText}>
                      {cleanDoctorName(patient.doctor)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} color={COLORS.muted} />
                    <Text style={styles.followUpDateText}>Follow-up: {patient.followUpDate}</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 }}>
                  <Text style={{ color: COLORS.muted, fontSize: 9, fontWeight: '700' }}>Interval: {patient.followUpInterval || 'Not Specified'}</Text>
                </View>
              </View>
            </View>
            {!!patient.phone && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => handleCall(patient.phone)}
                  style={styles.actionButton}
                >
                  <Phone size={13} color="#10b981" />
                  <Text style={styles.actionButtonText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleWhatsApp(patient.phone, patient.patientName || patient.fullName)}
                  style={[styles.actionButton, styles.whatsappButton]}
                >
                  <WhatsAppIcon size={13} color="#25d366" />
                  <Text style={[styles.actionButtonText, styles.whatsappButtonText]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReschedulePatient(patient);
                    let initDate = new Date();
                    if (patient.followUpDate) {
                      const norm = normalizeDateToYYYYMMDD(patient.followUpDate);
                      if (norm) {
                        const pDate = new Date(norm);
                        if (!isNaN(pDate.getTime())) initDate = pDate;
                      }
                    }
                    setRescheduleDate(initDate);
                    setRescheduleDoctor(patient.doctor || 'Dr. Ramakrishna Chanduri');
                    setRescheduleBranch(patient.branchName || patient.branchId || userData?.branchName || 'KPHB');
                    setRescheduleTimeSlot('10:00 AM');
                    setRescheduleModalVisible(true);
                  }}
                  style={[styles.actionButton, { backgroundColor: '#eff6ff' }]}
                >
                  <RefreshCw size={13} color={COLORS.secondary} />
                  <Text style={[styles.actionButtonText, { color: COLORS.secondary }]}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('RegisterPatient', { prefillPatient: patient });
                  }}
                  style={[styles.actionButton, { backgroundColor: 'rgba(168, 206, 58, 0.08)' }]}
                >
                  <CalendarPlus size={13} color={COLORS.primary} />
                  <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Book</Text>
                </TouchableOpacity>
              </View>
            )}
          </Surface>
        )}
      />

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Month</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
              {getMonthOptions().map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.modalOption,
                    selectedMonth === opt.value && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedMonth(opt.value);
                    setFollowUpFilterMode('select_month');
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedMonth === opt.value && styles.modalOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showFollowUpDatePicker && (
        <DateTimePicker
          value={followUpDateFilter}
          mode="date"
          display="default"
          onValueChange={(event, selectedDate) => {
            setShowFollowUpDatePicker(false);
            if (selectedDate) {
              setFollowUpDateFilter(selectedDate);
            }
          }}
          onDismiss={() => setShowFollowUpDatePicker(false)}
        />
      )}

      {/* Full Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>📅 Reschedule Follow-up</Text>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <X size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {reschedulePatient && (
              <View style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 14 }}>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>Patient</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text }}>
                  {reschedulePatient.patientName || reschedulePatient.fullName}
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {/* 1. Date Selection */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Select New Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
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
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? COLORS.secondary : COLORS.border,
                          backgroundColor: isSelected ? '#e0f2fe' : '#ffffff'
                        }}
                        onPress={() => setRescheduleDate(targetDate)}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? COLORS.secondary : COLORS.text }}>
                          {item.label} ({targetDate.getDate()}/{targetDate.getMonth() + 1})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 8,
                  marginBottom: 14,
                  backgroundColor: '#ffffff'
                }}
                onPress={() => setShowCustomDatePicker(true)}
              >
                <Calendar size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                  Custom Date: {rescheduleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showCustomDatePicker && (
                <DateTimePicker
                  value={rescheduleDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onValueChange={(event, selectedDate) => {
                    setShowCustomDatePicker(false);
                    if (selectedDate) setRescheduleDate(selectedDate);
                  }}
                  onDismiss={() => setShowCustomDatePicker(false)}
                />
              )}

              {/* Doctor Availability & Slots Remaining Info */}
              {(() => {
                const computedSlots = generateSlotsForSelectedInFollowUp(rescheduleDoctor, rescheduleBranch, rescheduleDate);
                const isDocAvailableHere = computedSlots.length > 0;
                const displaySlots = isDocAvailableHere ? computedSlots : [
                  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
                  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
                ];

                return (
                  <>
                    <View style={{
                      backgroundColor: isDocAvailableHere ? '#ecfdf5' : '#fef2f2',
                      borderColor: isDocAvailableHere ? '#a7f3d0' : '#fecaca',
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 12
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDocAvailableHere ? '#047857' : '#b91c1c' }}>
                        {isDocAvailableHere
                          ? `✓ ${rescheduleDoctor} is available at ${rescheduleBranch} (${computedSlots.length} slots remaining)`
                          : `⚠️ ${rescheduleDoctor} is not scheduled at ${rescheduleBranch} on this date`
                        }
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>Select Time Slot</Text>
                      <Text style={{ fontSize: 10, color: COLORS.muted, fontWeight: '700' }}>
                        {displaySlots.length} Slots Available
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {displaySlots.map(slot => {
                        const isSelected = rescheduleTimeSlot === slot;
                        return (
                          <TouchableOpacity
                            key={slot}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: isSelected ? COLORS.secondary : COLORS.border,
                              backgroundColor: isSelected ? '#e0f2fe' : '#ffffff'
                            }}
                            onPress={() => setRescheduleTimeSlot(slot)}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? COLORS.secondary : COLORS.text }}>
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                );
              })()}

              {/* 3. Doctor Selection */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Select Doctor</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Dr. Prashanth K Vaidya', 'Dr. Ramakrishna Chanduri', 'Dr. Jobedah Parveej', 'Dr. Padma Priya'].map(docName => {
                  const isSelected = rescheduleDoctor === docName;
                  return (
                    <TouchableOpacity
                      key={docName}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.secondary : COLORS.border,
                        backgroundColor: isSelected ? '#e0f2fe' : '#ffffff'
                      }}
                      onPress={() => setRescheduleDoctor(docName)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? COLORS.secondary : COLORS.text }}>
                        {docName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 4. Branch Selection */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Select Branch</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {['KPHB', 'Chandanagar', 'Dilsukhnagar', 'Nallagandla'].map(br => {
                  const isSelected = rescheduleBranch === br;
                  return (
                    <TouchableOpacity
                      key={br}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.secondary : COLORS.border,
                        backgroundColor: isSelected ? '#e0f2fe' : '#ffffff'
                      }}
                      onPress={() => setRescheduleBranch(br)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? COLORS.secondary : COLORS.text }}>
                        {br}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}
                onPress={() => setRescheduleModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.5, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.secondary, alignItems: 'center' }}
                onPress={handleRescheduleSubmit}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Confirm Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    borderBottomColor: COLORS.border,
    minHeight: 56
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  content: { padding: 16 },
  filterSection: { marginBottom: 16 },
  filterTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  filterChips: { flexDirection: 'row', gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6
  },
  filterChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted
  },
  filterChipTextActive: {
    color: 'white'
  },
  datePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  datePickerText: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginLeft: 8 },
  patientCard: { padding: 10, borderRadius: 12, backgroundColor: COLORS.white, elevation: 2, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  patientInfo: { flex: 1, marginLeft: 12 },
  patientName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  doctorText: { fontSize: 11, color: COLORS.muted },
  followUpDateText: { fontSize: 10.5, color: COLORS.secondary, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, flexGrow: 1, justifyContent: 'center' },
  actionButtonText: { fontSize: 11, color: '#10b981', fontWeight: '700', marginLeft: 4 },
  whatsappButton: { backgroundColor: '#ecfdf5' },
  whatsappButtonText: { color: '#25d366' },
  emptyCard: { padding: 32, borderRadius: 16, backgroundColor: COLORS.white, elevation: 2, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: '600', marginTop: 12 },
  filterChipsContainer: { paddingRight: 16, gap: 8, paddingVertical: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center'
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  modalOptionText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center'
  },
  modalOptionTextActive: {
    color: COLORS.white,
    fontWeight: '700'
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center'
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  filterModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  inputLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 },
  pickerWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerItemActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  pickerItemText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  pickerItemTextActive: { color: COLORS.white },
  modalActionButtons: { flexDirection: 'row', gap: 12, marginTop: 32, marginBottom: 16 },
  confirmBtn: { flex: 1, borderRadius: 12 },
  cancelBtn: { flex: 1, borderRadius: 12, borderColor: COLORS.border },
  filterCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: 16
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  filterTitleLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text
  },
  countBadge: {
    backgroundColor: 'rgba(37, 142, 200, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary
  },
  activeFilterPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 12
  },
  activeFilterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 142, 200, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted
  },
  activeFilterValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2
  },
  activeFilterChangeBtn: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    textTransform: 'uppercase'
  },
});

export default FollowUps;
