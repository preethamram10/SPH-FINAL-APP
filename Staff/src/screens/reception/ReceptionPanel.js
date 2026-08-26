import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Keyboard, RefreshControl, TextInput, FlatList, Modal, Linking } from 'react-native';
import { Text, Surface, Button, FAB, Searchbar, Chip, Avatar, ActivityIndicator, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../../firebase';
import AppointmentCard from '../../components/AppointmentCard';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { User, Phone, Clipboard, Calendar, Search, RefreshCw, ChevronRight, MapPin, UserCheck, Clock, CheckCircle, Home, CalendarPlus, Fingerprint, Users, LogOut, X, ArrowUp, ArrowDown, MessageCircle, CalendarClock } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon = ({ size = 17, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.12.378.102.518-.058.14-.16.6-1.012.76-1.356.16-.344.318-.288.536-.208.218.08 1.382.652 1.62.77.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);
const COLORS = {
  primary: '#a8ce3a',      // SPH Lime Green
  secondary: '#258ec8',    // SPH Soft Blue
  success: '#10b981',      // SPH Success Green
  warning: '#f59e0b',      // Pending/Waiting Amber
  text: '#0f172a',         // Deep slate dark text
  muted: '#64748b',        // Muted grey text
  background: '#f8fafc',   // Off-white slate background
  white: '#ffffff',
  border: '#e2e8f0',       // Border line grey
};


const getAppointmentTimestamp = (dateStr, timeStr) => {
  if (!dateStr) return 0;

  let day = 1, month = 0, year = 1970;
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
  } else {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.getTime();
      }
    } catch (e) { }
  }
  let hours = 0;
  let minutes = 0;
  if (typeof timeStr === 'string') {
    const cleanTime = timeStr.trim().toUpperCase();
    const isPM = cleanTime.includes('PM');
    const timeParts = cleanTime.replace(/[APM]/g, '').trim().split(':');
    if (timeParts.length >= 2) {
      let h = parseInt(timeParts[0], 10);
      const m = parseInt(timeParts[1], 10);
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      hours = h;
      minutes = m;
    }
  }

  return new Date(year, month, day, hours, minutes).getTime();
};

const formatAppointmentDate = (dateVal) => {
  if (!dateVal) return 'No Date';
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
  }
  if (dateVal.seconds) {
    return new Date(dateVal.seconds * 1000).toLocaleDateString('en-GB');
  }
  if (typeof dateVal === 'string') {
    return dateVal;
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB');
    }
  } catch (e) { }
  return String(dateVal);
};

const isTodayOrFuture = (dateStr) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let day = 1, month = 0, year = 1970;
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
  } else {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= today.getTime();
      }
    } catch (e) { }
  }

  const apptDate = new Date(year, month, day);
  apptDate.setHours(0, 0, 0, 0);
  return apptDate.getTime() >= today.getTime();
};

const getCanonicalDoctorName = (name) => {
  if (!name) return '';
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('prashan') || normalized.includes('vaidya') || normalized.includes('vidya')) {
    return 'Dr. Prashanth K Vaidya';
  }
  if (normalized.includes('ramakrishna') || normalized.includes('rama krishna')) {
    return 'Dr. Ramakrishna Chanduri';
  }
  if (normalized.includes('jobed') || normalized.includes('jobead') || normalized.includes('jubeid') || normalized.includes('parveej') || normalized.includes('parveez')) {
    return 'Dr. Jobedah Parveej';
  }
  if (normalized.includes('vamshi') || normalized.includes('vamsi')) {
    return 'Dr. Vamshitha';
  }
  if (normalized.includes('salmon')) {
    return 'Dr. Salmon Doc';
  }
  return name.replace(/^dr\.?\s*/i, 'Dr. ').replace(/\s+/g, ' ').trim();
};

import { getStandardBranchName } from '../../utils/idGenerator';
import { checkIsInDuration } from './Rejoin/index';

const getCanonicalBranchName = (name) => {
  return getStandardBranchName(name);
};

const getBranchNamesList = (branchId, branchName) => {
  const branchVariations = new Set();
  const checkAndAdd = (val) => {
    if (!val) return;
    const lower = val.toLowerCase().trim();
    branchVariations.add(val);
    branchVariations.add(lower);
    branchVariations.add(val.toUpperCase());
    if (lower.includes('kphb') || lower.includes('kphp')) {
      branchVariations.add('KPHB');
      branchVariations.add('KPHB Branch');
      branchVariations.add('Kphb');
      branchVariations.add('kphb');
    } else if (lower.includes('chnr') || lower.includes('chandanagar') || lower.includes('chandnagar')) {
      branchVariations.add('Chandnagar');
      branchVariations.add('Chandnagar Branch');
      branchVariations.add('Chandanagar');
      branchVariations.add('CHANDNAGAR');
    } else if (lower.includes('dsnr') || lower.includes('dilsukhnagar') || lower.includes('dilshuknagar')) {
      branchVariations.add('Dilshuknagar');
      branchVariations.add('Dilshuknagar Branch');
      branchVariations.add('Dilsukhnagar');
    } else if (lower.includes('nallagandla') || lower.includes('ngl') || lower.includes('nlg')) {
      branchVariations.add('Nallagandla');
      branchVariations.add('Nallagandla Branch');
    }
  };
  checkAndAdd(branchId);
  checkAndAdd(branchName);
  return Array.from(branchVariations);
};

const normalizeDateToYYYYMMDD = (dateStr) => {
  if (!dateStr) return '';

  if (dateStr.seconds) {
    const d = new Date(dateStr.seconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (typeof dateStr !== 'string') {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch (e) { }
    return '';
  }

  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return dateStr;
      } else {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) { }
  return dateStr;
};

const isTodayOrYesterday = (dateStr) => {
  if (!dateStr) return false;
  const localToday = new Date();
  const yyyy = localToday.getFullYear();
  const mm = String(localToday.getMonth() + 1).padStart(2, '0');
  const dd = String(localToday.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const yesterdayObj = new Date(localToday.getTime() - 24 * 60 * 60 * 1000);
  const yyyyYest = yesterdayObj.getFullYear();
  const mmYest = String(yesterdayObj.getMonth() + 1).padStart(2, '0');
  const ddYest = String(yesterdayObj.getDate()).padStart(2, '0');
  const yesterdayStr = `${yyyyYest}-${mmYest}-${ddYest}`;

  const pDateStr = normalizeDateToYYYYMMDD(dateStr);
  return pDateStr === todayStr || pDateStr === yesterdayStr;
};

const isMatchingSelectedDate = (dateStr, selDate) => {
  if (!dateStr || !selDate) return false;
  const pDateStr = normalizeDateToYYYYMMDD(dateStr);
  const d = new Date(selDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const targetStr = `${y}-${m}-${day}`;
  return pDateStr === targetStr;
};

const normalizeBranch = (branch) => {
  if (!branch) return '';
  const str = String(branch).toLowerCase().trim();
  if (str.includes('kphb') || str.includes('kphp')) return 'kphb';
  if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
  if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
  if (str.includes('nallagandla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
  return str.replace(/\s*branch\s*/i, '').trim();
};

const matchBranchHelper = (userData, item) => {
  if (!userData) return false;
  if (userData.role === 'admin' || userData.role === 'superadmin') return true;

  const uBranchId = userData.branchId || '';
  const uBranchName = userData.branchName || '';

  if (uBranchId || uBranchName) {
    if (!item) return false;
    const iBranchId = item.branchId || item.raw?.branchId || '';
    const iBranchName = item.branchName || item.raw?.branchName || '';

    const normVal = normalizeBranch(iBranchId);
    const normName = normalizeBranch(iBranchName);
    const normUserId = normalizeBranch(uBranchId);
    const normUserName = normalizeBranch(uBranchName);

    if (normUserId && (normVal === normUserId || normName === normUserId)) return true;
    if (normUserName && (normVal === normUserName || normName === normUserName)) return true;

    if (iBranchId && (iBranchId === uBranchId || iBranchId === uBranchName)) return true;
    if (iBranchName && (iBranchName === uBranchName || iBranchName === uBranchId)) return true;

    return false;
  }
  return false;
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

const getDisplayBranchHelper = (userData, item) => {
  if (!item) return 'Unassigned';
  const rawBranch = item.branchName || item.branchId || item.branch || item.raw?.branchName || item.raw?.branchId || item.raw?.branch;
  const canonical = getCanonicalBranchName(rawBranch);
  if (canonical) return canonical;
  if (rawBranch) return String(rawBranch).trim();
  return 'Unassigned';
};

const CANONICAL_DOCTORS = [
  'Dr. Prashanth K. Vaidya',
  'Dr. Ramakrishna Chanduri',
  'Dr. Jobeadh Parveej',
  'Dr. Padma Priya'
];

const CANONICAL_BRANCHES = [
  'Kphb',
  'Chandanagar',
  'Dilshuknagar',
  'Nallagandla'
];

const ReceptionPanel = ({ navigation, setActiveTab, activeTab, mode = 'all' }) => {
  const { userData } = useAuth();
  const [internalMode, setInternalMode] = useState(mode);
  const [subTab, setSubTab] = useState('completed'); // 'completed' | 'history'
  const [historicalPatients, setHistoricalPatients] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [completedSearchQuery, setCompletedSearchQuery] = useState('');

  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (historySearchQuery.trim()) {
      setLoadingHistory(true);
    }
    const handler = setTimeout(() => {
      setDebouncedHistorySearch(historySearchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [historySearchQuery]);

  useEffect(() => {
    if (!userData || subTab !== 'history') return;

    const isRestricted = userData.role !== 'admin' && userData.role !== 'superadmin' && (userData.branchId || userData.branchName);

    if (!debouncedHistorySearch.trim()) {
      // 1. Empty search text: load recent patients globally (across all branches) from allpatients
      setLoadingHistory(true);

      const q = query(
        collection(db, 'allpatients'),
        limit(200)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.isDeleted) return;
          const isOnline = data.source === 'appointments' || data.source === 'UserApp' || data.source === 'Patient App' || data.source === 'Online';
          const displayBranch = getDisplayBranchHelper(userData, data);
          list.push({
            id: docSnap.id,
            _type: isOnline ? 'online' : 'walkin',
            fullName: data.fullName || data.patientName || (isOnline ? 'Online Patient' : 'Patient'),
            regId: data.registrationId || data.regId || (isOnline ? 'ONLINE' : ''),
            phone: data.phone || data.patientPhone || 'N/A',
            appointmentDate: data.appointmentDate || data.dateString || 'No Date',
            appointmentTime: data.appointmentTime || data.timeSlot || 'N/A',
            doctor: data.doctor || data.doctorName || 'General Doctor',
            status: (data.status === 'pending' ? 'waiting' : data.status) || 'waiting',
            createdAt: data.createdAt || data.bookedAt || null,
            ...data,
            branchName: displayBranch,
            branchId: displayBranch
          });
        });

        // Client-side sort by createdAt descending
        list.sort((a, b) => {
          const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });

        setHistoricalPatients(list);
        setLoadingHistory(false);
      }, (error) => {
        console.error("Error fetching historical branch patients:", error);
        setLoadingHistory(false);
      });

      return () => unsubscribe();
    } else {
      // 2. Active search: global deep search across allpatients collection
      const fetchGlobalPatients = async () => {
        setLoadingHistory(true);
        try {
          const queryText = debouncedHistorySearch.trim();
          const textLower = queryText.toLowerCase();
          const textCapitalized = queryText.charAt(0).toUpperCase() + queryText.slice(1).toLowerCase();
          const textUpper = queryText.toUpperCase();

          const promises = [];

          if (/^\d+$/.test(queryText)) {
            const cleanPhone = queryText.slice(-10);
            const q1 = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
            promises.push(getDocs(q1));
          } else {
            const q1 = query(collection(db, 'allpatients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\uf8ff'), limit(20));
            promises.push(getDocs(q1));

            const q2 = query(collection(db, 'allpatients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\uf8ff'), limit(20));
            promises.push(getDocs(q2));

            const q3 = query(collection(db, 'allpatients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\uf8ff'), limit(20));
            promises.push(getDocs(q3));

            const qReg = query(
              collection(db, 'allpatients'),
              where('registrationId', '>=', textUpper),
              where('registrationId', '<=', textUpper + '\uf8ff'),
              limit(20)
            );
            promises.push(getDocs(qReg));
          }

          const snaps = await Promise.all(promises);
          const results = [];
          const seenIds = new Set();

          snaps.forEach(snap => {
            snap.forEach(docSnap => {
              if (!seenIds.has(docSnap.id)) {
                seenIds.add(docSnap.id);
                const data = docSnap.data();
                const isOnline = data.source === 'appointments' || data.source === 'UserApp' || data.source === 'Patient App' || data.source === 'Online';
                const displayBranch = getDisplayBranchHelper(userData, data);
                results.push({
                  id: docSnap.id,
                  _type: isOnline ? 'online' : 'walkin',
                  fullName: data.fullName || data.patientName || (isOnline ? 'Online Patient' : 'Patient'),
                  regId: data.registrationId || data.regId || (isOnline ? 'ONLINE' : ''),
                  phone: data.phone || data.patientPhone || 'N/A',
                  appointmentDate: data.appointmentDate || data.dateString || 'No Date',
                  appointmentTime: data.appointmentTime || data.timeSlot || 'N/A',
                  doctor: data.doctor || data.doctorName || 'General Doctor',
                  status: (data.status === 'pending' ? 'waiting' : data.status) || 'waiting',
                  createdAt: data.createdAt || data.bookedAt || null,
                  ...data,
                  branchName: displayBranch,
                  branchId: displayBranch
                });
              }
            });
          });

          // Client-side sort by createdAt descending
          results.sort((a, b) => {
            const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });

          setHistoricalPatients(results);
        } catch (e) {
          console.error("Error globally searching patients in mobile app:", e);
        } finally {
          setLoadingHistory(false);
        }
      };

      fetchGlobalPatients();
    }
  }, [userData, subTab, debouncedHistorySearch]);

  useEffect(() => {
    if (!historySearchQuery.trim()) {
      setFilteredHistory(historicalPatients);
      return;
    }
    const qLower = historySearchQuery.toLowerCase().trim();
    const filtered = historicalPatients.filter(p => {
      return (
        p.fullName?.toLowerCase().includes(qLower) ||
        p.phone?.toLowerCase().includes(qLower) ||
        p.regId?.toLowerCase().includes(qLower) ||
        p.registrationId?.toLowerCase().includes(qLower)
      );
    });
    setFilteredHistory(filtered);
  }, [historySearchQuery, historicalPatients]);
  const [activePackageMobiles, setActivePackageMobiles] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [doctorModalVisible, setDoctorModalVisible] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('completed');

  useEffect(() => {
    if (userData?.role === 'receptionist' && (userData?.branchName || userData?.branchId)) {
      setSelectedBranchFilter(getCanonicalBranchName(userData.branchName || userData.branchId));
    }
  }, [userData]);

  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showRescheduleDatePicker, setShowRescheduleDatePicker] = useState(false);
  const [rescheduleBranch, setRescheduleBranch] = useState('');
  const [rescheduleDoctor, setRescheduleDoctor] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState(new Date());
  const [showRescheduleTimePicker, setShowRescheduleTimePicker] = useState(false);
  const [receptionAvailableSlots, setReceptionAvailableSlots] = useState([]);
  const [fetchingReceptionSlots, setFetchingReceptionSlots] = useState(false);

  const formatRecTimeStr = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    return `${hoursStr}:${minutesStr} ${ampm}`;
  };

  useEffect(() => {
    let unsubExtra = null;
    const fetchSlots = async () => {
      if (!rescheduleDoctor || !rescheduleBranch || !rescheduleDate) {
        setReceptionAvailableSlots([]);
        return;
      }
      setFetchingReceptionSlots(true);
      try {
        const year = rescheduleDate.getFullYear();
        const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
        const day = String(rescheduleDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const DEFAULT_SLOTS = [
          '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM',
          '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
        ];

        const qAppts = query(
          collection(db, 'allpatients'),
          where('dateString', '==', dateString)
        );
        const snapAppts = await getDocs(qAppts).catch(() => ({ docs: [] }));
        const counts = {};
        snapAppts.forEach(d => {
          const t = d.data().timeSlot || d.data().appointmentTime;
          if (t) counts[t] = (counts[t] || 0) + 1;
        });

        const qExtra = query(
          collection(db, 'extra_slots'),
          where('dateString', '==', dateString)
        );

        unsubExtra = onSnapshot(qExtra, (snapExtra) => {
          let extraList = [];
          snapExtra.forEach(ds => {
            const data = ds.data();
            if (Array.isArray(data.slots)) extraList.push(...data.slots);
          });
          const combined = [...new Set([...DEFAULT_SLOTS, ...extraList])];
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

          const slotsMeta = combined.map(timeStr => {
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
          setReceptionAvailableSlots(slotsMeta);
          setFetchingReceptionSlots(false);
        }, () => {
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
          setReceptionAvailableSlots(DEFAULT_SLOTS.map(t => {
            const slotMin = parseToMin(t);
            const isPast = isToday && slotMin <= nowMinutes;
            return { time: t, sessionsLeft: 3, isPast, isFull: false, isBlocked: isPast, isAvailable: !isPast };
          }));
          setFetchingReceptionSlots(false);
        });
      } catch (e) {
        setFetchingReceptionSlots(false);
      }
    };
    fetchSlots();
    return () => { if (unsubExtra) unsubExtra(); };
  }, [rescheduleDoctor, rescheduleBranch, rescheduleDate]);

  const handleAddRecExtraSlot = async (type) => {
    if (!rescheduleDate) return;
    const year = rescheduleDate.getFullYear();
    const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(rescheduleDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    let newSlot = '10:00 AM';
    if (receptionAvailableSlots.length > 0) {
      const item = type === 'before' ? receptionAvailableSlots[0] : receptionAvailableSlots[receptionAvailableSlots.length - 1];
      const timeStr = typeof item === 'string' ? item : item.time;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        let tot = type === 'before' ? (h * 60 + m - 15) : (h * 60 + m + 15);
        if (tot < 0) tot += 1440;
        let nH = Math.floor(tot / 60) % 24;
        let nM = tot % 60;
        let nAmpm = nH >= 12 ? 'PM' : 'AM';
        let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
        newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
      }
    }

    try {
      const qExtra = query(collection(db, 'extra_slots'), where('dateString', '==', dateString));
      const snap = await getDocs(qExtra);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { slots: [...new Set([...(snap.docs[0].data().slots || []), newSlot])] });
      } else {
        await addDoc(collection(db, 'extra_slots'), { dateString, slots: [newSlot] });
      }
    } catch (e) { console.error(e); }
  };

  const [loading, setLoading] = useState(false);
  // Real-time lists for local instant search matching
  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchApplied, setIsSearchApplied] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Dynamic status counters
  const [stats, setStats] = useState({
    total: 0,
    waiting: 0,
    completed: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const completedHistoryList = React.useMemo(() => {
    const list = [];
    if (!allPatients) return list;
    allPatients.forEach(p => {
      const s = (p.status || '').toLowerCase();
      if (s === 'completed' || s === 'done') {
        list.push(p);
      }
    });
    // Sort chronologically (most recent first)
    return list.sort((a, b) => {
      const timeA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime);
      const timeB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime);
      return timeB - timeA;
    });
  }, [allPatients]);

  const filteredCompletedHistory = React.useMemo(() => {
    if (!completedSearchQuery.trim()) return completedHistoryList;
    const qLower = completedSearchQuery.toLowerCase().trim();
    return completedHistoryList.filter(p => {
      return (
        p.fullName?.toLowerCase().includes(qLower) ||
        p.phone?.toLowerCase().includes(qLower) ||
        (p.regId && p.regId.toLowerCase().includes(qLower)) ||
        p.doctor?.toLowerCase().includes(qLower)
      );
    });
  }, [completedHistoryList, completedSearchQuery]);

  const uniqueBranches = React.useMemo(() => {
    const branches = new Set(CANONICAL_BRANCHES);
    allPatients.forEach(p => {
      const b = p.branchName || p.branchId;
      if (b) {
        branches.add(getCanonicalBranchName(b));
      }
    });
    return Array.from(branches).sort();
  }, [allPatients]);

  const uniqueDoctors = React.useMemo(() => {
    const doctors = new Set(CANONICAL_DOCTORS);
    allPatients.forEach(p => {
      if (p.doctor) {
        doctors.add(getCanonicalDoctorName(p.doctor));
      }
    });
    return Array.from(doctors).sort();
  }, [allPatients]);

  useEffect(() => {
    const q = query(collection(db, 'package_members'));
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
      console.error("Error listening to package members in reception panel: ", error);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAllPatients(true);
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  }, [userData]);

  // Monitor virtual keyboard
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
      await signOut(auth);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const openRescheduleModal = (item) => {
    setRescheduleItem(item);
    setRescheduleBranch(getCanonicalBranchName(item.branchName || item.branchId) || CANONICAL_BRANCHES[0]);
    setRescheduleDoctor(getCanonicalDoctorName(item.doctor) || CANONICAL_DOCTORS[0]);

    let defaultDate = new Date();
    if (item.appointmentDate) {
      const parts = item.appointmentDate.split('/');
      if (parts.length === 3) {
        defaultDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else {
        const dParts = item.appointmentDate.split('-');
        if (dParts.length === 3) {
          if (dParts[0].length === 4) {
            defaultDate = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[2], 10));
          } else {
            defaultDate = new Date(parseInt(dParts[2], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[0], 10));
          }
        }
      }
    }
    setRescheduleDate(defaultDate);
    setRescheduleModalVisible(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleItem) return;
    try {
      const day = String(rescheduleDate.getDate()).padStart(2, '0');
      const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
      const year = rescheduleDate.getFullYear();
      const dateSlash = `${day}/${month}/${year}`;
      const dateDash = `${year}-${month}-${day}`;

      // Resolve doctorId from users collection
      let docIdResolved = rescheduleItem.doctorId || '';
      try {
        const qDocs = query(
          collection(db, 'users'),
          where('role', '==', 'doctor')
        );
        const snapDocs = await getDocs(qDocs);
        const cleanTarget = rescheduleDoctor.toLowerCase().replace(/^dr\.\s*/, '').replace(/^dr\s*/, '').replace(/[^a-z0-9]/g, '');
        snapDocs.forEach(dDoc => {
          const u = dDoc.data();
          const cleanName = (u.name || '').toLowerCase().replace(/^dr\.\s*/, '').replace(/^dr\s*/, '').replace(/[^a-z0-9]/g, '');
          if (cleanName === cleanTarget) {
            docIdResolved = dDoc.id;
          }
        });
      } catch (docErr) {
        console.error("Error resolving doctorId on reschedule:", docErr);
      }

      if (docIdResolved) {
        try {
          const qNoShows = query(
            collection(db, 'doctor_no_shows'),
            where('doctorId', '==', docIdResolved)
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

          const slotTimeStr = rescheduleItem.appointmentTime || rescheduleItem.timeSlot || '10:00 AM';
          if (isSlotBlockedByNoShow(slotTimeStr, dateDash, activeNoShows)) {
            Alert.alert(
              'Doctor Unavailable',
              `Cannot reschedule: Dr. ${rescheduleDoctor} is marked as NO SHOW (unavailable) at ${rescheduleBranch} for this time period.`
            );
            return;
          }
        } catch (nsErr) {
          console.error("Error checking doctor no show on mobile panel reschedule:", nsErr);
        }
      }

      const timeSlotStr = formatRecTimeStr(rescheduleTime);
      const updateData = {
        branchId: getStandardBranchName(rescheduleBranch),
        branchName: getStandardBranchName(rescheduleBranch),
        doctor: rescheduleDoctor,
        doctorName: rescheduleDoctor.startsWith('Dr.') ? rescheduleDoctor : `Dr. ${rescheduleDoctor}`,
        timeSlot: timeSlotStr,
        appointmentTime: timeSlotStr,
        isRescheduled: true,
        lastRescheduledAt: serverTimestamp(),
        dateString: dateDash,
        appointmentDate: dateSlash,
        updatedAt: serverTimestamp()
      };

      if (docIdResolved) {
        updateData.doctorId = docIdResolved;
      }

      // 1. Update allpatients document (the dashboard queue record)
      const allPatientsRef = doc(db, 'allpatients', rescheduleItem.id);
      await updateDoc(allPatientsRef, updateData);

      setRescheduleModalVisible(false);
      Alert.alert("Success", "Appointment rescheduled successfully!");
      fetchAllPatients();
    } catch (error) {
      console.error("Reschedule error:", error);
      Alert.alert("Error", "Failed to reschedule appointment.");
    }
  };

  const handleMoveQueue = async (item, direction) => {
    const activePatients = allPatients.filter(p => {
      const s = (p.status || '').toLowerCase();
      return getCanonicalDoctorName(p.doctor) === getCanonicalDoctorName(item.doctor) &&
        getCanonicalBranchName(p.branchName || p.branchId) === getCanonicalBranchName(item.branchName || item.branchId) &&
        (s === 'waiting' || s === 'pending' || s === 'confirmed' || s === 'booked');
    });
    activePatients.sort((a, b) => {
      const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
      const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
      if (qA !== qB) return qA - qB;

      const timeA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime);
      const timeB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      const createA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
      const createB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
      return createA - createB;
    });

    const currentIndex = activePatients.findIndex(p => p.id === item.id);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'up') {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down') {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex < 0 || targetIndex >= activePatients.length) return;

    try {
      // Re-assign queueOrder integers sequentially for all active patients in this doctor/branch queue, swapping target ones.
      const batchUpdates = activePatients.map((p, idx) => {
        let targetOrder = idx;
        if (idx === currentIndex) {
          targetOrder = targetIndex;
        } else if (idx === targetIndex) {
          targetOrder = currentIndex;
        }
        const collName = p.firestoreCollection || (p._type === 'online' ? 'appointments' : 'patients');
        const ref = doc(db, collName, p.id);
        return updateDoc(ref, { queueOrder: targetOrder });
      });

      await Promise.all(batchUpdates);
      fetchAllPatients();
    } catch (e) {
      console.error("Error moving queue item: ", e);
    }
  };

  const getQueueNumberMobile = (item) => {
    const sItem = (item.status || '').toLowerCase();
    const isWaiting = sItem === 'waiting' || sItem === 'pending' || sItem === 'confirmed' || sItem === 'booked';
    if (!isWaiting) return '';

    const activePatients = allPatients.filter(p => {
      const sP = (p.status || '').toLowerCase();
      return getCanonicalDoctorName(p.doctor) === getCanonicalDoctorName(item.doctor) &&
        getCanonicalBranchName(p.branchName || p.branchId) === getCanonicalBranchName(item.branchName || item.branchId) &&
        (sP === 'waiting' || sP === 'pending' || sP === 'confirmed' || sP === 'booked');
    });

    activePatients.sort((a, b) => {
      const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
      const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
      if (qA !== qB) return qA - qB;

      const timeA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime);
      const timeB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      const createA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
      const createB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
      return createA - createB;
    });

    const index = activePatients.findIndex(p => p.id === item.id);
    return index !== -1 ? `Q${index + 1}` : '';
  };

  const handleWhatsAppContact = (phone, name) => {
    if (!phone || phone === 'N/A') {
      Alert.alert("Error", "No phone number available.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const message = `Hello ${name}, this is from SPH Clinic regarding your appointment.`;
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Make sure WhatsApp is installed on your device.");
    });
  };

  // Fetch patient bookings (Consolidated walk-in & online appointments across all branches)
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fetchAllPatients = (forceLoading = false) => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!userData) {
      return;
    }

    setLoading(true);

    const getQueryDates = () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const generateDateVariants = (dObj) => {
        const dd = String(dObj.getDate()).padStart(2, '0');
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dObj.getFullYear();
        const dShort = String(dObj.getDate());
        const mShort = String(dObj.getMonth() + 1);
        return [
          `${dd}/${mm}/${yyyy}`,
          `${yyyy}-${mm}-${dd}`,
          `${dd}-${mm}-${yyyy}`,
          `${dShort}/${mShort}/${yyyy}`,
          `${yyyy}-${mShort}-${dShort}`,
          `${dShort}-${mShort}-${yyyy}`
        ];
      };

      if (selectedDate) {
        return {
          slash: generateDateVariants(selectedDate),
          dash: []
        };
      } else {
        return {
          slash: [...generateDateVariants(today), ...generateDateVariants(yesterday)],
          dash: []
        };
      }
    };

    let allFetched = [];

    const processAndMerge = () => {
      let combined = [...allFetched];

      // Filter by doctor's canonical name if role is doctor; otherwise filter by receptionist branch
      if (userData?.role === 'doctor') {
        const docNorm = getCanonicalDoctorName(userData.name || '').toLowerCase().replace(/^dr\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
        combined = combined.filter(p => {
          const patDocName = getCanonicalDoctorName(p.doctor || p.doctorName || '');
          const cleanPatDocName = patDocName.toLowerCase().replace(/^dr\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
          return cleanPatDocName && docNorm && (cleanPatDocName.includes(docNorm) || docNorm.includes(cleanPatDocName));
        });
      } else {
        combined = combined.filter(p => matchBranchHelper(userData, p));
      }

      // Resolve branch display names and fall back to dateString/date if appointmentDate is empty
      combined = combined.map(p => {
        const displayBranch = getDisplayBranchHelper(userData, p);
        const resolvedDate = p.appointmentDate || p.dateString || p.date || 'No Date';
        return {
          ...p,
          appointmentDate: resolvedDate,
          branchName: displayBranch,
          branchId: displayBranch
        };
      });

      // Sort in-memory date-wise: earliest scheduled date & time first
      const sortedData = combined.sort((a, b) => {
        const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
        const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
        if (qA !== qB) return qA - qB;

        const timeA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime);
        const timeB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime);
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        const createA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
        const createB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
        return createA - createB;
      });

      const targetPatients = sortedData.filter(patient => {
        if (internalMode === 'rescheduled') {
          return patient.isRescheduled === true;
        } else {
          // Date selection filtering (double-check in memory)
          if (selectedDate) {
            return isMatchingSelectedDate(patient.appointmentDate, selectedDate);
          } else {
            return isTodayOrYesterday(patient.appointmentDate);
          }
        }
      });

      if (internalMode === 'rescheduled') {
        targetPatients.sort((a, b) => {
          const timeA = getAppointmentTimestamp(a.appointmentDate, a.appointmentTime);
          const timeB = getAppointmentTimestamp(b.appointmentDate, b.appointmentTime);
          return timeA - timeB;
        });
      }

      setAllPatients(targetPatients);
      setLoading(false);
    };

    // Construct Server-Side Query Filters
    const { slash: slashDates, dash: dashDates } = getQueryDates();
    let qAllPatients;

    if (userData?.role === 'doctor') {
      const combinedDates = Array.from(new Set([...slashDates, ...dashDates])).slice(0, 10);
      qAllPatients = query(
        collection(db, 'allpatients'),
        where('appointmentDate', 'in', combinedDates),
        limit(200)
      );
    } else if (internalMode === 'rescheduled') {
      qAllPatients = query(
        collection(db, 'allpatients'),
        where('isRescheduled', '==', true),
        limit(200)
      );
    } else {
      const combinedDates = Array.from(new Set([...slashDates, ...dashDates])).slice(0, 10);
      qAllPatients = query(
        collection(db, 'allpatients'),
        where('appointmentDate', 'in', combinedDates),
        limit(200)
      );
    }

    // 1. Listen to unified allpatients collection
    const unsubAllPatients = onSnapshot(qAllPatients, (snapshot) => {
      allFetched = snapshot.docs.map(doc => {
        const data = doc.data();
        const isOnline = data.source === 'appointments' || data.source === 'UserApp' || data.source === 'Patient App' || data.source === 'Online';
        return {
          id: doc.id,
          ...data,
          _type: isOnline ? 'online' : 'walkin',
          fullName: data.fullName || data.patientName || (isOnline ? 'Online Patient' : 'Patient'),
          regId: data.registrationId || data.regId || (isOnline ? 'ONLINE' : ''),
          phone: data.phone || data.patientPhone || 'N/A',
          appointmentDate: data.appointmentDate || data.dateString || 'No Date',
          appointmentTime: data.appointmentTime || data.timeSlot || 'N/A',
          doctor: data.doctor || data.doctorName || 'General Doctor',
          status: (data.status === 'pending' ? 'waiting' : data.status) || 'waiting',
          createdAt: data.createdAt || data.bookedAt || null
        };
      }).filter(item => !item.isDeleted);
      processAndMerge();
    }, (error) => {
      console.error("Error listening to allpatients: ", error);
      setLoading(false);
    });

    return () => {
      unsubAllPatients();
    };
  }, [userData, internalMode, refreshTrigger, selectedDate]);

  // Reactive effect to filter allPatients locally based on branch, doctor, status, and search text
  useEffect(() => {
    if (isSearchApplied) {
      return;
    }

    let result = [...allPatients];

    // Apply branch filter
    if (selectedBranchFilter !== 'all') {
      result = result.filter(patient => {
        const pBranch = getCanonicalBranchName(patient.branchName || patient.branchId);
        return pBranch === selectedBranchFilter;
      });
    }

    // Apply doctor filter
    if (selectedDoctorFilter !== 'all') {
      result = result.filter(patient => {
        const pDoctor = getCanonicalDoctorName(patient.doctor);
        return pDoctor === selectedDoctorFilter;
      });
    }

    // Apply local search query matching name, phone, doctor, or branch
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      result = result.filter(patient => {
        const nameMatch = patient.fullName?.toLowerCase().includes(qLower);
        const phoneMatch = patient.phone?.toLowerCase().includes(qLower);
        const regIdMatch = patient.regId?.toLowerCase().includes(qLower);
        const doctorMatch = patient.doctor?.toLowerCase().includes(qLower);
        const branchMatch = (patient.branchName || patient.branchId)?.toLowerCase().includes(qLower);
        return nameMatch || phoneMatch || regIdMatch || doctorMatch || branchMatch;
      });
    }

    // Helper helper to check if patient is paid
    const isPatientPaid = (p) => {
      if (!p) return false;
      const ps = (p.paymentStatus || p.raw?.paymentStatus || '').toLowerCase();
      const pAmt = Number(p.paymentAmount || p.amountPaid || p.amount || p.raw?.paymentAmount || p.raw?.amountPaid || p.raw?.amount || 0);
      const hasCollectedAt = !!(p.paymentCollectedAt || p.raw?.paymentCollectedAt);
      const hasSplitDetails = !!(p.paymentSplitDetails || p.raw?.paymentSplitDetails || p.splitCounterAmount || p.raw?.splitCounterAmount);
      const hasItemsPaid = !!(p.itemsPaid || p.raw?.itemsPaid);
      return ps === 'paid' || pAmt > 0 || hasCollectedAt || hasSplitDetails || (hasItemsPaid && (p.itemsPaid?.consultation > 0 || p.itemsPaid?.medicine > 0 || p.itemsPaid?.dietPlan > 0));
    };

    // Calculate stats before applying status filter
    const upcomingCount = result.filter(p => {
      const s = (p.status || '').toLowerCase();
      const docS = (p.doctorStatus || '').toLowerCase();
      const isConsultDone = s === 'done' || s === 'completed' || s === 'consulted' || s === 'completed_today' || docS === 'prescribed';
      return ['booked', 'waiting', 'in-consultation', 'pending', 'confirmed'].includes(s) && !isConsultDone;
    }).length;

    const awaitingPaymentCount = result.filter(p => {
      const s = (p.status || '').toLowerCase();
      const docS = (p.doctorStatus || '').toLowerCase();
      const isConsultDone = s === 'done' || s === 'completed' || s === 'consulted' || s === 'completed_today' || docS === 'prescribed';
      return isConsultDone && !isPatientPaid(p);
    }).length;

    const completedCount = result.filter(p => {
      const s = (p.status || '').toLowerCase();
      const docS = (p.doctorStatus || '').toLowerCase();
      const isConsultDone = s === 'done' || s === 'completed' || s === 'consulted' || s === 'completed_today' || docS === 'prescribed';
      return isConsultDone && isPatientPaid(p);
    }).length;

    setStats({
      upcoming: upcomingCount,
      awaitingPayment: awaitingPaymentCount,
      completed: completedCount
    });

    // Apply status filter
    result = result.filter(patient => {
      const s = (patient.status || '').toLowerCase();
      const docS = (patient.doctorStatus || '').toLowerCase();
      const paid = isPatientPaid(patient);
      const isConsultDone = s === 'done' || s === 'completed' || s === 'consulted' || s === 'completed_today' || docS === 'prescribed';

      if (selectedStatusFilter === 'upcoming') return ['booked', 'waiting', 'in-consultation', 'pending', 'confirmed'].includes(s) && !isConsultDone;
      if (selectedStatusFilter === 'awaiting-payment') return isConsultDone && !paid;
      if (selectedStatusFilter === 'completed') return isConsultDone && paid;
      return true;
    });

    setFilteredPatients(result);

  }, [allPatients, selectedBranchFilter, selectedDoctorFilter, debouncedSearchQuery, isSearchApplied, selectedStatusFilter]);

  // Real-time search filter tracking text updates
  const handleLiveSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setIsSearchApplied(false);
    }
  };

  // Global historical deep search on Firebase matching phone numbers or names
  const handleSearchClick = async () => {
    if (!searchQuery.trim()) {
      setIsSearchApplied(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'allpatients'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      // Sort search results from recent to old
      const sortedData = data.sort((a, b) => {
        const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
        const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
        return timeB - timeA;
      });

      const queryLower = searchQuery.toLowerCase().trim();
      const filtered = sortedData.filter(patient => {
        const nameMatch = patient.fullName?.toLowerCase().includes(queryLower);
        const phoneMatch = patient.phone?.toLowerCase().includes(queryLower);
        const regIdMatch = patient.regId?.toLowerCase().includes(queryLower);
        const doctorMatch = patient.doctor?.toLowerCase().includes(queryLower);
        const branchMatch = (patient.branchName || patient.branchId)?.toLowerCase().includes(queryLower);
        return nameMatch || phoneMatch || regIdMatch || doctorMatch || branchMatch;
      });

      setFilteredPatients(filtered);

      // Update stats based on search results
      const isPatientPaidSearch = (p) => {
        const ps = (p.paymentStatus || '').toLowerCase();
        const pAmt = Number(p.paymentAmount || p.amountPaid || p.amount || 0);
        return ps === 'paid' || pAmt > 0 || !!p.paymentCollectedAt;
      };
      const upcomingCount = filtered.filter(p => {
        const s = (p.status || '').toLowerCase();
        return ['booked', 'waiting', 'in-consultation', 'pending', 'confirmed'].includes(s) && !isPatientPaidSearch(p);
      }).length;
      const awaitingPaymentCount = filtered.filter(p => {
        const s = (p.status || '').toLowerCase();
        const docS = (p.doctorStatus || '').toLowerCase();
        return (s === 'completed' || docS === 'prescribed') && !isPatientPaidSearch(p);
      }).length;
      const completedCount = filtered.filter(p => {
        const s = (p.status || '').toLowerCase();
        const docS = (p.doctorStatus || '').toLowerCase();
        return s === 'done' || ((s === 'completed' || docS === 'prescribed') && isPatientPaidSearch(p)) || isPatientPaidSearch(p);
      }).length;

      setStats({
        upcoming: upcomingCount,
        awaitingPayment: awaitingPaymentCount,
        completed: completedCount
      });

      setIsSearchApplied(true); // Search filter successfully loaded and applied globally!
    } catch (e) {
      console.error("Firebase global deep search error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Reset search filter and load default
  const handleClearFilter = () => {
    setSearchQuery('');
    setIsSearchApplied(false);
  };

  // Modern Clinical Status Chip Color picker
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'Awaiting Pay' };
      case 'done':
        return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'Done' };
      case 'in-consultation':
      case 'consulting':
        return { bg: '#fef3c7', border: '#fde68a', text: '#d97706', label: 'Consulting' };
      case 'confirmed':
      case 'booked':
        return { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', label: 'Confirmed' };
      case 'pending':
        return { bg: '#fffbeb', border: '#fef3c7', text: '#d97706', label: 'Pending' };
      case 'waiting':
      default:
        return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: 'Waiting' };
    }
  };

  const PatientCard = ({ patient, queueNumber }) => {
    const statusInfo = getStatusStyle(patient.status);
    const initials = patient.fullName
      ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'P';

    const sPat = (patient.status || '').toLowerCase();
    const isWaiting = sPat === 'waiting' || sPat === 'pending' || sPat === 'confirmed' || sPat === 'booked';
    const isCompletedTab = subTab === 'completed';

    return (
      <Surface style={[styles.patientCard, isCompletedTab && { padding: 12, borderRadius: 12, marginBottom: 8 }]}>
        <View style={styles.cardHeader}>
          {/* Circular patient avatar */}
          <Avatar.Text
            size={isCompletedTab ? 36 : 44}
            label={initials}
            style={{ backgroundColor: COLORS.secondary + '15' }}
            labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: isCompletedTab ? 11 : 13 }}
          />

          <View style={{ flex: 1, marginLeft: isCompletedTab ? 10 : 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              {queueNumber ? (
                <View style={{
                  backgroundColor: COLORS.secondary + '15',
                  borderColor: COLORS.secondary + '40',
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}>
                  <Text style={{
                    color: COLORS.secondary,
                    fontSize: 10,
                    fontWeight: '800',
                  }}>{queueNumber}</Text>
                </View>
              ) : isWaiting ? (
                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>Q?</Text>
                </View>
              ) : null}
              <Text style={[styles.patientName, isCompletedTab && { fontSize: 13 }]}>{patient.fullName}</Text>
              {((patient.modeOfConsultation === 'Online') || (patient.raw?.modeOfConsultation === 'Online') || patient._type === 'online' || (patient.source || '').toLowerCase() === 'online') ? (
                <View style={styles.onlineBadge}>
                  <Text style={styles.onlineBadgeText}>ONLINE</Text>
                </View>
              ) : (
                patient.regId ? (
                  <Text style={[styles.patientRegId, isCompletedTab && { fontSize: 11 }]}> ({patient.regId})</Text>
                ) : null
              )}
              {/* Payment Status badge */}
              {(() => {
                const isPaid = patient.paymentStatus === 'paid';
                const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                const isInDur = patient.isInDuration || (followUp ? checkIsInDuration(followUp) : false);
                if (isPaid) {
                  return (
                    <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#059669', fontSize: 8, fontWeight: '800' }}>
                        {patient.paymentMethod === 'split' || patient.paymentSplitDetails ? 'PAID (SPLIT)' : 'PAID'}
                      </Text>
                    </View>
                  );
                } else if (isInDur) {
                  return (
                    <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#059669', fontSize: 8, fontWeight: '800' }}>PAID ₹0 (IN DURATION)</Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#ef4444', fontSize: 8, fontWeight: '800' }}>UNPAID</Text>
                    </View>
                  );
                }
              })()}
              {(() => {
                const source = patient.source || patient.raw?.source;
                const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                const normSource = (source || '').toLowerCase().trim();
                const rawNormSource = (patient.raw?.source || '').toLowerCase().trim();
                const isOld = !!followUp || normSource === 'old patient' || normSource === 'old_patient' || normSource === 'old' || rawNormSource === 'old patient' || rawNormSource === 'old_patient' || rawNormSource === 'old';
                const isNew = !isOld && source && normSource !== 'old patient' && normSource !== 'old_patient' && normSource !== 'old';
                const isApp = patient.isOnline || patient._type === 'online' || normSource === 'appointments' || normSource === 'online' || normSource === 'userapp' || normSource === 'patient app' || normSource === 'patientapp' || normSource === 'app' || rawNormSource === 'appointments' || rawNormSource === 'online' || rawNormSource === 'userapp' || rawNormSource === 'patient app' || rawNormSource === 'patientapp' || rawNormSource === 'app';
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
              {activePackageMobiles.has(patient.phone) && (
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
                    color: '#059669',
                    fontSize: 7,
                    fontWeight: '800',
                    letterSpacing: 0.3
                  }}>PKG</Text>
                </View>
              )}

            </View>

            <View style={styles.infoRow}>
              <Phone size={10} color={COLORS.muted} style={{ marginRight: 4 }} />
              <Text style={[styles.patientInfoText, isCompletedTab && { fontSize: 10 }]}>{patient.phone}</Text>
              {patient.email && !isCompletedTab ? (
                <>
                  <Text style={styles.patientInfoDot}> • </Text>
                  <Text style={styles.patientInfoText} numberOfLines={1}>{patient.email}</Text>
                </>
              ) : null}
            </View>
          </View>

          {isCompletedTab ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* WhatsApp button right in the header */}
              <TouchableOpacity
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#ecfdf5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#a7f3d0'
                }}
                onPress={() => handleWhatsAppContact(patient.phone, patient.fullName)}
              >
                <WhatsAppIcon size={16} color="#10b981" />
              </TouchableOpacity>

              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border, paddingHorizontal: 8, paddingVertical: 2 }]}>
                <Text style={[styles.statusBadgeText, { color: statusInfo.text, fontSize: 9 }]}>{statusInfo.label}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.viewDetailsArrow}
              onPress={() => navigation.navigate('PatientProfile', { patientId: patient.id })}
            >
              <ChevronRight size={18} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Footer Details Tag Chips Row */}
        <View style={[styles.cardFooter, isCompletedTab && { marginTop: 8, paddingTop: 8 }]}>
          <View style={[styles.metaChipRow, isCompletedTab && { gap: 4 }]}>
            <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Calendar size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
              <Text style={styles.tagChipText} numberOfLines={1}>{formatAppointmentDate(patient.appointmentDate)}</Text>
            </View>
            <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
              <MapPin size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
              <Text style={styles.tagChipText} numberOfLines={1}>{getCanonicalBranchName(patient.branchName || patient.branchId) || 'N/A'}</Text>
            </View>
            <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
              <UserCheck size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
              <Text style={styles.tagChipText} numberOfLines={1}>{getCanonicalDoctorName(patient.doctor) || 'General Doctor'}</Text>
            </View>
          </View>

          {!isCompletedTab && (
            /* Dynamic Status Badge matching mockup details */
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        {!isCompletedTab && (
          <View style={styles.cardActionRow}>
            {/* WhatsApp icon button */}
            <TouchableOpacity
              style={styles.iconCircleGreen}
              onPress={() => handleWhatsAppContact(patient.phone, patient.fullName)}
            >
              <WhatsAppIcon size={17} color="#25d366" />
            </TouchableOpacity>
            {/* Reschedule icon button */}
            <TouchableOpacity
              style={styles.iconCircleBlue}
              onPress={() => openRescheduleModal(patient)}
            >
              <CalendarClock size={17} color={COLORS.secondary} />
            </TouchableOpacity>
            {isWaiting && (
              <View style={styles.queueControls}>
                <TouchableOpacity
                  style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8, marginRight: 6 }}
                  onPress={() => handleMoveQueue(patient, 'up')}
                >
                  <ArrowUp size={18} color="#258ec8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8 }}
                  onPress={() => handleMoveQueue(patient, 'down')}
                >
                  <ArrowDown size={18} color="#258ec8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Surface>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Static Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Patient Records</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <MapPin size={11} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.headerSubtitle}>
              {getCanonicalBranchName(userData?.branchName || userData?.branchId) || 'Branch'}
            </Text>
          </View>
        </View>
        {subTab === 'completed' && (
          <TouchableOpacity style={styles.refreshBtnCircle} onPress={fetchAllPatients}>
            <RefreshCw size={15} color={COLORS.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sub-tab Switcher immediately below Top Header */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'completed' && styles.subTabButtonActive]}
          onPress={() => setSubTab('completed')}
        >
          <Text
            style={[styles.subTabText, subTab === 'completed' && styles.subTabTextActive]}
            adjustsFontSizeToFit={true}
            numberOfLines={1}
          >
            Completed Today/Yest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabButton, subTab === 'history' && styles.subTabButtonActive]}
          onPress={() => setSubTab('history')}
        >
          <Text
            style={[styles.subTabText, subTab === 'history' && styles.subTabTextActive]}
            adjustsFontSizeToFit={true}
            numberOfLines={1}
          >
            Search Patient Files
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'completed' ? (
        loading && filteredCompletedHistory.length === 0 ? (
          <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredCompletedHistory}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 16 }}>
                {item._type === 'online' ? (
                  <AppointmentCard
                    appointment={item}
                    queueNumber=""
                    onRefresh={fetchAllPatients}
                    onReschedule={openRescheduleModal}
                    onMoveQueue={handleMoveQueue}
                    onWhatsApp={handleWhatsAppContact}
                    isCompletedTab={true}
                  />
                ) : (
                  <PatientCard patient={item} queueNumber="" />
                )}
              </View>
            )}
            contentContainerStyle={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.secondary]}
                tintColor={COLORS.secondary}
              />
            }
            ListHeaderComponent={
              <View>
                {/* PREMIUM OUTLINED SEARCH BAR ONLY (Title removed from scrollable header) */}
                <View style={styles.searchContainer}>
                  <View style={styles.searchBarWrapper}>
                    <Search size={18} color="#94a3b8" style={{ marginRight: 6 }} />
                    <TextInput
                      placeholder="Search completed by name, phone, doctor..."
                      placeholderTextColor="#94a3b8"
                      value={completedSearchQuery}
                      onChangeText={setCompletedSearchQuery}
                      style={styles.searchFieldInput}
                    />
                    {completedSearchQuery ? (
                      <TouchableOpacity onPress={() => setCompletedSearchQuery('')} style={styles.clearSearchBtn}>
                        <X size={16} color="#64748b" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={[styles.emptyContainer, { paddingHorizontal: 16 }]}>
                <Clipboard size={44} color={COLORS.border} />
                <Text style={styles.emptyText}>No completed appointments found for today or yesterday.</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 110 }} />}
          />
        )
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <Surface style={styles.patientCard}>
                <View style={styles.cardHeader}>
                  <Avatar.Text
                    size={44}
                    label={item.fullName ? item.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                    style={{ backgroundColor: COLORS.secondary + '15' }}
                    labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: 13 }}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.patientName}>{item.fullName}</Text>
                      {item.regId && (
                        <Text style={styles.patientRegId}> ({item.regId})</Text>
                      )}
                      {((item.modeOfConsultation === 'Online') || (item.raw?.modeOfConsultation === 'Online') || item._type === 'online' || (item.source || '').toLowerCase() === 'online') && (
                        <View style={[styles.onlineBadge, { marginLeft: 6 }]}>
                          <Text style={styles.onlineBadgeText}>ONLINE</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.infoRow}>
                      <Phone size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.patientInfoText}>{item.phone}</Text>
                      {item.email ? (
                        <>
                          <Text style={styles.patientInfoDot}> • </Text>
                          <Text style={styles.patientInfoText} numberOfLines={1}>{item.email}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewDetailsArrow}
                    onPress={() => navigation.navigate('PatientProfile', { patientId: item.id })}
                  >
                    <ChevronRight size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardFooter}>
                  <View style={styles.metaChipRow}>
                    <View style={styles.tagChipStyle}>
                      <Calendar size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.tagChipText}>{formatAppointmentDate(item.appointmentDate)}</Text>
                    </View>
                    <View style={styles.tagChipStyle}>
                      <MapPin size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.tagChipText}>{getCanonicalBranchName(item.branchName || item.branchId) || 'N/A'}</Text>
                    </View>
                    <View style={styles.tagChipStyle}>
                      <UserCheck size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.tagChipText}>{getCanonicalDoctorName(item.doctor) || 'General Doctor'}</Text>
                    </View>
                  </View>

                  {/* Dynamic Status Badge */}
                  <View style={[styles.statusBadge, {
                    backgroundColor: getStatusStyle(item.status).bg,
                    borderColor: getStatusStyle(item.status).border,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    marginTop: 0
                  }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusStyle(item.status).text, fontSize: 9 }]}>
                      {getStatusStyle(item.status).label}
                    </Text>
                  </View>
                </View>
              </Surface>
            </View>
          )}
          contentContainerStyle={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Search input inside list header (Title removed from scrollable header) */}
              <View style={styles.searchContainer}>
                <View style={styles.searchBarWrapper}>
                  <Search size={18} color="#94a3b8" style={{ marginRight: 6 }} />
                  <TextInput
                    placeholder="Search history by name, phone, reg ID..."
                    placeholderTextColor="#94a3b8"
                    value={historySearchQuery}
                    onChangeText={setHistorySearchQuery}
                    style={styles.searchFieldInput}
                  />
                  {historySearchQuery ? (
                    <TouchableOpacity onPress={() => setHistorySearchQuery('')} style={styles.clearSearchBtn}>
                      <X size={16} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { paddingHorizontal: 16 }]}>
              {loadingHistory ? (
                <ActivityIndicator color={COLORS.secondary} />
              ) : (
                <>
                  <Clipboard size={44} color={COLORS.border} />
                  <Text style={styles.emptyText}>No historical records found.</Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 110 }} />}
        />
      )}

      {/* NATIVE DATETIME PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(date);
            }
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setBranchModalVisible(false)}
          />
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.filterModalTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setBranchModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterItemRow,
                  selectedBranchFilter === 'all' && styles.filterItemRowActive
                ]}
                onPress={() => {
                  setSelectedBranchFilter('all');
                  setBranchModalVisible(false);
                }}
              >
                <Text style={[
                  styles.filterItemText,
                  selectedBranchFilter === 'all' && styles.filterItemTextActive
                ]}>
                  All Branches
                </Text>
              </TouchableOpacity>
              {uniqueBranches.map((branch) => (
                <TouchableOpacity
                  key={branch}
                  style={[
                    styles.filterItemRow,
                    selectedBranchFilter === branch && styles.filterItemRowActive
                  ]}
                  onPress={() => {
                    setSelectedBranchFilter(branch);
                    setBranchModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.filterItemText,
                    selectedBranchFilter === branch && styles.filterItemTextActive
                  ]}>
                    {branch}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Doctor Selection Modal */}
      <Modal
        visible={doctorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDoctorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setDoctorModalVisible(false)}
          />
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.filterModalTitle}>Select Doctor</Text>
              <TouchableOpacity onPress={() => setDoctorModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterItemRow,
                  selectedDoctorFilter === 'all' && styles.filterItemRowActive
                ]}
                onPress={() => {
                  setSelectedDoctorFilter('all');
                  setDoctorModalVisible(false);
                }}
              >
                <Text style={[
                  styles.filterItemText,
                  selectedDoctorFilter === 'all' && styles.filterItemTextActive
                ]}>
                  All Doctors
                </Text>
              </TouchableOpacity>
              {uniqueDoctors.map((docName) => (
                <TouchableOpacity
                  key={docName}
                  style={[
                    styles.filterItemRow,
                    selectedDoctorFilter === docName && styles.filterItemRowActive
                  ]}
                  onPress={() => {
                    setSelectedDoctorFilter(docName);
                    setDoctorModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.filterItemText,
                    selectedDoctorFilter === docName && styles.filterItemTextActive
                  ]}>
                    {docName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.filterModalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.filterModalTitle}>Reschedule Patient</Text>
              <TouchableOpacity onPress={() => setRescheduleModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true} style={{ flexGrow: 0, maxHeight: 450 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted, marginBottom: 12 }}>
                Patient: {rescheduleItem?.fullName || rescheduleItem?.patientName}
              </Text>

              {/* Doctor Selection */}
              <Text style={styles.inputLabel}>Select Doctor</Text>
              <View style={styles.pickerWrapper}>
                {CANONICAL_DOCTORS.map(docName => (
                  <TouchableOpacity
                    key={docName}
                    style={[
                      styles.pickerItem,
                      rescheduleDoctor === docName && styles.pickerItemActive
                    ]}
                    onPress={() => setRescheduleDoctor(docName)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      rescheduleDoctor === docName && styles.pickerItemTextActive
                    ]}>
                      {docName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Branch Selection */}
              <Text style={styles.inputLabel}>Select Branch</Text>
              <View style={styles.pickerWrapper}>
                {CANONICAL_BRANCHES.map(branch => (
                  <TouchableOpacity
                    key={branch}
                    style={[
                      styles.pickerItem,
                      rescheduleBranch === branch && styles.pickerItemActive
                    ]}
                    onPress={() => setRescheduleBranch(branch)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      rescheduleBranch === branch && styles.pickerItemTextActive
                    ]}>
                      {branch}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Selection */}
              <Text style={styles.inputLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setShowRescheduleDatePicker(true)}
              >
                <Calendar size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                  {rescheduleDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>

              {showRescheduleDatePicker && (
                <DateTimePicker
                  value={rescheduleDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowRescheduleDatePicker(false);
                    if (date) {
                      setRescheduleDate(date);
                    }
                  }}
                  onDismiss={() => setShowRescheduleDatePicker(false)}
                />
              )}

              {/* Time Slots */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                <Text style={styles.inputLabel}>Select Time Slot</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => handleAddRecExtraSlot('before')}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.secondary }}>+ Before</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAddRecExtraSlot('after')}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.secondary }}>+ After</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {fetchingReceptionSlots ? (
                <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 10 }} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {receptionAvailableSlots.map(slotObj => {
                    const timeStr = typeof slotObj === 'string' ? slotObj : slotObj.time;
                    const isSelected = formatRecTimeStr(rescheduleTime) === timeStr;
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
                          styles.pickerItem,
                          isSelected && styles.pickerItemActive,
                          isBlocked && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', opacity: 0.6 },
                          { alignItems: 'center' }
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
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive, isBlocked && { color: '#94a3b8', textDecorationLine: isPast ? 'line-through' : 'none' }]}>{timeStr}</Text>
                        <Text style={{ fontSize: 9, color: labelColor, fontWeight: '700', marginTop: 1 }}>
                          {labelText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[styles.pickerTrigger, { marginBottom: 16 }]}
                onPress={() => setShowRescheduleTimePicker(true)}
              >
                <Clock size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Custom Time: {formatRecTimeStr(rescheduleTime)}</Text>
              </TouchableOpacity>

              {showRescheduleTimePicker && (
                <DateTimePicker
                  value={rescheduleTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onValueChange={(event, time) => {
                    setShowRescheduleTimePicker(false);
                    if (time) setRescheduleTime(time);
                  }}
                  onDismiss={() => setShowRescheduleTimePicker(false)}
                />
              )}

              <View style={styles.modalActionButtons}>
                <Button
                  mode="contained"
                  onPress={handleRescheduleSubmit}
                  style={styles.confirmBtn}
                  buttonColor={COLORS.secondary}
                >
                  Confirm
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setRescheduleModalVisible(false)}
                  style={styles.cancelBtn}
                  textColor={COLORS.muted}
                >
                  Cancel
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    padding: 3,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  subTabButtonActive: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  subTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  subTabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },

  // Header Style
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  refreshBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Stats Counters Row - Smaller and more compact matching user requests
  statsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  statBoxContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statBoxVal: { fontSize: 13, fontWeight: '900', color: COLORS.text, marginRight: 5 },
  statBoxLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },

  // Outlined Searchbar Wrapper w/ Action Button
  searchContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, backgroundColor: COLORS.background },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: COLORS.white,
    height: 46,
    paddingLeft: 12,
    paddingRight: 6,
  },
  searchBarWrapperActive: {
    borderColor: COLORS.secondary,
    backgroundColor: '#f8fafc',
  },
  searchFieldInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  clearSearchBtn: {
    padding: 6,
    marginRight: 4,
  },
  searchSubmitBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSubmitBtnActive: {
    backgroundColor: COLORS.secondary,
  },
  searchSubmitBtnDisabled: {
    backgroundColor: '#f1f5f9',
  },
  searchSubmitBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchSubmitBtnTextActive: {
    color: '#ffffff',
  },
  searchSubmitBtnTextDisabled: {
    color: '#94a3b8',
  },

  // Patient scroll list view
  contentScroll: { paddingBottom: 110 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeadingText: { fontSize: 13, fontWeight: '800', color: COLORS.text, letterSpacing: -0.1 },

  // High-fidelity Patient Cards styles
  patientCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
    elevation: 1,
    shadowColor: 'rgba(0,0,0,0.01)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  patientName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  patientRegId: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  patientInfoText: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  patientInfoDot: { fontSize: 11, color: '#cbd5e1' },
  viewDetailsArrow: { padding: 4, marginLeft: 4 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  tagChipStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagChipText: { fontSize: 10, color: COLORS.muted, fontWeight: '600', maxWidth: 90 },

  // Status Badge styles
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: COLORS.muted, fontSize: 13, fontWeight: '600' },

  // FAB placed above universal simulated tab bar
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 105,
    backgroundColor: COLORS.primary,
    borderRadius: 16
  },

  // Simulated bottom nav tab styling matching dashboard
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    elevation: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  punchNavCircle: { alignItems: 'center', marginTop: -40 },
  punchCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
  },
  onlineBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  onlineBadgeText: {
    color: '#1e40af',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterChipsRow: {
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  filterChip: {
    backgroundColor: COLORS.white,
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 20,
    height: 36,
  },
  filterChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  filterChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  clearAllFiltersBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
  },
  clearAllFiltersText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  filterItemRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 8,
  },
  filterItemRowActive: {
    backgroundColor: COLORS.secondary + '10',
  },
  filterItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  filterItemTextActive: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  iconCircleGreen: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#25d366',
    backgroundColor: 'rgba(37,211,102,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBlue: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#258ec8',
    backgroundColor: 'rgba(37,142,200,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSmall: {
    borderColor: COLORS.secondary,
    borderWidth: 1,
    borderRadius: 8,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  queueControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  queueBtn: {
    margin: 0,
    padding: 0,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  pickerWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pickerItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pickerItemActive: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + '15',
  },
  pickerItemText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: COLORS.secondary,
    fontWeight: '800',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderColor: COLORS.border,
  },
});
export default React.memo(ReceptionPanel, () => true);