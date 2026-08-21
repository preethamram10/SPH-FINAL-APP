import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  LayoutAnimation,
  UIManager,
  SafeAreaView
} from 'react-native';
import * as LucideIcons from 'lucide-react-native';

const User = LucideIcons.User;
const X = LucideIcons.X;
const CheckCircle2 = LucideIcons.CheckCircle2 || LucideIcons.CheckCircle || LucideIcons.Check;
const ChevronDown = LucideIcons.ChevronDown;
const Trash2 = LucideIcons.Trash2;
const Lock = LucideIcons.Lock;
const ShieldCheck = LucideIcons.ShieldCheck || LucideIcons.Check;
const PackageIcon = LucideIcons.Package || LucideIcons.FileText;
const Check = LucideIcons.Check || LucideIcons.CheckCircle;
import { Menu as PaperMenu, TextInput as RNTextInput, Button } from 'react-native-paper';
import { checkIsInDuration } from '../screens/reception/Rejoin/index';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { notifyAllHRs } from '../utils/notificationService';

// Using consistent colors based on the design
const COLORS = {
  primary: '#2563eb', // Clean blue from the screenshot
  primaryLight: '#eff6ff',
  primaryBorder: '#bfdbfe',
  text: '#000000',
  muted: '#000000',
  success: '#10b981',
  successLight: '#f0fdf4',
  successBorder: '#bbf7d0',
  danger: '#ef4444',
  border: '#e2e8f0',
  background: '#f8fafc',
  white: '#ffffff',
};

const capitalizeWords = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};
const AppointmentPaymentModal = ({
  visible,
  onDismiss,
  onViewDetails,
  selectedPatientForPayment,
  stopPolling,
  unlockRequest,
  requestingUnlock,
  handleRequestUnlock,
  includeConsultation,
  setIncludeConsultation,
  includeMedicine,
  setIncludeMedicine,
  includeDiet,
  setIncludeDiet,
  consultationFee,
  setConsultationFee,
  medicineFee,
  setMedicineFee,
  dietFee,
  setDietFee,
  medicines,
  handleMedicineChange,
  handleAddMedicineRow,
  handleRemoveMedicineRow,
  prescriptionDuration,
  setPrescriptionDuration,
  payLaterAmount,
  setPayLaterAmount,
  paymentLegs,
  setPaymentLegs,
  loadingQr,
  razorpayQrCode,
  generateRazorpayQR,
  processingRzp,
  handleSendFeeToPatient,
  handleQuickPayment,
  medicationDurationEndInput,
  setMedicationDurationEndInput
}) => {
  const [openDurationMenuIndex, setOpenDurationMenuIndex] = useState(null);
  const [openTypeMenuIndex, setOpenTypeMenuIndex] = useState(null);
  const [openTimingMenuIndex, setOpenTimingMenuIndex] = useState(null);
  const [openPaymentMenuIndex, setOpenPaymentMenuIndex] = useState(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [proposedDiscountAmt, setProposedDiscountAmt] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [requestingDiscount, setRequestingDiscount] = useState(false);
  const isPaid = selectedPatientForPayment?.paymentStatus === 'paid';
  const isUnlocked = unlockRequest?.status === 'approved';
  const showBlockMessage = false;
  const hasDietPlan = !!selectedPatientForPayment?.dietPlanAdded || !!selectedPatientForPayment?.dietPlan;
  const inDuration = checkIsInDuration(selectedPatientForPayment?.medicationDurationEnd);

  const [billingMode, setBillingMode] = useState('consultation_only');
  const [packageFeeAmount, setPackageFeeAmount] = useState('');
  const [packagePaidNowAmount, setPackagePaidNowAmount] = useState('');
  const [packagePurpose, setPackagePurpose] = useState('Standard Package');
  const [packageDuration, setPackageDuration] = useState('3 Months');
  const [durationMenuVisible, setDurationMenuVisible] = useState(false);

  const [existingActivePackage, setExistingActivePackage] = useState(null);
  const [includePackageBalancePayment, setIncludePackageBalancePayment] = useState(false);
  const [packageBalancePayInput, setPackageBalancePayInput] = useState('');

  const docTargetConsult = selectedPatientForPayment ? (selectedPatientForPayment.consultationFee !== undefined && selectedPatientForPayment.consultationFee !== null ? Number(selectedPatientForPayment.consultationFee) : 0) : 0;
  const docTargetMed = selectedPatientForPayment ? (selectedPatientForPayment.medicineFeeRequested ? Number(selectedPatientForPayment.medicineFeeRequested) : 0) : 0;
  const targetAmount = inDuration ? (docTargetMed > 0 ? docTargetMed : docTargetConsult) : (docTargetConsult + docTargetMed);

  useEffect(() => {
    if (visible && selectedPatientForPayment) {
      const docConsult = selectedPatientForPayment.consultationFee !== undefined && selectedPatientForPayment.consultationFee !== null ? Number(selectedPatientForPayment.consultationFee) : 0;
      const docMed = selectedPatientForPayment.medicineFeeRequested ? Number(selectedPatientForPayment.medicineFeeRequested) : 0;

      const resolvedConsult = (inDuration && docConsult === 0) ? 0 : docConsult;
      const resolvedMed = inDuration ? (docMed > 0 ? docMed : docConsult) : docMed;

      let initialMode = 'consultation_only';
      if (resolvedConsult > 0 && resolvedMed > 0) {
        initialMode = 'split';
      } else if (resolvedConsult === 0 && resolvedMed > 0) {
        initialMode = 'medicine_only';
      } else {
        initialMode = 'consultation_only';
      }

      setBillingMode(initialMode);
      setPackageFeeAmount('');
      setPackagePaidNowAmount('');
      setIncludePackageBalancePayment(false);

      // Fetch active package with pending balance for patient
      const fetchPatientPackage = async () => {
        try {
          const patId = selectedPatientForPayment.id || selectedPatientForPayment.patientId || '';
          const patPhone = (selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '').replace(/\D/g, '').slice(-10);

          let q;
          if (patId) {
            q = query(collection(db, 'package_members'), where('patientId', '==', patId));
          } else if (patPhone) {
            q = query(collection(db, 'package_members'), where('patientMobile', '==', patPhone));
          }

          if (q) {
            const snap = await getDocs(q);
            let activePkg = null;
            snap.forEach(docSnap => {
              const data = docSnap.data();
              const bal = Number(data.balanceAmount ?? (Number(data.totalAmount || 0) - Number(data.paidAmount || 0)));
              if (data.status === 'active' || bal > 0) {
                activePkg = { id: docSnap.id, ...data, balanceAmount: bal };
              }
            });
            setExistingActivePackage(activePkg);
            if (activePkg && activePkg.balanceAmount > 0) {
              setPackageBalancePayInput(String(activePkg.balanceAmount));
            }
          }
        } catch (err) {
          console.error("Error loading patient package:", err);
        }
      };

      fetchPatientPackage();
    } else {
      setExistingActivePackage(null);
      setIncludePackageBalancePayment(false);
      setPackageBalancePayInput('');
    }
  }, [visible, selectedPatientForPayment, inDuration]);

  const handleBillingModeChange = (mode) => {
    setBillingMode(mode);
    if (mode === 'split') {
      setIncludeConsultation(true);
      setIncludeMedicine(true);
      if (docTargetConsult > 0 && docTargetMed > 0) {
        setConsultationFee(docTargetConsult);
        setMedicineFee(docTargetMed);
      } else {
        const half = Math.round(targetAmount / 2);
        setConsultationFee(half);
        setMedicineFee(targetAmount - half);
      }
    } else if (mode === 'consultation_only') {
      setIncludeConsultation(true);
      const val = docTargetConsult > 0 ? docTargetConsult : targetAmount;
      setConsultationFee(val);
      setIncludeMedicine(false);
      setMedicineFee(0);
    } else if (mode === 'medicine_only') {
      setIncludeConsultation(false);
      setConsultationFee(0);
      setIncludeMedicine(true);
      const val = docTargetMed > 0 ? docTargetMed : targetAmount;
      setMedicineFee(val);
    } else if (mode === 'package_fee') {
      setIncludeConsultation(false);
      setConsultationFee(0);
      setIncludeMedicine(false);
      setMedicineFee(0);
      setPackageFeeAmount('');
    }
  };

  const isApproved = selectedPatientForPayment?.medicineDiscountStatus === 'approved';
  const isFreePayment = paymentLegs.some(l => l.method === 'free');
  const pkgBalancePayAmt = includePackageBalancePayment ? Number(packageBalancePayInput || 0) : 0;
  const packagePaidNow = Number(packagePaidNowAmount || packageFeeAmount || 0);

  const feeAmount = isFreePayment
    ? '0.00'
    : (isApproved
      ? Number(selectedPatientForPayment?.medicineDiscountRequested || 0).toFixed(2)
      : (billingMode === 'package_fee'
        ? (Number(targetAmount || 0) + packagePaidNow).toFixed(2)
        : (
          Number(consultationFee || 0) +
          Number(medicineFee || 0) +
          Number(dietFee || 0) +
          pkgBalancePayAmt -
          Number(payLaterAmount || 0)
        ).toFixed(2)));

  useEffect(() => {
    if (visible) {
      setPaymentLegs(prev => {
        if (prev.length === 1 && String(prev[0].amount) !== String(feeAmount)) {
          return [{ ...prev[0], amount: String(feeAmount) }];
        }
        return prev;
      });
    }
  }, [feeAmount, visible, setPaymentLegs]);

  // Helper component for radio style checkmarks
  const RadioCheck = ({ selected }) => (
    <View style={{
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: selected ? 0 : 2,
      borderColor: '#cbd5e1',
      backgroundColor: selected ? COLORS.primary : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
    }}>
      {selected && <CheckCircle2 size={20} color="#fff" />}
    </View>
  );
  console.log("=== AppointmentPaymentModal rendering, visible =", visible, "patient =", selectedPatientForPayment?.fullName);
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.background,
      zIndex: 1000,
      paddingTop: insets.top,
      paddingBottom: insets.bottom
    }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        {/* Header Container */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: COLORS.white }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>Appointment Payment</Text>
              <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Review and complete payment</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={{ padding: 4, backgroundColor: '#f1f5f9', borderRadius: 20 }}>
              <X size={20} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          {/* Patient Card */}
          <View style={{ backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryBorder, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <User size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 }} numberOfLines={1}>
                {capitalizeWords(selectedPatientForPayment?.fullName || selectedPatientForPayment?.patientName || 'Unknown Patient')}
              </Text>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>{selectedPatientForPayment?.phone || 'No phone provided'}</Text>
            </View>
            <TouchableOpacity onPress={onViewDetails} style={{ borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: COLORS.white }}>
              <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '600' }}>View Details &gt;</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>Select Payment Type</Text>

          {/* In Duration Banner */}
          {inDuration && (
            <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: '#d97706', borderRadius: 20, padding: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>⏱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#d97706' }}>🔁 Patient is REBOOKING</Text>
                <Text style={{ fontSize: 10, color: '#0f766e', marginTop: 2 }}>
                  Active medicine course until {new Date(selectedPatientForPayment?.medicationDurationEnd).toLocaleDateString('en-GB')}. Consultation fee auto-set to ₹0.
                </Text>
              </View>
            </View>
          )}

          {/* Target Amount */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            padding: 14,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Target Amount (from Doctor):</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.primary }}>₹{targetAmount}</Text>
          </View>

          {/* Billing Mode Selection */}
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
            {[
              { value: 'consultation_only', label: 'Consultation Fee' },
              { value: 'medicine_only', label: 'Consultation & Med Fee' },
              { value: 'split', label: 'Split (Both)' },
              { value: 'package_fee', label: 'Package Fee' }
            ].map(item => (
              <TouchableOpacity
                key={item.value}
                disabled={showBlockMessage}
                onPress={() => handleBillingModeChange(item.value)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 2,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: billingMode === item.value ? COLORS.primary : '#cbd5e1',
                  backgroundColor: billingMode === item.value ? COLORS.primary + '15' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Text style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: billingMode === item.value ? COLORS.primary : COLORS.muted,
                  textAlign: 'center'
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Existing Outstanding Package Balance Card */}
          {existingActivePackage && existingActivePackage.balanceAmount > 0 && billingMode !== 'package_fee' && (
            <View style={{ backgroundColor: '#fff1f2', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecdd3', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <PackageIcon size={18} color="#e11d48" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#be123c' }}>Package Outstanding Balance</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#e11d48' }}>₹{existingActivePackage.balanceAmount}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#9f1239', marginBottom: 10 }}>
                Patient has ₹{existingActivePackage.balanceAmount} pending balance from previous package registration.
              </Text>

              <TouchableOpacity
                onPress={() => setIncludePackageBalancePayment(!includePackageBalancePayment)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
              >
                <View style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: includePackageBalancePayment ? '#e11d48' : '#cbd5e1',
                  backgroundColor: includePackageBalancePayment ? '#e11d48' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8
                }}>
                  {includePackageBalancePayment && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>Collect Package Balance Payment Today</Text>
              </TouchableOpacity>

              {includePackageBalancePayment && (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#9f1239', marginBottom: 4 }}>Amount to Pay Today (₹)</Text>
                  <TextInput
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                      fontWeight: '800',
                      color: '#000000',
                      borderWidth: 1.5,
                      borderColor: '#e11d48'
                    }}
                    keyboardType="numeric"
                    placeholder="Enter Amount (e.g. 5000)"
                    placeholderTextColor="#94a3b8"
                    value={packageBalancePayInput}
                    onChangeText={(val) => setPackageBalancePayInput(val)}
                  />
                  <Text style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    New Remaining Package Balance: ₹{Math.max(0, existingActivePackage.balanceAmount - Number(packageBalancePayInput || 0))}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Package Fee Input Section */}
          {billingMode === 'package_fee' && (
            <View style={{ backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#86efac', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <PackageIcon size={18} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#15803d' }}>Register & Collect Package Fee</Text>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#000000', marginBottom: 4 }}>Package Total Fee (₹)</Text>
                <TextInput
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    fontWeight: '800',
                    color: '#000000',
                    borderWidth: 1.5,
                    borderColor: '#16a34a'
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 10000"
                  placeholderTextColor="#94a3b8"
                  value={packageFeeAmount}
                  onChangeText={(val) => setPackageFeeAmount(val)}
                />
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#000000', marginBottom: 4 }}>Amount Paid Now (₹)</Text>
                <TextInput
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    fontWeight: '800',
                    color: '#000000',
                    borderWidth: 1.5,
                    borderColor: '#16a34a'
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 2000 (Leave empty if paying full)"
                  placeholderTextColor="#94a3b8"
                  value={packagePaidNowAmount}
                  onChangeText={(val) => setPackagePaidNowAmount(val)}
                />
              </View>

              {/* Calculated Pending Balance Badge */}
              {(() => {
                const tot = Number(packageFeeAmount || 0);
                const pd = packagePaidNowAmount !== '' ? Number(packagePaidNowAmount || 0) : tot;
                const bal = Math.max(0, tot - pd);
                if (tot <= 0) return null;
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: bal > 0 ? '#fff1f2' : '#f0fdf4', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: bal > 0 ? '#fecdd3' : '#bbf7d0', marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: bal > 0 ? '#be123c' : '#15803d' }}>
                      {bal > 0 ? 'Pending Package Balance:' : '✓ Paid in Full:'}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: bal > 0 ? '#e11d48' : '#16a34a' }}>₹{bal}</Text>
                  </View>
                );
              })()}

              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#000000', marginBottom: 6 }}>Package Duration</Text>
                <TouchableOpacity
                  onPress={() => setDurationMenuVisible(!durationMenuVisible)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1.5,
                    borderColor: '#16a34a',
                    elevation: 1
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#000000' }}>{packageDuration}</Text>
                  <ChevronDown size={20} color="#16a34a" style={{ transform: [{ rotate: durationMenuVisible ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>

                {durationMenuVisible && (
                  <View style={{ marginTop: 8, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1.5, borderColor: '#86efac', padding: 6, gap: 4, elevation: 4 }}>
                    {['1 Month', '2 Months', '3 Months', '4 Months', '5 Months', '6 Months', '1 Year'].map(dur => {
                      const isSelected = packageDuration === dur;
                      return (
                        <TouchableOpacity
                          key={dur}
                          activeOpacity={0.7}
                          onPress={() => {
                            setPackageDuration(dur);
                            setDurationMenuVisible(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: isSelected ? '#f0fdf4' : 'transparent'
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#15803d' : '#0f172a' }}>
                            {dur}
                          </Text>
                          {isSelected && (
                            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' }}>
                              <Check size={12} color="#ffffff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Consultation Fee */}
          {billingMode !== 'medicine_only' && (
            <View style={{ marginBottom: 12 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: COLORS.white,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: includeConsultation ? COLORS.primary : COLORS.border,
              }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  disabled={showBlockMessage || billingMode !== 'split'}
                  onPress={() => {
                    stopPolling();
                    const nextVal = !includeConsultation;
                    setIncludeConsultation(nextVal);
                    if (!nextVal) {
                      setConsultationFee(0);
                    } else {
                      const docConsult = selectedPatientForPayment?.consultationFee;
                      const parsed = docConsult !== undefined && docConsult !== null ? Number(docConsult) : 0;
                      setConsultationFee(isNaN(parsed) ? 0 : parsed);
                    }
                  }}
                >
                  <RadioCheck selected={includeConsultation} />
                  <View>
                    <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '600' }}>Consultation Fee</Text>
                    <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Doctor Requested Consultation Fee</Text>
                  </View>
                </TouchableOpacity>
                {includeConsultation ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, marginRight: 4 }}>₹</Text>
                    <TextInput
                      editable={!showBlockMessage && billingMode === 'split'}
                      style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, minWidth: 40, textAlign: 'right' }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.muted}
                      value={consultationFee !== '' && consultationFee !== 0 && consultationFee !== '0' ? String(consultationFee) : ''}
                      onChangeText={(text) => {
                        stopPolling();
                        if (text === '') {
                          setConsultationFee('');
                          return;
                        }
                        const num = Number(text) || 0;
                        if (billingMode === 'split') {
                          const adjusted = Math.min(num, targetAmount);
                          setConsultationFee(adjusted);
                          setMedicineFee(targetAmount - adjusted);
                        } else {
                          setConsultationFee(num);
                        }
                      }}
                    />
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>₹{consultationFee || 0}</Text>
                )}
              </View>
            </View>
          )}

          {/* Medicine Fee / Combined Fee */}
          {billingMode !== 'consultation_only' && (
            <View style={{ marginBottom: 12 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: COLORS.white,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: includeMedicine ? COLORS.primary : COLORS.border,
              }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  disabled={showBlockMessage || billingMode !== 'split'}
                  onPress={() => {
                    stopPolling();
                    const nextVal = !includeMedicine;
                    setIncludeMedicine(nextVal);
                    if (!nextVal) {
                      setMedicineFee(0);
                    } else {
                      setMedicineFee(selectedPatientForPayment ? (Number(selectedPatientForPayment.medicineFeeRequested) || 0) : 0);
                    }
                  }}
                >
                  <RadioCheck selected={includeMedicine} />
                  <View>
                    <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '600' }}>
                      {billingMode === 'medicine_only' ? 'Consultation & Medicine Fee' : 'Medicine Fee'}
                    </Text>
                    <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                      {billingMode === 'medicine_only' ? 'Combined Consultation and Medicine Fee' : 'Doctor Requested Medicine Fee'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {includeMedicine ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, marginRight: 4 }}>₹</Text>
                    <TextInput
                      editable={!showBlockMessage && billingMode === 'split'}
                      style={{ fontSize: 14, fontWeight: '700', color: '#000000', minWidth: 40, textAlign: 'right' }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#000000"
                      value={medicineFee !== '' && medicineFee !== 0 && medicineFee !== '0' ? String(medicineFee) : ''}
                      onChangeText={(text) => {
                        stopPolling();
                        if (text === '') {
                          setMedicineFee('');
                          return;
                        }
                        const num = Number(text) || 0;
                        if (billingMode === 'split') {
                          const adjusted = Math.min(num, targetAmount);
                          setMedicineFee(adjusted);
                          setConsultationFee(targetAmount - adjusted);
                        } else {
                          setMedicineFee(num);
                        }
                      }}
                    />
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>₹{medicineFee || 0}</Text>
                )}
              </View>
            </View>
          )}


          {/* Diet Plan Fee */}
          <View style={{ marginBottom: 24, opacity: hasDietPlan ? 1 : 0.5 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: COLORS.white,
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: includeDiet ? COLORS.primary : COLORS.border,
            }}>
              <TouchableOpacity
                disabled={!hasDietPlan}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => {
                  if (showBlockMessage) return;
                  stopPolling();
                  setIncludeDiet(!includeDiet);
                }}
              >
                <RadioCheck selected={includeDiet} />
                <View>
                  <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '600' }}>Diet Plan Fee</Text>
                  <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Diet Plan Fee</Text>
                </View>
              </TouchableOpacity>
              {includeDiet ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, marginRight: 4 }}>₹</Text>
                  <TextInput
                    editable={!showBlockMessage && hasDietPlan}
                    style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, minWidth: 40, textAlign: 'right' }}
                    keyboardType="numeric"
                    value={String(dietFee)}
                    onChangeText={(text) => { stopPolling(); setDietFee(Number(text) || 0); }}
                  />
                </View>
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>₹{dietFee || 0}</Text>
              )}
            </View>

          </View>

          {/* Medicine Discount Card */}
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>Medicine Discount Status</Text>

            {/* Display Current Status */}
            {selectedPatientForPayment?.medicineDiscountStatus === 'pending' && (
              <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>⏳ Pending Approval</Text>
                <Text style={{ fontSize: 11, color: COLORS.text, marginTop: 2 }}>Proposed Fee: ₹{selectedPatientForPayment?.medicineDiscountRequested} (Original: ₹{selectedPatientForPayment?.medicineDiscountOriginal})</Text>
                <Text style={{ fontSize: 10, color: COLORS.muted, fontStyle: 'italic', marginTop: 2 }}>Note: "{selectedPatientForPayment?.medicineDiscountNote}"</Text>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await updateDoc(doc(db, 'allpatients', selectedPatientForPayment.id), {
                        medicineDiscountStatus: null,
                        medicineDiscountOriginal: null,
                        medicineDiscountRequested: null,
                        medicineDiscountNote: null,
                        medicineDiscountRequestedBy: null
                      });
                      Alert.alert("Cancelled", "Discount request cancelled.");
                    } catch (e) {
                      Alert.alert("Error", "Failed to cancel request.");
                    }
                  }}
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.danger, fontWeight: '600' }}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedPatientForPayment?.medicineDiscountStatus === 'approved' && (
              <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '700' }}>✓ Approved</Text>
                <Text style={{ fontSize: 11, color: COLORS.text, marginTop: 2 }}>New Medicine Fee: ₹{selectedPatientForPayment?.medicineDiscountRequested}</Text>
              </View>
            )}

            {selectedPatientForPayment?.medicineDiscountStatus === 'rejected' && (
              <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: '#b91c1c', fontWeight: '700' }}>✕ Rejected</Text>
                <Text style={{ fontSize: 11, color: COLORS.text, marginTop: 2 }}>Original Fee: ₹{selectedPatientForPayment?.medicineDiscountOriginal}</Text>
                <TouchableOpacity
                  onPress={() => setShowDiscountForm(true)}
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {(!selectedPatientForPayment?.medicineDiscountStatus) && !showDiscountForm && (
              <TouchableOpacity
                onPress={() => {
                  setProposedDiscountAmt(String(medicineFee || ''));
                  setShowDiscountForm(true);
                }}
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', alignSelf: 'flex-start' }}
              >
                <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>Request Discount</Text>
              </TouchableOpacity>
            )}

            {showDiscountForm && (
              <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '600', marginBottom: 4 }}>Proposed Amount (₹)</Text>
                <TextInput
                  placeholder="Enter proposed amount..."
                  keyboardType="numeric"
                  value={proposedDiscountAmt}
                  onChangeText={setProposedDiscountAmt}
                  style={{ backgroundColor: '#fff', height: 38, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 12, fontSize: 12, marginBottom: 8 }}
                />

                <Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '600', marginBottom: 4 }}>Reason for discount request</Text>
                <TextInput
                  placeholder="Enter reason..."
                  value={discountReason}
                  onChangeText={setDiscountReason}
                  style={{ backgroundColor: '#fff', height: 38, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 12, fontSize: 12, marginBottom: 12 }}
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowDiscountForm(false)}
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.muted, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={requestingDiscount}
                    onPress={async () => {
                      if (!proposedDiscountAmt.trim() || !discountReason.trim()) {
                        Alert.alert("Required Fields", "Please enter proposed amount and reason.");
                        return;
                      }
                      setRequestingDiscount(true);
                      try {
                        const origFee = Number(feeAmount || 0);
                        await updateDoc(doc(db, 'allpatients', selectedPatientForPayment.id), {
                          medicineDiscountStatus: 'pending',
                          medicineDiscountOriginal: origFee,
                          medicineDiscountRequested: Number(proposedDiscountAmt),
                          medicineDiscountNote: discountReason,
                          medicineDiscountRequestedBy: auth.currentUser?.uid || ''
                        });

                        try {
                          const notifTitle = '📢 Medicine Discount Requested';
                          const notifBody = `Collect ₹${proposedDiscountAmt} (instead of ₹${origFee}) for ${selectedPatientForPayment?.fullName || 'Patient'}.`;
                          await notifyAllHRs(notifTitle, notifBody, 'medicine_discount_request', { patientId: selectedPatientForPayment.id });
                        } catch (notifErr) {
                          console.warn('Failed to send discount notification to HR:', notifErr);
                        }

                        Alert.alert("Submitted", "Discount request submitted successfully.");
                        setShowDiscountForm(false);
                        setDiscountReason('');
                      } catch (e) {
                        Alert.alert("Error", "Failed to submit request.");
                      } finally {
                        setRequestingDiscount(false);
                      }
                    }}
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 6, alignItems: 'center', opacity: requestingDiscount ? 0.7 : 1 }}
                  >
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>
                      {requestingDiscount ? 'Submitting...' : 'Submit Request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Medicines Details */}
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Medicines Details</Text>
              {includeMedicine && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.muted }}>
                    Target: <Text style={{ color: COLORS.primary }}>₹{medicineFee || 0}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.muted }}>
                    Current: <Text style={{ color: medicines.reduce((sum, m) => sum + (Number(m.price) || 0), 0) === Number(medicineFee || 0) ? COLORS.success : COLORS.danger }}>₹{medicines.reduce((sum, m) => sum + (Number(m.price) || 0), 0)}</Text>
                  </Text>
                </View>
              )}
            </View>

            <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>Duration for all medicines:</Text>
            <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ width: '100%', height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: COLORS.white, borderRadius: 8 }}
                onPress={() => {
                  if (showBlockMessage) return;
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenDurationMenuIndex(openDurationMenuIndex === 'global' ? null : 'global');
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, marginRight: 8 }}>📅</Text>
                  <Text style={{ fontSize: 13, color: COLORS.text }}>{prescriptionDuration || 'Select Duration'}</Text>
                </View>
                <ChevronDown size={14} color={COLORS.muted} style={{ transform: [{ rotate: openDurationMenuIndex === 'global' ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>

              {openDurationMenuIndex === 'global' && (
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                  {["15 Days", "1 Month", "2 Months", "3 Months", "4 Months", "5 Months", "6 Months", "1 Year"].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.background }}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setPrescriptionDuration(opt);
                        setOpenDurationMenuIndex(null);
                      }}
                    >
                      <Text style={{ fontSize: 13, color: COLORS.text }}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Itemized Medicine Rows */}
            {medicines.map((med, index) => (
              <View key={index} style={{ marginBottom: 16, padding: 12, backgroundColor: COLORS.background, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text }}>Medicine {index + 1}</Text>
                  {!showBlockMessage && (
                    <TouchableOpacity onPress={() => handleRemoveMedicineRow(index)} style={{ padding: 4 }}>
                      <LucideIcons.X size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Name & Price */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 4 }}>Medicine Name</Text>
                    <TextInput
                      placeholder="Medicine Name"
                      value={med.name}
                      onChangeText={(val) => handleMedicineChange(index, 'name', val)}
                      style={{ backgroundColor: COLORS.white, height: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, fontSize: 12, color: COLORS.text }}
                      editable={!showBlockMessage}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 4 }}>Price (₹)</Text>
                    <TextInput
                      placeholder="0"
                      value={med.price || ''}
                      onChangeText={(val) => handleMedicineChange(index, 'price', val)}
                      keyboardType="numeric"
                      style={{ backgroundColor: COLORS.white, height: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, fontSize: 12, color: COLORS.text }}
                      editable={!showBlockMessage}
                    />
                  </View>
                </View>

                {/* Type & Dosage */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {/* Type select */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 4 }}>Type</Text>
                    <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.white }}>
                      <TouchableOpacity
                        style={{ height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}
                        onPress={() => {
                          if (showBlockMessage) return;
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setOpenTypeMenuIndex(openTypeMenuIndex === index ? null : index);
                          setOpenTimingMenuIndex(null);
                        }}
                      >
                        <Text style={{ fontSize: 11, color: COLORS.text }}>{med.type || 'Tablet'}</Text>
                        <ChevronDown size={12} color={COLORS.muted} />
                      </TouchableOpacity>
                      {openTypeMenuIndex === index && (
                        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: 150, overflow: 'scroll' }}>
                          {["Tablet", "Drops", "Syrup", "Ointment", "Powder", "Injection", "Other"].map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={{ paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}
                              onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                handleMedicineChange(index, 'type', opt);
                                setOpenTypeMenuIndex(null);
                              }}
                            >
                              <Text style={{ fontSize: 11, color: COLORS.text }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Dosage/Timing select */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 4 }}>Dosage</Text>
                    <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.white }}>
                      <TouchableOpacity
                        style={{ height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}
                        onPress={() => {
                          if (showBlockMessage) return;
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setOpenTimingMenuIndex(openTimingMenuIndex === index ? null : index);
                          setOpenTypeMenuIndex(null);
                        }}
                      >
                        <Text style={{ fontSize: 11, color: COLORS.text }} numberOfLines={1}>{med.dosage || '1-0-1 (Morning, Night)'}</Text>
                        <ChevronDown size={12} color={COLORS.muted} />
                      </TouchableOpacity>
                      {openTimingMenuIndex === index && (
                        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: 150, overflow: 'scroll' }}>
                          {["1-0-0 (Morning)", "0-0-1 (Night)", "1-0-1 (Morning, Night)", "1-1-1 (Morning, Afternoon, Night)", "0-1-0 (Afternoon)", "1-1-0 (Morning, Afternoon)", "0-1-1 (Afternoon, Night)", "When Required (SOS)"].map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={{ paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}
                              onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                handleMedicineChange(index, 'dosage', opt);
                                setOpenTimingMenuIndex(null);
                              }}
                            >
                              <Text style={{ fontSize: 11, color: COLORS.text }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {!showBlockMessage && (
              <View style={{ alignItems: 'flex-start', marginTop: 4 }}>
                <TouchableOpacity onPress={handleAddMedicineRow} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryBorder }}>
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>+ Add Row</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>

          {/* Pay Later */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: COLORS.muted }}>Pay Later Amount (Optional)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginRight: 4 }}>₹</Text>
              <TextInput
                editable={!showBlockMessage}
                style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, minWidth: 30, textAlign: 'right' }}
                keyboardType="numeric"
                value={String(payLaterAmount)}
                onChangeText={(text) => { stopPolling(); setPayLaterAmount(Number(text) || 0); }}
              />
            </View>
          </View>

          {/* Total Checkout */}
          <View style={{ backgroundColor: COLORS.successLight, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>Total Checkout</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.success }}>₹{feeAmount}</Text>
          </View>

          {isPaid && isUnlocked && (
            <View style={{ marginBottom: 24, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', borderRadius: 8 }}>
              <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                ✓ HR Approved: Additional checkout unlocked.
              </Text>
            </View>
          )}

          {/* Payment Methods */}
          {!showBlockMessage && (
            <View style={{ marginBottom: 32 }}>
              {/* Header with Target */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Payment Method</Text>
                <View style={{ backgroundColor: COLORS.primaryLight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primaryBorder }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>Target: ₹{feeAmount}</Text>
                </View>
              </View>

              {/* Payment Legs */}
              {paymentLegs.map((leg, index) => {
                const isSingleLeg = paymentLegs.length === 1;
                return (
                  <View key={index} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>

                      {/* Method Dropdown */}
                      <View style={{ flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white, overflow: 'hidden' }}>
                        <TouchableOpacity
                          onPress={() => {
                            stopPolling();
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setOpenPaymentMenuIndex(openPaymentMenuIndex === index ? null : index);
                          }}
                          style={{ height: 52, justifyContent: 'space-between', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 18, marginRight: 10 }}>
                              {leg.method === 'cash' ? '💵' : leg.method === 'card' ? '💳' : leg.method === 'upi' ? '📱' : leg.method === 'free' ? '' : '📲'}
                            </Text>
                            <View>
                              <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '700' }} numberOfLines={1}>
                                {leg.method === 'cash' ? 'Cash' : leg.method === 'card' ? 'Card' : leg.method === 'upi' ? 'Counter UPI' : leg.method === 'free' ? 'Free' : 'Patient App'}
                              </Text>
                              <Text style={{ fontSize: 10, color: COLORS.muted }}>Tap to change</Text>
                            </View>
                          </View>
                          <ChevronDown size={16} color={COLORS.muted} style={{ transform: [{ rotate: openPaymentMenuIndex === index ? '180deg' : '0deg' }] }} />
                        </TouchableOpacity>

                        {openPaymentMenuIndex === index && (
                          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border }}>
                            {[
                              { label: 'Cash', emoji: '💵', value: 'cash' },
                              { label: 'Card', emoji: '💳', value: 'card' },
                              { label: 'Counter UPI', emoji: '📱', value: 'upi' },
                              { label: 'Send to Patient App', emoji: '📲', value: 'app' },
                              { label: 'Free', emoji: '', value: 'free' }
                            ].map(opt => {
                              const isDisabled = paymentLegs.some((l, i) => i !== index && l.method === opt.value);
                              const isSelected = leg.method === opt.value;
                              return (
                                <TouchableOpacity
                                  key={opt.value}
                                  disabled={isDisabled}
                                  style={{
                                    paddingVertical: 13, paddingHorizontal: 16,
                                    borderBottomWidth: 1, borderBottomColor: COLORS.background,
                                    backgroundColor: isDisabled ? '#f8fafc' : (isSelected ? COLORS.primaryLight : COLORS.white),
                                    flexDirection: 'row', alignItems: 'center', gap: 10
                                  }}
                                  onPress={() => {
                                    if (opt.value === 'free') {
                                      const total = Number(feeAmount) || 0;
                                      if (total > 0) {
                                        Alert.alert("Invalid Option", "The 'Free' payment method can only be selected when the total billing amount is ₹0. Doctor has entered fees for this patient.");
                                        return;
                                      }
                                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                      setPaymentLegs([{ method: 'free', amount: '0' }]);
                                      setOpenPaymentMenuIndex(null);
                                      return;
                                    }
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    const newLegs = [...paymentLegs];
                                    newLegs[index] = { ...newLegs[index], method: opt.value };
                                    setPaymentLegs(newLegs);
                                    setOpenPaymentMenuIndex(null);
                                  }}
                                >
                                  <Text style={{ fontSize: 16 }}>{opt.emoji}</Text>
                                  <Text style={{ fontSize: 13, flex: 1, color: isDisabled ? COLORS.muted : COLORS.text, fontWeight: isSelected ? '700' : '400' }}>{opt.label}</Text>
                                  {isSelected && <CheckCircle2 size={15} color={COLORS.primary} />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      {/* Amount Field */}
                      <View style={{ minWidth: 95 }}>
                        <View style={{
                          height: 52,
                          borderWidth: 1.5,
                          borderColor: isSingleLeg
                            ? '#d1fae5'
                            : (Number(leg.amount || 0) > 0 ? COLORS.success : COLORS.border),
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          backgroundColor: isSingleLeg ? '#f0fdf4' : COLORS.white,
                          justifyContent: 'center'
                        }}>
                          <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 1 }}>
                            {isSingleLeg ? 'FULL AMOUNT' : 'AMOUNT'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 15, color: COLORS.success, fontWeight: '800', marginRight: 2 }}>₹</Text>
                            <TextInput
                              style={{ fontSize: 15, color: COLORS.success, fontWeight: '800', flex: 1, padding: 0 }}
                              keyboardType="numeric"
                              placeholder="0"
                              editable={!isSingleLeg}
                              value={isSingleLeg ? String(feeAmount) : (leg.amount === '0' || leg.amount === 0 ? '' : leg.amount)}
                              onChangeText={(text) => {
                                const newLegs = [...paymentLegs];
                                newLegs[index] = { ...newLegs[index], amount: text };
                                // Auto-fill the remaining into the other leg (only when 2 legs)
                                if (index === 0 && newLegs.length === 2) {
                                  const remaining = Number(feeAmount) - Number(text || 0);
                                  if (remaining >= 0) newLegs[1] = { ...newLegs[1], amount: String(remaining) };
                                } else if (index === 1 && newLegs.length === 2) {
                                  const remaining = Number(feeAmount) - Number(text || 0);
                                  if (remaining >= 0) newLegs[0] = { ...newLegs[0], amount: String(remaining) };
                                }
                                setPaymentLegs(newLegs);
                              }}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Remove leg */}
                      {index > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            const newLegs = paymentLegs.filter((_, i) => i !== index);
                            // Reset leg 0 amount to full feeAmount when back to single
                            if (newLegs.length === 1) {
                              newLegs[0] = { ...newLegs[0], amount: String(feeAmount) };
                            }
                            setPaymentLegs(newLegs);
                          }}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Trash2 size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Live Balance Indicator — only when split */}
              {paymentLegs.length > 1 && (() => {
                const allocated = paymentLegs.reduce((s, l) => s + Number(l.amount || 0), 0);
                const remaining = Number(feeAmount) - allocated;
                const isBalanced = Math.round(remaining * 100) === 0;
                const pct = Math.min((allocated / Number(feeAmount)) * 100, 100);
                return (
                  <View style={{ marginBottom: 12 }}>
                    {/* Progress bar */}
                    <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
                      <View style={{ height: 6, width: `${pct}%`, backgroundColor: isBalanced ? COLORS.success : '#f59e0b', borderRadius: 3 }} />
                    </View>
                    <View style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      padding: 12, borderRadius: 10,
                      backgroundColor: isBalanced ? '#f0fdf4' : '#fffbeb',
                      borderWidth: 1.5, borderColor: isBalanced ? '#bbf7d0' : '#fde68a'
                    }}>
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isBalanced ? '#15803d' : '#b45309' }}>
                          {isBalanced ? '✓ Split matches target!' : '⚠ Amounts don\'t match target'}
                        </Text>
                        <Text style={{ fontSize: 10, color: isBalanced ? '#15803d' : '#b45309', marginTop: 2 }}>
                          Allocated ₹{allocated.toFixed(0)} of ₹{feeAmount}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: isBalanced ? '#15803d' : '#b45309' }}>Remaining</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isBalanced ? '#15803d' : '#ef4444' }}>
                          ₹{Math.abs(remaining).toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Add Payment Method button */}
              {paymentLegs.length < 4 && (
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    if (paymentLegs.length === 1) {
                      // Going from single → split: leg 0 gets half, new leg gets the rest
                      const half = Math.floor(Number(feeAmount) / 2);
                      const rest = Number(feeAmount) - half;
                      setPaymentLegs([
                        { ...paymentLegs[0], amount: String(half) },
                        { method: 'card', amount: String(rest) }
                      ]);
                    } else {
                      const totalLegs = paymentLegs.reduce((sum, leg) => sum + Number(leg.amount || 0), 0);
                      const remaining = Number(feeAmount) - totalLegs;
                      setPaymentLegs([...paymentLegs, { method: 'upi', amount: remaining > 0 ? String(remaining) : '' }]);
                    }
                  }}
                  style={{
                    marginTop: 6, paddingVertical: 12, paddingHorizontal: 16,
                    borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
                    borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>+ Add Payment Method</Text>
                </TouchableOpacity>
              )}
            </View>
          )}


          {/* UPI QR Display */}
          {paymentLegs.some(l => l.method === 'upi' && Number(l.amount || 0) > 0) && !showBlockMessage && (() => {
            const upiTotal = paymentLegs.filter(l => l.method === 'upi').reduce((sum, l) => sum + Number(l.amount || 0), 0);
            return (
              <View style={{ alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 12 }}>Scan to Pay ₹{upiTotal}</Text>
                <View style={{ width: 160, height: 160, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  {loadingQr ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : razorpayQrCode?.image_url ? (
                    <Image source={{ uri: razorpayQrCode.image_url }} style={{ width: 140, height: 140 }} />
                  ) : (
                    <TouchableOpacity onPress={generateRazorpayQR} style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: COLORS.primary, borderRadius: 8 }}>
                      <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: '600' }}>Generate QR</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!razorpayQrCode && (
                  <Text style={{ fontSize: 12, color: COLORS.primary, marginTop: 12, fontWeight: '500' }}>Waiting for confirmation...</Text>
                )}
              </View>
            );
          })()}

          {/* Submit Button */}
          {!showBlockMessage && (
            <View style={{ marginTop: 8, marginBottom: 40 }}>
              <TouchableOpacity
                onPress={async () => {
                  if (billingMode === 'package_fee') {
                    const pAmt = Number(packageFeeAmount || 0);
                    if (pAmt <= 0) {
                      Alert.alert("Error", "Please enter a valid package total fee amount.");
                      return;
                    }
                    const pdAmt = packagePaidNowAmount !== '' ? Number(packagePaidNowAmount || 0) : pAmt;
                    const balAmt = Math.max(0, pAmt - pdAmt);

                    try {
                      const startDateStr = new Date().toISOString().split('T')[0];
                      const d = new Date();
                      if (packageDuration === '1 Month') d.setMonth(d.getMonth() + 1);
                      else if (packageDuration === '2 Months') d.setMonth(d.getMonth() + 2);
                      else if (packageDuration === '3 Months') d.setMonth(d.getMonth() + 3);
                      else if (packageDuration === '4 Months') d.setMonth(d.getMonth() + 4);
                      else if (packageDuration === '5 Months') d.setMonth(d.getMonth() + 5);
                      else if (packageDuration === '6 Months') d.setMonth(d.getMonth() + 6);
                      else if (packageDuration === '1 Year') d.setFullYear(d.getFullYear() + 1);
                      else d.setMonth(d.getMonth() + 3);
                      const endDateStr = d.toISOString().split('T')[0];

                      const patId = selectedPatientForPayment?.id || selectedPatientForPayment?.patientId || '';
                      const patPhone = (selectedPatientForPayment?.phone || selectedPatientForPayment?.patientPhone || '').replace(/\D/g, '').slice(-10);

                      const pkgRef = await addDoc(collection(db, 'package_members'), {
                        patientId: patId,
                        patientName: selectedPatientForPayment?.fullName || selectedPatientForPayment?.patientName || '',
                        patientMobile: patPhone,
                        packageName: 'Standard Homeopathy Package',
                        purpose: (packagePurpose || 'Standard Package').trim(),
                        totalAmount: pAmt,
                        paidAmount: pdAmt,
                        balanceAmount: balAmt,
                        startDate: startDateStr,
                        endDate: endDateStr,
                        status: 'active',
                        branchId: selectedPatientForPayment?.branchId || auth.currentUser?.branchId || 'KPHB',
                        branchName: selectedPatientForPayment?.branchName || auth.currentUser?.branchName || 'KPHB Branch',
                        createdAt: serverTimestamp(),
                        createdBy: auth.currentUser?.uid || 'staff',
                        createdByName: auth.currentUser?.displayName || 'Staff'
                      });

                      if (patId) {
                        try {
                          await updateDoc(doc(db, 'allpatients', patId), {
                            packageId: pkgRef.id,
                            packageName: 'Standard Homeopathy Package',
                            packageDetails: `${packagePurpose || 'Standard Package'} (${packageDuration})`,
                            packageTotal: pAmt,
                            packagePaid: pdAmt,
                            packageBalance: balAmt
                          });
                        } catch (e) { }
                      }
                    } catch (e) {
                      console.error("Error creating package_members entry:", e);
                    }
                  }

                  // If collecting outstanding package balance installment today
                  if (includePackageBalancePayment && existingActivePackage && existingActivePackage.id) {
                    try {
                      const balPaidAmt = Number(packageBalancePayInput || 0);
                      if (balPaidAmt > 0) {
                        const newPaid = Number(existingActivePackage.paidAmount || 0) + balPaidAmt;
                        const newBal = Math.max(0, Number(existingActivePackage.balanceAmount || 0) - balPaidAmt);

                        await updateDoc(doc(db, 'package_members', existingActivePackage.id), {
                          paidAmount: newPaid,
                          balanceAmount: newBal,
                          status: newBal <= 0 ? 'completed' : 'active',
                          updatedAt: serverTimestamp()
                        });

                        const patId = selectedPatientForPayment?.id || selectedPatientForPayment?.patientId || '';
                        if (patId) {
                          await updateDoc(doc(db, 'allpatients', patId), {
                            packagePaid: newPaid,
                            packageBalance: newBal
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Error updating package balance:", e);
                    }
                  }

                  if (includeMedicine && Number(medicineFee || 0) > 0) {
                    const hasPresc = selectedPatientForPayment?.prescriptionUrls && selectedPatientForPayment.prescriptionUrls.length > 0;
                    if (!hasPresc) {
                      Alert.alert("Prescription Required", "Physical prescription upload is mandatory before completing payment. Please upload it in the Patient Profile.");
                      return;
                    }
                  }

                  const totalLegs = paymentLegs.reduce((sum, leg) => sum + Number(leg.amount || 0), 0);
                  if (Math.round(totalLegs * 100) !== Math.round(Number(feeAmount) * 100)) {
                    Alert.alert('Error', `Total split amounts (₹${totalLegs}) must equal the total fee (₹${feeAmount})`);
                    return;
                  }

                  const appLeg = paymentLegs.find(l => l.method === 'app');
                  const counterLegs = paymentLegs.filter(l => l.method !== 'app');

                  if (appLeg) {
                    if (counterLegs.length === 0) {
                      await handleSendFeeToPatient();
                    } else {
                      const counterAmt = counterLegs.reduce((s, l) => s + Number(l.amount), 0);
                      const appAmt = Number(appLeg.amount);
                      await handleSendFeeToPatient({ counterAmount: counterAmt, upiAmount: appAmt, counterMethod: counterLegs[0].method });
                    }
                  } else {
                    if (paymentLegs.length > 1) {
                      await handleQuickPayment(null, false, paymentLegs);
                    } else {
                      await handleQuickPayment(null, paymentLegs[0].method === 'upi', paymentLegs);
                    }
                  }
                }}
                disabled={processingRzp}
                style={{ backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', opacity: processingRzp ? 0.7 : 1 }}
              >
                {processingRzp ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Lock size={16} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>
                      {paymentLegs.some(l => l.method === 'app') ? 'Send Payment Request to App' : 'Mark as Paid'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {paymentLegs.some(l => l.method === 'app') && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                  <ShieldCheck size={14} color={COLORS.muted} style={{ marginRight: 6 }} />
                  <Text style={{ color: COLORS.muted, fontSize: 10, textAlign: 'center' }}>
                    Payment request will be sent to patient's app for secure payment
                  </Text>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AppointmentPaymentModal;
