import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Upload, AlertCircle, Image as ImageIcon, X, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { notifyAllHRs } from '../../utils/notificationService';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  error: '#dc2626',
  warning: '#d97706',
};

const CleaningLockScreen = () => {
  const { userData } = useAuth();
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [existingLogs, setExistingLogs] = useState([]);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    const branchId = userData?.branchId || userData?.branchName;
    if (!branchId) return;

    const todayStr = getTodayStr();
    const q = query(
      collection(db, 'cleaning_logs'),
      where('branchId', '==', branchId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const logs = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.date === todayStr) {
          logs.push({ id: d.id, ...data });
        }
      });
      setExistingLogs(logs);
    }, (err) => {
      console.error('[CleaningLockScreen] logs listener error:', err);
    });

    return () => unsub();
  }, [userData]);

  const pendingLog = existingLogs.find(l => l.status === 'pending' || !l.status);
  const hasPendingSubmission = !!pendingLog;

  const pickImage = async (useCamera = false) => {
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
      const branchId = userData?.branchId || userData?.branchName || 'unknown_branch';
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
        status: 'pending',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Notification to HR (Firestore & Push to HR mobile devices)
      await notifyAllHRs(
        'Cleaning Photos Under Review 🧹',
        `${branchName} uploaded clinic cleaning photos. Please review and accept to unlock branch.`,
        'clinic_cleaning',
        { branchId, branchName }
      );

      setSelectedPhotos([]);
      Alert.alert("Submitted for HR Review", "Photos uploaded successfully! The app will unlock as soon as HR accepts your submission.");
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Failed", "Could not upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const existingPhotoUrls = pendingLog?.photoUrls || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Alert Section */}
        {hasPendingSubmission ? (
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
              <Clock size={48} color="#d97706" />
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
              <Text style={[styles.statusBadgeText, { color: '#b45309' }]}>⌛ PENDING HR APPROVAL</Text>
            </View>
            <Text style={[styles.title, { color: '#d97706' }]}>UNDER HR REVIEW</Text>
            <Text style={styles.subtitle}>
              Your clinic cleaning photos have been submitted. The application is locked until HR reviews and accepts your submission.
            </Text>
          </View>
        ) : (
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <ShieldAlert size={48} color="#16a34a" />
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
              <Text style={[styles.statusBadgeText, { color: '#15803d' }]}>🔒 ACCESS RESTRICTED</Text>
            </View>
            <Text style={[styles.title, { color: '#15803d' }]}>ACCESS BLOCKED</Text>
            <Text style={styles.subtitle}>
              Today is mandatory Clinic Cleaning Day for your branch. Please upload clean clinic photo evidence for HR approval to unlock access.
            </Text>
          </View>
        )}

        {/* Upload Card Container */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>
              {hasPendingSubmission ? 'Submitted Photo Proof' : 'Upload Cleaning Proof'}
            </Text>
            <Text style={styles.sectionSub}>
              {hasPendingSubmission ? 'Photos sent to HR dashboard' : 'Required photo evidence'}
            </Text>
          </View>
          
          {hasPendingSubmission && existingPhotoUrls.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.photosLabel}>
                Submitted Photos ({existingPhotoUrls.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {existingPhotoUrls.map((url, idx) => (
                  <Image key={idx} source={{ uri: url }} style={styles.submittedThumbnail} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Photo Picker Grid */}
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
              <ImageIcon size={26} color={COLORS.secondary} />
              <Text style={styles.addPhotoText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImage(true)}>
              <Camera size={26} color={COLORS.secondary} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </TouchableOpacity>
          </View>

          {/* Submit Action Button */}
          <TouchableOpacity 
            style={[
              styles.submitBtn, 
              hasPendingSubmission ? { backgroundColor: '#d97706', shadowColor: '#d97706' } : { backgroundColor: '#16a34a', shadowColor: '#16a34a' }, 
              (uploading || selectedPhotos.length === 0) && { opacity: 0.6 }
            ]} 
            onPress={handleUpload} 
            disabled={uploading || selectedPhotos.length === 0}
          >
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Upload size={20} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {hasPendingSubmission ? 'Submit Additional Photos' : 'Submit for HR Review'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 28, marginTop: 10 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '900', color: '#15803d', marginBottom: 8, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  cardHeader: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14, marginBottom: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  photosLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  submittedThumbnail: { width: 80, height: 80, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22, justifyContent: 'center' },
  photoContainer: { width: 85, height: 85, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  photoPreview: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(15, 23, 42, 0.7)', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 85, height: 85, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  addPhotoText: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16a34a', paddingVertical: 15, borderRadius: 14, gap: 8, elevation: 4, shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }
});

export default CleaningLockScreen;
