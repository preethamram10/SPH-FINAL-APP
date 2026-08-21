import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, Image, Linking, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text, Surface, TextInput, Button, Avatar, IconButton, Portal, Provider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Search, Coins, CreditCard, CheckCircle2, User, Phone, Plus, Trash2, Tag, Share2, X, Calendar, Globe, Mail, MapPin } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon = ({ size = 18, color = '#ffffff', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.12.378.102.518-.058.14-.16.6-1.012.76-1.356.16-.344.318-.288.536-.208.218.08 1.382.652 1.62.77.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);

const COLORS = {
  primary: '#258ec8',      // SPH Blue
  secondary: '#a8ce3a',    // SPH Green
  success: '#10b981',      // Success Green
  warning: '#f59e0b',      // Warning Amber
  text: '#1e293b',         // Deep slate dark text
  muted: '#64748b',        // Muted grey text
  background: '#f8fafc',   // Off-white background
  white: '#ffffff',
  border: '#e2e8f0',       // Border line grey
  danger: '#ef4444'
};

const RewardPointClaim = ({ navigation }) => {
  const { userData } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState(null);

  // Form Fields
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState('');

  // Products List State
  const [products, setProducts] = useState([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Points Redemption State
  const [pointsRedeemed, setPointsRedeemed] = useState('');

  // Billing Flow & Modal States
  const [completingBilling, setCompletingBilling] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    // Format current date & time
    const updateDateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      setCurrentDateTime(formatted);
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchPatient = async () => {
    const trimmedPhone = searchPhone.trim();
    if (!trimmedPhone) {
      Alert.alert('Error', 'Please enter a patient phone number.');
      return;
    }

    setSearching(true);
    setPatient(null);
    setAppliedCoupon(null);
    setPointsRedeemed('');
    try {
      const phoneDigits = trimmedPhone.replace(/\D/g, '').slice(-10);
      
      // Query both collections by phone number
      const qPatients = query(collection(db, 'patients'), where('phone', '==', phoneDigits));
      const qAllPatients = query(collection(db, 'allpatients'), where('phone', '==', phoneDigits));

      const [snapPat, snapAllPat] = await Promise.all([getDocs(qPatients), getDocs(qAllPatients)]);
      
      let foundDoc = null;
      let foundId = null;

      if (!snapAllPat.empty) {
        foundDoc = snapAllPat.docs[0].data();
        foundId = snapAllPat.docs[0].id;
      } else if (!snapPat.empty) {
        foundDoc = snapPat.docs[0].data();
        foundId = snapPat.docs[0].id;
      }

      if (!foundDoc) {
        Alert.alert(
          'Patient Not Found',
          'No registered patient found with this phone number. You can enter patient details manually for walk-in billing.',
          [
            {
              text: 'OK',
              onPress: () => {
                setPatient(null);
                setPatientName('');
                setPatientPhone(phoneDigits);
              }
            }
          ]
        );
      } else {
        const docData = foundDoc;
        const foundPatient = {
          id: foundId,
          name: docData.fullName || docData.name || 'Patient',
          phone: docData.phone || phoneDigits,
          rewardPoints: docData.rewardPoints || 0
        };
        setPatient(foundPatient);
        setPatientName(foundPatient.name);
        setPatientPhone(foundPatient.phone);
      }
    } catch (e) {
      console.error("Error searching patient:", e);
      Alert.alert('Error', 'Failed to search for patient.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddProduct = () => {
    if (!newProductName.trim()) {
      Alert.alert('Invalid Entry', 'Please enter product/medicine name.');
      return;
    }
    const priceNum = parseFloat(newProductPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price/amount.');
      return;
    }

    const newProduct = {
      id: Date.now().toString(),
      name: newProductName.trim(),
      price: priceNum
    };

    setProducts(prev => [...prev, newProduct]);
    setNewProductName('');
    setNewProductPrice('');
  };

  const handleDeleteProduct = (id) => {
    setProducts(prev => prev.filter(item => item.id !== id));
  };

  const handleApplyCoupon = async () => {
    if (!patient) {
      Alert.alert('Error', 'Please lookup and select a patient first.');
      return;
    }
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code.');
      return;
    }

    try {
      const codeUpper = couponCode.trim().toUpperCase();
      
      // Query coupon globally by code
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', codeUpper),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert('Invalid Coupon', 'The coupon code is invalid, already redeemed, or expired.');
        return;
      }

      const couponDoc = snapshot.docs[0];
      const couponData = couponDoc.data();

      // Verify that the coupon belongs to the searched patient
      const patientPhoneDigits = patient.phone.replace(/\D/g, '').slice(-10);
      const couponPhoneDigits = (couponData.patientPhone || '').replace(/\D/g, '').slice(-10);

      if (couponData.userId !== patient.id && couponPhoneDigits !== patientPhoneDigits) {
        Alert.alert('Invalid Coupon', 'This coupon code does not belong to the selected patient.');
        return;
      }

      const now = new Date();
      let expiryDateVal = null;
      if (couponData.expiryDate) {
        expiryDateVal = couponData.expiryDate.toDate ? couponData.expiryDate.toDate() : new Date(couponData.expiryDate);
      }

      if (expiryDateVal && expiryDateVal < now) {
        Alert.alert('Expired Coupon', 'This coupon has expired.');
        return;
      }

      setAppliedCoupon({
        id: couponDoc.id,
        ...couponData
      });

      Alert.alert('Coupon Applied Successfully!', `Discount of ₹${couponData.pointsValue} has been deducted from subtotal.`);
      setCouponCode('');
    } catch (e) {
      console.error("Error applying coupon:", e);
      Alert.alert('Error', 'Failed to validate and apply coupon.');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  const handleCompleteBilling = async () => {
    if (!patientName.trim()) {
      Alert.alert('Error', 'Please enter patient name.');
      return;
    }
    if (!patientPhone.trim() || patientPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (products.length === 0) {
      Alert.alert('Cart Empty', 'Please add at least one product/item to the invoice.');
      return;
    }

    const ptsRedeem = parseInt(pointsRedeemed, 10) || 0;
    if (ptsRedeem > 0) {
      if (!patient) {
        Alert.alert('Error', 'Points redemption requires a registered patient profile.');
        return;
      }
      if (ptsRedeem > patient.rewardPoints) {
        Alert.alert('Insufficient Points', `Patient only has ${patient.rewardPoints} points available.`);
        return;
      }
    }

    setCompletingBilling(true);
    try {
      const subtotal = products.reduce((sum, item) => sum + item.price, 0);
      const cpnDiscount = appliedCoupon ? appliedCoupon.pointsValue : 0;
      
      // Points discount is ₹1 per point
      const ptsDiscount = ptsRedeem;
      const grandTotal = Math.max(0, subtotal - cpnDiscount - ptsDiscount);

      // Generate invoice number
      const randomId = Math.floor(100000 + Math.random() * 900000);
      const generatedInvoiceNum = `SPH-INV-${randomId}`;
      setInvoiceNumber(generatedInvoiceNum);

      // 1. Deduct wallet points if redeemed
      if (ptsRedeem > 0 && patient) {
        const patientRef = doc(db, 'patients', patient.id);
        await updateDoc(patientRef, {
          rewardPoints: increment(-ptsRedeem)
        });

        // Log wallet transaction
        await addDoc(collection(db, 'reward_points_transactions'), {
          userId: patient.id,
          patientName: patientName,
          type: 'redeem',
          points: ptsRedeem,
          description: `Redeemed ${ptsRedeem} points for product billing invoice ${generatedInvoiceNum}`,
          createdAt: serverTimestamp()
        });
      }

      // 2. Set coupon to redeemed if coupon was applied
      if (appliedCoupon) {
        const couponRef = doc(db, 'coupons', appliedCoupon.id);
        await updateDoc(couponRef, {
          status: 'redeemed',
          redeemedAt: serverTimestamp(),
          redeemedInvoiceNum: generatedInvoiceNum
        });
      }

      // 3. Save invoice record to transactions collection
      await addDoc(collection(db, 'alltransactions'), {
        invoiceNumber: generatedInvoiceNum,
        patientName: patientName,
        patientPhone: patientPhone.replace(/\D/g, '').slice(-10),
        patientId: patient?.id || null,
        products: products.map(p => ({ name: p.name, price: p.price })),
        subtotal: subtotal,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: cpnDiscount,
        pointsRedeemed: ptsRedeem,
        grandTotal: grandTotal,
        amount: grandTotal, // Amount field for unified dashboard reporting
        type: 'product_billing',
        branchId: userData?.branchId || null,
        branchName: userData?.branchName || null,
        recordedBy: userData?.name || 'Staff',
        createdAt: serverTimestamp(),
        dateTimeStr: currentDateTime,
        timestamp: serverTimestamp() // Unified Firestore timestamp
      });

      // Update local state if patient search active
      if (patient) {
        setPatient(prev => ({
          ...prev,
          rewardPoints: Math.max(0, prev.rewardPoints - ptsRedeem)
        }));
      }

      setInvoiceModalVisible(true);
    } catch (e) {
      console.error("Error completing billing:", e);
      Alert.alert('Error', 'Failed to complete billing transaction.');
    } finally {
      setCompletingBilling(false);
    }
  };

  const handleShareWhatsApp = () => {
    const subtotal = products.reduce((sum, item) => sum + item.price, 0);
    const cpnDiscount = appliedCoupon ? appliedCoupon.pointsValue : 0;
    const ptsRedeem = parseInt(pointsRedeemed, 10) || 0;
    const grandTotal = Math.max(0, subtotal - cpnDiscount - ptsRedeem);

    let itemsText = '';
    products.forEach((p, idx) => {
      itemsText += `${idx + 1}. ${p.name} - ₹${p.price.toFixed(2)}\n`;
    });

    const receiptText = `*Spiritual Homeopathy Clinic*
━━━━━━━━━━━━━━━━━━━━━
*BILLING INVOICE*
*Invoice No:* ${invoiceNumber}
*Date/Time:* ${currentDateTime}
*Patient Name:* ${patientName}
*Patient Phone:* ${patientPhone}
━━━━━━━━━━━━━━━━━━━━━
*ITEMS BILLED:*
${itemsText}
━━━━━━━━━━━━━━━━━━━━━
*BILLING SUMMARY:*
*Subtotal:* ₹${subtotal.toFixed(2)}
${cpnDiscount > 0 ? `*Coupon Discount:* -₹${cpnDiscount.toFixed(2)} (${appliedCoupon?.code})\n` : ''}${ptsRedeem > 0 ? `*Wallet Points Redeemed:* -₹${ptsRedeem.toFixed(2)}\n` : ''}-------------------------------------
*GRAND TOTAL:* *₹${grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━━
Thank you for visiting Spiritual Homeopathy.
📞 Support Contact: 9069 176 176
🌐 Website: https://spiritualhomeoclinic.com/
📍 Branch: Hyderabad`;

    const cleanPhone = patientPhone.replace(/\D/g, '').slice(-10);
    const url = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(receiptText)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to web whatsapp
        Linking.openURL(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(receiptText)}`);
      }
    }).catch(err => {
      console.error("Failed to open WhatsApp:", err);
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp. Formatted text receipt copied.');
    });
  };

  const handleResetForm = () => {
    setPatient(null);
    setSearchPhone('');
    setPatientName('');
    setPatientPhone('');
    setProducts([]);
    setAppliedCoupon(null);
    setPointsRedeemed('');
    setInvoiceNumber('');
    setInvoiceModalVisible(false);
  };

  const subtotal = products.reduce((sum, item) => sum + item.price, 0);
  const couponDiscount = appliedCoupon ? appliedCoupon.pointsValue : 0;
  const pointsDiscount = parseInt(pointsRedeemed, 10) || 0;
  const grandTotal = Math.max(0, subtotal - couponDiscount - pointsDiscount);

  return (
    <Provider>
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
          <Text style={styles.headerTitle}>Products Billing & Invoice</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Quick Search registered patients (Zero restriction) */}
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>Quick Patient Lookup</Text>
            <Text style={styles.cardSubtitle}>Search registered patients by phone number to load wallet profile & coupons globally.</Text>
            <View style={styles.searchRow}>
              <TextInput
                label="Mobile Number"
                placeholder="Enter 10-digit mobile number"
                value={searchPhone}
                onChangeText={setSearchPhone}
                keyboardType="phone-pad"
                mode="outlined"
                style={styles.searchInput}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text}
                placeholderTextColor={COLORS.muted}
                theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                left={<TextInput.Icon icon={() => <Phone size={18} color={COLORS.muted} />} />}
              />
              <Button
                mode="contained"
                onPress={handleSearchPatient}
                loading={searching}
                disabled={searching}
                style={styles.searchBtn}
                buttonColor={COLORS.primary}
              >
                <Search size={18} color="white" />
              </Button>
            </View>
          </Surface>

          {/* Patient Details & Time Form */}
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>Patient & Invoice Details</Text>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Patient Name *"
                  value={patientName}
                  onChangeText={setPatientName}
                  mode="outlined"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  textColor={COLORS.text}
                  placeholderTextColor={COLORS.muted}
                  theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                  style={styles.formInput}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TextInput
                  label="Mobile Number *"
                  placeholder="e.g. 9876543210"
                  value={patientPhone}
                  onChangeText={setPatientPhone}
                  keyboardType="phone-pad"
                  mode="outlined"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  textColor={COLORS.text}
                  placeholderTextColor={COLORS.muted}
                  theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                  style={styles.formInput}
                />
              </View>
            </View>

            <View style={styles.dateTimeContainer}>
              <Calendar size={16} color={COLORS.muted} style={{ marginRight: 6 }} />
              <Text style={styles.dateTimeText}>Invoice Date & Time: {currentDateTime}</Text>
            </View>
          </Surface>

          {/* Dynamic Products Table Billing */}
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>Cart / Items to Bill</Text>
            
            {/* Input Row */}
            <View style={styles.productInputRow}>
              <View style={{ flex: 0.6 }}>
                <TextInput
                  label="Product / Medicine Name"
                  placeholder="e.g. Dilution Alpha"
                  value={newProductName}
                  onChangeText={setNewProductName}
                  mode="outlined"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  textColor={COLORS.text}
                  placeholderTextColor={COLORS.muted}
                  theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                  style={styles.formInputSmall}
                />
              </View>
              <View style={{ flex: 0.3, marginLeft: 8 }}>
                <TextInput
                  label="Price (₹)"
                  placeholder="e.g. 250"
                  value={newProductPrice}
                  onChangeText={setNewProductPrice}
                  keyboardType="numeric"
                  mode="outlined"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  textColor={COLORS.text}
                  placeholderTextColor={COLORS.muted}
                  theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                  style={styles.formInputSmall}
                />
              </View>
              <TouchableOpacity style={styles.addProductBtn} onPress={handleAddProduct}>
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Table Header */}
            {products.length > 0 ? (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableCol, styles.colSn, styles.headerText]}>S.No</Text>
                  <Text style={[styles.tableCol, styles.colName, styles.headerText]}>Product/Medicine Name</Text>
                  <Text style={[styles.tableCol, styles.colPrice, styles.headerText]}>Price</Text>
                  <Text style={[styles.tableCol, styles.colAction, styles.headerText]}></Text>
                </View>

                {products.map((item, idx) => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.tableCol, styles.colSn]}>{idx + 1}</Text>
                    <Text style={[styles.tableCol, styles.colName]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.tableCol, styles.colPrice]}>₹{item.price.toFixed(2)}</Text>
                    <TouchableOpacity style={[styles.tableCol, styles.colAction]} onPress={() => handleDeleteProduct(item.id)}>
                      <Trash2 size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCartContainer}>
                <Text style={styles.emptyCartText}>No products added yet. Use form above to add medicines.</Text>
              </View>
            )}
          </Surface>

          {/* Reward Wallet Points & Coupons Section (Disabled for manually entered users without profiles) */}
          <Surface style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Redeem Points & Coupons</Text>
              {patient && (
                <View style={styles.patientWalletIndicator}>
                  <Coins size={14} color={COLORS.warning} style={{ marginRight: 4 }} />
                  <Text style={styles.patientWalletIndicatorText}>Wallet: {patient.rewardPoints} pts</Text>
                </View>
              )}
            </View>

            {!patient ? (
              <View style={styles.noProfileWarning}>
                <Text style={styles.noProfileWarningText}>Coupons and Reward Points cannot be redeemed for unregistered walk-in billing. Use the lookup to check point balance.</Text>
              </View>
            ) : (
              <View>
                {/* Coupon Code Input */}
                <View style={styles.couponSection}>
                  <Text style={styles.sectionLabel}>Apply Active Reward Coupon</Text>
                  
                  {appliedCoupon ? (
                    <View style={styles.appliedCouponPill}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Tag size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.appliedCouponText}>
                          Coupon <Text style={{ fontWeight: 'bold' }}>{appliedCoupon.code}</Text> Applied (₹{appliedCoupon.pointsValue}.00 Off)
                        </Text>
                      </View>
                      <TouchableOpacity onPress={handleRemoveCoupon}>
                        <X size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.couponInputRow}>
                      <TextInput
                        label="Enter Coupon Code (e.g. SPH-XXXXXX)"
                        value={couponCode}
                        onChangeText={setCouponCode}
                        mode="outlined"
                        outlineColor={COLORS.border}
                        activeOutlineColor={COLORS.primary}
                        textColor={COLORS.text}
                        placeholderTextColor={COLORS.muted}
                        theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                        style={styles.couponInput}
                      />
                      <Button
                        mode="contained"
                        onPress={handleApplyCoupon}
                        buttonColor={COLORS.primary}
                        style={styles.couponApplyBtn}
                      >
                        Apply
                      </Button>
                    </View>
                  )}
                </View>

                {/* Reward Points Redemption */}
                <View style={styles.pointsSection}>
                  <Text style={styles.sectionLabel}>Redeem Wallet Points (₹1 = 1 Point)</Text>
                  <View style={styles.pointsInputRow}>
                    <TextInput
                      label={`Redeem Points (Max ${patient.rewardPoints} pts)`}
                      value={pointsRedeemed}
                      onChangeText={setPointsRedeemed}
                      keyboardType="numeric"
                      mode="outlined"
                      outlineColor={COLORS.border}
                      activeOutlineColor={COLORS.success}
                      textColor={COLORS.text}
                      placeholderTextColor={COLORS.muted}
                      theme={{ colors: { onSurfaceVariant: COLORS.muted } }}
                      style={styles.pointsInput}
                      placeholder="e.g. 20"
                    />
                    <Button
                      mode="outlined"
                      textColor={COLORS.success}
                      style={styles.pointsMaxBtn}
                      onPress={() => {
                        const maxRedeemable = Math.min(patient.rewardPoints, Math.max(0, subtotal - couponDiscount));
                        setPointsRedeemed(String(maxRedeemable));
                      }}
                    >
                      Max
                    </Button>
                  </View>
                  {patient.rewardPoints > 0 && (
                    <Text style={styles.ptsValHelp}>
                      Patient points worth: <Text style={{ color: COLORS.success, fontWeight: 'bold' }}>₹{patient.rewardPoints}.00</Text>
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Surface>

          {/* Billing Total Summary */}
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>Invoice Billing Summary</Text>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>₹{subtotal.toFixed(2)}</Text>
            </View>

            {couponDiscount > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: COLORS.primary }]}>Coupon Discount ({appliedCoupon?.code})</Text>
                <Text style={[styles.summaryVal, { color: COLORS.primary }]}>- ₹{couponDiscount.toFixed(2)}</Text>
              </View>
            )}

            {pointsDiscount > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: COLORS.success }]}>Wallet Points Redeemed</Text>
                <Text style={[styles.summaryVal, { color: COLORS.success }]}>- ₹{pointsDiscount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalVal}>₹{grandTotal.toFixed(2)}</Text>
            </View>

            <Button
              mode="contained"
              onPress={handleCompleteBilling}
              loading={completingBilling}
              disabled={completingBilling || products.length === 0}
              buttonColor={COLORS.success}
              style={styles.completeBillingBtn}
              contentStyle={{ paddingVertical: 6 }}
            >
              Complete Billing & Generate Invoice
            </Button>
          </Surface>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* BRANDEED LETTERHEAD INVOICE PREVIEW MODAL */}
        <Modal
          visible={invoiceModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setInvoiceModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Surface style={styles.modalContent}>
              
              {/* White Header Branding Block */}
              <View style={styles.invoiceHeaderBranding}>
                <View style={styles.brandingTopRow}>
                  <View style={styles.logoWhiteBox}>
                    <Image
                      source={require('../../../assets/SH logo.png')}
                      style={styles.invoiceLogo}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.headerRightContainer}>
                    <Globe size={12} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.clinicWeb}>https://spiritualhomeoclinic.com/</Text>
                  </View>
                </View>
              </View>

              <ScrollView contentContainerStyle={styles.invoiceContentScroll} showsVerticalScrollIndicator={false}>
                {/* Invoice Title & Metadata */}
                <View style={styles.invoiceMetaSection}>
                  <Text style={styles.invoiceTitleText}>OFFICIAL INVOICE</Text>
                  <View style={styles.metaGrid}>
                    <View>
                      <Text style={styles.metaLabel}>Invoice Number</Text>
                      <Text style={styles.metaValue}>{invoiceNumber}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.metaLabel}>Date & Time</Text>
                      <Text style={styles.metaValue}>{currentDateTime}</Text>
                    </View>
                  </View>
                </View>

                {/* Patient Information */}
                <View style={styles.invoicePatientSection}>
                  <Text style={styles.metaLabel}>PATIENT BILL-TO</Text>
                  <Text style={styles.invPatientName}>{patientName}</Text>
                  <Text style={styles.invPatientPhone}>Mobile: +91 {patientPhone}</Text>
                </View>

                {/* Invoice Items Table */}
                <View style={styles.invoiceItemsContainer}>
                  <View style={styles.invTableHeader}>
                    <Text style={[styles.invColHeader, styles.colSn]}>S.No</Text>
                    <Text style={[styles.invColHeader, styles.colName]}>Product / Medicine Description</Text>
                    <Text style={[styles.invColHeader, styles.colPrice, { textAlign: 'right' }]}>Amount</Text>
                  </View>

                  {products.map((item, idx) => (
                    <View key={item.id} style={styles.invTableRow}>
                      <Text style={[styles.invColRow, styles.colSn]}>{idx + 1}</Text>
                      <Text style={[styles.invColRow, styles.colName]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.invColRow, styles.colPrice, { textAlign: 'right', fontWeight: '500' }]}>₹{item.price.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Invoice Pricing Summary */}
                <View style={styles.invSummaryBox}>
                  <View style={styles.invSummaryRow}>
                    <Text style={styles.invSummaryLabel}>Subtotal</Text>
                    <Text style={styles.invSummaryVal}>₹{subtotal.toFixed(2)}</Text>
                  </View>
                  
                  {couponDiscount > 0 && (
                    <View style={styles.invSummaryRow}>
                      <Text style={[styles.invSummaryLabel, { color: COLORS.primary }]}>Coupon Discount ({appliedCoupon?.code})</Text>
                      <Text style={[styles.invSummaryVal, { color: COLORS.primary }]}>-₹{couponDiscount.toFixed(2)}</Text>
                    </View>
                  )}

                  {pointsDiscount > 0 && (
                    <View style={styles.invSummaryRow}>
                      <Text style={[styles.invSummaryLabel, { color: COLORS.success }]}>Points Redeemed</Text>
                      <Text style={[styles.invSummaryVal, { color: COLORS.success }]}>-₹{pointsDiscount.toFixed(2)}</Text>
                    </View>
                  )}

                  <View style={styles.invSummaryDivider} />

                  <View style={styles.invSummaryRow}>
                    <Text style={styles.invGrandLabel}>Grand Total Paid</Text>
                    <Text style={styles.invGrandVal}>₹{grandTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Green Footer Clinic Details Block */}
              <View style={styles.invoiceFooterBranding}>
                <View style={styles.footerRow}>
                  <View style={styles.footerCol}>
                    <Phone size={10} color="#ffffff" style={styles.footerIcon} />
                    <Text style={styles.footerText}>9069 176 176</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerCol}>
                    <Mail size={10} color="#ffffff" style={styles.footerIcon} />
                    <Text style={styles.footerText}>SPIRITUALHOMEO@GMAIL.COM</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerCol}>
                    <MapPin size={10} color="#ffffff" style={styles.footerIcon} />
                    <Text style={styles.footerText}>CHANDANAGAR, HYD, TS</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionButtons}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionShareBtn]} onPress={handleShareWhatsApp}>
                  <WhatsAppIcon size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.actionBtnText}>Share on WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, styles.actionCloseBtn]} onPress={handleResetForm}>
                  <Text style={[styles.actionBtnText, { color: COLORS.text }]}>Close / New Billing</Text>
                </TouchableOpacity>
              </View>

            </Surface>
          </View>
        </Modal>

      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  scrollContent: { padding: 16, gap: 16 },
  
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 3,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  cardSubtitle: { fontSize: 11, color: COLORS.muted, marginTop: 4, marginBottom: 12, lineHeight: 15 },
  
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, backgroundColor: COLORS.white },
  searchBtn: { height: 50, justifyContent: 'center', borderRadius: 8, minWidth: 60 },
  
  formRow: { flexDirection: 'row', gap: 10 },
  formInput: { backgroundColor: COLORS.white },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  dateTimeText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },

  productInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  formInputSmall: { backgroundColor: COLORS.white, fontSize: 12 },
  addProductBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 6
  },
  
  tableContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center'
  },
  tableCol: { fontSize: 12, color: COLORS.text },
  headerText: { fontWeight: '700', color: COLORS.muted },
  colSn: { flex: 0.15, textAlign: 'center' },
  colName: { flex: 0.55 },
  colPrice: { flex: 0.2, textAlign: 'right' },
  colAction: { flex: 0.1, alignItems: 'center' },
  
  emptyCartContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: { fontSize: 11, color: COLORS.muted, fontStyle: 'italic' },

  patientWalletIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  patientWalletIndicatorText: { fontSize: 11, color: '#b45309', fontWeight: 'bold' },
  
  noProfileWarning: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  noProfileWarningText: { fontSize: 11, color: COLORS.muted, textAlign: 'center', lineHeight: 16 },
  
  couponSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  couponInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  couponInput: { flex: 1, backgroundColor: COLORS.white, fontSize: 12 },
  couponApplyBtn: { height: 48, justifyContent: 'center', borderRadius: 8 },
  appliedCouponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10
  },
  appliedCouponText: { fontSize: 12, color: COLORS.success },

  pointsSection: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  pointsInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pointsInput: { flex: 1, backgroundColor: COLORS.white, fontSize: 12 },
  pointsMaxBtn: { height: 48, justifyContent: 'center', borderRadius: 8, borderColor: COLORS.success },
  ptsValHelp: { fontSize: 11, color: COLORS.muted, marginTop: 6 },

  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryLabel: { fontSize: 13, color: COLORS.muted },
  summaryVal: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  grandTotalVal: { fontSize: 18, fontWeight: '800', color: COLORS.success },
  completeBillingBtn: { marginTop: 14, borderRadius: 10 },

  // Brand letterhead modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  
  // White Header Branding
  invoiceHeaderBranding: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#258ec8',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  brandingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  logoWhiteBox: {
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceLogo: {
    width: 100,
    height: 35,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicWeb: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  invoiceContentScroll: {
    padding: 20,
  },
  invoiceMetaSection: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  invoiceTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1b3b6f',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: 2,
  },

  invoicePatientSection: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  invPatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  invPatientPhone: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },

  invoiceItemsContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  invTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  invColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  invTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  invColRow: {
    fontSize: 11,
    color: COLORS.text,
  },

  invSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  invSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  invSummaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
  },
  invSummaryVal: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  invSummaryDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  invGrandLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  invGrandVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.success,
  },

  // Green Footer Branding
  invoiceFooterBranding: {
    backgroundColor: '#a8ce3a', // SPH Light Green
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIcon: {
    marginRight: 4,
  },
  footerText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
  footerDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#ffffff',
  },

  modalActionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  actionShareBtn: {
    backgroundColor: '#25d366', // WhatsApp Green
  },
  actionCloseBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  }
});

export default RewardPointClaim;
