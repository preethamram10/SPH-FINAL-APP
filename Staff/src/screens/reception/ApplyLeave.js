import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Surface, ActivityIndicator, RadioButton, Checkbox } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar, FileText, Send, Check, Info, X, Clock, ArrowLeftRight, AlertTriangle, DollarSign } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { notifyBranchHRs, notifyAllHRs } from '../../utils/notificationService';

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

const ApplyLeave = ({ navigation }) => {
  const { userData, user } = useAuth();
  const [leaveType, setLeaveType] = useState('Casual');
  const [startDate, setStartDate] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoLanguage, setInfoLanguage] = useState('en');
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [acknowledgment, setAcknowledgment] = useState(false);
  const [loading, setLoading] = useState(false);

  const onStartChange = (event, selectedDate) => {
    const currentDate = selectedDate || startDate;
    setShowStartPicker(Platform.OS === 'ios');
    setStartDate(currentDate);
  };

  const onEndChange = (event, selectedDate) => {
    const currentDate = selectedDate || endDate;
    setShowEndPicker(Platform.OS === 'ios');
    setEndDate(currentDate);
  };

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // YYYY-MM-DD
  };

  const executeLeaveSubmit = async (startStr, endStr, reqDiffDays = 0, totalDays = 0) => {
    try {
      await addDoc(collection(db, 'leave_requests'), {
        userId: user.uid,
        staffName: userData?.name || userData?.fullName || 'Staff Member',
        staffRole: userData?.role || 'staff',
        branchId: userData?.branchId || '',
        leaveType,
        startDate: startStr,
        endDate: endStr,
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      // Notify all HR users across all branches
      await notifyAllHRs(
        '📅 New Leave Request',
        `${userData?.name || userData?.fullName || 'Staff member'} from ${userData?.branchName || userData?.branch || userData?.branchId || 'All'} Branch has applied for ${leaveType} leave from ${startStr} to ${endStr}.`,
        'leave_request',
        { branchName: userData?.branchName || userData?.branch || userData?.branchId || '' }
      );

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
              userId: user.uid,
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
      
      Alert.alert('Success', 'Leave application submitted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Leave submission error:', error);
      Alert.alert('Error', 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert('Error', 'Please enter a reason for leave.');
      return;
    }
    if (!acknowledgment) {
      Alert.alert('Error', 'Please acknowledge the declaration before submitting.');
      return;
    }

    setLoading(true);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

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
        where('userId', '==', user.uid),
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
            { text: 'Submit Anyway', onPress: () => executeLeaveSubmit(startStr, endStr, reqDiffDays, totalDays) }
          ]
        );
      } else {
        await executeLeaveSubmit(startStr, endStr, reqDiffDays, totalDays);
      }
    } catch (err) {
      console.error("Error checking leaves count:", err);
      // Submit anyway if validation error occurs
      await executeLeaveSubmit(startStr, endStr, 0, 0);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        enabled={Platform.OS === 'ios'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply Leave</Text>
          <TouchableOpacity onPress={() => setShowInfoModal(true)} style={{ padding: 8 }}>
            <Info size={22} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Surface style={styles.card}>
          <Text style={styles.label}>Leave Type</Text>
          <RadioButton.Group onValueChange={newValue => setLeaveType(newValue)} value={leaveType}>
            <View style={styles.radioRow}>
              <View style={styles.radioItem}>
                <RadioButton value="Casual" color={COLORS.secondary} />
                <Text style={styles.radioLabel}>Casual Leave</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="Sick" color={COLORS.secondary} />
                <Text style={styles.radioLabel}>Sick Leave</Text>
              </View>
            </View>
            <View style={styles.radioRow}>
              <View style={styles.radioItem}>
                <RadioButton value="Earned" color={COLORS.secondary} />
                <Text style={styles.radioLabel}>Earned Leave</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="Other" color={COLORS.secondary} />
                <Text style={styles.radioLabel}>Other</Text>
              </View>
            </View>
          </RadioButton.Group>

          <View style={{ height: 16 }} />

          <Text style={styles.label}>Start Date</Text>
          <TouchableOpacity 
            style={styles.datePickerBtn} 
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.7}
          >
            <Calendar size={18} color={COLORS.secondary} />
            <Text style={styles.datePickerText}>{startDate.toLocaleDateString('en-GB')}</Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onValueChange={onStartChange}
              onDismiss={() => setShowStartPicker(false)}
            />
          )}

          <View style={{ height: 16 }} />

          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity 
            style={styles.datePickerBtn} 
            onPress={() => setShowEndPicker(true)}
            activeOpacity={0.7}
          >
            <Calendar size={18} color={COLORS.secondary} />
            <Text style={styles.datePickerText}>{endDate.toLocaleDateString('en-GB')}</Text>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onValueChange={onEndChange}
              onDismiss={() => setShowEndPicker(false)}
              minimumDate={startDate}
            />
          )}

          <View style={{ height: 16 }} />

          <Text style={styles.label}>Reason</Text>
          <TextInput
            mode="outlined"
            placeholder="Please enter reason for leave"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            activeOutlineColor={COLORS.secondary}
          />
        </Surface>

        <Surface style={styles.card}>
          <TouchableOpacity 
            style={styles.ackRow} 
            onPress={() => setAcknowledgment(!acknowledgment)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkboxContainer, acknowledgment && styles.checkboxActive]}>
              {acknowledgment && <Check size={16} color="white" />}
            </View>
            <Text style={styles.ackText}>
              I acknowledge that I am responsible for notifying my manager and handing over any pending work before taking this leave.
            </Text>
          </TouchableOpacity>
        </Surface>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitBtn}
          icon={() => <Send size={20} color={COLORS.white} />}
        >
          Submit Application
        </Button>
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
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: 16 },
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
    elevation: 3,
    marginBottom: 20
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 4 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radioItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  radioLabel: { fontSize: 13, color: '#334155', fontWeight: '500', marginLeft: 4 },
  input: { backgroundColor: COLORS.white },
  textArea: { backgroundColor: '#f8fafc', minHeight: 100, textAlignVertical: 'top' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  datePickerText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    marginLeft: 8,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: COLORS.secondary,
  },
  ackText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  submitBtn: {
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    marginBottom: 40,
    shadowColor: '#258ec8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
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

export default ApplyLeave;
