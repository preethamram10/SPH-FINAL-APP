import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, getDoc, addDoc, doc, setDoc, deleteDoc, updateDoc, query, where, limit, orderBy, deleteField } from 'firebase/firestore';
import { LogOut, Users, Building2, Plus, LayoutDashboard, Eye, EyeOff, X, ExternalLink, FileImage, Calendar, Phone, Mail, MapPin, User, Trash2, RotateCcw, RotateCw, ZoomIn, ZoomOut, UserCheck, Briefcase, Clock, IndianRupee, Target, Package, ChevronLeft, ChevronRight, Coins, Gift, Tag, Apple, TrendingUp, Activity, RefreshCw, FileText } from 'lucide-react';
// We need a secondary app to create users without logging out the main admin
import { initializeApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import DoctorTimingsManager from './hr/DoctorTimingsManager';
import AdminOverview from '../components/AdminOverview';
import RevenueAnalysis from '../components/RevenueAnalysis';
import PendingPayments from './PendingPayments';
import PatientClassificationPage from './reception/PatientClassificationPage';
import HRTotalRevenue from './hr/HRTotalRevenue';
import AdminMedicineFormEditor from '../components/AdminMedicineFormEditor';
import { getStandardBranchName } from '../utils/idGenerator';
// Date helpers for robust matching
const parseHTMLDateToGBStr = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getSafeDisplayDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
  return dateStr;
};
const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return 'N/A';
  return dateStr;
};

const safeDateDisplay = (dateObj) => {
  if (!dateObj) return null;

  if (typeof dateObj === 'object' && dateObj.toDate) {
    return dateObj.toDate().toLocaleString();
  }

  if (typeof dateObj === 'string' && dateObj.startsWith('Timestamp(seconds=')) {
    const match = dateObj.match(/seconds=(\d+)/);
    if (match && match[1]) {
      return new Date(parseInt(match[1], 10) * 1000).toLocaleString();
    }
  }

  const d = new Date(dateObj);
  if (isNaN(d.getTime())) {
    if (typeof dateObj === 'string' && dateObj.includes('/')) {
      const parsed = parseGBDateToDateObj(dateObj);
      if (parsed) return parsed.toLocaleString();
    }
    return String(dateObj);
  }
  return d.toLocaleString();
};

const parseGBDateToDateObj = (gbDateStr) => {
  if (!gbDateStr) return null;
  const parts = gbDateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  const fallback = new Date(gbDateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const parseHTMLDateToDateObj = (htmlDateStr) => {
  if (!htmlDateStr) return null;
  const parts = htmlDateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const fallback = new Date(htmlDateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const getSortableTimestamp = (val) => {
  if (!val) return 0;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val.seconds) return val.seconds * 1000;
  }
  if (typeof val === 'string') {
    const clean = val.trim();
    if (!clean) return 0;
    const parsed = parseGBDateToDateObj(clean.replace(/-/g, '/'));
    if (parsed) return parsed.getTime();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const isBranchMatchHelper = (itemBranchId, itemBranchName, filterBranchId, branchesList) => {
  if (!filterBranchId || filterBranchId === 'all') return true;
  const selectedBranchName = branchesList.find(b => b.id === filterBranchId)?.name;

  const normalize = (val) => {
    if (!val) return '';
    const str = String(val).toLowerCase().trim();
    if (str.includes('kphb') || str.includes('kphp')) return 'kphb';
    if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandanagar';
    if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
    if (str.includes('nallagandla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
    return str.replace(/\s*branch\s*/i, '').trim();
  };

  const normId = normalize(itemBranchId);
  const normName = normalize(itemBranchName);
  const normFilterId = normalize(filterBranchId);
  const normFilterName = normalize(selectedBranchName);

  return normId === normFilterId || normId === normFilterName ||
    normName === normFilterId || normName === normFilterName ||
    itemBranchId === filterBranchId || itemBranchName === selectedBranchName;
};

const parseAnyDateObj = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) return dateVal.toDate();
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);

  if (typeof dateVal === 'string') {
    if (dateVal.includes('T') && (dateVal.endsWith('Z') || dateVal.includes('+'))) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return d;
    }
    if (dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    if (dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else if (parts[2].length === 4) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    }
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const checkAmountRange = (amt, rangeStr) => {
  if (rangeStr === 'all') return true;
  switch (rangeStr) {
    case '500-1000': return amt >= 500 && amt <= 1000;
    case '1000-2000': return amt >= 1000 && amt <= 2000;
    case '2000-3000': return amt >= 2000 && amt <= 3000;
    case '3000-4000': return amt >= 3000 && amt <= 4000;
    case '4000-5000': return amt >= 4000 && amt <= 5000;
    case '5000+': return amt > 5000;
    default: return true;
  }
};

const SuperAdminDashboard = () => {
  const { userData } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const MIGRATION_KEY = 'sph_split_fix_v2_done';
    if (localStorage.getItem(MIGRATION_KEY) === 'true') return;

    const runMigration = async () => {
      try {
        console.log('[MIGRATION] Starting split payment repair...');
        let fixedPatients = 0;
        let fixedTransactions = 0;

        // ── Step 1: Load all split-payment patients ──
        const splitSnap = await getDocs(query(
          collection(db, 'allpatients'),
          where('paymentMethod', 'in', ['split', 'app_split']),
          limit(500)
        ));

        const patients = [];
        splitSnap.forEach(d => patients.push({ docId: d.id, ...d.data() }));
        console.log(`[MIGRATION] Found ${patients.length} split-payment patient records`);

        // ── Step 2: For each patient, compute correct total ──
        for (const p of patients) {
          // Calculate correct total from paymentSplitDetails
          let correctAmount = 0;
          const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
          if (sd) {
            correctAmount = Object.values(sd).reduce((s, v) => s + Number(v || 0), 0);
          }
          // Fallback: splitCounterAmount + splitUpiAmount
          if (!correctAmount && (p.splitCounterAmount !== undefined || p.splitUpiAmount !== undefined)) {
            correctAmount = Number(p.splitCounterAmount || 0) + Number(p.splitUpiAmount || 0);
          }
          // If we can't determine correct amount, skip
          if (correctAmount <= 0) continue;

          const storedAmount = Number(p.paymentAmount || 0);
          const needsPatientFix = storedAmount !== correctAmount;

          // ── Fix allpatients doc ──
          if (needsPatientFix) {
            await updateDoc(doc(db, 'allpatients', p.docId), {
              paymentAmount: correctAmount,
              splitAmountFixedAt: new Date().toISOString()
            });
            fixedPatients++;
            console.log(`[MIGRATION] Fixed allpatients ${p.docId} (${p.fullName || p.patientName}): ₹${storedAmount} → ₹${correctAmount}`);
          }

          // ── Step 3: Fix alltransactions records for this patient ──
          // Find transactions with amount=0 OR wrong amount linked to this patient
          const txSnap = await getDocs(query(
            collection(db, 'alltransactions'),
            where('patientId', '==', p.docId)
          ));

          for (const txDoc of txSnap.docs) {
            const tx = txDoc.data();
            const txAmt = Number(tx.amount || 0);
            // Only fix if amount is 0 and this is a consultation-type transaction
            if (txAmt === 0 && (tx.type === 'consultation' || !tx.type)) {
              const txPayload = {
                amount: correctAmount,
                method: 'split',
                ...(sd ? { paymentSplitDetails: sd } : {}),
                fixedAt: new Date().toISOString(),
                fixNote: 'Auto-corrected by split migration: amount was 0'
              };
              await updateDoc(doc(db, 'alltransactions', txDoc.id), txPayload);
              fixedTransactions++;
              console.log(`[MIGRATION] Fixed alltransactions ${txDoc.id}: ₹0 → ₹${correctAmount}`);
            }
          }
        }

        // ── Step 4: Also fix patients collection (duplicates of allpatients) ──
        const pSplitSnap = await getDocs(query(
          collection(db, 'patients'),
          where('paymentMethod', 'in', ['split', 'app_split']),
          limit(500)
        ));
        for (const pDoc of pSplitSnap.docs) {
          const p = pDoc.data();
          const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
          if (!sd) continue;
          const correctAmount = Object.values(sd).reduce((s, v) => s + Number(v || 0), 0);
          if (correctAmount > 0 && Number(p.paymentAmount || 0) !== correctAmount) {
            await updateDoc(doc(db, 'patients', pDoc.id), {
              paymentAmount: correctAmount,
              splitAmountFixedAt: new Date().toISOString()
            });
            fixedPatients++;
          }
        }

        console.log(`[MIGRATION] Done. Fixed ${fixedPatients} patient records, ${fixedTransactions} transactions.`);
        localStorage.setItem(MIGRATION_KEY, 'true');
      } catch (err) {
        console.warn('[MIGRATION] Split payment repair error:', err.message);
      }
    };

    runMigration();
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const toggleSidebar = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('sidebar-collapsed', String(nextVal));
  };
  const [activeTab, setActiveTabState] = useState(() => {
    if (window.location.pathname === '/patient-classification') {
      return 'patient-classification';
    }
    const saved = localStorage.getItem('superadmin-active-tab');
    if (location.state?.activeTab) {
      localStorage.setItem('superadmin-active-tab', location.state.activeTab);
      return location.state.activeTab;
    }
    return saved || 'overview';
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    localStorage.setItem('superadmin-active-tab', tab);
  };
  const [branches, setBranches] = useState([]);
  const [patients, setPatients] = useState([]);
  const [allRevenueRecords, setAllRevenueRecords] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);

  // Package Members State
  const [packageMembers, setPackageMembers] = useState([]);
  const [packagesSearch, setPackagesSearch] = useState('');
  const [packagesBranchId, setPackagesBranchId] = useState('all');
  const [packagesStatus, setPackagesStatus] = useState('all');

  // New Branch State
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchUsername, setNewBranchUsername] = useState('');
  const [newBranchPassword, setNewBranchPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Branch Detail State
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchEditData, setBranchEditData] = useState(null);
  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);

  // Patient Detail State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const lastFetchedPhoneRef = useRef('');
  const [imageViewer, setImageViewer] = useState({ open: false, urls: [], currentIndex: 0, zoom: 1, rotate: 0 });

  // Staff State
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'staff',
    doctorType: 'employee',
    branchId: '',
    salary: '',
    shiftType: 'single',
    loginTime: '09:00 AM',
    logoutTime: '06:00 PM',
    loginTime2: '',
    logoutTime2: ''
  });
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Edit Staff State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffEditData, setStaffEditData] = useState(null);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);


  // Revenue Settings & Filters State
  const [revenueSearch, setRevenueSearch] = useState('');
  const [revenueDate, setRevenueDate] = useState('');
  const [revenueYear, setRevenueYear] = useState('all');
  const [revenueMonth, setRevenueMonth] = useState('all');
  const [revenueSource, setRevenueSource] = useState('all');
  const [revenueBranchId, setRevenueBranchId] = useState('all');
  const [revenueMethod, setRevenueMethod] = useState('all');
  const [revenueDoctor, setRevenueDoctor] = useState('all');
  const [revenueSplitType, setRevenueSplitType] = useState('all');
  const [revenueAmountRange, setRevenueAmountRange] = useState('all');
  const [allTxCurrentPage, setAllTxCurrentPage] = useState(1);
  const [allTxPerPage, setAllTxPerPage] = useState(25);

  // Nutrition Revenue Filters State
  const [nutritionPlans, setNutritionPlans] = useState([]);
  const [nutritionSearch, setNutritionSearch] = useState('');
  const [nutritionBranchId, setNutritionBranchId] = useState('all');
  const [nutritionDate, setNutritionDate] = useState('');
  const [nutritionYear, setNutritionYear] = useState('all');
  const [nutritionMonth, setNutritionMonth] = useState('all');
  const [selectedViewPlan, setSelectedViewPlan] = useState(null);
  const handleResetNutritionFilters = () => {
    setNutritionSearch('');
    setNutritionBranchId('all');
    setNutritionDate('');
    setNutritionYear('all');
    setNutritionMonth('all');
  };
  const handleResetRevenueFilters = () => {
    setRevenueSearch('');
    setRevenueBranchId('all');
    setRevenueDate('');
    setRevenueYear('all');
    setRevenueMonth('all');
    setRevenueSource('all');
    setRevenueMethod('all');
    setRevenueDoctor('all');
    setRevenueSplitType('all');
    setRevenueAmountRange('all');
  };
  // Pharmacy Revenue State
  const [medicineTransactions, setMedicineTransactions] = useState([]);
  const [medicineForms, setMedicineForms] = useState([]);
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacyDate, setPharmacyDate] = useState('');
  const [pharmacyYear, setPharmacyYear] = useState('all');
  const [pharmacyMonth, setPharmacyMonth] = useState('all');
  const [pharmacySource, setPharmacySource] = useState('all');
  const [pharmacyBranchId, setPharmacyBranchId] = useState('all');
  const [pharmacyMethod, setPharmacyMethod] = useState('all');
  const handleResetPharmacyFilters = () => {
    setPharmacySearch('');
    setPharmacyBranchId('all');
    setPharmacyDate('');
    setPharmacyYear('all');
    setPharmacyMonth('all');
    setPharmacySource('all');
    setPharmacyMethod('all');
  };

  // Filtering
  const [selectedBranchId, setSelectedBranchId] = useState('all');

  // Global Patient List Search and Pagination State
  const [patientsSearch, setPatientsSearch] = useState('');
  const [debouncedPatientsSearch, setDebouncedPatientsSearch] = useState('');
  const [patientsCurrentPage, setPatientsCurrentPage] = useState(1);
  const [patientsPerPage, setPatientsPerPage] = useState(25);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPatientsSearch(patientsSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [patientsSearch]);

  // Rewards & Coupons states
  const [rewardTransactions, setRewardTransactions] = useState([]);
  const [couponsList, setCouponsList] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsSubTab, setRewardsSubTab] = useState('wallets'); // 'wallets', 'active_coupons', 'redeemed_coupons'
  const [appointmentsList, setAppointmentsList] = useState([]);
  const fetchBranches = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const branchData = [];
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'branch' || data.role === 'admin' || data.name?.toLowerCase().includes('branch')) {
          branchData.push({ id: doc.id, name: data.name || data.branchName || doc.id, ...data });
        }
      });

      const canonicals = [
        { id: 'kphb', name: 'KPHB Branch', branchName: 'KPHB' },
        { id: 'chandanagar', name: 'Chandanagar Branch', branchName: 'Chandanagar' },
        { id: 'dilshuknagar', name: 'Dilshuknagar Branch', branchName: 'Dilshuknagar' },
        { id: 'nallagandla', name: 'Nallagandla Branch', branchName: 'Nallagandla' }
      ];

      canonicals.forEach(c => {
        const normC = c.branchName.toLowerCase();
        const exists = branchData.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(normC));
        if (!exists) {
          branchData.push(c);
        }
      });

      setBranches(branchData);
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([
        { id: 'kphb', name: 'KPHB Branch', branchName: 'KPHB' },
        { id: 'chandanagar', name: 'Chandanagar Branch', branchName: 'Chandanagar' },
        { id: 'dilshuknagar', name: 'Dilshuknagar Branch', branchName: 'Dilshuknagar' },
        { id: 'nallagandla', name: 'Nallagandla Branch', branchName: 'Nallagandla' }
      ]);
    }
  };

  const fetchPatients = async (searchQuery = '') => {
    try {
      const allPatientsRef = collection(db, 'allpatients');
      const patientsRef = collection(db, 'patients');

      let snapAll = { docs: [] };
      let snapPat = { docs: [] };

      const searchVal = searchQuery.trim();
      if (searchVal) {
        if (/^\d+$/.test(searchVal)) {
          const cleanPhone = searchVal.slice(-10);
          const qAllExact = query(allPatientsRef, where('phone', '==', searchVal));
          const qPatExact = query(patientsRef, where('phone', '==', searchVal));
          const snapAllExact = await getDocs(qAllExact).catch(() => ({ docs: [] }));
          const snapPatExact = await getDocs(qPatExact).catch(() => ({ docs: [] }));

          let snapAllClean = { docs: [] };
          let snapPatClean = { docs: [] };
          if (cleanPhone !== searchVal) {
            const qAllClean = query(allPatientsRef, where('phone', '==', cleanPhone));
            const qPatClean = query(patientsRef, where('phone', '==', cleanPhone));
            snapAllClean = await getDocs(qAllClean).catch(() => ({ docs: [] }));
            snapPatClean = await getDocs(qPatClean).catch(() => ({ docs: [] }));
          }

          const qAllPrefix = query(allPatientsRef, where('phone', '>=', searchVal), where('phone', '<=', searchVal + '\uf8ff'), limit(50));
          const qPatPrefix = query(patientsRef, where('phone', '>=', searchVal), where('phone', '<=', searchVal + '\uf8ff'), limit(50));
          const snapAllPrefix = await getDocs(qAllPrefix).catch(() => ({ docs: [] }));
          const snapPatPrefix = await getDocs(qPatPrefix).catch(() => ({ docs: [] }));

          const seen = new Set();
          const allDocs = [];
          [snapAllExact, snapAllClean, snapAllPrefix].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                allDocs.push(docSnap);
              }
            });
          });
          const patDocs = [];
          [snapPatExact, snapPatClean, snapPatPrefix].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                patDocs.push(docSnap);
              }
            });
          });

          snapAll = allDocs;
          snapPat = patDocs;
        } else if (searchVal.toLowerCase().startsWith('wk-')) {
          const lowerReg = searchVal.toLowerCase();
          const upperReg = searchVal.toUpperCase();

          const qAllLower = query(allPatientsRef, where('registrationId', '==', lowerReg));
          const qPatLower = query(patientsRef, where('registrationId', '==', lowerReg));
          const qAllUpper = query(allPatientsRef, where('registrationId', '==', upperReg));
          const qPatUpper = query(patientsRef, where('registrationId', '==', upperReg));

          const [snapAllL, snapPatL, snapAllU, snapPatU] = await Promise.all([
            getDocs(qAllLower).catch(() => ({ docs: [] })),
            getDocs(qPatLower).catch(() => ({ docs: [] })),
            getDocs(qAllUpper).catch(() => ({ docs: [] })),
            getDocs(qPatUpper).catch(() => ({ docs: [] }))
          ]);

          const seen = new Set();
          const allDocs = [];
          [snapAllL, snapAllU].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                allDocs.push(docSnap);
              }
            });
          });

          const patDocs = [];
          [snapPatL, snapPatU].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                patDocs.push(docSnap);
              }
            });
          });

          snapAll = allDocs;
          snapPat = patDocs;
        } else {
          const capSearch = searchVal.charAt(0).toUpperCase() + searchVal.slice(1);
          const lowerSearch = searchVal.toLowerCase();
          const upperSearch = searchVal.toUpperCase();

          const qAllCap = query(allPatientsRef, where('fullName', '>=', capSearch), where('fullName', '<=', capSearch + '\uf8ff'), limit(100));
          const qPatCap = query(patientsRef, where('fullName', '>=', capSearch), where('fullName', '<=', capSearch + '\uf8ff'), limit(100));

          const qAllLower = query(allPatientsRef, where('fullName', '>=', lowerSearch), where('fullName', '<=', lowerSearch + '\uf8ff'), limit(100));
          const qPatLower = query(patientsRef, where('fullName', '>=', lowerSearch), where('fullName', '<=', lowerSearch + '\uf8ff'), limit(100));

          const qAllUpper = query(allPatientsRef, where('fullName', '>=', upperSearch), where('fullName', '<=', upperSearch + '\uf8ff'), limit(100));
          const qPatUpper = query(patientsRef, where('fullName', '>=', upperSearch), where('fullName', '<=', upperSearch + '\uf8ff'), limit(100));

          const [snapAllCap, snapPatCap, snapAllLower, snapPatLower, snapAllUpper, snapPatUpper] = await Promise.all([
            getDocs(qAllCap).catch(() => ({ docs: [] })),
            getDocs(qPatCap).catch(() => ({ docs: [] })),
            getDocs(qAllLower).catch(() => ({ docs: [] })),
            getDocs(qPatLower).catch(() => ({ docs: [] })),
            getDocs(qAllUpper).catch(() => ({ docs: [] })),
            getDocs(qPatUpper).catch(() => ({ docs: [] }))
          ]);

          const seen = new Set();
          const allDocs = [];
          [snapAllCap, snapAllLower, snapAllUpper].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                allDocs.push(docSnap);
              }
            });
          });

          const patDocs = [];
          [snapPatCap, snapPatLower, snapPatUpper].forEach(snap => {
            snap.forEach(docSnap => {
              if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                patDocs.push(docSnap);
              }
            });
          });

          snapAll = allDocs;
          snapPat = patDocs;
        }
      } else {
        const qAllDefault = query(allPatientsRef, limit(200));
        const qPatDefault = query(patientsRef, limit(200));
        const [snapAllD, snapPatD] = await Promise.all([
          getDocs(qAllDefault).catch(() => ({ docs: [] })),
          getDocs(qPatDefault).catch(() => ({ docs: [] }))
        ]);
        snapAll = snapAllD;
        snapPat = snapPatD;
      }

      let patientData = [];
      const seenIds = new Set();
      const seenRegIds = new Set();
      const seenPhones = new Set();

      snapPat.forEach(docSnap => {
        const data = docSnap.data();
        const regId = data.registrationId || data.regId || data.regID;
        const phone = data.phone || data.patientPhone || data.phoneNumber;
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          if (regId) seenRegIds.add(regId);
          if (phone) seenPhones.add(phone);
          patientData.push({ id: docSnap.id, sourceCollection: 'patients', ...data });
        }
      });

      snapAll.forEach(docSnap => {
        const data = docSnap.data();
        const regId = data.registrationId || data.regId || data.regID;
        const phone = data.phone || data.patientPhone || data.phoneNumber;

        let isDuplicate = false;
        if (seenIds.has(docSnap.id)) isDuplicate = true;
        else if (regId && seenRegIds.has(regId)) isDuplicate = true;
        else if (phone && seenPhones.has(phone)) isDuplicate = true;

        if (!isDuplicate) {
          seenIds.add(docSnap.id);
          if (regId) seenRegIds.add(regId);
          if (phone) seenPhones.add(phone);
          patientData.push({ id: docSnap.id, sourceCollection: 'allpatients', ...data });
        }
      });

      setPatients(patientData);
      return patientData;
    } catch (error) {
      console.error('Error fetching patients:', error);
      return [];
    }
  };

  const fetchStaff = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const staffData = [];
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (['doctor', 'staff', 'receptionist', 'hr'].includes(data.role)) {
          staffData.push({ id: doc.id, ...data });
        }
      });
      setStaffMembers(staffData);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };



  const fetchMedicineTransactions = async () => {
    try {
      const q = query(collection(db, 'alltransactions'), orderBy('timestamp', 'desc'), limit(500));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setMedicineTransactions(data);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  };

  // Fetch appointments and merge payment status into patients
  // Accepts freshPatientsData directly to avoid React stale state race condition
  const fetchAndMergeAppointmentPayments = async (freshPatientsData = []) => {
    try {
      setAllRevenueRecords(freshPatientsData);
      setPatients(freshPatientsData);
    } catch (e) {
      console.error('Error fetching appointment payments:', e);
    }
  };

  const fetchMedicineForms = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'alltransactions'), limit(500)));
      const data = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      setMedicineForms(data);
    } catch (e) {
      console.error('Error fetching medicine forms:', e);
    }
  };



  const handleSaveDoctorFee = async (e) => {
    e.preventDefault();
    if (!feeBranchId || !feeDoctorId || !feeAmountValue) {
      alert('Please select a branch, a doctor, and enter a fee amount.');
      return;
    }

    setIsSavingDoctorFee(true);
    try {
      const docRef = doc(db, 'users', feeDoctorId);
      await updateDoc(docRef, {
        consultationFee: Number(feeAmountValue),
        updatedAt: new Date().toISOString()
      });

      // Update local state staffMembers to reflect the change immediately
      setStaffMembers(prev => prev.map(s => s.id === feeDoctorId ? { ...s, consultationFee: Number(feeAmountValue) } : s));

      alert('Doctor consultation fee updated successfully!');
      setFeeAmountValue('');
      setFeeDoctorId('');
    } catch (error) {
      console.error('Error saving doctor fee:', error);
      alert('Failed to update doctor fee.');
    } finally {
      setIsSavingDoctorFee(false);
    }
  };

  const handleResetDoctorFee = async (doctorId) => {
    if (!window.confirm("Are you sure you want to reset this doctor's fee to the global default?")) return;
    try {
      const docRef = doc(db, 'users', doctorId);
      await updateDoc(docRef, {
        consultationFee: null
      });

      // Update local state staffMembers
      setStaffMembers(prev => prev.map(s => s.id === doctorId ? { ...s, consultationFee: null } : s));
      alert('Doctor fee reset to global default.');
    } catch (error) {
      console.error('Error resetting doctor fee:', error);
      alert('Failed to reset doctor fee.');
    }
  };

  const [bannersList, setBannersList] = useState([]);
  const [bannerForm, setBannerForm] = useState({ id: 'home', imageUrl: '' });
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);

  const fetchBanners = async () => {
    try {
      const snap = await getDocs(collection(db, 'banners'));
      const data = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      setBannersList(data);
    } catch (e) {
      console.error('Error fetching banners:', e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be less than 2MB for optimal performance.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerForm({ ...bannerForm, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePublishBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.imageUrl.trim()) {
      alert('Please enter or select a valid banner image URL.');
      return;
    }
    setIsUpdatingBanner(true);
    try {
      const bannerTypes = {
        home: 'Main Home Banner (Recommended: 350x160 px)',
        doctors: 'Doctors List Banner (Recommended: 350x120 px)',
        booking: 'Booking Page Banner (Recommended: 350x120 px)'
      };

      await setDoc(doc(db, 'banners', bannerForm.id), {
        page: bannerForm.id,
        imageUrl: bannerForm.imageUrl.trim(),
        sizeInfo: bannerTypes[bannerForm.id],
        updatedAt: new Date().toISOString(),
        updatedBy: userData?.name || userData?.email || 'Super Admin'
      });

      alert('Banner published successfully!');
      setBannerForm({ id: bannerForm.id, imageUrl: '' });
      fetchBanners();
    } catch (error) {
      console.error('Error publishing banner:', error);
      alert('Failed to publish banner: ' + error.message);
    } finally {
      setIsUpdatingBanner(false);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm('Are you sure you want to delete this banner? It will fall back to patient-app default assets.')) {
      try {
        await deleteDoc(doc(db, 'banners', bannerId));
        fetchBanners();
        alert('Banner deleted successfully!');
      } catch (error) {
        console.error('Error deleting banner:', error);
        alert('Failed to delete banner.');
      }
    }
  };

  const fetchPackageMembers = async () => {
    try {
      const snap = await getDocs(collection(db, 'package_members'));
      const data = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setPackageMembers(data);
    } catch (e) {
      console.error('Error fetching package members:', e);
    }
  };

  const fetchNutritionPlans = async () => {
    try {
      const q = query(collection(db, 'nutrition_plans'), orderBy('createdAt', 'desc'), limit(2000));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      setNutritionPlans(data);
    } catch (e) {
      console.error('Error fetching nutrition plans:', e);
    }
  };

  const fetchRewardsData = async () => {
    setRewardsLoading(true);
    try {
      const couponsSnap = await getDocs(collection(db, 'coupons'));
      const coupons = [];
      couponsSnap.forEach(doc => {
        coupons.push({ id: doc.id, ...doc.data() });
      });
      setCouponsList(coupons);

      const transSnap = await getDocs(collection(db, 'reward_points_transactions'));
      const transactions = [];
      transSnap.forEach(doc => {
        transactions.push({ id: doc.id, ...doc.data() });
      });
      setRewardTransactions(transactions);

      // Fetch ALL patients who have rewardPoints > 0
      const rewardPatientsSnap = await getDocs(
        query(collection(db, 'allpatients'), where('rewardPoints', '>', 0))
      );
      const rewardPatients = [];
      rewardPatientsSnap.forEach(doc => {
        rewardPatients.push({ id: doc.id, ...doc.data() });
      });

      // Also fetch patients by userId from transactions (in case they redeemed all points and have 0 now)
      const transactionUserIds = [...new Set(transactions.map(t => t.userId).filter(Boolean))];
      const existingIds = new Set(rewardPatients.map(p => p.id));

      // Fetch any missing patient profiles from transactions
      for (const userId of transactionUserIds) {
        if (!existingIds.has(userId)) {
          try {
            const pDoc = await getDoc(doc(db, 'allpatients', userId));
            if (pDoc.exists()) {
              rewardPatients.push({ id: pDoc.id, ...pDoc.data() });
              existingIds.add(pDoc.id);
            }
          } catch (e) {
            // Skip if patient doc doesn't exist
          }
        }
      }

      // Merge with existing patients state (add any that are missing)
      setPatients(prev => {
        const prevIds = new Set(prev.map(p => p.id));
        const merged = [...prev];
        rewardPatients.forEach(rp => {
          if (!prevIds.has(rp.id)) {
            merged.push(rp);
          } else {
            // Update existing entry with latest rewardPoints
            const idx = merged.findIndex(p => p.id === rp.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], rewardPoints: rp.rewardPoints };
            }
          }
        });
        return merged;
      });

      // Also fetch allpatients for patient name/phone resolution fallback (limit 300 for speed)
      const apptSnap = await getDocs(query(collection(db, 'allpatients'), limit(300)));
      const appts = [];
      apptSnap.forEach(doc => {
        appts.push({ id: doc.id, ...doc.data() });
      });
      setAppointmentsList(appts);
    } catch (error) {
      console.error("Error fetching rewards admin data:", error);
    } finally {
      setRewardsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchBanners();
  }, []);

  useEffect(() => {
    if (activeTab === 'patients') {
      fetchPatients(debouncedPatientsSearch);
    } else if (activeTab === 'staff') {
      fetchStaff();
    } else if (activeTab === 'rewards') {
      fetchRewardsData();
      fetchPatients();
    } else if (activeTab === 'nutrition-revenue') {
      fetchNutritionPlans();
    } else if (activeTab === 'average-revenue' || activeTab === 'revenue') {
      // Pass fresh patients data directly to avoid React stale state race condition
      fetchPatients().then(freshData => fetchAndMergeAppointmentPayments(freshData || []));
      fetchMedicineForms();
      fetchMedicineTransactions();
      fetchNutritionPlans();
      fetchStaff();
    }
  }, [activeTab, debouncedPatientsSearch]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!imageViewer.open || !imageViewer.urls || imageViewer.urls.length <= 1) return;
      if (e.key === 'ArrowRight') {
        setImageViewer(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.urls.length, zoom: 1, rotate: 0 }));
      } else if (e.key === 'ArrowLeft') {
        setImageViewer(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.urls.length) % prev.urls.length, zoom: 1, rotate: 0 }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageViewer.open, imageViewer.urls]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedPatient) {
        setSelectedPatientHistory([]);
        lastFetchedPhoneRef.current = '';
        return;
      }
      const phone = selectedPatient.phone;
      if (!phone || phone === 'N/A') {
        setSelectedPatientHistory([selectedPatient]);
        lastFetchedPhoneRef.current = '';
        return;
      }

      if (phone === lastFetchedPhoneRef.current) {
        return;
      }

      setLoadingHistory(true);
      try {
        lastFetchedPhoneRef.current = phone;
        const allPatientsRef = collection(db, 'allpatients');
        const patientsRef = collection(db, 'patients');

        const cleanPhone = phone.trim().slice(-10);
        const qAll = query(allPatientsRef, where('phone', '==', phone));
        const qPat = query(patientsRef, where('phone', '==', phone));

        const [snapAll, snapPat] = await Promise.all([
          getDocs(qAll).catch(() => ({ docs: [] })),
          getDocs(qPat).catch(() => ({ docs: [] }))
        ]);

        const historyData = [];
        const seenDocIds = new Set();

        const processSnap = (snap, sourceCol) => {
          snap.forEach(docSnap => {
            if (!seenDocIds.has(docSnap.id)) {
              seenDocIds.add(docSnap.id);
              historyData.push({
                id: docSnap.id,
                sourceCollection: sourceCol,
                ...docSnap.data()
              });
            }
          });
        };

        processSnap(snapAll, 'allpatients');
        processSnap(snapPat, 'patients');

        if (cleanPhone && cleanPhone !== phone) {
          const qAllClean = query(allPatientsRef, where('phone', '==', cleanPhone));
          const qPatClean = query(patientsRef, where('phone', '==', cleanPhone));
          const [snapAllC, snapPatC] = await Promise.all([
            getDocs(qAllClean).catch(() => ({ docs: [] })),
            getDocs(qPatClean).catch(() => ({ docs: [] }))
          ]);
          processSnap(snapAllC, 'allpatients');
          processSnap(snapPatC, 'patients');
        }

        historyData.sort((a, b) => {
          const dateA = a.sourceCollection === 'patients' ? (a.createdAt || a.appointmentDate) : (a.appointmentDate || a.createdAt);
          const dateB = b.sourceCollection === 'patients' ? (b.createdAt || b.appointmentDate) : (b.appointmentDate || b.createdAt);
          const timeA = getSortableTimestamp(dateA);
          const timeB = getSortableTimestamp(dateB);
          return timeB - timeA;
        });

        setSelectedPatientHistory(historyData);
      } catch (err) {
        console.error("Error fetching patient history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedPatient]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Use secondary app to prevent logout
      const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp');
      const secondaryAuth = getSecondaryAuth(secondaryApp);

      const emailToUse = newBranchUsername.includes('@')
        ? newBranchUsername.toLowerCase().replace(/\s+/g, '')
        : `${newBranchUsername}@sph.com`.toLowerCase().replace(/\s+/g, '');
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, newBranchPassword);
      const newUserId = userCredential.user.uid;

      // Save to firestore
      await setDoc(doc(db, 'users', newUserId), {
        name: newBranchName,
        username: newBranchUsername,
        email: emailToUse,
        role: 'branch',
        createdAt: new Date().toISOString()
      });

      await secondaryAuth.signOut();

      setShowAddBranch(false);
      setNewBranchName('');
      setNewBranchUsername('');
      setNewBranchPassword('');
      fetchBranches();
      alert('Branch created successfully!');
    } catch (error) {
      console.error('Error creating branch:', error);
      alert('Failed to create branch: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch || !branchEditData) return;
    setIsUpdatingBranch(true);
    try {
      await updateDoc(doc(db, 'users', selectedBranch.id), {
        name: branchEditData.name,
      });
      await fetchBranches();
      alert('Branch details updated successfully.');
      setSelectedBranch(null);
      setBranchEditData(null);
    } catch (error) {
      console.error('Error updating branch:', error);
      alert('Failed to update branch details.');
    } finally {
      setIsUpdatingBranch(false);
    }
  };

  const openBranchModal = (branch) => {
    setSelectedBranch(branch);
    setBranchEditData({ ...branch });
  };

  const closeBranchModal = () => {
    setSelectedBranch(null);
    setBranchEditData(null);
  };

  const handleDeleteBranch = async (branchId) => {
    if (window.confirm('Are you sure you want to delete this branch? This will remove their access to the portal.')) {
      try {
        await deleteDoc(doc(db, 'users', branchId));
        fetchBranches();
        alert('Branch deleted from database. Note: To reuse this username, you must also delete the user from Firebase Auth console.');
      } catch (error) {
        console.error('Error deleting branch:', error);
        alert('Failed to delete branch.');
      }
    }
  };

  const handleDeletePatient = async (patient) => {
    const patientId = patient.id;
    const collectionName = patient.sourceCollection || 'allpatients';
    if (window.confirm(`Are you sure you want to delete this patient record from ${collectionName}?`)) {
      try {
        await deleteDoc(doc(db, collectionName, patientId));
        fetchPatients();
        if (selectedPatient?.id === patientId) setSelectedPatient(null);
        alert('Patient record deleted successfully.');
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Failed to delete patient.');
      }
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();

    if (!newStaff.name.trim()) {
      alert('Please enter staff name');
      return;
    }
    if (!newStaff.phone || newStaff.phone.replace(/\D/g, '').length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const isEmailRole = ['staff', 'hr'].includes(newStaff.role);
    const cleanPhone = newStaff.phone.replace(/\D/g, '').slice(-10);

    // Email is required for Staff and HR in Web Admin
    const needsEmail = ['staff', 'hr'].includes(newStaff.role);
    if (needsEmail) {
      if (!newStaff.email || !newStaff.email.includes('@')) {
        alert('Please enter a valid Email ID');
        return;
      }
    }

    if (isEmailRole) {
      if (!newStaff.password) {
        alert('Please enter a Password');
        return;
      }
    }

    const needsBranch = ['staff', 'receptionist'].includes(newStaff.role);
    if (needsBranch && !newStaff.branchId) {
      alert('Please select a branch');
      return;
    }

    const needsSalarySchedule = newStaff.role === 'staff' || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee');
    if (needsSalarySchedule) {
      if (!newStaff.salary || isNaN(parseFloat(newStaff.salary))) {
        alert('Please enter a valid monthly salary amount');
        return;
      }
    }

    setIsCreatingStaff(true);
    try {
      const branch = newStaff.branchId ? branches.find(b => b.id === newStaff.branchId) : null;
      const emailToUse = newStaff.email ? newStaff.email.toLowerCase().trim() : '';

      // Check if email already exists in Firestore
      if (isEmailRole && emailToUse) {
        const qEmail = query(collection(db, 'users'), where('email', '==', emailToUse));
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          alert('Failed to authorize staff: A user with this email address already exists in the system.');
          setIsCreatingStaff(false);
          return;
        }
      }

      // Check if phone number already exists in Firestore
      if (cleanPhone) {
        const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          alert('Failed to authorize staff: A user with this phone number already exists in the system.');
          setIsCreatingStaff(false);
          return;
        }
      }

      if (isEmailRole) {
        // Use a unique name for the secondary app to prevent admin logout and app conflicts
        const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp_SuperAdmin_Staff_' + Date.now());
        const secondaryAuth = getSecondaryAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, newStaff.password);
        const newUserId = userCredential.user.uid;

        const docData = {
          uid: newUserId,
          name: newStaff.name.trim(),
          phone: cleanPhone,
          email: emailToUse,
          role: newStaff.role,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        if (newStaff.role === 'staff') {
          docData.branchId = newStaff.branchId;
          docData.branchName = branch?.name || 'Unknown';
          docData.salary = parseFloat(newStaff.salary);
          docData.shiftType = newStaff.shiftType || 'single';
          docData.loginTime = newStaff.loginTime;
          docData.logoutTime = newStaff.logoutTime;
          if (newStaff.shiftType === 'multi') {
            docData.loginTime2 = newStaff.loginTime2;
            docData.logoutTime2 = newStaff.logoutTime2;
          }
        }

        await setDoc(doc(db, 'users', newUserId), docData);
        await secondaryAuth.signOut();
      } else {
        // Doctor or Receptionist: Phone-based (no password)
        const docData = {
          name: newStaff.name.trim(),
          phone: cleanPhone,
          role: newStaff.role,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        if (newStaff.role === 'receptionist') {
          docData.branchId = newStaff.branchId;
          docData.branchName = branch?.name || 'Unknown';
        } else if (newStaff.role === 'doctor') {
          docData.doctorType = newStaff.doctorType;
          if (newStaff.doctorType === 'employee') {
            docData.salary = parseFloat(newStaff.salary);
            docData.shiftType = newStaff.shiftType || 'single';
            docData.loginTime = newStaff.loginTime;
            docData.logoutTime = newStaff.logoutTime;
            if (newStaff.shiftType === 'multi') {
              docData.loginTime2 = newStaff.loginTime2;
              docData.logoutTime2 = newStaff.logoutTime2;
            }
          }
        }

        await addDoc(collection(db, 'users'), docData);
      }

      setShowAddStaff(false);
      setNewStaff({
        name: '',
        phone: '',
        email: '',
        password: '',
        role: 'staff',
        doctorType: 'employee',
        branchId: '',
        salary: '',
        loginTime: '09:00 AM',
        logoutTime: '06:00 PM'
      });
      fetchStaff();
      alert('Staff member authorized successfully!');
    } catch (error) {
      console.error('Error authorizing staff:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Failed to authorize staff: This email address is already registered in Firebase Authentication. Since this staff member was previously deleted from the portal, their login account must be deleted from the Firebase Console (Authentication tab) before you can re-register them with this email.');
      } else {
        alert('Failed to authorize staff: ' + error.message);
      }
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (window.confirm('Are you sure you want to remove this staff member? They will no longer be able to log in.')) {
      try {
        await deleteDoc(doc(db, 'users', staffId));
        fetchStaff();
        alert('Staff member removed from database successfully.\n\nNote: To re-add this staff member with the same email, you must also delete their account from the Firebase Authentication console.');
      } catch (error) {
        console.error('Error removing staff:', error);
        alert('Failed to remove staff.');
      }
    }
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff || !staffEditData) return;
    setIsUpdatingStaff(true);
    try {
      const updatePayload = {
        name: staffEditData.name,
        phone: staffEditData.phone,
        role: staffEditData.role,
      };

      if (['staff', 'hr'].includes(staffEditData.role)) {
        updatePayload.email = staffEditData.email;
      }

      if (['staff', 'receptionist'].includes(staffEditData.role)) {
        updatePayload.branchId = staffEditData.branchId;
        updatePayload.branchName = branches.find(b => b.id === staffEditData.branchId)?.name || 'Unknown';
      }

      if (staffEditData.role === 'doctor') {
        updatePayload.doctorType = staffEditData.doctorType;
      }

      if (staffEditData.role === 'staff' || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) {
        updatePayload.salary = parseFloat(staffEditData.salary) || 0;
        updatePayload.shiftType = staffEditData.shiftType || 'single';
        updatePayload.loginTime = staffEditData.loginTime || '';
        updatePayload.logoutTime = staffEditData.logoutTime || '';
        if (staffEditData.shiftType === 'multi') {
          updatePayload.loginTime2 = staffEditData.loginTime2 || '';
          updatePayload.logoutTime2 = staffEditData.logoutTime2 || '';
        } else {
          updatePayload.loginTime2 = deleteField();
          updatePayload.logoutTime2 = deleteField();
        }
      }

      await updateDoc(doc(db, 'users', selectedStaff.id), updatePayload);
      await fetchStaff();
      alert('Staff details updated successfully.');
      setSelectedStaff(null);
      setStaffEditData(null);
    } catch (error) {
      console.error('Error updating staff:', error);
      alert('Failed to update staff details.');
    } finally {
      setIsUpdatingStaff(false);
    }
  };

  const openStaffModal = (staff) => {
    setSelectedStaff(staff);
    setStaffEditData({
      ...staff,
      doctorType: staff.doctorType || 'employee',
      salary: staff.salary || '',
      loginTime: staff.loginTime || '09:00 AM',
      logoutTime: staff.logoutTime || '06:00 PM',
      branchId: staff.branchId || '',
    });
  };

  const closeStaffModal = () => {
    setSelectedStaff(null);
    setStaffEditData(null);
  };

  const filteredRevenuePatients = allRevenueRecords.filter(patient => {
    // 1. Search term match (Name or Phone)

    // 1. Search term match (Name or Phone)
    const matchesSearch = !revenueSearch.trim() ||
      (patient.fullName && patient.fullName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
      (patient.phone && patient.phone.includes(revenueSearch.trim()));

    // 2. Branch match
    const matchesBranch = isBranchMatchHelper(patient.branchId, patient.branchName, revenueBranchId, branches);

    // 3. Date / Month match
    let matchesDateRange = true;
    let rawDateStr = patient.paymentCollectedAt || patient.appointmentDate || patient.completedAt || patient.createdAt || patient.date;

    if (rawDateStr) {
      let d = parseAnyDateObj(rawDateStr);

      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) {
            d.setHours(0, 0, 0, 0);
            filterDate.setHours(0, 0, 0, 0);
            if (d.getTime() !== filterDate.getTime()) matchesDateRange = false;
          }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) {
            matchesDateRange = false;
          } else if (revenueMonth !== 'all') {
            if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) {
              matchesDateRange = false;
            }
          }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDateRange = false;
      }
    } else {
      if (revenueDate || revenueYear !== 'all') matchesDateRange = false;
    }

    const matchesSource = revenueSource === 'all' || (patient.source || 'Walk-in') === revenueSource;
    const matchesMethod = revenueMethod === 'all' || patient.paymentMethod === revenueMethod;

    const docName = patient.doctor || patient.doctorName || patient.assignDoctor || 'N/A';
    const matchesDoctor = revenueDoctor === 'all' || docName === revenueDoctor;

    let matchesSplit = true;
    if (revenueSplitType !== 'all') {
      const hasCons = patient.itemsPaid?.consultation > 0 || (!patient.itemsPaid?.consultation && !patient.itemsPaid?.medicine && !patient.itemsPaid?.dietPlan);
      const hasMed = patient.itemsPaid?.medicine > 0;
      const hasDiet = patient.itemsPaid?.dietPlan > 0;
      let rowType = 'Consultation';
      if (hasCons && hasMed && hasDiet) rowType = 'Consultation & Medicine Fee / Diet Plan';
      else if (hasCons && hasMed) rowType = 'Consultation & Medicine Fee';
      else if (hasCons && hasDiet) rowType = 'Consultation / Diet Plan';
      else if (!hasCons && hasMed && hasDiet) rowType = 'Medicine Fee / Diet Plan';
      else if (!hasCons && hasDiet) rowType = 'Diet Plan';
      else if (!hasCons && hasMed) rowType = 'Medicine Fee';

      matchesSplit = rowType === revenueSplitType;
    }

    let matchesAmount = true;
    if (revenueAmountRange !== 'all') {
      const consAmt = Number(patient.itemsPaid?.consultation !== undefined ? patient.itemsPaid.consultation : (patient.paymentAmount || 0));
      const medAmt = Number(patient.itemsPaid?.medicine || 0);
      const dietAmt = Number(patient.itemsPaid?.dietPlan || 0);
      matchesAmount = checkAmountRange(consAmt, revenueAmountRange) || checkAmountRange(medAmt, revenueAmountRange) || checkAmountRange(dietAmt, revenueAmountRange);
    }

    return matchesSearch && matchesBranch && matchesDateRange && matchesSource && matchesMethod && matchesDoctor && matchesSplit && matchesAmount;
  });

  // Helper: sum all components of a split payment from paymentSplitDetails
  const getSplitTotal = (p) => {
    const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
    if (sd) {
      const total = Object.values(sd).reduce((s, v) => s + Number(v || 0), 0);
      if (total > 0) return total;
    }
    // Fallback: splitCounterAmount + splitUpiAmount (from handleSendFeeToPatient flow)
    if (p.splitCounterAmount !== undefined || p.splitUpiAmount !== undefined) {
      const total = Number(p.splitCounterAmount || 0) + Number(p.splitUpiAmount || 0);
      if (total > 0) return total;
    }
    return 0;
  };

  const getExactPatientAmount = (p) => {
    // For split payments, always use the sum of all split components
    const isSplit = p.paymentMethod === 'split' || p.paymentMethod === 'app_split';
    if (isSplit) {
      const splitTotal = getSplitTotal(p);
      if (splitTotal > 0) return splitTotal;
    }
    if (p.paymentAmount !== undefined && p.paymentAmount !== null && p.paymentAmount !== '' && Number(p.paymentAmount) > 0) {
      return Number(p.paymentAmount);
    }
    if (p.amountPaid !== undefined && p.amountPaid !== null && p.amountPaid !== '' && Number(p.amountPaid) > 0) {
      return Number(p.amountPaid);
    }
    if (p.itemsPaid?.consultation !== undefined) {
      return Number(p.itemsPaid.consultation);
    }
    return 0;
  };

  // Calculate dynamic stats across paid patients inside the filtered list
  const paidPatients = filteredRevenuePatients.filter(p => p.paymentStatus === 'paid');
  const totalCollectedFees = paidPatients.reduce((sum, p) => {
    // For split payments, consAmt is the TOTAL of all split components
    const isSplit = p.paymentMethod === 'split' || p.paymentMethod === 'app_split';
    let consAmt;
    if (isSplit) {
      // Total = all split components (cash + upi + card etc.)
      const splitTotal = getSplitTotal(p);
      consAmt = splitTotal > 0 ? splitTotal : getExactPatientAmount(p);
    } else {
      consAmt = p.itemsPaid?.consultation !== undefined && Number(p.itemsPaid.consultation) > 0
        ? Number(p.itemsPaid.consultation)
        : getExactPatientAmount(p);
    }
    return sum + (checkAmountRange(consAmt, revenueAmountRange) ? consAmt : 0);
  }, 0);

  const medicineFeeCollected = paidPatients.reduce((sum, p) => {
    // For split payments, medicine fee is already included in the split total (avoid double counting)
    if (p.paymentMethod === 'split' || p.paymentMethod === 'app_split') return sum;
    const medAmt = Number(p.itemsPaid?.medicine || 0);
    return sum + (checkAmountRange(medAmt, revenueAmountRange) ? medAmt : 0);
  }, 0);

  const getPatientTotalPaid = (p) => {
    // For split payments, total is always the sum of all split components
    const isSplit = p.paymentMethod === 'split' || p.paymentMethod === 'app_split';
    if (isSplit) {
      const splitTotal = getSplitTotal(p);
      if (splitTotal > 0) return checkAmountRange(splitTotal, revenueAmountRange) ? splitTotal : 0;
    }
    let total = 0;
    if (p.itemsPaid) {
      const consAmt = Number(p.itemsPaid.consultation || 0);
      if (checkAmountRange(consAmt, revenueAmountRange)) total += consAmt;
      const medAmt = Number(p.itemsPaid.medicine || 0);
      if (checkAmountRange(medAmt, revenueAmountRange)) total += medAmt;
      const dietAmt = Number(p.itemsPaid.dietPlan || 0);
      if (checkAmountRange(dietAmt, revenueAmountRange)) total += dietAmt;
    } else {
      const pAmt = getExactPatientAmount(p);
      if (checkAmountRange(pAmt, revenueAmountRange)) total += pAmt;
    }
    return total;
  };



  // O(1) patient lookups to optimize SuperAdminDashboard performance
  // Pre-builds indexed maps by ID, Registration ID/No, Clean 10-digit Phone, and Lowercase Name.
  // Reduces O(N * M) linear scans during transaction and revenue calculations down to O(1).
  const patientIndex = useMemo(() => {
    const byId = new Map();
    const byRegId = new Map();
    const byRegNo = new Map();
    const byCleanPhone = new Map();
    const byNameLower = new Map();

    (patients || []).forEach(pt => {
      if (pt.id) byId.set(String(pt.id), pt);

      const ptRegId = pt.registrationId || pt.regId || pt.regID;
      if (ptRegId) {
        byRegId.set(String(ptRegId), pt);
        byRegId.set(String(ptRegId).toLowerCase(), pt);
      }

      const ptRegNo = pt.registrationNo || pt.regNo || pt.patientId || pt.id;
      if (ptRegNo) byRegNo.set(String(ptRegNo), pt);

      const ptPhone = String(pt.phone || pt.patientPhone || pt.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (ptPhone && ptPhone.length === 10) byCleanPhone.set(ptPhone, pt);

      const ptName = pt.fullName || pt.patientName || pt.name;
      if (ptName) byNameLower.set(String(ptName).toLowerCase(), pt);
    });

    return { byId, byRegId, byRegNo, byCleanPhone, byNameLower };
  }, [patients]);

  // Pharmacy Revenue Calculations
  const filteredPharmacyTransactions = medicineTransactions.filter(tr => {
    if (tr.type === 'consultation') return false;
    const matchesSearch = !revenueSearch.trim() ||
      (tr.patientName && tr.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
      (tr.patientPhone && tr.patientPhone.includes(revenueSearch.trim()));

    const matchesBranch = isBranchMatchHelper(tr.branchId, tr.branchName, revenueBranchId, branches);

    let matchesDate = true;
    if (tr.timestamp) {
      let d = parseAnyDateObj(tr.timestamp);

      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) {
            d.setHours(0, 0, 0, 0);
            filterDate.setHours(0, 0, 0, 0);
            if (d.getTime() !== filterDate.getTime()) matchesDate = false;
          }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) {
            matchesDate = false;
          } else if (revenueMonth !== 'all') {
            if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) {
              matchesDate = false;
            }
          }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDate = false;
      }
    } else {
      if (revenueDate || revenueYear !== 'all') matchesDate = false;
    }

    const matchesSource = revenueSource === 'all' || (tr.source || 'Walk-in') === revenueSource;
    const matchesMethod = revenueMethod === 'all' || tr.method === revenueMethod;

    const patientDoc = tr.patientId ? patientIndex.byId.get(String(tr.patientId)) : null;
    const docName = tr.doctor || tr.doctorName || tr.prescribedBy || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || 'N/A';
    const matchesDoctor = revenueDoctor === 'all' || docName === revenueDoctor;

    let matchesSplit = true;
    if (revenueSplitType !== 'all') {
      let computedType = 'Consultation & Medicine Fee';
      if (tr.type === 'nutrition') {
        computedType = 'Diet Plan';
      } else if (tr.itemsPaid) {
        const hasCons = Number(tr.itemsPaid.consultation || 0) > 0;
        const hasMed = Number(tr.itemsPaid.medicine || 0) > 0;
        const hasDiet = Number(tr.itemsPaid.dietPlan || 0) > 0;

        if (hasCons && hasMed && hasDiet) computedType = 'Consultation & Medicine Fee / Diet Plan';
        else if (hasCons && hasMed) computedType = 'Consultation & Medicine Fee';
        else if (hasCons && hasDiet) computedType = 'Consultation / Diet Plan';
        else if (!hasCons && hasMed && hasDiet) computedType = 'Medicine Fee / Diet Plan';
        else if (!hasCons && hasDiet) computedType = 'Diet Plan';
        else if (!hasCons && hasMed) computedType = 'Medicine Fee';
      }
      matchesSplit = computedType === revenueSplitType;
    }

    let matchesAmount = true;
    if (revenueAmountRange !== 'all') {
      matchesAmount = checkAmountRange(Number(tr.amount) || 0, revenueAmountRange);
    }

    return matchesSearch && matchesBranch && matchesDate && matchesSource && matchesMethod && matchesDoctor && matchesSplit && matchesAmount;
  });

  const pharmacyTotal = filteredPharmacyTransactions.reduce((sum, t) => {
    let amt = Number(t.amount) || 0;
    if (t.type !== 'nutrition' && t.itemsPaid) {
      const cons = Number(t.itemsPaid.consultation || 0);
      const med = Number(t.itemsPaid.medicine || 0);
      const diet = Number(t.itemsPaid.dietPlan || 0);
      let other = 0;
      if (Array.isArray(t.itemsPaid.otherFees)) {
        other = t.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
      }
      const tot = cons + med + diet + other;
      if (tot > 0) amt = tot;
    }
    return sum + amt;
  }, 0);
  const pharmacyCash = filteredPharmacyTransactions.filter(t => t.method === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const pharmacyUpi = filteredPharmacyTransactions.filter(t => ['upi', 'phonepe', 'gpay'].includes(t.method)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const pharmacyCard = filteredPharmacyTransactions.filter(t => t.method === 'card').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Filter medicine forms based on active dashboard selections
  const filteredMedicineForms = medicineForms.filter(form => {
    const matchesSearch = !revenueSearch.trim() ||
      (form.patientName && form.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
      (form.phone && form.phone.includes(revenueSearch.trim()));

    const matchesBranch = isBranchMatchHelper(form.branchId, form.branchName, revenueBranchId, branches);

    let matchesDate = true;
    let rawDateStr = form.createdAt || form.formDate;

    if (rawDateStr) {
      let d = parseAnyDateObj(rawDateStr);

      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) {
            d.setHours(0, 0, 0, 0);
            filterDate.setHours(0, 0, 0, 0);
            if (d.getTime() !== filterDate.getTime()) matchesDate = false;
          }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) {
            matchesDate = false;
          } else if (revenueMonth !== 'all') {
            if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) {
              matchesDate = false;
            }
          }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDate = false;
      }
    } else {
      if (revenueDate || revenueYear !== 'all') matchesDate = false;
    }

    const patientDoc = form.patientId ? patientIndex.byId.get(String(form.patientId)) : null;
    const docName = form.doctor || form.doctorName || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || 'N/A';
    const matchesDoctor = revenueDoctor === 'all' || docName === revenueDoctor;

    let matchesSplit = true;
    if (revenueSplitType !== 'all') {
      matchesSplit = 'Consultation & Medicine Fee' === revenueSplitType;
    }

    let matchesAmount = true;
    if (revenueAmountRange !== 'all') {
      matchesAmount = checkAmountRange(Number(form.amountPaid) || 0, revenueAmountRange);
    }

    return matchesSearch && matchesBranch && matchesDate && matchesDoctor && matchesSplit && matchesAmount;
  });

  // Filter nutrition plans based on active dashboard selections
  const filteredNutritionPlansForRevenue = nutritionPlans.filter(plan => {
    if (plan.paymentStatus !== 'paid') return false;

    const matchesSearch = !revenueSearch.trim() ||
      (plan.patientName && plan.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
      (plan.patientPhone && plan.patientPhone.includes(revenueSearch.trim()));

    const matchesBranch = isBranchMatchHelper(plan.branchId, plan.branchName, revenueBranchId, branches);

    let matchesDate = true;
    let rawDateStr = plan.paymentCollectedAt || plan.createdAt;

    if (rawDateStr) {
      let d = parseAnyDateObj(rawDateStr);
      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) {
            d.setHours(0, 0, 0, 0);
            filterDate.setHours(0, 0, 0, 0);
            if (d.getTime() !== filterDate.getTime()) matchesDate = false;
          }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) {
            matchesDate = false;
          } else if (revenueMonth !== 'all') {
            if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) {
              matchesDate = false;
            }
          }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDate = false;
      }
    } else {
      if (revenueDate || revenueYear !== 'all') matchesDate = false;
    }

    const patientDoc = plan.patientId ? patientIndex.byId.get(String(plan.patientId)) : null;
    const docName = plan.doctorName || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || 'N/A';
    const matchesDoctor = revenueDoctor === 'all' || docName === revenueDoctor;

    let matchesSplit = true;
    if (revenueSplitType !== 'all') {
      matchesSplit = revenueSplitType === 'Diet Plan';
    }

    const amt = Number(plan.amountPaid || plan.amount) || 0;
    let matchesAmount = true;
    if (revenueAmountRange !== 'all') {
      matchesAmount = checkAmountRange(amt, revenueAmountRange);
    }

    const matchesSource = revenueSource === 'all' || (plan.source || 'Walk-in') === revenueSource;
    const matchesMethod = revenueMethod === 'all' || (plan.paymentMethod || 'N/A') === revenueMethod;

    return matchesSearch && matchesBranch && matchesDate && matchesDoctor && matchesSplit && matchesAmount && matchesSource && matchesMethod;
  });

  const medFormsTotalRevenue = filteredMedicineForms.reduce((sum, f) => sum + (Number(f.amountPaid) || 0), 0);
  const medFormsTotalMonths = filteredMedicineForms.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
  const avgRevPerMonthOverall = medFormsTotalMonths > 0 ? (medFormsTotalRevenue / medFormsTotalMonths) : 0;

  // Branch-wise Average Revenue Per Month
  const branchWiseAvgRevenue = branches.map(b => {
    const formsForBranch = filteredMedicineForms.filter(f => f.branchId === b.id || f.branchName === b.name);
    const revenue = formsForBranch.reduce((sum, f) => sum + (Number(f.amountPaid) || 0), 0);
    const months = formsForBranch.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
    const avg = months > 0 ? (revenue / months) : 0;
    return {
      branchId: b.id,
      branchName: b.name,
      revenue,
      months,
      avg
    };
  }).filter(b => b.revenue > 0);

  // Doctor-wise Average Revenue Per Month
  const doctorWiseAvgRevenue = (() => {
    const docStats = {};
    filteredMedicineForms.forEach(f => {
      const docName = f.doctorName || 'Unknown Doctor';
      if (!docStats[docName]) {
        docStats[docName] = { revenue: 0, months: 0 };
      }
      docStats[docName].revenue += (Number(f.amountPaid) || 0);
      docStats[docName].months += (Number(f.duration) || 0);
    });

    return Object.entries(docStats).map(([doctorName, stats]) => {
      const avg = stats.months > 0 ? (stats.revenue / stats.months) : 0;
      return {
        doctorName,
        revenue: stats.revenue,
        months: stats.months,
        avg
      };
    }).sort((a, b) => b.revenue - a.revenue);
  })();

  const displayPharmacyTransactions = Object.values(
    filteredPharmacyTransactions.reduce((acc, tr) => {
      let dateStr = 'unknown';
      let fullDateTime = 'N/A';
      if (tr.timestamp) {
        if (tr.timestamp.toDate) {
          fullDateTime = tr.timestamp.toDate().toLocaleString();
          dateStr = tr.timestamp.toDate().toLocaleDateString();
        } else {
          fullDateTime = safeDateDisplay(tr.timestamp) || 'N/A';
          dateStr = fullDateTime !== 'N/A' ? fullDateTime.split(',')[0] : 'unknown';
        }
      }
      const key = `${tr.patientName}_${dateStr}`;

      if (!acc[key]) {
        acc[key] = {
          ...tr,
          displayAmount: (() => {
            let amt = Number(tr.amount) || 0;
            if (tr.type !== 'nutrition' && tr.itemsPaid) {
              const cons = Number(tr.itemsPaid.consultation || 0);
              const med = Number(tr.itemsPaid.medicine || 0);
              const diet = Number(tr.itemsPaid.dietPlan || 0);
              let other = 0;
              if (Array.isArray(tr.itemsPaid.otherFees)) {
                other = tr.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
              }
              const tot = cons + med + diet + other;
              if (tot > 0) amt = tot;
            }
            return amt;
          })(),
          methods: new Set([(tr.method || 'N/A').toUpperCase()]),
          fullDateTime
        };
      } else {
        const addedAmt = (() => {
          let amt = Number(tr.amount) || 0;
          if (tr.type !== 'nutrition' && tr.itemsPaid) {
            const cons = Number(tr.itemsPaid.consultation || 0);
            const med = Number(tr.itemsPaid.medicine || 0);
            const diet = Number(tr.itemsPaid.dietPlan || 0);
            let other = 0;
            if (Array.isArray(tr.itemsPaid.otherFees)) {
              other = tr.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
            }
            const tot = cons + med + diet + other;
            if (tot > 0) amt = tot;
          }
          return amt;
        })();
        acc[key].displayAmount += addedAmt;
        acc[key].methods.add((tr.method || 'N/A').toUpperCase());
      }
      return acc;
    }, {})
  ).map(item => ({
    ...item,
    methodDisplay: Array.from(item.methods).join(' + ')
  }));

  const handlePharmacyExportToExcel = () => {
    if (displayPharmacyTransactions.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["S.N.O", "Patient Name", "Branch", "Amount", "Method", "Date / Time", "Status"];

    const rows = displayPharmacyTransactions.map((tr, index) => {
      const sno = index + 1;
      const name = tr.patientName || "N/A";
      const branch = tr.branchName || "Main Branch";
      const amount = tr.displayAmount || 0;
      const method = tr.methodDisplay || "N/A";
      const dateTime = tr.fullDateTime;
      const status = "PAID";

      return [
        sno,
        `"${name.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        amount,
        `"${method.replace(/"/g, '""')}"`,
        `"${dateTime.replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateSuffix = pharmacyDate ? pharmacyDate : (pharmacyYear !== 'all' ? `${pharmacyYear}_${pharmacyMonth}` : 'all_time');
    link.setAttribute("download", `pharmacy_revenue_${dateSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isPackageActive = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= startDateStr && today <= endDateStr;
  };

  const getMemberBranchName = (member) => {
    if (member.branchName) return member.branchName;
    const patientObj = (member.patientId ? patientIndex.byId.get(String(member.patientId)) : null) ||
      (member.patientMobile ? patientIndex.byCleanPhone.get(String(member.patientMobile).replace(/\D/g, '').slice(-10)) : null);
    return patientObj?.branchName || 'Unknown';
  };
  const handlePackageExportToCSV = () => {
    const displayMembers = packageMembers.filter(member => {
      const matchesSearch = !packagesSearch.trim() ||
        (member.patientName && member.patientName.toLowerCase().includes(packagesSearch.toLowerCase())) ||
        (member.patientMobile && member.patientMobile.includes(packagesSearch.trim()));

      const branchObj = branches.find(b => b.id === packagesBranchId);
      const memberBranchName = getMemberBranchName(member);
      const matchesBranch = packagesBranchId === 'all' ||
        member.branchId === packagesBranchId ||
        (memberBranchName && branchObj && memberBranchName === branchObj.name);

      const isActive = isPackageActive(member.startDate, member.endDate);
      const matchesStatus = packagesStatus === 'all' ||
        (packagesStatus === 'active' && isActive) ||
        (packagesStatus === 'expired' && !isActive);

      return matchesSearch && matchesBranch && matchesStatus;
    });

    if (displayMembers.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ["S.N.O", "Patient Name", "Mobile", "Start Date", "End Date", "Total Cost", "Paid Amount", "Balance Amount", "Registered Branch", "Status"];

    const rows = displayMembers.map((member, index) => {
      const sno = index + 1;
      const name = member.patientName || "N/A";
      const mobile = member.patientMobile || "N/A";
      const startDate = member.startDate || "N/A";
      const endDate = member.endDate || "N/A";
      const total = member.totalAmount || 0;
      const paid = member.paidAmount || 0;
      const balance = member.balanceAmount !== undefined ? member.balanceAmount : (total - paid);
      const branch = getMemberBranchName(member);
      const status = isPackageActive(member.startDate, member.endDate) ? "ACTIVE" : "EXPIRED";

      return [
        sno,
        `"${name.replace(/"/g, '""')}"`,
        `"${mobile.replace(/"/g, '""')}"`,
        `"${startDate}"`,
        `"${endDate}"`,
        total,
        paid,
        balance,
        `"${branch.replace(/"/g, '""')}"`,
        `"${status}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `package_members_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  const handleExportCurrentPage = () => {
    if (currentPatients.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["S.N.O", "Reg ID", "Patient Name", "Phone", "Branch", "Subject", "Doctor", "Date", "Source"];
    const rows = currentPatients.map((patient, index) => {
      const sno = indexOfFirstPatient + index + 1;
      const regId = patient.registrationId || patient.regId || patient.regID || (patient.id && patient.id.startsWith('WK') ? patient.id : null) || "N/A";
      const name = patient.fullName || patient.patientName || "N/A";
      const phone = patient.phone || patient.patientPhone || patient.phoneNumber || patient.contact || "N/A";
      const branch = patient.branchName || "Unknown";
      const subject = patient.subject || "N/A";
      const doctor = patient.doctor || "N/A";
      const dateTime = patient.appointmentDate
        ? getSafeDisplayDate(patient.appointmentDate)
        : (patient.createdAt
          ? (patient.createdAt.toDate ? patient.createdAt.toDate().toLocaleDateString('en-IN') : new Date(patient.createdAt).toLocaleDateString('en-IN'))
          : 'N/A');
      const sourceCol = patient.sourceCollection === 'patients' ? "App/Registered" : "Walk-in/Booking";

      return [
        sno,
        `"${regId.replace(/"/g, '""')}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${phone.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        `"${subject.replace(/"/g, '""')}"`,
        `"${doctor.replace(/"/g, '""')}"`,
        `"${dateTime.replace(/"/g, '""')}"`,
        `"${sourceCol.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `global_patients_page_${safePatientsCurrentPage}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Global Patient List Calculations
  const filteredGlobalPatients = patients.filter(patient => {
    const matchesBranch = selectedBranchId === 'all' || patient.branchId === selectedBranchId;
    const query = patientsSearch.toLowerCase().trim();
    return matchesBranch && (!query ||
      (patient.fullName && patient.fullName.toLowerCase().includes(query)) ||
      (patient.phone && patient.phone.includes(query)) ||
      (patient.registrationId && patient.registrationId.toLowerCase().includes(query)) ||
      (patient.doctor && patient.doctor.toLowerCase().includes(query)) ||
      (patient.subject && patient.subject.toLowerCase().includes(query))
    );
  });

  const sortedGlobalPatients = [...filteredGlobalPatients].sort((a, b) => {
    const dateA = a.sourceCollection === 'patients' ? (a.createdAt || a.appointmentDate) : (a.appointmentDate || a.createdAt);
    const dateB = b.sourceCollection === 'patients' ? (b.createdAt || b.appointmentDate) : (b.appointmentDate || b.createdAt);
    const timeA = getSortableTimestamp(dateA);
    const timeB = getSortableTimestamp(dateB);
    return timeB - timeA;
  });

  const totalPatientPages = Math.ceil(sortedGlobalPatients.length / patientsPerPage) || 1;
  const safePatientsCurrentPage = Math.min(patientsCurrentPage, totalPatientPages);
  const indexOfLastPatient = safePatientsCurrentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = sortedGlobalPatients.slice(indexOfFirstPatient, indexOfLastPatient);

  useEffect(() => {
    if (patientsCurrentPage > totalPatientPages) {
      setPatientsCurrentPage(totalPatientPages);
    }
  }, [patientsSearch, selectedBranchId, totalPatientPages, patientsCurrentPage]);

  const cashCollected = paidPatients.reduce((sum, p) => {
    let amt = 0;
    if (p.paymentMethod === 'cash') {
      amt = getExactPatientAmount(p);
    } else if (p.paymentMethod === 'split' || p.paymentMethod === 'app_split') {
      // Read CASH portion directly — no proportion needed
      const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
      if (sd?.cash) amt = Number(sd.cash || 0);
      else if (p.splitCounterAmount !== undefined) amt = Number(p.splitCounterAmount || 0);
    }
    return sum + amt;
  }, 0);

  const upiCollected = paidPatients.reduce((sum, p) => {
    let amt = 0;
    const method = p.paymentMethod?.toLowerCase();
    if (method === 'upi' || method === 'online' || method === 'app') {
      amt = getExactPatientAmount(p);
    } else if (method === 'split' || method === 'app_split') {
      // Read UPI portion directly
      const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
      if (sd?.upi) amt = Number(sd.upi || 0);
      else if (p.splitUpiAmount !== undefined) amt = Number(p.splitUpiAmount || 0);
    }
    return sum + amt;
  }, 0);

  const cardCollected = paidPatients.reduce((sum, p) => {
    let amt = 0;
    if (p.paymentMethod === 'card') {
      amt = getExactPatientAmount(p);
    } else if (p.paymentMethod === 'split' || p.paymentMethod === 'app_split') {
      // Read CARD portion directly
      const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
      if (sd?.card) amt = Number(sd.card || 0);
    }
    return sum + amt;
  }, 0);

  const sourceStats = {};
  paidPatients.forEach(p => {
    const s = p.source || 'Walk-in';
    sourceStats[s] = (sourceStats[s] || 0) + getPatientTotalPaid(p);
  });
  const top4Channels = Object.entries(sourceStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const handleExportToExcel = () => {
    if (filteredRevenuePatients.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["S.N.O", "Reg ID", "Patient Name", "Phone", "Branch", "Amount", "Method", "Date / Time", "Status"];
    const rows = filteredRevenuePatients.map((patient, index) => {
      const sno = index + 1;
      const regId = patient.registrationId || patient.regId || patient.regID || (patient.id && patient.id.startsWith('WK') ? patient.id : null) || "N/A";
      const name = patient.fullName || patient.patientName || "N/A";
      const phone = patient.phone || patient.patientPhone || patient.phoneNumber || patient.contactNumber || patient.contact || "N/A";
      const branch = patient.branchName || "Main Branch";
      let amount = 0;
      let method = "N/A";
      if (patient.paymentStatus === 'paid') {
        const m = (patient.paymentMethod || '').toLowerCase();
        if (m === 'split' || m === 'app_split') {
          if (patient.paymentSplitDetails) {
            // Sum ALL split components (handles cash+card, cash+upi, cash+card+upi, etc.)
            const sd = patient.paymentSplitDetails;
            amount = Object.values(sd).reduce((s, v) => s + Number(v || 0), 0);
            const keys = Object.keys(sd).filter(k => Number(sd[k]) > 0).map(k => k.toUpperCase());
            method = keys.length >= 2 ? keys.join('/') : 'SPLIT';
          } else if (patient.itemsPaid) {
            method = 'SPLIT';
            const cons = Number(patient.itemsPaid.consultation || 0);
            const med = Number(patient.itemsPaid.medicine || 0);
            const diet = Number(patient.itemsPaid.dietPlan || 0);
            let other = 0;
            if (Array.isArray(patient.itemsPaid.otherFees)) {
              other = patient.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
            }
            amount = cons + med + diet + other;
          }
          if (!amount) amount = getPatientTotalPaid(patient);
        } else {
          amount = getPatientTotalPaid(patient);
          method = m.toUpperCase();
        }
      }
      const dateTime = patient.paymentCollectedAt ? new Date(patient.paymentCollectedAt).toLocaleString() : (patient.appointmentDate ? formatDateToDisplay(patient.appointmentDate) : "N/A");
      const status = patient.paymentStatus === 'paid' ? "PAID" : "NOT PAID";
      return [
        sno,
        `"${regId.replace(/"/g, '""')}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${phone.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        amount,
        `"${method.replace(/"/g, '""')}"`,
        `"${dateTime.replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`
      ];
    });
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateSuffix = revenueDate ? revenueDate : (revenueYear !== 'all' ? `${revenueYear}_${revenueMonth}` : 'all_time');
    link.setAttribute("download", `consultation_revenue_${dateSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allHistoryTransactions = useMemo(() => {
    const list = [];

    const parseD = (raw) => {
      if (!raw) return null;
      if (raw.toDate) return raw.toDate();
      if (raw.seconds) return new Date(raw.seconds * 1000);
      return new Date(raw);
    };

    const safeParseObj = (obj) => {
      if (!obj) return null;
      let parsed = obj;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (e) { return null; }
      }
      return typeof parsed === 'object' ? parsed : null;
    };

    const paidItemsMap = new Map();
    const processedStandaloneDietPlans = new Set();
    const splitDetailsMap = new Map();
    const processedKeys = new Set();

    // Pre-scan alltransactions for paymentSplitDetails to fix missing details in patient docs
    medicineTransactions.forEach(tr => {
      const regId = tr.registrationId || tr.regId || tr.regID || '-';
      const phone = tr.patientPhone || tr.phone || tr.phoneNumber || '-';
      const details = safeParseObj(tr.paymentSplitDetails);
      if (details) {
        if (regId !== '-') splitDetailsMap.set(String(regId), details);
        if (phone !== '-') splitDetailsMap.set(String(phone), details);
      }
    });

    const trackPaidItem = (key, itemsPaid) => {
      if (!key) return;
      if (!paidItemsMap.has(key)) paidItemsMap.set(key, { cons: false, med: false, diet: false, pkg: false });
      const entry = paidItemsMap.get(key);
      if (itemsPaid) {
        if (Number(itemsPaid.consultation || 0) > 0) entry.cons = true;
        if (Number(itemsPaid.medicine || 0) > 0) entry.med = true;
        if (Number(itemsPaid.dietPlan || 0) > 0) entry.diet = true;
        if (Number(itemsPaid.package || 0) > 0) entry.pkg = true;
      } else {
        entry.cons = true;
      }
    };

    const resolveStrictPatientDetails = (item) => {
      const regId = item.registrationId || item.regId || item.regID || item.patientRegId || '';
      const regNo = item.registrationNo || item.regNo || item.patientId || item.id || '';
      const name = item.fullName || item.patientName || item.name || '';
      const rawPhone = item.phone || item.patientPhone || item.phoneNumber || item.contactNumber || item.contact || '';
      const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);

      let match = null;
      if (regNo) match = patientIndex.byRegNo.get(String(regNo)) || patientIndex.byId.get(String(regNo));
      if (!match && regId) match = patientIndex.byRegId.get(String(regId)) || patientIndex.byRegId.get(String(regId).toLowerCase());
      if (!match && cleanPhone && cleanPhone.length === 10) match = patientIndex.byCleanPhone.get(cleanPhone);
      if (!match && name && name !== '-') match = patientIndex.byNameLower.get(String(name).toLowerCase());

      const finalRegId = (regId && regId !== '-') ? regId : (match?.registrationId || match?.regId || (regNo && regNo.startsWith('WK') ? regNo : null) || '-');
      const finalName = (name && name !== '-') ? name : (match?.fullName || match?.patientName || '-');
      const finalPhone = (rawPhone && rawPhone !== '-') ? rawPhone : (match?.phone || match?.patientPhone || match?.phoneNumber || '-');
      const finalDoctor = item.doctor || item.doctorName || item.assignDoctor || item.prescribedBy || match?.doctor || match?.doctorName || match?.assignDoctor || '-';
      const finalSource = item.source || match?.source || 'Walk-in';

      return { regId: finalRegId, patientName: finalName, phone: finalPhone, doctorName: finalDoctor, source: finalSource };
    };

    // Consultations
    filteredRevenuePatients.forEach(p => {
      let parsedItems = p.itemsPaid;
      if (typeof parsedItems === 'string') {
        try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = null; }
      }

      const hasMed = parsedItems?.medicine > 0;
      const hasDiet = parsedItems?.dietPlan > 0;
      const hasCons = parsedItems?.consultation > 0 || (!parsedItems?.consultation && !parsedItems?.medicine && !parsedItems?.dietPlan);

      const consAmt = (() => {
        if (p.paymentStatus !== 'paid' && p.status !== 'paid') return 0;

        // For split payments: always sum ALL components (CASH + CARD, CASH + UPI, etc.)
        const isSplit = p.paymentMethod === 'split' || p.paymentMethod === 'app_split';
        if (isSplit) {
          // 1. Sum from paymentSplitDetails (most reliable)
          const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
          if (sd) {
            const sdTotal = Object.values(sd).reduce((s, v) => s + Number(v || 0), 0);
            if (sdTotal > 0) return sdTotal;
          }
          // 2. splitCounterAmount + splitUpiAmount (from UPI split request flow)
          if (p.splitCounterAmount !== undefined || p.splitUpiAmount !== undefined) {
            const total = Number(p.splitCounterAmount || 0) + Number(p.splitUpiAmount || 0);
            if (total > 0) return total;
          }
          // 3. Fall through to paymentAmount which should be the total
        }

        // Skip zero values — fall through to next field
        if (p.amountPaid !== undefined && p.amountPaid !== null && p.amountPaid !== '' && Number(p.amountPaid) > 0) return Number(p.amountPaid);
        if (p.paymentAmount !== undefined && p.paymentAmount !== null && p.paymentAmount !== '' && Number(p.paymentAmount) > 0) return Number(p.paymentAmount);
        if (p.amountCollected !== undefined && p.amountCollected !== null && p.amountCollected !== '' && Number(p.amountCollected) > 0) return Number(p.amountCollected);
        let amount = Number(p.amount || p.totalAmount || p.consultationFee || 0);
        if (parsedItems) {
          const cons = Number(parsedItems.consultation || 0);
          const med = Number(parsedItems.medicine || 0);
          const diet = Number(parsedItems.dietPlan || 0);
          const pkg = Number(parsedItems.package || 0);
          let other = 0;
          if (Array.isArray(parsedItems.otherFees)) {
            other = parsedItems.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
          }
          const totalItems = cons + med + diet + pkg + other;
          if (totalItems > 0) amount = totalItems - Number(p.pendingAmount || 0);
        }
        return amount;
      })();

      let rowType = 'Consultation';
      if (hasCons && hasMed && hasDiet) rowType = 'Consultation & Medicine Fee / Diet Plan';
      else if (hasCons && hasMed) rowType = 'Consultation & Medicine Fee';
      else if (hasCons && hasDiet) rowType = 'Consultation / Diet Plan';
      else if (!hasCons && hasMed && hasDiet) rowType = 'Medicine Fee / Diet Plan';
      else if (!hasCons && hasDiet) rowType = 'Diet Plan';
      else if (!hasCons && hasMed) rowType = 'Medicine Fee';

      const d = parseD(p.paymentCollectedAt || p.appointmentDate || p.createdAt || p.date);
      const timestamp = d ? d.getTime() : 0;
      let dateStr = safeDateDisplay(p.paymentCollectedAt || p.appointmentDate || p.createdAt || p.date) || "N/A";

      const k1 = p.id ? String(p.id) : null;
      if (k1) trackPaidItem(k1, p.itemsPaid);
      const regId = p.registrationId || p.regId || p.regID;
      const k2 = regId ? String(regId) : null;
      const phone = p.phone || p.patientPhone || p.phoneNumber;
      let k3 = phone ? String(phone).replace(/\D/g, '').trim() : null;
      if (k3 && k3.length >= 10 && !isNaN(k3.slice(-10))) k3 = k3.slice(-10);
      if (k2) trackPaidItem(k2, p.itemsPaid);
      const phoneVal = p.phone || p.patientPhone || p.phoneNumber || p.contactNumber || p.contact;
      let k4 = phoneVal ? String(phoneVal).replace(/\D/g, '').trim() : null;
      if (k4 && k4.length >= 10 && !isNaN(k4.slice(-10))) k4 = k4.slice(-10);
      if (k4) trackPaidItem(k4, p.itemsPaid);

      const methodStr = (() => {
        const m = (p.paymentMethod || '-').toUpperCase();
        if (p.paymentId && typeof p.paymentId === 'string' && p.paymentId.includes('SPLIT')) {
          // Try to resolve exact split method from splitDetails
          const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
          if (sd) {
            const keys = Object.keys(sd).filter(k => Number(sd[k]) > 0).map(k => k.toUpperCase());
            if (keys.length >= 2) return keys.join('/');
          }
          return 'CASH/UPI';
        }
        if (m === 'SPLIT' || m === 'APP_SPLIT') {
          // Try to resolve exact split method from splitDetails
          const sd = (typeof p.paymentSplitDetails === 'object' && p.paymentSplitDetails) ? p.paymentSplitDetails : null;
          if (sd) {
            const keys = Object.keys(sd).filter(k => Number(sd[k]) > 0).map(k => k.toUpperCase());
            if (keys.length >= 2) return keys.join('/');
          }
          return 'CASH/UPI';
        }
        if (['ONLINE_RAZORPAY', 'ONLINE', 'APP', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI'].includes(m)) return 'UPI';
        return m;
      })();

      let pSplitDetails = safeParseObj(p.paymentSplitDetails) || (k2 ? splitDetailsMap.get(k2) : null) || (k3 ? splitDetailsMap.get(k3) : null);
      if (!pSplitDetails && (p.splitCounterAmount !== undefined || p.splitUpiAmount !== undefined)) {
        pSplitDetails = { cash: Number(p.splitCounterAmount || 0), upi: Number(p.splitUpiAmount || 0) };
      }

      const resolved = resolveStrictPatientDetails(p);

      list.push({
        id: `cons_${p.id}_${Math.random().toString(36).substring(7)}`,
        isPrimaryDoc: true,
        patientId: p.id || '-',
        type: rowType,
        regId: resolved.regId,
        patientName: resolved.patientName,
        phone: resolved.phone,
        branch: p.branchName || 'Main Branch',
        doctorName: resolved.doctorName,
        source: resolved.source,
        amount: consAmt,
        method: methodStr,
        dateTime: dateStr,
        timestamp,
        status: p.paymentStatus === 'paid' ? 'PAID' : 'NOT PAID',
        duration: 0,
        itemsPaid: safeParseObj(p.itemsPaid),
        paymentSplitDetails: pSplitDetails || null
      });

      if (d && !isNaN(d.getTime())) {
        const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const cleanPhone = (p.phone || p.patientPhone || p.phoneNumber || '').replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          processedKeys.add(`${cleanPhone}_${dateKey}`);
        }
      }
    });

    // Old Consultations (from medicineTransactions which now fetches ALL transactions)
    medicineTransactions.forEach(tr => {
      if (tr.type !== 'consultation') return;

      const parseD = (raw) => {
        if (!raw) return null;
        if (raw.toDate) return raw.toDate();
        if (raw.seconds) return new Date(raw.seconds * 1000);
        return new Date(raw);
      };

      const d = parseD(tr.timestamp);
      const k1 = tr.patientId ? String(tr.patientId) : null;
      const regId = tr.registrationId || tr.regId || tr.regID || '-';
      const k2 = (regId !== '-') ? String(regId) : null;
      const phone = tr.patientPhone || tr.phone || tr.phoneNumber || '-';
      const k3 = (phone !== '-') ? String(phone) : null;

      const p1 = k1 ? paidItemsMap.get(k1) : null;
      const p2 = k2 ? paidItemsMap.get(k2) : null;
      const p3 = k3 ? paidItemsMap.get(k3) : null;

      let parsedItems = tr.itemsPaid;
      if (typeof parsedItems === 'string') {
        try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = null; }
      }

      const hasCons = parsedItems?.consultation > 0 || !parsedItems || (tr.type && tr.type.includes('consultation'));
      const hasMed = parsedItems?.medicine > 0;
      const hasDiet = parsedItems?.dietPlan > 0;

      let shouldSkip = false;
      if (hasCons && ((p1 && p1.cons) || (p2 && p2.cons) || (p3 && p3.cons))) shouldSkip = true;
      if (hasMed && ((p1 && p1.med) || (p2 && p2.med) || (p3 && p3.med))) shouldSkip = true;
      if (hasDiet && ((p1 && p1.diet) || (p2 && p2.diet) || (p3 && p3.diet))) shouldSkip = true;

      if (shouldSkip) return; // Already caught in patients loop

      const matchesSearch = !revenueSearch.trim() ||
        (tr.patientName && tr.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
        (tr.phone && tr.phone.includes(revenueSearch.trim()));

      const matchesBranch = isBranchMatchHelper(tr.branchId, tr.branchName, revenueBranchId, branches);

      let matchesDate = true;
      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) { d.setHours(0, 0, 0, 0); filterDate.setHours(0, 0, 0, 0); if (d.getTime() !== filterDate.getTime()) matchesDate = false; }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) matchesDate = false;
          else if (revenueMonth !== 'all') { if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) matchesDate = false; }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDate = false;
      }

      if (!matchesSearch || !matchesBranch || !matchesDate) return;

      let fullDateTime = 'N/A';
      if (tr.timestamp) {
        if (tr.timestamp.toDate) fullDateTime = tr.timestamp.toDate().toLocaleString('en-IN');
        else fullDateTime = safeDateDisplay(tr.timestamp) || 'N/A';
      }

      const patientDoc = tr.patientId ? patientIndex.byId.get(String(tr.patientId)) : null;

      list.push({
        id: `old_cons_${tr.id || Math.random()}`,
        patientId: tr.patientId || patientDoc?.id || '-',
        type: 'Consultation',
        regId: regId !== '-' ? regId : (patientDoc?.registrationId || patientDoc?.regId || patientDoc?.regID || '-'),
        patientName: tr.patientName || tr.fullName || patientDoc?.fullName || '-',
        phone: tr.patientPhone || tr.phone || tr.phoneNumber || patientDoc?.phone || patientDoc?.patientPhone || patientDoc?.phoneNumber || '-',
        branch: tr.branchName || 'Main Branch',
        doctorName: tr.doctor || tr.doctorName || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || '-',
        source: tr.source || 'Walk-in',
        amount: (() => {
          let baseAmt = Number(tr.amount) || 0;
          if (tr.itemsPaid) {
            let parsed = tr.itemsPaid;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
            }
            if (parsed) {
              const c = Number(parsed.consultation || 0);
              const m = Number(parsed.medicine || 0);
              const d = Number(parsed.dietPlan || 0);
              let o = 0;
              if (Array.isArray(parsed.otherFees)) {
                o = parsed.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
              }
              const tot = c + m + d + o;
              if (tot > 0 && baseAmt === 0) baseAmt = tot;
            }
          }
          return baseAmt;
        })(),
        method: (() => {
          let m = (tr.method || 'N/A').toUpperCase();
          const isSplit = tr.paymentId && typeof tr.paymentId === 'string' && tr.paymentId.includes('SPLIT');
          if (isSplit || m === 'SPLIT' || m === 'APP_SPLIT') return 'CASH/UPI';
          if (['ONLINE_RAZORPAY', 'ONLINE', 'APP', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI'].includes(m)) return 'UPI';
          return m;
        })(),
        dateTime: fullDateTime,
        timestamp: tr.timestamp?.toMillis ? tr.timestamp.toMillis() : new Date(tr.timestamp).getTime() || 0,
        status: 'PAID',
        duration: 0,
        paymentId: tr.paymentId || null,
        itemsPaid: safeParseObj(tr.itemsPaid),
        paymentSplitDetails: (() => {
          let pSplitDetails = safeParseObj(tr.paymentSplitDetails) || safeParseObj(patientDoc?.paymentSplitDetails);
          if (!pSplitDetails && patientDoc && (patientDoc.splitCounterAmount !== undefined || patientDoc.splitUpiAmount !== undefined)) {
            pSplitDetails = { cash: Number(patientDoc.splitCounterAmount || 0), upi: Number(patientDoc.splitUpiAmount || 0) };
          }
          return pSplitDetails || null;
        })()
      });
    });

    // Pharmacy
    filteredPharmacyTransactions.forEach(tr => {
      const patientDoc = tr.patientId ? patientIndex.byId.get(String(tr.patientId)) : null;

      const parseD = (raw) => {
        if (!raw) return null;
        if (raw.toDate) return raw.toDate();
        if (raw.seconds) return new Date(raw.seconds * 1000);
        return new Date(raw);
      };

      const d = parseD(tr.timestamp);
      const k1 = tr.patientId ? String(tr.patientId) : null;
      const regId = tr.registrationId || tr.regId || tr.regID || patientDoc?.registrationId || patientDoc?.regId || patientDoc?.regID || '-';
      const k2 = (regId !== '-') ? String(regId) : null;
      const phone = tr.patientPhone || tr.phone || tr.phoneNumber || patientDoc?.phone || patientDoc?.patientPhone || patientDoc?.phoneNumber || '-';
      const k3 = (phone !== '-') ? String(phone) : null;

      // Skip if this transaction was already processed as a combined Consultation & Medicine in the patients loop
      if (tr.type === 'nutrition') {
        if ((k1 && paidItemsMap.get(k1)?.diet) || (k2 && paidItemsMap.get(k2)?.diet) || (k3 && paidItemsMap.get(k3)?.diet)) return;
        if (k1) processedStandaloneDietPlans.add(k1);
        if (k2) processedStandaloneDietPlans.add(k2);
        if (k3) processedStandaloneDietPlans.add(k3);
      } else {
        const p1 = k1 ? paidItemsMap.get(k1) : null;
        const p2 = k2 ? paidItemsMap.get(k2) : null;
        const p3 = k3 ? paidItemsMap.get(k3) : null;

        let parsedItems = tr.itemsPaid;
        if (typeof parsedItems === 'string') {
          try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = null; }
        }
        const hasCons = parsedItems?.consultation > 0 || (tr.type && tr.type.includes('consultation'));
        const hasMed = parsedItems?.medicine > 0 || (tr.type && tr.type.includes('medicine')) || tr.type === 'Pharmacy';
        const hasDiet = parsedItems?.dietPlan > 0 || (tr.type && (tr.type.includes('nutrition') || tr.type.includes('diet')));

        let shouldSkip = false;
        if (hasCons && ((p1 && p1.cons) || (p2 && p2.cons) || (p3 && p3.cons))) shouldSkip = true;
        if (hasMed && ((p1 && p1.med) || (p2 && p2.med) || (p3 && p3.med))) shouldSkip = true;
        if (hasDiet && ((p1 && p1.diet) || (p2 && p2.diet) || (p3 && p3.diet))) shouldSkip = true;

        if (shouldSkip) return;
      }

      const timestamp = tr.timestamp?.toMillis ? tr.timestamp.toMillis() : new Date(tr.timestamp).getTime() || 0;

      let fullDateTime = 'N/A';
      if (tr.timestamp) {
        if (tr.timestamp.toDate) {
          fullDateTime = tr.timestamp.toDate().toLocaleString('en-IN');
        } else {
          fullDateTime = safeDateDisplay(tr.timestamp) || 'N/A';
        }
      }

      list.push({
        id: `pharm_${tr.id || Math.random()}`,
        patientId: tr.patientId || patientDoc?.id || '-',
        type: tr.typeLabel || (tr.type === 'nutrition' ? 'Diet Plan' : 'Consultation & Medicine Fee'),
        regId: tr.registrationId || tr.regId || tr.regID || patientDoc?.registrationId || patientDoc?.regId || patientDoc?.regID || '-',
        patientName: tr.patientName || tr.fullName || patientDoc?.fullName || '-',
        phone: tr.patientPhone || tr.phone || tr.phoneNumber || patientDoc?.phone || patientDoc?.patientPhone || patientDoc?.phoneNumber || '-',
        branch: tr.branchName || 'Main Branch',
        doctorName: tr.doctor || tr.doctorName || tr.prescribedBy || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || '-',
        source: tr.source || 'Walk-in',
        amount: (() => {
          let amt = Number(tr.amount) || 0;
          if (tr.type === 'nutrition') {
            return amt;
          }
          if (tr.itemsPaid) {
            let parsed = tr.itemsPaid;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
            }
            if (parsed) {
              const cons = Number(parsed.consultation || 0);
              const med = Number(parsed.medicine || 0);
              const diet = Number(parsed.dietPlan || 0);
              let other = 0;
              if (Array.isArray(parsed.otherFees)) {
                other = parsed.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
              }
              const tot = cons + med + diet + other;
              if (tot > 0 && amt === 0) amt = tot;
            }
          } else {
            const isSplit = tr.paymentId && typeof tr.paymentId === 'string' && tr.paymentId.includes('SPLIT');
            const m = (tr.method || '-').toUpperCase();
            if (isSplit || m === 'SPLIT' || m === 'APP_SPLIT') {
              if (patientDoc && patientDoc.paymentSplitDetails) {
                amt = Number(patientDoc.paymentSplitDetails.cash || 0) + Number(patientDoc.paymentSplitDetails.upi || 0);
              }
            } else {
              if (patientDoc && patientDoc.itemsPaid && patientDoc.itemsPaid.medicine !== undefined) {
                amt = Number(patientDoc.itemsPaid.medicine);
              }
            }
          }
          return amt;
        })(),
        method: (() => {
          let m = (tr.method || 'N/A').toUpperCase();
          const isSplit = tr.paymentId && typeof tr.paymentId === 'string' && tr.paymentId.includes('SPLIT');
          if (isSplit || m === 'SPLIT' || m === 'APP_SPLIT') return 'CASH/UPI';
          if (['ONLINE_RAZORPAY', 'ONLINE', 'APP', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI'].includes(m)) return 'UPI';
          return m;
        })(),
        dateTime: fullDateTime,
        timestamp,
        status: 'PAID',
        duration: 0,
        paymentId: tr.paymentId || null,
        itemsPaid: tr.type === 'nutrition' ? { dietPlan: Number(tr.amount) || 0 } : safeParseObj(tr.itemsPaid),
        paymentSplitDetails: (() => {
          let pSplitDetails = safeParseObj(tr.paymentSplitDetails) || safeParseObj(patientDoc?.paymentSplitDetails);
          if (!pSplitDetails && patientDoc && (patientDoc.splitCounterAmount !== undefined || patientDoc.splitUpiAmount !== undefined)) {
            pSplitDetails = { cash: Number(patientDoc.splitCounterAmount || 0), upi: Number(patientDoc.splitUpiAmount || 0) };
          }
          return pSplitDetails || null;
        })()
      });
    });

    // Update paidItemsMap with anything processed in the pharmacy loop so subsequent loops skip duplicates
    list.forEach(tr => {
      if (tr.itemsPaid) {
        const k1 = tr.patientId && tr.patientId !== '-' ? String(tr.patientId) : null;
        const regId = tr.regId && tr.regId !== '-' ? String(tr.regId) : null;
        const k2 = regId;
        const phone = tr.phone && tr.phone !== '-' ? String(tr.phone).trim() : null;
        let k3 = phone;
        if (k3 && k3.length >= 10 && !isNaN(k3.slice(-10))) k3 = k3.slice(-10);

        if (k1) trackPaidItem(k1, tr.itemsPaid);
        if (k2) trackPaidItem(k2, tr.itemsPaid);
        if (k3) trackPaidItem(k3, tr.itemsPaid);
      }
    });

    // Medicine Forms
    filteredMedicineForms.forEach(form => {
      const patientDoc = form.patientId ? patientIndex.byId.get(String(form.patientId)) : null;

      const parseD = (raw) => {
        if (!raw) return null;
        if (raw.toDate) return raw.toDate();
        if (raw.seconds) return new Date(raw.seconds * 1000);
        return new Date(raw);
      };

      const d = parseD(form.createdAt || form.formDate);
      const k1 = form.patientId ? String(form.patientId) : null;
      const regId = form.registrationId || form.regId || form.regID || patientDoc?.registrationId || patientDoc?.regId || patientDoc?.regID || '-';
      const k2 = (regId !== '-') ? String(regId) : null;

      // Skip if amount is 0 (prevents duplicates/non-revenue items from showing in revenue history)
      const amt = Number(form.amountPaid) || 0;
      if (amt <= 0) return;

      // Skip if already covered by combined consultation transaction
      const p1 = k1 ? paidItemsMap.get(k1) : null;
      const p2 = k2 ? paidItemsMap.get(k2) : null;
      if ((p1 && p1.med) || (p2 && p2.med)) return;

      const timestamp = form.createdAt ? new Date(form.createdAt).getTime() : (form.formDate ? new Date(form.formDate).getTime() : 0);

      let fullDateTime = 'N/A';
      if (form.createdAt) fullDateTime = new Date(form.createdAt).toLocaleString('en-IN');
      else if (form.formDate) fullDateTime = safeDateDisplay(form.formDate);

      list.push({
        id: `medform_${form.id || Math.random().toString(36).substring(7)}`,
        type: 'Consultation & Medicine Fee',
        regId: regId,
        patientName: form.patientName || patientDoc?.fullName || '-',
        phone: form.phone || patientDoc?.phone || '-',
        branch: form.branchName || 'Main Branch',
        doctorName: form.doctor || form.doctorName || patientDoc?.doctor || patientDoc?.doctorName || '-',
        source: patientDoc?.source || 'Walk-in',
        amount: Number(form.amountPaid) || 0,
        method: (form.paymentMethod || 'N/A').toUpperCase(),
        dateTime: fullDateTime,
        timestamp,
        status: 'PAID',
        duration: form.duration || 0,
        itemsPaid: { medicine: Number(form.amountPaid) || 0 }
      });
    });

    // Diet Plans (Nutrition Plans)
    filteredNutritionPlansForRevenue.forEach(plan => {
      const patientDoc = plan.patientId ? patientIndex.byId.get(String(plan.patientId)) : null;

      const parseD = (raw) => {
        if (!raw) return null;
        if (raw.toDate) return raw.toDate();
        if (raw.seconds) return new Date(raw.seconds * 1000);
        return new Date(raw);
      };

      const d = parseD(plan.paymentCollectedAt || plan.createdAt);
      const k1 = plan.patientId ? String(plan.patientId) : null;
      const regId = plan.registrationId || plan.regId || plan.regID || patientDoc?.registrationId || patientDoc?.regId || patientDoc?.regID || '-';
      const k2 = (regId !== '-') ? String(regId) : null;
      const phone = plan.patientPhone || plan.phone || plan.phoneNumber || patientDoc?.phone || patientDoc?.patientPhone || patientDoc?.phoneNumber || '-';
      const k3 = (phone !== '-') ? String(phone) : null;

      const amt = Number(plan.amountPaid || plan.amount) || 0;
      if (amt <= 0) return;

      // Skip if already covered by combined consultation transaction (ItemsPaid)
      if ((k1 && paidItemsMap.get(k1)?.diet) || (k2 && paidItemsMap.get(k2)?.diet) || (k3 && paidItemsMap.get(k3)?.diet)) return;
      // Skip if already processed as a standalone transaction in the pharmacy loop
      if ((k1 && processedStandaloneDietPlans.has(k1)) || (k2 && processedStandaloneDietPlans.has(k2)) || (k3 && processedStandaloneDietPlans.has(k3))) return;

      const timestamp = plan.paymentCollectedAt ?
        (plan.paymentCollectedAt.seconds ? plan.paymentCollectedAt.seconds * 1000 : new Date(plan.paymentCollectedAt).getTime()) :
        (plan.createdAt ? new Date(plan.createdAt).getTime() : 0);

      let fullDateTime = 'N/A';
      if (plan.paymentCollectedAt) {
        if (plan.paymentCollectedAt.seconds) {
          fullDateTime = new Date(plan.paymentCollectedAt.seconds * 1000).toLocaleString('en-IN');
        } else {
          fullDateTime = new Date(plan.paymentCollectedAt).toLocaleString('en-IN');
        }
      } else if (plan.createdAt) {
        fullDateTime = new Date(plan.createdAt).toLocaleString('en-IN');
      }

      list.push({
        id: `dietplan_${plan.id || Math.random().toString(36).substring(7)}`,
        type: 'Diet Plan',
        regId: regId,
        patientName: plan.patientName || patientDoc?.fullName || '-',
        phone: plan.patientPhone || patientDoc?.phone || '-',
        branch: plan.branchName || 'Main Branch',
        doctorName: plan.doctorName || patientDoc?.doctor || patientDoc?.doctorName || '-',
        source: plan.source || patientDoc?.source || 'Walk-in',
        amount: amt,
        method: (() => {
          const m = (plan.paymentMethod || 'N/A').toUpperCase();
          if (m === 'SPLIT' || m === 'APP_SPLIT') return 'CASH/UPI';
          return m;
        })(),
        dateTime: fullDateTime,
        timestamp,
        status: 'PAID',
        duration: plan.duration || 0,
        itemsPaid: { dietPlan: amt }
      });
    });

    // Package Payments (from medicineTransactions which fetches ALL transactions)
    medicineTransactions.forEach(tr => {
      const tType = (tr.type || '').toLowerCase();
      const isPkg = tType === 'package_payment';
      if (!isPkg) return;

      const amt = Number(tr.amount || 0);
      if (amt <= 0) return;

      const k1 = tr.patientId ? String(tr.patientId) : null;
      const regId = tr.registrationId || tr.regId || '-';
      const k2 = (regId !== '-') ? String(regId) : null;
      const phone = tr.patientPhone || tr.phone || '-';
      let k3 = phone !== '-' ? String(phone).replace(/\D/g, '').trim() : null;
      if (k3 && k3.length >= 10 && !isNaN(k3.slice(-10))) k3 = k3.slice(-10);

      const d = parseD(tr.timestamp || tr.createdAt);
      if (d && !isNaN(d.getTime())) {
        const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const cleanPhone = (tr.patientPhone || tr.phone || '').replace(/\D/g, '').slice(-10);
        if (cleanPhone && processedKeys.has(`${cleanPhone}_${dateKey}`)) return;
      }

      if ((k1 && paidItemsMap.get(k1)?.pkg) || (k2 && paidItemsMap.get(k2)?.pkg) || (k3 && paidItemsMap.get(k3)?.pkg)) return;

      const timestamp = d ? d.getTime() : 0;
      const fullDateTime = safeDateDisplay(tr.timestamp || tr.createdAt) || 'N/A';
      const matchesSearch = !revenueSearch.trim() ||
        (tr.patientName && tr.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
        (phone && phone.includes(revenueSearch.trim()));

      const matchesBranch = isBranchMatchHelper(tr.branchId, tr.branchName, revenueBranchId, branches);

      let matchesDate = true;
      if (d && !isNaN(d.getTime())) {
        if (revenueDate) {
          const filterDate = parseHTMLDateToDateObj(revenueDate);
          if (filterDate) { d.setHours(0, 0, 0, 0); filterDate.setHours(0, 0, 0, 0); if (d.getTime() !== filterDate.getTime()) matchesDate = false; }
        } else if (revenueYear !== 'all') {
          if (d.getFullYear() !== parseInt(revenueYear, 10)) matchesDate = false;
          else if (revenueMonth !== 'all') { if (d.getMonth() + 1 !== parseInt(revenueMonth, 10)) matchesDate = false; }
        }
      } else {
        if (revenueDate || revenueYear !== 'all') matchesDate = false;
      }

      if (!matchesSearch || !matchesBranch || !matchesDate) return;

      list.push({
        id: `pkg_${tr.id || Math.random().toString(36).substring(7)}`,
        patientId: tr.patientId || '-',
        type: 'Package',
        regId: regId,
        patientName: tr.patientName || '-',
        phone: phone,
        branch: tr.branchName || tr.branch || 'Main Branch',
        doctorName: tr.recordedBy || '-',
        source: tr.source || 'Walk-in',
        amount: amt,
        method: (tr.method || 'CASH').toUpperCase(),
        dateTime: fullDateTime,
        timestamp,
        status: 'PAID',
        duration: 0,
        paymentId: tr.paymentId || null,
        itemsPaid: { package: amt }
      });
    });

    let finalTxList = list.filter(tr => Number(tr.amount) > 0);

    // Group by phone number and date to avoid duplicate rows for the same patient on the same day
    const getPatientTxKey = (tr) => {
      let dateKey = 'unknown';
      const d = parseAnyDateObj(tr.timestamp || tr.dateTime || tr.createdAt || tr.paymentCollectedAt || tr.appointmentDate || tr.date);
      if (d && !isNaN(d.getTime())) {
        dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      }

      const rawReg = tr.regId || tr.registrationId || tr.regID || tr.patientRegId;
      const regId = (rawReg && rawReg !== '-' && !String(rawReg).startsWith('cons_') && !String(rawReg).startsWith('pharm_') && !String(rawReg).startsWith('medform_') && !String(rawReg).startsWith('pkg_') && !String(rawReg).startsWith('dietplan_'))
        ? String(rawReg).toLowerCase().trim()
        : null;

      const rawPhone = tr.phone || tr.patientPhone || tr.phoneNumber || tr.contactNumber || tr.contact || tr.patientContact;
      let cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '').trim() : '';
      if (cleanPhone.length >= 10) {
        cleanPhone = cleanPhone.slice(-10);
      } else {
        cleanPhone = null;
      }

      const rawName = tr.patientName || tr.fullName || tr.name;
      const cleanName = rawName ? String(rawName).toLowerCase().replace(/[^a-z0-9]/g, '').trim() : null;

      const primaryId = regId || cleanPhone || cleanName || 'unknown_patient';
      return `${primaryId}_${dateKey}`;
    };

    const groupedTx = new Map();
    finalTxList.forEach(tr => {
      const key = getPatientTxKey(tr);
      const isSplitLeg = tr.paymentId && typeof tr.paymentId === 'string' && tr.paymentId.includes('SPLIT_LEG');

      if (!groupedTx.has(key)) {
        groupedTx.set(key, {
          ...tr,
          isPrimaryDoc: tr.isPrimaryDoc || false,
          methods: new Set([(tr.method || 'N/A').toUpperCase()]),
          types: new Set([tr.type]),
          itemsPaid: safeParseObj(tr.itemsPaid),
          paymentSplitDetails: safeParseObj(tr.paymentSplitDetails),
          processedSplitItems: isSplitLeg
        });
      } else {
        const existing = groupedTx.get(key);
        if (tr.isPrimaryDoc) {
          existing.amount = Number(tr.amount || 0);
          existing.isPrimaryDoc = true;
        } else if (!existing.isPrimaryDoc) {
          if (isSplitLeg) {
            existing.amount += Number(tr.amount || 0);
          } else {
            if (Number(tr.amount || 0) > existing.amount) {
              existing.amount = Number(tr.amount || 0);
            }
          }
        }
        existing.methods.add((tr.method || 'N/A').toUpperCase());
        existing.types.add(tr.type);
        if (tr.itemsPaid) {
          if (isSplitLeg && existing.processedSplitItems) {
            // Skip adding itemsPaid because it's a split leg and we've already recorded the full breakdown!
          } else {
            existing.itemsPaid = existing.itemsPaid || {};
            if (tr.itemsPaid.consultation) existing.itemsPaid.consultation = Math.max(existing.itemsPaid.consultation || 0, Number(tr.itemsPaid.consultation));
            if (tr.itemsPaid.medicine) existing.itemsPaid.medicine = Math.max(existing.itemsPaid.medicine || 0, Number(tr.itemsPaid.medicine));
            if (tr.itemsPaid.dietPlan) existing.itemsPaid.dietPlan = Math.max(existing.itemsPaid.dietPlan || 0, Number(tr.itemsPaid.dietPlan));
            if (tr.itemsPaid.package) existing.itemsPaid.package = Math.max(existing.itemsPaid.package || 0, Number(tr.itemsPaid.package));
            if (Array.isArray(tr.itemsPaid.otherFees)) {
              existing.itemsPaid.otherFees = [...(existing.itemsPaid.otherFees || []), ...tr.itemsPaid.otherFees];
            }
            if (isSplitLeg) existing.processedSplitItems = true;
          }
        }
      }
    });

    finalTxList = Array.from(groupedTx.values()).map(tr => {
      let combinedType = 'Unknown';
      if (tr.itemsPaid) {
        const hCons = Number(tr.itemsPaid.consultation || 0) > 0;
        const hMed = Number(tr.itemsPaid.medicine || 0) > 0;
        const hDiet = Number(tr.itemsPaid.dietPlan || 0) > 0;
        const hPkg = Number(tr.itemsPaid.package || 0) > 0;

        if (hPkg) {
          if (hCons) combinedType = 'Consultation & Package';
          else combinedType = 'Package';
        }
        else if (hCons && hMed && hDiet) combinedType = 'Consultation & Medicine Fee / Diet Plan';
        else if (hCons && hMed) combinedType = 'Consultation & Medicine Fee';
        else if (hCons && hDiet) combinedType = 'Consultation / Diet Plan';
        else if (!hCons && hMed && hDiet) combinedType = 'Medicine Fee / Diet Plan';
        else if (!hCons && !hMed && hDiet) combinedType = 'Diet Plan';
        else if (!hCons && hMed && !hDiet) combinedType = 'Medicine Fee';
        else if (hCons && !hMed && !hDiet) combinedType = 'Consultation';
      } else {
        const tSet = tr.types;
        combinedType = Array.from(tSet).join(' / ');
        if (tSet.has('Consultation') && tSet.has('Diet Plan')) combinedType = 'Consultation / Diet Plan';
        if (tSet.has('Consultation & Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Consultation & Medicine Fee / Diet Plan';
        if (tSet.has('Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Medicine Fee / Diet Plan';
        if (tSet.has('Consultation') && tSet.has('Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Consultation & Medicine Fee / Diet Plan';
        if (tSet.has('Consultation') && tSet.has('Consultation & Medicine Fee')) combinedType = 'Consultation & Medicine Fee';
      }

      const methodsArr = Array.from(tr.methods).filter(m => m !== 'N/A');
      return {
        ...tr,
        type: combinedType,
        method: methodsArr.length > 0 ? methodsArr.join(' + ') : 'N/A'
      };
    });

    finalTxList = finalTxList.sort((a, b) => b.timestamp - a.timestamp);
    if (revenueAmountRange !== 'all') {
      finalTxList = finalTxList.filter(tr => checkAmountRange(Number(tr.amount), revenueAmountRange));
    }
    return finalTxList;
  }, [filteredRevenuePatients, filteredPharmacyTransactions, filteredMedicineForms, filteredNutritionPlansForRevenue, patients, revenueAmountRange]);

  const allTxTotalPages = Math.ceil(allHistoryTransactions.length / allTxPerPage) || 1;
  const safeAllTxCurrentPage = Math.min(allTxCurrentPage, allTxTotalPages);
  const indexOfLastAllTx = safeAllTxCurrentPage * allTxPerPage;
  const indexOfFirstAllTx = indexOfLastAllTx - allTxPerPage;
  const currentAllHistoryTransactions = allHistoryTransactions.slice(indexOfFirstAllTx, indexOfLastAllTx);
  useEffect(() => {
    if (allTxCurrentPage > allTxTotalPages) {
      setAllTxCurrentPage(allTxTotalPages);
    }
  }, [allTxTotalPages, allTxCurrentPage]);
  const renderRevenueFilters = (hideExport = false) => (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Patient</label>
        <input
          type="text"
          placeholder="Name or phone..."
          className="glass-input"
          value={revenueSearch}
          onChange={(e) => setRevenueSearch(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '8px 12px' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter Branch</label>
        <select
          className="glass-input"
          value={revenueBranchId}
          onChange={(e) => setRevenueBranchId(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Branches</option>
          {branches.map(branch => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Date</label>
        <input
          type="date"
          className="glass-input"
          value={revenueDate}
          onChange={(e) => { setRevenueDate(e.target.value); setRevenueYear('all'); setRevenueMonth('all'); }}
          onClick={(e) => e.target.showPicker && e.target.showPicker()}
          style={{ colorScheme: 'dark', fontSize: '0.85rem', padding: '8px 12px', cursor: 'pointer' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Year</label>
        <select
          className="glass-input"
          value={revenueYear}
          onChange={(e) => { setRevenueYear(e.target.value); setRevenueDate(''); }}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Month</label>
        <select
          className="glass-input"
          value={revenueMonth}
          onChange={(e) => { setRevenueMonth(e.target.value); setRevenueDate(''); if (revenueYear === 'all') setRevenueYear(new Date().getFullYear().toString()); }}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Months</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Doctor</label>
        <select
          className="glass-input"
          value={revenueDoctor}
          onChange={(e) => setRevenueDoctor(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Doctors</option>
          {staffMembers.filter(s => s.role === 'doctor').map(doc => (
            <option key={doc.id} value={doc.name || doc.fullName}>{doc.name || doc.fullName}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Patient Source</label>
        <select
          className="glass-input"
          value={revenueSource}
          onChange={(e) => setRevenueSource(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Sources</option>
          <option value="Walk-in">Walk-in</option>
          <option value="Old Patient">Old Patient</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Website">Website</option>
          <option value="Google">Google</option>
          <option value="Online">Online</option>
          <option value="Practo">Practo</option>
          <option value="Referral">Referral</option>
          <option value="Youtube">Youtube</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Mode</label>
        <select
          className="glass-input"
          value={revenueMethod}
          onChange={(e) => setRevenueMethod(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Modes</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="free">Free</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Revenue Split</label>
        <select
          className="glass-input"
          value={revenueSplitType}
          onChange={(e) => setRevenueSplitType(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Types</option>
          <option value="Consultation">Consultation</option>
          <option value="Consultation & Medicine Fee">Consultation & Medicine Fee</option>
          <option value="Diet Plan">Diet Plan</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Amount Range</label>
        <select
          className="glass-input"
          value={revenueAmountRange}
          onChange={(e) => setRevenueAmountRange(e.target.value)}
          style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <option value="all">All Amounts</option>
          <option value="500-1000">500-1000</option>
          <option value="1000-2000">1000-2000</option>
          <option value="2000-3000">2000-3000</option>
          <option value="3000-4000">3000-4000</option>
          <option value="4000-5000">4000-5000</option>
          <option value="5000+">5000+</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleResetRevenueFilters} className="btn-secondary" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}>
          <RotateCcw size={14} /> Reset
        </button>
        {!hideExport && (
          <button onClick={handleExportToExcel} className="btn-primary" style={{ flex: 1, padding: '8px', background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <ExternalLink size={14} /> Export
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-container">

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '8px',
          padding: isCollapsed ? '16px 8px 12px 8px' : '16px 16px 12px 16px',
          margin: isCollapsed ? '-16px -8px 0 -8px' : '-16px -16px 0 -16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          width: 'calc(100% + ' + (isCollapsed ? '16px' : '32px') + ')',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            {!isCollapsed && (
              <span style={{
                color: 'var(--primary-color)',
                fontWeight: '700',
                fontSize: '0.85rem',
                lineHeight: '1.2',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                display: 'block'
              }}>
                Spiritual Homeo Clinic
              </span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isCollapsed ? <ChevronRight size={20} color="var(--primary-color)" /> : <ChevronLeft size={20} color="var(--primary-color)" />}
          </button>
        </div>
        <p className="sidebar-text" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', marginTop: '-12px' }}>
          Super Admin Portal
        </p>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginTop: '20px' }}>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'overview' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'overview' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={18} />
            <span className="sidebar-text">Overview Dashboard</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'branches' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'branches' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('branches')}
          >
            <Building2 size={18} />
            <span className="sidebar-text">Manage Branches</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'patients' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'patients' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('patients')}
          >
            <Users size={18} />
            <span className="sidebar-text">Global Patient List</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'packages' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'packages' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('packages')}
          >
            <Package size={18} />
            <span className="sidebar-text">Package Members</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'staff' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'staff' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('staff')}
          >
            <UserCheck size={18} />
            <span className="sidebar-text">Staff Management</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'doctor-timings' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'doctor-timings' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('doctor-timings')}
          >
            <Clock size={18} />
            <span className="sidebar-text">Doctor Timings</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'rewards' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'rewards' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('rewards')}
          >
            <Coins size={18} />
            <span className="sidebar-text">Rewards & Coupons</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'analysis' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'analysis' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('analysis')}
          >
            <Activity size={18} />
            <span className="sidebar-text">Revenue Analysis</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'revenue' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'revenue' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('revenue')}
          >
            <IndianRupee size={18} />
            <span className="sidebar-text">Total Revenue</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'pending-payments' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'pending-payments' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('pending-payments')}
          >
            <IndianRupee size={18} />
            <span className="sidebar-text">Pending Payments</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'nutrition-revenue' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'nutrition-revenue' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('nutrition-revenue')}
          >
            <Apple size={18} />
            <span className="sidebar-text">Nutrition Revenue</span>
          </button>
          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'average-revenue' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'average-revenue' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('average-revenue')}
          >
            <TrendingUp size={18} />
            <span className="sidebar-text">Average Revenue</span>
          </button>

          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: activeTab === 'banners' ? '#ffffff' : 'rgba(255,255,255,0.7)', fontWeight: activeTab === 'banners' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('banners')}
          >
            <FileImage size={18} />
            <span className="sidebar-text">Manage Banners</span>
          </button>
          <Link
            to="/attendance"
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <Clock size={18} />
            <span className="sidebar-text">Global Attendance</span>
          </Link>
          <Link
            to="/working-hours"
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <Clock size={18} />
            <span className="sidebar-text">Staff Working Hours</span>
          </Link>
          <Link
            to="/targets"
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <Target size={18} />
            <span className="sidebar-text">Target Management</span>
          </Link>
          <Link
            to="/patient-classification"
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            <Users size={18} />
            <span className="sidebar-text">🆕 New Patients & Sources</span>
          </Link>

          <button
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', border: 'none', background: activeTab === 'edit-medicine-form' ? 'rgba(255,255,255,0.15)' : 'transparent', color: activeTab === 'edit-medicine-form' ? '#ffffff' : 'rgba(255,255,255,0.9)', fontWeight: activeTab === 'edit-medicine-form' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', whiteSpace: 'nowrap', width: '100%', borderRadius: '6px' }}
            onClick={() => setActiveTab('edit-medicine-form')}
          >
            <FileText size={18} />
            <span className="sidebar-text">📝 Edit Medicine Form</span>
          </button>
        </nav>

        <button
          style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.3)', background: 'transparent', color: 'white', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', marginTop: 'auto', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          onClick={handleLogout}
        >
          <LogOut size={18} />
          <span className="sidebar-text">Sign Out</span>
        </button>
      </aside>

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ textAlign: 'right', backgroundColor: '#fff', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'capitalize' }}>
              {(userData?.branchName ? getStandardBranchName(userData.branchName) : (userData?.name ? userData.name.replace(/KPHP/gi, 'KPHB') : 'Admin Portal'))}
            </div>
            {userData?.phone && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {userData.phone}
              </div>
            )}
          </div>
        </div>

        {activeTab === 'overview' && (
          <AdminOverview
            branches={branches}
            patients={patients}
            medicineTransactions={medicineTransactions}
            staffMembers={staffMembers}
          />
        )}

        {activeTab === 'pending-payments' && <PendingPayments />}
        {activeTab === 'patient-classification' && <PatientClassificationPage />}
        {activeTab === 'edit-medicine-form' && <AdminMedicineFormEditor />}

        {activeTab === 'branches' && (
          <div className="fade-in">
            <div className="flex-between" style={{ marginBottom: '32px' }}>
              <div>
                <h2>Branch Management</h2>
                <p style={{ color: 'var(--text-muted)' }}>Create and manage clinic branches</p>
              </div>
              <button className="btn-primary" onClick={() => setShowAddBranch(true)}>
                <Plus size={20} /> Add New Branch
              </button>
            </div>

            <div className="table-container glass-panel">
              <table>
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>Username</th>
                    <th>Created At</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No branches found.</td>
                    </tr>
                  ) : (
                    branches.map(branch => (
                      <tr key={branch.id}>
                        <td data-label="Branch Name" style={{ fontWeight: 500 }}>{branch.name}</td>
                        <td data-label="Username" style={{ color: 'var(--text-muted)' }}>{branch.username || (branch.email ? branch.email.split('@')[0] : (branch.name || branch.id || 'N/A'))}</td>
                        <td data-label="Created At">{new Date(branch.createdAt).toLocaleDateString()}</td>
                        <td data-label="Status"><span className="badge badge-primary">Active</span></td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn-secondary"
                              type="button"
                              style={{ padding: '6px 10px', minWidth: '70px' }}
                              onClick={() => openBranchModal(branch)}
                            >
                              View
                            </button>
                            <button
                              className="btn-secondary"
                              type="button"
                              style={{ padding: '6px 10px', minWidth: '70px' }}
                              onClick={() => openBranchModal(branch)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ color: 'var(--danger)', padding: '6px' }}
                              onClick={() => handleDeleteBranch(branch.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="fade-in">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2>Global Patient Database</h2>
                <p style={{ color: 'var(--text-muted)' }}>View patients from all branches</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div style={{ padding: '16px 0px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Patient</label>
                <input
                  type="text"
                  placeholder="Name, phone, doctor, subject or registration ID..."
                  className="glass-input"
                  value={patientsSearch}
                  onChange={(e) => { setPatientsSearch(e.target.value); setPatientsCurrentPage(1); }}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Branch</label>
                <select
                  className="glass-input"
                  value={selectedBranchId}
                  onChange={(e) => { setSelectedBranchId(e.target.value); setPatientsCurrentPage(1); }}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                >
                  <option value="all">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Rows Per Page</label>
                <select
                  className="glass-input"
                  value={patientsPerPage}
                  onChange={(e) => { setPatientsPerPage(Number(e.target.value)); setPatientsCurrentPage(1); }}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                >
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleExportCurrentPage}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    height: '38px',
                    background: '#10b981',
                    borderColor: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  <ExternalLink size={16} /> Export Page
                </button>
              </div>
            </div>

            <div className="table-container" style={{ transform: 'rotateX(180deg)', overflowX: 'auto', overflowY: 'hidden', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <table style={{ transform: 'rotateX(180deg)' }}>
                <thead>
                  <tr>
                    <th>S.N.O</th>
                    <th>Reg ID</th>
                    <th>Patient Name</th>
                    <th>Phone</th>
                    <th>Branch</th>
                    <th>Reward Points</th>
                    <th>Subject</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPatients.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No patient records found for the selected filter.</td>
                    </tr>
                  ) : (
                    currentPatients.map((patient, index) => (
                      <tr key={patient.id}>
                        <td data-label="S.N.O">{indexOfFirstPatient + index + 1}</td>
                        <td data-label="Reg ID" style={{ color: 'var(--primary-color)', fontWeight: '600' }}>{patient.registrationId || patient.regId || patient.regID || (patient.id && patient.id.startsWith('WK') ? patient.id : null) || 'N/A'}</td>
                        <td data-label="Patient Name" style={{ fontWeight: 500 }}>{patient.fullName}</td>
                        <td data-label="Phone">{patient.phone || patient.patientPhone || patient.phoneNumber || patient.contact || 'N/A'}</td>
                        <td data-label="Branch">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="badge" style={{ background: 'rgba(168, 206, 58, 0.1)', color: 'var(--accent-color)' }}>
                              {patient.branchName || 'Unknown'}
                            </span>
                            <span className="badge" style={{
                              background: patient.sourceCollection === 'patients' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: patient.sourceCollection === 'patients' ? '#3b82f6' : '#10b981',
                              fontSize: '0.65rem',
                              padding: '2px 4px',
                              alignSelf: 'flex-start'
                            }}>
                              {patient.sourceCollection === 'patients' ? 'App/Registered' : 'Walk-in/Booking'}
                            </span>
                          </div>
                        </td>
                        <td data-label="Reward Points" style={{ fontWeight: 'bold', color: '#b45309' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Coins size={14} color="#f59e0b" />
                            {patient.rewardPoints || 0} pts
                          </span>
                        </td>
                        <td data-label="Subject">{patient.subject || 'N/A'}</td>
                        <td data-label="Doctor">{patient.doctor || 'N/A'}</td>
                        <td data-label="Date">
                          {patient.sourceCollection === 'patients' ? (
                            patient.createdAt
                              ? (patient.createdAt.toDate ? patient.createdAt.toDate().toLocaleDateString('en-IN') : new Date(patient.createdAt).toLocaleDateString('en-IN'))
                              : (patient.appointmentDate ? getSafeDisplayDate(patient.appointmentDate) : 'N/A')
                          ) : (
                            patient.appointmentDate
                              ? getSafeDisplayDate(patient.appointmentDate)
                              : (patient.createdAt ? (patient.createdAt.toDate ? patient.createdAt.toDate().toLocaleDateString('en-IN') : new Date(patient.createdAt).toLocaleDateString('en-IN')) : 'N/A')
                          )}
                        </td>
                        <td data-label="Action">
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => setSelectedPatient(patient)}
                            >
                              <ExternalLink size={14} style={{ marginRight: '4px' }} /> View
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '4px 8px', color: 'var(--danger)' }}
                              onClick={() => handleDeletePatient(patient)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPatientPages > 1 && (
              <div className="flex-between" style={{ marginTop: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Showing {indexOfFirstPatient + 1} to {Math.min(indexOfLastPatient, sortedGlobalPatients.length)} of {sortedGlobalPatients.length} patients
                </span>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    disabled={safePatientsCurrentPage === 1}
                    onClick={() => setPatientsCurrentPage(prev => Math.max(1, prev - 1))}
                    className="btn-secondary"
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: safePatientsCurrentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      cursor: safePatientsCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: safePatientsCurrentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  {/* Render page numbers */}
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    let start = Math.max(1, safePatientsCurrentPage - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPatientPages, start + maxVisible - 1);

                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }

                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setPatientsCurrentPage(i)}
                          className={safePatientsCurrentPage === i ? "btn-primary" : "btn-secondary"}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            minWidth: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            background: safePatientsCurrentPage === i ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                            color: safePatientsCurrentPage === i ? '#ffffff' : 'var(--text-main)',
                            border: '1px solid ' + (safePatientsCurrentPage === i ? 'var(--primary-color)' : 'var(--border-color)'),
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontWeight: safePatientsCurrentPage === i ? '700' : '500'
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}

                  <button
                    disabled={safePatientsCurrentPage === totalPatientPages}
                    onClick={() => setPatientsCurrentPage(prev => Math.min(totalPatientPages, prev + 1))}
                    className="btn-secondary"
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: safePatientsCurrentPage === totalPatientPages ? 'var(--text-muted)' : 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      cursor: safePatientsCurrentPage === totalPatientPages ? 'not-allowed' : 'pointer',
                      opacity: safePatientsCurrentPage === totalPatientPages ? 0.5 : 1
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="fade-in">
            {/* Header Section */}
            <div className="flex-between" style={{ marginBottom: '32px' }}>
              <div>
                <h2>Package Members Directory</h2>
                <p style={{ color: 'var(--text-muted)' }}>View and search medical packages and billing details across all branches</p>
              </div>

              <div>
                <button className="btn-primary" onClick={handlePackageExportToCSV}>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'transparent', boxShadow: 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Total Members Enrolled</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {packageMembers.length}
                </span>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--success)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'transparent', boxShadow: 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Active Packages</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                  {packageMembers.filter(m => isPackageActive(m.startDate, m.endDate)).length}
                </span>
              </div>
              <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--danger)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'transparent', boxShadow: 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Pending Balance Collection</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>
                  ₹{packageMembers.reduce((sum, m) => sum + ((m.totalAmount || 0) - (m.paidAmount || 0)), 0)}
                </span>
              </div>
            </div>

            {/* Filters Bar */}
            <div style={{ padding: '16px 0px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Patient</label>
                <input
                  type="text"
                  placeholder="Name or phone..."
                  className="glass-input"
                  value={packagesSearch}
                  onChange={(e) => setPackagesSearch(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Registered Branch</label>
                <select
                  className="glass-input"
                  value={packagesBranchId}
                  onChange={(e) => setPackagesBranchId(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                >
                  <option value="all">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Status</label>
                <select
                  className="glass-input"
                  value={packagesStatus}
                  onChange={(e) => setPackagesStatus(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '10px 14px', background: '#ffffff', border: '1px solid rgba(37, 142, 200, 0.25)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', width: '100%', boxShadow: '0 2px 4px rgba(37, 142, 200, 0.05)' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="expired">Expired Only</option>
                </select>
              </div>
            </div>

            {/* Members Table */}
            <div className="table-container" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>S.N.O</th>
                    <th>Patient Name</th>
                    <th>Mobile</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Total Cost</th>
                    <th>Amount Paid</th>
                    <th>Balance</th>
                    <th>Registered Branch</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {packageMembers.filter(member => {
                    const matchesSearch = !packagesSearch.trim() ||
                      (member.patientName && member.patientName.toLowerCase().includes(packagesSearch.toLowerCase())) ||
                      (member.patientMobile && member.patientMobile.includes(packagesSearch.trim()));

                    const branchObj = branches.find(b => b.id === packagesBranchId);
                    const memberBranchName = getMemberBranchName(member);
                    const matchesBranch = packagesBranchId === 'all' ||
                      member.branchId === packagesBranchId ||
                      (memberBranchName && branchObj && memberBranchName === branchObj.name);

                    const isActive = isPackageActive(member.startDate, member.endDate);
                    const matchesStatus = packagesStatus === 'all' ||
                      (packagesStatus === 'active' && isActive) ||
                      (packagesStatus === 'expired' && !isActive);

                    return matchesSearch && matchesBranch && matchesStatus;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No package members found.</td>
                    </tr>
                  ) : (
                    packageMembers
                      .filter(member => {
                        const matchesSearch = !packagesSearch.trim() ||
                          (member.patientName && member.patientName.toLowerCase().includes(packagesSearch.toLowerCase())) ||
                          (member.patientMobile && member.patientMobile.includes(packagesSearch.trim()));

                        const branchObj = branches.find(b => b.id === packagesBranchId);
                        const memberBranchName = getMemberBranchName(member);
                        const matchesBranch = packagesBranchId === 'all' ||
                          member.branchId === packagesBranchId ||
                          (memberBranchName && branchObj && memberBranchName === branchObj.name);

                        const isActive = isPackageActive(member.startDate, member.endDate);
                        const matchesStatus = packagesStatus === 'all' ||
                          (packagesStatus === 'active' && isActive) ||
                          (packagesStatus === 'expired' && !isActive);

                        return matchesSearch && matchesBranch && matchesStatus;
                      })
                      .map((member, index) => {
                        const isActive = isPackageActive(member.startDate, member.endDate);
                        const balance = member.balanceAmount !== undefined ? member.balanceAmount : ((member.totalAmount || 0) - (member.paidAmount || 0));
                        return (
                          <tr key={member.id}>
                            <td data-label="S.N.O">{index + 1}</td>
                            <td data-label="Patient Name" style={{ fontWeight: 500 }}>{member.patientName}</td>
                            <td data-label="Mobile">{member.patientMobile}</td>
                            <td data-label="Start Date">{member.startDate}</td>
                            <td data-label="End Date">{member.endDate}</td>
                            <td data-label="Total Cost">₹{member.totalAmount}</td>
                            <td data-label="Amount Paid" style={{ color: 'var(--success)', fontWeight: '600' }}>₹{member.paidAmount}</td>
                            <td data-label="Balance" style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                              ₹{balance}
                            </td>
                            <td data-label="Registered Branch">
                              <span className="badge" style={{ background: 'rgba(168, 206, 58, 0.1)', color: 'var(--accent-color)' }}>
                                {getMemberBranchName(member)}
                              </span>
                            </td>
                            <td data-label="Status">
                              <span className={`badge ${isActive ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>
                                {isActive ? 'ACTIVE' : 'EXPIRED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <RevenueAnalysis />
        )}

        {activeTab === 'revenue' && (
          <HRTotalRevenue />
        )}
        {activeTab === 'average-revenue' && (() => {
          // Compute Average Bill per Patient (Total Revenue / Total Patients)
          const branchStats = {};

          // Initialize official branches
          branches.forEach(b => {
            branchStats[b.name] = { total: 0, patientIds: new Set() };
          });

          allHistoryTransactions.forEach(tx => {
            // Only process paid transactions with positive amount
            if (tx.status !== 'PAID') return;
            const amt = Number(tx.amount) || 0;
            if (amt <= 0) return;

            let br = tx.branch ? tx.branch.trim() : '';

            // Attempt to normalize branch name against official branches
            if (branches.length > 0) {
              let matched = branches.find(b => b.name.toLowerCase() === br.toLowerCase());
              if (!matched) {
                // substring match to catch "Branch 1" vs "branch 1" or "Kukatpally Branch" vs "Kukatpally"
                matched = branches.find(b => br.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(br.toLowerCase()));
              }
              if (matched) {
                br = matched.name;
              } else if (br === 'Main Branch' || br === 'Main' || !br) {
                br = branches[0].name;
              }
            } else {
              br = br || 'Main Branch';
            }

            if (!branchStats[br]) {
              branchStats[br] = { total: 0, patientIds: new Set() };
            }
            
            branchStats[br].total += amt;

            // Generate a robust unique identifier for the patient to avoid double counting
            let patientKey = '';
            const cleanPhone = tx.phone ? tx.phone.replace(/\D/g, '').slice(-10) : '';
            const regId = tx.regId && tx.regId !== '-' && tx.regId !== 'N/A' ? tx.regId.trim() : '';

            if (cleanPhone && cleanPhone.length === 10) {
              patientKey = cleanPhone;
            } else if (regId) {
              patientKey = regId;
            } else if (tx.patientName && tx.patientName !== '-') {
              patientKey = tx.patientName.trim().toLowerCase();
            } else {
              patientKey = tx.id || Math.random().toString();
            }

            if (patientKey) {
              branchStats[br].patientIds.add(patientKey);
            }
          });

          return (
            <div className="tab-content fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 className="tab-title">Average Revenue</h2>
                  <p className="tab-subtitle">Branch-wise average bill per patient.</p>
                </div>
              </div>

              {/* Added Global Filters for Average Revenue */}
              {renderRevenueFilters(true)}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

                {/* Section 1: Average Bill per Patient */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={20} color="var(--primary-color)" />
                    Branch-wise Average Bill per Patient
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '16px', paddingLeft: '28px' }}>
                    Average Bill per Patient = Total Revenue / Total Patients
                  </p>
                  <div className="table-container glass-panel" style={{ margin: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Branch</th>
                          <th style={{ textAlign: 'center' }}>Total Patients</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue</th>
                          <th style={{ textAlign: 'right' }}>Average Bill per Patient</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(branchStats).filter(([br]) => branches.some(b => b.name === br)).length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No data available</td></tr>
                        ) : (
                          Object.entries(branchStats)
                            .filter(([br]) => branches.some(b => b.name === br))
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([br, data]) => {
                              const totalPatients = data.patientIds.size;
                              const avg = totalPatients > 0 ? (data.total / totalPatients).toFixed(2) : 0;
                              return (
                                <tr key={br}>
                                  <td style={{ fontWeight: 500 }}>{br}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalPatients}</td>
                                  <td style={{ textAlign: 'right' }}>₹{data.total.toLocaleString('en-IN')}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                    {totalPatients > 0 ? `₹${Number(avg).toLocaleString('en-IN')}` : 'N/A'}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2: Formula Explanation Block */}
                <div className="glass-panel" style={{ padding: '20px', marginTop: '12px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Calculation Formula Explanation
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <p style={{ margin: '0 0 16px 0' }}>
                      <strong>Average Bill per Patient Formula:</strong>
                      <br />
                      This represents the average value of billing collected per unique registered patient at each branch.
                      <br />
                      <span style={{ fontFamily: 'monospace', display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', marginTop: '6px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        Average Bill per Patient = Total Revenue / Total Patients
                      </span>
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Average Monthly Revenue Formula (Reference):</strong>
                      <br />
                      This represents the revenue distributed across months of treatment (e.g. Month 1 Revenue + Month 2 Revenue divided by total active months).
                      <br />
                      <span style={{ fontFamily: 'monospace', display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', marginTop: '6px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        Average Monthly Revenue = (Month 1 Revenue + Month 2 Revenue + ...) / Total Active Months
                      </span>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {activeTab === 'nutrition-revenue' && (() => {
          // Filter nutrition plans
          const filteredTxs = nutritionPlans.filter(p => {
            if (p.paymentStatus !== 'paid') return false;

            const qLower = nutritionSearch.toLowerCase().trim();
            const matchesSearch = !qLower ||
              (p.patientName && p.patientName.toLowerCase().includes(qLower)) ||
              (p.patientPhone && p.patientPhone.includes(qLower)) ||
              (p.doctorName && p.doctorName.toLowerCase().includes(qLower));

            const matchesBranch = nutritionBranchId === 'all' || p.branchId === nutritionBranchId;

            let matchesDateRange = true;
            let rawDateStr = p.paymentCollectedAt || p.createdAt;
            if (rawDateStr) {
              let d = null;
              if (rawDateStr.seconds) {
                d = new Date(rawDateStr.seconds * 1000);
              } else if (rawDateStr.toDate) {
                d = rawDateStr.toDate();
              } else {
                d = new Date(rawDateStr);
              }

              if (d && !isNaN(d.getTime())) {
                if (nutritionDate) {
                  const filterDate = new Date(nutritionDate);
                  d.setHours(0, 0, 0, 0);
                  filterDate.setHours(0, 0, 0, 0);
                  if (d.getTime() !== filterDate.getTime()) matchesDateRange = false;
                } else if (nutritionYear !== 'all') {
                  if (d.getFullYear() !== parseInt(nutritionYear, 10)) {
                    matchesDateRange = false;
                  } else if (nutritionMonth !== 'all') {
                    if (d.getMonth() + 1 !== parseInt(nutritionMonth, 10)) {
                      matchesDateRange = false;
                    }
                  }
                }
              } else {
                if (nutritionDate || nutritionYear !== 'all') matchesDateRange = false;
              }
            } else {
              if (nutritionDate || nutritionYear !== 'all') matchesDateRange = false;
            }

            return matchesSearch && matchesBranch && matchesDateRange;
          });

          // Metrics
          const totalRevenue = filteredTxs.reduce((sum, p) => sum + Number(p.amountPaid || p.amount || 0), 0);
          const todayStr = new Date().toISOString().split('T')[0];
          const activePlans = filteredTxs.filter(p => (p.expiryDate || '') >= todayStr).length;
          const expiredPlans = filteredTxs.filter(p => (p.expiryDate || '') < todayStr).length;

          return (
            <div className="fade-in">
              <div className="flex-between" style={{ marginBottom: '32px' }}>
                <div>
                  <h2>Nutrition & Diet Revenue Dashboard</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Track collections and active subscription metrics for customized diet plans</p>
                </div>
              </div>

              {/* Stats KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Total Nutrition Revenue</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>₹{totalRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Active Diet Plans</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6' }}>{activePlans}</span>
                </div>
                <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Expired Plans</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{expiredPlans}</span>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Filter Nutrition Logs</h4>
                  <button onClick={handleResetNutritionFilters} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Reset Filters
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Patient / Doctor</label>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Name or phone..."
                      value={nutritionSearch}
                      onChange={(e) => setNutritionSearch(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Branch</label>
                    <select
                      className="glass-input"
                      value={nutritionBranchId}
                      onChange={(e) => setNutritionBranchId(e.target.value)}
                      style={{ background: 'var(--bg-dark)' }}
                    >
                      <option value="all">All Branches</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Specific Date</label>
                    <input
                      type="date"
                      className="glass-input"
                      value={nutritionDate}
                      onChange={(e) => {
                        setNutritionDate(e.target.value);
                        setNutritionYear('all');
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Year</label>
                    <select
                      className="glass-input"
                      value={nutritionYear}
                      onChange={(e) => {
                        setNutritionYear(e.target.value);
                        setNutritionDate('');
                      }}
                      style={{ background: 'var(--bg-dark)' }}
                    >
                      <option value="all">All Years</option>
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Month</label>
                    <select
                      className="glass-input"
                      value={nutritionMonth}
                      onChange={(e) => setNutritionMonth(e.target.value)}
                      disabled={nutritionYear === 'all'}
                      style={{ background: 'var(--bg-dark)' }}
                    >
                      <option value="all">All Months</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString('en', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="table-container glass-panel">
                <table>
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Patient Name</th>
                      <th>Phone</th>
                      <th>Prescribing Doctor</th>
                      <th>Branch</th>
                      <th>Amount Paid</th>
                      <th>Start Date</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                          No nutrition revenue records found.
                        </td>
                      </tr>
                    ) : (
                      filteredTxs.map((plan, index) => {
                        const isExpired = (plan.expiryDate || '') < todayStr;
                        return (
                          <tr key={plan.id}>
                            <td>{index + 1}</td>
                            <td style={{ fontWeight: 600 }}>{plan.patientName}</td>
                            <td>{plan.patientPhone}</td>
                            <td>{plan.doctorName}</td>
                            <td>{plan.branchName}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>₹{plan.amountPaid || plan.amount || 500}</td>
                            <td>{plan.startDate}</td>
                            <td>{plan.expiryDate}</td>
                            <td>
                              <span className="badge" style={{
                                background: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: isExpired ? '#ef4444' : '#10b981'
                              }}>
                                {isExpired ? 'EXPIRED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  borderColor: 'var(--primary-color)',
                                  color: 'var(--primary-color)',
                                  borderRadius: '6px'
                                }}
                                onClick={() => setSelectedViewPlan(plan)}
                              >
                                <Eye size={12} /> View Diet Grid
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}


        {
          activeTab === 'banners' && (
            <div className="fade-in">
              <div className="flex-between" style={{ marginBottom: '32px' }}>
                <div>
                  <h2>Banner Management Dashboard</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Upload, preview, and delete patient-app promotional banners</p>
                </div>
              </div>

              {/* Main Form and Presets Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '40px' }}>

                {/* Form panel */}
                <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Publish / Update Banner</h3>

                  <form onSubmit={handlePublishBanner} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Target Page</label>
                      <select
                        className="glass-input"
                        value={bannerForm.id}
                        onChange={(e) => setBannerForm({ ...bannerForm, id: e.target.value })}
                        style={{ background: 'var(--bg-dark)' }}
                      >
                        <option value="home">Main Home Banner (Ratio 350:160)</option>
                        <option value="doctors">Doctors List Banner (Ratio 350:120)</option>
                        <option value="booking">Booking Page Banner (Ratio 350:120)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Upload Banner Image File</label>
                      <div style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                        />
                        <FileImage size={32} style={{ color: 'var(--primary-color)' }} />
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                          {bannerForm.imageUrl ? '✓ Image Loaded (Click to Change)' : 'Click or Drag & Drop Image Here'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Supports JPG, PNG, JPEG (Max 2MB)
                        </div>
                      </div>
                    </div>

                    {bannerForm.imageUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="form-label">Selected Image Preview</label>
                        <div style={{
                          borderRadius: '8px',
                          overflow: 'hidden',
                          aspectRatio: bannerForm.id === 'home' ? '35/16' : '35/12',
                          border: '1px solid var(--border-color)'
                        }}>
                          <img src={bannerForm.imageUrl} alt="Uploaded preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }} disabled={isUpdatingBanner}>
                      {isUpdatingBanner ? 'Publishing...' : 'Publish Live Banner'}
                    </button>
                  </form>
                </div>

                {/* Quick Presets panel */}
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>Curated Banner Presets</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Click any template below to select it instantly, then hit publish.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {[
                      { name: 'Chronic Disease Camp', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800' },
                      { name: 'Immunology Campaign', url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=800' },
                      { name: 'Holistic Wellness', url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800' },
                      { name: 'Modern SPH Clinic', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800' }
                    ].map((p, i) => (
                      <div
                        key={i}
                        onClick={() => setBannerForm({ ...bannerForm, imageUrl: p.url })}
                        style={{
                          border: bannerForm.imageUrl === p.url ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: 'var(--bg-dark)'
                        }}
                      >
                        <img src={p.url} alt={p.name} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                        <div style={{ padding: '8px', fontSize: '11px', fontWeight: '600', color: 'var(--text-main)', textAlign: 'center' }}>{p.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Current Live Banners Listing */}
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px' }}>Active Live Banners</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {['home', 'doctors', 'booking'].map(id => {
                  const banner = bannersList.find(b => b.id === id);
                  const titleMap = {
                    home: 'Main Home Page Banner',
                    doctors: 'Doctors Page Banner',
                    booking: 'Booking Selection Banner'
                  };
                  const sizeMap = {
                    home: 'Aspect Ratio 35:16 (350x160 px)',
                    doctors: 'Aspect Ratio 35:12 (350x120 px)',
                    booking: 'Aspect Ratio 35:12 (350x120 px)'
                  };

                  return (
                    <div key={id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="flex-between">
                        <div>
                          <h4 style={{ fontWeight: '700', color: 'var(--text-main)' }}>{titleMap[id]}</h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sizeMap[id]}</span>
                        </div>
                        {banner && (
                          <button
                            className="btn-secondary"
                            style={{ color: 'var(--danger)', border: 'none', padding: '6px' }}
                            onClick={() => handleDeleteBanner(id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>

                      <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: 'rgba(0,0,0,0.1)',
                        aspectRatio: id === 'home' ? '35/16' : '35/12',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)'
                      }}>
                        {banner ? (
                          <img src={banner.imageUrl} alt={id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <FileImage size={24} />
                            <span>No published banner (Using default asset)</span>
                          </div>
                        )}
                      </div>

                      {banner && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div><strong>Last Updated:</strong> {new Date(banner.updatedAt).toLocaleString()}</div>
                          <div><strong>Updated By:</strong> {banner.updatedBy}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        }

        {
          activeTab === 'staff' && (
            <div className="fade-in">
              <div className="flex-between" style={{ marginBottom: '32px' }}>
                <div>
                  <h2>Staff Management</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Authorize doctors and staff for mobile app access</p>
                </div>
                <button className="btn-primary" onClick={() => setShowAddStaff(true)}>
                  <Plus size={20} /> Add Staff Member
                </button>
              </div>

              <div className="table-container glass-panel">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Branch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffMembers.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No staff members found.</td>
                      </tr>
                    ) : (
                      staffMembers.map(member => (
                        <tr key={member.id}>
                          <td data-label="Name" style={{ fontWeight: 500 }}>{member.name}</td>
                          <td data-label="Role">
                            <span className={`badge ${member.role === 'doctor' ? 'badge-primary' : 'badge-secondary'}`} style={{ textTransform: 'capitalize' }}>
                              {member.role}
                            </span>
                          </td>
                          <td data-label="Phone">{member.phone}</td>
                          <td data-label="Branch">{member.branchName}</td>
                          <td data-label="Actions">
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '6px' }}
                                onClick={() => openStaffModal(member)}
                                title="Edit Staff"
                              >
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Edit</span>
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ color: 'var(--danger)', padding: '6px' }}
                                onClick={() => handleDeleteStaff(member.id)}
                                title="Remove Staff"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        {
          activeTab === 'doctor-timings' && (
            <DoctorTimingsManager />
          )
        }

        {
          activeTab === 'rewards' && (
            <div className="fade-in">
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div>
                  <h2>Rewards & Coupons Manager</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Monitor customer loyalty wallets, points outstanding, and active/used coupon codes globally</p>
                </div>
                <button className="btn-primary" onClick={fetchRewardsData} disabled={rewardsLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCw size={16} className={rewardsLoading ? "spin" : ""} /> Refresh Data
                </button>
              </div>

              {rewardsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Loading rewards data...</p>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--primary-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Users with Wallets</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                        {patients.filter(p => (p.rewardPoints || 0) > 0).length}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Available points active</span>
                    </div>
                    <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Total Available Points</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                        {patients.reduce((sum, p) => sum + (p.rewardPoints || 0), 0)} pts
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>₹100 paid = 2 points earned</span>
                    </div>
                    <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Total Redeemed Points</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                        {rewardTransactions.filter(t => t.type === 'redeem').reduce((sum, t) => sum + (t.points || 0), 0)} pts
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Redeemed at reception</span>
                    </div>
                    <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #a8ce3a', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Active Coupons</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a8ce3a' }}>
                        {couponsList.filter(c => c.status === 'active').length}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Generated from bookings</span>
                    </div>
                    <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Redeemed Coupons</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>
                        {couponsList.filter(c => c.status === 'redeemed').length}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Applied to product invoices</span>
                    </div>
                  </div>

                  {/* Sub Tab Switcher */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <button
                      className={`btn-tab ${rewardsSubTab === 'wallets' ? 'active' : ''}`}
                      onClick={() => setRewardsSubTab('wallets')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: rewardsSubTab === 'wallets' ? 'var(--primary-color)' : 'transparent', color: rewardsSubTab === 'wallets' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                    >
                      Patient Loyalty Wallets
                    </button>
                    <button
                      className={`btn-tab ${rewardsSubTab === 'active_coupons' ? 'active' : ''}`}
                      onClick={() => setRewardsSubTab('active_coupons')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: rewardsSubTab === 'active_coupons' ? 'var(--primary-color)' : 'transparent', color: rewardsSubTab === 'active_coupons' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                    >
                      Active Coupons ({couponsList.filter(c => c.status === 'active').length})
                    </button>
                    <button
                      className={`btn-tab ${rewardsSubTab === 'redeemed_coupons' ? 'active' : ''}`}
                      onClick={() => setRewardsSubTab('redeemed_coupons')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: rewardsSubTab === 'redeemed_coupons' ? 'var(--primary-color)' : 'transparent', color: rewardsSubTab === 'redeemed_coupons' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                    >
                      Redeemed Coupons ({couponsList.filter(c => c.status === 'redeemed').length})
                    </button>
                  </div>

                  {/* Patient Wallets Sub Tab */}
                  {rewardsSubTab === 'wallets' && (
                    <div className="table-container glass-panel">
                      <table>
                        <thead>
                          <tr>
                            <th>Patient Name</th>
                            <th>Phone Number</th>
                            <th>Registered Branch</th>
                            <th>Available Points Balance</th>
                            <th>Equivalent Cash (₹)</th>
                            <th>Total Points Used/Redeemed</th>
                            <th>Active Date</th>
                            <th>End Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patients.filter(p => (p.rewardPoints || 0) > 0 || rewardTransactions.some(t => t.userId === p.id && t.type === 'redeem')).length === 0 ? (
                            <tr>
                              <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No active patient wallet profiles found.</td>
                            </tr>
                          ) : (
                            patients
                              .filter(p => (p.rewardPoints || 0) > 0 || rewardTransactions.some(t => t.userId === p.id && t.type === 'redeem'))
                              .map(p => {
                                const pointsRedeemedSum = rewardTransactions
                                  .filter(t => t.userId === p.id && t.type === 'redeem')
                                  .reduce((sum, t) => sum + (t.points || 0), 0);

                                let displayName = (p.fullName && p.fullName !== 'Patient') ? p.fullName : (p.name || '');
                                let displayPhone = (p.phone && p.phone !== 'N/A') ? p.phone : '';
                                let displayBranch = (p.branchName && p.branchName !== 'Unknown') ? p.branchName : '';

                                // Fallback 1: Check coupons for this user
                                if (!displayName || !displayPhone) {
                                  const matchingCoupon = couponsList.find(c => c.userId === p.id && c.patientName && c.patientName !== 'Patient' && c.patientPhone && c.patientPhone !== 'N/A');
                                  if (matchingCoupon) {
                                    if (!displayName) displayName = matchingCoupon.patientName;
                                    if (!displayPhone) displayPhone = matchingCoupon.patientPhone;
                                    if (!displayBranch && matchingCoupon.branchName) displayBranch = matchingCoupon.branchName;
                                  }
                                }

                                // Fallback 2: Check appointments by patientId
                                if (!displayName || !displayPhone) {
                                  const matchingAppt = appointmentsList.find(a => a.patientId === p.id && (a.patientName || a.fullName) && (a.patientName || a.fullName) !== 'Patient');
                                  if (matchingAppt) {
                                    if (!displayName) displayName = matchingAppt.patientName || matchingAppt.fullName;
                                    if (!displayPhone) displayPhone = matchingAppt.phone || matchingAppt.patientPhone || '';
                                    if (!displayBranch && matchingAppt.branchName) displayBranch = matchingAppt.branchName;
                                  }
                                }

                                // Fallback 3: Check patients collection by matching phone
                                if (!displayPhone && p.phone) displayPhone = p.phone;

                                // Active Date: earliest 'earn' transaction for this patient
                                const earnTransactions = rewardTransactions
                                  .filter(t => t.userId === p.id && t.type === 'earn' && t.createdAt);
                                let activeDate = 'N/A';
                                if (earnTransactions.length > 0) {
                                  const earliest = earnTransactions.reduce((min, t) => {
                                    const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
                                    const minDate = min?.toDate ? min.toDate() : new Date(min);
                                    return tDate < minDate ? t.createdAt : min;
                                  }, earnTransactions[0].createdAt);
                                  activeDate = safeDateDisplay(earliest);
                                } else if (p.createdAt) {
                                  activeDate = safeDateDisplay(p.createdAt);
                                }

                                // End Date: latest coupon expiry for this patient
                                const patientCoupons = couponsList.filter(c => c.userId === p.id && c.status === 'active');
                                let endDate = 'N/A';
                                if (patientCoupons.length > 0) {
                                  const latestExpiry = patientCoupons.reduce((max, c) => {
                                    const cExpiry = c.expiryDate?.toDate ? c.expiryDate.toDate() : new Date(c.expiryDateStr || c.expiryDate);
                                    const maxDate = max ? (max.toDate ? max.toDate() : new Date(max)) : new Date(0);
                                    return cExpiry > maxDate ? (c.expiryDateStr || c.expiryDate) : max;
                                  }, null);
                                  if (latestExpiry) {
                                    const d = latestExpiry?.toDate ? latestExpiry.toDate() : new Date(latestExpiry);
                                    endDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : 'N/A';
                                  }
                                }

                                return (
                                  <tr key={p.id}>
                                    <td style={{ fontWeight: '600' }}>{displayName || 'N/A'}</td>
                                    <td>{displayPhone || 'N/A'}</td>
                                    <td>
                                      <span className="badge" style={{ background: 'rgba(37, 142, 200, 0.1)', color: '#0ea5e9' }}>
                                        {displayBranch || 'Unknown'}
                                      </span>
                                    </td>
                                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{p.rewardPoints || 0} pts</td>
                                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{((p.rewardPoints || 0) / 50).toFixed(2)}</td>
                                    <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{pointsRedeemedSum} pts</td>
                                    <td>
                                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                        {activeDate}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                        {endDate}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Active Coupons Sub Tab */}
                  {rewardsSubTab === 'active_coupons' && (
                    <div className="table-container glass-panel">
                      <table>
                        <thead>
                          <tr>
                            <th>Coupon Code</th>
                            <th>Patient Name</th>
                            <th>Patient Phone</th>
                            <th>Discount Value (₹)</th>
                            <th>Created At</th>
                            <th>Expiry Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {couponsList.filter(c => c.status === 'active').length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No active coupons found in system.</td>
                            </tr>
                          ) : (
                            couponsList
                              .filter(c => c.status === 'active')
                              .map(c => {
                                const patientMatch = c.userId ? patientIndex.byId.get(String(c.userId)) : null;
                                let displayName = (patientMatch && patientMatch.fullName && patientMatch.fullName !== 'Patient') ? patientMatch.fullName : '';
                                let displayPhone = (patientMatch && patientMatch.phone && patientMatch.phone !== 'N/A') ? patientMatch.phone : '';

                                // Fallback 1: coupon's own stored fields
                                if (!displayName && c.patientName && c.patientName !== 'Patient') displayName = c.patientName;
                                if (!displayPhone && c.patientPhone && c.patientPhone !== 'N/A') displayPhone = c.patientPhone;

                                // Fallback 2: other coupons for same userId
                                if (!displayName || !displayPhone) {
                                  const otherCoupon = couponsList.find(oc => oc.id !== c.id && oc.userId === c.userId && oc.patientName && oc.patientName !== 'Patient' && oc.patientPhone && oc.patientPhone !== 'N/A');
                                  if (otherCoupon) {
                                    if (!displayName) displayName = otherCoupon.patientName;
                                    if (!displayPhone) displayPhone = otherCoupon.patientPhone;
                                  }
                                }

                                // Fallback 3: appointments for same patientId
                                if (!displayName || !displayPhone) {
                                  const matchingAppt = appointmentsList.find(a => a.patientId === c.userId && (a.patientName || a.fullName) && (a.patientName || a.fullName) !== 'Patient');
                                  if (matchingAppt) {
                                    if (!displayName) displayName = matchingAppt.patientName || matchingAppt.fullName;
                                    if (!displayPhone) displayPhone = matchingAppt.phone || matchingAppt.patientPhone || '';
                                  }
                                }

                                return (
                                  <tr key={c.id}>
                                    <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{c.code}</td>
                                    <td style={{ fontWeight: '500' }}>{displayName || 'N/A'}</td>
                                    <td>{displayPhone || 'N/A'}</td>
                                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{c.pointsValue}</td>
                                    <td>{c.createdAt ? safeDateDisplay(c.createdAt) : 'N/A'}</td>
                                    <td>
                                      <span className="badge badge-secondary">
                                        {c.expiryDateStr ? new Date(c.expiryDateStr).toLocaleDateString('en-GB') : 'N/A'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Redeemed Coupons Sub Tab */}
                  {rewardsSubTab === 'redeemed_coupons' && (
                    <div className="table-container glass-panel">
                      <table>
                        <thead>
                          <tr>
                            <th>Coupon Code</th>
                            <th>Patient Name</th>
                            <th>Patient Phone</th>
                            <th>Discount Value (₹)</th>
                            <th>Redeemed Invoice No.</th>
                            <th>Redeemed Date / Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {couponsList.filter(c => c.status === 'redeemed').length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No redeemed coupons found.</td>
                            </tr>
                          ) : (
                            couponsList
                              .filter(c => c.status === 'redeemed')
                              .map(c => {
                                const patientMatch = c.userId ? patientIndex.byId.get(String(c.userId)) : null;
                                let displayName = (patientMatch && patientMatch.fullName && patientMatch.fullName !== 'Patient') ? patientMatch.fullName : '';
                                let displayPhone = (patientMatch && patientMatch.phone && patientMatch.phone !== 'N/A') ? patientMatch.phone : '';

                                // Fallback 1: coupon's own stored fields
                                if (!displayName && c.patientName && c.patientName !== 'Patient') displayName = c.patientName;
                                if (!displayPhone && c.patientPhone && c.patientPhone !== 'N/A') displayPhone = c.patientPhone;

                                // Fallback 2: other coupons for same userId
                                if (!displayName || !displayPhone) {
                                  const otherCoupon = couponsList.find(oc => oc.id !== c.id && oc.userId === c.userId && oc.patientName && oc.patientName !== 'Patient' && oc.patientPhone && oc.patientPhone !== 'N/A');
                                  if (otherCoupon) {
                                    if (!displayName) displayName = otherCoupon.patientName;
                                    if (!displayPhone) displayPhone = otherCoupon.patientPhone;
                                  }
                                }

                                // Fallback 3: appointments for same patientId
                                if (!displayName || !displayPhone) {
                                  const matchingAppt = appointmentsList.find(a => a.patientId === c.userId && (a.patientName || a.fullName) && (a.patientName || a.fullName) !== 'Patient');
                                  if (matchingAppt) {
                                    if (!displayName) displayName = matchingAppt.patientName || matchingAppt.fullName;
                                    if (!displayPhone) displayPhone = matchingAppt.phone || matchingAppt.patientPhone || '';
                                  }
                                }

                                return (
                                  <tr key={c.id}>
                                    <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{c.code}</td>
                                    <td style={{ fontWeight: '500' }}>{displayName || 'N/A'}</td>
                                    <td>{displayPhone || 'N/A'}</td>
                                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{c.pointsValue}</td>
                                    <td>
                                      <span className="badge badge-primary">
                                        {c.redeemedInvoiceNum || 'N/A'}
                                      </span>
                                    </td>
                                    <td>{c.redeemedAt ? safeDateDisplay(c.redeemedAt) : (c.createdAt ? safeDateDisplay(c.createdAt) : 'N/A')}</td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        }
      </main >

      {/* Add Branch Modal */}
      {
        showAddBranch && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content">
              <h3 style={{ marginBottom: '24px' }}>Create New Branch</h3>
              <form onSubmit={handleCreateBranch}>
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    required
                    placeholder="e.g. Branch 1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={newBranchUsername}
                    onChange={(e) => setNewBranchUsername(e.target.value)}
                    required
                    placeholder="e.g. branchadmin"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="glass-input"
                      value={newBranchPassword}
                      onChange={(e) => setNewBranchPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength="6"
                      style={{ paddingRight: '48px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: '32px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddBranch(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        selectedBranch && branchEditData && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content" style={{ maxWidth: '700px', width: '95%' }}>
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div>
                  <h3>Branch Login Details</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Edit branch name or view login information on the same page.</p>
                </div>
                <button className="btn-secondary" style={{ padding: '8px' }} onClick={closeBranchModal}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={branchEditData.name}
                    onChange={(e) => setBranchEditData({ ...branchEditData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={branchEditData.username || ''}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="glass-input"
                    value={branchEditData.email || ''}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Created At</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={new Date(branchEditData.createdAt).toLocaleDateString()}
                    readOnly
                  />
                </div>
              </div>
              <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: '32px' }}>
                <button type="button" className="btn-secondary" onClick={closeBranchModal}>Close</button>
                <button type="button" className="btn-primary" onClick={handleUpdateBranch} disabled={isUpdatingBranch}>
                  {isUpdatingBranch ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Patient Detail Modal */}
      {
        selectedPatient && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content" style={{ maxWidth: '900px', width: '95%' }}>
              <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--primary-color)', color: 'white', padding: '10px', borderRadius: '12px' }}>
                    <User size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedPatient.fullName}</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>REG: {selectedPatient.registrationId || 'N/A'}</span>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>ID: {selectedPatient.id}</p>
                    </div>
                  </div>
                </div>
                <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => setSelectedPatient(null)}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
                {/* Left Column: Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.3)' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--primary-color)' }}>Contact Information</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <Phone size={16} color="var(--text-muted)" />
                        <span>{selectedPatient.phone}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <Mail size={16} color="var(--text-muted)" />
                        <span>{selectedPatient.email || 'No Email'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <Building2 size={16} color="var(--text-muted)" />
                        <span>{selectedPatient.branchName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <Coins size={16} color="#f59e0b" />
                        <span style={{ fontWeight: 'bold', color: '#b45309' }}>Reward Points: {selectedPatient.rewardPoints || 0} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.3)' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--accent-color)' }}>Visit Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <span>
                          {getSafeDisplayDate(selectedPatient.appointmentDate)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <User size={16} color="var(--text-muted)" />
                        <span>Dr. {selectedPatient.doctor ? selectedPatient.doctor.replace(/^(?:dr\.?|doctor)\s*/i, '') : 'Physician'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <MapPin size={16} color="var(--text-muted)" />
                        <span>Source: {selectedPatient.source}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(37, 142, 200, 0.05)' }}>
                    <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Consultation Subject</h4>
                    <p style={{ margin: 0, fontWeight: 500 }}>{selectedPatient.subject}</p>
                  </div>
                </div>

                {/* Right Column: History & Prescriptions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Visit History Section */}
                  <div>
                    <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={20} color="var(--primary-color)" />
                      Visit History ({selectedPatientHistory.length})
                    </h4>
                    <div className="table-container glass-panel" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Doctor</th>
                            <th>Branch</th>
                            <th>Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingHistory ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                                <RefreshCw className="spin" size={16} style={{ marginRight: '8px', display: 'inline-block' }} /> Loading history...
                              </td>
                            </tr>
                          ) : selectedPatientHistory.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                No history found.
                              </td>
                            </tr>
                          ) : (
                            selectedPatientHistory.map((visit) => (
                              <tr
                                key={visit.id}
                                style={{
                                  background: visit.id === selectedPatient.id ? 'rgba(37, 142, 200, 0.1)' : '',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setSelectedPatient(visit)}
                              >
                                <td>
                                  {visit.sourceCollection === 'patients' ? (
                                    visit.createdAt
                                      ? (visit.createdAt.toDate ? visit.createdAt.toDate().toLocaleDateString('en-IN') : new Date(visit.createdAt).toLocaleDateString('en-IN'))
                                      : (visit.appointmentDate ? getSafeDisplayDate(visit.appointmentDate) : 'N/A')
                                  ) : (
                                    visit.appointmentDate
                                      ? getSafeDisplayDate(visit.appointmentDate)
                                      : (visit.createdAt ? (visit.createdAt.toDate ? visit.createdAt.toDate().toLocaleDateString('en-IN') : new Date(visit.createdAt).toLocaleDateString('en-IN')) : 'N/A')
                                  )}
                                </td>
                                <td>{visit.doctor || 'N/A'}</td>
                                <td>{visit.branchName || 'N/A'}</td>
                                <td>{visit.prescriptionUrls?.length || 0}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileImage size={20} color="var(--primary-color)" />
                      Prescriptions for this Visit ({selectedPatient.prescriptionUrls?.length || 0})
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                      {selectedPatient.prescriptionUrls && selectedPatient.prescriptionUrls.length > 0 ? (
                        selectedPatient.prescriptionUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn-secondary"
                            style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', height: '150px', width: '100%' }}
                            onClick={() => setImageViewer({ open: true, urls: selectedPatient.prescriptionUrls || [], currentIndex: idx, zoom: 1, rotate: 0 })}
                          >
                            <img
                              src={url}
                              alt={`Prescription ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                            />
                          </button>
                        ))
                      ) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No images uploaded for this visit.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        imageViewer.open && (
          <div className="modal-overlay" onClick={() => setImageViewer({ open: false, urls: [], currentIndex: 0, zoom: 1, rotate: 0 })}>
            <div className="glass-panel modal-content" style={{ maxWidth: '900px', width: '90%', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0 }}>Prescription Viewer</h3>
                  {imageViewer.urls.length > 0 && (
                    <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '12.5px', fontWeight: 'bold' }}>
                      {imageViewer.currentIndex + 1} of {imageViewer.urls.length}
                    </span>
                  )}
                </div>
                <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => setImageViewer({ open: false, urls: [], currentIndex: 0, zoom: 1, rotate: 0 })}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '100%', maxHeight: '70vh', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {imageViewer.urls.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setImageViewer(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.urls.length) % prev.urls.length, zoom: 1, rotate: 0 }))}
                        style={{
                          position: 'absolute',
                          left: '16px',
                          background: 'rgba(255, 255, 255, 0.85)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '44px',
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                          zIndex: 10,
                          color: 'var(--text-main)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.85)'}
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageViewer(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.urls.length, zoom: 1, rotate: 0 }))}
                        style={{
                          position: 'absolute',
                          right: '16px',
                          background: 'rgba(255, 255, 255, 0.85)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '44px',
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                          zIndex: 10,
                          color: 'var(--text-main)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.85)'}
                      >
                        <ChevronRight size={24} />
                      </button>
                    </>
                  )}
                  <img
                    src={imageViewer.urls[imageViewer.currentIndex]}
                    alt="Prescription"
                    style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', transform: `scale(${imageViewer.zoom}) rotate(${imageViewer.rotate}deg)`, transition: 'transform 0.2s ease', transformOrigin: 'center center' }}
                  />
                  <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.35, color: 'white', fontWeight: 700, letterSpacing: '0.06em', transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 'bold' }}>SPIRITUAL HOMEOPATHY</span>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>SPIRITUAL HOMEOPATHY</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" className="btn-secondary" onClick={() => setImageViewer(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, 3) }))}>
                    <ZoomIn size={18} /> Zoom In
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setImageViewer(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, 0.6) }))}>
                    <ZoomOut size={18} /> Zoom Out
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setImageViewer(prev => ({ ...prev, rotate: prev.rotate - 90 }))}>
                    <RotateCcw size={18} /> Rotate Left
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setImageViewer(prev => ({ ...prev, rotate: prev.rotate + 90 }))}>
                    <RotateCw size={18} /> Rotate Right
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Staff Modal */}
      {
        showAddStaff && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
              <h3 style={{ marginBottom: '24px' }}>Authorize Staff Member</h3>
              <form onSubmit={handleCreateStaff}>
                {/* 1. Role Selection */}
                <div className="form-group">
                  <label className="form-label">Assign Staff Role</label>
                  <select
                    className="glass-input"
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    style={{ background: 'var(--bg-dark)' }}
                  >
                    <option value="staff">Regular Staff</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="doctor">Doctor</option>
                    <option value="hr">HR Manager</option>
                  </select>
                </div>

                {/* 2. Doctor Category (only if role is Doctor) */}
                {newStaff.role === 'doctor' && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Doctor Category</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        className={newStaff.doctorType === 'head' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1 }}
                        onClick={() => setNewStaff({ ...newStaff, doctorType: 'head' })}
                      >
                        Head Doctor
                      </button>
                      <button
                        type="button"
                        className={newStaff.doctorType === 'employee' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1 }}
                        onClick={() => setNewStaff({ ...newStaff, doctorType: 'employee' })}
                      >
                        Employee Doctor
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Personal Details */}
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    required
                    placeholder={newStaff.role === 'doctor' ? 'e.g. Dr. John Doe' : 'e.g. John Doe'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number (without +91)</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    required
                    placeholder="e.g. 9876543210"
                    pattern="[0-9]{10}"
                    title="Please enter a 10-digit mobile number"
                  />
                </div>

                {['staff', 'hr'].includes(newStaff.role) && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Email ID</label>
                      <input
                        type="email"
                        className="glass-input"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                        required
                        placeholder="e.g. staff@sph.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showStaffPassword ? 'text' : 'password'}
                          className="glass-input"
                          value={newStaff.password}
                          onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                          required
                          placeholder="••••••••"
                          minLength="6"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowStaffPassword(!showStaffPassword)}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. Branch Assignment (Only for Regular Staff or Receptionist) */}
                {['staff', 'receptionist'].includes(newStaff.role) && (
                  <div className="form-group">
                    <label className="form-label">Assign to Branch</label>
                    <select
                      className="glass-input"
                      value={newStaff.branchId}
                      onChange={(e) => setNewStaff({ ...newStaff, branchId: e.target.value })}
                      required
                      style={{ background: 'var(--bg-dark)' }}
                    >
                      <option value="">Select a Branch</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 5. Salary & Work Schedule (Only for Regular Staff or Employee Doctor) */}
                {(newStaff.role === 'staff' || (newStaff.role === 'doctor' && newStaff.doctorType === 'employee')) && (
                  <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salary &amp; Work Schedule</p>
                    <div className="form-group">
                      <label className="form-label">Monthly Base Salary (Rs)</label>
                      <input
                        type="number"
                        className="glass-input"
                        value={newStaff.salary}
                        onChange={(e) => setNewStaff({ ...newStaff, salary: e.target.value })}
                        required
                        placeholder="e.g. 25000"
                        min="0"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Shift Type</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          className={newStaff.shiftType === 'single' || !newStaff.shiftType ? 'btn-primary' : 'btn-secondary'}
                          style={{ flex: 1, padding: '6px' }}
                          onClick={() => setNewStaff({ ...newStaff, shiftType: 'single' })}
                        >
                          Single Strict
                        </button>
                        <button
                          type="button"
                          className={newStaff.shiftType === 'multi' ? 'btn-primary' : 'btn-secondary'}
                          style={{ flex: 1, padding: '6px' }}
                          onClick={() => setNewStaff({ ...newStaff, shiftType: 'multi' })}
                        >
                          Multi Strict
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Login Time {newStaff.shiftType === 'multi' && '1'}</label>
                        <input
                          type="text"
                          className="glass-input"
                          placeholder="09:00 AM"
                          value={newStaff.loginTime}
                          onChange={(e) => setNewStaff({ ...newStaff, loginTime: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Logout Time {newStaff.shiftType === 'multi' && '1'}</label>
                        <input
                          type="text"
                          className="glass-input"
                          placeholder={newStaff.shiftType === 'multi' ? "01:00 PM" : "06:00 PM"}
                          value={newStaff.logoutTime}
                          onChange={(e) => setNewStaff({ ...newStaff, logoutTime: e.target.value })}
                        />
                      </div>
                      {newStaff.shiftType === 'multi' && (
                        <>
                          <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                            <label className="form-label">Login Time 2</label>
                            <input
                              type="text"
                              className="glass-input"
                              placeholder="04:00 PM"
                              value={newStaff.loginTime2 || ''}
                              onChange={(e) => setNewStaff({ ...newStaff, loginTime2: e.target.value })}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                            <label className="form-label">Logout Time 2</label>
                            <input
                              type="text"
                              className="glass-input"
                              placeholder="09:00 PM"
                              value={newStaff.logoutTime2 || ''}
                              onChange={(e) => setNewStaff({ ...newStaff, logoutTime2: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <p style={{ fontSize: '0.72rem', color: '#f59e0b', margin: 0, fontWeight: '600' }}>
                        Deduction Rule: 3 days late (15+ min) = Rs 500 deduction
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddStaff(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isCreatingStaff}>
                    {isCreatingStaff ? 'Authorizing...' : 'Authorize Staff'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Staff Modal */}
      {
        selectedStaff && staffEditData && (
          <div className="modal-overlay">
            <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <h3>Edit Staff Member</h3>
                <button className="btn-secondary" style={{ padding: '8px' }} onClick={closeStaffModal}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Role Selection */}
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Assign Staff Role</label>
                  <select
                    className="glass-input"
                    value={staffEditData.role}
                    onChange={(e) => setStaffEditData({ ...staffEditData, role: e.target.value })}
                    style={{ background: 'var(--bg-dark)' }}
                  >
                    <option value="staff">Regular Staff</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="doctor">Doctor</option>
                    <option value="hr">HR Manager</option>
                  </select>
                </div>

                {/* 2. Doctor Category (only if role is Doctor) */}
                {staffEditData.role === 'doctor' && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Doctor Category</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        className={staffEditData.doctorType === 'head' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1 }}
                        onClick={() => setStaffEditData({ ...staffEditData, doctorType: 'head' })}
                      >
                        Head Doctor
                      </button>
                      <button
                        type="button"
                        className={staffEditData.doctorType === 'employee' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1 }}
                        onClick={() => setStaffEditData({ ...staffEditData, doctorType: 'employee' })}
                      >
                        Employee Doctor
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Personal Details */}
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={staffEditData.name}
                    onChange={(e) => setStaffEditData({ ...staffEditData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Mobile Number (without +91)</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={staffEditData.phone}
                    onChange={(e) => setStaffEditData({ ...staffEditData, phone: e.target.value })}
                    required
                    pattern="[0-9]{10}"
                  />
                </div>

                {['staff', 'hr'].includes(staffEditData.role) && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Email ID</label>
                    <input
                      type="email"
                      className="glass-input"
                      value={staffEditData.email || ''}
                      onChange={(e) => setStaffEditData({ ...staffEditData, email: e.target.value })}
                      required
                    />
                  </div>
                )}

                {/* 4. Branch Assignment */}
                {['staff', 'receptionist'].includes(staffEditData.role) && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Assign to Branch</label>
                    <select
                      className="glass-input"
                      value={staffEditData.branchId || ''}
                      onChange={(e) => setStaffEditData({ ...staffEditData, branchId: e.target.value })}
                      required
                      style={{ background: 'var(--bg-dark)' }}
                    >
                      <option value="">Select a Branch</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 5. Salary & Work Schedule */}
                {(staffEditData.role === 'staff' || (staffEditData.role === 'doctor' && staffEditData.doctorType === 'employee')) && (
                  <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salary &amp; Work Schedule</p>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">Monthly Base Salary (Rs)</label>
                      <input
                        type="number"
                        className="glass-input"
                        value={staffEditData.salary}
                        onChange={(e) => setStaffEditData({ ...staffEditData, salary: e.target.value })}
                        required
                        min="0"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Shift Type</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          className={staffEditData.shiftType === 'single' || !staffEditData.shiftType ? 'btn-primary' : 'btn-secondary'}
                          style={{ flex: 1, padding: '6px' }}
                          onClick={() => setStaffEditData({ ...staffEditData, shiftType: 'single' })}
                        >
                          Single Strict
                        </button>
                        <button
                          type="button"
                          className={staffEditData.shiftType === 'multi' ? 'btn-primary' : 'btn-secondary'}
                          style={{ flex: 1, padding: '6px' }}
                          onClick={() => setStaffEditData({ ...staffEditData, shiftType: 'multi' })}
                        >
                          Multi Strict
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Login Time {staffEditData.shiftType === 'multi' && '1'}</label>
                        <input
                          type="text"
                          className="glass-input"
                          value={staffEditData.loginTime || ''}
                          onChange={(e) => setStaffEditData({ ...staffEditData, loginTime: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Logout Time {staffEditData.shiftType === 'multi' && '1'}</label>
                        <input
                          type="text"
                          className="glass-input"
                          value={staffEditData.logoutTime || ''}
                          onChange={(e) => setStaffEditData({ ...staffEditData, logoutTime: e.target.value })}
                        />
                      </div>
                      {staffEditData.shiftType === 'multi' && (
                        <>
                          <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                            <label className="form-label">Login Time 2</label>
                            <input
                              type="text"
                              className="glass-input"
                              value={staffEditData.loginTime2 || ''}
                              onChange={(e) => setStaffEditData({ ...staffEditData, loginTime2: e.target.value })}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                            <label className="form-label">Logout Time 2</label>
                            <input
                              type="text"
                              className="glass-input"
                              value={staffEditData.logoutTime2 || ''}
                              onChange={(e) => setStaffEditData({ ...staffEditData, logoutTime2: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" className="btn-secondary" onClick={closeStaffModal}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={handleUpdateStaff} disabled={isUpdatingStaff}>
                    {isUpdatingStaff ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Selected View Plan Modal */}
      {
        selectedViewPlan && (
          <div className="modal-overlay" onClick={() => setSelectedViewPlan(null)}>
            <div className="glass-panel modal-content" style={{ width: '95%', maxWidth: '1200px', maxHeight: '90vh', overflowY: 'auto', padding: '30px 30px 30px 15px' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedViewPlan(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-light)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
              <h2 style={{ marginBottom: '20px', color: 'var(--text-main)' }}>30-Day Diet Plan for {selectedViewPlan.patientName}</h2>

              {/* Plan Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px', background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                <div><strong>Age:</strong> {selectedViewPlan.age} yrs</div>
                <div><strong>Height / Weight:</strong> {selectedViewPlan.height} cm / {selectedViewPlan.weight} kg</div>
                <div><strong>BMI:</strong> {selectedViewPlan.bmi}</div>
                <div><strong>Fee / Status:</strong> ₹{selectedViewPlan.amountPaid || selectedViewPlan.amount || 500} ({selectedViewPlan.paymentStatus?.toUpperCase()})</div>
                <div><strong>Duration:</strong> {selectedViewPlan.startDate} to {selectedViewPlan.expiryDate}</div>
                <div><strong>Deficiencies:</strong> {selectedViewPlan.deficiencies?.join(', ') || 'None'}</div>
                <div><strong>Disorders:</strong> {selectedViewPlan.disorders ? Object.entries(selectedViewPlan.disorders).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ') || 'None' : 'None'}</div>
              </div>

              {/* Eat / Avoid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <h4 style={{ color: '#ef4444', margin: '0 0 8px 0' }}>Foods to Avoid</h4>
                  <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-line', color: 'var(--text-main)' }}>{selectedViewPlan.foodsToAvoid || 'None specified.'}</p>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 8px 0' }}>Foods to Eat</h4>
                  <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-line', color: 'var(--text-main)' }}>{selectedViewPlan.foodsToEat || 'None specified.'}</p>
                </div>
              </div>

              {/* Meals Grid */}
              <h3 style={{ marginBottom: '12px', color: 'var(--text-main)' }}>Diet Schedule</h3>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 1 }}>
                    <tr style={{ background: 'var(--bg-main)' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)', width: '60px' }}>Day</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)' }}>Breakfast</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)' }}>Lunch</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)' }}>Snacks</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)' }}>Dinner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedViewPlan.meals?.map((m) => (
                      <tr key={m.dayNumber}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold', fontSize: '11px', textAlign: 'center', color: 'var(--text-main)' }}>Day {m.dayNumber}</td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{m.breakfast}</td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{m.lunch}</td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{m.snacks}</td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-main)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{m.dinner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '10px 24px' }}
                  onClick={() => setSelectedViewPlan(null)}
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};
export default SuperAdminDashboard;



