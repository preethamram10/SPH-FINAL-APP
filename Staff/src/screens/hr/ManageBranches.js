import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, BackHandler } from 'react-native';
import { Text, Surface, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Building2, Clock, Phone, MapPin, Save, Image as ImageIcon, Upload } from 'lucide-react-native';

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
  danger: '#ef4444'
};

const ManageBranches = ({ navigation }) => {
  const { userData } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [timings, setTimings] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'branch'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
      Alert.alert('Error', 'Failed to fetch branch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (selectedBranch) {
        setSelectedBranch(null);
        return true; // prevent default behavior (exiting the screen)
      }
      return false; // use default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [selectedBranch]);

  const selectBranchForEdit = (branch) => {
    setSelectedBranch(branch);
    setTimings(branch.timings || '');
    setAddress(branch.address || '');
    setLandmark(branch.landmark || '');
    setPhone(branch.phone || '');
    setImageUrl(branch.imageUrl || branch.image || '');
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploadingImage(true);
        const { uri } = result.assets[0];
        
        // Fetch image as blob
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Upload to storage
        const fileName = `branch_images/${selectedBranch.id}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, blob);
        
        // Get URL
        const downloadURL = await getDownloadURL(storageRef);
        setImageUrl(downloadURL);
        Alert.alert('Success', 'Image uploaded successfully. Tap Save to apply.');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'users', selectedBranch.id);
      await updateDoc(docRef, {
        timings: timings.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        phone: phone.trim(),
        imageUrl: imageUrl.trim()
      });
      Alert.alert('Success', 'Clinic branch details updated successfully!');
      setSelectedBranch(null);
      fetchBranches();
    } catch (error) {
      console.error('Error updating branch:', error);
      Alert.alert('Error', 'Failed to update branch details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (selectedBranch) {
              setSelectedBranch(null);
            } else {
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard');
            }
          }} 
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectedBranch ? `Edit: ${selectedBranch.name}` : 'Manage Branches'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
          <Text style={styles.loadingText}>Loading branch details...</Text>
        </View>
      ) : selectedBranch ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formHeader}>
              <View style={styles.titleAccent} />
              <Building2 size={22} color={COLORS.secondary} />
              <Text style={styles.branchTitle}>{selectedBranch.name}</Text>
            </View>

            {/* Image Upload Section */}
            <View style={styles.imageUploadCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <ImageIcon size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Branch Display Image</Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {imageUrl ? (
                  <Surface style={{ borderRadius: 12, elevation: 1, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                    <Image source={{ uri: imageUrl }} style={{ width: 100, height: 80 }} />
                  </Surface>
                ) : (
                  <View style={{ width: 100, height: 80, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>No Image Set</Text>
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleImageUpload}
                    disabled={uploadingImage}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#eff6ff',
                      borderColor: '#dbeafe',
                      borderWidth: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      gap: 6
                    }}
                  >
                    <Upload size={14} color={COLORS.secondary} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.secondary }}>
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 8, lineHeight: 14, fontStyle: 'italic' }}>
                    Shows in Patient App "Our Branches" section
                  </Text>
                </View>
              </View>
            </View>

            <TextInput
              label="Operating Timings"
              value={timings}
              onChangeText={setTimings}
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14 }}
              style={styles.input}
              placeholder="e.g. 10:00AM - 8:30PM"
              left={<TextInput.Icon icon={() => <Clock size={18} color={COLORS.secondary} />} />}
            />

            <TextInput
              label="Contact Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14 }}
              style={styles.input}
              placeholder="10-digit number"
              left={<TextInput.Icon icon={() => <Phone size={18} color={COLORS.secondary} />} />}
            />

            <TextInput
              label="Clinic Address"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              multiline
              numberOfLines={3}
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14 }}
              style={[styles.input, { height: 90 }]}
              placeholder="Full address of the clinic branch"
              left={<TextInput.Icon icon={() => <MapPin size={18} color={COLORS.secondary} />} />}
            />

            <TextInput
              label="Landmark"
              value={landmark}
              onChangeText={setLandmark}
              mode="outlined"
              activeOutlineColor={COLORS.secondary}
              outlineColor={COLORS.border}
              outlineStyle={{ borderRadius: 14 }}
              style={styles.input}
              placeholder="e.g. Near Metro Station"
              left={<TextInput.Icon icon={() => <MapPin size={18} color={COLORS.secondary} />} />}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={saving}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.secondary,
                paddingVertical: 14,
                borderRadius: 14,
                gap: 8,
                marginTop: 10,
                elevation: 3,
                shadowColor: COLORS.secondary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Save size={18} color="white" />
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Save Details</Text>
                </>
              )}
            </TouchableOpacity>
          </Surface>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {branches.map(branch => {
            const hasImage = branch.imageUrl || branch.image;
            return (
              <TouchableOpacity 
                key={branch.id} 
                onPress={() => selectBranchForEdit(branch)}
                activeOpacity={0.7}
              >
                <Surface style={styles.branchCard} elevation={1}>
                  <View style={styles.cardHeader}>
                    <Building2 size={20} color={COLORS.secondary} />
                    <Text style={styles.branchName}>{branch.name}</Text>
                    
                    {/* Image Status Pill Badge */}
                    <View style={[styles.badge, { backgroundColor: hasImage ? '#e0f2fe' : '#fffbeb' }]}>
                      <Text style={[styles.badgeText, { color: hasImage ? '#0369a1' : '#b45309' }]}>
                        {hasImage ? 'DISPLAY IMAGE' : 'NO IMAGE'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Clock size={14} color={COLORS.muted} style={styles.infoIcon} />
                    <Text style={styles.infoText}>Timings: {branch.timings || 'Not Set'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Phone size={14} color={COLORS.muted} style={styles.infoIcon} />
                    <Text style={styles.infoText}>Phone: {branch.phone || 'Not Set'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <MapPin size={14} color={COLORS.muted} style={styles.infoIcon} />
                    <Text style={styles.infoText} numberOfLines={2}>
                      Address: {branch.address || 'Not Set'}
                    </Text>
                  </View>
                </Surface>
              </TouchableOpacity>
            );
          })}
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
    borderBottomColor: COLORS.border
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.muted, fontSize: 14 },
  listContent: { padding: 16 },
  branchCard: { 
    padding: 16, 
    borderRadius: 20, 
    backgroundColor: COLORS.white, 
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2 
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  branchName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoIcon: { marginRight: 8, opacity: 0.7 },
  infoText: { fontSize: 12, color: COLORS.text, flex: 1, fontWeight: '500' },
  scrollContent: { padding: 16 },
  formCard: { 
    padding: 20, 
    borderRadius: 24, 
    backgroundColor: COLORS.white, 
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2 
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  titleAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: COLORS.secondary },
  branchTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  imageUploadCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background
  },
  input: { marginBottom: 14, backgroundColor: COLORS.white },
  saveBtn: { marginTop: 16, borderRadius: 12 },
  btnContent: { paddingVertical: 10 }
});

export default ManageBranches;
