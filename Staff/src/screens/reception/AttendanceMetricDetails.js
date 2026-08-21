import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, Calendar, Clock, AlertCircle, FileCheck, HelpCircle } from 'lucide-react-native';

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

const AttendanceMetricDetails = ({ route, navigation }) => {
  const { metricType } = route.params || { metricType: 'absent' };
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = Current, 1 = Last, 2 = 2 Months Ago
  const [itemsList, setItemsList] = useState([]);

  // Calculate target dates
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonthIdx = targetDate.getMonth();
  const targetMonthName = targetDate.toLocaleString('default', { month: 'long' });
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

  const fetchMetricDetails = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setItemsList([]);

    try {
      const uid = auth.currentUser.uid;

      // 1. Fetch user logins/activity logs
      const qLogs = query(
        collection(db, 'activity_logs'),
        where('userId', '==', uid)
      );
      const logsSnap = await getDocs(qLogs);
      const userLogs = [];
      logsSnap.forEach(d => {
        const log = d.data();
        if (log.timestamp && (log.action === 'login' || log.action === 'logout')) {
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          if (logDate.getFullYear() === targetYear && logDate.getMonth() === targetMonthIdx) {
            userLogs.push({ ...log, dateObj: logDate });
          }
        }
      });

      const logsByDate = {};
      userLogs.forEach(log => {
        const dateKey = log.dateObj.toISOString().split('T')[0];
        if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
        logsByDate[dateKey].push(log);
      });

      // 2. Fetch approved leave requests
      const leavesQ = query(
        collection(db, 'leave_requests'),
        where('staffId', '==', uid),
        where('status', '==', 'approved')
      );
      const leavesSnap = await getDocs(leavesQ);
      const approvedLeaves = [];
      leavesSnap.forEach(d => {
        approvedLeaves.push(d.data());
      });

      const list = [];
      // If filtering current month, iterate up to today, else iterate the whole month
      const maxDay = (monthOffset === 0) ? today.getDate() : daysInMonth;

      for (let day = 1; day <= maxDay; day++) {
        const currentDate = new Date(targetYear, targetMonthIdx, day);
        if (currentDate.getDay() === 0) continue; // Skip Sunday

        const dateKey = currentDate.toISOString().split('T')[0];
        const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const weekdayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });

        const logs = logsByDate[dateKey] || [];
        const dayLeaves = approvedLeaves.filter(req => {
          if (!req.startDate) return false;
          const start = parseDateString(req.startDate);
          const end = parseDateString(req.endDate) || start;
          const currentKeyDate = new Date(targetYear, targetMonthIdx, day);
          return start && end && currentKeyDate >= start && currentKeyDate <= end;
        });

        const hasHalfDayLeave = dayLeaves.some(req => ['Half Day', 'Sick Leave', 'Casual Leave', 'Annual Leave'].includes(req.category || req.leaveType) && (req.category === 'Half Day' || req.leaveType === 'Half Day'));
        const hasPermissionLeave = dayLeaves.some(req => ['1 Hour Permission', 'Permission'].includes(req.category || req.leaveType));
        const hasFullLeave = dayLeaves.length > 0 && !hasHalfDayLeave && !hasPermissionLeave;

        if (metricType === 'absent') {
          // Absent if no logs AND no full leave
          if (logs.length === 0 && !hasFullLeave) {
            list.push({
              date: formattedDate,
              dayName: weekdayName,
              title: 'Absent Day',
              desc: 'No punch-in recorded & no approved leave.',
            });
          }
        } else if (logs.length > 0) {
          const sorted = [...logs].sort((a, b) => a.dateObj - b.dateObj);
          const firstIn = sorted.find(l => l.action === 'login') || sorted[0];
          const punchOutLog = [...sorted].reverse().find(l => l.action === 'logout') || sorted[sorted.length - 1];

          if (metricType === 'late') {
            const hours = firstIn.dateObj.getHours();
            const minutes = firstIn.dateObj.getMinutes();
            // Scheduled logic time default 09:30 AM
            const isLate = hours > 9 || (hours === 9 && minutes > 30);
            if (isLate) {
              const diffMin = (hours * 60 + minutes) - (9 * 60 + 30);
              list.push({
                date: formattedDate,
                dayName: weekdayName,
                title: 'Late Clock-in',
                desc: `Punched in at ${firstIn.dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (+${diffMin} mins delay)`,
              });
            }
          } else if (metricType === 'halfDay') {
            let workHours = 0;
            if (sorted.length > 1 || punchOutLog !== firstIn) {
              workHours = (punchOutLog.dateObj - firstIn.dateObj) / (1000 * 60 * 60);
            }
            const isHalfDayWork = workHours >= 0.5 && workHours < 5;
            if (isHalfDayWork || hasHalfDayLeave) {
              list.push({
                date: formattedDate,
                dayName: weekdayName,
                title: hasHalfDayLeave ? 'Approved Half-Day Leave' : 'Short Work Hours',
                desc: hasHalfDayLeave ? 'Registered leave request' : `Worked for ${workHours.toFixed(1)} hours only`,
              });
            }
          } else if (metricType === 'permissions') {
            if (hasPermissionLeave) {
              list.push({
                date: formattedDate,
                dayName: weekdayName,
                title: '1-Hour Permission',
                desc: 'Approved doctor/clinic permission pass',
              });
            }
          }
        }
      }

      // Sort chronological descending
      list.sort((a, b) => b.date.localeCompare(a.date));
      setItemsList(list);

    } catch (error) {
      console.error('Error fetching metric details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricDetails();
  }, [metricType, monthOffset]);

  const getMetricTitle = () => {
    switch (metricType) {
      case 'absent': return 'Absent History';
      case 'late': return 'Late History';
      case 'halfDay': return 'Half Day History';
      case 'permissions': return 'Permission History';
      default: return 'Metric History';
    }
  };

  const getMetricIcon = () => {
    switch (metricType) {
      case 'absent': return <AlertCircle size={22} color={COLORS.danger} />;
      case 'late': return <Clock size={22} color={COLORS.danger} />;
      case 'halfDay': return <Calendar size={22} color={COLORS.warning} />;
      case 'permissions': return <FileCheck size={22} color={COLORS.secondary} />;
      default: return <HelpCircle size={22} color={COLORS.muted} />;
    }
  };

  const lastMonthName = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('default', { month: 'short' });
  const twoMonthsAgoName = new Date(today.getFullYear(), today.getMonth() - 2, 1).toLocaleString('default', { month: 'short' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getMetricTitle()}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, monthOffset === 0 && styles.activeTabButton]}
          onPress={() => setMonthOffset(0)}
        >
          <Text style={[styles.tabButtonText, monthOffset === 0 && styles.activeTabButtonText]}>This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, monthOffset === 1 && styles.activeTabButton]}
          onPress={() => setMonthOffset(1)}
        >
          <Text style={[styles.tabButtonText, monthOffset === 1 && styles.activeTabButtonText]}>{lastMonthName}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, monthOffset === 2 && styles.activeTabButton]}
          onPress={() => setMonthOffset(2)}
        >
          <Text style={[styles.tabButtonText, monthOffset === 2 && styles.activeTabButtonText]}>{twoMonthsAgoName}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
          <Text style={styles.loadingText}>Fetching statement details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Target Month Header */}
          <Text style={styles.monthHeader}>{targetMonthName} {targetYear}</Text>

          {itemsList.length === 0 ? (
            <Surface style={styles.emptyCard}>
              {getMetricIcon()}
              <Text style={styles.emptyTitle}>All Clean!</Text>
              <Text style={styles.emptySubtitle}>No records logged for {getMetricTitle().toLowerCase()} during this month.</Text>
            </Surface>
          ) : (
            itemsList.map((item, idx) => (
              <Surface key={idx} style={styles.recordCard}>
                <View style={styles.recordLeftIcon}>
                  {getMetricIcon()}
                </View>
                <View style={styles.recordMain}>
                  <View style={styles.recordTitleRow}>
                    <Text style={styles.recordDate}>{item.date} ({item.dayName})</Text>
                    <Text style={styles.recordTypeBadge}>{item.title}</Text>
                  </View>
                  <Text style={styles.recordDesc}>{item.desc}</Text>
                </View>
              </Surface>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: COLORS.secondary + '15',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  activeTabButtonText: {
    color: COLORS.secondary,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  scrollContent: { padding: 16 },
  monthHeader: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  emptySubtitle: { fontSize: 12, color: COLORS.muted, textAlign: 'center', lineHeight: 18 },
  recordCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
    gap: 12,
  },
  recordLeftIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordMain: { flex: 1 },
  recordTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recordDate: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  recordTypeBadge: { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  recordDesc: { fontSize: 12, color: COLORS.muted },
});

export default AttendanceMetricDetails;
