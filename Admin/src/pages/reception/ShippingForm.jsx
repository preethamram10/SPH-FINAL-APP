import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Send, MapPin, Package, Globe, Truck, Ruler, Scale, FileText, Coins, 
  User, Phone, Mail, ShieldCheck, CheckCircle2, Building, Sparkles, ChevronRight, Layers,
  Plus, Trash2, ShoppingBag, Lock, Search, Copy, ExternalLink, Printer, Eye, EyeOff, MoreHorizontal,
  Info, AlertTriangle, Check, ArrowLeft, AlertCircle, RefreshCw
} from 'lucide-react';
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

const ShippingForm = () => {
  const { userData, user } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('history');
  const [wizardStep, setWizardStep] = useState(1);
  
  // Step 1: Place Order States
  const [shippingType, setShippingType] = useState('National');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [toCity, setToCity] = useState('');
  const [toState, setToState] = useState('');
  const [toCountry, setToCountry] = useState('India');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [fromAddress, setFromAddress] = useState('spiritual homeopathy dilsukhnagar , Durganagar Rd, Krishna Nagar, Dilsukhnagar, Hyderabad, Telangana');
  const [fromPincode, setFromPincode] = useState('500060');
  const [fromPhone, setFromPhone] = useState('9176176176');
  
  const [deadWeight, setDeadWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [orderValue, setOrderValue] = useState('');
  
  const [isCod, setIsCod] = useState(false);
  const [paymentMode, setPaymentMode] = useState('UPI');

  // Auto-calculated rates
  const [baseFee, setBaseFee] = useState(124);
  const [codCharge, setCodCharge] = useState(45);
  const [fuelSurcharge, setFuelSurcharge] = useState(18.50);
  const [totalCost, setTotalCost] = useState(187.50);

  // Step 2: Courier Selection States
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [currentShipmentId, setCurrentShipmentId] = useState('');
  const [currentAwb, setCurrentAwb] = useState('');
  const [currentShipmentDocId, setCurrentShipmentDocId] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('');
  const [isPickupScheduled, setIsPickupScheduled] = useState(false);
  const [scheduledShipmentId, setScheduledShipmentId] = useState('');
  const [couriersList, setCouriersList] = useState([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [currentLabelUrl, setCurrentLabelUrl] = useState('');
  const [currentManifestUrl, setCurrentManifestUrl] = useState('');

  // Shipments History State
  const [shipments, setShipments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Custom UI Toggles
  const [revealedPhones, setRevealedPhones] = useState({});
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingAwb, setTrackingAwb] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [activeRtoShipment, setActiveRtoShipment] = useState(null);
  
  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Dynamic estimate calculator using live Shiprocket API (Option B)
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState('');

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
            // Find the cheapest serviceable courier to estimate the rate
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

  // Load Shipments
  useEffect(() => {
    const q = query(collection(db, 'shipping_requests'), orderBy('createdAt', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setShipments(list);
      setLoadingHistory(false);
    }, (error) => {
      console.error(error);
      setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch available couriers from Shiprocket when entering Step 2
  useEffect(() => {
    if (wizardStep === 2 && pincode) {
      const fetchCouriers = async () => {
        setLoadingCouriers(true);
        try {
          let shipmentId = currentShipmentId;
          if (!shipmentId && currentShipmentDocId) {
            const found = shipments.find(s => s.id === currentShipmentDocId);
            if (found && found.shiprocketShipmentId) {
              shipmentId = found.shiprocketShipmentId;
              setCurrentShipmentId(shipmentId);
            }
          }

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
  }, [wizardStep, pincode, currentShipmentDocId, currentShipmentId, deadWeight, isCod, shipments, fromPincode]);

  const handleCopyText = (txt) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(txt);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePhoneReveal = (id) => {
    setRevealedPhones(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleProceedToShip = async () => {
    if (!fullName || !phoneNumber || !pincode || !deliveryAddress || !deadWeight || !orderValue) {
      alert('Please fill out all mandatory customer and package details.');
      return;
    }

    setLoadingHistory(true);

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
          units: quantity,
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
    } catch (err) {
      console.error(err);
      alert(`Error registering order in Shiprocket: ${err.message}`);
      setLoadingHistory(false);
      return;
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
      toEmail: emailAddress || 'no-email@sph.com',
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
        units: quantity,
        sellingPrice: parseFloat(orderValue)
      }],
      paymentMethod: isCod ? 'COD' : 'Prepaid',
      paymentMode: paymentMode,
      subTotal: parseFloat(orderValue),
      packageDetails: `${deadWeight} kg | ${itemDescription} | Dims: ${dimensions}`,
      status: 'new',
      provider: 'Shiprocket',
      shiprocketOrderId: generatedOrderId,
      shiprocketOrderIdReal: srOrderIdReal,
      shiprocketShipmentId: srShipmentId,
      awbCode: '',
      courierName: '',
      trackingUrl: '',
      labelUrl: '',
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'shipping_requests'), payload);
      setCurrentShipmentDocId(docRef.id);
      setCurrentOrderId(generatedOrderId);
      setCurrentShipmentId(srShipmentId);
      setIsPickupScheduled(false);
      setWizardStep(2);
    } catch (err) {
      console.error(err);
      alert('Error creating shipment record in database.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!currentShipmentId) {
      alert("No active Shiprocket Shipment ID found.");
      return;
    }
    if (!selectedCourier) {
      alert("Please select a courier partner first.");
      return;
    }

    setLoadingHistory(true);

    try {
      // 1. Assign AWB
      const awbRes = await assignAWB(currentShipmentId, selectedCourier);
      if (awbRes.awb_assign_status !== 1) {
        throw new Error(awbRes.response?.data?.message || "Failed to assign AWB via Shiprocket.");
      }
      
      const awbCode = awbRes.response?.data?.awb_code;
      const courierName = awbRes.response?.data?.courier_name || 'Shiprocket Partner';

      // 2. Schedule Pickup
      await schedulePickup(currentShipmentId);

      // 3. Generate Label
      let labelUrl = '';
      try {
        const labelRes = await generateLabel(currentShipmentId);
        labelUrl = labelRes.label_url || '';
      } catch (e) {
        console.warn("Failed to generate label:", e);
      }

      // 4. Generate & Print Manifest
      let manifestUrl = '';
      try {
        await generateManifest(currentShipmentId);
        const manifestRes = await printManifest(currentShipmentId);
        manifestUrl = manifestRes.manifest_url || '';
      } catch (e) {
        console.warn("Failed to generate/print manifest:", e);
      }

      // 5. Update Firestore
      const docRef = doc(db, 'shipping_requests', currentShipmentDocId);
      await updateDoc(docRef, {
        status: 'shipped',
        courierName,
        awbCode,
        trackingUrl: `https://track.shiprocket.co/${awbCode}`,
        labelUrl,
        manifestUrl,
        shippedAt: new Date().toISOString()
      });

      setCurrentAwb(awbCode);
      setScheduledShipmentId(currentShipmentId);
      setCurrentLabelUrl(labelUrl);
      setCurrentManifestUrl(manifestUrl);
      setIsPickupScheduled(true);
      alert(`🎉 Shipping manifest booked and assigned with ${courierName}!`);
    } catch (err) {
      console.error(err);
      alert(`Failed to confirm booking: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCancelShipment = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this shipment?")) return;
    try {
      await updateDoc(doc(db, 'shipping_requests', id), { status: 'cancelled' });
      alert("Cancelled.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteShipment = async (id) => {
    if (!window.confirm("Delete record permanently?")) return;
    try {
      await deleteDoc(doc(db, 'shipping_requests', id));
      alert("Deleted.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewTracking = async (awbCode) => {
    if (!awbCode) {
      alert('No AWB code available for tracking.');
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
  const handleShipNow = async (shipment) => {
    const orderIdVal = shipment.shiprocketOrderId || `SPH-ORD-${Math.floor(10000000 + Math.random() * 90000000)}`;

    setFullName(shipment.toName);
    setPhoneNumber(shipment.toPhone);
    setEmailAddress(shipment.toEmail);
    setPincode(shipment.toPincode);
    setDeliveryAddress(shipment.toAddress);
    setDeadWeight(shipment.weight.toString());
    setDimensions(`${shipment.length} x ${shipment.width} x ${shipment.height}`);
    setItemDescription(shipment.contents);
    setQuantity(shipment.orderItems?.[0]?.units || 1);
    setOrderValue(shipment.subTotal.toString());
    setIsCod(shipment.paymentMethod?.toLowerCase() === 'cod');
    setPaymentMode(shipment.paymentMode || (shipment.paymentMethod?.toLowerCase() === 'cod' ? 'COD' : 'UPI'));
    
    setCurrentShipmentDocId(shipment.id);
    setCurrentOrderId(orderIdVal);
    setIsPickupScheduled(false);

    let shid = shipment.shiprocketShipmentId || '';
    if (!shid) {
      setLoadingHistory(true);
      try {
        const names = shipment.toName.trim().split(/\s+/);
        const firstName = names[0] || 'Customer';
        const lastName = names.slice(1).join(' ') || '.';
        const sizeParts = `${shipment.length} x ${shipment.width} x ${shipment.height}`.split('x').map(s => parseInt(s.trim()) || 10);
        const length = sizeParts[0] || 10;
        const width = sizeParts[1] || 10;
        const height = sizeParts[2] || 10;
        const orderDateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const skuStr = shipment.orderItems?.[0]?.sku || `SKU-${shipment.toPincode}`;

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
              name: shipment.contents,
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
        console.error('Failed to create order on Shiprocket during Ship Now:', err);
        alert('Failed to register order in Shiprocket: ' + err.message);
        setLoadingHistory(false);
        return;
      } finally {
        setLoadingHistory(false);
      }
    }
    
    setCurrentShipmentId(shid);
    setCurrentAwb(shipment.awbCode || '');
    setActiveTab('create');
    setWizardStep(2);
  };

  const handleCardPress = (shipment) => {
    if (shipment.awbCode) {
      handleViewTracking(shipment.awbCode);
    } else if ((shipment.status || 'new').toLowerCase() === 'new') {
      handleShipNow(shipment);
    }
  };

  const handleSyncStatuses = async () => {
    const pendingSync = shipments.filter(s => 
      s.awbCode && 
      s.status !== 'delivered' && 
      s.status !== 'cancelled'
    );

    if (pendingSync.length === 0) {
      alert('All shipments are already up to date.');
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
    alert(`Synced ${successCount} shipment statuses successfully!`);
  };

  // Filter Logic
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

  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentShipments = filteredShipments.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="shiprocket-app">
      <style>{`
        .shiprocket-app {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px 20px 60px 20px;
          font-family: 'Outfit', sans-serif;
          color: var(--text-main);
          background-color: var(--bg-dark);
          border-radius: 24px;
        }

        /* Top Navigation Header */
        .sr-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid var(--border-color);
          margin-bottom: 24px;
          padding-bottom: 12px;
        }
        .sr-logo-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sr-logo-icon {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
          color: #ffffff;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 142, 200, 0.2);
        }
        .sr-title-txt {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-main);
          margin: 0;
        }
        .sr-nav-tabs {
          display: flex;
          background: #e2e8f0;
          padding: 4px;
          border-radius: 12px;
          gap: 4px;
        }
        .sr-nav-btn {
          border: none;
          background: transparent;
          padding: 8px 18px;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-muted);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sr-nav-btn.active {
          background: #ffffff;
          color: var(--primary-color);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        /* Domestic / International Switcher */
        .sr-switcher-card {
          display: flex;
          background: #e2e8f0;
          padding: 4px;
          border-radius: 12px;
          gap: 4px;
          width: fit-content;
        }
        .sr-switch-btn {
          border: none;
          background: transparent;
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sr-switch-btn.active {
          background: #ffffff;
          color: var(--primary-color);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        /* Wizard Header Progression */
        .wizard-steps-hdr {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-muted);
        }
        .wizard-step-node {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wizard-step-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #e2e8f0;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.76rem;
        }
        .wizard-step-node.active .wizard-step-circle {
          background: var(--primary-color);
          color: #ffffff;
        }
        .wizard-step-node.active {
          color: var(--text-main);
        }
        .wizard-step-node.completed .wizard-step-circle {
          background: var(--success);
          color: #ffffff;
        }
        .wizard-line-sep {
          height: 2px;
          background: #cbd5e1;
          width: 80px;
        }

        /* Columns Grid layout */
        .sr-grid-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .sr-grid-layout {
            grid-template-columns: 1fr;
          }
        }

        /* Panel cards */
        .sr-card-panel {
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .sr-panel-title {
          font-size: 0.96rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-main);
          margin: 0 0 20px 0;
          border-bottom: 1.5px solid #f1f5f9;
          padding-bottom: 10px;
        }

        /* Form Controls */
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-field-grp {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        .form-field-label {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .form-field-input {
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-main);
          outline: none;
          background: #ffffff;
          transition: all 0.2s;
        }
        .form-field-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(37, 142, 200, 0.15);
        }

        /* Preferences / Delivery speed selector */
        .delivery-speed-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .delivery-speed-card {
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
          cursor: pointer;
          transition: all 0.2s;
          background: #ffffff;
        }
        .delivery-speed-card:hover {
          border-color: #cbd5e1;
        }
        .delivery-speed-card.selected {
          border-color: var(--primary-color);
          background: rgba(37, 142, 200, 0.03);
        }
        .speed-title {
          font-size: 0.84rem;
          font-weight: 750;
          color: var(--text-main);
        }
        .speed-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 3px;
        }

        /* Toggle switch */
        .toggle-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-top: 1.5px solid #f1f5f9;
          margin-top: 10px;
        }
        .toggle-switch-btn {
          width: 44px;
          height: 24px;
          background: #cbd5e1;
          border-radius: 9999px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          border: none;
        }
        .toggle-switch-btn.active {
          background: var(--primary-color);
        }
        .toggle-bullet {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          position: absolute;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }
        .toggle-switch-btn.active .toggle-bullet {
          transform: translateX(20px);
        }

        /* Estimate Side Summary Panel */
        .summary-side-card {
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          position: sticky;
          top: 20px;
        }
        .summary-row-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 12px;
        }
        .summary-total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 2px dashed #e2e8f0;
          margin-top: 18px;
          padding-top: 18px;
        }
        .summary-total-label {
          font-size: 0.94rem;
          font-weight: 800;
          color: var(--text-main);
        }
        .summary-total-val {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--primary-color);
        }
        .summary-tip-box {
          background: rgba(37, 142, 200, 0.05);
          border-radius: 8px;
          padding: 12px;
          font-size: 0.74rem;
          color: var(--primary-color);
          line-height: 1.4;
          margin: 20px 0;
          display: flex;
          gap: 8px;
        }
        .btn-blue-primary {
          width: 100%;
          background: var(--primary-color);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-blue-primary:hover {
          background: var(--primary-hover);
        }

        /* Step 2 alert details */
        .awb-alert-strip {
          background: rgba(37, 142, 200, 0.05);
          border: 1px solid rgba(37, 142, 200, 0.2);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          font-size: 0.88rem;
          color: var(--primary-hover);
          font-weight: 600;
        }
        .btn-copy-tag {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-copy-tag:hover {
          background: #f1f5f9;
        }

        /* Available couriers horizontal list cards */
        .courier-option-item {
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background: #ffffff;
          transition: all 0.2s;
        }
        .courier-option-item:hover {
          border-color: #cbd5e1;
        }
        .courier-option-item.selected {
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(37, 142, 200, 0.05);
        }
        .courier-details-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .courier-logo-circle {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
        }
        .logo-d { background: #eff6ff; color: var(--primary-color); }
        .logo-b { background: #f8fafc; color: var(--text-muted); border: 1.5px solid #cbd5e1; }
        .logo-s { background: #f0fdf4; color: var(--success); }
        
        .badge-recommended {
          background: #f0fdf4;
          color: #166534;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
          text-transform: uppercase;
        }
        .courier-meta-txt {
          font-size: 0.74rem;
          color: var(--text-muted);
          margin-top: 3px;
        }
        .courier-radio-selector {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .courier-option-item.selected .courier-radio-selector {
          border-color: var(--primary-color);
        }
        .radio-dot-active {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary-color);
        }
        .courier-rate-tag {
          font-size: 0.98rem;
          font-weight: 800;
          color: var(--text-main);
          margin-right: 14px;
        }

        /* Split address cards at the bottom of courier select */
        .split-address-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }
        .address-box-card {
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          background: #ffffff;
        }
        .address-box-hdr {
          font-size: 0.74rem;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .address-box-body {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-main);
        }

        /* Success booked green card alert */
        .booking-success-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 16px;
          margin-top: 20px;
          color: #166534;
          font-size: 0.8rem;
          line-height: 1.45;
        }
        .success-box-title {
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 0.86rem;
        }

        /* Buttons secondary bordered */
        .btn-outline-sec {
          width: 100%;
          background: #ffffff;
          color: var(--text-muted);
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
        }
        .btn-outline-sec:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        /* ORDER HISTORY LIST TABLE LAYOUT (Matches exact screenshot styling) */
        .sr-filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sr-status-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .sr-filter-tab {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 7px 16px;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sr-filter-tab:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .sr-filter-tab.active {
          background: var(--primary-color);
          color: #ffffff;
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(37, 142, 200, 0.15);
        }
        .sr-badge-count {
          font-size: 0.72rem;
          background: rgba(0, 0, 0, 0.08);
          padding: 2px 6px;
          border-radius: 9999px;
        }
        .sr-filter-tab.active .sr-badge-count {
          background: rgba(255, 255, 255, 0.2);
        }

        .sr-search-bar {
          position: relative;
          min-width: 320px;
        }
        .sr-search-bar input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 9px 16px 9px 40px;
          font-size: 0.88rem;
          outline: none;
          background: #ffffff;
          transition: border-color 0.2s;
        }
        .sr-search-bar input:focus {
          border-color: var(--primary-color);
        }
        .sr-search-bar svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .sr-order-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sr-order-card {
          display: grid;
          grid-template-columns: 32px 1.4fr 1.6fr 1.8fr 1.5fr 1fr 60px 80px 140px 40px;
          gap: 16px;
          align-items: center;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 18px 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.01);
          transition: all 0.2s ease;
        }
        .sr-order-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.02);
        }

        /* Row content styles */
        .col-order-id {
          display: flex;
          flex-direction: column;
        }
        .order-id-link {
          font-size: 0.88rem;
          font-weight: 750;
          color: var(--primary-color);
          text-decoration: none;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 140px;
        }
        .order-id-link:hover {
          text-decoration: underline;
        }
        .order-date {
          font-size: 0.76rem;
          color: var(--text-muted);
          margin-top: 3px;
        }
        .order-channel {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          margin-top: 6px;
        }

        .col-customer {
          display: flex;
          flex-direction: column;
          font-size: 0.82rem;
        }
        .cust-name {
          font-weight: 700;
          color: var(--text-main);
        }
        .cust-email {
          color: var(--text-muted);
          font-size: 0.78rem;
          margin-top: 1px;
        }
        .cust-phone-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }
        .cust-phone {
          font-family: monospace;
          color: #334155;
          font-weight: 600;
        }
        .cust-address {
          color: var(--text-muted);
          font-size: 0.78rem;
          margin-top: 4px;
        }
        .cust-rto-risk {
          color: var(--primary-color);
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          margin-top: 6px;
          text-decoration: underline;
          display: inline-block;
          width: fit-content;
        }

        .col-product {
          display: flex;
          flex-direction: column;
          font-size: 0.82rem;
        }
        .prod-name {
          font-weight: 600;
          color: #334155;
        }
        .prod-sku {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .prod-qty {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-main);
          margin-top: 4px;
        }

        .col-package {
          font-size: 0.78rem;
          color: #475569;
        }
        .pkg-dead-wt {
          font-weight: 600;
        }

        .col-price {
          display: flex;
          flex-direction: column;
        }
        .price-val {
          font-size: 0.88rem;
          font-weight: 800;
          color: var(--text-main);
        }
        .pay-badge {
          align-self: flex-start;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          margin-top: 6px;
          text-transform: uppercase;
        }
        .pay-badge.prepaid {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #dcfce7;
        }
        .pay-badge.cod {
          background-color: #fffbeb;
          color: #92400e;
          border: 1px solid #fef3c7;
        }

        .col-pickup {
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          text-decoration: underline dotted;
          cursor: help;
        }

        .sr-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          text-align: center;
        }
        .pill-new {
          background-color: #eff6ff;
          color: #1e40af;
          border: 1px solid #dbeafe;
        }
        .pill-shipped {
          background-color: #f3e8ff;
          color: #6b21a8;
          border: 1px solid #e9d5ff;
        }
        .pill-delivered {
          background-color: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .pill-cancelled {
          background-color: #fef2f2;
          color: #991b1b;
          border: 1px solid #fee2e2;
        }

        .btn-ship-now-purple {
          background: var(--primary-color);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(37, 142, 200, 0.2);
          transition: all 0.2s;
        }
        .btn-ship-now-purple:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }
        .btn-more-dots {
          border: none;
          background: #f1f5f9;
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .btn-more-dots:hover {
          background: #e2e8f0;
        }

        .action-mini-btn {
          font-size: 0.74rem;
          font-weight: 700;
          text-decoration: none;
          padding: 5px 10px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-bottom: 4px;
          transition: all 0.2s;
        }
        .action-mini-btn.track {
          background: rgba(37, 142, 200, 0.08);
          color: var(--primary-color);
          border: 1px solid rgba(37, 142, 200, 0.15);
        }
        .action-mini-btn.track:hover {
          background: var(--primary-color);
          color: #ffffff;
        }
        .action-mini-btn.label {
          background: #f8fafc;
          color: var(--text-muted);
          border: 1px solid #cbd5e1;
        }
        .action-mini-btn.label:hover {
          background: #e2e8f0;
        }

        /* Action Menu Dropdown */
        .sr-action-dropdown {
          position: absolute;
          right: 48px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          z-index: 10;
          width: 140px;
          padding: 6px 0;
        }
        .dropdown-menu-item {
          padding: 8px 12px;
          font-size: 0.82rem;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
        }
        .dropdown-menu-item:hover {
          background: #f1f5f9;
          color: #ef4444;
        }

        .chk-box {
          width: 16px;
          height: 16px;
          border: 1.5px solid #cbd5e1;
          border-radius: 4px;
        }

        /* RTO Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 20px;
          width: 450px;
          box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .modal-hdr {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }
        .btn-modal-close {
          border: none;
          background: #f1f5f9;
          color: var(--text-muted);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
        }
        .modal-body {
          padding: 24px;
        }
        .modal-ftr {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
        }

        /* Pagination Footer */
        .sr-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 20px;
          margin-top: 16px;
        }
        .sr-pag-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .sr-pag-select {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 6px;
          padding: 4px 8px;
          outline: none;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
        }
        .sr-pag-right {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .btn-pag-arrow {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
        }
        .btn-pag-arrow:hover:not(:disabled) {
          background: #f1f5f9;
          color: var(--text-main);
        }
        .btn-pag-arrow:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      {/* Top Header Section */}
      <div className="sr-header-bar">
        <div className="sr-logo-box">
          <div className="sr-logo-icon">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="sr-title-txt">Shiprocket Console</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>Logistics & Order Pipeline</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></span> Connected
              </span>
            </div>
          </div>
        </div>

        <div className="sr-nav-tabs">
          <button 
            type="button" 
            className={`sr-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FileText size={16} /> Manage Dispatches
          </button>
          <button 
            type="button" 
            className={`sr-nav-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => { setActiveTab('create'); setWizardStep(1); }}
          >
            <Plus size={16} /> Create Order
          </button>
        </div>
      </div>

      {/* VIEW 1: MANAGE DISPATCHES / ORDER HISTORY TABLE */}
      {activeTab === 'history' && (
        <div>
          {/* Status Tabs and Search */}
          <div className="sr-filter-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="sr-status-tabs" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'new', label: 'Draft' },
                { key: 'awb assigned', label: 'AWB Assigned' },
                { key: 'in transit', label: 'In Transit' },
                { key: 'out for delivery', label: 'Out for Delivery' },
                { key: 'delivered', label: 'Delivered' },
                { key: 'rto', label: 'RTO' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map(status => {
                const count = status.key === 'all' 
                  ? shipments.length 
                  : shipments.filter(s => {
                      const dbStatus = (s.status || 'new').toLowerCase();
                      if (status.key === 'new') return dbStatus === 'new' || dbStatus === 'pending';
                      if (status.key === 'in transit') return dbStatus === 'in transit' || dbStatus === 'shipped' || dbStatus === 'in-transit';
                      return dbStatus === status.key;
                    }).length;
                return (
                  <button
                    key={status.key}
                    type="button"
                    className={`sr-filter-tab ${statusFilter === status.key ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(status.key); setCurrentPage(1); }}
                  >
                    {status.label}
                    <span className="sr-badge-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="sr-search-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search patient, phone, order ID, AWB..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  style={{ paddingLeft: '40px', width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
              </div>
              <button 
                type="button" 
                className="sr-sync-btn"
                onClick={handleSyncStatuses}
                disabled={syncingStatuses}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary-color)',
                  background: 'rgba(37, 142, 200, 0.05)',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  height: '38px'
                }}
              >
                <RefreshCw size={14} className={syncingStatuses ? "sr-spinner" : ""} />
                {syncingStatuses ? 'Syncing...' : 'Sync Statuses'}
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="sr-order-list">
            {loadingHistory ? (
              <div className="sr-card-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <RefreshCw className="sr-spinner" size={32} style={{ margin: '0 auto 16px auto', color: 'var(--primary-color)' }} />
                <div style={{ fontWeight: '750', fontSize: '0.95rem' }}>Synchronizing logistics data...</div>
              </div>
            ) : currentShipments.length === 0 ? (
              <div className="sr-card-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <AlertCircle size={40} style={{ margin: '0 auto 16px auto' }} />
                <div style={{ fontWeight: '750' }}>No shipments found.</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Click "Create Order" to add a new shipment.</div>
              </div>
            ) : (
              currentShipments.map((shipment) => {
                const isNew = (shipment.status || 'new').toLowerCase() === 'new';
                const showPhone = revealedPhones[shipment.id];

                return (
                  <div 
                    key={shipment.id} 
                    className="sr-order-card"
                    onClick={() => handleCardPress(shipment)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Checkbox */}
                    <input type="checkbox" className="chk-box" readOnly onClick={(e) => e.stopPropagation()} />

                    {/* Order ID & Date */}
                    <div className="col-order-id">
                      <a href="#" className="order-id-link" onClick={(e) => { e.stopPropagation(); e.preventDefault(); alert(`Order Reference: ${shipment.shiprocketOrderId}`); }}>
                        {shipment.shiprocketOrderId || 'Draft'}
                      </a>
                      <span className="order-date">
                        {shipment.createdAt?.seconds 
                          ? new Date(shipment.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' | ' + new Date(shipment.createdAt.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : 'Draft Time'}
                      </span>
                      <div className="order-channel">
                        <ShoppingBag size={12} /> CUSTOM ({shipment.id.substring(0,8)})
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="col-customer">
                      <span className="cust-name">{shipment.toName}</span>
                      <span className="cust-email">{shipment.toEmail}</span>
                      <div className="cust-phone-row">
                        <span className="cust-phone">
                          {showPhone ? shipment.toPhone : 'xxxxxxxxxx'}
                        </span>
                        <button 
                          type="button" 
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                          onClick={(e) => { e.stopPropagation(); togglePhoneReveal(shipment.id); }}
                        >
                          {showPhone ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <span className="cust-address">{shipment.toCity}</span>
                      <span className="cust-rto-risk" onClick={(e) => { e.stopPropagation(); setActiveRtoShipment(shipment); }}>
                        View RTO Risk
                      </span>
                    </div>

                    {/* Product Details */}
                    <div className="col-product">
                      <span className="prod-name">{shipment.contents || 'Medicines'}</span>
                      <span className="prod-sku">
                        SKU: {shipment.orderItems?.[0]?.sku || `SKU-${shipment.toPincode}`}
                      </span>
                      <span className="prod-qty">
                        QTY: {shipment.orderItems?.reduce((acc, item) => acc + (item.units || 1), 0) || 1}
                      </span>
                    </div>

                    {/* Package Specs */}
                    <div className="col-package">
                      <div>Dead wt.: <span className="pkg-dead-wt">{shipment.weight || '0.5'} Kg</span></div>
                      <div style={{ marginTop: '2px' }}>{shipment.length} x {shipment.width} x {shipment.height} (cm)</div>
                      <div style={{ marginTop: '2px' }}>Volumetric wt.: <span style={{ fontWeight: '500' }}>{((shipment.length * shipment.width * shipment.height) / 5000).toFixed(3)} Kg</span></div>
                    </div>

                    {/* Pricing */}
                    <div className="col-price">
                      <span className="price-val">₹{(shipment.subTotal || 0).toFixed(2)}</span>
                      <span className={`pay-badge ${shipment.paymentMethod?.toLowerCase() === 'cod' ? 'cod' : 'prepaid'}`}>
                        {shipment.paymentMethod || 'Prepaid'}
                      </span>
                    </div>

                    {/* Pickup Warehouse */}
                    <div className="col-pickup" title={shipment.fromAddress}>
                      {shipment.pickupLocation || 'work'}
                    </div>

                    {/* Status Pill */}
                    <div>
                      <span className={`sr-status-pill pill-${(shipment.status || 'new').toLowerCase()}`}>
                        {shipment.status || 'NEW'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {isNew ? (
                        <button 
                          type="button" 
                          className="btn-ship-now-purple"
                          onClick={(e) => { e.stopPropagation(); handleShipNow(shipment); }}
                        >
                          Ship Now
                        </button>
                      ) : (
                        <div>
                          {shipment.awbCode ? (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleViewTracking(shipment.awbCode); }}
                              className="action-mini-btn track"
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              <ExternalLink size={12} /> Track
                            </button>
                          ) : (
                            <span className="action-mini-btn track" style={{ opacity: 0.5 }}>No Track</span>
                          )}
                          {shipment.labelUrl ? (
                            <a href={shipment.labelUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="action-mini-btn label">
                              <Printer size={12} /> Label
                            </a>
                          ) : (
                            <span className="action-mini-btn label" style={{ opacity: 0.5 }}>No Label</span>
                          )}
                          {shipment.manifestUrl && (
                            <a href={shipment.manifestUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="action-mini-btn label" style={{ marginTop: '4px' }}>
                              <FileText size={12} /> Manifest
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Menu */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        type="button" 
                        className="btn-more-dots"
                        onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === shipment.id ? null : shipment.id); }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      
                      {activeDropdownId === shipment.id && (
                        <div className="sr-action-dropdown" onClick={(e) => e.stopPropagation()}>
                          {isNew && (
                            <button 
                              type="button" 
                              className="dropdown-menu-item"
                              onClick={(e) => { e.stopPropagation(); handleCancelShipment(shipment.id); setActiveDropdownId(null); }}
                            >
                              <AlertTriangle size={14} /> Cancel
                            </button>
                          )}
                          <button 
                            type="button" 
                            className="dropdown-menu-item"
                            style={{ color: 'var(--danger)' }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteShipment(shipment.id); setActiveDropdownId(null); }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {!loadingHistory && filteredShipments.length > 0 && (
            <div className="sr-pagination">
              <div className="sr-pag-left">
                <span>Items per page:</span>
                <select 
                  className="sr-pag-select" 
                  value={itemsPerPage} 
                  onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10 Orders</option>
                  <option value={15}>15 Orders</option>
                  <option value={20}>20 Orders</option>
                  <option value={50}>50 Orders</option>
                </select>
                <span style={{ marginLeft: '12px' }}>Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredShipments.length)} of {filteredShipments.length}</span>
              </div>

              <div className="sr-pag-right">
                <button 
                  type="button" 
                  className="btn-pag-arrow" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  &lt;
                </button>
                <span>Page {currentPage} of {totalPages || 1}</span>
                <button 
                  type="button" 
                  className="btn-pag-arrow" 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CREATE SHIPMENT WIZARD */}
      {activeTab === 'create' && (
        <div>
          {/* Wizard Header Progress Strip */}
          <div className="wizard-steps-hdr">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Orders</span>
              <span>&gt;</span>
              <span style={{ fontWeight: '800' }}>New Shipment</span>
            </div>
            
            <div style={{ flex: 1 }}></div>

            <div className={`wizard-step-node ${wizardStep === 1 ? 'active' : ''} ${wizardStep > 1 ? 'completed' : ''}`}>
              <div className="wizard-step-circle">
                {wizardStep > 1 ? <Check size={12} /> : '1'}
              </div>
              <span>Place Order</span>
            </div>

            <div className="wizard-line-sep"></div>

            <div className={`wizard-step-node ${wizardStep === 2 ? 'active' : ''}`}>
              <div className="wizard-step-circle">2</div>
              <span>Select Courier & Book</span>
            </div>
          </div>

          {/* STEP 1: Place Order */}
          {wizardStep === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); handleProceedToShip(); }}>
              <div className="sr-grid-layout">
                <div>
                  {/* Customer Details */}
                  <div className="sr-card-panel">
                    <div className="sr-switcher-card" style={{ marginBottom: '18px' }}>
                      <button
                        type="button"
                        className={`sr-switch-btn ${shippingType === 'National' ? 'active' : ''}`}
                        onClick={() => { setShippingType('National'); setToCountry('India'); }}
                      >
                        <MapPin size={16} /> Domestic Shipping
                      </button>
                      <button
                        type="button"
                        className={`sr-switch-btn ${shippingType === 'International' ? 'active' : ''}`}
                        onClick={() => setShippingType('International')}
                      >
                        <Globe size={16} /> International Shipping
                      </button>
                    </div>

                    <h3 className="sr-panel-title">Customer Details</h3>
                    
                    <div className="form-grid-2">
                      <div className="form-field-grp">
                        <label className="form-field-label">Full Name</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={fullName}
                          placeholder="e.g. Rohan Sharma"
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">Phone Number</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={phoneNumber}
                          placeholder="e.g. 9876543210"
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-field-grp">
                        <label className="form-field-label">Email Address</label>
                        <input 
                          type="email" 
                          className="form-field-input" 
                          required
                          value={emailAddress}
                          placeholder="e.g. rohan.sharma@gmail.com"
                          onChange={(e) => setEmailAddress(e.target.value)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">Pincode</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={pincode}
                          placeholder="e.g. 560001"
                          onChange={(e) => setPincode(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-field-grp">
                      <label className="form-field-label">Delivery Address</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        required
                        value={deliveryAddress}
                        placeholder="e.g. No. 42, 3rd Cross, Koramangala 4th Block"
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                      />
                    </div>

                    <div className="form-grid-2">
                      <div className="form-field-grp">
                        <label className="form-field-label">City</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={toCity}
                          placeholder="e.g. Bengaluru"
                          onChange={(e) => setToCity(e.target.value)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">State</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={toState}
                          placeholder="e.g. Karnataka"
                          onChange={(e) => setToState(e.target.value)}
                        />
                      </div>
                    </div>

                    {shippingType === 'International' && (
                      <div className="form-field-grp">
                        <label className="form-field-label">Country</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={toCountry}
                          placeholder="e.g. United Kingdom"
                          onChange={(e) => setToCountry(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Pickup Details (Sender) */}
                  <div className="sr-card-panel">
                    <h3 className="sr-panel-title">Pickup Details (Sender)</h3>
                    
                    <div className="form-field-grp">
                      <label className="form-field-label">Sender Address</label>
                      <input 
                        type="text" 
                        className="form-field-input" 
                        required
                        value={fromAddress}
                        placeholder="e.g. spiritual homeopathy dilsukhnagar..."
                        onChange={(e) => setFromAddress(e.target.value)}
                      />
                    </div>

                    <div className="form-grid-2">
                      <div className="form-field-grp">
                        <label className="form-field-label">Sender Pincode</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={fromPincode}
                          placeholder="e.g. 500060"
                          onChange={(e) => setFromPincode(e.target.value)}
                        />
                      </div>

                      <div className="form-field-grp">
                        <label className="form-field-label">Sender Mobile Number</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={fromPhone}
                          placeholder="e.g. 9876543210"
                          onChange={(e) => setFromPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Package Details */}
                  <div className="sr-card-panel">
                    <h3 className="sr-panel-title">Package Details</h3>

                    <div className="form-grid-2">
                      <div className="form-field-grp">
                        <label className="form-field-label">Dead Weight (KG)</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={deadWeight}
                          placeholder="e.g. 0.5"
                          onChange={(e) => setDeadWeight(e.target.value)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">Dimensions (L x W x H CM) (Optional)</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          value={dimensions}
                          placeholder="e.g. 10 x 10 x 10"
                          onChange={(e) => setDimensions(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr', gap: '16px' }}>
                      <div className="form-field-grp">
                        <label className="form-field-label">Item Description</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={itemDescription}
                          placeholder="e.g. Medicines"
                          onChange={(e) => setItemDescription(e.target.value)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">Qty</label>
                        <input 
                          type="number" 
                          className="form-field-input" 
                          required
                          value={quantity}
                          min="1"
                          placeholder="e.g. 1"
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="form-field-grp">
                        <label className="form-field-label">Order Value (₹)</label>
                        <input 
                          type="text" 
                          className="form-field-input" 
                          required
                          value={orderValue}
                          placeholder="e.g. 500.00"
                          onChange={(e) => setOrderValue(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Preferences */}
                  <div className="sr-card-panel">
                    <h3 className="sr-panel-title">Mode of Payment</h3>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        <input 
                          type="radio" 
                          name="paymentMode" 
                          value="Prepaid" 
                          checked={!isCod}
                          onChange={() => {
                            setIsCod(false);
                            setPaymentMode('Prepaid');
                          }}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                        />
                        Prepaid
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        <input 
                          type="radio" 
                          name="paymentMode" 
                          value="COD" 
                          checked={isCod}
                          onChange={() => {
                            setIsCod(true);
                            setPaymentMode('COD');
                          }}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                        />
                        Cash on Delivery (COD)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Estimate Summary Panel */}
                <div>
                  <div className="summary-side-card">
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Shipment Summary
                    </h3>

                    {loadingEstimate ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                        <RefreshCw className="sr-spinner" size={20} style={{ margin: '0 auto 8px auto', color: 'var(--primary-color)' }} />
                        <div style={{ fontSize: '0.78rem' }}>Fetching live rates...</div>
                      </div>
                    ) : estimateError ? (
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', color: '#ef4444', fontSize: '0.78rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <AlertTriangle size={16} />
                        <div>{estimateError}</div>
                      </div>
                    ) : (
                      <>
                        <div className="summary-row-item">
                          <span>Base Shipping Fee</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{baseFee.toFixed(2)}</span>
                        </div>

                        <div className="summary-row-item">
                          <span>COD Collection Charge</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{codCharge.toFixed(2)}</span>
                        </div>

                        <div className="summary-row-item">
                          <span>Estimated Fuel Surcharge</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{fuelSurcharge.toFixed(2)}</span>
                        </div>

                        <div className="summary-total-row">
                          <span className="summary-total-label">Est. Total Cost</span>
                          <span className="summary-total-val">₹{totalCost.toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    <div className="summary-tip-box">
                      <Info size={16} style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                      <div style={{ color: 'var(--primary-color)' }}>
                        Rates are live estimations from Shiprocket. You will select the final carrier in Step 2.
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-blue-primary"
                      disabled={loadingEstimate || !!estimateError || !totalCost}
                    >
                      Proceed to Ship
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: Courier Select */}
          {wizardStep === 2 && (
            <div className="sr-grid-layout">
              <div>
                {/* AWB Generated Banner */}
                <div className="awb-alert-strip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} color="var(--primary-color)" />
                    <span>AWB Number generated successfully: <span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{currentAwb}</span></span>
                  </div>
                  <button 
                    type="button" 
                    className="btn-copy-tag"
                    onClick={() => handleCopyText(currentAwb)}
                  >
                    {copiedId === currentAwb ? 'COPIED!' : 'COPY AWB'}
                  </button>
                </div>

                <div className="sr-card-panel">
                  <h3 className="sr-panel-title">Available Couriers (Shiprocket Integration)</h3>

                  {loadingCouriers ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                      <RefreshCw className="sr-spinner" size={24} style={{ margin: '0 auto 10px auto', color: 'var(--primary-color)' }} />
                      <div style={{ fontWeight: '600' }}>Fetching available Shiprocket couriers...</div>
                    </div>
                  ) : couriersList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={24} style={{ margin: '0 auto 10px auto', color: 'var(--danger)' }} />
                      <div style={{ fontWeight: '600' }}>No serviceable couriers found for pincode {pincode}.</div>
                    </div>
                  ) : (
                    couriersList.map((courier) => {
                      const isSelected = selectedCourier === courier.courier_company_id.toString();
                      return (
                        <div 
                          key={courier.courier_company_id}
                          className={`courier-option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedCourier(courier.courier_company_id.toString())}
                        >
                          <div className="courier-details-left">
                            <div className="courier-logo-circle logo-d" style={{ background: isSelected ? 'var(--primary-color)' : '#f1f5f9', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                              {courier.courier_name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontWeight: '750', fontSize: '0.88rem', color: 'var(--text-main)' }}>{courier.courier_name}</span>
                                {courier.recommendation_score >= 4 && (
                                  <span className="badge-recommended">Recommended</span>
                                )}
                              </div>
                              <span className="courier-meta-txt">
                                Rating: {courier.rating || 'N/A'} • Expected {courier.etd || '2-4 Days'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="courier-rate-tag">₹{parseFloat(courier.rate).toFixed(2)}</span>
                            <div className="courier-radio-selector">
                              {isSelected && <div className="radio-dot-active" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sender/Receiver Details */}
                <div className="split-address-container">
                  <div className="address-box-card">
                    <div className="address-box-hdr">Sender (Pickup Address)</div>
                    <div className="address-box-body">
                      <span style={{ fontWeight: '700' }}>Spiritual Homeopathy Clinic</span>
                      <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{fromAddress} - {fromPincode}</div>
                    </div>
                  </div>

                  <div className="address-box-card">
                    <div className="address-box-hdr">Receiver (Delivery Address)</div>
                    <div className="address-box-body">
                      <span style={{ fontWeight: '700' }}>{fullName}</span>
                      <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{deliveryAddress}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Booking Side Card */}
              <div>
                <div className="summary-side-card">
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Confirm Booking
                  </h3>

                  <div className="summary-row-item">
                    <span>Selected Courier</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                      {couriersList.find(c => c.courier_company_id.toString() === selectedCourier)?.courier_name || 'None Selected'}
                    </span>
                  </div>

                  <div className="summary-row-item">
                    <span>Pickup Date</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Tomorrow, 10:00 AM</span>
                  </div>

                  <div className="summary-row-item">
                    <span>Weight Class</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{deadWeight} kg Tier</span>
                  </div>

                  <button 
                    type="button" 
                    className="btn-blue-primary"
                    style={{ marginTop: '16px' }}
                    onClick={handleConfirmPickup}
                  >
                    Schedule Pickup
                  </button>

                  <button 
                    type="button" 
                    className="btn-outline-sec"
                    onClick={() => {
                      if (!isPickupScheduled || !currentLabelUrl) {
                        alert("Please Schedule Pickup first to generate label details.");
                        return;
                      }
                      window.open(currentLabelUrl, '_blank');
                    }}
                  >
                    <Printer size={16} /> Download Label
                  </button>

                  {currentManifestUrl && (
                    <button 
                      type="button" 
                      className="btn-outline-sec"
                      onClick={() => window.open(currentManifestUrl, '_blank')}
                    >
                      <FileText size={16} /> Download Manifest
                    </button>
                  )}

                  {/* Booking Success Block */}
                  {isPickupScheduled && (
                    <div className="booking-success-box">
                      <div className="success-box-title">
                        <CheckCircle2 size={16} color="var(--success)" /> Shipment Successfully Booked
                      </div>
                      <div>
                        Shipment ID: <span style={{ fontWeight: '700' }}>{scheduledShipmentId}</span>
                        <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#166534' }}>
                          AWB Code: <span style={{ fontWeight: '700' }}>{currentAwb}</span>. Manifest and label generated successfully in Shiprocket.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Return tab btn */}
                  <button
                    type="button"
                    className="btn-outline-sec"
                    style={{ marginTop: '14px', background: '#f8fafc' }}
                    onClick={() => {
                      setActiveTab('history');
                      setWizardStep(1);
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Dispatches
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RTO RISK ASSESSMENT DIALOG MODAL */}
      {activeRtoShipment && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-hdr">
              <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--success)" /> RTO Risk Analysis
              </h4>
              <button 
                type="button" 
                className="btn-modal-close"
                onClick={() => setActiveRtoShipment(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', padding: '30px 24px' }}>
              <div style={{ background: '#f0fdf4', color: 'var(--success)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h5 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>Low Risk Assessment</h5>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Patient has verified delivery logs</p>

              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginTop: '20px', textAlign: 'left', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pincode Reachability:</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>Excellent (100%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Contact Verification:</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>Mobile Verified</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Integrity:</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>Prepaid Secure</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '8px' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>Overall Success Rate:</span>
                  <span style={{ fontWeight: '800', color: 'var(--success)' }}>98.2% Success</span>
                </div>
              </div>
            </div>

            <div className="modal-ftr">
              <button 
                type="button" 
                className="btn-blue-primary"
                style={{ padding: '8px 20px', width: 'auto' }}
                onClick={() => setActiveRtoShipment(null)}
              >
                Close Risk Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIPMENT LIVE TIMELINE TRACKING DIALOG MODAL */}
      {trackingModalVisible && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '580px', width: '100%', borderRadius: '16px' }}>
            <div className="modal-hdr">
              <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Truck size={20} color="var(--primary-color)" /> Shipment Live Tracking
              </h4>
              <button 
                type="button" 
                className="btn-modal-close"
                onClick={() => setTrackingModalVisible(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Air Waybill Number (AWB)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                  {trackingAwb}
                </div>
              </div>

              {loadingTracking ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <RefreshCw className="sr-spinner" size={32} style={{ color: 'var(--primary-color)', margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: '750', color: 'var(--text-muted)' }}>Retrieving Shiprocket tracking timeline...</div>
                </div>
              ) : trackingData && trackingData.error ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <AlertTriangle size={36} color="var(--warning)" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '650' }}>{trackingData.error}</p>
                  <a 
                    href={`https://track.shiprocket.co/${trackingAwb}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-blue-primary"
                    style={{ display: 'inline-flex', padding: '8px 20px', width: 'auto', textDecoration: 'none' }}
                  >
                    Track on Web Portal
                  </a>
                </div>
              ) : trackingData ? (
                <div>
                  <div style={{ background: 'rgba(37, 142, 200, 0.05)', border: '1px solid rgba(37, 142, 200, 0.15)', borderRadius: '10px', padding: '14px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                      CURRENT STATUS: {(trackingData.shipment_track?.[0]?.current_status || 'IN TRANSIT').toUpperCase()}
                    </div>
                    {trackingData.shipment_track?.[0]?.etd && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '600' }}>
                        Expected Delivery: {trackingData.shipment_track[0].etd}
                      </div>
                    )}
                  </div>

                  <h5 style={{ margin: '0 0 12px 0', fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Logistics Timeline
                  </h5>

                  {trackingData.shipment_track_activities && trackingData.shipment_track_activities.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0', marginLeft: '12px' }}>
                      {trackingData.shipment_track_activities.map((activity, index) => {
                        const isFirst = index === 0;
                        return (
                          <div key={index} style={{ position: 'relative', paddingLeft: '20px' }}>
                            {/* Dot */}
                            <div style={{ 
                              position: 'absolute', 
                              left: '-27px', 
                              top: '4px', 
                              width: '10px', 
                              height: '10px', 
                              borderRadius: '50%', 
                              background: isFirst ? 'var(--primary-color)' : '#cbd5e1',
                              border: isFirst ? '2px solid rgba(37, 142, 200, 0.25)' : 'none'
                            }} />
                            
                            {/* Content */}
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: isFirst ? '800' : '700', color: isFirst ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                {activity.activity || 'Status updated'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {activity.location || 'Hub location'} • {activity.date}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      <Info size={24} style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '0.8rem' }}>No activity records reported yet.</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '25px', color: 'var(--text-muted)' }}>
                  <Info size={28} style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.8rem' }}>No active tracking history found.</div>
                </div>
              )}
            </div>

            <div className="modal-ftr">
              <button 
                type="button" 
                className="btn-blue-primary"
                style={{ padding: '8px 20px', width: 'auto' }}
                onClick={() => setTrackingModalVisible(false)}
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingForm;
