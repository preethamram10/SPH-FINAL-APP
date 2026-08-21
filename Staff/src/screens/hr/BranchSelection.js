import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { Text, Surface, ActivityIndicator, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Building } from 'lucide-react-native';

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const BranchSelection = ({ navigation }) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'branch'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filteredBranches = branches.filter(b =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBranchItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate('AttendanceList', { branchId: item.id, branchName: item.name })}
    >
      <Surface style={styles.branchCard}>
        <View style={styles.iconContainer}>
          <Building size={20} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.branchName}>{item.name}</Text>
          <Text style={styles.branchLocation}>{item.location || 'Spiritual Homeopathy Clinic'}</Text>
        </View>
        <ChevronRight size={20} color={COLORS.muted} />
      </Surface>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Select Branch</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Search bar */}
        <Searchbar
          placeholder="Search branch by name or city..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor={COLORS.secondary}
          placeholderTextColor="#94a3b8"
          elevation={0}
        />

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredBranches}
            renderItem={renderBranchItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.muted }}>No branches found.</Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AttendanceList', { branchId: 'doctors', branchName: 'Employee Doctors (All)' })}
                style={{ marginTop: 12 }}
              >
                <Surface style={[styles.branchCard, { borderColor: '#dc2626', borderWidth: 1 }]}>
                  <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
                    <Building size={20} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.branchName, { color: '#dc2626' }]}>Employee Doctors</Text>
                    <Text style={styles.branchLocation}>Spiritual Homeopathy Clinic (All)</Text>
                  </View>
                  <ChevronRight size={20} color="#dc2626" />
                </Surface>
              </TouchableOpacity>
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
  content: { flex: 1, paddingVertical: 16, paddingHorizontal: 20 },
  listContent: { paddingBottom: 20 },

  // Searchbar
  searchBar: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 14,
    height: 44,
  },
  searchInput: { fontSize: 13, minHeight: 0, paddingBottom: 6 },

  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    marginBottom: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  branchName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  branchLocation: { fontSize: 12, color: COLORS.muted },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
});

export default BranchSelection;
