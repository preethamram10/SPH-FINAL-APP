import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Text, Surface, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ChevronLeft, Calendar as CalendarIcon, FileText, Send, Calendar, Info, X, Clock, ArrowLeftRight, AlertTriangle, DollarSign } from 'lucide-react-native';
import { notifyBranchHRs, notifyAllHRs } from '../utils/notificationService';
import DateTimePicker from '@react-native-community/datetimepicker';

const POLICY_INFO = {
  en: {
    title: 'Leave Policy & Rules',
    rules: [
      { icon: 'clock', title: 'Late Entry Deduction', desc: '3 days late (15+ mins late) in a month will result in a ₹500 salary deduction.' },
      { icon: 'calendar', title: 'Monthly Limit', desc: 'Only 4 leaves are permitted per calendar month.' },
      { icon: 'arrow-right-left', title: 'Consecutive Leaves', desc: 'Maximum of 3 continuous leaves allowed at one time.' },
      { icon: 'alert-triangle', title: 'Weekend Double Cut', desc: 'Leaves taken on weekends (Friday, Saturday, Sunday) will count as a double leave cut.' },
      { icon: 'dollar-sign', title: 'Loss of Pay (LOP)', desc: 'Any additional leaves taken beyond the monthly limits will result in Loss of Pay (LOP).' }
    ]
  },
  te: {
    title: 'సెలవుల నియమావళి & నిబంధనలు',
    rules: [
      { icon: 'clock', title: 'ఆలస్యంగా రావడం వల్ల తగ్గింపు', desc: 'నెలకు 3 రోజులు ఆలస్యంగా వస్తే (15+ నిమిషాలు) ₹500 జీతం కోత విధించబడుతుంది.' },
      { icon: 'calendar', title: 'నెలవారీ పరిమితి', desc: 'క్యాలెండర్ నెలలో 4 సెలవులు మాత్రమే అనుమతించబడతాయి.' },
      { icon: 'arrow-right-left', title: 'వరుస సెలవులు', desc: 'ఒకేసారి గరిష్టంగా 3 వరుస సెలవులు మాత్రమే పెట్టుకోవడానికి వీలుంటుంది.' },
      { icon: 'alert-triangle', title: 'వారాంతాల్లో డబుల్ కట్', desc: 'వారాంతాల్లో (శుక్రవారం, శనివారం, ఆదివారం) తీసుకునే సెలవులకు డబుల్ సెలవుగా పరిగణిస్తారు.' },
      { icon: 'dollar-sign', title: 'జీతంలో కోత (LOP)', desc: 'నెలవారీ పరిమితికి మించి తీసుకునే అదనపు సెలవులన్నిటికీ జీతంలో కోత (Loss of Pay) ఉంటుంది.' }
    ]
  },
  hi: {
    title: 'अवकाश नीति एवं नियम',
    rules: [
      { icon: 'clock', title: 'देरी से आने पर कटौती', desc: 'एक महीने में 3 दिन देरी से आने पर (15+ मिनट की देरी) ₹500 की वेतन कटौती की जाएगी।' },
      { icon: 'calendar', title: 'मासिक सीमा', desc: 'एक कैलेंडर माह में केवल 4 छुट्टियों की अनुमति है।' },
      { icon: 'arrow-right-left', title: 'लगातार छुट्टियां', desc: 'एक बार में अधिकतम 3 लगातार छुट्टियों की ही अनुमति है।' },
      { icon: 'alert-triangle', title: 'सप्ताहांत पर डबल कट', desc: 'सप्ताहांत (शुक्रवार, शनिवार, रविवार) पर ली गई छुट्टियों को डबल छुट्टी कटौती माना जाएगा।' },
      { icon: 'dollar-sign', title: 'वेतन कटौती (LOP)', desc: 'मासिक सीमा से अधिक ली गई किसी भी अतिरिक्त छुट्टी पर वेतन कटौती (Loss of Pay) लागू होगी।' }
    ]
  }
};

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const LeaveRequest = ({ navigation }) => {
  const { userData } = useAuth();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoLanguage, setInfoLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    leaveType: 'Casual Leave'
  });

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [joiningDate, setJoiningDate] = useState(new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showJoiningPicker, setShowJoiningPicker] = useState(false);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const fetchRecentLeaves = async () => {
    try {
      const q = query(
        collection(db, 'leave_requests'),
        where('staffId', '==', auth.currentUser.uid),
        limit(50)
      );
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));

      // Sort in memory to avoid index error
      const sortedData = data.sort((a, b) => {
        const timeA = a.createdAt?.toDate() || 0;
        const timeB = b.createdAt?.toDate() || 0;
        return timeB - timeA;
      });

      setRecentLeaves(sortedData);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchRecentLeaves();
  }, []);

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // YYYY-MM-DD
  };

  const executeLeaveSubmit = async (startStr, endStr, joiningStr, reqDiffDays = 0, totalDays = 0) => {
    try {
      await addDoc(collection(db, 'leave_requests'), {
        staffId: auth.currentUser.uid,
        userId: auth.currentUser.uid,
        staffName: userData?.name || userData?.fullName || 'Staff Member',
        staffRole: userData?.role || 'staff',
        branchId: userData?.branchId || '',
        startDate: startStr,
        endDate: endStr,
        joiningDate: joiningStr,
        reason: formData.reason,
        leaveType: formData.leaveType,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Send standard HR leave request alert
      try {
        await notifyAllHRs(
          '📅 New Leave Request',
          `${userData?.name || userData?.fullName || 'Staff member'} from ${userData?.branchName || userData?.branch || userData?.branchId || 'All'} Branch has applied for ${formData.leaveType} leave from ${startStr} to ${endStr}.`,
          'leave_request',
          { branchName: userData?.branchName || userData?.branch || userData?.branchId || '' }
        );
      } catch (notifErr) {
        console.warn('Error notifying all HRs:', notifErr);
      }

      // Check threshold warning (leaves > 3 days)
      if (reqDiffDays > 3 || (totalDays + reqDiffDays) > 3) {
        try {
          const name = userData?.name || userData?.fullName || 'Staff Member';
          const branch = userData?.branchName || userData?.branch || userData?.branchId || 'Unknown';
          await notifyAllHRs(
            '⚠️ Leave Threshold Exceeded',
            `${name} from ${branch} Branch has exceeded the 3-day leave limit (Request: ${reqDiffDays} days, Month Total: ${totalDays + reqDiffDays} days).`,
            'leave_limit_warning',
            {
              userId: auth.currentUser.uid,
              name,
              branchName: branch,
              reqDiffDays,
              totalDays
            }
          );
        } catch (warningErr) {
          console.warn('Error sending leave threshold warning:', warningErr);
        }
      }

      Alert.alert('Success', 'Leave request submitted successfully!', [
        {
          text: 'OK',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Dashboard');
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Error submitting leave:', error);
      Alert.alert('Error', 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.reason) {
      Alert.alert('Error', 'Please provide a reason for the leave');
      return;
    }

    setLoading(true);
    const startStr = startDate.toLocaleDateString('en-GB');
    const endStr = endDate.toLocaleDateString('en-GB');
    const joiningStr = joiningDate.toLocaleDateString('en-GB');

    try {
      // 1. Calculate requested leave duration (current request)
      const currentStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const currentEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const reqDiffTime = Math.abs(currentEnd - currentStart);
      const reqDiffDays = Math.ceil(reqDiffTime / (1000 * 60 * 60 * 24)) + 1;

      const isContinuousWarning = reqDiffDays > 3;

      // 2. Fetch user's approved leave requests
      const q = query(
        collection(db, 'leave_requests'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'approved')
      );
      const snap = await getDocs(q);

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      let totalDays = 0;
      snap.forEach(docSnap => {
        const leave = docSnap.data();
        if (leave.startDate) {
          const leaveDate = parseDateString(leave.startDate);
          if (leaveDate && leaveDate.getFullYear() === currentYear && leaveDate.getMonth() === currentMonth) {
            const start = leaveDate;
            const end = parseDateString(leave.endDate) || start;
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            totalDays += diffDays;
          }
        }
      });

      const isMonthlyWarning = totalDays >= 4;

      // 3. Warn if either flag is triggered
      if (isContinuousWarning || isMonthlyWarning) {
        let warnMsg = "Warning:\n";
        if (isContinuousWarning) {
          warnMsg += `• You are applying for ${reqDiffDays} days of continuous leave. Continuous leaves of more than 3 days may not be accepted by HR.\n`;
        }
        if (isMonthlyWarning) {
          warnMsg += `• You have already taken ${totalDays} days of approved leave this month. Additional leaves may result in a salary deduction.\n`;
        }
        warnMsg += "\nDo you want to submit anyway?";

        Alert.alert(
          'Leave Alert',
          warnMsg,
          [
            { text: 'Cancel', onPress: () => setLoading(false), style: 'cancel' },
            { text: 'Submit Anyway', onPress: () => executeLeaveSubmit(startStr, endStr, joiningStr, reqDiffDays, totalDays) }
          ]
        );
      } else {
        await executeLeaveSubmit(startStr, endStr, joiningStr, reqDiffDays, totalDays);
      }
    } catch (err) {
      console.error("Error checking leaves count:", err);
      // Submit anyway if validation error occurs
      await executeLeaveSubmit(startStr, endStr, joiningStr, 0, 0);
    }
  };

  const LeaveTypeBtn = ({ type }) => (
    <TouchableOpacity
      style={[
        styles.typeBtn,
        formData.leaveType === type && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
      ]}
      onPress={() => setFormData({ ...formData, leaveType: type })}
    >
      <Text style={[styles.typeText, formData.leaveType === type && { color: 'white' }]}>{type}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        enabled={Platform.OS === 'ios'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}
            style={styles.backBtn}
          >
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply Leave</Text>
          <TouchableOpacity onPress={() => setShowInfoModal(true)} style={{ padding: 8 }}>
            <Info size={22} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Leave Balance Header */}
          <View style={styles.balanceContainer}>
            <Surface style={styles.balanceCard}>
              <Text style={styles.balanceValue}>12</Text>
              <Text style={styles.balanceLabel}>Annual</Text>
            </Surface>
            <Surface style={styles.balanceCard}>
              <Text style={[styles.balanceValue, { color: COLORS.secondary }]}>08</Text>
              <Text style={styles.balanceLabel}>Sick</Text>
            </Surface>
            <Surface style={styles.balanceCard}>
              <Text style={[styles.balanceValue, { color: '#f59e0b' }]}>05</Text>
              <Text style={styles.balanceLabel}>Casual</Text>
            </Surface>
          </View>

          <Surface style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CalendarIcon size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Request Leave</Text>
            </View>

            <Text style={styles.label}>Leave Category</Text>
            <View style={styles.typeGrid}>
              <LeaveTypeBtn type="Casual Leave" />
              <LeaveTypeBtn type="Sick Leave" />
              <LeaveTypeBtn type="Annual Leave" />
              <LeaveTypeBtn type="Half Day" />
              <LeaveTypeBtn type="1 Hour Permission" />
              <LeaveTypeBtn type="Other" />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>From Date</Text>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowStartPicker(true)}>
                  <Calendar size={18} color={COLORS.secondary} />
                  <Text style={styles.dateText}>{startDate.toLocaleDateString('en-GB')}</Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onValueChange={(event, date) => {
                      setShowStartPicker(false);
                      if (date) setStartDate(date);
                    }}
                  />
                )}
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>To Date</Text>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(true)}>
                  <Calendar size={18} color={COLORS.secondary} />
                  <Text style={styles.dateText}>{endDate.toLocaleDateString('en-GB')}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    onValueChange={(event, date) => {
                      setShowEndPicker(false);
                      if (date) setEndDate(date);
                    }}
                  />
                )}
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Joining Date</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowJoiningPicker(true)}>
                <Calendar size={18} color={COLORS.secondary} />
                <Text style={styles.dateText}>{joiningDate.toLocaleDateString('en-GB')}</Text>
              </TouchableOpacity>
              {showJoiningPicker && (
                <DateTimePicker
                  value={joiningDate}
                  mode="date"
                  display="default"
                  onValueChange={(event, date) => {
                    setShowJoiningPicker(false);
                    if (date) setJoiningDate(date);
                  }}
                />
              )}
            </View>

            <Text style={styles.label}>Reason for Absence</Text>
            <TextInput
              mode="outlined"
              value={formData.reason}
              onChangeText={(text) => setFormData({ ...formData, reason: text })}
              placeholder="Please provide details..."
              multiline
              numberOfLines={4}
              style={{ height: 100, backgroundColor: '#f8fafc', textAlignVertical: 'top' }}
              activeOutlineColor={COLORS.primary}
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
              contentStyle={styles.btnContent}
              buttonColor={COLORS.primary}
              textColor="white"
              icon={() => <Send size={18} color="white" />}
            >
              Apply Now
            </Button>
          </Surface>

          <View style={{ marginTop: 32, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Recent History</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {recentLeaves.length > 4 && (
                <TouchableOpacity onPress={() => setShowAllHistory(!showAllHistory)}>
                  <Text style={{ fontSize: 12, color: COLORS.secondary }}>
                    {showAllHistory ? 'Show Less' : 'View All'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={fetchRecentLeaves}>
                <Text style={{ fontSize: 12, color: COLORS.secondary }}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {fetching ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : recentLeaves.length === 0 ? (
            <Text style={styles.emptyText}>No previous leave requests found.</Text>
          ) : (
            (showAllHistory ? recentLeaves : recentLeaves.slice(0, 4)).map((item) => (
              <Surface key={item.id} style={[
                styles.historyCard,
                { borderLeftColor: item.status === 'approved' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#f59e0b' }
              ]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyType}>{item.leaveType}</Text>
                  <Text style={styles.historyDate}>{item.startDate} - {item.endDate}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.status === 'approved' ? '#f0fdf4' : item.status === 'rejected' ? '#fef2f2' : '#fefce8' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: item.status === 'approved' ? '#166534' : item.status === 'rejected' ? '#991b1b' : '#854d0e' }
                  ]}>
                    {item.status === 'approved' ? 'Accepted' : item.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </Text>
                </View>
              </Surface>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Leave Policy Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{POLICY_INFO[infoLanguage].title}</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Language Selection Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, infoLanguage === 'en' && styles.activeTabButton]}
                onPress={() => setInfoLanguage('en')}
              >
                <Text style={[styles.tabButtonText, infoLanguage === 'en' && styles.activeTabButtonText]}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, infoLanguage === 'te' && styles.activeTabButton]}
                onPress={() => setInfoLanguage('te')}
              >
                <Text style={[styles.tabButtonText, infoLanguage === 'te' && styles.activeTabButtonText]}>తెలుగు</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, infoLanguage === 'hi' && styles.activeTabButton]}
                onPress={() => setInfoLanguage('hi')}
              >
                <Text style={[styles.tabButtonText, infoLanguage === 'hi' && styles.activeTabButtonText]}>हिंदी</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.rulesList} showsVerticalScrollIndicator={false}>
              {POLICY_INFO[infoLanguage].rules.map((rule, idx) => (
                <View key={idx} style={styles.ruleItem}>
                  <View style={[styles.ruleIconBg,
                  rule.icon === 'clock' && { backgroundColor: '#fef3c7' },
                  rule.icon === 'calendar' && { backgroundColor: '#d1fae5' },
                  rule.icon === 'arrow-right-left' && { backgroundColor: '#dbeafe' },
                  rule.icon === 'alert-triangle' && { backgroundColor: '#fee2e2' },
                  rule.icon === 'dollar-sign' && { backgroundColor: '#f3e8ff' },
                  ]}>
                    {rule.icon === 'clock' && <Clock size={16} color="#d97706" />}
                    {rule.icon === 'calendar' && <Calendar size={16} color="#059669" />}
                    {rule.icon === 'arrow-right-left' && <ArrowLeftRight size={16} color="#2563eb" />}
                    {rule.icon === 'alert-triangle' && <AlertTriangle size={16} color="#dc2626" />}
                    {rule.icon === 'dollar-sign' && <DollarSign size={16} color="#7c3aed" />}
                  </View>
                  <View style={styles.ruleTextContainer}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.ruleDesc}>{rule.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
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
    borderBottomColor: COLORS.border
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: 20 },
  balanceContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  balanceCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  balanceValue: { fontSize: 20, fontWeight: '800', color: '#10b981' },
  balanceLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 4 },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  typeText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flatInput: { backgroundColor: '#f8fafc', fontSize: 14, borderRadius: 12, height: 50 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  dateText: { marginLeft: 8, fontSize: 13, color: '#334155', fontWeight: '500' },
  submitBtn: { marginTop: 24, borderRadius: 12, backgroundColor: COLORS.secondary },
  btnContent: { paddingVertical: 6 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    borderLeftWidth: 4,
  },
  historyType: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  historyDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: COLORS.muted, marginTop: 20, fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeBtn: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabButtonText: {
    color: '#1e293b',
  },
  rulesList: {
    paddingBottom: 10,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  ruleIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  ruleTextContainer: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  ruleDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
});

export default LeaveRequest;
