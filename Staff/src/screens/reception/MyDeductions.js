import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, IndianRupee, AlertTriangle, Calendar, Clock, TrendingDown, Info, X, ArrowLeftRight, DollarSign } from 'lucide-react-native';

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
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
};

const LATE_THRESHOLD_MINUTES = 15;
const LATE_DAYS_PER_DEDUCTION = 3;
const DEDUCTION_PER_BLOCK = 500;

const MyDeductions = ({ navigation }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lateDays, setLateDays] = useState([]);
  const [lateDeduction, setLateDeduction] = useState(0);
  const [leaveCutsCount, setLeaveCutsCount] = useState(0);
  const [leaveDeduction, setLeaveDeduction] = useState(0);
  const [leavesList, setLeavesList] = useState([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoLanguage, setInfoLanguage] = useState('en');
  const [monthOffset, setMonthOffset] = useState(0); // 0 = Current, 1 = Last, 2 = Last Last

  // Get days in calculated target month
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonthIdx = targetDate.getMonth();
  const monthName = targetDate.toLocaleString('default', { month: 'long' });
  const startOfMonth = new Date(targetYear, targetMonthIdx, 1);
  const endOfMonth = new Date(targetYear, targetMonthIdx + 1, 0);
  const daysInMonth = endOfMonth.getDate();

  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // YYYY-MM-DD
  };

  const fetchLiveDeductions = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      // 1. Fetch logins logs for the current month
      const qLogs = query(
        collection(db, 'activity_logs'),
        where('userId', '==', auth.currentUser.uid),
        where('action', '==', 'login')
      );
      const logSnap = await getDocs(qLogs);

      const scheduledLoginTime = userData?.loginTime || '09:30 AM';
      const isPM = scheduledLoginTime.toLowerCase().includes('pm');
      const isAM = scheduledLoginTime.toLowerCase().includes('am');
      const digitsOnly = scheduledLoginTime.replace(/[a-zA-Z]/g, '').trim();
      const parts = digitsOnly.split(':').map(Number);
      let schedHr = parts[0] || 9;
      const schedMin = parts[1] || 30;

      if (isPM && schedHr < 12) schedHr += 12;
      if (isAM && schedHr === 12) schedHr = 0;

      const lDays = [];
      logSnap.forEach(doc => {
        const log = doc.data();
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : null;
        if (!logDate) return;
        
        const maxLimit = monthOffset === 0 ? today : endOfMonth;
        if (logDate < startOfMonth || logDate > maxLimit) return;

        const logHr = logDate.getHours();
        const logMin = logDate.getMinutes();
        const logTotalMin = logHr * 60 + logMin;
        const schedTotalMin = schedHr * 60 + schedMin;
        const diffMin = logTotalMin - schedTotalMin;

        if (diffMin > LATE_THRESHOLD_MINUTES) {
          lDays.push({
            id: doc.id,
            date: logDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            time: logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            lateBy: diffMin,
          });
        }
      });

      // Sort logs by date descending
      lDays.sort((a, b) => b.date.localeCompare(a.date));
      setLateDays(lDays);

      const lateCount = lDays.length;
      const lateBlocks = Math.floor(lateCount / LATE_DAYS_PER_DEDUCTION);
      setLateDeduction(lateBlocks * DEDUCTION_PER_BLOCK);

      // 2. Fetch approved leaves for the current month
      const qLeaves = query(
        collection(db, 'leave_requests'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'approved')
      );
      const leaveSnap = await getDocs(qLeaves);

      let cutsCount = 0;
      const lList = [];

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
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                const cutsAdded = isWeekend ? 2 : 1;
                cutsCount += cutsAdded;

                lList.push({
                  date: temp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                  dayName: temp.toLocaleDateString('en-US', { weekday: 'short' }),
                  isWeekend,
                  cuts: cutsAdded,
                  type: leave.leaveType || 'Leave'
                });
              }
              temp.setDate(temp.getDate() + 1);
            }
          }
        }
      });

      // Sort leaves list
      lList.sort((a, b) => b.date.localeCompare(a.date));
      setLeavesList(lList);
      setLeaveCutsCount(cutsCount);

      const baseSalary = parseFloat(userData?.salary || 0);
      if (cutsCount > 4 && baseSalary > 0) {
        const excess = cutsCount - 4;
        const computedLOP = Math.round((baseSalary / daysInMonth) * excess);
        setLeaveDeduction(computedLOP);
      } else {
        setLeaveDeduction(0);
      }

    } catch (error) {
      console.error('Error calculating personal deductions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveDeductions();
  }, [userData, monthOffset]);

  const baseSal = parseFloat(userData?.salary || 0);
  const totalDeductions = lateDeduction + leaveDeduction;
  const estimatedNet = Math.max(0, baseSal - totalDeductions);

  const lastMonthName = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('default', { month: 'short' });
  const twoMonthsAgoName = new Date(today.getFullYear(), today.getMonth() - 2, 1).toLocaleString('default', { month: 'short' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Deductions</Text>
        <TouchableOpacity onPress={() => setShowInfoModal(true)} style={{ padding: 8 }}>
          <Info size={22} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabContainer}>
        <TouchableOpacity
          style={[styles.filterTabButton, monthOffset === 0 && styles.filterActiveTabButton]}
          onPress={() => setMonthOffset(0)}
        >
          <Text style={[styles.filterTabButtonText, monthOffset === 0 && styles.filterActiveTabButtonText]}>This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTabButton, monthOffset === 1 && styles.filterActiveTabButton]}
          onPress={() => setMonthOffset(1)}
        >
          <Text style={[styles.filterTabButtonText, monthOffset === 1 && styles.filterActiveTabButtonText]}>{lastMonthName}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTabButton, monthOffset === 2 && styles.filterActiveTabButton]}
          onPress={() => setMonthOffset(2)}
        >
          <Text style={[styles.filterTabButtonText, monthOffset === 2 && styles.filterActiveTabButtonText]}>{twoMonthsAgoName}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
          <Text style={styles.loadingText}>Loading statements...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Month Indicator */}
          <Text style={styles.monthHeader}>{monthName} {targetYear} Overview</Text>

          {/* Balance overview card */}
          <Surface style={styles.mainOverviewCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Base Salary</Text>
                <Text style={styles.summaryValue}>₹{baseSal.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Deductions</Text>
                <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
                  -₹{totalDeductions.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <View style={styles.horizontalDivider} />

            <View style={styles.netPayoutRow}>
              <Text style={styles.netPayoutLabel}>Est. Net Salary so far</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IndianRupee size={18} color={COLORS.success} />
                <Text style={styles.netPayoutValue}>{estimatedNet.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </Surface>

          {/* Shift Details Alert */}
          {userData?.loginTime && (
            <View style={styles.infoBanner}>
              <Clock size={16} color={COLORS.secondary} />
              <Text style={styles.infoBannerText}>
                Assigned Shift Hours: {userData.loginTime} – {userData.logoutTime || '06:30 PM'}
              </Text>
            </View>
          )}

          {/* Late Login Deductions */}
          <View style={styles.sectionHeader}>
            <TrendingDown size={18} color={COLORS.danger} />
            <Text style={styles.sectionTitle}>Late Arrival History</Text>
          </View>

          <Surface style={styles.detailCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>Late days: {lateDays.length} day(s)</Text>
              <Text style={[styles.cardHeaderDeduction, lateDeduction > 0 && { color: COLORS.danger }]}>
                -₹{lateDeduction}
              </Text>
            </View>
            <Text style={styles.ruleText}>
              Rule: Every 3 late logins (>15 mins delay) = -₹500 deduction.
            </Text>

            {lateDays.length === 0 ? (
              <Text style={styles.emptyText}>Awesome! No late arrivals this month.</Text>
            ) : (
              <View style={styles.listContainer}>
                {lateDays.map((log) => (
                  <View key={log.id} style={styles.listItem}>
                    <View style={styles.listLeft}>
                      <Clock size={14} color={COLORS.danger} />
                      <Text style={styles.listItemTitle}>{log.date} ({log.time})</Text>
                    </View>
                    <Text style={styles.listItemRight}>{log.lateBy} min delay</Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>

          {/* Leaves LOP Cuts */}
          <View style={styles.sectionHeader}>
            <Calendar size={18} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>Leave LOP History</Text>
          </View>

          <Surface style={styles.detailCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>Leave cut days: {leaveCutsCount} day(s)</Text>
              <Text style={[styles.cardHeaderDeduction, leaveDeduction > 0 && { color: COLORS.danger }]}>
                -₹{leaveDeduction}
              </Text>
            </View>
            <Text style={styles.ruleText}>
              Rule: 4 leaves allowed free. Leaves on Friday, Saturday, Sunday count as double cuts (2 days LOP cut).
            </Text>

            {leavesList.length === 0 ? (
              <Text style={styles.emptyText}>No approved leaves taken this month.</Text>
            ) : (
              <View style={styles.listContainer}>
                {leavesList.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <View style={styles.listLeft}>
                      <Calendar size={14} color={item.isWeekend ? COLORS.warning : COLORS.muted} />
                      <Text style={styles.listItemTitle}>
                        {item.date} ({item.dayName})
                      </Text>
                    </View>
                    <Text style={[styles.listItemRight, item.isWeekend && { color: COLORS.warning, fontWeight: '700' }]}>
                      {item.isWeekend ? '2 cuts (Weekend)' : '1 cut'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>

          {/* Payslip History Navigation */}
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={() => navigation.navigate('MyPayslips')}
            activeOpacity={0.8}
          >
            <Text style={styles.navigateBtnText}>View Past Payslip Records</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

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
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  scrollContent: { padding: 16 },
  monthHeader: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  mainOverviewCard: {
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
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  verticalDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  horizontalDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  netPayoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netPayoutLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  netPayoutValue: { fontSize: 18, fontWeight: '800', color: COLORS.success, marginLeft: 4 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  infoBannerText: { fontSize: 13, color: COLORS.secondary, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  detailCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  cardHeaderDeduction: { fontSize: 14, fontWeight: '800', color: COLORS.muted },
  ruleText: { fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 16 },
  emptyText: { fontSize: 12, color: COLORS.success, fontWeight: '600', paddingVertical: 12, textAlign: 'center' },
  listContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  listLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listItemTitle: { fontSize: 12, fontWeight: '500', color: COLORS.text },
  listItemRight: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  navigateBtn: {
    marginTop: 20,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#258ec8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  navigateBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
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
  filterTabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterActiveTabButton: {
    backgroundColor: COLORS.secondary + '15',
  },
  filterTabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  filterActiveTabButtonText: {
    color: COLORS.secondary,
  },
});

export default MyDeductions;
