import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Keyboard } from 'react-native';
import { Text, Surface, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Trash2, Plus, Play, Info, CheckCircle2 } from 'lucide-react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';

// Custom SVG icons for brand icons
const YoutubeIcon = ({ size = 24, color = '#ff0000', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <Path d="m10 15 5-3-5-3Z" fill={color} stroke={color} />
  </Svg>
);
const InstagramIcon = ({ size = 24, color = '#e4405f', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <Line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </Svg>
);
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b'
};

const ManageVideos = ({ navigation }) => {
  const { userData } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [titleFetched, setTitleFetched] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState(null); 
  const fetchTitleTimer = useRef(null);

  const detectPlatform = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    return null;
  };

  const fetchTitleFromUrl = async (url) => {
    const platform = detectPlatform(url);
    setDetectedPlatform(platform);

    if (!platform || url.trim().length < 15) {
      setTitle('');
      setTitleFetched(false);
      return;
    }

    setFetchingTitle(true);
    setTitleFetched(false);
    try {
      let oEmbedUrl = '';
      if (platform === 'youtube') {
        oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`;
      } else if (platform === 'instagram') {
        oEmbedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url.trim())}&format=json`;
      }

      const response = await fetch(oEmbedUrl);
      if (response.ok) {
        const data = await response.json();
        const fetchedTitle = data.title || data.author_name || '';
        if (fetchedTitle) {
          setTitle(fetchedTitle);
          setTitleFetched(true);
        } else {
          setTitle('');
        }
      } else {
        setTitle('');
      }
    } catch (e) {
      setTitle('');
    } finally {
      setFetchingTitle(false);
    }
  };

  const handleUrlChange = (text) => {
    setVideoUrl(text);
    setTitleFetched(false);
    setDetectedPlatform(detectPlatform(text));

    if (fetchTitleTimer.current) clearTimeout(fetchTitleTimer.current);
    fetchTitleTimer.current = setTimeout(() => {
      fetchTitleFromUrl(text);
    }, 700);
  };

  // Fetch videos in real-time
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(snap => {
        list.push({ id: snap.id, ...snap.data() });
      });
      setVideos(list);
      setFetching(false);
    }, (error) => {
      console.error("Error fetching videos:", error);
      setFetching(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddVideo = async () => {
    if (!videoUrl.trim()) {
      Alert.alert('Missing URL', 'Please paste a YouTube or Instagram video link.');
      return;
    }

    const url = videoUrl.trim();
    const platform = detectPlatform(url);

    if (!platform) {
      Alert.alert('Invalid URL', 'Please enter a valid YouTube or Instagram video link.');
      return;
    }

    const finalTitle = title.trim() || (platform === 'youtube' ? 'YouTube Video' : 'Instagram Reel');

    setLoading(true);
    try {
      await addDoc(collection(db, 'videos'), {
        title: finalTitle,
        url: url,
        type: platform,
        createdAt: serverTimestamp(),
        createdBy: userData?.name || 'Administrator'
      });

      setTitle('');
      setVideoUrl('');
      setTitleFetched(false);
      setDetectedPlatform(null);
      Alert.alert('✅ Published!', 'Video link is now live in the Patient App!');
    } catch (error) {
      console.error("Error adding video:", error);
      Alert.alert('Error', 'Failed to publish video link.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = (video) => {
    Alert.alert(
      'Delete Video Link',
      `Are you sure you want to delete "${video.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'videos', video.id));
              Alert.alert('Success', 'Video deleted.');
            } catch (error) {
              console.error("Error deleting video:", error);
              Alert.alert('Error', 'Failed to delete video.');
            }
          }
        }
      ]
    );
  };

  const activeColor = detectedPlatform === 'youtube' ? '#ff0000' : detectedPlatform === 'instagram' ? '#e4405f' : COLORS.secondary;

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
        <Text style={styles.headerTitle}>Manage Videos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Form Card */}
        <Surface style={styles.formCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={[styles.titleAccent, { backgroundColor: activeColor }]} />
            <Text style={styles.sectionLabel}>Add New Video Link</Text>
          </View>

          {/* Step 1 — URL */}
          <View style={styles.urlRow}>
            <View style={[styles.platformBadgeSmall, detectedPlatform && { borderColor: activeColor }]}>
              {detectedPlatform === 'youtube' ? (
                <YoutubeIcon size={20} color="#ff0000" />
              ) : detectedPlatform === 'instagram' ? (
                <InstagramIcon size={20} color="#e4405f" />
              ) : (
                <Info size={18} color={COLORS.muted} />
              )}
            </View>
            <TextInput
              mode="outlined"
              label="Paste YouTube or Instagram URL"
              placeholder="https://youtube.com/... or https://instagram.com/..."
              value={videoUrl}
              onChangeText={handleUrlChange}
              style={[styles.input, { flex: 1 }]}
              outlineColor={COLORS.border}
              activeOutlineColor={activeColor}
              outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Auto-fetch status pill */}
          {videoUrl.trim().length > 5 && (
            <View style={styles.statusPill}>
              {fetchingTitle ? (
                <>
                  <ActivityIndicator size={12} color={COLORS.secondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.statusPillText, { color: COLORS.secondary }]}>Fetching title from video...</Text>
                </>
              ) : titleFetched ? (
                <>
                  <CheckCircle2 size={13} color="#10b981" style={{ marginRight: 5 }} />
                  <Text style={[styles.statusPillText, { color: '#10b981' }]}>Title fetched automatically ✓</Text>
                </>
              ) : detectedPlatform ? (
                <Text style={[styles.statusPillText, { color: COLORS.warning }]}>⚠ Could not auto-fetch — you can edit the title below</Text>
              ) : (
                <Text style={[styles.statusPillText, { color: COLORS.danger }]}>✗ Unsupported URL — use YouTube or Instagram</Text>
              )}
            </View>
          )}

          {/* Step 2 — Title (auto-filled, editable) */}
          {videoUrl.trim().length > 5 && (
            <TextInput
              mode="outlined"
              label="Video Title"
              placeholder={fetchingTitle ? 'Fetching...' : 'Enter title manually if not auto-filled'}
              value={title}
              onChangeText={(t) => { setTitle(t); setTitleFetched(false); }}
              style={[styles.input, { marginTop: 4 }]}
              outlineColor={titleFetched ? '#10b981' : COLORS.border}
              activeOutlineColor={activeColor}
              outlineStyle={{ borderRadius: 14, borderWidth: 1 }}
              right={
                fetchingTitle
                  ? <TextInput.Icon icon={() => <ActivityIndicator size={14} color={COLORS.secondary} />} />
                  : titleFetched
                    ? <TextInput.Icon icon={() => <CheckCircle2 size={14} color="#10b981" />} />
                    : null
              }
            />
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddVideo}
            disabled={loading || !videoUrl.trim() || !detectedPlatform}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeColor,
              paddingVertical: 14,
              borderRadius: 14,
              gap: 8,
              marginTop: 16,
              elevation: 3,
              shadowColor: activeColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              opacity: (loading || !videoUrl.trim() || !detectedPlatform) ? 0.6 : 1
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Plus size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Publish to Patient App</Text>
              </>
            )}
          </TouchableOpacity>
        </Surface>

        {/* Live List Title */}
        <Text style={styles.sectionTitle}>Active Videos on Patient App ({videos.length})</Text>

        {fetching ? (
          <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 20 }} />
        ) : videos.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={1}>
            <Info size={24} color={COLORS.muted} />
            <Text style={styles.emptyText}>No videos published yet.</Text>
            <Text style={styles.emptySubText}>Add YouTube/Instagram links above to display them live in the patient app.</Text>
          </Surface>
        ) : (
          videos.map((video) => {
            const isYT = video.type === 'youtube';
            const platformColor = isYT ? '#ff0000' : '#e4405f';
            return (
              <Surface key={video.id} style={[styles.videoCard, { borderLeftColor: platformColor }]} elevation={1}>
                <View style={styles.videoHeader}>
                  <View style={[styles.platformIcon, { backgroundColor: isYT ? '#ff000010' : '#e4405f10' }]}>
                    {isYT ? (
                      <YoutubeIcon size={20} color="#ff0000" />
                    ) : (
                      <InstagramIcon size={20} color="#e4405f" />
                    )}
                  </View>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                    <Text style={styles.videoType}>
                      {isYT ? 'YouTube Video' : 'Instagram Post/Reel'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.videoActions}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}
                    onPress={() => Linking.openURL(video.url)}
                  >
                    <Play size={13} color={COLORS.secondary} />
                    <Text style={[styles.actionBtnText, { color: COLORS.secondary }]}>Preview</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.actionBtn, { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' }]}
                    onPress={() => handleDeleteVideo(video)}
                  >
                    <Trash2 size={13} color={COLORS.danger} />
                    <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Surface>
            );
          })
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
    borderBottomColor: COLORS.border
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: 16 },
  formCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  titleAccent: { width: 4, height: 16, borderRadius: 2, backgroundColor: COLORS.secondary },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  platformBadgeSmall: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  input: { backgroundColor: COLORS.white, height: 46 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyCard: {
    padding: 30,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySubText: { fontSize: 12, color: COLORS.muted, marginTop: 4, textAlign: 'center', lineHeight: 18 },
  videoCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  videoHeader: { flexDirection: 'row', alignItems: 'center' },
  platformIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  videoInfo: { flex: 1, marginLeft: 12, gap: 2 },
  videoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  videoType: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  videoActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' }
});

export default ManageVideos;
