import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Upload, AlertCircle, CheckCircle2, ChevronRight, ArrowLeft, Image as ImageIcon, Calendar, X, Building2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import { notifyAllHRs, notifyBranchReceptionists } from '../../utils/notificationService';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
};

const ClinicCleaningPhotos = ({ navigation }) => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState(userData?.role === 'hr' ? 'view' : 'submit'); // 'submit' or 'view'

  // Submit State
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // View State
  const [viewDate, setViewDate] = useState(new Date());
  const [showViewDatePicker, setShowViewDatePicker] = useState(false);
  const [cleaningData, setCleaningData] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [overrideDate, setOverrideDate] = useState(new Date());
  
  // New HR settings state
  const [branches, setBranches] = useState([]);
  const [branchSettings, setBranchSettings] = useState({});
  const [showOverridePicker, setShowOverridePicker] = useState(false);
  const [overrideBranchId, setOverrideBranchId] = useState(null);

  const getNextCleaningDate = (overrideDateStr) => {
    const getWeekRange = (d) => {
      const date = new Date(d);
      date.setHours(0,0,0,0);
      const day = date.getDay();
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - day);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return { start: sunday, end: saturday };
    };

    const today = new Date();
    today.setHours(0,0,0,0);
    const { start: weekStart, end: weekEnd } = getWeekRange(today);
    
    let targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + 4); // Thursday

    if (overrideDateStr) {
      const oDate = new Date(overrideDateStr);
      oDate.setHours(0,0,0,0);
      if (oDate >= weekStart && oDate <= weekEnd) {
        targetDate = oDate;
      }
    }
    
    return targetDate;
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayS = getTodayStr();
  const [isMandatoryDay, setIsMandatoryDay] = useState(new Date().getDay() === 4);

  useEffect(() => {
    if (userData?.role !== 'hr' && userData?.branchId) {
      const branchId = userData.branchId;
      const unsub = onSnapshot(doc(db, 'branch_settings', branchId), (docSnap) => {
        const overrideStr = docSnap.exists() ? docSnap.data().overrideCleaningDate : null;
        const targetDate = getNextCleaningDate(overrideStr);
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        
        setIsMandatoryDay(targetDateStr === todayS);
      });
      return () => unsub();
    }
  }, [userData?.branchId, userData?.role]);

  useEffect(() => {
    if (userData?.role === 'hr') {
      const fetchBranches = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', '==', 'branch'));
          const snap = await getDocs(q);
          const bList = [];
          snap.forEach(d => bList.push({ id: d.id, ...d.data() }));
          setBranches(bList);
        } catch (err) {
          console.error(err);
        }
      };
      fetchBranches();

      const unsubSettings = onSnapshot(collection(db, 'branch_settings'), (snap) => {
        const s = {};
        snap.forEach(doc => { s[doc.id] = doc.data(); });
        setBranchSettings(s);
      });
      return () => unsubSettings();
    }
  }, [userData?.role]);

  useEffect(() => {
    setLoadingReports(true);
    const d = viewDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let q;
    
    if (userData?.role === 'hr') {
      q = query(collection(db, 'cleaning_logs'), where('date', '==', dateStr));
    } else {
      q = query(
        collection(db, 'cleaning_logs'), 
        where('date', '==', dateStr),
        where('branchName', '==', userData?.branchName || 'Unknown')
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setCleaningData(data);
      setLoadingReports(false);
    }, (err) => {
      console.error(err);
      setLoadingReports(false);
    });

    return () => unsub();
  }, [viewDate, userData?.role, userData?.branchName]);

  const pickImage = async (useCamera = false) => {
    if (!isMandatoryDay) {
      Alert.alert('Upload Blocked', 'You can only upload photos on your assigned mandatory day. Please contact HR for an exception.');
      return;
    }
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert("Permission Required", "Camera permission is needed to take photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert("Permission Required", "Gallery permission is needed to select photos.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          allowsMultipleSelection: true,
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets) {
        setSelectedPhotos(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error("Image pick error:", error);
    }
  };

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedPhotos.length === 0) {
      Alert.alert("No Photos", "Please select or take at least one photo.");
      return;
    }

    setUploading(true);
    try {
      const branchId = userData?.branchId || 'unknown_branch';
      const branchName = userData?.branchName || 'Unknown';
      const todayStr = getTodayStr();
      const uploadedUrls = [];

      for (const photo of selectedPhotos) {
        const blob = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = function() { resolve(xhr.response); };
          xhr.onerror = function(e) { console.log(e); reject(new TypeError("Network request failed")); };
          xhr.responseType = "blob";
          xhr.open("GET", photo.uri, true);
          xhr.send(null);
        });
        
        const ext = photo.uri.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const storageRef = ref(storage, `cleaning_photos/${branchId}/${todayStr}/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(snapshot.ref);
        uploadedUrls.push(url);
      }

      await addDoc(collection(db, 'cleaning_logs'), {
        branchName: branchName,
        branchId: branchId,
        uploadedBy: userData?.uid || 'unknown',
        uploadedByName: userData?.name || 'Unknown Staff',
        date: todayStr,
        photoUrls: uploadedUrls,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await notifyAllHRs(
        'Clinic Cleaning Photos Submitted 🧹',
        `${branchName} uploaded clinic cleaning photos for HR review.`,
        'clinic_cleaning',
        { branchId, branchName }
      );

      setSuccessMsg('Photos uploaded successfully!');
      setSelectedPhotos([]);
      setTimeout(() => setSuccessMsg(''), 4000);
      
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Failed", "Could not upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleOverrideDate = async (event, date) => {
    setShowOverridePicker(false);
    if (event.type === 'set' && date && overrideBranchId !== null) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      try {
        await setDoc(doc(db, 'branch_settings', overrideBranchId), {
          overrideCleaningDate: dateStr,
          updatedAt: serverTimestamp(),
          updatedBy: userData?.name || 'HR'
        }, { merge: true });
        
        const parts = (dateStr || '').split('-');
        const formattedDate = parts.length === 3 ? `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}` : dateStr;

        await notifyBranchReceptionists(
          overrideBranchId,
          'Cleaning Schedule Updated 🧹',
          `HR has set a mandatory clinic cleaning day for your branch on ${formattedDate}.`,
          'schedule_update',
          { dateStr }
        );
        
        Alert.alert("Success", "Schedule updated and push notification sent to branch.");
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to update schedule.");
      }
    }
    setOverrideBranchId(null);
  };

  const handleApproveLog = async (logId, branchId, branchName) => {
    try {
      await updateDoc(doc(db, 'cleaning_logs', logId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: userData?.name || 'HR'
      });

      await notifyBranchReceptionists(
        branchId,
        'Cleaning Photos Approved! 🎉',
        'HR has reviewed and accepted your clinic cleaning photos. Your branch app is unlocked.',
        'cleaning_approved',
        { logId, branchId }
      );

      Alert.alert("Success", `Approved cleaning photos for ${branchName || 'Branch'}. App unlocked!`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to approve cleaning photos.");
    }
  };

  const handleRejectLog = async (logId, branchId, branchName) => {
    try {
      await updateDoc(doc(db, 'cleaning_logs', logId), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: userData?.name || 'HR'
      });

      await notifyBranchReceptionists(
        branchId,
        'Cleaning Photos Rejected ❌',
        'HR requested a new set of clinic cleaning photos. Please re-upload proof.',
        'cleaning_rejected',
        { logId, branchId }
      );

      Alert.alert("Rejected", `Rejected cleaning photos for ${branchName || 'Branch'}.`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to reject cleaning photos.");
    }
  };

  // Render logic for HR view
  const renderHRView = () => {
    const isViewThursday = viewDate.getDay() === 4;
    const viewDateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(viewDate.getDate()).padStart(2, '0')}`;
    
    const branchStatus = branches.map(b => {
      const branchNameNormalized = String(b.name || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();
      const uploads = cleaningData.filter(d => 
        (d.branchId === b.id) || 
        (d.branchName && String(d.branchName).toLowerCase().replace(/\s*branch\s*/i, '').trim() === branchNameNormalized)
      );
      
      const allPhotos = uploads.reduce((acc, curr) => [...acc, ...(curr.photoUrls || [])], []);
      const latestLog = uploads[0];
      const isApproved = latestLog?.status === 'approved';
      const isRejected = latestLog?.status === 'rejected';

      const currentOverride = branchSettings[b.id]?.overrideCleaningDate || '';
      const targetDate = getNextCleaningDate(currentOverride);
      const targetDateStr = targetDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const isBranchMandatory = viewDateStr === `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      
      return {
        id: b.id,
        branchName: b.name,
        uploadedCount: allPhotos.length,
        photos: allPhotos,
        latestLog,
        isApproved,
        isRejected,
        isMandatory: isBranchMandatory,
        targetDateStr
      };
    });

    return (
      <View>
        <Surface style={styles.datePickerCard}>
          <Calendar size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
          <Text style={{ flex: 1, fontWeight: '600', color: COLORS.text }}>Select Date:</Text>
          <TouchableOpacity style={styles.dateSelectorSmall} onPress={() => setShowViewDatePicker(true)}>
            <Text style={styles.dateTextSmall}>{viewDate.toLocaleDateString('en-GB')}</Text>
          </TouchableOpacity>
          {showViewDatePicker && (
            <DateTimePicker
              value={viewDate}
              mode="date"
              display="default"
              onValueChange={(event, date) => {
                setShowViewDatePicker(false);
                if (event.type === 'set' && date) setViewDate(date);
              }}
              onDismiss={() => setShowViewDatePicker(false)}
            />
          )}
        </Surface>

        {isViewThursday && (
          <View style={[styles.infoBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
            <AlertCircle size={20} color="#1d4ed8" />
            <Text style={[styles.infoText, { color: '#1d4ed8', marginLeft: 8 }]}>Mandatory Cleaning Day</Text>
          </View>
        )}

        {showOverridePicker && (
          <DateTimePicker
            value={overrideDate}
            mode="date"
            display="default"
            onValueChange={handleOverrideDate}
            onDismiss={() => { setShowOverridePicker(false); setOverrideBranchId(null); }}
          />
        )}

        {loadingReports ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          branchStatus.map((status, idx) => (
            <Surface key={idx} style={[styles.reportCard, { borderLeftWidth: 4, borderLeftColor: status.isApproved ? COLORS.success : (status.uploadedCount > 0 ? '#f59e0b' : (status.isMandatory ? COLORS.error : '#f59e0b')) }]}>
              <View style={styles.reportHeader}>
                <Building2 size={20} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.reportBranchName}>{status.branchName}</Text>
                <TouchableOpacity 
                  style={{ marginRight: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}
                  onPress={() => { setOverrideBranchId(status.id); setShowOverridePicker(true); }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.secondary, fontWeight: '700' }}>Save Schedule ({status.targetDateStr})</Text>
                </TouchableOpacity>
                {status.isApproved ? (
                  <View style={styles.badgeSuccess}><Text style={styles.badgeSuccessText}>✅ Approved</Text></View>
                ) : status.uploadedCount > 0 ? (
                  <View style={[styles.badgeSuccess, { backgroundColor: '#feefc3' }]}><Text style={[styles.badgeSuccessText, { color: '#b45309' }]}>⌛ Under Review</Text></View>
                ) : (
                  <View style={[styles.badgeSuccess, { backgroundColor: '#fee2e2' }]}><Text style={[styles.badgeSuccessText, { color: '#b91c1c' }]}>Missing</Text></View>
                )}
              </View>

              {status.uploadedCount > 0 && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    {status.photos.map((url, i) => (
                      <Image key={i} source={{ uri: url }} style={styles.galleryImage} />
                    ))}
                  </ScrollView>
                  
                  {status.latestLog && !status.isApproved && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity 
                        style={{ flex: 1, backgroundColor: COLORS.success, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                        onPress={() => handleApproveLog(status.latestLog.id, status.id, status.branchName)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓ Accept & Unlock</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                        onPress={() => handleRejectLog(status.latestLog.id, status.id, status.branchName)}
                      >
                        <Text style={{ color: '#b91c1c', fontWeight: '800', fontSize: 12 }}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </Surface>
          ))
        )}
      </View>
    );
  };

  // Render logic for Receptionist view
  const renderReceptionView = () => {
    return (
      <View>
        {cleaningData.length === 0 ? (
          <View style={styles.emptyBox}>
            <ImageIcon size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No Photos</Text>
            <Text style={styles.emptyText}>No photos uploaded by your branch for this date.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            {cleaningData.map((log) => {
              const uploadDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || Date.now());
              return (
                <Surface key={log.id} style={[styles.reportCard, { borderLeftWidth: 4, borderLeftColor: COLORS.success }]}>
                  <View style={styles.reportHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportBranchName}>{log.branchName || 'Upload Session'}</Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, fontWeight: '500' }}>
                        Uploaded by: {log.uploadedByName || 'Receptionist'}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2, fontWeight: '500' }}>
                        {uploadDate.toLocaleDateString('en-GB')} at {uploadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>{(log.photoUrls || []).length} Photos</Text>
                    </View>
                  </View>
                  
                  {log.photoUrls && log.photoUrls.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
                      {log.photoUrls.map((url, i) => (
                        <Image key={i} source={{ uri: url }} style={styles.galleryImageLarge} />
                      ))}
                    </ScrollView>
                  )}
                </Surface>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cleaning Photos</Text>
      </View>

      <View style={styles.tabContainer}>
        {userData?.role !== 'hr' && (
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'submit' && styles.tabBtnActive]}
            onPress={() => setActiveTab('submit')}
          >
            <Upload size={16} color={activeTab === 'submit' ? '#fff' : COLORS.muted} />
            <Text style={[styles.tabText, activeTab === 'submit' && styles.tabTextActive]}>Upload Photos</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'view' && styles.tabBtnActive]}
          onPress={() => setActiveTab('view')}
        >
          <ImageIcon size={16} color={activeTab === 'view' ? '#fff' : COLORS.muted} />
          <Text style={[styles.tabText, activeTab === 'view' && styles.tabTextActive]}>Photo Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'submit' && userData?.role !== 'hr' && (
          <Surface style={styles.card}>
            {(() => {
              if (cleaningData.length > 0 && isMandatoryDay) {
                // Already uploaded today, but still allow more uploads
                const nextDate = new Date(viewDate);
                nextDate.setDate(nextDate.getDate() + 7);
                const nextDateStr = nextDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <View style={[styles.infoBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', marginBottom: 12 }]}>
                    <CheckCircle2 size={20} color="#10b981" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.infoTitle, { color: '#059669' }]}>Photos Uploaded</Text>
                      <Text style={[styles.infoText, { color: '#047857' }]}>You have successfully uploaded photos for this week (Next: {nextDateStr}). You may upload more photos below if needed.</Text>
                    </View>
                  </View>
                );
              }

              return isMandatoryDay ? (
              <View style={[styles.infoBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <AlertCircle size={20} color="#1d4ed8" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.infoTitle, { color: '#1d4ed8' }]}>Mandatory Upload Today</Text>
                  <Text style={[styles.infoText, { color: '#1e3a8a' }]}>Please ensure the clinic is completely clean and upload clear photos. HR will review these.</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                <AlertCircle size={20} color="#b91c1c" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.infoTitle, { color: '#b91c1c' }]}>Upload Not Allowed Today</Text>
                  <Text style={[styles.infoText, { color: '#7f1d1d' }]}>You can only upload photos on your assigned mandatory day unless HR updates your schedule.</Text>
                </View>
              </View>
            );
            })()}

            {successMsg ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={20} color="#166534" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {isMandatoryDay && (
              <>
                <Text style={styles.sectionTitle}>Select Photos</Text>
                <View style={styles.photoGrid}>
                  {selectedPhotos.map((photo, idx) => (
                    <View key={idx} style={styles.photoContainer}>
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(idx)}>
                        <X size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImage(false)}>
                    <ImageIcon size={24} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImage(true)}>
                    <Camera size={24} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, (uploading || selectedPhotos.length === 0) && { opacity: 0.6 }]} 
                  onPress={handleUpload} 
                  disabled={uploading || selectedPhotos.length === 0}
                >
                  {uploading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Upload size={18} color="#fff" />
                      <Text style={styles.submitBtnText}>Upload {selectedPhotos.length} Photos</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Surface>
        )}

        {activeTab === 'view' && (
          userData?.role === 'hr' ? renderHRView() : (
            <View>

              {loadingReports ? <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} /> : renderReceptionView()}
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  tabContainer: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#fff', borderRadius: 30, borderWidth: 1, borderColor: COLORS.border, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 2 },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.3, elevation: 4 },
  tabText: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  tabTextActive: { color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 16 },
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24, alignItems: 'flex-start' },
  infoTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  infoText: { fontSize: 13, lineHeight: 20 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', padding: 16, borderRadius: 12, marginBottom: 24, gap: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  successText: { color: '#166534', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  photoContainer: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  photoPreview: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  addPhotoBtn: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  addPhotoText: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 6 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, gap: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  datePickerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 20 },
  dateSelectorSmall: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  dateTextSmall: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  emptyBox: { alignItems: 'center', padding: 50, backgroundColor: '#fff', borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 20, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  reportCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16 },
  reportBranchName: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.text },
  badgeSuccess: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  badgeSuccessText: { color: '#166534', fontSize: 12, fontWeight: '800' },
  galleryImage: { width: 90, height: 90, borderRadius: 12, marginRight: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border },
  galleryImageLarge: { width: 160, height: 160, borderRadius: 16, marginRight: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border }
});

export default ClinicCleaningPhotos;
