import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { Text, Surface, ActivityIndicator, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { ChevronLeft, Edit2, Target, Calendar, CheckCircle2, AlertCircle, Lock } from 'lucide-react-native';

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

const TargetManagement = ({ navigation }) => {
  const { userData } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState({});
  const [saving, setSaving] = useState(false);
  const [canEnterTarget, setCanEnterTarget] = useState(false);
  const [nextMonth, setNextMonth] = useState('');
  const [lastMonthTargets, setLastMonthTargets] = useState([]);
  const [currentMonthTargets, setCurrentMonthTargets] = useState([]);
  const [currentMonthRevenue, setCurrentMonthRevenue] = useState({});
  const [currentMonthName, setCurrentMonthName] = useState('');
  const [liveLoading, setLiveLoading] = useState(true);

  const checkTargetEntryEligibility = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get last day of current month
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // HR can enter targets only on the last day of the month
    const isLastDay = currentDay === lastDayOfMonth;

    setCanEnterTarget(isLastDay);

    // Calculate next month name
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    setNextMonth(nextMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  };

  const fetchNextMonthTargets = async (branchesList) => {
    const today = new Date();
    const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));
      const snapshot = await getDocs(q);

      const loadedTargets = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        loadedTargets[data.branchId] = String(data.target || '');
      });

      setTargets(prev => ({
        ...prev,
        ...loadedTargets
      }));
    } catch (e) {
      console.error('Error fetching next month targets:', e);
    }
  };

  useEffect(() => {
    checkTargetEntryEligibility();
    fetchLastMonthTargets();

    const qBranches = query(collection(db, 'users'), where('role', '==', 'branch'));
    let unsubscribeLive = null;

    const unsubscribeBranches = onSnapshot(qBranches, async (snapshot) => {
      const branchesList = [];
      snapshot.forEach(doc => {
        branchesList.push({ id: doc.id, ...doc.data() });
      });

      const canonicals = [
        { id: 'Kphb', name: 'Kphb', branchName: 'Kphb Branch' },
        { id: 'Chandanagar', name: 'Chandanagar', branchName: 'Chandanagar Branch' },
        { id: 'Dilshuknagar', name: 'Dilshuknagar', branchName: 'Dilshuknagar Branch' },
        { id: 'Nallagandla', name: 'Nallagandla', branchName: 'Nallagandla Branch' }
      ];

      canonicals.forEach(c => {
        const exists = branchesList.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(c.name.toLowerCase()));
        if (!exists) branchesList.push(c);
      });

      setBranches(branchesList);

      const initialTargets = {};
      branchesList.forEach(branch => {
        initialTargets[branch.id] = '';
      });
      setTargets(initialTargets);

      // Pre-populate target inputs
      await fetchNextMonthTargets(branchesList);

      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      try {
        const targetsRef = collection(db, 'monthly_targets');
        const q = query(targetsRef, where('month', '==', monthKey));
        const targetsSnapshot = await getDocs(q);

        const existingBranchIds = new Set();
        targetsSnapshot.forEach(doc => {
          existingBranchIds.add(doc.data().branchId);
        });

        for (const branch of branchesList) {
          if (!existingBranchIds.has(branch.id)) {
            await addDoc(collection(db, 'monthly_targets'), {
              branchId: branch.id,
              branchName: branch.name,
              month: monthKey,
              target: 0,
              reached: 0,
              setBy: 'Auto-generated',
              setById: 'system',
              setAt: serverTimestamp(),
              canEdit: true
            });
          }
        }
      } catch (error) {
        console.error('Error auto-adding branch targets:', error);
      }

      if (unsubscribeLive) unsubscribeLive();
      unsubscribeLive = setupLiveMonthDataListener(branchesList);

      setLoading(false);
    }, (error) => {
      console.error('Error fetching branches:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeBranches();
      if (unsubscribeLive) unsubscribeLive();
    };
  }, []);

  const setupLiveMonthDataListener = (branchesList) => {
    setLiveLoading(true);
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName);

    const targetsRef = collection(db, 'monthly_targets');
    const qTargets = query(targetsRef, where('month', '==', monthKey));
    const unsubscribeTargets = onSnapshot(qTargets, (targetsSnap) => {
      const targetsList = [];
      targetsSnap.forEach(doc => {
        targetsList.push({ id: doc.id, ...doc.data() });
      });
      setCurrentMonthTargets(targetsList);
    }, (error) => {
      console.error('Error listening to current month targets:', error);
    });

    const normKey = (val) => {
      if (!val) return '';
      const str = String(val).toLowerCase().trim();
      if (str.includes('kphb') || str.includes('kphp') || str.includes('kph')) return 'kphb';
      if (str.includes('chnr') || str.includes('chand') || str.includes('chn')) return 'chandanagar';
      if (str.includes('dsnr') || str.includes('dil') || str.includes('dsn')) return 'dilshuknagar';
      if (str.includes('nalla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
      return str.replace(/\s*branch\s*/i, '').trim();
    };

    const parseAnyDate = (raw) => {
      if (!raw) return null;
      if (raw.toDate && typeof raw.toDate === 'function') return raw.toDate();
      if (raw.seconds) return new Date(raw.seconds * 1000);
      if (typeof raw === 'string') {
        const clean = raw.trim();
        const dDirect = new Date(clean);
        if (!isNaN(dDirect.getTime())) return dDirect;

        const datePart = clean.split(' ')[0];
        const parts = datePart.split(/[-/T]/);
        if (parts.length >= 3) {
          const p0 = parts[0].replace(/\D/g, '');
          const p2 = parts[2].replace(/\D/g, '');
          const y = parseInt(p0.length === 4 ? p0 : p2, 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(p0.length === 4 ? p2 : p0, 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return new Date(y, m, d);
          }
        }
      }
      return null;
    };

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const unsubscribeTrans = onSnapshot(collection(db, 'alltransactions'), (transSnap) => {
      const revenueMap = {};

      transSnap.forEach(doc => {
        const trans = doc.data();
        if (trans.isDeleted) return;

        const tDate = parseAnyDate(trans.timestamp || trans.createdAt || trans.date || trans.paymentCollectedAt);
        if (!tDate || tDate.getFullYear() !== currentYear || (tDate.getMonth() + 1) !== currentMonth) return;

        const bKey = normKey(trans.branchName || trans.branch || trans.branchId || trans.location || trans.clinicBranch || trans.raw?.branchName || trans.raw?.branchId || trans.raw?.branch || 'kphb') || 'kphb';
        if (!bKey) return;

        const baseAmt = Number(trans.amount || trans.amountPaid || trans.paymentAmount || 0);
        const items = trans.itemsPaid || null;
        const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;
        const amt = baseAmt > 0 ? baseAmt : itemsSum;

        revenueMap[bKey] = (revenueMap[bKey] || 0) + amt;
      });

      setCurrentMonthRevenue(revenueMap);
      setLiveLoading(false);
    }, (error) => {
      console.error('Error listening to current month transactions:', error);
      setLiveLoading(false);
    });

    return () => {
      unsubscribeTargets();
      unsubscribeTrans();
    };
  };

  const fetchLastMonthTargets = async () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    try {
      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));
      const snapshot = await getDocs(q);

      const targetsList = [];
      snapshot.forEach(doc => {
        targetsList.push({ id: doc.id, ...doc.data() });
      });
      setLastMonthTargets(targetsList);
    } catch (error) {
      console.error('Error fetching last month targets:', error);
    }
  };

  const handleTargetChange = (branchId, value) => {
    setTargets(prev => ({
      ...prev,
      [branchId]: value
    }));
  };

  const handleSaveTargets = async () => {
    if (!canEnterTarget) {
      Alert.alert('Not Allowed', 'You can only enter targets on the last day of the month.');
      return;
    }

    const today = new Date();
    const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Check if targets already exist for next month
    try {
      const targetsRef = collection(db, 'monthly_targets');
      const q = query(targetsRef, where('month', '==', monthKey));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        Alert.alert('Already Set', 'Targets for next month have already been set. Contact admin to make changes.');
        return;
      }
    } catch (error) {
      console.error('Error checking existing targets:', error);
    }

    // Validate all targets are entered
    const emptyTargets = branches.filter(branch => !targets[branch.id] || targets[branch.id] === '');
    if (emptyTargets.length > 0) {
      Alert.alert('Incomplete', 'Please enter targets for all branches.');
      return;
    }

    setSaving(true);

    try {
      // Save targets for each branch
      for (const branch of branches) {
        await addDoc(collection(db, 'monthly_targets'), {
          branchId: branch.id,
          branchName: branch.name,
          month: monthKey,
          target: parseInt(targets[branch.id]),
          reached: 0,
          setBy: userData?.name || 'HR',
          setById: userData?.uid || '',
          setAt: serverTimestamp(),
          canEdit: false // HR cannot edit once set
        });
      }

      Alert.alert('Success', `Targets for ${nextMonth} have been set successfully.`, [
        {
          text: 'OK', onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTab');
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving targets:', error);
      Alert.alert('Error', 'Failed to save targets. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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
        <Text style={styles.headerTitle}>Set Monthly Targets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Surface style={styles.infoCard}>
          <Target size={32} color={COLORS.primary} />
          <Text style={styles.infoTitle}>Monthly Target Setting</Text>
          <Text style={styles.infoText}>
            Set appointment targets for each branch for {nextMonth}
          </Text>
          {canEnterTarget ? (
            <View style={styles.statusBadge}>
              <CheckCircle2 size={16} color={COLORS.success} />
              <Text style={styles.statusText}>You can enter targets today</Text>
            </View>
          ) : (
            <View style={styles.statusBadge}>
              <Lock size={16} color={COLORS.warning} />
              <Text style={styles.statusText}>Target entry only on last day of month</Text>
            </View>
          )}
        </Surface>
        {/* Current Month Live Progress Section */}
        <Text style={styles.sectionTitle}>Live Progress ({currentMonthName})</Text>
        {liveLoading ? (
          <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 24 }} />
        ) : (
          branches.map(branch => {
            const normKey = (val) => {
              if (!val) return '';
              const str = String(val).toLowerCase().trim();
              if (str.includes('kphb') || str.includes('kphp') || str.includes('kph')) return 'kphb';
              if (str.includes('chnr') || str.includes('chand') || str.includes('chn')) return 'chandanagar';
              if (str.includes('dsnr') || str.includes('dil') || str.includes('dsn')) return 'dilshuknagar';
              if (str.includes('nalla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
              return str.replace(/\s*branch\s*/i, '').trim();
            };
            const bKey = normKey(branch.branchId || branch.branchName || branch.name || branch.location || branch.id);
            const targetDoc = currentMonthTargets.find(t => normKey(t.branchId) === bKey || normKey(t.branchName) === bKey) || currentMonthTargets.find(t => t.branchId === branch.id);
            const targetVal = targetDoc ? (Number(targetDoc.target) || 0) : 0;
            const revenueVal = currentMonthRevenue[bKey] || currentMonthRevenue[branch.id] || 0;
            const reachedVal = revenueVal;
            const remainingVal = targetVal > 0 ? Math.max(0, targetVal - reachedVal) : 0;
            const percentage = targetVal > 0 ? (reachedVal / targetVal) : (reachedVal > 0 ? 1 : 0);
            return (
              <Surface key={branch.id} style={styles.liveBranchCard}>
                <View style={styles.liveBranchHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveBranchName}>{branch.name}</Text>
                    <Text style={styles.liveRevenue}>Live Revenue: ₹{revenueVal.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.liveStatsLabelContainer}>
                    <Text style={styles.liveStatsLabel}>Appointments</Text>
                  </View>
                </View>

                <View style={styles.liveStatsRow}>
                  <View style={styles.liveStatItem}>
                    <Text style={styles.liveStatLabel}>Target</Text>
                    <Text style={styles.liveStatValue}>{targetVal}</Text>
                  </View>
                  <View style={styles.liveStatDivider} />
                  <View style={styles.liveStatItem}>
                    <Text style={styles.liveStatLabel}>Achieved</Text>
                    <Text style={[styles.liveStatValue, reachedVal >= targetVal && targetVal > 0 ? { color: COLORS.success } : {}]}>
                      {reachedVal}
                    </Text>
                  </View>
                  <View style={styles.liveStatDivider} />
                  <View style={styles.liveStatItem}>
                    <Text style={styles.liveStatLabel}>Remaining</Text>
                    <Text style={styles.liveStatValue}>{remainingVal}</Text>
                  </View>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, percentage * 100)}%`,
                          backgroundColor: percentage >= 1 ? COLORS.success : COLORS.secondary
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>{Math.round(percentage * 100)}%</Text>
                </View>
              </Surface>
            );
          })
        )}

        {/* Last Month Summary */}
        {lastMonthTargets.length > 0 && (
          <Surface style={styles.historyCard}>
            <Calendar size={20} color={COLORS.secondary} />
            <Text style={styles.historyTitle}>Last Month Summary</Text>
            {lastMonthTargets.map(target => (
              <View key={target.id} style={styles.historyItem}>
                <Text style={styles.historyBranch}>{target.branchName}</Text>
                <View style={styles.historyStats}>
                  <Text style={styles.historyLabel}>Target: </Text>
                  <Text style={styles.historyValue}>{target.target}</Text>
                  <Text style={styles.historyLabel}> | Reached: </Text>
                  <Text style={[styles.historyValue, target.reached >= target.target ? styles.success : styles.warning]}>
                    {target.reached}
                  </Text>
                </View>
              </View>
            ))}
          </Surface>
        )}

        {/* Branch Targets */}
        <Text style={styles.sectionTitle}>Enter Targets for {nextMonth}</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
        ) : (
          branches.map(branch => (
            <Surface key={branch.id} style={styles.branchCard}>
              <View style={styles.branchHeader}>
                <Text style={styles.branchName}>{branch.name}</Text>
                <Text style={styles.branchLocation}>{branch.location || 'Location not set'}</Text>
              </View>
              <TextInput
                mode="outlined"
                label="Monthly Target"
                keyboardType="number-pad"
                value={targets[branch.id]}
                onChangeText={(value) => handleTargetChange(branch.id, value)}
                disabled={!canEnterTarget}
                style={styles.targetInput}
                textColor={COLORS.text}
                theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                outlineStyle={!canEnterTarget ? styles.disabledInput : {}}
                right={<TextInput.Icon icon={(props) => (canEnterTarget ? <Edit2 {...props} size={18} color={COLORS.secondary} /> : <Lock {...props} size={18} color={COLORS.muted} />)} />}
              />
            </Surface>
          ))
        )}

        {/* Save Button */}
        {canEnterTarget && (
          <Button
            mode="contained"
            onPress={handleSaveTargets}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            Save All Targets
          </Button>
        )}
      </ScrollView>
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
  infoCard: { padding: 20, borderRadius: 16, backgroundColor: COLORS.white, elevation: 2, alignItems: 'center', marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  infoText: { fontSize: 13, color: COLORS.muted, marginTop: 8, textAlign: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginLeft: 8 },
  historyCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyBranch: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  historyStats: { flexDirection: 'row', alignItems: 'center' },
  historyLabel: { fontSize: 12, color: COLORS.muted },
  historyValue: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  success: { color: COLORS.success },
  warning: { color: COLORS.warning },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginTop: 8 },
  branchCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.white, elevation: 2, marginBottom: 12 },
  branchHeader: { marginBottom: 12 },
  branchName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  branchLocation: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  targetInput: { marginTop: 8 },
  disabledInput: { backgroundColor: '#f8fafc' },
  saveButton: { marginTop: 16, borderRadius: 12 },
  saveButtonContent: { paddingVertical: 8 },

  // Live dashboard styling
  liveBranchCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  liveBranchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  liveBranchName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  liveRevenue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: 2
  },
  liveStatsLabelContainer: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  liveStatsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.5
  },
  liveStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  liveStatItem: {
    flex: 1,
    alignItems: 'center'
  },
  liveStatLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600',
    marginBottom: 2
  },
  liveStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text
  },
  liveStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.border
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted
  },
  noTargetBadge: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  noTargetText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600'
  },
});

export default TargetManagement;

