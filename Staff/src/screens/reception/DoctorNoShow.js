import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, ActivityIndicator, Chip, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar, Clock, Plus, Trash2, X, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, serverTimestamp, limit } from 'firebase/firestore';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  danger: '#ef4444',
  border: '#e2e8f0',
};

const getCanonicalBranchName = (name) => {
  if (!name) return '';
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('kphb')) return 'Kphb';
  if (normalized.includes('madhapur')) return 'Madhapur';
  if (normalized.includes('chandnagar') || normalized.includes('chandanagar') || normalized.includes('chanda nagar')) return 'Chandanagar';
  if (normalized.includes('kukatpally')) return 'Kukatpally';
  if (normalized.includes('dilsukhnagar') || normalized.includes('dilshuknagar') || normalized.includes('dsnr')) return 'Dilshuknagar';
  if (normalized.includes('nallagandla')) return 'Nallagandla';
  return name.replace(/\b[a-z]/g, (char) => char.toUpperCase()).replace(/\s+/g, ' ').trim();
};

const doctorWorksAtBranch = (doctor, userData) => {
  if (!userData) return false;
  if (userData.role === 'admin' || userData.role === 'superadmin') return true;

  const uBranchId = userData.branchId || '';
  const uBranchName = userData.branchName || '';
  
  const normalizeBranch = (branch) => {
    if (!branch) return '';
    const str = String(branch).toLowerCase().trim();
    if (str.includes('kphb') || str.includes('kphp')) return 'kphb';
    if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
    if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
    if (str.includes('nallagandla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
    return str.replace(/\s*branch\s*/i, '').trim();
  };

  const normUserId = normalizeBranch(uBranchId);
  const normUserName = normalizeBranch(uBranchName);

  const dBranchId = doctor.branchId || '';
  const dBranchName = doctor.branchName || '';
  
  if (dBranchId && (normalizeBranch(dBranchId) === normUserId || normalizeBranch(dBranchId) === normUserName)) return true;
  if (dBranchName && (normalizeBranch(dBranchName) === normUserId || normalizeBranch(dBranchName) === normUserName)) return true;

  if (doctor.timings && Array.isArray(doctor.timings)) {
    return doctor.timings.some(t => {
      const normB = normalizeBranch(t.branch);
      return normB === normUserId || normB === normUserName;
    });
  }

  if (doctor.branches && Array.isArray(doctor.branches)) {
    return doctor.branches.some(b => {
      const normB = normalizeBranch(b);
      return normB === normUserId || normB === normUserName;
    });
  }

  return false;
};

const getDoctorScheduledDaysAtBranch = (doctor, branchName) => {
  if (!doctor || !branchName || !doctor.timings) return '';
  
  const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workingDays = new Set();
  
  const normBranch = branchName.toLowerCase().replace(/\s*branch\s*/i, '').trim();
  
  doctor.timings.forEach(t => {
    const bName = t.branch || '';
    if (bName.toLowerCase().replace(/\s*branch\s*/i, '').trim() !== normBranch) return;
    
    if (t.daySchedule) {
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        const ivs = t.daySchedule[d] || t.daySchedule[String(d)] || [];
        if (ivs.length > 0) {
          workingDays.add(d);
        }
      });
    } else if (t.dayOfWeek) {
      t.dayOfWeek.forEach(d => {
        if (t.intervals && t.intervals.length > 0) {
          workingDays.add(d);
        }
      });
    }
  });
  
  if (workingDays.size === 0) return 'No scheduled days at this branch';
  
  return Array.from(workingDays)
    .sort((a, b) => a - b)
    .map(d => daysOfWeekNames[d])
    .join(', ');
};

const isDoctorScheduledAtBranchOnDate = (doctor, branchName, dateObj) => {
  if (!doctor || !branchName || !dateObj || !doctor.timings) return false;
  const day = dateObj.getDay();
  const normBranch = branchName.toLowerCase().replace(/\s*branch\s*/i, '').trim();
  
  let worksOnDay = false;
  doctor.timings.forEach(t => {
    const bName = t.branch || '';
    if (bName.toLowerCase().replace(/\s*branch\s*/i, '').trim() !== normBranch) return;
    
    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      if (ivs.length > 0) {
        worksOnDay = true;
      }
    } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
      if (t.intervals && t.intervals.length > 0) {
        worksOnDay = true;
      }
    }
  });
  return worksOnDay;
};

const DoctorNoShow = ({ navigation }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [noShows, setNoShows] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [noShowDateWarning, setNoShowDateWarning] = useState('');

  // Form State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [overrideType, setOverrideType] = useState('date'); // 'date' | 'date_range' | 'session' | 'time_range'
  const [singleDate, setSingleDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState('morning'); // 'morning' | 'evening' | 'all'
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [reason, setReason] = useState('');

  const resetForm = () => {
    setSelectedDoctor(null);
    setReason('');
    setOverrideType('date');
    setSingleDate(new Date());
    setStartDate(new Date());
    setEndDate(new Date());
    setNoShowDateWarning('');
  };

  // Date/Time pickers state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Selector modales
  const [doctorSelectVisible, setDoctorSelectVisible] = useState(false);

  const uBranchCanonical = getCanonicalBranchName(userData?.branchName || userData?.branchId);

  // Fetch Doctors & Setup No-Shows Listener
  useEffect(() => {
    if (!userData) return;

    // 1. Fetch doctors scheduled in branch
    const fetchDoctors = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
        const snap = await getDocs(q);
        const docsList = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const dObj = { id: docSnap.id, ...data };
          if (doctorWorksAtBranch(dObj, userData)) {
            docsList.push(dObj);
          }
        });
        setDoctors(docsList);
      } catch (err) {
        console.error("Error fetching doctors for No Show:", err);
      }
    };
    fetchDoctors();

    // 2. Setup real-time listener for No Shows restricted to receptionist branch
    const branchNamesList = [];
    if (userData.branchId) branchNamesList.push(userData.branchId);
    if (userData.branchName) branchNamesList.push(userData.branchName);

    const qNoShows = query(
      collection(db, 'doctor_no_shows'),
      where('branchId', 'in', branchNamesList.length > 0 ? branchNamesList : ['KPHB']),
      limit(150)
    );

    const unsubscribe = onSnapshot(qNoShows, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort: recent created overrides first
      list.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tB - tA;
      });
      setNoShows(list);
      setLoading(false);
    }, (error) => {
      console.error("No show listener error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleCreateOverride = async () => {
    if (!selectedDoctor) {
      Alert.alert('Error', 'Please select a doctor.');
      return;
    }
    if (!reason) {
      Alert.alert('Error', 'Please enter a reason.');
      return;
    }

    // Validate against the doctor's weekly scheduled days at receptionist's branch
    const uBranchCanonical = getCanonicalBranchName(userData?.branchName || userData?.branchId);
    if (overrideType === 'date' || overrideType === 'session' || overrideType === 'time_range') {
      const works = isDoctorScheduledAtBranchOnDate(selectedDoctor, uBranchCanonical, singleDate);
      if (!works) {
        const dayName = singleDate.toLocaleDateString('en-US', { weekday: 'long' });
        const sched = getDoctorScheduledDaysAtBranch(selectedDoctor, uBranchCanonical);
        Alert.alert(
          'Cannot Add No Show',
          `Dr. ${selectedDoctor.name} is not scheduled to work on ${dayName}s at ${uBranchCanonical}.\n\nScheduled days: ${sched}`
        );
        return;
      }
    } else if (overrideType === 'date_range') {
      if (startDate > endDate) {
        Alert.alert('Error', 'Start date cannot be after end date.');
        return;
      }
      
      let hasWorkingDay = false;
      let temp = new Date(startDate);
      while (temp <= endDate) {
        if (isDoctorScheduledAtBranchOnDate(selectedDoctor, uBranchCanonical, temp)) {
          hasWorkingDay = true;
          break;
        }
        temp.setDate(temp.getDate() + 1);
      }
      
      if (!hasWorkingDay) {
        const sched = getDoctorScheduledDaysAtBranch(selectedDoctor, uBranchCanonical);
        const formatD = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        Alert.alert(
          'Cannot Add No Show',
          `Dr. ${selectedDoctor.name} is not scheduled to work on any day in the range ${formatD(startDate)} to ${formatD(endDate)} at ${uBranchCanonical}.\n\nScheduled days: ${sched}`
        );
        return;
      }
    }

    const formatDateDash = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatTime24h = (d) => {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    try {
      const uBranchNameResolved = userData?.branchName || `${userData?.branchId || 'KPHB'} Branch`;
      const uBranchIdResolved = userData?.branchId || 'KPHB';

      const payload = {
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        branchId: uBranchIdResolved,
        branchName: uBranchNameResolved,
        type: overrideType,
        reason: reason,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || 'Reception'
      };

      if (overrideType === 'date') {
        payload.date = formatDateDash(singleDate);
      } else if (overrideType === 'date_range') {
        payload.startDate = formatDateDash(startDate);
        payload.endDate = formatDateDash(endDate);
        if (payload.startDate > payload.endDate) {
          Alert.alert('Error', 'Start date cannot be after end date.');
          return;
        }
      } else if (overrideType === 'session') {
        payload.date = formatDateDash(singleDate);
        payload.session = selectedSession;
      } else if (overrideType === 'time_range') {
        payload.date = formatDateDash(singleDate);
        payload.startTime = formatTime24h(startTime);
        payload.endTime = formatTime24h(endTime);
        if (payload.startTime >= payload.endTime) {
          Alert.alert('Error', 'Start time must be before end time.');
          return;
        }
      }

      await addDoc(collection(db, 'doctor_no_shows'), payload);
      Alert.alert('Success', 'No Show override saved successfully.');
      setModalVisible(false);
      resetForm();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save override.');
    }
  };

  const handleDeleteOverride = (id) => {
    Alert.alert(
      'Delete Override',
      'Are you sure you want to cancel this temporary unavailability block?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'doctor_no_shows', id));
              Alert.alert('Deleted', 'Override deleted successfully.');
            } catch (e) {
              Alert.alert('Error', 'Failed to delete override.');
            }
          }
        }
      ]
    );
  };

  const getFormatDateStr = (dateObj) => {
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getFormatTimeStr = (timeObj) => {
    let hours = timeObj.getHours();
    let minutes = timeObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Doctor No Show</Text>
          <Text style={styles.headerSubtitle}>{uBranchCanonical}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={{ color: COLORS.muted, marginTop: 10 }}>Loading overrides...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.infoBanner}>
            <AlertCircle size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>
              Overrides marked here block appointment bookings for specific time periods in this branch only.
            </Text>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Overrides</Text>
            <Chip style={styles.chipCounter} textStyle={styles.chipCounterText}>
              {noShows.length}
            </Chip>
          </View>

          {noShows.length === 0 ? (
            <Surface style={styles.emptyCard} elevation={1}>
              <Calendar size={40} color={COLORS.border} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No Doctor No Show overrides active currently.</Text>
            </Surface>
          ) : (
            noShows.map(ns => (
              <Surface key={ns.id} style={styles.overrideCard} elevation={1}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doctorName}>{ns.doctorName}</Text>
                    <Text style={styles.reasonText}>Reason: {ns.reason}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteOverride(ns.id)} style={styles.deleteBtn}>
                    <Trash2 size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.periodRow}>
                  <Clock size={12} color={COLORS.secondary} style={{ marginRight: 6 }} />
                  <Text style={styles.periodText}>
                    {(() => {
                      if (ns.type === 'date') return `Full Day: ${ns.date}`;
                      if (ns.type === 'date_range') return `${ns.startDate} to ${ns.endDate}`;
                      if (ns.type === 'session') return `${ns.session.toUpperCase()} Session on ${ns.date}`;
                      if (ns.type === 'time_range') return `${ns.startTime} - ${ns.endTime} on ${ns.date}`;
                      return 'N/A';
                    })()}
                  </Text>
                </View>
              </Surface>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
        <Plus size={24} color="white" />
      </TouchableOpacity>

      {/* CREATE OVERRIDE MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add No Show Override</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} style={styles.closeBtn}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {/* Doctor Selector */}
              <Text style={styles.formLabel}>Select Doctor</Text>
              <TouchableOpacity style={styles.formPicker} onPress={() => setDoctorSelectVisible(true)}>
                <Text style={styles.formPickerText}>
                  {selectedDoctor ? selectedDoctor.name : '-- Choose Doctor --'}
                </Text>
              </TouchableOpacity>

              {selectedDoctor && (() => {
                const scheduledDays = getDoctorScheduledDaysAtBranch(selectedDoctor, uBranchCanonical);
                return (
                  <View style={{
                    backgroundColor: 'rgba(37,142,200,0.06)',
                    borderColor: 'rgba(37,142,200,0.15)',
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'flex-start'
                  }}>
                    <AlertCircle size={15} color={COLORS.secondary} style={{ marginRight: 6, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text }}>
                        Dr. {selectedDoctor.name}'s Schedule:
                      </Text>
                      <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, fontWeight: '500' }}>
                        {scheduledDays}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Override Type */}
              <Text style={styles.formLabel}>Override Type</Text>
              <View style={styles.typeRow}>
                {['date', 'date_range', 'session', 'time_range'].map(type => (
                  <Chip
                    key={type}
                    selected={overrideType === type}
                    onPress={() => {
                      setOverrideType(type);
                      setSingleDate(new Date());
                      setStartDate(new Date());
                      setEndDate(new Date());
                      setNoShowDateWarning('');
                    }}
                    style={[styles.typeChip, overrideType === type && styles.typeChipActive]}
                    textStyle={[styles.typeChipText, overrideType === type && styles.typeChipTextActive]}
                  >
                    {type === 'date' ? 'Full Day' : type === 'date_range' ? 'Date Range' : type === 'session' ? 'Session' : 'Time'}
                  </Chip>
                ))}
              </View>

              {/* Date Input */}
              {overrideType !== 'date_range' && (
                <>
                  <Text style={styles.formLabel}>Date</Text>
                  <TouchableOpacity style={styles.formPicker} onPress={() => setShowDatePicker(true)}>
                    <Calendar size={16} color={COLORS.secondary} style={{ marginRight: 8 }} />
                    <Text style={styles.formPickerText}>{getFormatDateStr(singleDate)}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={singleDate}
                      mode="date"
                      display="default"
                      onValueChange={(event, d) => {
                        setShowDatePicker(false);
                        if (d) {
                          if (selectedDoctor) {
                            const works = isDoctorScheduledAtBranchOnDate(selectedDoctor, uBranchCanonical, d);
                            if (!works) {
                              const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                              const sched = getDoctorScheduledDaysAtBranch(selectedDoctor, uBranchCanonical);
                              Alert.alert(
                                'Doctor Unavailable',
                                `Dr. ${selectedDoctor.name} is not scheduled to work on ${dayName}s at ${uBranchCanonical}.\n\nScheduled days: ${sched}`
                              );
                              setNoShowDateWarning(`⚠️ Dr. ${selectedDoctor.name} does not work on ${dayName}s at ${uBranchCanonical}.`);
                              return;
                            }
                          }
                          setSingleDate(d);
                          setNoShowDateWarning('');
                        }
                      }}
                      onDismiss={() => setShowDatePicker(false)}
                    />
                  )}
                  {noShowDateWarning ? (
                    <Text style={styles.warningText}>{noShowDateWarning}</Text>
                  ) : null}
                </>
              )}

              {/* Date Range Inputs */}
              {overrideType === 'date_range' && (
                <View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Start Date</Text>
                      <TouchableOpacity style={styles.formPicker} onPress={() => setShowStartDatePicker(true)}>
                        <Text style={styles.formPickerText}>{getFormatDateStr(startDate)}</Text>
                      </TouchableOpacity>
                      {showStartDatePicker && (
                        <DateTimePicker
                          value={startDate}
                          mode="date"
                          display="default"
                          onValueChange={(event, d) => {
                            setShowStartDatePicker(false);
                            if (d) {
                              setStartDate(d);
                              setNoShowDateWarning('');
                            }
                          }}
                          onDismiss={() => setShowStartDatePicker(false)}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>End Date</Text>
                      <TouchableOpacity style={styles.formPicker} onPress={() => setShowEndDatePicker(true)}>
                        <Text style={styles.formPickerText}>{getFormatDateStr(endDate)}</Text>
                      </TouchableOpacity>
                      {showEndDatePicker && (
                        <DateTimePicker
                          value={endDate}
                          mode="date"
                          display="default"
                          minimumDate={startDate}
                          onValueChange={(event, d) => {
                            setShowEndDatePicker(false);
                            if (d) {
                              if (selectedDoctor) {
                                let hasWorkingDay = false;
                                let temp = new Date(startDate);
                                while (temp <= d) {
                                  if (isDoctorScheduledAtBranchOnDate(selectedDoctor, uBranchCanonical, temp)) {
                                    hasWorkingDay = true;
                                    break;
                                  }
                                  temp.setDate(temp.getDate() + 1);
                                }
                                if (!hasWorkingDay) {
                                  const sched = getDoctorScheduledDaysAtBranch(selectedDoctor, uBranchCanonical);
                                  Alert.alert(
                                    'Doctor Unavailable',
                                    `Dr. ${selectedDoctor.name} has no scheduled working days in this date range at ${uBranchCanonical}.\n\nScheduled days: ${sched}`
                                  );
                                  setNoShowDateWarning(`⚠️ Dr. ${selectedDoctor.name} has no scheduled working days in this date range at ${uBranchCanonical}.`);
                                  return;
                                }
                              }
                              setEndDate(d);
                              setNoShowDateWarning('');
                            }
                          }}
                          onDismiss={() => setShowEndDatePicker(false)}
                        />
                      )}
                    </View>
                  </View>
                  {noShowDateWarning ? (
                    <Text style={styles.warningText}>{noShowDateWarning}</Text>
                  ) : null}
                </View>
              )}

              {/* Session Selector */}
              {overrideType === 'session' && (
                <>
                  <Text style={styles.formLabel}>Select Session</Text>
                  <View style={styles.sessionSelectRow}>
                    {['morning', 'evening', 'all'].map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.sessionBtn, selectedSession === s && styles.sessionBtnActive]}
                        onPress={() => setSelectedSession(s)}
                      >
                        <Text style={[styles.sessionBtnText, selectedSession === s && styles.sessionBtnTextActive]}>
                          {s === 'morning' ? 'Morning (Before 2PM)' : s === 'evening' ? 'Evening (After 2PM)' : 'Full Day'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Time Range Inputs */}
              {overrideType === 'time_range' && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Start Time</Text>
                    <TouchableOpacity style={styles.formPicker} onPress={() => setShowStartTimePicker(true)}>
                      <Text style={styles.formPickerText}>{getFormatTimeStr(startTime)}</Text>
                    </TouchableOpacity>
                    {showStartTimePicker && (
                      <DateTimePicker
                        value={startTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                        onValueChange={(event, t) => {
                          setShowStartTimePicker(false);
                          if (t) setStartTime(t);
                        }}
                        onDismiss={() => setShowStartTimePicker(false)}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>End Time</Text>
                    <TouchableOpacity style={styles.formPicker} onPress={() => setShowEndTimePicker(true)}>
                      <Text style={styles.formPickerText}>{getFormatTimeStr(endTime)}</Text>
                    </TouchableOpacity>
                    {showEndTimePicker && (
                      <DateTimePicker
                        value={endTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                        onValueChange={(event, t) => {
                          setShowEndTimePicker(false);
                          if (t) setEndTime(t);
                        }}
                        onDismiss={() => setShowEndTimePicker(false)}
                      />
                    )}
                  </View>
                </View>
              )}

              {/* Reason Input */}
              <Text style={styles.formLabel}>Reason</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="e.g. Leave, Vacation, Sick Leave"
                placeholderTextColor={COLORS.muted}
                value={reason}
                onChangeText={setReason}
              />

              <Button
                mode="contained"
                onPress={handleCreateOverride}
                style={styles.submitBtn}
                buttonColor={COLORS.secondary}
              >
                Save Override
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DOCTOR SELECT MODAL */}
      <Modal visible={doctorSelectVisible} transparent animationType="fade">
        <View style={styles.dropdownBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setDoctorSelectVisible(false)} />
          <Surface style={styles.dropdownContent} elevation={3}>
            <Text style={styles.dropdownTitle}>Select Doctor</Text>
            {doctors.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No doctors scheduled for this branch.</Text>
            ) : (
              doctors.map(doc => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedDoctor(doc);
                    setDoctorSelectVisible(false);
                    setSingleDate(new Date());
                    setStartDate(new Date());
                    setEndDate(new Date());
                    setNoShowDateWarning('');
                  }}
                >
                  <Text style={styles.dropdownItemText}>{doc.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </Surface>
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
    borderBottomColor: COLORS.border
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerSubtitle: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(37,142,200,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,142,200,0.15)',
    marginBottom: 20
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.text, lineHeight: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  chipCounter: { marginLeft: 8, height: 22, backgroundColor: 'rgba(37,142,200,0.12)', justifyContent: 'center' },
  chipCounterText: { fontSize: 10, color: COLORS.secondary, fontWeight: '700', marginHorizontal: 6 },
  emptyCard: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20
  },
  emptyText: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 18 },
  overrideCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8f2fa'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  doctorName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  reasonText: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)' },
  cardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  periodRow: { flexDirection: 'row', alignItems: 'center' },
  periodText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
    marginBottom: 10
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  closeBtn: { padding: 4 },
  formLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  formPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc'
  },
  formPickerText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  typeChip: { backgroundColor: '#f1f5f9' },
  typeChipActive: { backgroundColor: 'rgba(37,142,200,0.15)' },
  typeChipText: { fontSize: 11, color: COLORS.muted },
  typeChipTextActive: { color: COLORS.secondary, fontWeight: '700' },
  sessionSelectRow: { flexDirection: 'column', gap: 6 },
  sessionBtn: { padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#f8fafc' },
  sessionBtnActive: { borderColor: COLORS.secondary, backgroundColor: 'rgba(37,142,200,0.05)' },
  sessionBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  sessionBtnTextActive: { color: COLORS.secondary, fontWeight: '700' },
  reasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#f8fafc',
    fontWeight: '500'
  },
  submitBtn: { paddingVertical: 6, borderRadius: 10, marginTop: 20, marginBottom: 20 },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  dropdownContent: { width: '80%', padding: 20, borderRadius: 16, backgroundColor: COLORS.white },
  dropdownTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6 },
  dropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  dropdownEmpty: { fontSize: 13, color: COLORS.muted, paddingVertical: 12, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  warningText: {
    marginTop: 6,
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '500',
    lineHeight: 15
  }
});

export default DoctorNoShow;
