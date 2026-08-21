import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

// Normalize any date format to YYYY-MM-DD
const normDate = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr?.toDate) dateStr = dateStr.toDate().toISOString();
  if (dateStr?.seconds) dateStr = new Date(dateStr.seconds * 1000).toISOString();
  if (typeof dateStr !== 'string') return '';
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) return dateStr;
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
};

const getTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const GlobalAppointmentsSummary = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });

  useEffect(() => {
    const todayStr = getTodayISO();
    let patientsData = [];
    let appointmentsData = [];

    const calculate = () => {
      const todayPatients = patientsData.filter(p => {
        const s = (p.status || '').toLowerCase();
        if (s === 'cancelled' || s === 'no-show') return false;
        const d = normDate(p.appointmentDate || p.date || p.createdAt);
        return d === todayStr;
      });

      const todayAppts = appointmentsData.filter(a => {
        const s = (a.status || '').toLowerCase();
        if (s === 'cancelled' || s === 'no-show') return false;
        const d = normDate(a.dateString || a.appointmentDate || a.date || a.createdAt);
        return d === todayStr;
      });

      const all = [...todayPatients, ...todayAppts];
      let completed = 0, pending = 0;
      all.forEach(r => {
        const s = (r.status || '').toLowerCase();
        if (s === 'completed' || s === 'done') completed++;
        else pending++;
      });

      setStats({ total: all.length, completed, pending });
    };

    const qPatients = query(collection(db, 'allpatients'), limit(300));
    const unsubPatients = onSnapshot(qPatients, snap => {
      patientsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      calculate();
    }, () => { });

    const unsubAppts = () => {};
    appointmentsData = [];

    return () => { unsubPatients(); unsubAppts(); };
  }, []);

  const cards = [
    { label: 'Total\nToday', value: stats.total, color: '#3b82f6', bg: '#eff6ff', icon: '📋' },
    { label: 'Completed', value: stats.completed, color: '#10b981', bg: '#ecfdf5', icon: '✅' },
    { label: 'Pending', value: stats.pending, color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Branches • Today</Text>
      <View style={styles.row}>
        {cards.map((card, i) => (
          <View key={i} style={[styles.card, { backgroundColor: card.bg, borderColor: card.color + '33' }]}>
            <Text style={styles.icon}>{card.icon}</Text>
            <Text style={[styles.value, { color: card.color }]}>{card.value}</Text>
            <Text style={[styles.label, { color: card.color }]}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 18,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
});

export default GlobalAppointmentsSummary;
