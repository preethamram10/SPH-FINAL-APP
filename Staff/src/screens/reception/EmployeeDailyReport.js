import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { FileText, Send, Calendar, Users, Eye, CheckCircle2, ChevronRight, BarChart2, ArrowLeft, Clock, GitBranch } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { notifyAllHRs } from '../../utils/notificationService';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
};

const formatDateSafe = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

const formatTimeSafe = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch (e) {
    return '';
  }
};

const EmployeeDailyReport = ({ navigation }) => {
  const { userData } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState(userData?.role === 'hr' ? 'view' : 'submit'); // 'submit', 'view', or 'branchwise'

  // Branch-wise history state (HR only)
  const [bwFromDate, setBwFromDate] = useState(new Date());
  const [bwToDate, setBwToDate] = useState(new Date());
  const [showBwFromPicker, setShowBwFromPicker] = useState(false);
  const [showBwToPicker, setShowBwToPicker] = useState(false);
  const [bwBranch, setBwBranch] = useState('');
  const [bwReports, setBwReports] = useState([]);
  const [bwLoading, setBwLoading] = useState(false);
  const [expandedBranch, setExpandedBranch] = useState(null);

  // Submit State
  const [selectedStaff, setSelectedStaff] = useState('');
  const [reportDate, setReportDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [metrics, setMetrics] = useState({
    googleReviews: '',
    contactsAdded: '',
    digitalWork: '',
    followUps: '',
    totalCalls: '',
    videoReviews: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [branchStaffs, setBranchStaffs] = useState([]);

  // View State
  const [viewDate, setViewDate] = useState(new Date());
  const [showViewDatePicker, setShowViewDatePicker] = useState(false);
  const [branchReports, setBranchReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('');

  // My History State
  const [myHistoryReports, setMyHistoryReports] = useState([]);
  const [loadingMyHistory, setLoadingMyHistory] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['receptionist', 'staff']));
        const snap = await getDocs(q);
        const staffs = [];
        snap.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          if (userData?.role === 'hr' || userData?.role === 'branch') {
            if (!userData?.branchName) {
              staffs.push(data);
            } else if (data.branch === userData.branchName || data.branchName === userData.branchName || data.branchId === userData.branchId) {
              staffs.push(data);
            }
          } else {
            // For regular staff/receptionist, only show themselves
            if (data.id === userData?.id) {
              staffs.push(data);
            }
          }
        });
        setBranchStaffs(staffs);
        
        // Auto-select if regular staff
        if (userData?.role !== 'hr' && userData?.role !== 'branch' && staffs.length > 0) {
          setSelectedStaff(staffs[0].id);
        }
      } catch (err) {
        console.error("Error fetching staffs:", err);
      }
    };
    if (userData) fetchStaff();
  }, [userData]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'branch'));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setBranches(list);
      } catch (err) {
        console.error("Error fetching branches:", err);
      }
    };
    if (userData?.role === 'hr') {
      fetchBranches();
    }
  }, [userData]);

  const handleSubmit = async () => {
    if (!selectedStaff) {
      Alert.alert("Missing Info", "Please select a staff member.");
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = reportDate.toISOString().split('T')[0];

      // Check for existing report
      const checkQ = query(
        collection(db, 'daily_reports'),
        where('staffId', '==', selectedStaff),
        where('date', '==', dateStr)
      );
      const checkSnap = await getDocs(checkQ);
      if (!checkSnap.empty) {
        Alert.alert("Duplicate Report", "A report has already been submitted for this staff on this date.");
        setSubmitting(false);
        return;
      }

      const staffObj = branchStaffs.find(s => s.id === selectedStaff);
      
      const payload = {
        staffId: selectedStaff,
        staffName: staffObj?.name || 'Unknown Staff',
        branchName: userData?.branchName || staffObj?.branch || 'Unknown Branch',
        branchId: userData?.branchId || staffObj?.branchId || 'Unknown',
        date: dateStr,
        metrics: {
          googleReviews: Number(metrics.googleReviews) || 0,
          contactsAdded: Number(metrics.contactsAdded) || 0,
          digitalWork: metrics.digitalWork || '',
          followUps: Number(metrics.followUps) || 0,
          totalCalls: Number(metrics.totalCalls) || 0,
          videoReviews: Number(metrics.videoReviews) || 0
        },
        submittedBy: userData?.uid || 'Unknown',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'daily_reports'), payload);

      // Notify all HR users
      try {
        await notifyAllHRs(
          '📊 Daily Report Submitted',
          `${staffObj?.name || staffObj?.fullName || 'Staff member'} from ${payload.branchName || 'All'} Branch has submitted their daily report.`,
          'daily_report',
          { staffId: selectedStaff, branchName: payload.branchName }
        );
      } catch (notifErr) {
        console.warn('Error notifying HRs about daily report:', notifErr);
      }

      setSuccessMsg('Daily report submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      
      setMetrics({ googleReviews: '', contactsAdded: '', digitalWork: '', followUps: '', totalCalls: '', videoReviews: '' });
      setSelectedStaff('');
      
    } catch (err) {
      console.error("Error submitting daily report:", err);
      Alert.alert("Error", "Failed to submit daily report.");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchReports = async () => {
    if (!viewDate) return;
    setLoadingReports(true);
    try {
      const dateStr = viewDate.toISOString().split('T')[0];
      let q;
      if (userData?.role === 'hr') {
        q = query(
          collection(db, 'daily_reports'),
          where('date', '==', dateStr)
        );
      } else {
        q = query(
          collection(db, 'daily_reports'),
          where('date', '==', dateStr),
          where('branchName', '==', userData?.branchName || 'Unknown Branch')
        );
      }
      const snap = await getDocs(q);
      const reports = [];
      snap.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));
      setBranchReports(reports);
    } catch (err) {
      console.error("Error fetching branch reports:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'view') fetchReports();
  }, [activeSubTab, viewDate]);

  // Fetch branch-wise history (HR)
  const fetchBwReports = async () => {
    setBwLoading(true);
    try {
      const fromStr = bwFromDate.toISOString().split('T')[0];
      const toStr = bwToDate.toISOString().split('T')[0];
      const q = query(
        collection(db, 'daily_reports'),
        where('date', '>=', fromStr),
        where('date', '<=', toStr)
      );
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setBwReports(list);
    } catch (err) {
      console.error('Error fetching branch-wise reports:', err);
    } finally {
      setBwLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'branchwise') fetchBwReports();
  }, [activeSubTab, bwFromDate, bwToDate]);

  // Fetch My History
  const fetchMyHistory = async () => {
    if (!userData?.id && !userData?.uid) return;
    setLoadingMyHistory(true);
    try {
      // First try by staffId
      let q = query(
        collection(db, 'daily_reports'),
        where('staffId', '==', userData?.id)
      );
      let snap = await getDocs(q);
      
      // If empty, fallback to submittedBy
      if (snap.empty && userData?.uid) {
        q = query(
          collection(db, 'daily_reports'),
          where('submittedBy', '==', userData?.uid)
        );
        snap = await getDocs(q);
      }

      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      // Sort descending by date
      list.sort((a, b) => (a.date > b.date ? -1 : 1));
      setMyHistoryReports(list);
    } catch (err) {
      console.error('Error fetching my history reports:', err);
    } finally {
      setLoadingMyHistory(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'my_history') fetchMyHistory();
  }, [activeSubTab, userData]);

  const getBranchGrouped = () => {
    const norm = s => (s || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
    const filtered = bwBranch ? bwReports.filter(r => norm(r.branchName) === norm(bwBranch)) : bwReports;
    const groups = {};
    filtered.forEach(r => {
      const b = r.branchName || 'Unknown';
      if (!groups[b]) groups[b] = { branch: b, reports: [], totals: { totalCalls:0, followUps:0, contactsAdded:0, googleReviews:0, videoReviews:0 } };
      groups[b].reports.push(r);
      ['totalCalls','followUps','contactsAdded','googleReviews','videoReviews'].forEach(k => {
        groups[b].totals[k] += Number(r.metrics?.[k] || 0);
      });
    });
    return Object.values(groups);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Reports</Text>
      </View>

      <View style={styles.tabContainer}>
        {userData?.role !== 'hr' && (
          <>
            <TouchableOpacity
              style={[styles.tabBtn, activeSubTab === 'submit' && styles.tabBtnActive]}
              onPress={() => setActiveSubTab('submit')}
            >
              <Send size={16} color={activeSubTab === 'submit' ? '#fff' : COLORS.muted} />
              <Text style={[styles.tabText, activeSubTab === 'submit' && styles.tabTextActive]}>Submit Report</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabBtn, activeSubTab === 'my_history' && styles.tabBtnActive]}
              onPress={() => setActiveSubTab('my_history')}
            >
              <FileText size={16} color={activeSubTab === 'my_history' ? '#fff' : COLORS.muted} />
              <Text style={[styles.tabText, activeSubTab === 'my_history' && styles.tabTextActive]}>My History</Text>
            </TouchableOpacity>
          </>
        )}
        {(userData?.role === 'hr' || userData?.role === 'branch') && (
          <TouchableOpacity
            style={[styles.tabBtn, activeSubTab === 'view' && styles.tabBtnActive]}
            onPress={() => setActiveSubTab('view')}
          >
            <Eye size={16} color={activeSubTab === 'view' ? '#fff' : COLORS.muted} />
            <Text style={[styles.tabText, activeSubTab === 'view' && styles.tabTextActive]}>Branch Updates</Text>
          </TouchableOpacity>
        )}
        {userData?.role === 'hr' && (
          <TouchableOpacity
            style={[styles.tabBtn, activeSubTab === 'branchwise' && styles.tabBtnActive]}
            onPress={() => setActiveSubTab('branchwise')}
          >
            <GitBranch size={16} color={activeSubTab === 'branchwise' ? '#fff' : COLORS.muted} />
            <Text style={[styles.tabText, activeSubTab === 'branchwise' && styles.tabTextActive]}>Branch History</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeSubTab === 'submit' && (
          <Surface style={styles.card}>
            {successMsg ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={20} color="#166534" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Select Staff Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroll}>
              {branchStaffs.map(staff => (
                <TouchableOpacity 
                  key={staff.id} 
                  style={[styles.staffChip, selectedStaff === staff.id && styles.staffChipActive]}
                  onPress={() => setSelectedStaff(staff.id)}
                >
                  <Users size={14} color={selectedStaff === staff.id ? '#fff' : COLORS.muted} style={{marginRight:6}}/>
                  <Text style={[styles.staffChipText, selectedStaff === staff.id && styles.staffChipTextActive]}>
                    {staff.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Report Date</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
              <Calendar size={18} color={COLORS.secondary} />
              <Text style={styles.dateText}>{formatDateSafe(reportDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={reportDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setReportDate(date);
                }}
              />
            )}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Metrics</Text>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Calls</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={metrics.totalCalls} onChangeText={(t) => setMetrics({...metrics, totalCalls: t})} placeholder="0" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Follow Ups</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={metrics.followUps} onChangeText={(t) => setMetrics({...metrics, followUps: t})} placeholder="0" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contacts Added</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={metrics.contactsAdded} onChangeText={(t) => setMetrics({...metrics, contactsAdded: t})} placeholder="0" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Google Reviews</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={metrics.googleReviews} onChangeText={(t) => setMetrics({...metrics, googleReviews: t})} placeholder="0" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Video Reviews</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={metrics.videoReviews} onChangeText={(t) => setMetrics({...metrics, videoReviews: t})} placeholder="0" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Digital Work (Blogs/Nutrition/Back Links)</Text>
              <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                multiline 
                value={metrics.digitalWork} 
                onChangeText={(t) => setMetrics({...metrics, digitalWork: t})} 
                placeholder="Describe digital work..." 
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                  <ChevronRight size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </Surface>
        )}

        {activeSubTab === 'view' && (
          <View>
            <Surface style={[styles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }]}>
              <Calendar size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, fontWeight: '600', color: COLORS.text }}>Select Date:</Text>
              <TouchableOpacity style={styles.dateSelectorSmall} onPress={() => setShowViewDatePicker(true)}>
                <Text style={styles.dateTextSmall}>{formatDateSafe(viewDate)}</Text>
              </TouchableOpacity>
              {showViewDatePicker && (
                <DateTimePicker
                  value={viewDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowViewDatePicker(false);
                    if (date) setViewDate(date);
                  }}
                />
              )}
            </Surface>

            {userData?.role === 'hr' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.label, { marginLeft: 4, marginBottom: 8 }]}>Filter by Branch</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroll}>
                  <TouchableOpacity 
                    style={[styles.staffChip, selectedBranchFilter === '' && styles.staffChipActive]}
                    onPress={() => setSelectedBranchFilter('')}
                  >
                    <Text style={[styles.staffChipText, selectedBranchFilter === '' && styles.staffChipTextActive]}>
                      All Branches
                    </Text>
                  </TouchableOpacity>
                  {branches.map(br => (
                    <TouchableOpacity 
                      key={br.id} 
                      style={[styles.staffChip, selectedBranchFilter === br.name && styles.staffChipActive]}
                      onPress={() => setSelectedBranchFilter(br.name)}
                    >
                      <Text style={[styles.staffChipText, selectedBranchFilter === br.name && styles.staffChipTextActive]}>
                        {br.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {loadingReports ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
            ) : branchReports.filter(report => {
              if (!selectedBranchFilter || userData?.role !== 'hr') return true;
              const reportBranchNorm = (report.branchName || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
              const filterBranchNorm = selectedBranchFilter.toLowerCase().replace(/\s*branch\s*/i, '').trim();
              return reportBranchNorm === filterBranchNorm;
            }).length === 0 ? (
              <View style={styles.emptyBox}>
                <BarChart2 size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No Reports Found</Text>
                <Text style={styles.emptyText}>No staff reports have been submitted for this date matching the selected branch.</Text>
              </View>
            ) : (
              branchReports
                .filter(report => {
                  if (!selectedBranchFilter || userData?.role !== 'hr') return true;
                  const reportBranchNorm = (report.branchName || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
                  const filterBranchNorm = selectedBranchFilter.toLowerCase().replace(/\s*branch\s*/i, '').trim();
                  return reportBranchNorm === filterBranchNorm;
                })
                .map(report => (
                <Surface key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Users size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.reportStaffName}>{report.staffName}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.muted, fontWeight: '600', marginBottom: 4 }}>
                        {report.branchName}
                      </Text>
                      <View style={styles.reportTime}>
                        <Clock size={10} color={COLORS.muted} style={{ marginRight: 4 }}/> 
                        <Text style={{ fontSize: 11, color: COLORS.muted }}>
                          {report.createdAt?.toDate ? formatTimeSafe(report.createdAt.toDate()) : 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>Completed</Text>
                    </View>
                  </View>

                  <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics.totalCalls}</Text><Text style={styles.metricLabel}>Total Calls</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics.followUps}</Text><Text style={styles.metricLabel}>Follow Ups</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics.contactsAdded}</Text><Text style={styles.metricLabel}>Contacts</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics.googleReviews}</Text><Text style={styles.metricLabel}>G-Reviews</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics.videoReviews}</Text><Text style={styles.metricLabel}>Video Revs</Text></View>
                  </View>

                  <View style={styles.digitalWorkBox}>
                    <Text style={styles.digitalWorkTitle}>Digital Work:</Text>
                    <Text style={styles.digitalWorkText}>{report.metrics.digitalWork || 'N/A'}</Text>
                  </View>
                </Surface>
              ))
            )}
          </View>
        )}

        {/* ── Branch-wise History (HR only) ── */}
        {activeSubTab === 'branchwise' && (
          <View>
            {/* Date Range */}
            <Surface style={[styles.card, { marginBottom: 12 }]}>
              <Text style={[styles.label, { marginBottom: 12 }]}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity style={[styles.dateSelectorSmall, { flex: 1 }]} onPress={() => setShowBwFromPicker(true)}>
                  <Text style={{ fontSize: 11, color: COLORS.muted, fontWeight: '600' }}>FROM</Text>
                  <Text style={styles.dateTextSmall}>{formatDateSafe(bwFromDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateSelectorSmall, { flex: 1 }]} onPress={() => setShowBwToPicker(true)}>
                  <Text style={{ fontSize: 11, color: COLORS.muted, fontWeight: '600' }}>TO</Text>
                  <Text style={styles.dateTextSmall}>{formatDateSafe(bwToDate)}</Text>
                </TouchableOpacity>
              </View>
              {showBwFromPicker && (
                <DateTimePicker value={bwFromDate} mode="date" display="default"
                  onChange={(event, d) => { setShowBwFromPicker(false); if (d) setBwFromDate(d); }} />
              )}
              {showBwToPicker && (
                <DateTimePicker value={bwToDate} mode="date" display="default"
                  onChange={(event, d) => { setShowBwToPicker(false); if (d) setBwToDate(d); }} />
              )}
              {/* Branch Filter */}
              <Text style={[styles.label, { marginBottom: 8 }]}>Filter by Branch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={[styles.staffChip, bwBranch === '' && styles.staffChipActive]} onPress={() => setBwBranch('')}>
                  <Text style={[styles.staffChipText, bwBranch === '' && styles.staffChipTextActive]}>All</Text>
                </TouchableOpacity>
                {branches.map(br => (
                  <TouchableOpacity key={br.id} style={[styles.staffChip, bwBranch === br.name && styles.staffChipActive]} onPress={() => setBwBranch(br.name)}>
                    <Text style={[styles.staffChipText, bwBranch === br.name && styles.staffChipTextActive]}>{br.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Surface>

            {bwLoading ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
            ) : getBranchGrouped().length === 0 ? (
              <View style={styles.emptyBox}>
                <BarChart2 size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No Reports Found</Text>
                <Text style={styles.emptyText}>No reports for the selected range and branch.</Text>
              </View>
            ) : (
              getBranchGrouped().map(group => (
                <View key={group.branch} style={{ marginBottom: 16 }}>
                  {/* Branch Header */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, marginBottom: 4 }}
                    onPress={() => setExpandedBranch(expandedBranch === group.branch ? null : group.branch)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <GitBranch size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{group.branch}</Text>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{group.reports.length} reports</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 18 }}>{expandedBranch === group.branch ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {/* Branch Totals */}
                  <Surface style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 4, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {[['Calls', group.totals.totalCalls, '#258ec8'], ['Follow Ups', group.totals.followUps, '#8b5cf6'],
                        ['Contacts', group.totals.contactsAdded, '#f59e0b'], ['G-Reviews', group.totals.googleReviews, '#10b981'],
                        ['Videos', group.totals.videoReviews, '#ec4899']].map(([lbl, val, col]) => (
                        <View key={lbl} style={{ flex: 1, minWidth: '28%', alignItems: 'center', padding: 8, backgroundColor: `${col}15`, borderRadius: 8 }}>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: col }}>{val}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' }}>{lbl}</Text>
                        </View>
                      ))}
                    </View>
                  </Surface>

                  {/* Individual Reports (expandable) */}
                  {expandedBranch === group.branch && group.reports
                    .sort((a, b) => a.date > b.date ? -1 : 1)
                    .map(report => (
                      <Surface key={report.id} style={[styles.reportCard, { marginBottom: 8 }]}>
                        <View style={styles.reportHeader}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                              <Users size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                              <Text style={styles.reportStaffName}>{report.staffName}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: COLORS.muted }}>📅 {report.date}</Text>
                          </View>
                          <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>Done</Text></View>
                        </View>
                        <View style={styles.metricsGrid}>
                          <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.totalCalls ?? 0}</Text><Text style={styles.metricLabel}>Calls</Text></View>
                          <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.followUps ?? 0}</Text><Text style={styles.metricLabel}>Follow Ups</Text></View>
                          <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.contactsAdded ?? 0}</Text><Text style={styles.metricLabel}>Contacts</Text></View>
                          <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.googleReviews ?? 0}</Text><Text style={styles.metricLabel}>G-Reviews</Text></View>
                          <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.videoReviews ?? 0}</Text><Text style={styles.metricLabel}>Videos</Text></View>
                        </View>
                        {report.metrics?.digitalWork ? (
                          <View style={styles.digitalWorkBox}>
                            <Text style={styles.digitalWorkTitle}>Digital Work:</Text>
                            <Text style={styles.digitalWorkText}>{report.metrics.digitalWork}</Text>
                          </View>
                        ) : null}
                      </Surface>
                    ))
                  }
                </View>
              ))
            )}
          </View>
        )}
        {/* ── My History (Staff only) ── */}
        {activeSubTab === 'my_history' && (
          <View>
            {loadingMyHistory ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
            ) : myHistoryReports.length === 0 ? (
              <View style={styles.emptyBox}>
                <FileText size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No History Found</Text>
                <Text style={styles.emptyText}>You haven't submitted any daily reports yet.</Text>
              </View>
            ) : (
              myHistoryReports.map(report => (
                <Surface key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Calendar size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.reportStaffName}>{report.date}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.muted }}>{report.branchName}</Text>
                    </View>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>Completed</Text>
                    </View>
                  </View>

                  <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.totalCalls ?? 0}</Text><Text style={styles.metricLabel}>Total Calls</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.followUps ?? 0}</Text><Text style={styles.metricLabel}>Follow Ups</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.contactsAdded ?? 0}</Text><Text style={styles.metricLabel}>Contacts</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.googleReviews ?? 0}</Text><Text style={styles.metricLabel}>G-Reviews</Text></View>
                    <View style={styles.metricBox}><Text style={styles.metricValue}>{report.metrics?.videoReviews ?? 0}</Text><Text style={styles.metricLabel}>Video Revs</Text></View>
                  </View>

                  <View style={styles.digitalWorkBox}>
                    <Text style={styles.digitalWorkTitle}>Digital Work:</Text>
                    <Text style={styles.digitalWorkText}>{report.metrics?.digitalWork || 'N/A'}</Text>
                  </View>
                </Surface>
              ))
            )}
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  tabContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  tabTextActive: { color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2, marginBottom: 16 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', padding: 12, borderRadius: 8, marginBottom: 20, gap: 8 },
  successText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  staffScroll: { marginBottom: 20, flexDirection: 'row' },
  staffChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  staffChipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  staffChipText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  staffChipTextActive: { color: '#fff' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: '#f8fafc' },
  dateText: { marginLeft: 10, fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#f8fafc' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 10, gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  dateSelectorSmall: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  dateTextSmall: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  emptyBox: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 16, elevation: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  emptyText: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  reportCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 12, marginBottom: 16 },
  reportStaffName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  reportTime: { fontSize: 11, color: COLORS.muted, flexDirection: 'row', alignItems: 'center' },
  badgeSuccess: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeSuccessText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metricBox: { flex: 1, minWidth: '30%', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  metricValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
  metricLabel: { fontSize: 9, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  digitalWorkBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  digitalWorkTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  digitalWorkText: { fontSize: 13, color: COLORS.muted, lineHeight: 20 },
});

export default EmployeeDailyReport;
