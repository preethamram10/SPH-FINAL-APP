import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { ChevronLeft, Clock, Calendar, LogIn, LogOut, CheckCircle2, AlertCircle, FileCheck } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
};

const MyAttendance = ({ navigation }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyMetrics, setMonthlyMetrics] = useState({
    present: 0,
    late: 0,
    halfDay: 0,
    permissions: 0,
    absent: 0,
    totalWorkingDays: 0
  });

  useEffect(() => {
    const fetchLogsAndMetrics = async () => {
      try {
        // 1. Fetch Logs
        const qLogs = query(
          collection(db, 'activity_logs'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(qLogs);
        const data = [];
        querySnapshot.forEach((doc) => {
          const logVal = doc.data();
          if (logVal.action === 'login' || logVal.action === 'logout') {
            data.push({ id: doc.id, ...logVal });
          }
        });
        
        // Sort by timestamp descending
        data.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return timeB - timeA;
        });
        setLogs(data);

        // 2. Compute Monthly Metrics
        const today = new Date();
        const targetYear = today.getFullYear();
        const targetMonth = today.getMonth();

        const userLogs = [];
        data.forEach(log => {
          if (log.timestamp) {
            const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            if (logDate.getFullYear() === targetYear && logDate.getMonth() === targetMonth) {
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

        const leavesQ = query(
          collection(db, 'leave_requests'),
          where('staffId', '==', user.uid),
          where('status', '==', 'approved')
        );
        const leavesSnap = await getDocs(leavesQ);
        const approvedLeaves = [];
        leavesSnap.forEach(d => {
          approvedLeaves.push(d.data());
        });

        let daysPresent = 0;
        let lateComings = 0;
        let halfDays = 0;
        let permissions = 0;

        const totalDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const currentDay = today.getDate();

        for (let day = 1; day <= totalDaysInMonth; day++) {
          const currentDate = new Date(targetYear, targetMonth, day);
          const dateKey = currentDate.toISOString().split('T')[0];
          const dateLogs = logsByDate[dateKey] || [];

          const dayLeaves = approvedLeaves.filter(req => req.startDate && req.endDate && dateKey >= req.startDate && dateKey <= req.endDate);
          const hasHalfDayLeave = dayLeaves.some(req => req.category === 'Half Day' || req.leaveType === 'Half Day');
          const hasPermissionLeave = dayLeaves.some(req => req.category === '1 Hour Permission' || req.leaveType === '1 Hour Permission');

          if (dateLogs.length > 0) {
            daysPresent++;
            const sorted = [...dateLogs].sort((a, b) => a.dateObj - b.dateObj);
            const firstIn = sorted.find(l => l.action === 'login') || sorted[0];
            const punchOutLog = [...sorted].reverse().find(l => l.action === 'logout') || sorted[sorted.length - 1];

            const hours = firstIn.dateObj.getHours();
            const minutes = firstIn.dateObj.getMinutes();
            const isLate = hours > 9 || (hours === 9 && minutes > 30);
            if (isLate) {
              lateComings++;
            }

            let workHours = 0;
            if (sorted.length > 1 || punchOutLog !== firstIn) {
              const lastOut = punchOutLog.dateObj;
              workHours = (lastOut - firstIn.dateObj) / (1000 * 60 * 60);
            }

            const isHalfDayWork = workHours >= 0.5 && workHours < 5;
            if (isHalfDayWork || hasHalfDayLeave) {
              halfDays++;
            }

            if (hasPermissionLeave) {
              permissions++;
            }
          }
        }

        let totalWorkingDays = 0;
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const d = new Date(targetYear, targetMonth, day);
          if (d.getDay() !== 0) {
            totalWorkingDays++;
          }
        }

        let workingDaysUpToToday = 0;
        for (let day = 1; day <= currentDay; day++) {
          const d = new Date(targetYear, targetMonth, day);
          if (d.getDay() !== 0) {
            workingDaysUpToToday++;
          }
        }

        const fullLeavesCount = approvedLeaves.filter(req => {
          const isHalfOrPerm = ['Half Day', '1 Hour Permission'].includes(req.category || req.leaveType);
          return !isHalfOrPerm && req.startDate && req.endDate;
        }).reduce((acc, req) => {
          let count = 0;
          const start = new Date(req.startDate);
          const end = new Date(req.endDate);
          const startOfMonth = new Date(targetYear, targetMonth, 1);
          const endOfMonth = new Date(targetYear, targetMonth + 1, 0);

          const rangeStart = start < startOfMonth ? startOfMonth : start;
          const rangeEnd = end > endOfMonth ? endOfMonth : end;

          for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0 && d <= today) {
              count++;
            }
          }
          return acc + count;
        }, 0);

        const absentCount = Math.max(0, workingDaysUpToToday - daysPresent - fullLeavesCount);

        setMonthlyMetrics({
          present: daysPresent,
          late: lateComings,
          halfDay: halfDays,
          permissions,
          absent: absentCount,
          totalWorkingDays
        });

      } catch (error) {
        console.error('Error fetching attendance logs & metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogsAndMetrics();
  }, [user]);

  const renderItem = ({ item }) => {
    const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
    const isLogin = item.action === 'login';

    let isLate = false;
    if (isLogin && date) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      isLate = hours > 9 || (hours === 9 && minutes > 30);
    }

    return (
      <Surface style={styles.logCard}>
        <View style={styles.logIconContainer}>
          {isLogin ? <LogIn size={20} color={COLORS.success} /> : <LogOut size={20} color={COLORS.danger} />}
        </View>
        <View style={styles.logDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.logAction}>{isLogin ? 'Punched In' : 'Punched Out'}</Text>
            {isLate && (
              <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800' }}>LATE</Text>
              </View>
            )}
          </View>
          <View style={styles.logTimeRow}>
            <Calendar size={12} color={COLORS.muted} style={{ marginRight: 4 }} />
            <Text style={styles.logTime}>{date.toLocaleDateString()}</Text>
            <Clock size={12} color={COLORS.muted} style={{ marginLeft: 12, marginRight: 4 }} />
            <Text style={styles.logTime}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>
        {item.photoUrl && (
          <Image source={{ uri: item.photoUrl }} style={styles.selfieImage} />
        )}
      </Surface>
    );
  };

  const renderHeader = () => (
    <View style={{ marginBottom: 16 }}>
      <Surface style={styles.glassAttendanceCard}>
        <View style={styles.glassCardHeader}>
          <Text style={styles.glassCardTitle}>This Month Metrics</Text>
          <Text style={styles.glassCardSub}>Total Working Days: {monthlyMetrics.totalWorkingDays || 0}</Text>
        </View>

        <View style={styles.metricsGrid}>
          {/* Present Metric */}
          <TouchableOpacity 
            style={styles.metricCardItem} 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Present Days', 'Total days you have punched in and attended work this month.')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: '#e8fbf0' }]}>
              <CheckCircle2 size={14} color="#22C55E" />
            </View>
            <Text style={styles.metricCardVal}>{monthlyMetrics.present}</Text>
            <Text style={styles.metricCardLbl} numberOfLines={1}>Present</Text>
          </TouchableOpacity>

          {/* Absent Metric */}
          <TouchableOpacity 
            style={styles.metricCardItem} 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Absent Days', 'Working days where you did not punch in and had no approved leaves.')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: '#f3f4f6' }]}>
              <AlertCircle size={14} color="#9CA3AF" />
            </View>
            <Text style={styles.metricCardVal}>{monthlyMetrics.absent}</Text>
            <Text style={styles.metricCardLbl} numberOfLines={1}>Absent</Text>
          </TouchableOpacity>

          {/* Late Metric */}
          <TouchableOpacity 
            style={styles.metricCardItem} 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Late Days', 'Total days you punched in after the 9:30 AM grace period.')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: '#fef2f2' }]}>
              <Clock size={14} color="#EF4444" />
            </View>
            <Text style={styles.metricCardVal}>{monthlyMetrics.late}</Text>
            <Text style={styles.metricCardLbl} numberOfLines={1}>Late</Text>
          </TouchableOpacity>

          {/* Half Day Metric */}
          <TouchableOpacity 
            style={styles.metricCardItem} 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Half Days', 'Total days with work hours between 0.5 and 5 hours, or approved half-day leave.')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: '#fdfbeb' }]}>
              <Calendar size={14} color="#F59E0B" />
            </View>
            <Text style={styles.metricCardVal}>{monthlyMetrics.halfDay}</Text>
            <Text style={styles.metricCardLbl} numberOfLines={1}>Half Day</Text>
          </TouchableOpacity>

          {/* Permission Metric (Full-width for layout balance) */}
          <TouchableOpacity 
            style={styles.metricCardItemFull} 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Permissions', 'Total approved 1-hour permission requests this month.')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: '#eff6ff', marginBottom: 0 }]}>
              <FileCheck size={14} color="#3B82F6" />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 4 }}>
              <Text style={[styles.metricCardLbl, { fontSize: 10, color: '#475569', marginTop: 0 }]}>Permissions Approved</Text>
              <Text style={[styles.metricCardVal, { fontSize: 14 }]}>{monthlyMetrics.permissions}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Surface>
      
      <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8, marginTop: 8, paddingHorizontal: 4 }}>
        Punch History
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Clock size={40} color={COLORS.muted} style={{ opacity: 0.5, marginBottom: 16 }} />
                <Text style={styles.emptyText}>No attendance records found.</Text>
              </View>
            }
          />
        )}
      </View>
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
  content: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    elevation: 2
  },
  logIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  logDetails: { flex: 1 },
  logAction: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  logTimeRow: { flexDirection: 'row', alignItems: 'center' },
  logTime: { fontSize: 12, color: COLORS.muted, fontWeight: '500' },
  selfieImage: { width: 48, height: 48, borderRadius: 8, marginLeft: 12, backgroundColor: COLORS.background },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },

  // Glassmorphic metrics card styles
  glassAttendanceCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  glassCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  glassCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  glassCardSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCardItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  metricCardItemFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 2,
    marginBottom: 4,
    gap: 8,
  },
  metricIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricCardVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  metricCardLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default MyAttendance;
