import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Keyboard } from 'react-native';
import { Text, Surface, TextInput, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};
import { db } from '../../firebase';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Image as ImageIcon, Check, Sliders, Layout, RefreshCw, Upload, Eye } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

const ManageBanners = ({ navigation }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Selector choices
  const bannerTypes = [
    { 
      id: 'home', 
      label: 'Main Home Banner', 
      sizeInfo: 'Recommended Size: 350 x 160 px (Aspect Ratio 35:16)',
      placeholder: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'doctors', 
      label: 'Doctors List Banner', 
      sizeInfo: 'Recommended Size: 350 x 120 px (Aspect Ratio 35:12)',
      placeholder: 'https://images.unsplash.com/photo-1559839734-2b71f153678e?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'booking', 
      label: 'Booking Page Banner', 
      sizeInfo: 'Recommended Size: 350 x 120 px (Aspect Ratio 35:12)',
      placeholder: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800'
    }
  ];

  const [selectedType, setSelectedType] = useState(bannerTypes[0]);
  const [customUrl, setCustomUrl] = useState('');

  // Curated premium presets
  const presets = {
    home: [
      { name: 'Immunology Campaign', url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800' },
      { name: 'Chronic Disease Camp', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800' },
      { name: 'Holistic Welness Drive', url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800' }
    ],
    doctors: [
      { name: 'Top Physicians Banner', url: 'https://images.unsplash.com/photo-1559839734-2b71f153678e?auto=format&fit=crop&q=80&w=800' },
      { name: 'Expert Consultations', url: 'https://images.unsplash.com/photo-1579684389782-64d84b5e902a?auto=format&fit=crop&q=80&w=800' }
    ],
    booking: [
      { name: 'Easy Appointment Banner', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800' },
      { name: 'Care Consultation Info', url: 'https://images.unsplash.com/photo-1631217818202-90f4e77aa6ad?auto=format&fit=crop&q=80&w=800' }
    ]
  };

  useEffect(() => {
    // Listen to current banner values for the selected type
    setLoading(true);
    const docRef = doc(db, 'banners', selectedType.id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveBanner(data);
        setCustomUrl(data.imageUrl);
      } else {
        setActiveBanner(null);
        setCustomUrl('');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error reading banner:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedType]);

  const handlePublish = async () => {
    const urlToSave = customUrl.trim();
    if (!urlToSave) {
      Alert.alert('Missing Info', 'Please input or choose a banner image URL.');
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, 'banners', selectedType.id);
      await setDoc(docRef, {
        page: selectedType.id,
        imageUrl: urlToSave,
        sizeInfo: selectedType.sizeInfo,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.name || 'Administrator'
      });
      Alert.alert('Success', `${selectedType.label} updated successfully for all patient apps!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to publish the new banner.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToPlaceholder = () => {
    setCustomUrl(selectedType.placeholder);
  };

  return (
    <SafeAreaView style={styles.container}>
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
          <ChevronLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Banner Manager</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Selector Dropdown */}
        <Text style={styles.sectionLabel}>Target Screen Layout</Text>
        <TouchableOpacity 
          style={styles.dropdownSelector}
          onPress={() => setDropdownOpen(true)}
        >
          <Layout size={18} color={COLORS.secondary} />
          <Text style={styles.dropdownSelectedText}>{selectedType.label}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Selected Banner Info Banner */}
        <Surface style={styles.infoCard}>
          <Text style={styles.infoTitle}>{selectedType.sizeInfo}</Text>
          <Text style={styles.infoSubtitle}>All changes will reflect live on patient applications instantly.</Text>
        </Surface>

        {/* Live Preview Block */}
        <Text style={styles.sectionLabel}>Live Patient App Preview</Text>
        <Surface style={styles.previewContainer}>
          {customUrl ? (
            <Image 
              source={{ uri: customUrl }} 
              style={[
                styles.previewImg, 
                selectedType.id === 'home' ? { aspectRatio: 35/16 } : { aspectRatio: 35/12 }
              ]} 
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <ImageIcon size={32} color="#94a3b8" />
              <Text style={styles.previewPlaceholderText}>No Image Banner Selected</Text>
            </View>
          )}
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE SYNC</Text>
          </View>
        </Surface>

        {/* Input URL Details */}
        <Text style={styles.sectionLabel}>Banner Asset URL</Text>
        <TextInput
          mode="outlined"
          placeholder="Paste high-res banner image URL here..."
          value={customUrl}
          onChangeText={setCustomUrl}
          style={styles.urlInput}
          outlineColor="#cbd5e1"
          activeOutlineColor={COLORS.secondary}
          textColor="#1e293b"
          right={<TextInput.Icon icon={() => <RefreshCw size={16} color="#94a3b8" onPress={handleResetToPlaceholder} />} />}
        />

        {/* Curated Presets Selection */}
        <Text style={styles.sectionLabel}>Quick Curated Designs Gallery</Text>
        <View style={styles.presetGrid}>
          {presets[selectedType.id].map((preset, idx) => (
            <TouchableOpacity 
              key={idx}
              style={[styles.presetCard, customUrl === preset.url && styles.presetCardActive]}
              onPress={() => setCustomUrl(preset.url)}
            >
              <Image source={{ uri: preset.url }} style={styles.presetThumbnail} />
              <View style={styles.presetInfo}>
                <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
                {customUrl === preset.url && <Check size={12} color={COLORS.secondary} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Publisher */}
        <Button 
          mode="contained"
          onPress={handlePublish}
          loading={loading}
          disabled={loading}
          buttonColor={COLORS.secondary}
          style={styles.publishBtn}
          labelStyle={styles.publishBtnText}
          icon={({ size, color }) => <Upload size={size} color={color} />}
        >
          Publish Live Banner
        </Button>

        {activeBanner && (
          <Text style={styles.updatedMeta}>
            Last updated by {activeBanner.updatedBy}
          </Text>
        )}
      </ScrollView>

      {/* Target Screen Dropdown Modal */}
      <Modal
        visible={dropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setDropdownOpen(false)}
        >
          <Surface style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Select Banner Target Page</Text>
            <Divider style={{ marginVertical: 10 }} />
            {bannerTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.dropdownOption, selectedType.id === type.id && styles.dropdownOptionActive]}
                onPress={() => {
                  setSelectedType(type);
                  setDropdownOpen(false);
                }}
              >
                <Layout size={16} color={selectedType.id === type.id ? COLORS.secondary : '#64748b'} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.dropdownOptionText, selectedType.id === type.id && { color: COLORS.secondary, fontWeight: '800' }]}>
                    {type.label}
                  </Text>
                  <Text style={styles.dropdownOptionSub}>{type.sizeInfo}</Text>
                </View>
                {selectedType.id === type.id && <Check size={16} color={COLORS.secondary} />}
              </TouchableOpacity>
            ))}
          </Surface>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  scrollContent: { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    gap: 12
  },
  dropdownSelectedText: { fontSize: 14, fontWeight: '800', color: '#1e293b', flex: 1 },
  dropdownArrow: { fontSize: 10, color: '#64748b' },
  infoCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 12
  },
  infoTitle: { fontSize: 12, fontWeight: '800', color: COLORS.secondary },
  infoSubtitle: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' },
  previewContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    position: 'relative'
  },
  previewImg: { width: '100%', height: undefined },
  previewPlaceholder: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  previewPlaceholderText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  liveIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15,23,42,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveLabel: { fontSize: 9, fontWeight: '800', color: '#10b981' },
  urlInput: { backgroundColor: '#fff', marginBottom: 12 },
  presetGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  presetCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10
  },
  presetCardActive: { borderColor: COLORS.secondary, borderWidth: 1.5 },
  presetThumbnail: { width: '100%', height: 70 },
  presetInfo: { padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  presetName: { fontSize: 11, fontWeight: '700', color: '#334155', flex: 1 },
  publishBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 6 },
  publishBtnText: { fontSize: 14, fontWeight: '800' },
  updatedMeta: { textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 12, fontWeight: '600' },

  // Dropdown Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dropdownModalContent: { width: '100%', borderRadius: 20, backgroundColor: '#fff', padding: 20, elevation: 24 },
  dropdownModalTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8 },
  dropdownOptionActive: { backgroundColor: '#f0f9ff' },
  dropdownOptionText: { fontSize: 14, color: '#334155', fontWeight: '700' },
  dropdownOptionSub: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' }
});

export default ManageBanners;
