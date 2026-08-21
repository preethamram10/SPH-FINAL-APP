import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator, FlatList, Modal, Clipboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Surface, RadioButton, Switch, Chip, IconButton, Divider } from 'react-native-paper';
import { ChevronLeft, MapPin, Send, Package, Globe, Truck, Ruler, Scale, FileText, ShieldCheck, CheckCircle2, AlertTriangle, Info, RefreshCw, ExternalLink, History, Search, Eye, EyeOff, Copy, Printer, X, CreditCard, DollarSign, Smartphone } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import {
  createAdhocOrder,
  getServiceability,
  assignAWB,
  schedulePickup,
  generateLabel,
  generateManifest,
  printManifest,
  trackShipment
} from '../../utils/shiprocketService';

const COLORS = {
  primary: '#258ec8', // SPH Blue
  accent: '#a8ce3a', // SPH Lime Green
  text: '#0f172a', // Dark Slate
  muted: '#64748b', // Slate Gray
  background: '#f8fafc', // Very Light Gray/Blue
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  primaryLight: 'rgba(37, 142, 200, 0.06)',
  accentLight: 'rgba(168, 206, 58, 0.08)'
};

const inputTheme = {
  colors: {
    onSurface: '#000000',
    onSurfaceVariant: '#64748b',
    placeholder: '#64748b'
  }
};

const ShippingForm = ({ navigation }) => {
  const { userData, user } = useAuth();
  
  // Navigation & Tab state ('history' or 'create')
  const [activeTab, setActiveTab] = useState('history');
  const [wizardStep, setWizardStep] = useState(1);
  const [shippingType, setShippingType] = useState('National');
  
  // Sender Details
  const [fromAddress, setFromAddress] = useState('spiritual homeopathy dilsukhnagar , Durganagar Rd, Krishna Nagar, Dilsukhnagar, Hyderabad, Telangana');
  const [fromPincode, setFromPincode] = useState('500060');
  const [fromPhone, setFromPhone] = useState('9176176176');

  // Customer Details
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [toCity, setToCity] = useState('');
  const [toState, setToState] = useState('');
  const [toCountry, setToCountry] = useState('India');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Package Details
  const [deadWeight, setDeadWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [orderValue, setOrderValue] = useState('');

  // Shipping Preferences
  const [isCod, setIsCod] = useState(false);
  const [paymentMode, setPaymentMode] = useState('UPI');

  // Estimator States
  const [baseFee, setBaseFee] = useState(0);
  const [codCharge, setCodCharge] = useState(0);
  const [fuelSurcharge, setFuelSurcharge] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  // Step 2 Booking States
  const [couriersList, setCouriersList] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [currentShipmentId, setCurrentShipmentId] = useState('');
  const [currentShipmentDocId, setCurrentShipmentDocId] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [currentAwb, setCurrentAwb] = useState('');
  const [isPickupScheduled, setIsPickupScheduled] = useState(false);
  const [currentLabelUrl, setCurrentLabelUrl] = useState('');
  const [currentManifestUrl, setCurrentManifestUrl] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // History List States
  const [shipments, setShipments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [revealedPhones, setRevealedPhones] = useState({});

  // Live Tracking Modal States
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingAwb, setTrackingAwb] = useState('');
  const [syncingStatuses, setSyncingStatuses] = useState(false);

  // Real-time listener for Shipping requests
  useEffect(() => {
    const q = query(collection(db, 'shipping_requests'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setShipments(list);
      setLoadingHistory(false);
    }, (error) => {
      console.error('Error loading history:', error);
      setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, []);

  // Dynamic estimate calculator using live Shiprocket API (Option B)
  useEffect(() => {
    const cleanPincode = (pincode || '').trim();
    const cleanWeight = parseFloat(deadWeight);
    
    if (cleanPincode.length === 6 && /^\d+$/.test(cleanPincode) && cleanWeight > 0) {
      const fetchEstimate = async () => {
        setLoadingEstimate(true);
        setEstimateError('');
        try {
          const res = await getServiceability(fromPincode, cleanPincode, cleanWeight, isCod);
          if (res && res.data && res.data.available_courier_companies && res.data.available_courier_companies.length > 0) {
            const couriers = res.data.available_courier_companies;
            const cheapest = couriers.reduce((min, c) => parseFloat(c.rate) < parseFloat(min.rate) ? c : min, couriers[0]);
            
            const total = parseFloat(cheapest.rate);
            const codChg = isCod ? (parseFloat(cheapest.cod_charges) || 0) : 0;
            const fuel = parseFloat(cheapest.fuel_surcharge) || 0;
            const base = total - codChg - fuel;

            setBaseFee(base);
            setCodCharge(codChg);
            setFuelSurcharge(fuel);
            setTotalCost(total);
          } else {
            setEstimateError('No couriers serviceable for this pincode.');
            setTotalCost(0);
          }
        } catch (err) {
          console.error('Error fetching live estimate:', err);
          setEstimateError('Could not fetch live rates.');
          setTotalCost(0);
        } finally {
          setLoadingEstimate(false);
        }
      };
      
      const delayDebounceFn = setTimeout(() => {
        fetchEstimate();
      }, 600);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setTotalCost(0);
      setBaseFee(0);
      setCodCharge(0);
      setFuelSurcharge(0);
      setEstimateError('');
    }
  }, [pincode, deadWeight, isCod, fromPincode]);

  // Fetch available couriers from Shiprocket when entering Step 2
  useEffect(() => {
    if (wizardStep === 2 && pincode) {
      const fetchCouriers = async () => {
        setLoadingCouriers(true);
        try {
          const res = await getServiceability(
            fromPincode,
            pincode,
            parseFloat(deadWeight) || 0.5,
            isCod
          );

          if (res && res.data && res.data.available_courier_companies) {
            setCouriersList(res.data.available_courier_companies);
            if (res.data.available_courier_companies.length > 0) {
              setSelectedCourier(res.data.available_courier_companies[0].courier_company_id.toString());
            } else {
              setSelectedCourier('');
            }
          } else {
            setCouriersList([]);
            setSelectedCourier('');
          }
        } catch (err) {
          console.error('Error fetching couriers:', err);
          setCouriersList([]);
          setSelectedCourier('');
        } finally {
          setLoadingCouriers(false);
        }
      };
      fetchCouriers();
    }
  }, [wizardStep, pincode, deadWeight, isCod, fromPincode]);

  const handleProceedToShip = async () => {
    if (!fullName || !phoneNumber || !emailAddress || !pincode || !deliveryAddress || !toCity || !toState || !deadWeight || !itemDescription || !quantity || !orderValue || !fromAddress || !fromPincode || !fromPhone) {
      Alert.alert('Validation Error', 'Please fill all mandatory fields before proceeding.');
      return;
    }

    setBookingLoading(true);

    const generatedOrderId = `SPH-ORD-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const sizeParts = (dimensions || '10 x 10 x 10').split('x').map(s => parseInt(s.trim()) || 10);
    const length = sizeParts[0] || 10;
    const width = sizeParts[1] || 10;
    const height = sizeParts[2] || 10;

    const skuStr = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    const names = fullName.trim().split(/\s+/);
    const firstName = names[0] || 'Customer';
    const lastName = names.slice(1).join(' ') || '.';
    const orderDateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const shiprocketOrderPayload = {
      order_id: generatedOrderId,
      order_date: orderDateStr,
      pickup_location: 'work',
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: deliveryAddress,
      billing_city: toCity,
      billing_pincode: parseInt(pincode) || 560001,
      billing_state: toState,
      billing_country: shippingType === 'National' ? 'India' : toCountry,
      billing_email: emailAddress || 'no-email@sph.com',
      billing_phone: phoneNumber.replace(/[^0-9]/g, '').slice(-10),
      shipping_is_billing: true,
      order_items: [
        {
          name: itemDescription,
          sku: skuStr,
          units: parseInt(quantity) || 1,
          selling_price: parseFloat(orderValue).toString(),
          discount: 0,
          tax: 0
        }
      ],
      payment_method: isCod ? 'COD' : 'Prepaid',
      sub_total: parseFloat(orderValue),
      length: length,
      breadth: width,
      height: height,
      weight: parseFloat(deadWeight) || 0.5
    };

    let srOrderIdReal = '';
    let srShipmentId = '';

    try {
      const orderResponse = await createAdhocOrder(shiprocketOrderPayload);
      if (orderResponse && orderResponse.shipment_id) {
        srOrderIdReal = orderResponse.order_id;
        srShipmentId = orderResponse.shipment_id;
      } else {
        throw new Error(orderResponse.message || 'No shipment_id returned from Shiprocket');
      }

      const payload = {
        userId: user?.uid || 'guest',
        staffName: userData?.name || 'Staff Member',
        branchId: userData?.branchId || '',
        shippingType,
        pickupLocation: 'work',
        fromAddress: fromAddress,
        fromPincode: fromPincode,
        fromPhone: fromPhone,
        toName: fullName,
        toPhone: phoneNumber,
        toEmail: emailAddress,
        toAddress: deliveryAddress,
        toPincode: pincode,
        toCity,
        toState,
        toCountry: shippingType === 'National' ? 'India' : toCountry,
        weight: parseFloat(deadWeight) || 0.5,
        length,
        width,
        height,
        contents: itemDescription,
        orderItems: [{
          name: itemDescription,
          sku: skuStr,
          units: parseInt(quantity) || 1,
          sellingPrice: parseFloat(orderValue)
        }],
        paymentMethod: isCod ? 'COD' : 'Prepaid',
        paymentMode: paymentMode,
        subTotal: parseFloat(orderValue),
        packageDetails: `${deadWeight} kg | ${itemDescription} | Dims: ${dimensions || 'Default 10x10x10'}`,
        status: 'new',
        provider: 'Shiprocket',
        shiprocketOrderId: generatedOrderId,
        shiprocketOrderIdReal: srOrderIdReal,
        shiprocketShipmentId: srShipmentId,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'shipping_requests'), payload);
      setCurrentShipmentDocId(docRef.id);
      setCurrentOrderId(generatedOrderId);
      setCurrentShipmentId(srShipmentId);
      
      setWizardStep(2);
    } catch (err) {
      console.error(err);
      Alert.alert('Booking Error', `Failed to register order: ${err.message}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedCourier) {
      Alert.alert('Error', 'Please choose a courier to book.');
      return;
    }

    setBookingLoading(true);
    try {
      const awbRes = await assignAWB(currentShipmentId, selectedCourier);
      const awbCode = awbRes.response.data.awb_code;

      // Wait for Shiprocket to propagate AWB assignment before scheduling pickup
      // This prevents the "Awb not Assigned" 400 error due to their internal processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Retry pickup scheduling up to 3 times in case AWB is still propagating
      let pickupDone = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await schedulePickup(currentShipmentId);
          pickupDone = true;
          break;
        } catch (pickupErr) {
          console.warn(`Pickup attempt ${attempt} failed:`, pickupErr.message);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            throw pickupErr;
          }
        }
      }

      const labelRes = await generateLabel(currentShipmentId);
      const labelUrl = labelRes.label_created ? labelRes.label_url : '';

      let manifestUrl = '';
      try {
        const manifestRes = await generateManifest(currentShipmentId);
        if (manifestRes.manifest_status) {
          const printRes = await printManifest(currentShipmentId);
          manifestUrl = printRes.manifest_url || '';
        }
      } catch (e) {
        console.warn('Manifest error', e);
      }

      const docRef = doc(db, 'shipping_requests', currentShipmentDocId);
      const courierName = couriersList.find(c => c.courier_company_id.toString() === selectedCourier)?.courier_name || 'Assigned Courier';
      
      await updateDoc(docRef, {
        status: 'awb assigned',
        courierName,
        awbCode,
        trackingUrl: `https://track.shiprocket.co/${awbCode}`,
        labelUrl,
        manifestUrl,
        shippedAt: new Date().toISOString()
      });

      setCurrentAwb(awbCode);
      setCurrentLabelUrl(labelUrl);
      setCurrentManifestUrl(manifestUrl);
      setIsPickupScheduled(true);
      
      Alert.alert('Success', `Manifest booked & assigned with ${courierName}!`);
    } catch (err) {
      console.error(err);
      Alert.alert('Booking Error', `Failed to confirm booking: ${err.message}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // Ship Now function for drafts in history list
  const handleShipNow = async (shipment) => {
    setBookingLoading(true);
    const orderIdVal = shipment.shiprocketOrderId || `SPH-ORD-${Math.floor(10000000 + Math.random() * 90000000)}`;
    let shid = shipment.shiprocketShipmentId || '';

    if (!shid) {
      try {
        const names = (shipment.toName || 'Customer').trim().split(/\s+/);
        const firstName = names[0] || 'Customer';
        const lastName = names.slice(1).join(' ') || '.';
        const skuStr = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
        const orderDateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        
        const sizeParts = (shipment.length && shipment.width && shipment.height)
          ? [shipment.length, shipment.width, shipment.height]
          : (shipment.dimensions || '10 x 10 x 10').split('x').map(s => parseInt(s.trim()) || 10);
        
        const length = sizeParts[0] || 10;
        const width = sizeParts[1] || 10;
        const height = sizeParts[2] || 10;

        const shiprocketOrderPayload = {
          order_id: orderIdVal,
          order_date: orderDateStr,
          pickup_location: 'work',
          billing_customer_name: firstName,
          billing_last_name: lastName,
          billing_address: shipment.toAddress,
          billing_city: shipment.toCity || 'City',
          billing_pincode: parseInt(shipment.toPincode) || 560001,
          billing_state: shipment.toState || 'State',
          billing_country: shipment.shippingType === 'National' ? 'India' : (shipment.toCountry || 'India'),
          billing_email: shipment.toEmail || 'no-email@sph.com',
          billing_phone: shipment.toPhone.replace(/[^0-9]/g, '').slice(-10),
          shipping_is_billing: true,
          order_items: [
            {
              name: shipment.contents || 'Medicines',
              sku: skuStr,
              units: shipment.orderItems?.[0]?.units || 1,
              selling_price: parseFloat(shipment.subTotal).toString(),
              discount: 0,
              tax: 0
            }
          ],
          payment_method: shipment.paymentMethod || 'Prepaid',
          sub_total: parseFloat(shipment.subTotal),
          length: length,
          breadth: width,
          height: height,
          weight: parseFloat(shipment.weight) || 0.5
        };

        const orderResponse = await createAdhocOrder(shiprocketOrderPayload);
        shid = orderResponse.shipment_id;
        if (shid) {
          await updateDoc(doc(db, 'shipping_requests', shipment.id), {
            shiprocketOrderId: orderIdVal,
            shiprocketOrderIdReal: orderResponse.order_id,
            shiprocketShipmentId: shid
          });
        }
      } catch (err) {
        console.error('Ship Now registration error:', err);
        Alert.alert('Booking Error', 'Failed to register order in Shiprocket: ' + err.message);
        setBookingLoading(false);
        return;
      }
    }

    // Populate state with this draft order details
    setFromAddress(shipment.fromAddress || 'spiritual homeopathy dilsukhnagar , Durganagar Rd, Krishna Nagar, Dilsukhnagar, Hyderabad, Telangana');
    setFromPincode(shipment.fromPincode || '500060');
    setFromPhone(shipment.fromPhone || '9176176176');
    setFullName(shipment.toName || '');
    setPhoneNumber(shipment.toPhone || '');
    setEmailAddress(shipment.toEmail || '');
    setPincode(shipment.toPincode || '');
    setToCity(shipment.toCity || '');
    setToState(shipment.toState || '');
    setToCountry(shipment.toCountry || 'India');
    setDeliveryAddress(shipment.toAddress || '');
    setDeadWeight((shipment.weight || 0.5).toString());
    setDimensions(shipment.dimensions || '');
    setItemDescription(shipment.contents || 'Medicines');
    setQuantity((shipment.orderItems?.[0]?.units || 1).toString());
    setOrderValue((shipment.subTotal || 0).toString());
    setIsCod(shipment.paymentMethod === 'COD');
    setPaymentMode(shipment.paymentMode || (shipment.paymentMethod === 'COD' ? 'COD' : 'UPI'));

    setCurrentShipmentDocId(shipment.id);
    setCurrentShipmentId(shid);
    setCurrentOrderId(orderIdVal);
    setCurrentAwb(shipment.awbCode || '');
    setIsPickupScheduled(false);
    setCurrentLabelUrl(shipment.labelUrl || '');
    setCurrentManifestUrl(shipment.manifestUrl || '');

    setBookingLoading(false);
    setActiveTab('create');
    setWizardStep(2);
  };

  const handleViewTracking = async (awbCode) => {
    if (!awbCode) {
      Alert.alert('Error', 'No AWB code available for tracking.');
      return;
    }
    setTrackingAwb(awbCode);
    setTrackingModalVisible(true);
    setLoadingTracking(true);
    setTrackingData(null);
    try {
      const res = await trackShipment(awbCode);
      if (res && res.tracking_data) {
        setTrackingData(res.tracking_data);
      } else {
        setTrackingData({ error: 'No live tracking logs available for this AWB.' });
      }
    } catch (err) {
      console.error('Tracking fetch error:', err);
      setTrackingData({ error: 'Failed to retrieve tracking details.' });
    } finally {
      setLoadingTracking(false);
    }
  };

  const openUrl = async (url) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', "Can't open this link.");
    }
  };

  const togglePhoneReveal = (id) => {
    setRevealedPhones(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text, label) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard!`);
  };

  const handleSyncStatuses = async () => {
    const pendingSync = shipments.filter(s => 
      s.awbCode && 
      s.status !== 'delivered' && 
      s.status !== 'cancelled'
    );

    if (pendingSync.length === 0) {
      Alert.alert('Info', 'All shipments are already up to date.');
      return;
    }

    setSyncingStatuses(true);
    let successCount = 0;

    for (const shipment of pendingSync) {
      try {
        const res = await trackShipment(shipment.awbCode);
        if (res && res.tracking_data && res.tracking_data.shipment_track?.[0]) {
          const liveStatus = (res.tracking_data.shipment_track[0].current_status || '').toLowerCase();
          
          let mappedStatus = shipment.status;
          if (liveStatus.includes('deliver')) {
            mappedStatus = 'delivered';
          } else if (liveStatus.includes('transit') || liveStatus.includes('pick') || liveStatus.includes('shipped') || liveStatus.includes('ready')) {
            mappedStatus = 'in transit';
          } else if (liveStatus.includes('out for delivery') || liveStatus.includes('out_for_delivery')) {
            mappedStatus = 'out for delivery';
          } else if (liveStatus.includes('rto') || liveStatus.includes('return')) {
            mappedStatus = 'rto';
          } else if (liveStatus.includes('cancel')) {
            mappedStatus = 'cancelled';
          } else if (liveStatus.includes('awb') || liveStatus.includes('manifest')) {
            mappedStatus = 'awb assigned';
          }

          if (mappedStatus !== shipment.status) {
            await updateDoc(doc(db, 'shipping_requests', shipment.id), {
              status: mappedStatus
            });
          }
          successCount++;
        }
      } catch (err) {
        console.warn('Sync failed for AWB:', shipment.awbCode, err);
      }
    }

    setSyncingStatuses(false);
    Alert.alert('Success', `Synced ${successCount} shipment statuses successfully!`);
  };

  // Filter Logic for shipments history
  const filteredShipments = shipments.filter(ship => {
    const matchesSearch = 
      (ship.toName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ship.toPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ship.shiprocketOrderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ship.awbCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    if (statusFilter === 'all') return matchesSearch;
    
    const dbStatus = (ship.status || 'new').toLowerCase();
    
    if (statusFilter === 'new') {
      return matchesSearch && (dbStatus === 'new' || dbStatus === 'pending');
    }
    if (statusFilter === 'in transit') {
      return matchesSearch && (dbStatus === 'in transit' || dbStatus === 'shipped' || dbStatus === 'in-transit');
    }
    return matchesSearch && dbStatus === statusFilter.toLowerCase();
  });

  const getStatusBorderColor = (status) => {
    const s = (status || 'new').toLowerCase();
    if (s === 'delivered') return COLORS.success;
    if (s === 'cancelled') return COLORS.danger;
    if (s === 'in transit' || s === 'shipped' || s === 'awb assigned') return COLORS.primary;
    return COLORS.warning;
  };

  const getPaymentIcon = (mode) => {
    if (mode === 'Card') return <CreditCard size={18} color={paymentMode === 'Card' ? COLORS.primary : COLORS.muted} />;
    if (mode === 'Cash') return <DollarSign size={18} color={paymentMode === 'Cash' ? COLORS.primary : COLORS.muted} />;
    if (mode === 'COD') return <Truck size={18} color={paymentMode === 'COD' ? COLORS.primary : COLORS.muted} />;
    return <Smartphone size={18} color={paymentMode === 'UPI' ? COLORS.primary : COLORS.muted} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* App Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shiprocket Dispatch Hub</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* iOS-Style Pill Segmented Control Tab Swapper */}
      <View style={styles.tabContainerOuter}>
        <View style={styles.tabBarPill}>
          <TouchableOpacity 
            style={[styles.tabBtnPill, activeTab === 'history' && styles.tabBtnPillActive]}
            onPress={() => setActiveTab('history')}
          >
            <History size={15} color={activeTab === 'history' ? COLORS.primary : COLORS.muted} />
            <Text style={[styles.tabBtnPillText, activeTab === 'history' && styles.tabBtnPillTextActive]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtnPill, activeTab === 'create' && styles.tabBtnPillActive]}
            onPress={() => {
              setActiveTab('create');
              setWizardStep(1); // Reset wizard
              setFullName('');
              setPhoneNumber('');
              setEmailAddress('');
              setPincode('');
              setToCity('');
              setToState('');
              setDeliveryAddress('');
              setDeadWeight('');
              setDimensions('');
              setItemDescription('');
              setQuantity('');
              setOrderValue('');
              setIsPickupScheduled(false);
            }}
          >
            <Package size={15} color={activeTab === 'create' ? COLORS.primary : COLORS.muted} />
            <Text style={[styles.tabBtnPillText, activeTab === 'create' && styles.tabBtnPillTextActive]}>Dispatch</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'history' ? (
        <View style={{ flex: 1 }}>
          {/* History Search & Filter UI */}
          <View style={styles.filterSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                mode="outlined"
                placeholder="Search patient, phone, order ID..."
                placeholderTextColor="#64748b"
                theme={inputTheme}
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={[styles.searchBar, { flex: 1, height: 44 }]}
                activeOutlineColor={COLORS.primary}
                outlineColor={COLORS.border}
                left={<TextInput.Icon icon={() => <Search size={16} color={COLORS.muted} />} />}
              />
              <TouchableOpacity 
                onPress={handleSyncStatuses} 
                disabled={syncingStatuses}
                style={styles.syncBtnPill}
              >
                {syncingStatuses ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <RefreshCw size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingRight: 16 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'new', label: 'Draft' },
                { key: 'awb assigned', label: 'AWB Assigned' },
                { key: 'in transit', label: 'In Transit' },
                { key: 'out for delivery', label: 'Out for Delivery' },
                { key: 'delivered', label: 'Delivered' },
                { key: 'rto', label: 'RTO' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map((status) => (
                <Chip
                  key={status.key}
                  selected={statusFilter === status.key}
                  onPress={() => setStatusFilter(status.key)}
                  style={[styles.chip, statusFilter === status.key && styles.chipActive]}
                  textStyle={[styles.chipText, statusFilter === status.key && styles.chipTextActive]}
                  showSelectedOverlay={false}
                >
                  {status.label.toUpperCase()}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {loadingHistory ? (
            <View style={styles.historyLoader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loaderSub}>Synchronizing logistics timeline...</Text>
            </View>
          ) : filteredShipments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={42} color={COLORS.border} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Dispatches Found</Text>
              <Text style={styles.emptySub}>No orders match the selected logistical stage.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredShipments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
              renderItem={({ item }) => {
                const isShipped = item.status === 'shipped' || item.status === 'awb assigned' || item.status === 'in transit' || item.status === 'out for delivery' || item.status === 'delivered';
                const isNew = item.status === 'new' || item.status === 'pending';
                const isCancelled = item.status === 'cancelled';
                const showPhone = revealedPhones[item.id];

                const handleCardPress = () => {
                  if (item.awbCode) {
                    handleViewTracking(item.awbCode);
                  } else if (item.status === 'new' || item.status === 'pending') {
                    handleShipNow(item);
                  }
                };

                return (
                  <TouchableOpacity 
                    onPress={handleCardPress}
                    activeOpacity={0.85}
                    style={[styles.historyCard, { borderLeftColor: getStatusBorderColor(item.status) }]}
                  >
                    {/* Card Header */}
                    <View style={styles.hCardHeader}>
                      <View style={{ flex: 1 }}>
                        <TouchableOpacity 
                          onPress={() => copyToClipboard(item.shiprocketOrderId, 'Order ID')}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Text style={styles.hOrderId}>{item.shiprocketOrderId || 'Draft Order'}</Text>
                          <Copy size={11} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={styles.hStaffName}>Logged by: {item.staffName || 'Staff'}</Text>
                      </View>
                      <View style={[
                        styles.hBadge,
                        { backgroundColor: getStatusBorderColor(item.status) + '10' }
                      ]}>
                        <Text style={[
                          styles.hBadgeText,
                          { color: getStatusBorderColor(item.status) }
                        ]}>
                          {(item.status || 'new').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 6, backgroundColor: COLORS.border }} />

                    {/* Recipient Details */}
                    <View style={styles.infoRow}>
                      <MapPin size={13} color={COLORS.primary} style={{ marginTop: 2, marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recipientName}>{item.toName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Text style={styles.recipientPhone}>
                            {showPhone ? item.toPhone : (item.toPhone || '').replace(/.(?=.{4})/g, '*')}
                          </Text>
                          <TouchableOpacity onPress={() => togglePhoneReveal(item.id)} style={{ marginLeft: 6 }}>
                            {showPhone ? <EyeOff size={13} color={COLORS.muted} /> : <Eye size={13} color={COLORS.muted} />}
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.recipientAddr}>{item.toAddress}</Text>
                        <Text style={styles.recipientPin}>PIN: {item.toPincode} • {item.toCity}</Text>
                      </View>
                    </View>

                    {/* Package Info */}
                    <View style={[styles.infoRow, { marginTop: 6 }]}>
                      <Package size={13} color={COLORS.warning} style={{ marginTop: 2, marginRight: 8 }} />
                      <Text style={styles.pkgDetailsText}>{item.packageDetails || `${item.weight || 0.5} KG | ${item.contents || 'Medicines'}`}</Text>
                    </View>

                    {isShipped && item.awbCode ? (
                      <TouchableOpacity 
                        onPress={() => copyToClipboard(item.awbCode, 'AWB Code')}
                        style={styles.awbBannerMini}
                      >
                        <Truck size={13} color={COLORS.success} style={{ marginRight: 6 }} />
                        <Text style={styles.awbLabelMini}>{item.courierName || 'Courier'}: </Text>
                        <Text style={styles.awbValMini}>{item.awbCode}</Text>
                        <Copy size={11} color={COLORS.success} style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Card Actions */}
                    <View style={styles.hCardActions}>
                      {isNew ? (
                        <Button
                          mode="contained"
                          icon={() => <Send size={13} color={COLORS.white} />}
                          onPress={() => handleShipNow(item)}
                          disabled={bookingLoading}
                          buttonColor={COLORS.primary}
                          style={styles.shipNowBtn}
                          labelStyle={styles.actionBtnTextMobile}
                        >
                          Book Courier
                        </Button>
                      ) : (
                        <View style={styles.shippedButtonsRow}>
                          {item.awbCode ? (
                            <TouchableOpacity onPress={() => handleViewTracking(item.awbCode)} style={[styles.actionBtnMini, { backgroundColor: 'rgba(37, 142, 200, 0.08)' }]}>
                              <ExternalLink size={11} color={COLORS.primary} />
                              <Text style={[styles.actionBtnMiniText, { color: COLORS.primary }]}>Track</Text>
                            </TouchableOpacity>
                          ) : null}

                          {item.labelUrl ? (
                            <TouchableOpacity onPress={() => openUrl(item.labelUrl)} style={[styles.actionBtnMini, { backgroundColor: 'rgba(168, 206, 58, 0.08)' }]}>
                              <Printer size={11} color={COLORS.accent} />
                              <Text style={[styles.actionBtnMiniText, { color: COLORS.accent }]}>Label</Text>
                            </TouchableOpacity>
                          ) : null}

                          {item.manifestUrl ? (
                            <TouchableOpacity onPress={() => openUrl(item.manifestUrl)} style={[styles.actionBtnMini, { backgroundColor: 'rgba(100, 116, 139, 0.08)' }]}>
                              <FileText size={11} color={COLORS.muted} />
                              <Text style={[styles.actionBtnMiniText, { color: COLORS.muted }]}>Manifest</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Stepper Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <View style={[styles.progressNode, wizardStep >= 1 && styles.progressNodeActive]}>
                <Text style={[styles.progressNodeText, wizardStep >= 1 && styles.progressNodeTextActive]}>1</Text>
              </View>
              <View style={[styles.progressLine, wizardStep >= 2 && styles.progressLineActive]} />
              <View style={[styles.progressNode, wizardStep >= 2 && styles.progressNodeActive]}>
                <Text style={[styles.progressNodeText, wizardStep >= 2 && styles.progressNodeTextActive]}>2</Text>
              </View>
            </View>
            <View style={styles.progressLabelsRow}>
              <Text style={[styles.progressLabel, wizardStep >= 1 && styles.progressLabelActive]}>Order Details</Text>
              <Text style={[styles.progressLabel, wizardStep >= 2 && styles.progressLabelActive]}>Select Courier</Text>
            </View>
          </View>

          {wizardStep === 1 ? (
            <View>
              {/* Shipping Mode switcher card */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Shipping Mode</Text>
                </View>
                <View style={styles.switchContainer}>
                  <TouchableOpacity 
                    onPress={() => { setShippingType('National'); setToCountry('India'); }}
                    style={[styles.switchBtn, shippingType === 'National' && styles.switchBtnActive]}
                  >
                    <MapPin size={15} color={shippingType === 'National' ? COLORS.primary : COLORS.muted} />
                    <Text style={[styles.switchLabel, shippingType === 'National' && styles.switchLabelActive]}>Domestic</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setShippingType('International')}
                    style={[styles.switchBtn, shippingType === 'International' && styles.switchBtnActive]}
                  >
                    <Globe size={15} color={shippingType === 'International' ? COLORS.primary : COLORS.muted} />
                    <Text style={[styles.switchLabel, shippingType === 'International' && styles.switchLabelActive]}>International</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sender Address Pickup panel */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Sender Pickup Details</Text>
                </View>
                <TextInput
                  mode="outlined"
                  label="Sender Address *"
                  placeholder="Full branch address"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={fromAddress}
                  onChangeText={setFromAddress}
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      mode="outlined"
                      label="Sender Pincode *"
                      placeholder="500060"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={fromPincode}
                      onChangeText={setFromPincode}
                      keyboardType="number-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      mode="outlined"
                      label="Sender Mobile *"
                      placeholder="9176176176"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={fromPhone}
                      onChangeText={setFromPhone}
                      keyboardType="phone-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                </View>
              </View>

              {/* Customer Details panel */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Customer Details</Text>
                </View>
                <TextInput
                  mode="outlined"
                  label="Full Name *"
                  placeholder="e.g. Rohan Sharma"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <TextInput
                  mode="outlined"
                  label="Phone Number *"
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <TextInput
                  mode="outlined"
                  label="Email Address *"
                  placeholder="e.g. customer@gmail.com"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  keyboardType="email-address"
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <TextInput
                  mode="outlined"
                  label="Delivery Address *"
                  placeholder="No, Street, Area details"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                  numberOfLines={2}
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      mode="outlined"
                      label="Pincode *"
                      placeholder="560001"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={pincode}
                      onChangeText={setPincode}
                      keyboardType="number-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      mode="outlined"
                      label="City *"
                      placeholder="Bengaluru"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={toCity}
                      onChangeText={setToCity}
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: shippingType === 'International' ? 8 : 0 }}>
                    <TextInput
                      mode="outlined"
                      label="State *"
                      placeholder="Karnataka"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={toState}
                      onChangeText={setToState}
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                  {shippingType === 'International' && (
                    <View style={{ flex: 1 }}>
                      <TextInput
                        mode="outlined"
                        label="Country *"
                        placeholder="United Kingdom"
                        placeholderTextColor="#64748b"
                        theme={inputTheme}
                        value={toCountry}
                        onChangeText={setToCountry}
                        style={styles.input}
                        activeOutlineColor={COLORS.primary}
                        outlineColor={COLORS.border}
                      />
                    </View>
                  )}
                </View>
              </View>

              {/* Package Details panel */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Package Details</Text>
                </View>
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      mode="outlined"
                      label="Dead Weight (KG) *"
                      placeholder="e.g. 0.5"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={deadWeight}
                      onChangeText={setDeadWeight}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      mode="outlined"
                      label="Dims (L x W x H CM) (Optional)"
                      placeholder="e.g. 10 x 10 x 10"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={dimensions}
                      onChangeText={setDimensions}
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                </View>
                <TextInput
                  mode="outlined"
                  label="Item Description *"
                  placeholder="e.g. Medicines"
                  placeholderTextColor="#64748b"
                  theme={inputTheme}
                  value={itemDescription}
                  onChangeText={setItemDescription}
                  style={styles.input}
                  activeOutlineColor={COLORS.primary}
                  outlineColor={COLORS.border}
                />
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      mode="outlined"
                      label="Quantity *"
                      placeholder="e.g. 1"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={quantity.toString()}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      mode="outlined"
                      label="Order Value (₹) *"
                      placeholder="e.g. 500.00"
                      placeholderTextColor="#64748b"
                      theme={inputTheme}
                      value={orderValue}
                      onChangeText={setOrderValue}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      activeOutlineColor={COLORS.primary}
                      outlineColor={COLORS.border}
                    />
                  </View>
                </View>
              </View>

              {/* Mode of Payment */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Mode of Payment</Text>
                </View>

                <RadioButton.Group 
                  onValueChange={(val) => {
                    setIsCod(val === 'COD');
                    setPaymentMode(val);
                  }}
                  value={isCod ? 'COD' : 'Prepaid'}
                >
                  <View style={{ flexDirection: 'row', gap: 24, marginTop: 4, alignItems: 'center' }}>
                    <TouchableOpacity 
                      onPress={() => { setIsCod(false); setPaymentMode('Prepaid'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <RadioButton.Android value="Prepaid" color={COLORS.primary} uncheckedColor={COLORS.muted} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Prepaid</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => { setIsCod(true); setPaymentMode('COD'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <RadioButton.Android value="COD" color={COLORS.primary} uncheckedColor={COLORS.muted} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Cash on Delivery (COD)</Text>
                    </TouchableOpacity>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Invoice Dynamic Pricing Receipt Card */}
              <View style={[styles.card, styles.estimateCard]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.estimateTitle}>Logistics Quote</Text>
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={12} color={COLORS.primary} />
                    <Text style={styles.verifiedBadgeText}>LIVE API</Text>
                  </View>
                </View>

                {loadingEstimate ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loaderText}>Calculating live Shiprocket rates...</Text>
                  </View>
                ) : estimateError ? (
                  <View style={styles.errorContainer}>
                    <AlertTriangle size={15} color={COLORS.danger} />
                    <Text style={styles.errorText}>{estimateError}</Text>
                  </View>
                ) : (
                  <View>
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>Base Shipping Charge</Text>
                      <Text style={styles.estimateVal}>₹{baseFee.toFixed(2)}</Text>
                    </View>
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>COD Collection Fee</Text>
                      <Text style={styles.estimateVal}>₹{codCharge.toFixed(2)}</Text>
                    </View>
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>Fuel Surcharge</Text>
                      <Text style={styles.estimateVal}>₹{fuelSurcharge.toFixed(2)}</Text>
                    </View>
                    <View style={styles.dottedDivider} />
                    <View style={[styles.estimateRow, { marginTop: 4 }]}>
                      <Text style={[styles.estimateLabel, styles.totalLabel]}>Total Estimated Cost</Text>
                      <Text style={[styles.estimateVal, styles.totalVal]}>₹{totalCost.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.tipBox}>
                  <Info size={13} color={COLORS.primary} />
                  <Text style={styles.tipText}>Estimates are dynamic. Final rates based on courier chosen in Step 2.</Text>
                </View>
              </View>

              <Button
                mode="contained"
                onPress={handleProceedToShip}
                loading={bookingLoading}
                disabled={bookingLoading || loadingEstimate || !!estimateError || !totalCost}
                style={styles.submitBtn}
                contentStyle={{ height: 48 }}
                buttonColor={COLORS.primary}
              >
                Proceed to Courier Selection
              </Button>
            </View>
          ) : (
            <View>
              {/* STEP 2: Courier Listing & Booking */}
              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Order Registered</Text>
                </View>
                <View style={styles.awbBanner}>
                  <Text style={styles.awbTitle}>Shiprocket Shipment ID</Text>
                  <Text style={styles.awbVal}>{currentShipmentId}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.panelTitleWrapper}>
                  <Text style={styles.sectionTitle}>Available Courier Partners</Text>
                </View>
                {loadingCouriers ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loaderText}>Querying Shiprocket partner rates...</Text>
                  </View>
                ) : couriersList.length === 0 ? (
                  <View style={styles.errorContainer}>
                    <AlertTriangle size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>No serviceable couriers found for Pincode {pincode}.</Text>
                  </View>
                ) : (
                  <View>
                    {couriersList.map((courier) => {
                      const isSelected = selectedCourier === courier.courier_company_id.toString();
                      return (
                        <TouchableOpacity
                          key={courier.courier_company_id}
                          style={[styles.courierItem, isSelected && styles.courierItemSelected]}
                          onPress={() => setSelectedCourier(courier.courier_company_id.toString())}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.courierRow}>
                              <Text style={styles.courierName}>{courier.courier_name}</Text>
                              {courier.recommendation_score >= 4 && (
                                <View style={styles.recomBadge}>
                                  <Text style={styles.recomBadgeText}>BEST RATE</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.courierMeta}>
                              Rating: {courier.rating || 'N/A'} • Delivery: {courier.etd || '3-4 Days'}
                            </Text>
                          </View>
                          <Text style={styles.courierPrice}>₹{parseFloat(courier.rate).toFixed(2)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Address Summary */}
              <View style={styles.formRow}>
                <View style={[styles.card, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.addressBoxTitle}>Sender Pickup</Text>
                  <Text style={styles.addressBoxTxt}>{fromAddress}</Text>
                  <Text style={styles.addressBoxPin}>PIN: {fromPincode}</Text>
                </View>
                <View style={[styles.card, { flex: 1 }]}>
                  <Text style={styles.addressBoxTitle}>Receiver Address</Text>
                  <Text style={styles.addressBoxTxt}>{deliveryAddress}</Text>
                  <Text style={styles.addressBoxPin}>PIN: {pincode}</Text>
                </View>
              </View>

              {isPickupScheduled ? (
                <View style={styles.card}>
                  <View style={styles.completedHeader}>
                    <CheckCircle2 size={24} color={COLORS.success} />
                    <Text style={styles.completedTitle}>Booking Confirmed!</Text>
                  </View>
                  <Text style={styles.completedSub}>Air Waybill Code: {currentAwb}</Text>

                  <View style={styles.completedActions}>
                    {currentLabelUrl ? (
                      <TouchableOpacity onPress={() => openUrl(currentLabelUrl)} style={styles.actionBtn}>
                        <FileText size={16} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>Print Label</Text>
                      </TouchableOpacity>
                    ) : null}

                    {currentManifestUrl ? (
                      <TouchableOpacity onPress={() => openUrl(currentManifestUrl)} style={[styles.actionBtn, { backgroundColor: COLORS.muted }]}>
                        <ExternalLink size={16} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>Print Manifest</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Button
                    mode="outlined"
                    onPress={() => setActiveTab('history')}
                    style={styles.doneBtn}
                    textColor={COLORS.primary}
                  >
                    Done (Back to List)
                  </Button>
                </View>
              ) : (
                <Button
                  mode="contained"
                  onPress={handleConfirmBooking}
                  loading={bookingLoading}
                  disabled={bookingLoading || loadingCouriers || !selectedCourier}
                  style={styles.submitBtn}
                  contentStyle={{ height: 48 }}
                  buttonColor={COLORS.primary}
                >
                  Confirm Pickup & Book
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Live tracking details Modal */}
      <Modal
        visible={trackingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTrackingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Shipment Tracking</Text>
                <Text style={styles.modalSubtitle}>AWB: {trackingAwb}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setTrackingModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Divider style={{ backgroundColor: COLORS.border }} />

            {/* Modal Body */}
            {loadingTracking ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modalLoaderText}>Retrieving live tracking updates...</Text>
              </View>
            ) : trackingData && trackingData.error ? (
              <View style={styles.modalErrorContainer}>
                <AlertTriangle size={28} color={COLORS.warning} style={{ marginBottom: 8 }} />
                <Text style={styles.modalErrorText}>{trackingData.error}</Text>
                <Button 
                  mode="contained" 
                  onPress={() => openUrl(`https://track.shiprocket.co/${trackingAwb}`)}
                  style={{ marginTop: 16 }}
                  buttonColor={COLORS.primary}
                >
                  Track on Website
                </Button>
              </View>
            ) : trackingData ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Current Status Header */}
                <View style={styles.trackingHeaderBanner}>
                  <Text style={styles.trackingStatusTitle}>
                    CURRENT STATUS: {(trackingData.shipment_track?.[0]?.current_status || 'IN TRANSIT').toUpperCase()}
                  </Text>
                  {trackingData.shipment_track?.[0]?.etd && (
                    <Text style={styles.trackingEtdText}>
                      Expected Delivery: {trackingData.shipment_track[0].etd}
                    </Text>
                  )}
                </View>

                {/* Timeline */}
                <Text style={styles.timelineHeader}>Tracking Timeline</Text>
                
                {trackingData.shipment_track_activities && trackingData.shipment_track_activities.length > 0 ? (
                  <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
                    {trackingData.shipment_track_activities.map((activity, index) => {
                      const isFirst = index === 0;
                      return (
                        <View key={index} style={styles.timelineItem}>
                          {/* Left line indicator */}
                          <View style={styles.timelineLeftColumn}>
                            <View style={[
                              styles.timelineDot,
                              isFirst && styles.timelineDotActive
                            ]} />
                            {index < trackingData.shipment_track_activities.length - 1 && (
                              <View style={styles.timelineConnectorLine} />
                            )}
                          </View>
                          
                          {/* Right details */}
                          <View style={styles.timelineDetails}>
                            <Text style={[
                              styles.activityTitleText,
                              isFirst && styles.activityTitleTextActive
                            ]}>
                              {activity.activity || 'Package status updated'}
                            </Text>
                            <Text style={styles.activityMetaText}>
                              {activity.location || 'Hub location'} • {activity.date}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyTimelineContainer}>
                    <Info size={20} color={COLORS.muted} style={{ marginBottom: 6 }} />
                    <Text style={styles.emptyTimelineText}>No timeline activities recorded yet.</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.modalErrorContainer}>
                <Info size={28} color={COLORS.muted} style={{ marginBottom: 8 }} />
                <Text style={styles.modalErrorText}>No tracking updates found for this order.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
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
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  
  // iOS Segmented tab swapper styling
  tabContainerOuter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 3,
    borderRadius: 12
  },
  tabBtnPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10
  },
  tabBtnPillActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabBtnPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted
  },
  tabBtnPillTextActive: {
    color: COLORS.text,
    fontWeight: '800'
  },

  // Stepper tracker styling
  progressContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30
  },
  progressNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  progressNodeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  progressNodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted
  },
  progressNodeTextActive: {
    color: COLORS.white
  },
  progressLine: {
    height: 3,
    backgroundColor: '#e2e8f0',
    flex: 1
  },
  progressLineActive: {
    backgroundColor: COLORS.primary
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 12
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted
  },
  progressLabelActive: {
    color: COLORS.text,
    fontWeight: '800'
  },

  // Search and Filter section
  filterSection: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  searchBar: {
    backgroundColor: COLORS.white,
  },
  syncBtnPill: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 142, 200, 0.15)',
    marginTop: 6
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  chip: {
    marginRight: 6,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 6,
    height: 28
  },
  chipActive: {
    backgroundColor: COLORS.primary
  },
  chipText: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '700'
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '800'
  },

  // History Dispatch Cards
  historyCard: {
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4
  },
  hCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  hOrderId: {
    fontSize: 12,
    fontWeight: '850',
    color: COLORS.text
  },
  hStaffName: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 1
  },
  hBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4
  },
  hBadgeText: {
    fontSize: 8.5,
    fontWeight: '800'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  recipientName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text
  },
  recipientPhone: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted
  },
  recipientAddr: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 14
  },
  recipientPin: {
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '750',
    marginTop: 2
  },
  pkgDetailsText: {
    fontSize: 10.5,
    color: COLORS.text,
    fontWeight: '650',
    flex: 1
  },
  awbBannerMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    padding: 5,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.15)'
  },
  awbLabelMini: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600'
  },
  awbValMini: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.text
  },
  hCardActions: {
    marginTop: 6,
    alignItems: 'flex-end'
  },
  shipNowBtn: {
    borderRadius: 8,
    paddingHorizontal: 10
  },
  actionBtnTextMobile: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white
  },
  shippedButtonsRow: {
    flexDirection: 'row',
    gap: 6
  },
  actionBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  actionBtnMiniText: {
    fontSize: 10,
    fontWeight: '800'
  },

  // Loading States
  historyLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loaderSub: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.muted
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 50
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '850',
    color: COLORS.text
  },
  emptySub: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 3
  },

  // Panel layout styling
  scrollContent: { padding: 14, paddingBottom: 50 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  panelTitleWrapper: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingLeft: 8,
    marginBottom: 12
  },
  sectionTitle: { fontSize: 12, fontWeight: '850', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  switchContainer: { flexDirection: 'row', backgroundColor: COLORS.background, padding: 3, borderRadius: 8, gap: 4 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingVertical: 8, justifyContent: 'center', borderRadius: 6 },
  switchBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  switchLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  switchLabelActive: { color: COLORS.primary, fontWeight: '800' },
  input: { backgroundColor: COLORS.white, marginBottom: 8 },
  formRow: { flexDirection: 'row', marginBottom: 2 },
  
  // payment selector styling
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  paymentCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 4
  },
  paymentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(37, 142, 200, 0.05)'
  },
  paymentCardIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  paymentCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted
  },
  paymentCardTextSelected: {
    color: COLORS.primary
  },

  // Quote Invoice styling
  estimateCard: { 
    backgroundColor: 'rgba(37, 142, 200, 0.01)', 
    borderColor: 'rgba(37, 142, 200, 0.2)', 
    borderWidth: 1.5 
  },
  estimateTitle: { fontSize: 13, fontWeight: '850', color: COLORS.primary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  verifiedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.primary
  },
  loaderContainer: { paddingVertical: 12, alignItems: 'center' },
  loaderText: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  errorContainer: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.04)', padding: 8, borderRadius: 6, marginBottom: 8 },
  errorText: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
  estimateLabel: { fontSize: 11, color: COLORS.muted },
  estimateVal: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  dottedDivider: { 
    marginVertical: 8, 
    borderWidth: 0.5, 
    borderColor: COLORS.border, 
    borderStyle: 'dashed' 
  },
  totalLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  totalVal: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  tipBox: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(37, 142, 200, 0.04)', padding: 8, borderRadius: 6, marginTop: 10 },
  tipText: { fontSize: 9.5, color: COLORS.primary, flex: 1, lineHeight: 12 },
  submitBtn: { borderRadius: 10, marginTop: 4, paddingVertical: 4 },
  
  // Step 2 Courier styling
  awbBanner: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8 },
  awbTitle: { fontSize: 10, color: COLORS.muted, fontWeight: '600' },
  awbVal: { fontSize: 15, fontWeight: '850', color: COLORS.text, marginTop: 3 },
  courierItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, marginBottom: 8, backgroundColor: COLORS.white },
  courierItemSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(37, 142, 200, 0.02)' },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  courierName: { fontSize: 12, fontWeight: '750', color: COLORS.text },
  courierMeta: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  courierPrice: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  recomBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  recomBadgeText: { fontSize: 8, color: '#166534', fontWeight: '800' },
  addressBoxTitle: { fontSize: 10, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  addressBoxTxt: { fontSize: 10, color: COLORS.text },
  addressBoxPin: { fontSize: 9.5, color: COLORS.primary, fontWeight: '700', marginTop: 3 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  completedTitle: { fontSize: 15, fontWeight: '800', color: COLORS.success },
  completedSub: { fontSize: 11, color: COLORS.text, marginBottom: 14 },
  completedActions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionBtn: { flex: 1, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  doneBtn: { borderRadius: 8, marginTop: 6 },

  // Live Tracking Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
    paddingBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background
  },
  modalLoader: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalLoaderText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600'
  },
  modalErrorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalErrorText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    fontWeight: '700'
  },
  trackingHeaderBanner: {
    backgroundColor: 'rgba(37, 142, 200, 0.05)',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 142, 200, 0.15)'
  },
  trackingStatusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center'
  },
  trackingEtdText: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600'
  },
  timelineHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 10
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 65
  },
  timelineLeftColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: 12
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    marginTop: 6
  },
  timelineDotActive: {
    backgroundColor: COLORS.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(37, 142, 200, 0.25)',
    marginTop: 5
  },
  timelineConnectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4
  },
  timelineDetails: {
    flex: 1,
    paddingBottom: 16
  },
  activityTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted
  },
  activityTitleTextActive: {
    color: COLORS.text,
    fontWeight: '800'
  },
  activityMetaText: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3
  },
  emptyTimelineContainer: {
    padding: 30,
    alignItems: 'center'
  },
  emptyTimelineText: {
    fontSize: 12,
    color: COLORS.muted
  }
});

export default ShippingForm;
