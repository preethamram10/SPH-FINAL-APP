import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView, Keyboard } from 'react-native';
import { Text, Surface, Button, TextInput, Avatar, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, IndianRupee, User, X, Save, AlertTriangle, Clock, Calendar, Info } from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  warning: '#f59e0b',
  danger: '#ef4444',
  success: '#10b981',
};

// Deduction rule constants
const LATE_THRESHOLD_MINUTES = 15;  // late if login > scheduled + 15 min
const LATE_DAYS_PER_DEDUCTION = 3;  // every 3 late days
const DEDUCTION_PER_BLOCK = 500;    // Rs 500 per block of 3 late days

const SalaryManagement = ({ navigation }) => {
  const { userData } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('process');

  const [salaryData, setSalaryData] = useState({
    amount: '',
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    bonus: '0',
    deductions: '0',
    notes: '',
    amountDate: new Date().toISOString().split('T')[0],
    professionType: '',
    salaryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  });

  // Auto-deduction state
  const [autoCalcLoading, setAutoCalcLoading] = useState(false);
  const [lateDaysCount, setLateDaysCount] = useState(0);
  const [autoDeduction, setAutoDeduction] = useState(0);
  const [lateLogDetails, setLateLogDetails] = useState([]);
  const [leaveCutsCount, setLeaveCutsCount] = useState(0);
  const [leaveDeduction, setLeaveDeduction] = useState(0);
  const [leaveLogDetails, setLeaveLogDetails] = useState([]);
  const [showDeductionDetails, setShowDeductionDetails] = useState(false);

  const fetchSalaryHistory = async (staffId) => {
    setHistoryLoading(true);
    try {
      const q = query(collection(db, 'salaries'), where('staffId', '==', staffId));
      const snap = await getDocs(q);
      const history = [];
      snap.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
      });
      history.sort((a, b) => {
        const tA = a.processedAt?.toDate?.() || 0;
        const tB = b.processedAt?.toDate?.() || 0;
        return tB - tA;
      });
      setSalaryHistory(history);
    } catch (error) {
      console.error('Error fetching salary history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // YYYY-MM-DD
  };

  // Calculate auto deduction from activity_logs and leave_requests for selected month
  const calculateAutoDeduction = async (staffMember) => {
    if (!staffMember) return;
    setAutoCalcLoading(true);
    setLateDaysCount(0);
    setAutoDeduction(0);
    setLateLogDetails([]);
    setLeaveCutsCount(0);
    setLeaveDeduction(0);
    setLeaveLogDetails([]);

    try {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const targetMonthIdx = monthNames.indexOf(salaryData.month) !== -1 ? monthNames.indexOf(salaryData.month) : new Date().getMonth();
      const targetYear = parseInt(salaryData.year) || new Date().getFullYear();

      const startOfMonth = new Date(targetYear, targetMonthIdx, 1);
      const endOfMonth = new Date(targetYear, targetMonthIdx + 1, 0);
      const daysInMonth = endOfMonth.getDate();

      // 1. Fetch activity logs for the selected month
      const qLogs = query(
        collection(db, 'activity_logs'),
        where('userId', '==', staffMember.id),
        where('timestamp', '>=', startOfMonth)
      );
      const snap = await getDocs(qLogs);

      const scheduledLoginTime = staffMember.loginTime || '09:30 AM';
      
      // Safe parsing of both 24-hour HH:MM and 12-hour HH:MM AM/PM formats
      const isPM = scheduledLoginTime.toLowerCase().includes('pm');
      const isAM = scheduledLoginTime.toLowerCase().includes('am');
      const digitsOnly = scheduledLoginTime.replace(/[a-zA-Z]/g, '').trim();
      const parts = digitsOnly.split(':').map(Number);
      let schedHr = parts[0] || 0;
      const schedMin = parts[1] || 0;
      
      if (isPM && schedHr < 12) schedHr += 12;
      if (isAM && schedHr === 12) schedHr = 0;

      const lateDays = [];

      snap.forEach(doc => {
        const log = doc.data();
        if (log.action !== 'login') return; // Filter action in memory
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : null;
        if (!logDate) return;
        if (logDate > endOfMonth) return; // Filter upper boundary in memory

        // Compare login time
        const logHr = logDate.getHours();
        const logMin = logDate.getMinutes();
        const logTotalMin = logHr * 60 + logMin;
        const schedTotalMin = schedHr * 60 + schedMin;
        const diffMin = logTotalMin - schedTotalMin;

        if (diffMin > LATE_THRESHOLD_MINUTES) {
          lateDays.push({
            date: logDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            lateBy: diffMin,
          });
        }
      });

      const lateCount = lateDays.length;
      const deductionBlocks = Math.floor(lateCount / LATE_DAYS_PER_DEDUCTION);
      const totalLateDeduction = deductionBlocks * DEDUCTION_PER_BLOCK;

      setLateDaysCount(lateCount);
      setAutoDeduction(totalLateDeduction);
      setLateLogDetails(lateDays);

      const qLeaves = query(
        collection(db, 'leave_requests'),
        where('userId', '==', staffMember.id),
        where('status', '==', 'approved')
      );
      const leaveSnap = await getDocs(qLeaves);

      let totalCuts = 0;
      const leaveDays = [];
      leaveSnap.forEach(docSnap => {
        const leave = docSnap.data();
        if (leave.startDate) {
          const start = parseDateString(leave.startDate);
          const end = parseDateString(leave.endDate) || start;
          if (start && end) {
            let temp = new Date(start.getTime());
            while (temp <= end) {
              if (temp >= startOfMonth && temp <= endOfMonth) {
                const dayOfWeek = temp.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
                const isDouble = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                totalCuts += isDouble ? 2 : 1;
                leaveDays.push({
                  date: temp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                  type: leave.category || leave.leaveType || 'General',
                  isDouble
                });
              }
              temp.setDate(temp.getDate() + 1);
            }
          }
        }
      });

      setLeaveCutsCount(totalCuts);
      setLeaveLogDetails(leaveDays);

      const baseSalary = parseFloat(staffMember.salary || 0);
      if (totalCuts > 4 && baseSalary > 0) {
        const excessLeaves = totalCuts - 4;
        const computedLeaveDeduction = Math.round((baseSalary / daysInMonth) * excessLeaves);
        setLeaveDeduction(computedLeaveDeduction);
      } else {
        setLeaveDeduction(0);
      }

    } catch (error) {
      console.error('Error calculating deductions:', error);
    } finally {
      setAutoCalcLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStaff) {
      fetchSalaryHistory(selectedStaff.id);
      calculateAutoDeduction(selectedStaff);
    }
  }, [selectedStaff, salaryData.month, salaryData.year]);



  const fetchStaff = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      let q;
      if (userData?.role === 'hr' || userData?.branchId === 'N/A') {
        q = query(collection(db, 'users'));
      } else if (userData?.branchId) {
        q = query(collection(db, 'users'), where('branchId', '==', userData.branchId));
      } else {
        q = query(collection(db, 'users'));
      }
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (['doctor', 'staff'].includes(d.role)) {
          if (d.role === 'doctor' && d.doctorType === 'head') return;
          data.push({ id: doc.id, ...d });
        }
      });
      setStaff(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData) fetchStaff();
  }, [userData]);

  // When auto deduction is calculated, pre-fill the deductions field
  useEffect(() => {
    const totalAutoDeductions = autoDeduction + leaveDeduction;
    setSalaryData(prev => ({ ...prev, deductions: String(totalAutoDeductions) }));
  }, [autoDeduction, leaveDeduction]);

  // Pre-fill salary from staff profile if available
  useEffect(() => {
    if (selectedStaff?.salary) {
      setSalaryData(prev => ({ ...prev, amount: String(selectedStaff.salary) }));
    }
  }, [selectedStaff]);

  const handleProcessSalary = async () => {
    if (!salaryData.amount) {
      Alert.alert('Error', 'Please enter base salary amount.');
      return;
    }

    try {
      const grossSalary = parseFloat(salaryData.amount);
      const bonus = parseFloat(salaryData.bonus || 0);
      const deductions = parseFloat(salaryData.deductions || 0);
      const netSalary = grossSalary + bonus - deductions;

      await addDoc(collection(db, 'salaries'), {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        staffRole: selectedStaff.role,
        branchId: userData.branchId,
        amount: grossSalary,
        bonus,
        deductions,
        lateDeduction: autoDeduction,
        lateDaysCount,
        lateLogDetails,
        leaveDeduction,
        leaveCutsCount,
        leaveLogDetails,
        netSalary,
        month: salaryData.month,
        year: salaryData.year,
        notes: salaryData.notes,
        amountDate: salaryData.amountDate,
        professionType: salaryData.professionType,
        salaryTime: salaryData.salaryTime,
        processedBy: userData.name,
        processedAt: serverTimestamp(),
        status: 'paid'
      });

      Alert.alert('Success', `Salary of Rs ${netSalary.toLocaleString('en-IN')} processed for ${selectedStaff.name}`);
      setShowModal(false);
      setSalaryData({
        amount: '',
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        bonus: '0',
        deductions: '0',
        notes: '',
        amountDate: new Date().toISOString().split('T')[0],
        professionType: '',
        salaryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });
      setLateDaysCount(0);
      setAutoDeduction(0);
      setLateLogDetails([]);
      setLeaveCutsCount(0);
      setLeaveDeduction(0);
      setLeaveLogDetails([]);
    } catch (error) {
      console.error('Error processing salary:', error);
      Alert.alert('Error', 'Failed to process salary.');
    }
  };

  const openProcessModal = (item) => {
    setSelectedStaff(item);
    setSalaryData(prev => ({
      ...prev,
      professionType: item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Staff',
      amountDate: new Date().toISOString().split('T')[0],
      salaryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      amount: item.salary ? String(item.salary) : '',
      deductions: '0',
    }));
    setActiveSubTab('process');
    setShowDeductionDetails(false);
    setShowModal(true);
  };

  const renderStaffItem = ({ item }) => (
    <TouchableOpacity onPress={() => openProcessModal(item)} activeOpacity={0.7}>
      <Surface style={styles.staffCard} elevation={1}>
        <View style={styles.staffInfo}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: item.role === 'doctor' ? '#f0fdf4' : '#eff6ff',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: item.role === 'doctor' ? '#bbf7d0' : '#dbeafe'
          }}>
            <User size={20} color={item.role === 'doctor' ? COLORS.success : COLORS.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName}>{item.name}</Text>
            <Text style={styles.staffRole}>{item.role?.toUpperCase()}</Text>
            {item.salary ? (
              <Text style={styles.staffSalary}>Base: Rs {Number(item.salary).toLocaleString('en-IN')}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openProcessModal(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: '#eff6ff',
              borderWidth: 1,
              borderColor: '#dbeafe',
              gap: 4
            }}
          >
            <IndianRupee size={12} color={COLORS.secondary} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.secondary }}>Process</Text>
          </TouchableOpacity>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  const netPayable = (
    parseFloat(salaryData.amount || 0) +
    parseFloat(salaryData.bonus || 0) -
    parseFloat(salaryData.deductions || 0)
  );

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
        <Text style={styles.headerTitle}>Salary Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Process Monthly Salary</Text>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={staff}
            renderItem={renderStaffItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.tabHeader}>
                <TouchableOpacity
                  style={[styles.subTab, activeSubTab === 'process' && styles.activeSubTab]}
                  onPress={() => setActiveSubTab('process')}
                >
                  <Text style={[styles.subTabText, activeSubTab === 'process' && styles.activeSubTabText]}>Process Payout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, activeSubTab === 'history' && styles.activeSubTab]}
                  onPress={() => { setActiveSubTab('history'); fetchSalaryHistory(selectedStaff?.id); }}
                >
                  <Text style={[styles.subTabText, activeSubTab === 'history' && styles.activeSubTabText]}>History ({salaryHistory.length})</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Staff info card */}
              <View style={styles.staffSelectionCard}>
                <User size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName}>{selectedStaff?.name}</Text>
                  <Text style={styles.selectedRole}>{selectedStaff?.role?.toUpperCase()}</Text>
                  {!!selectedStaff?.loginTime && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Clock size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.shiftText}>{selectedStaff.loginTime} – {selectedStaff.logoutTime}</Text>
                    </View>
                  )}
                </View>
              </View>

              {activeSubTab === 'process' ? (
                <View style={styles.form}>

                  {/* Auto-deduction summary */}
                  {autoCalcLoading ? (
                    <View style={styles.deductionLoadingCard}>
                      <ActivityIndicator color={COLORS.warning} size="small" />
                      <Text style={styles.deductionLoadingText}>Calculating attendance metrics...</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {/* Late clock-ins card */}
                      <View style={[styles.deductionSummaryCard, lateDaysCount > 0 && styles.deductionSummaryCardAlert]}>
                        <View style={styles.deductionSummaryRow}>
                          <AlertTriangle size={16} color={lateDaysCount > 0 ? COLORS.danger : COLORS.success} />
                          <Text style={[styles.deductionSummaryTitle, lateDaysCount > 0 && { color: COLORS.danger }]}>
                            {lateDaysCount > 0
                              ? `${lateDaysCount} late day${lateDaysCount > 1 ? 's' : ''} this month`
                              : 'No late days this month'}
                          </Text>
                        </View>
                        {lateDaysCount > 0 && (
                          <>
                            <Text style={styles.deductionRule}>
                              Rule: Every {LATE_DAYS_PER_DEDUCTION} late days (15+ min) = Rs {DEDUCTION_PER_BLOCK} deduction
                            </Text>
                            <View style={styles.deductionBreakdownRow}>
                              <Text style={styles.deductionBreakdownLabel}>Late deduction blocks:</Text>
                              <Text style={styles.deductionBreakdownValue}>
                                {Math.floor(lateDaysCount / LATE_DAYS_PER_DEDUCTION)} × Rs {DEDUCTION_PER_BLOCK}
                              </Text>
                            </View>
                            <View style={styles.deductionBreakdownRow}>
                              <Text style={styles.deductionBreakdownLabel}>Late Auto-deducted:</Text>
                              <Text style={[styles.deductionBreakdownValue, { color: COLORS.danger, fontWeight: '800' }]}>
                                Rs {autoDeduction.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>

                      {/* Leaves LOP card */}
                      <View style={[styles.deductionSummaryCard, leaveCutsCount > 4 && styles.deductionSummaryCardAlert]}>
                        <View style={styles.deductionSummaryRow}>
                          <Calendar size={16} color={leaveCutsCount > 4 ? COLORS.danger : COLORS.success} />
                          <Text style={[styles.deductionSummaryTitle, leaveCutsCount > 4 && { color: COLORS.danger }]}>
                            {leaveCutsCount > 0
                              ? `${leaveCutsCount} leave day cut${leaveCutsCount > 1 ? 's' : ''} this month`
                              : 'No leaves taken this month'}
                          </Text>
                        </View>
                        {leaveCutsCount > 0 && (
                          <>
                            <Text style={styles.deductionRule}>
                              Rule: 4 leaves free. Weekend leaves Friday, Saturday, Sunday count double.
                            </Text>
                            {leaveCutsCount > 4 ? (
                              <>
                                <View style={styles.deductionBreakdownRow}>
                                  <Text style={styles.deductionBreakdownLabel}>Excess leaves (cuts - 4):</Text>
                                  <Text style={styles.deductionBreakdownValue}>
                                    {leaveCutsCount - 4} days
                                  </Text>
                                </View>
                                <View style={styles.deductionBreakdownRow}>
                                  <Text style={styles.deductionBreakdownLabel}>LOP Auto-deducted:</Text>
                                  <Text style={[styles.deductionBreakdownValue, { color: COLORS.danger, fontWeight: '800' }]}>
                                    Rs {leaveDeduction.toLocaleString('en-IN')}
                                  </Text>
                                </View>
                              </>
                            ) : (
                              <Text style={styles.deductionRule}>
                                Within allowed monthly leave limit of 4 free leaves.
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {/* View Details Button */}
                  {(lateDaysCount > 0 || leaveCutsCount > 0) && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowDeductionDetails(!showDeductionDetails)}
                      style={{
                        alignSelf: 'flex-start',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 4,
                        marginBottom: 8
                      }}
                    >
                      <Info size={14} color={COLORS.secondary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.secondary }}>
                        {showDeductionDetails ? 'Hide Deduction Breakdown' : 'View Deduction Breakdown'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Expandable Breakdown List */}
                  {showDeductionDetails && (
                    <View style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      marginBottom: 8,
                      gap: 10
                    }}>
                      {lateDaysCount > 0 && (
                        <View>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.text, marginBottom: 6 }}>
                            LATE CLOCK-INS DETAILS:
                          </Text>
                          {lateLogDetails.map((log, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: idx < lateLogDetails.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}>
                              <Text style={{ fontSize: 12, color: COLORS.text }}>• {log.date}</Text>
                              <Text style={{ fontSize: 12, color: COLORS.danger, fontWeight: '700' }}>Late by {log.lateBy} mins</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {leaveCutsCount > 0 && (
                        <View style={{ marginTop: lateDaysCount > 0 ? 8 : 0 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.text, marginBottom: 6 }}>
                            LEAVE DAYS DETAILS:
                          </Text>
                          {leaveLogDetails.map((lv, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: idx < leaveLogDetails.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}>
                              <Text style={{ fontSize: 12, color: COLORS.text }}>• {lv.date} ({lv.type})</Text>
                              <Text style={{ fontSize: 12, color: lv.isDouble ? COLORS.danger : COLORS.muted, fontWeight: '700' }}>
                                {lv.isDouble ? 'Double Cut' : '1 Cut'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Salary input - pre-filled from profile */}
                  <TextInput
                    label="Base Salary (Rs)"
                    value={salaryData.amount}
                    onChangeText={text => setSalaryData({ ...salaryData, amount: text })}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    left={<TextInput.Icon icon="currency-inr" />}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TextInput
                      label="Bonus (Rs)"
                      value={salaryData.bonus}
                      onChangeText={text => setSalaryData({ ...salaryData, bonus: text })}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      label="Deductions (Rs)"
                      value={salaryData.deductions}
                      onChangeText={text => setSalaryData({ ...salaryData, deductions: text })}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>

                  <TextInput
                    label="Month"
                    value={salaryData.month}
                    onChangeText={text => setSalaryData({ ...salaryData, month: text })}
                    mode="outlined"
                    style={styles.input}
                  />

                  <TextInput
                    label="Notes"
                    value={salaryData.notes}
                    onChangeText={text => setSalaryData({ ...salaryData, notes: text })}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                  />

                  <TextInput
                    label="Profession Type"
                    value={salaryData.professionType}
                    onChangeText={text => setSalaryData({ ...salaryData, professionType: text })}
                    mode="outlined"
                    style={styles.input}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TextInput
                      label="Amount Date"
                      value={salaryData.amountDate}
                      onChangeText={text => setSalaryData({ ...salaryData, amountDate: text })}
                      mode="outlined"
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      label="Salary Time"
                      value={salaryData.salaryTime}
                      onChangeText={text => setSalaryData({ ...salaryData, salaryTime: text })}
                      mode="outlined"
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>

                  {/* Net payable summary */}
                  <View style={styles.calculationCard}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcRowLabel}>Gross Salary</Text>
                      <Text style={styles.calcRowValue}>Rs {Number(salaryData.amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcRowLabel}>Bonus</Text>
                      <Text style={[styles.calcRowValue, { color: COLORS.success }]}>+ Rs {Number(salaryData.bonus || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcRowLabel}>Total Deductions</Text>
                      <Text style={[styles.calcRowValue, { color: COLORS.danger }]}>- Rs {Number(salaryData.deductions || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.calcDivider} />
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Net Payable</Text>
                      <Text style={styles.calcValue}>Rs {netPayable.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleProcessSalary}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: COLORS.secondary,
                      paddingVertical: 14,
                      borderRadius: 12,
                      gap: 8,
                      marginTop: 10,
                      elevation: 2,
                      shadowColor: COLORS.secondary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8
                    }}
                  >
                    <Save size={18} color="white" />
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Generate Pay Slip & Pay</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {historyLoading ? (
                    <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 30 }} />
                  ) : salaryHistory.length === 0 ? (
                    <View style={styles.emptyHistory}>
                      <IndianRupee size={32} color={COLORS.muted} style={{ opacity: 0.5, marginBottom: 8 }} />
                      <Text style={styles.emptyHistoryText}>No past salary history found for this staff member.</Text>
                    </View>
                  ) : (
                    salaryHistory.map((item) => (
                      <Surface key={item.id} style={styles.historyCard}>
                        <View style={styles.historyHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyMonth}>{item.month} {item.year}</Text>
                            <Text style={styles.historyMeta}>Type: {item.professionType || 'Staff'}</Text>
                          </View>
                          <Text style={styles.historyNet}>Rs {item.netSalary?.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={styles.historyDetails}>
                          <Text style={styles.historyDetailText}>
                            Base: Rs {item.amount?.toLocaleString('en-IN')} · Bonus: Rs {item.bonus?.toLocaleString('en-IN')} · Ded: Rs {item.deductions?.toLocaleString('en-IN')}
                          </Text>
                          {item.lateDaysCount > 0 && (
                            <Text style={styles.lateDeductionNote}>
                              Late days: {item.lateDaysCount} days → Rs {item.lateDeduction?.toLocaleString('en-IN')} deduction
                            </Text>
                          )}
                          {item.leaveCutsCount > 0 && (
                            <Text style={[styles.lateDeductionNote, { color: COLORS.warning }]}>
                              Leave cuts: {item.leaveCutsCount} days → Rs {item.leaveDeduction?.toLocaleString('en-IN')} LOP cut
                            </Text>
                          )}
                          {/* Expanded History Breakdown */}
                          {((item.lateLogDetails && item.lateLogDetails.length > 0) || (item.leaveLogDetails && item.leaveLogDetails.length > 0)) && (
                            <View style={{
                              marginTop: 8,
                              backgroundColor: '#f8fafc',
                              borderRadius: 10,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: '#e2e8f0',
                              gap: 6
                            }}>
                              {item.lateLogDetails && item.lateLogDetails.length > 0 && (
                                <View>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.text, marginBottom: 4 }}>Late Days:</Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {item.lateLogDetails.map((log, idx) => (
                                      <View key={idx} style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 10, color: COLORS.danger, fontWeight: '700' }}>{log.date} ({log.lateBy}m)</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}
                              {item.leaveLogDetails && item.leaveLogDetails.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.text, marginBottom: 4 }}>Leave Days:</Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {item.leaveLogDetails.map((lv, idx) => (
                                      <View key={idx} style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 10, color: COLORS.text, fontWeight: '700' }}>
                                          {lv.date} {lv.isDouble ? '(2x)' : ''}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                          <Text style={styles.historyDateText}>Paid on: {item.amountDate} at {item.salaryTime}</Text>
                          {item.notes ? <Text style={styles.historyNotes}>"{item.notes}"</Text> : null}
                        </View>
                      </Surface>
                    ))
                  )}
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.muted, marginBottom: 16 },
  listContent: { paddingBottom: 20 },
  staffCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginBottom: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  staffInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  staffName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  staffRole: { fontSize: 9, color: COLORS.muted, fontWeight: '700', marginTop: 1 },
  staffSalary: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 3 },
  payBtn: { borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 3,
    flex: 1,
    marginRight: 12
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSubTab: {
    backgroundColor: COLORS.white,
    elevation: 1,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  activeSubTabText: {
    color: COLORS.secondary,
  },
  staffSelectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    marginBottom: 16
  },
  selectedName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  selectedRole: { fontSize: 10, color: COLORS.muted, fontWeight: '700' },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  shiftText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  form: { gap: 14 },
  input: { backgroundColor: COLORS.white },

  // Auto-deduction card
  deductionLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  deductionLoadingText: { fontSize: 12, color: COLORS.warning, fontWeight: '600' },
  deductionSummaryCard: {
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6
  },
  deductionSummaryCardAlert: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3'
  },
  deductionSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deductionSummaryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  deductionRule: { fontSize: 10, color: COLORS.muted, fontStyle: 'italic' },
  deductionBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  deductionBreakdownLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  deductionBreakdownValue: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  lateLogsList: { marginTop: 8, gap: 4 },
  lateLogItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: COLORS.white, borderRadius: 8 },
  lateLogDate: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  lateLogTime: { fontSize: 11, fontWeight: '700', color: COLORS.danger },

  // Net calculation card
  calculationCard: {
    padding: 16,
    backgroundColor: COLORS.secondary + '08',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.secondary + '20',
    gap: 6,
    marginVertical: 4
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calcRowLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  calcRowValue: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  calcDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  calcLabel: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  calcValue: { fontSize: 20, fontWeight: '800', color: COLORS.secondary },

  submitBtn: { paddingVertical: 8, borderRadius: 12, marginTop: 10 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  historyList: { gap: 12, paddingBottom: 20 },
  historyCard: { padding: 14, borderRadius: 16, backgroundColor: COLORS.white, elevation: 1, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  historyMonth: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  historyMeta: { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  historyNet: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  historyDetails: { gap: 4 },
  historyDetailText: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  lateDeductionNote: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  historyDateText: { fontSize: 10, color: COLORS.muted, fontWeight: '500' },
  historyNotes: { fontSize: 11, color: COLORS.muted, fontStyle: 'italic', marginTop: 4 },
  emptyHistory: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyHistoryText: { fontSize: 12, color: COLORS.muted, fontWeight: '600', textAlign: 'center' },
});

export default SalaryManagement;
