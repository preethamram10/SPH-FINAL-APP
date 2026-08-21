import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, Surface, Avatar, IconButton } from 'react-native-paper';
import { Phone, Calendar, MapPin, UserCheck, ArrowUp, ArrowDown, MessageCircle, CalendarClock, Timer } from 'lucide-react-native';
import { checkIsInDuration } from '../screens/reception/Rejoin/index';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon = ({ size = 17, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.12.378.102.518-.058.14-.16.6-1.012.76-1.356.16-.344.318-.288.536-.208.218.08 1.382.652 1.62.77.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);

const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  success: '#10b981',
  warning: '#f59e0b',
  text: '#0f172a',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

const getStatusStyle = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'Done' };
    case 'in-consultation':
    case 'consulting':
      return { bg: '#fef3c7', border: '#fde68a', text: '#d97706', label: 'Consulting' };
    case 'confirmed':
    case 'booked':
      return { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', label: 'Confirmed' };
    case 'pending':
      return { bg: '#fffbeb', border: '#fef3c7', text: '#d97706', label: 'Pending' };
    case 'waiting':
    default:
      return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: 'Waiting' };
  }
};

const AppointmentCard = ({ appointment, queueNumber, onRefresh, onReschedule, onMoveQueue, onWhatsApp, isCompletedTab = false }) => {
  const statusInfo = getStatusStyle(appointment.status);
  const inDuration = appointment.followUpDate ? checkIsInDuration(appointment.followUpDate) : false;
  const isRebooking = appointment.followUpDate ? !checkIsInDuration(appointment.followUpDate) : false;

  const initials = appointment.fullName
    ? appointment.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'OP';

  const sAppt = (appointment.status || '').toLowerCase();
  const isActive =
    sAppt === 'waiting' ||
    sAppt === 'pending' ||
    sAppt === 'confirmed' ||
    sAppt === 'booked';

  const handleWhatsApp = () => {
    const phone = appointment.phone;
    const name = appointment.fullName;
    if (!phone || phone === 'N/A') {
      Alert.alert('Error', 'No phone number available for this patient.');
      return;
    }
    if (onWhatsApp) {
      onWhatsApp(phone, name);
    } else {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const message = `Hello ${name}, this is from SPH Clinic regarding your appointment.`;
      const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Make sure WhatsApp is installed on your device.');
      });
    }
  };

  const handleReschedule = () => {
    if (onReschedule) {
      onReschedule(appointment);
    }
  };

  const handleMoveUp = () => {
    if (onMoveQueue) onMoveQueue(appointment, 'up');
  };

  const handleMoveDown = () => {
    if (onMoveQueue) onMoveQueue(appointment, 'down');
  };

  // Display date: prefer DD/MM/YYYY over YYYY-MM-DD
  const displayDate = (() => {
    const d = appointment.appointmentDate || appointment.dateString || '';
    if (!d) return 'No Date';
    if (d.includes('/')) return d;
    if (d.includes('-')) {
      const parts = d.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return d;
  })();

  const displayBranch = appointment.branchName || appointment.branchId || 'N/A';
  const displayDoctor = appointment.doctor || appointment.doctorName
    ? (appointment.doctor || appointment.doctorName).startsWith('Dr.')
      ? (appointment.doctor || appointment.doctorName)
      : `Dr. ${appointment.doctor || appointment.doctorName}`
    : 'General Doctor';

  return (
    <Surface style={[styles.card, isCompletedTab && { padding: 12, borderRadius: 12, marginBottom: 8 }]}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <Avatar.Text
          size={isCompletedTab ? 36 : 44}
          label={initials}
          style={{ backgroundColor: '#eff6ff' }}
          labelStyle={{ color: '#1e40af', fontWeight: '800', fontSize: isCompletedTab ? 11 : 13 }}
        />

        <View style={{ flex: 1, marginLeft: isCompletedTab ? 10 : 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {queueNumber ? (
              <View style={{
                backgroundColor: '#eff6ff',
                borderColor: '#bfdbfe',
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
                <Text style={{
                  color: '#1e40af',
                  fontSize: 10,
                  fontWeight: '800',
                }}>{queueNumber}</Text>
              </View>
            ) : isActive ? (
              <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>Q?</Text>
              </View>
            ) : null}
            <Text style={[styles.patientName, isCompletedTab && { fontSize: 13 }]}>{appointment.fullName}</Text>
            {/* ONLINE/APP badge */}
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeText}>APP</Text>
            </View>
            {/* Payment Status badge */}
            {appointment.paymentStatus === 'paid' ? (
              <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#059669', fontSize: 9, fontWeight: '800' }}>
                  {appointment.paymentMethod === 'split' || appointment.paymentSplitDetails ? 'PAID (SPLIT)' : 'PAID'}
                </Text>
              </View>
            ) : inDuration ? (
              <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#059669', fontSize: 9, fontWeight: '800' }}>PAID ₹0 (IN DURATION)</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800' }}>UNPAID</Text>
              </View>
            )}
            {/* IN DURATION badge */}
            {inDuration && (
              <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Timer size={9} color="#d97706" />
                <Text style={{ color: '#d97706', fontSize: 9, fontWeight: '800' }}>IN DURATION</Text>
              </View>
            )}
            {isRebooking && (
              <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Timer size={9} color="#0369a1" />
                <Text style={{ color: '#0369a1', fontSize: 9, fontWeight: '800' }}>RE-BOOKING</Text>
              </View>
            )}
          </View>

          <View style={styles.infoRow}>
            <Phone size={10} color={COLORS.muted} style={{ marginRight: 4 }} />
            <Text style={[styles.patientInfoText, isCompletedTab && { fontSize: 10 }]}>{appointment.phone || 'N/A'}</Text>
            {appointment.email && !isCompletedTab ? (
              <>
                <Text style={styles.patientInfoDot}> • </Text>
                <Text style={styles.patientInfoText} numberOfLines={1}>{appointment.email}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Status and Action Buttons (top right) */}
        {isCompletedTab ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#ecfdf5',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#a7f3d0'
              }}
              onPress={handleWhatsApp}
            >
              <WhatsAppIcon size={16} color="#10b981" />
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border, paddingHorizontal: 8, paddingVertical: 2 }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.text, fontSize: 9 }]}>{statusInfo.label}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        )}
      </View>

      {/* Meta chips row */}
      <View style={[styles.metaChipRow, isCompletedTab && { marginTop: 8, gap: 4 }]}>
        <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
          <Calendar size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
          <Text style={styles.tagChipText} numberOfLines={1}>{displayDate}</Text>
        </View>
        {appointment.appointmentTime && appointment.appointmentTime !== 'N/A' && (
          <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
            <Text style={[styles.tagChipText, { color: COLORS.secondary }]}>
              🕐 {appointment.appointmentTime}
            </Text>
          </View>
        )}
        <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
          <MapPin size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
          <Text style={styles.tagChipText} numberOfLines={1}>{displayBranch}</Text>
        </View>
        <View style={[styles.tagChipStyle, isCompletedTab && { paddingHorizontal: 6, paddingVertical: 2 }]}>
          <UserCheck size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
          <Text style={styles.tagChipText} numberOfLines={1}>{displayDoctor}</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      {!isCompletedTab && (
        <View style={styles.cardActionRow}>
          {/* WhatsApp icon button */}
          <TouchableOpacity
            style={styles.iconCircleGreen}
            onPress={handleWhatsApp}
          >
            <WhatsAppIcon size={17} color="#25d366" />
          </TouchableOpacity>

          {/* Reschedule icon button - only for active */}
          {isActive && (
            <TouchableOpacity
              style={styles.iconCircleBlue}
              onPress={handleReschedule}
            >
              <CalendarClock size={17} color="#258ec8" />
            </TouchableOpacity>
          )}

          {/* Queue Controls */}
          {isActive && (
            <View style={styles.queueControls}>
              <TouchableOpacity
                style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8, marginRight: 6 }}
                onPress={handleMoveUp}
              >
                <ArrowUp size={18} color="#258ec8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8 }}
                onPress={handleMoveDown}
              >
                <ArrowDown size={18} color="#258ec8" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e0f0ff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  patientInfoText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  patientInfoDot: {
    fontSize: 11,
    color: COLORS.muted,
  },
  onlineBadge: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  onlineBadgeText: {
    color: '#7c3aed',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  tagChipStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  iconCircleGreen: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#25d366',
    backgroundColor: 'rgba(37,211,102,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBlue: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#258ec8',
    backgroundColor: 'rgba(37,142,200,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  queueBtn: {
    margin: 0,
    padding: 0,
  },
});

export default AppointmentCard;
