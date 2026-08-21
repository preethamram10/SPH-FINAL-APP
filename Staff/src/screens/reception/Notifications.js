import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, ActivityIndicator, IconButton } from 'react-native-paper';
import { ChevronLeft, Bell, Calendar, FileText, CheckCircle, XCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, deleteDoc, onSnapshot, limit } from 'firebase/firestore';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#ffffff',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  danger: '#ef4444',
  unread: '#eff6ff'
};

const getTime = (n) => {
  if (n.createdAt?.toDate) return n.createdAt.toDate().getTime();
  if (n.timestamp?.toDate) return n.timestamp.toDate().getTime();
  if (n.createdAt?.seconds) return n.createdAt.seconds * 1000;
  if (n.timestamp?.seconds) return n.timestamp.seconds * 1000;
  if (n.createdAt) {
    const t = new Date(n.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (n.timestamp) {
    const t = new Date(n.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

const formatNotificationTime = (n) => {
  const timeMs = getTime(n);
  if (!timeMs) return 'Just now';
  const d = new Date(timeMs);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} • ${timeStr}`;
};

const Notifications = ({ navigation }) => {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const userIds = [user.uid];
    if (userData?.id && userData.id !== user.uid) {
      userIds.push(userData.id);
    }

    const qNotifications = query(collection(db, 'notifications'), limit(150));
    const unsub = onSnapshot(qNotifications, (snapshot) => {
      const data = [];
      const userRole = String(userData?.role || '').toLowerCase();
      const userBranchNorm = String(userData?.branchId || userData?.branchName || userData?.branch || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const targetUid = d.userId;
        const targetRole = String(d.targetRole || '').toLowerCase();
        const targetBranch = String(d.branchId || '').toLowerCase().replace(/\s*branch\s*/i, '').trim();

        const isForUser = userIds.includes(targetUid);
        const isForRole = targetRole && userRole.includes(targetRole);
        const isForBranch = targetBranch && (targetBranch === userBranchNorm || userBranchNorm.includes(targetBranch));

        if (isForUser || isForRole || isForBranch) {
          data.push({ id: docSnap.id, ...d });
        }
      });

      // Sort by timestamp descending (newest on top)
      data.sort((a, b) => getTime(b) - getTime(a));
      setNotifications(data.slice(0, 30));
      setLoading(false);
    }, (error) => {
      console.error('Error listening to notifications:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [user, userData]);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.isRead);
      if (unreadList.length === 0) return;
      await Promise.all(
        unreadList.map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }))
      );
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity onPress={() => markAsRead(item.id)} activeOpacity={0.7}>
        <Surface style={[styles.card, !item.isRead && styles.unreadCard]}>
          <View style={styles.content}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {!item.isRead && (
                <TouchableOpacity
                  onPress={() => markAsRead(item.id)}
                  style={styles.markReadBtn}
                  activeOpacity={0.6}
                >
                  <Text style={styles.markReadText}>Mark as read</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.body}>{item.body || item.message}</Text>
            <Text style={styles.time}>
              {formatNotificationTime(item)}
            </Text>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </Surface>
      </TouchableOpacity>
    );
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn} activeOpacity={0.6}>
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bell size={40} color={COLORS.muted} style={{ opacity: 0.5, marginBottom: 16 }} />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
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
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    marginBottom: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  unreadCard: {
    backgroundColor: COLORS.unread,
    borderColor: COLORS.secondary + '30'
  },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2, flex: 1 },
  body: { fontSize: 12, color: COLORS.muted, lineHeight: 16, marginBottom: 4 },
  time: { fontSize: 10, color: COLORS.muted, fontWeight: '500' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    alignSelf: 'center',
    marginLeft: 6
  },
  markReadBtn: {
    backgroundColor: COLORS.secondary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  markReadText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 14, color: COLORS.muted, fontWeight: '500' }
});

export default Notifications;
