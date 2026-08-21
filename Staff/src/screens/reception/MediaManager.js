import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Dimensions, Modal, TextInput as RNTextInput, FlatList, Image
} from 'react-native';
import { Text, Surface, ActivityIndicator, Button, Portal, Dialog } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, storage, auth } from '../../firebase';
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Plus, Trash2, Folder, FileVideo, ImageIcon,
  FolderOpen, Upload, X
} from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export default function MediaManager({ navigation }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Modals
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState('video');

  // Fetch folders (global only - no patientPhone)
  useEffect(() => {
    const q = query(
      collection(db, 'media_folders'),
      where('patientPhone', '==', null)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setFolders(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching folders:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch items inside selected folder
  useEffect(() => {
    if (!selectedFolder) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    const q = query(
      collection(db, 'media_items'),
      where('folderId', '==', selectedFolder.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setItems(list);
      setItemsLoading(false);
    }, (err) => {
      console.error("Error fetching items:", err);
      setItemsLoading(false);
    });

    return () => unsub();
  }, [selectedFolder]);

  // Create global folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Required', 'Please enter a folder name.');
      return;
    }
    try {
      await addDoc(collection(db, 'media_folders'), {
        name: newFolderName.trim(),
        patientPhone: null, // global folder
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'Receptionist'
      });
      setNewFolderName('');
      setFolderModalVisible(false);
      Alert.alert('Success', 'Folder created successfully.');
    } catch (err) {
      console.error("Error creating folder:", err);
      Alert.alert('Error', 'Failed to create folder.');
    }
  };

  // Delete folder and all items inside it
  const handleDeleteFolder = (folder) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}" and all of its media files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all items inside folder to delete from storage
              const q = query(collection(db, 'media_items'), where('folderId', '==', folder.id));
              const snap = await getDocs(q);

              for (const docSnap of snap.docs) {
                const itemData = docSnap.data();
                if (itemData.storagePath) {
                  const storageRef = ref(storage, itemData.storagePath);
                  await deleteObject(storageRef).catch(e => console.warn("Delete storage file failed:", e));
                }
                await deleteDoc(doc(db, 'media_items', docSnap.id));
              }

              // Delete folder doc
              await deleteDoc(doc(db, 'media_folders', folder.id));

              // If currently selected, clear selection
              if (selectedFolder?.id === folder.id) {
                setSelectedFolder(null);
              }
              Alert.alert('Success', 'Folder and its contents deleted.');
            } catch (err) {
              console.error("Error deleting folder:", err);
              Alert.alert('Error', 'Failed to delete folder.');
            }
          }
        }
      ]
    );
  };

  // Upload Video/Image File directly
  const handlePickAndUpload = async () => {
    if (!selectedFolder) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to upload media.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // allow videos and images
        quality: 0.8,
      });

      if (result.canceled) return;

      setUploading(true);
      setUploadProgress('Preparing file...');

      const asset = result.assets[0];
      const mediaUri = asset.uri;
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      const fileExt = mediaUri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
      const fileName = `media_${Date.now()}.${fileExt}`;
      const storagePath = `media_library/${selectedFolder.id}/${fileName}`;

      // Convert local uri to Blob
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) {
          console.error("Blob conversion error:", e);
          reject(new TypeError('File conversion failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', mediaUri, true);
        xhr.send(null);
      });

      setUploadProgress('Uploading to Firebase Storage...');
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, blob);

      setUploadProgress('Generating link...');
      const downloadUrl = await getDownloadURL(fileRef);

      // Save item to firestore
      await addDoc(collection(db, 'media_items'), {
        folderId: selectedFolder.id,
        title: asset.fileName || fileName,
        type: mediaType,
        url: downloadUrl,
        storagePath: storagePath,
        createdAt: serverTimestamp()
      });

      Alert.alert('Success', 'File uploaded successfully.');
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload media file.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // Add YouTube / Instagram or other URL links directly
  const handleAddLink = async () => {
    if (!selectedFolder) return;
    if (!linkUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL link.');
      return;
    }

    let cleanUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let titleToSave = linkTitle.trim();
    if (!titleToSave) {
      try {
        const hostname = cleanUrl.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
        titleToSave = hostname ? `${hostname.charAt(0).toUpperCase() + hostname.slice(1)} Link` : 'Shared Link';
      } catch (e) {
        titleToSave = 'Shared Link';
      }
    }

    try {
      setUploading(true);
      setUploadProgress('Saving link...');
      await addDoc(collection(db, 'media_items'), {
        folderId: selectedFolder.id,
        title: titleToSave,
        type: linkType,
        url: cleanUrl,
        createdAt: serverTimestamp()
      });
      Alert.alert('Success', 'Media link added successfully.');
      setLinkModalVisible(false);
      setLinkTitle('');
      setLinkUrl('');
    } catch (err) {
      console.error("Save link error:", err);
      Alert.alert('Error', 'Failed to save link.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // Delete media item
  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this media file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.storagePath) {
                const storageRef = ref(storage, item.storagePath);
                await deleteObject(storageRef).catch(e => console.warn("Failed to delete item storage file:", e));
              }
              await deleteDoc(doc(db, 'media_items', item.id));
              Alert.alert('Success', 'Media item deleted.');
            } catch (err) {
              console.error("Error deleting item:", err);
              Alert.alert('Error', 'Failed to delete item.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => selectedFolder ? setSelectedFolder(null) : navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectedFolder ? selectedFolder.name : 'Media Manager'}
        </Text>
        {!selectedFolder && (
          <TouchableOpacity onPress={() => setFolderModalVisible(true)} style={styles.headerActionBtn}>
            <Plus size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      ) : !selectedFolder ? (
        // Folders List View
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Folder size={48} color={COLORS.muted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No media folders created yet.</Text>
              <Button mode="contained" onPress={() => setFolderModalVisible(true)} style={styles.createBtn} color={COLORS.secondary}>
                Create Folder
              </Button>
            </View>
          }
          renderItem={({ item }) => (
            <Surface style={styles.folderCard}>
              <TouchableOpacity style={styles.folderClick} onPress={() => setSelectedFolder(item)}>
                <FolderOpen size={24} color={COLORS.secondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.folderName}>{item.name}</Text>
                  <Text style={styles.folderSub}>Global Folder</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteFolder(item)} style={styles.deleteBtn}>
                <Trash2 size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </Surface>
          )}
        />
      ) : (
        // Folder Items View
        <View style={{ flex: 1 }}>
          <View style={styles.folderHeaderActions}>
            <Button
              mode="contained"
              icon={({ size, color }) => <Upload size={16} color={color} />}
              onPress={handlePickAndUpload}
              disabled={uploading}
              style={{ backgroundColor: COLORS.secondary, flex: 1, marginRight: 8 }}
              labelStyle={{ fontSize: 11 }}
            >
              Upload File
            </Button>
            <Button
              mode="contained"
              icon={({ size, color }) => <Plus size={16} color={color} />}
              onPress={() => setLinkModalVisible(true)}
              disabled={uploading}
              style={{ backgroundColor: COLORS.primary, flex: 1 }}
              labelStyle={{ fontSize: 11 }}
            >
              Add Link
            </Button>
          </View>

          {uploading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator color={COLORS.primary} size="small" style={{ marginRight: 8 }} />
              <Text style={styles.progressText}>{uploadProgress}</Text>
            </View>
          )}

          {itemsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.secondary} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <FileVideo size={48} color={COLORS.muted} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No videos or images uploaded yet.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Surface style={styles.itemCard}>
                  <View style={styles.itemThumb}>
                    {item.type === 'video' ? (
                      <FileVideo size={24} color={COLORS.secondary} />
                    ) : (
                      <ImageIcon size={24} color={COLORS.primary} />
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>{item.type.toUpperCase()} • Direct Upload</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.deleteBtn}>
                    <Trash2 size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </Surface>
              )}
            />
          )}
        </View>
      )}

      {/* Create Folder Modal */}
      <Modal visible={folderModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBg}>
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Media Folder</Text>
              <TouchableOpacity onPress={() => setFolderModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <RNTextInput
              style={styles.input}
              placeholder="e.g. Diabetes Tips"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setFolderModalVisible(false)} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleCreateFolder} style={{ backgroundColor: COLORS.secondary }}>
                Create
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>

      {/* Add Link Modal */}
      <Modal visible={linkModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBg}>
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Media Link</Text>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 6 }}>LINK TITLE (OPTIONAL):</Text>
            <RNTextInput
              style={styles.input}
              placeholder="e.g. Sinusitis Diet Chart Video (Optional)"
              value={linkTitle}
              onChangeText={setLinkTitle}
              placeholderTextColor="#94a3b8"
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 6 }}>URL LINK (YouTube / Instagram):</Text>
            <RNTextInput
              style={styles.input}
              placeholder="e.g. https://youtube.com/watch?v=..."
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setLinkModalVisible(false)} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleAddLink} style={{ backgroundColor: COLORS.secondary }}>
                Save Link
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
    marginLeft: 12,
  },
  headerActionBtn: {
    backgroundColor: COLORS.secondary,
    padding: 8,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  createBtn: {
    paddingHorizontal: 8,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  folderClick: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  folderSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  folderHeaderActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  progressText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
