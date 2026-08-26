import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, limit, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ExternalLink, RotateCcw, Activity, IndianRupee, Building2, Wrench } from 'lucide-react';
import { getStandardBranchName, generateRegistrationId, getBranchShortcut } from '../../utils/idGenerator';

const cleanDoctorNameWeb = (name) => {
  if (!name || typeof name !== 'string') return 'Unassigned';
  let cleaned = name.trim();
  const lowerCleaned = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lowerCleaned.includes('prashan') || lowerCleaned.includes('vaidya') || lowerCleaned.includes('vidya')) {
    return 'Dr. Prashanth K Vaidya';
  }
  if (lowerCleaned.includes('ramakrishna') || lowerCleaned.includes('chanduri')) {
    return 'Dr. Ramakrishna Chanduri';
  }
  if (lowerCleaned.includes('jobed') || lowerCleaned.includes('parveej') || lowerCleaned.includes('jubeid')) {
    return 'Dr. Jobedah Parveej';
  }
  if (lowerCleaned.includes('padma') || lowerCleaned.includes('priya')) {
    return 'Dr. Padma Priya';
  }

  const prefixRegex = /^(dr\.|dr\b|doctor\b)\s*/i;
  while (prefixRegex.test(cleaned)) {
    cleaned = cleaned.replace(prefixRegex, '');
  }
  if (!cleaned || cleaned.toLowerCase() === 'doctor') return 'Doctor';

  cleaned = cleaned.split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `Dr. ${cleaned}`;
};

function parseAnyDateObj(dateVal) {
  if (!dateVal) return null;
  if (dateVal.toDate) return dateVal.toDate();
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);

  if (typeof dateVal === 'string') {
    const cleanStr = dateVal.trim();
    
    // Try standard JS Date parsing first (handles MM/DD/YYYY naturally)
    const nativeDate = new Date(cleanStr);
    if (!isNaN(nativeDate.getTime())) {
      const parts = cleanStr.split(',')[0].split('/');
      if (parts.length === 3 && parseInt(parts[0].trim(), 10) > 12) {
        // Definitely DD/MM/YYYY, fall back to manual split below
      } else {
        return nativeDate;
      }
    }

    if (cleanStr.includes('T') && (cleanStr.endsWith('Z') || cleanStr.includes('+'))) {
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) return d;
    }
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split(',')[0].split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0].trim(), 10);
        const m = parseInt(parts[1].trim(), 10) - 1;
        const y = parseInt(parts[2].trim(), 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const res = new Date(y, m, d);
          if (!isNaN(res.getTime())) return res;
        }
      }
    }
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('T')[0].split(' ')[0].split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const res = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (!isNaN(res.getTime())) return res;
        } else if (parts[2].length === 4) {
          const res = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          if (!isNaN(res.getTime())) return res;
        }
      }
    }
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function safeDateDisplay(dateObj) {
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
    return String(dateObj);
  }
  return d.toLocaleString();
}

function isPhoneMatch(p1, p2) {
  const clean1 = (p1 || '').replace(/\D/g, '').slice(-10);
  const clean2 = (p2 || '').replace(/\D/g, '').slice(-10);
  return clean1 && clean1 === clean2;
}

function parseHTMLDateToDateObj(htmlDateStr) {
  if (!htmlDateStr) return null;
  const parts = htmlDateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const fallback = new Date(htmlDateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function parseDateToYMD(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') {
    if (raw.includes('/')) {
      const parts = raw.trim().split('/');
      if (parts.length >= 3) {
        let d = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        let y = parseInt(parts[2].split(',')[0].split(' ')[0], 10);
        if (d > 1000) {
          y = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10);
          d = parseInt(parts[2], 10);
        }
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
  }
  const d = parseAnyDateObj(raw);
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function enrichDateMeta(obj, dateFields = []) {
  let rawDateStr = '';
  for (const f of dateFields) {
    if (obj[f]) {
      rawDateStr = obj[f];
      break;
    }
  }
  const d = parseAnyDateObj(rawDateStr);
  const ymd = parseDateToYMD(rawDateStr);
  const ts = d ? d.getTime() : 0;
  const year = d ? d.getFullYear() : 0;
  const month = d ? d.getMonth() + 1 : 0;
  const dateStr = safeDateDisplay(rawDateStr) || 'N/A';
  return { ...obj, _ymd: ymd, _ts: ts, _year: year, _month: month, _dateStr: dateStr };
}

function isBranchMatchHelper(arg1, arg2, arg3, arg4) {
  let itemBranchId = '';
  let itemBranchName = '';
  let filterBranchId = 'all';
  let branchesList = [];

  if (typeof arg3 === 'object' || Array.isArray(arg3)) {
    filterBranchId = arg2;
    branchesList = arg3 || [];
    if (typeof arg1 === 'object' && arg1 !== null) {
      itemBranchId = arg1.branchId || arg1.branch || arg1.location || '';
      itemBranchName = arg1.branchName || arg1.branch || arg1.clinicBranch || '';
    } else {
      itemBranchId = arg1 || '';
    }
  } else {
    itemBranchId = arg1 || '';
    itemBranchName = arg2 || '';
    filterBranchId = arg3 || 'all';
    branchesList = arg4 || [];
  }

  if (!filterBranchId || filterBranchId === 'all') return true;
  const safeBranches = Array.isArray(branchesList) ? branchesList : [];

  const normalize = (val) => {
    if (!val) return '';
    if (typeof val === 'object') {
      val = val.name || val.id || '';
    }
    const str = String(val).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (str.includes('kphb') || str.includes('kphp')) return 'kphb';
    if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
    if (str.includes('dsnr') || str.includes('dilsukh') || str.includes('dilshukh') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
    if (str.includes('nalla') || str.includes('nallagandla') || str.includes('ngl') || str.includes('nlg')) return 'nallagandla';
    return str.replace(/branch/gi, '').trim();
  };

  const selectedBranchObj = safeBranches.find(b => b && (b.id === filterBranchId || b.name === filterBranchId));
  const selectedBranchName = selectedBranchObj?.name || '';
  const normFilterId = normalize(filterBranchId);
  const normFilterName = normalize(selectedBranchName);

  const normId = normalize(itemBranchId);
  const normName = normalize(itemBranchName);

  if (normFilterId && (normId === normFilterId || normName === normFilterId)) return true;
  if (normFilterName && (normId === normFilterName || normName === normFilterName)) return true;

  return false;
}

function checkAmountRange(amt, rangeStr) {
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
}

const HRTotalRevenue = () => {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  // medicineForms = alltransactions (same as admin — NOT medicine_forms collection)
  const [medicineForms, setMedicineForms] = useState([]);
  // nutritionPlans fetched from nutrition_plans collection
  const [nutritionPlans, setNutritionPlans] = useState([]);
  const [pendingPats, setPendingPats] = useState([]);
  const [pendingAppts, setPendingAppts] = useState([]);
  const pendingRecordsRaw = useMemo(() => [...pendingPats, ...pendingAppts], [pendingPats, pendingAppts]);
  const [branches, setBranches] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);

  const [fixingIds, setFixingIds] = useState(false);
  const [fixResult, setFixResult] = useState(null);

  // Pending Payments detailed filter
  const [pendingPeriodFilter, setPendingPeriodFilter] = useState('all'); // 'this_month' or 'all'

  const handleClearPending = async (patient) => {
    if (!window.confirm(`Are you sure you want to clear all pending balances for ${patient.patientName || patient.name}?`)) return;
    try {
      setLoading(true);
      const allPatsSnap = await getDocs(collection(db, 'allpatients'));
      const batchPromises = [];
      allPatsSnap.forEach(d => {
        const data = d.data();
        const amt = Number(data.pendingAmount) || 0;
        if (amt > 0) {
          const docPhone = data.phone || data.patientPhone || data.phoneNumber || data.contact || '';
          if (isPhoneMatch(patient.phone, docPhone) || d.id === patient.id) {
            batchPromises.push(updateDoc(doc(db, 'allpatients', d.id), { pendingAmount: 0 }));
          }
        }
      });
      await Promise.all(batchPromises);
      alert('Pending balance cleared successfully!');
    } catch (err) {
      console.error('Error clearing pending balance:', err);
      alert('Failed to clear pending balance.');
    } finally {
      setLoading(false);
    }
  };

  // Filters
  const [revenueSearch, setRevenueSearch] = useState('');
  const [revenueBranchId, setRevenueBranchId] = useState('all');
  const [revenueDate, setRevenueDate] = useState('');
  const [revenueYear, setRevenueYear] = useState(String(new Date().getFullYear()));
  const [revenueMonth, setRevenueMonth] = useState(String(new Date().getMonth() + 1));
  const [revenueSource, setRevenueSource] = useState('all');
  const [revenueMethod, setRevenueMethod] = useState('all');
  const [revenueSplitType, setRevenueSplitType] = useState('all');
  const [revenueAmountRange, setRevenueAmountRange] = useState('all');
  const [revenueDoctor, setRevenueDoctor] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [activeView, setActiveView] = useState('logs');

  const patientsMap = useMemo(() => {
    const map = new Map();
    patients.forEach(p => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [patients]);

  /**
   * One-time migration: find today's new patients with old-format IDs and regenerate them.
   * Ensures old patients are skipped ("today is new patient only"), preserves their existing
   * sequence number (e.g. SPH-CHN-031 -> SPH-CHN-0031), and avoids creating duplicate IDs.
   * Also updates the branch's Firestore counter if the sequence number is higher.
   */
  const fixTodayPatientIds = async () => {
    setFixingIds(true);
    setFixResult(null);
    try {
      console.log('[Script] Running joint database corrections & ID fixes...');
      
      // A. DATABASE CORRECTION FOR SRINIVAS & SREELEKHA
      let sriStatus = 'Not found';
      let sreeStatus = 'Not found';
      try {
        const qTxAll = query(collection(db, 'alltransactions'), limit(2000));
        const snapTxAll = await getDocs(qTxAll);
        
        let sriCashDoc = null;
        let sriUpiDocExists = false;
        let sreeLekhaCashDoc = null;

        snapTxAll.docs.forEach(docSnap => {
          const tData = docSnap.data();
          const phone = (tData.phone || tData.patientPhone || '').replace(/\D/g, '').slice(-10);
          const amt = Number(tData.amount) || 0;
          const meth = (tData.method || '').toLowerCase();
          const name = (tData.patientName || tData.fullName || '').toLowerCase();
          
          const isSrinivas = phone === '9849133067' || name.includes('srinivas');
          const isSreeLekha = phone === '9613176176' || name.includes('sreelekha');

          if (isSrinivas) {
            if (amt === 500 && (meth === 'cash' || tData.paymentId === 'SPLIT_LEG1_CASH')) {
              sriCashDoc = { id: docSnap.id, ...tData };
            }
            if (amt === 1500 && (meth === 'upi' || meth === 'phonepe' || tData.paymentId === 'SPLIT_LEG2_UPI')) {
              sriUpiDocExists = true;
            }
          }

          if (isSreeLekha) {
            if (amt === 500 && (meth === 'cash' || meth === 'split' || tData.paymentId === 'SPLIT_LEG1_CASH')) {
              sreeLekhaCashDoc = { id: docSnap.id, ...tData };
            }
          }
        });

        if (sriCashDoc) {
          if (sriUpiDocExists) {
            sriStatus = 'Already split';
          } else {
            // Create Srinivas UPI leg
            await addDoc(collection(db, 'alltransactions'), {
              type: 'consultation_medicine',
              typeLabel: 'Consultation & Medicine Fee',
              patientId: sriCashDoc.patientId || 'SPH-DSN-181',
              patientName: sriCashDoc.patientName || 'srinivas',
              phone: sriCashDoc.phone || '9849133067',
              registrationId: 'SPH-DSN-181',
              regId: 'SPH-DSN-181',
              source: sriCashDoc.source || 'Facebook',
              amount: 1500,
              method: 'upi',
              branchId: sriCashDoc.branchId || 'DIL',
              branchName: sriCashDoc.branchName || 'Dilshuknagar Branch',
              recordedBy: sriCashDoc.recordedBy || 'Staff',
              paymentId: 'SPLIT_LEG2_UPI',
              doctor: sriCashDoc.doctor || 'Dr.Ramakrishna chanduri',
              itemsPaid: { consultation: 800, medicine: 1200 },
              timestamp: serverTimestamp()
            });

            // Update Srinivas Cash leg
            await updateDoc(doc(db, 'alltransactions', sriCashDoc.id), {
              paymentId: 'SPLIT_LEG1_CASH',
              itemsPaid: { consultation: 800, medicine: 1200 }
            });
            sriStatus = 'Fixed';
          }
        }

        if (sreeLekhaCashDoc) {
          // Update SreeLekha Cash leg to 2000
          await updateDoc(doc(db, 'alltransactions', sreeLekhaCashDoc.id), {
            amount: 2000,
            method: 'cash',
            paymentId: '-',
            itemsPaid: { consultation: 800, medicine: 1200 }
          });
          sreeStatus = 'Fixed';
        }

        // Update Patient Profiles
        const snapAllPatsScan = await getDocs(collection(db, 'allpatients'));
        for (const dPat of snapAllPatsScan.docs) {
          const dPatData = dPat.data();
          const dPatPhone = (dPatData.phone || dPatData.patientPhone || '').replace(/\D/g, '').slice(-10);
          const dPatName = (dPatData.fullName || dPatData.patientName || '').toLowerCase();
          
          if (dPatPhone === '9849133067' || dPatName.includes('srinivas')) {
            await updateDoc(doc(db, 'allpatients', dPat.id), {
              amountPaid: 2000,
              pendingAmount: 0,
              itemsPaid: { consultation: 800, medicine: 1200 },
              paymentStatus: 'paid',
              paymentMethod: 'split',
              paymentSplitDetails: { cash: 500, upi: 1500 }
            });
          }

          if (dPatPhone === '9613176176' || dPatName.includes('sreelekha')) {
            await updateDoc(doc(db, 'allpatients', dPat.id), {
              amountPaid: 2000,
              pendingAmount: 0,
              itemsPaid: { consultation: 800, medicine: 1200 },
              paymentStatus: 'paid',
              paymentMethod: 'cash'
            });
          }
        }

        // Update Appointments if applicable
        const appointmentsToUpdate = [sriCashDoc?.patientId, sreeLekhaCashDoc?.patientId].filter(Boolean);
        for (const apptId of appointmentsToUpdate) {
          if (apptId !== 'SPH-DSN-181' && apptId !== 'RK/DILS/0001') {
            try {
              const isSri = apptId === sriCashDoc?.patientId;
              await updateDoc(doc(db, 'appointments', apptId), {
                amountPaid: 2000,
                pendingAmount: 0,
                itemsPaid: { consultation: 800, medicine: 1200 },
                paymentStatus: 'paid',
                paymentMethod: isSri ? 'split' : 'cash',
                ...(isSri ? { paymentSplitDetails: { cash: 500, upi: 1500 } } : {})
              });
            } catch (apptErr) {
              console.warn('[Script] Failed to update appointment:', apptId, apptErr);
            }
          }
        }
      } catch (dbErr) {
        console.error('[Script] Database correction phase error:', dbErr);
      }

      // B. ORIGINAL PATIENT ID CORRECTION
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Helper to parse and format an existing SPH ID (e.g. SPH-CHN-031 -> SPH-CHN-0031)
      const tryParseAndFormatExistingId = (idVal) => {
        if (!idVal || typeof idVal !== 'string') return null;
        if (idVal.startsWith('SPH-')) {
          const parts = idVal.split('-');
          if (parts.length >= 3) {
            const codeRaw = parts[1];
            const numRaw = parts[2];
            const shortcut = getBranchShortcut(codeRaw);
            const num = parseInt(numRaw.replace(/\D/g, ''), 10);
            if (!isNaN(num)) {
              return {
                id: `SPH-${shortcut}-${String(num).padStart(4, '0')}`,
                shortcut,
                num
              };
            }
          }
        }
        return null;
      };

      const qAllPats = query(
        collection(db, 'allpatients'),
        where('createdAt', '>=', todayStart),
        where('createdAt', '<=', todayEnd)
      );
      const snapAllPats = await getDocs(qAllPats);

      const qTx = query(
        collection(db, 'alltransactions'),
        where('timestamp', '>=', todayStart),
        where('timestamp', '<=', todayEnd)
      );
      const snapTx = await getDocs(qTx);

      const phoneGroups = {}; // phone -> { docs: [], branch: '', existingNewFormatId: '', existingParsable: null }

      for (const docSnap of snapAllPats.docs) {
        const data = docSnap.data();
        const phone = (data.phone || data.patientPhone || '').replace(/\D/g, '').slice(-10);
        if (!phone) continue;

        if (!phoneGroups[phone]) {
          phoneGroups[phone] = { docs: [], branch: '', existingNewFormatId: '', existingParsable: null };
        }

        phoneGroups[phone].docs.push({ id: docSnap.id, data });

        const existingId = data.registrationId || data.regId || '';
        if (newFormatRegex.test(existingId)) {
          phoneGroups[phone].existingNewFormatId = existingId;
        } else {
          const parsed = tryParseAndFormatExistingId(existingId);
          if (parsed && !phoneGroups[phone].existingParsable) {
            phoneGroups[phone].existingParsable = parsed;
          }
        }

        const branch = data.branchId || data.branchName || '';
        if (branch && !phoneGroups[phone].branch) {
          phoneGroups[phone].branch = branch;
        }
      }

      let fixed = 0;
      let skipped = 0;
      let errorsCount = 0;

      for (const phone of Object.keys(phoneGroups)) {
        const group = phoneGroups[phone];
        let isOldPatient = false;

        const qOldAll = query(
          collection(db, 'allpatients'),
          where('phone', '==', phone)
        );
        const snapOldAll = await getDocs(qOldAll);
        for (const od of snapOldAll.docs) {
          const odData = od.data();
          const ts = odData.createdAt;
          if (ts) {
            const dt = ts.toDate ? ts.toDate() : new Date(ts);
            if (dt < todayStart) {
              isOldPatient = true;
              break;
            }
          }
        }

        if (isOldPatient) {
          skipped += group.docs.length;
          continue;
        }

        try {
          let targetId = group.existingNewFormatId;

          if (!targetId) {
            if (group.existingParsable) {
              targetId = group.existingParsable.id;
              const { shortcut, num } = group.existingParsable;
              try {
                await runTransaction(db, async (transaction) => {
                  const counterRef = doc(db, 'counters', `registration_${shortcut}`);
                  const counterDoc = await transaction.get(counterRef);
                  let current = 0;
                  if (counterDoc.exists()) {
                    current = counterDoc.data().count || 0;
                  }
                  if (num > current) {
                    transaction.set(counterRef, { count: num }, { merge: true });
                  }
                });
              } catch (cntErr) {
                console.warn('Could not update branch counter:', cntErr);
              }
            } else {
              const branchToUse = group.branch || 'KPHB';
              targetId = await generateRegistrationId(branchToUse);
            }
          }

          for (const docObj of group.docs) {
            const currentId = docObj.data.registrationId || docObj.data.regId || '';
            if (currentId !== targetId) {
              await updateDoc(doc(db, 'allpatients', docObj.id), {
                registrationId: targetId,
                regId: targetId
              });
            }
          }

          const qPat = query(collection(db, 'patients'), where('phone', '==', phone));
          const snapPat = await getDocs(qPat);
          for (const pd of snapPat.docs) {
            const pdData = pd.data();
            if (pdData.registrationId !== targetId || pdData.regId !== targetId) {
              await updateDoc(doc(db, 'patients', pd.id), {
                registrationId: targetId,
                regId: targetId
              });
            }
          }

          for (const txDoc of snapTx.docs) {
            const txData = txDoc.data();
            const txPhone = (txData.phone || txData.patientPhone || '').replace(/\D/g, '').slice(-10);
            if (txPhone === phone) {
              if (txData.registrationId !== targetId || txData.regId !== targetId) {
                await updateDoc(doc(db, 'alltransactions', txDoc.id), {
                  registrationId: targetId,
                  regId: targetId
                });
              }
            }
          }

          fixed++;
        } catch (err) {
          console.error('Error fixing ID for phone:', phone, err);
          errorsCount++;
        }
      }

      setFixResult({
        fixed,
        skipped,
        errors: errorsCount,
        message: `Srinivas: ${sriStatus} | SreeLekha: ${sreeStatus}`
      });
    } catch (err) {
      console.error('Migration error:', err);
      setFixResult({ fixed: 0, skipped: 0, errors: 1, message: err.message });
    } finally {
      setFixingIds(false);
    }
  };


  useEffect(() => {
    let active = true;

    // Fetch Branches
    const unsubBranches = onSnapshot(collection(db, 'users'), (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.role === 'branch' || data.role === 'admin' || (data.name && data.name.toLowerCase().includes('branch'))) {
          list.push({ id: d.id, name: data.name || data.branchName || d.id, ...data });
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
        const exists = list.some(b => (b.name || b.branchName || b.id || '').toLowerCase().includes(normC));
        if (!exists) {
          list.push(c);
        }
      });

      setBranches(list);
    });

    const unsubPats = onSnapshot(collection(db, 'allpatients'), (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const amt = Number(data.pendingAmount) || 0;
        if (amt > 0) {
          list.push({ id: d.id, ...data });
        }
      });
      setPendingPats(list);
    });

    const unsubAppts = () => { };
    setPendingAppts([]);

    const getVisitDedupeKey = (data, docId) => {
      if (!data) return docId;
      const regId = data.registrationId || data.regId || data.regID || '';
      const phone = (data.phone || data.patientPhone || data.phoneNumber || data.contactNumber || data.contact || '').replace(/\D/g, '').slice(-10);
      const rawDate = data.paymentCollectedAt || data.appointmentDate || data.createdAt || data.date || '';
      let datePart = '';
      if (rawDate) {
        const d = parseAnyDateObj(rawDate);
        if (d && !isNaN(d.getTime())) {
          datePart = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }
      }
      if (regId && regId !== '-' && datePart) return `${regId}_${datePart}`;
      if (phone && datePart) return `${phone}_${datePart}`;
      return docId;
    };

    const fetchData = async () => {
      try {
        let startTimestamp = null;
        let endTimestamp = null;

        if (revenueDate) {
          const parts = revenueDate.split('-');
          startTimestamp = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0);
          endTimestamp = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
        } else if (revenueYear !== 'all') {
          if (revenueMonth !== 'all') {
            startTimestamp = new Date(parseInt(revenueYear, 10), parseInt(revenueMonth, 10) - 1, 1, 0, 0, 0);
            endTimestamp = new Date(parseInt(revenueYear, 10), parseInt(revenueMonth, 10), 0, 23, 59, 59, 999);
          } else {
            startTimestamp = new Date(parseInt(revenueYear, 10), 0, 1, 0, 0, 0);
            endTimestamp = new Date(parseInt(revenueYear, 10), 11, 31, 23, 59, 59, 999);
          }
        }

        const queryWithDate = (colName, dateField) => {
          const colRef = collection(db, colName);
          if (startTimestamp && endTimestamp) {
            return query(colRef, where(dateField, '>=', startTimestamp), where(dateField, '<=', endTimestamp), orderBy(dateField, 'desc'));
          }
          return query(colRef, orderBy(dateField, 'desc'), limit(3000));
        };

        const [patResult, pResult, apptsResult, tResult, mfResult, npResult, usersResult, pByPayResult] = await Promise.allSettled([
          getDocs(queryWithDate('patients', 'createdAt')),
          getDocs(queryWithDate('allpatients', 'createdAt')),
          getDocs(queryWithDate('appointments', 'createdAt')),
          getDocs(queryWithDate('alltransactions', 'timestamp')),
          getDocs(queryWithDate('medicine_forms', 'createdAt')),
          getDocs(queryWithDate('nutrition_plans', 'createdAt')),
          getDocs(collection(db, 'users')),
          // Also query allpatients by paymentCollectedAt — this catches returning patients
          // whose allpatients doc was created months ago (createdAt is old) but paid today
          getDocs(queryWithDate('allpatients', 'paymentCollectedAt'))
        ]);

        const seenIds = new Set();
        const pData = [];

        if (patResult.status === 'fulfilled') {
          patResult.value.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              const data = doc.data();
              pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
            }
          });
        }

        if (pResult.status === 'fulfilled') {
          pResult.value.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              const data = doc.data();
              pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
            }
          });
        }

        if (apptsResult.status === 'fulfilled') {
          apptsResult.value.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              const data = doc.data();
              pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
            }
          });
        }

        // Supplementary allpatients by paymentCollectedAt — for returning patients paid in date range
        if (pByPayResult.status === 'fulfilled') {
          pByPayResult.value.forEach(doc => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              const data = doc.data();
              pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
            }
          });
        }

        const tData = [];
        if (tResult.status === 'fulfilled') {
          tResult.value.forEach(doc => {
            const data = doc.data();
            let details = data.paymentSplitDetails;
            if (typeof details === 'string') {
              try { details = JSON.parse(details); } catch (e) { details = null; }
            }
            const splitSum = details ? (Number(details.cash || 0) + Number(details.upi || 0)) : 0;
            const items = data.itemsPaid || null;
            const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;
            const trueAmt = Math.max(Number(data.amount || 0), splitSum, itemsSum);

            tData.push(enrichDateMeta({ id: doc.id, ...data, amount: trueAmt, paymentSplitDetails: details || data.paymentSplitDetails }, ['dateTime', 'timestamp', 'createdAt', 'date']));
          });
        }

        // Fetch any missing patients that exist in the transactions but were not returned by date queries
        const patientIdsInTxs = [...new Set(tData.map(t => t.patientId).filter(Boolean))];
        const missingIds = patientIdsInTxs.filter(id => !seenIds.has(id) && id !== 'WALKIN_USER');
        if (missingIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < missingIds.length; i += 10) {
            chunks.push(missingIds.slice(i, i + 10));
          }
          for (const chunk of chunks) {
            try {
              const qMissing = query(collection(db, 'allpatients'), where('__name__', 'in', chunk));
              const snapMissing = await getDocs(qMissing);
              snapMissing.forEach(doc => {
                if (!seenIds.has(doc.id)) {
                  seenIds.add(doc.id);
                  const data = doc.data();
                  pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
                }
              });

              // Also fetch from legacy patients collection
              const qMissingLegacy = query(collection(db, 'patients'), where('__name__', 'in', chunk));
              const snapMissingLegacy = await getDocs(qMissingLegacy);
              snapMissingLegacy.forEach(doc => {
                if (!seenIds.has(doc.id)) {
                  seenIds.add(doc.id);
                  const data = doc.data();
                  pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
                }
              });
            } catch (err) {
              console.warn('Error fetching missing patients:', err);
            }
          }
        }

        // Fetch any missing patients by name variations if patientId lookup would fail
        const missingNames = new Set();
        tData.forEach(t => {
          const pid = t.patientId;
          const pName = t.patientName || t.fullName;
          if (pName && (!pid || pid === 'WALKIN_USER' || !seenIds.has(pid))) {
            missingNames.add(pName.trim());
          }
        });

        if (missingNames.size > 0) {
          for (const name of missingNames) {
            try {
              // Generate case variations
              const lower = name.toLowerCase();
              const upper = name.toUpperCase();
              const capitalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
              const capitalizedWords = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              const variations = [...new Set([name, lower, upper, capitalized, capitalizedWords])].filter(Boolean);

              // Query allpatients by fullName for these variations using prefix range queries
              for (const variant of variations) {
                const qName = query(collection(db, 'allpatients'), where('fullName', '>=', variant), where('fullName', '<=', variant + '\uf8ff'), limit(5));
                const snapName = await getDocs(qName);
                snapName.forEach(doc => {
                  if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id);
                    const data = doc.data();
                    pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
                  }
                });

                // Query legacy patients by fullName
                const qNameLegacy = query(collection(db, 'patients'), where('fullName', '>=', variant), where('fullName', '<=', variant + '\uf8ff'), limit(5));
                const snapNameLegacy = await getDocs(qNameLegacy);
                snapNameLegacy.forEach(doc => {
                  if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id);
                    const data = doc.data();
                    pData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'appointmentDate', 'completedAt', 'createdAt', 'date']));
                  }
                });
              }
            } catch (err) {
              console.warn('Error fetching missing patients by name:', err);
            }
          }
        }

        const mfData = [];
        if (mfResult.status === 'fulfilled') {
          mfResult.value.forEach(doc => {
            const data = doc.data();
            mfData.push(enrichDateMeta({ id: doc.id, ...data }, ['createdAt', 'formDate', 'date']));
          });
        }

        const npData = [];
        if (npResult.status === 'fulfilled') {
          npResult.value.forEach(doc => {
            const data = doc.data();
            npData.push(enrichDateMeta({ id: doc.id, ...data }, ['paymentCollectedAt', 'createdAt', 'date']));
          });
        }

        const staffData = [];
        if (usersResult.status === 'fulfilled') {
          usersResult.value.forEach(doc => {
            const data = doc.data();
            if (['doctor', 'staff', 'receptionist', 'hr'].includes(data.role)) {
              staffData.push({ id: doc.id, ...data });
            }
          });
        }

        if (active) {
          setPatients(pData);
          setTransactions(tData);
          setMedicineForms([]);
          setNutritionPlans(npData);
          setStaffMembers(staffData);
        }
      } catch (err) {
        console.error("Error fetching revenue data", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
      unsubBranches();
      unsubPats();
      unsubAppts();
    };
  }, [revenueDate, revenueYear, revenueMonth]);

  const filteredRevenuePatients = useMemo(() => {
    return patients.filter(patient => {
      if (patient.paymentStatus !== 'paid') return false;

      // 1. Search term match (Name or Phone)
      const matchesSearch = !revenueSearch.trim() ||
        (patient.fullName && patient.fullName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
        (patient.phone && patient.phone.includes(revenueSearch.trim()));

      // 2. Branch match
      const matchesBranch = isBranchMatchHelper(patient, revenueBranchId, branches);

      // 3. Date / Month match
      let matchesDateRange = true;
      if (revenueDate) {
        if (patient._ymd !== revenueDate) matchesDateRange = false;
      } else if (revenueYear !== 'all') {
        if (patient._year !== parseInt(revenueYear, 10)) {
          matchesDateRange = false;
        } else if (revenueMonth !== 'all') {
          if (patient._month !== parseInt(revenueMonth, 10)) {
            matchesDateRange = false;
          }
        }
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

        matchesSplit = rowType.includes(revenueSplitType);
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
  }, [patients, revenueSearch, revenueBranchId, branches, revenueDate, revenueYear, revenueMonth, revenueSource, revenueMethod, revenueDoctor, revenueSplitType, revenueAmountRange]);

  const filteredPharmacyTransactions = useMemo(() => {
    return transactions.filter(tr => {
      // 1. Search term match (Name or Phone or Reg ID)
      const matchesSearch = !revenueSearch.trim() ||
        (tr.patientName && tr.patientName.toLowerCase().includes(revenueSearch.toLowerCase())) ||
        (tr.patientPhone && tr.patientPhone.includes(revenueSearch.trim())) ||
        (tr.phone && tr.phone.includes(revenueSearch.trim())) ||
        (tr.regId && tr.regId.toLowerCase().includes(revenueSearch.toLowerCase()));

      // 2. Branch match
      const matchesBranch = isBranchMatchHelper(tr.branchId, tr.branchName, revenueBranchId, branches);

      // 3. Date range match
      let matchesDate = true;
      if (revenueDate) {
        if (tr._ymd !== revenueDate) matchesDate = false;
      } else if (revenueYear !== 'all') {
        if (tr._year !== parseInt(revenueYear, 10)) {
          matchesDate = false;
        } else if (revenueMonth !== 'all') {
          if (tr._month !== parseInt(revenueMonth, 10)) {
            matchesDate = false;
          }
        }
      }

      // 4. Source match
      const patientDoc = tr.patientId ? patientsMap.get(tr.patientId) : null;
      const rawSrc = (tr.source || patientDoc?.source || 'Walk-in').toLowerCase();
      let matchesSource = true;
      if (revenueSource !== 'all') {
        if (revenueSource.toLowerCase().includes('old')) {
          matchesSource = rawSrc.includes('old');
        } else {
          matchesSource = rawSrc.includes(revenueSource.toLowerCase());
        }
      }

      // 5. Method match
      let matchesMethod = true;
      if (revenueMethod !== 'all') {
        const m = (tr.method || '').toLowerCase();
        if (revenueMethod === 'free') {
          matchesMethod = m === 'free' || Number(tr.amount || 0) === 0;
        } else if (revenueMethod === 'cash') {
          matchesMethod = m.includes('cash');
        } else if (revenueMethod === 'upi') {
          matchesMethod = m.includes('upi') || m.includes('online') || m.includes('app') || m.includes('phonepe') || m.includes('gpay') || m.includes('paytm');
        } else if (revenueMethod === 'card') {
          matchesMethod = m.includes('card');
        } else {
          matchesMethod = m.includes(revenueMethod.toLowerCase());
        }
      }

      // 6. Doctor match
      const rawDocName = tr.doctor || tr.doctorName || tr.prescribedBy || patientDoc?.doctor || patientDoc?.doctorName || patientDoc?.assignDoctor || 'N/A';
      const docNameClean = cleanDoctorNameWeb(rawDocName);
      const targetDocClean = revenueDoctor === 'all' ? 'all' : cleanDoctorNameWeb(revenueDoctor);
      const matchesDoctor = revenueDoctor === 'all' || docNameClean === targetDocClean || docNameClean.toLowerCase().includes(targetDocClean.toLowerCase());

      // 7. Split type match
      let matchesSplit = true;
      if (revenueSplitType !== 'all') {
        const rawType = tr.typeLabel || tr.type || 'Consultation';
        matchesSplit = rawType.toLowerCase().includes(revenueSplitType.toLowerCase());
      }

      // 8. Amount match
      let matchesAmount = true;
      if (revenueAmountRange !== 'all') {
        matchesAmount = checkAmountRange(Number(tr.amount) || 0, revenueAmountRange);
      }

      return matchesSearch && matchesBranch && matchesDate && matchesSource && matchesMethod && matchesDoctor && matchesSplit && matchesAmount;
    });
  }, [transactions, revenueSearch, revenueBranchId, branches, revenueDate, revenueYear, revenueMonth, revenueSource, revenueMethod, patientsMap, revenueDoctor, revenueSplitType, revenueAmountRange]);

  const filteredMedicineForms = [];
  const filteredNutritionPlansForRevenue = [];

  const allHistoryTransactions = useMemo(() => {
    const cleanField = (val) => {
      if (!val) return '';
      const s = String(val).trim();
      if (s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'undefined') return '';
      return s;
    };

    const list = filteredPharmacyTransactions.map(tr => {
      let patientDoc = tr.patientId ? patientsMap.get(tr.patientId) : null;
      if (!patientDoc && tr.patientName) {
        const searchName = tr.patientName.trim().toLowerCase();
        const trBranch = getStandardBranchName(tr.branchName || tr.branch || tr.branchId || tr.location || 'Kphb').toLowerCase();
        let bestMatch = null;
        for (const p of patientsMap.values()) {
          const pName = (p.fullName || p.patientName || '').trim().toLowerCase();
          if (pName === searchName && pName) {
            bestMatch = p;
            const pBranch = getStandardBranchName(p.branchName || p.branch || p.branchId || p.clinicBranch || p.location || 'Kphb').toLowerCase();
            if (pBranch === trBranch) {
              bestMatch = p;
              break;
            }
          }
        }
        if (bestMatch) {
          patientDoc = bestMatch;
        }
      }
      const regId = cleanField(tr.regId) || cleanField(tr.registrationId) || cleanField(patientDoc?.registrationId) || cleanField(patientDoc?.regId) || '-';
      const patientName = cleanField(tr.patientName) || cleanField(tr.fullName) || cleanField(patientDoc?.fullName) || cleanField(patientDoc?.patientName) || '-';
      const phone = cleanField(tr.patientPhone) || cleanField(tr.phone) || cleanField(patientDoc?.phone) || '-';
      const branch = getStandardBranchName(tr.branchName || tr.branch || tr.branchId || tr.location || 'Kphb');
      const doctorName = cleanField(tr.doctor) || cleanField(tr.doctorName) || cleanField(tr.prescribedBy) || cleanField(patientDoc?.doctor) || cleanField(patientDoc?.doctorName) || 'N/A';
      const source = cleanField(tr.source) || cleanField(patientDoc?.source) || 'Walk-in';

      const methodStr = (() => {
        const m = (tr.method || '-').toUpperCase();
        if (tr.paymentId && typeof tr.paymentId === 'string' && tr.paymentId.includes('SPLIT')) return 'CASH/UPI';
        if (m === 'SPLIT' || m === 'APP_SPLIT') return 'CASH/UPI';
        if (['ONLINE_RAZORPAY', 'ONLINE', 'APP', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI'].includes(m)) return 'UPI';
        return m;
      })();

      const rawType = tr.typeLabel || tr.type || 'Consultation';
      let formattedType = rawType;
      if (rawType.toLowerCase() === 'consultation') formattedType = 'Consultation';
      else if (rawType.toLowerCase() === 'nutrition' || rawType.toLowerCase() === 'diet') formattedType = 'Diet Plan';
      else if (rawType.toLowerCase() === 'medicine' || rawType.toLowerCase() === 'pharmacy') formattedType = 'Consultation & Medicine Fee';

      let splitDetails = tr.paymentSplitDetails || patientDoc?.paymentSplitDetails || null;
      if (typeof splitDetails === 'string') {
        try { splitDetails = JSON.parse(splitDetails); } catch (e) { splitDetails = null; }
      }
      const splitSum = splitDetails ? (Number(splitDetails.cash || 0) + Number(splitDetails.upi || 0)) : 0;

      const items = tr.itemsPaid || patientDoc?.itemsPaid || null;
      const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;

      if (items && Number(items.dietPlan || 0) > 0 && (Number(items.consultation || 0) > 0 || Number(items.medicine || 0) > 0)) {
        formattedType = 'Consultation & Medicine Fee / Diet Plan';
      }

      const calcAmount = Math.max(Number(tr.amount) || 0, splitSum, itemsSum);

      return {
        id: tr.id,
        type: formattedType,
        regId,
        patientName,
        phone,
        branch,
        doctorName,
        source,
        amount: calcAmount,
        method: methodStr,
        dateTime: tr._dateStr || 'N/A',
        timestamp: tr._ts || 0,
        _ymd: tr._ymd,
        status: 'PAID',
        itemsPaid: items,
        paymentSplitDetails: splitDetails
      };
    });

    // Group items by patient payment session (paymentId or phone/regId + date + 10-minute window)
    const groups = new Map();
    list.sort((a, b) => b.timestamp - a.timestamp);

    list.forEach(item => {
      const cleanPhone = (item.phone || '').replace(/\D/g, '').slice(-10);
      const cleanReg = (item.regId && !/^[a-zA-Z0-9]{18,25}$/.test(item.regId)) ? item.regId.toLowerCase().trim() : '';
      
      let keyPrefix = '';
      if (cleanReg && cleanReg !== '-') {
        keyPrefix = cleanReg;
      } else if (cleanPhone && cleanPhone !== '-') {
        keyPrefix = cleanPhone;
      } else if (item.patientId && item.patientId !== 'WALKIN_USER') {
        keyPrefix = item.patientId;
      } else {
        keyPrefix = (item.patientName || 'unknown').toLowerCase().trim();
      }

      const cleanPayId = (item.paymentId || '').trim();
      const isSplit = cleanPayId.toUpperCase().includes('SPLIT');

      let groupKey = `${item.id}`;
      if (cleanPayId && cleanPayId !== '-' && cleanPayId.toLowerCase() !== 'n/a' && !isSplit) {
        groupKey = `pay_${cleanPayId}`;
      } else if (item.timestamp && item.timestamp > 0) {
        const d = new Date(item.timestamp);
        const ymd = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const tenMinBucket = Math.floor((d.getHours() * 60 + d.getMinutes()) / 10);
        groupKey = `${keyPrefix}_${ymd}_${tenMinBucket}`;
      }

      // Helper: determine whether this individual leg is cash or upi
      const legRawMethod = (item.method || '').toUpperCase();
      const legIsCashLeg = cleanPayId.includes('SPLIT_LEG1') || (isSplit && legRawMethod === 'CASH');
      const legIsUpiLeg = cleanPayId.includes('SPLIT_LEG2') || (isSplit && (legRawMethod === 'UPI' || legRawMethod === 'CASH/UPI') && !legIsCashLeg);

      if (!groups.has(groupKey)) {
        // Seed paymentSplitDetails for split legs
        const seedSplit = isSplit
          ? { cash: legIsCashLeg ? Number(item.amount || 0) : 0, upi: legIsUpiLeg ? Number(item.amount || 0) : 0 }
          : (item.paymentSplitDetails || null);
        groups.set(groupKey, {
          ...item,
          methods: new Set([item.method]),
          types: new Set([item.type]),
          itemsPaid: item.itemsPaid ? { ...item.itemsPaid } : null,
          paymentSplitDetails: seedSplit
        });
      } else {
        const existing = groups.get(groupKey);
        existing.amount += Number(item.amount || 0);
        existing.methods.add(item.method);
        existing.types.add(item.type);
        if (item.itemsPaid) {
          existing.itemsPaid = existing.itemsPaid || {};
          if (item.itemsPaid.consultation) existing.itemsPaid.consultation = (existing.itemsPaid.consultation || 0) + Number(item.itemsPaid.consultation);
          if (item.itemsPaid.medicine) existing.itemsPaid.medicine = (existing.itemsPaid.medicine || 0) + Number(item.itemsPaid.medicine);
          if (item.itemsPaid.dietPlan) existing.itemsPaid.dietPlan = (existing.itemsPaid.dietPlan || 0) + Number(item.itemsPaid.dietPlan);
        }
        // Accumulate split leg cash/upi into paymentSplitDetails
        if (isSplit) {
          existing.paymentSplitDetails = existing.paymentSplitDetails || { cash: 0, upi: 0 };
          if (legIsCashLeg) existing.paymentSplitDetails.cash = (existing.paymentSplitDetails.cash || 0) + Number(item.amount || 0);
          if (legIsUpiLeg) existing.paymentSplitDetails.upi = (existing.paymentSplitDetails.upi || 0) + Number(item.amount || 0);
        }
      }
    });

    const finalTxList = Array.from(groups.values()).map(tr => {
      const tSet = tr.types;
      let combinedType = Array.from(tSet).join(' / ');
      if (tSet.has('Consultation') && tSet.has('Diet Plan')) combinedType = 'Consultation / Diet Plan';
      if (tSet.has('Consultation & Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Consultation & Medicine Fee / Diet Plan';
      if (tSet.has('Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Medicine Fee / Diet Plan';
      if (tSet.has('Consultation') && tSet.has('Medicine Fee') && tSet.has('Diet Plan')) combinedType = 'Consultation & Medicine Fee / Diet Plan';
      if (tSet.has('Consultation') && tSet.has('Consultation & Medicine Fee')) combinedType = 'Consultation & Medicine Fee';

      const methodsArr = Array.from(tr.methods).filter(m => m !== 'N/A');
      return {
        ...tr,
        type: combinedType,
        method: methodsArr.length > 0 ? methodsArr.join(' + ') : 'N/A'
      };
    });

    return finalTxList;
  }, [filteredPharmacyTransactions, patientsMap]);

  const pendingData = useMemo(() => {
    const pMap = {};
    const d = new Date();
    const currentMonth = d.getMonth();
    const currentYear = d.getFullYear();

    const normalizeBranchName = (val) => {
      return getStandardBranchName(val || 'Kphb');
    };

    pendingRecordsRaw.forEach(item => {
      const pAmt = Number(item.pendingAmount || 0);
      if (pAmt > 0) {
        const bName = normalizeBranchName(item.branchName || item.branch || item.branchId || item.clinicBranch || item.location);
        if (!pMap[bName]) {
          pMap[bName] = { name: bName, count: 0, totalPending: 0, thisMonthPending: 0, uniquePats: new Set() };
        }
        pMap[bName].totalPending += pAmt;

        let patId = item.id;
        if (patId) pMap[bName].uniquePats.add(patId);

        const dateRaw = item.paymentCollectedAt || item.appointmentDate || item.createdAt || item.dateString;
        let dt = parseAnyDateObj(dateRaw);
        if (dt && dt.getMonth() === currentMonth && dt.getFullYear() === currentYear) {
          pMap[bName].thisMonthPending += pAmt;
        }
      }
    });

    return Object.values(pMap).map(p => ({
      name: p.name,
      count: p.uniquePats.size || 1,
      totalPending: p.totalPending,
      thisMonthPending: p.thisMonthPending
    })).sort((a, b) => b.totalPending - a.totalPending);
  }, [pendingRecordsRaw]);

  // Detailed pending patients list
  const pendingPatientsList = useMemo(() => {
    const patientGroups = new Map();

    pendingRecordsRaw.forEach(item => {
      const pAmt = Number(item.pendingAmount || 0);
      const phone = (item.phone || item.patientPhone || '').trim();
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const key = cleanPhone || item.id;

      const dateRaw = item.paymentCollectedAt || item.appointmentDate || item.createdAt || item.dateString;
      const parsedDate = parseAnyDateObj(dateRaw);
      const rawDate = parsedDate ? parsedDate.getTime() : 0;

      if (!patientGroups.has(key)) {
        patientGroups.set(key, {
          id: item.id,
          regId: item.registrationId || item.regId || '-',
          patientName: item.fullName || item.patientName || '-',
          phone: phone || '-',
          branch: getStandardBranchName(item.branchName || item.branch || item.branchId || item.clinicBranch || item.location || 'Kphb'),
          doctorName: item.doctor || item.doctorName || 'N/A',
          pendingAmount: 0,
          latestRawDate: rawDate,
          dateRaw,
          dt: parsedDate,
          dateDisplay: safeDateDisplay(dateRaw) || 'N/A'
        });
      }

      const group = patientGroups.get(key);
      group.pendingAmount += pAmt;
    });

    // Cross-reference with allHistoryTransactions to update to the latest visit/transaction date
    allHistoryTransactions.forEach(tx => {
      const phone = (tx.phone || '').trim();
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const key = cleanPhone;

      if (key && patientGroups.has(key)) {
        const group = patientGroups.get(key);
        const rawDate = tx.timestamp || 0;
        if (rawDate > group.latestRawDate) {
          group.latestRawDate = rawDate;
          group.dateRaw = tx.dateTime;
          const parsed = parseAnyDateObj(tx.dateTime);
          group.dt = parsed;
          group.dateDisplay = tx.dateTime;
          if (tx.patientName && tx.patientName !== '-') {
            group.patientName = tx.patientName;
          }
          if (tx.doctorName && tx.doctorName !== 'N/A') {
            group.doctorName = tx.doctorName;
          }
          if (tx.regId && tx.regId !== '-') {
            group.regId = tx.regId;
          }
        }
      }
    });

    const list = Array.from(patientGroups.values()).filter(p => p.pendingAmount > 0);
    return list.sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [pendingRecordsRaw, allHistoryTransactions]);

  // Filtered detailed pending list based on period toggle
  const displayPendingList = useMemo(() => {
    const currentMonth = new Date().getMonth(); // 0-indexed
    const currentYear = new Date().getFullYear();

    return pendingPatientsList.filter(item => {
      if (pendingPeriodFilter === 'this_month') {
        return item.dt && item.dt.getMonth() === currentMonth && item.dt.getFullYear() === currentYear;
      }
      return true;
    });
  }, [pendingPatientsList, pendingPeriodFilter]);

  const filteredHistory = allHistoryTransactions;

  const topSourcesData = useMemo(() => {
    const sourceMap = {};
    let totalSourceRevenue = 0;
    filteredHistory.forEach(tx => {
      const src = tx.source || 'N/A';
      const amt = Number(tx.amount) || 0;

      if (!sourceMap[src]) {
        sourceMap[src] = { source: src, revenue: 0, count: 0 };
      }
      sourceMap[src].revenue += amt;
      sourceMap[src].count += 1;
      totalSourceRevenue += amt;
    });

    return Object.values(sourceMap)
      .map(item => ({
        ...item,
        percentage: totalSourceRevenue > 0 ? ((item.revenue / totalSourceRevenue) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredHistory]);

  // Derived Stats
  const { grandTotalCount, grandTotalAmount, grandCash, grandUpi, grandCard } = useMemo(() => {
    const count = filteredHistory.length;
    let totalAmt = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;

    filteredHistory.forEach(t => {
      const amt = Number(t.amount || 0);
      totalAmt += amt;

      const m = (t.method || '').toUpperCase();
      let details = t.paymentSplitDetails;
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { details = null; }
      }

      if ((m.includes('CASH/UPI') || m.includes('SPLIT') || m.includes('CASH + UPI') || m.includes('CASH+UPI')) && details) {
        cash += Number(details.cash || 0);
        upi += Number(details.upi || 0);
      } else if ((m.includes('CASH/UPI') || m.includes('SPLIT') || m.includes('CASH + UPI') || m.includes('CASH+UPI')) && !details) {
        // Split with no splitDetails — count full amount as total (can't break down further)
        cash += amt;
      } else if (m === 'CASH' || (m.includes('CASH') && !m.includes('UPI') && !m.includes('SPLIT'))) {
        cash += amt;
      } else if (['UPI', 'PHONEPE', 'GPAY', 'ONLINE_RAZORPAY', 'ONLINE', 'APP'].some(u => m.includes(u))) {
        upi += amt;
      } else if (m === 'CARD' || m.includes('CARD')) {
        card += amt;
      }
    });

    return {
      grandTotalCount: count,
      grandTotalAmount: totalAmt,
      grandCash: cash,
      grandUpi: upi,
      grandCard: card
    };
  }, [filteredHistory]);

  // Exact matching split logic — mirrors SuperAdmin exactly
  const { splitCons, splitConsMed, splitDiet, splitPackage } = useMemo(() => {
    let splitCons = 0, splitConsMed = 0, splitDiet = 0, splitPackage = 0;
    const processedDietIds = new Set();
    const processedDietPhones = new Set();

    filteredHistory.forEach(t => {
      const phoneKey = t.phone && t.phone !== '-' ? `${t.phone}` : null;
      const idKey = t.patientId && t.patientId !== '-' ? `${t.patientId}` : null;
      const regKey = t.regId && t.regId !== '-' ? `${t.regId}` : null;
      const nameKey = (t.patientName && t.patientName !== '-' && t.patientName !== 'Online Patient') ? `${t.patientName.toLowerCase().trim()}` : null;

      let isProcessed = false;
      if (idKey && processedDietIds.has(idKey)) isProcessed = true;
      if (regKey && processedDietIds.has(regKey)) isProcessed = true;
      if (phoneKey && processedDietPhones.has(phoneKey)) isProcessed = true;
      if (nameKey && processedDietPhones.has(nameKey)) isProcessed = true;

      const markProcessed = () => {
        if (idKey) processedDietIds.add(idKey);
        if (regKey) processedDietIds.add(regKey);
        if (phoneKey) processedDietPhones.add(phoneKey);
        if (nameKey) processedDietPhones.add(nameKey);
      };

      if (t.itemsPaid) {
        const consAmt = Number(t.itemsPaid.consultation || 0);
        const medAmt = Number(t.itemsPaid.medicine || 0);
        const pkgAmt = Number(t.itemsPaid.package || 0);
        const dietAmt = Number(t.itemsPaid.dietPlan || 0);
        let otherFeesAmt = 0;
        if (Array.isArray(t.itemsPaid.otherFees)) {
          otherFeesAmt = t.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
        }
        const totalItems = consAmt + medAmt + dietAmt + pkgAmt + otherFeesAmt;

        let scale = 1;
        if (totalItems > 0 && Number(t.amount) > 0) {
          scale = Number(t.amount) / totalItems;
        }

        const scaledCons = consAmt * scale;
        const scaledMed = medAmt * scale;
        const scaledDiet = dietAmt * scale;
        const scaledPkg = pkgAmt * scale;

        if (scaledMed > 0) {
          splitConsMed += (scaledCons + scaledMed);
        } else {
          splitCons += scaledCons;
        }
        if (scaledDiet > 0 && !isProcessed) {
          splitDiet += scaledDiet;
          markProcessed();
        }
        if (scaledPkg > 0) splitPackage += scaledPkg;
      } else {
        if (t.type === 'Consultation') splitCons += Number(t.amount || 0);
        else if (t.type === 'Consultation & Medicine Fee' || t.type === 'Medicine Fee' || t.type === 'Pharmacy' || t.type === 'Medicine') splitConsMed += Number(t.amount || 0);
        else if (t.type === 'Diet Plan' || t.type === 'nutrition') {
          if (!isProcessed) {
            splitDiet += Number(t.amount || 0);
            markProcessed();
          }
        } else if (t.type === 'Package') {
          splitPackage += Number(t.amount || 0);
        }
      }
    });
    return { splitCons, splitConsMed, splitDiet, splitPackage };
  }, [filteredHistory]);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage) || 1;
  const indexOfFirstAllTx = (currentPage - 1) * rowsPerPage;
  const indexOfLastAllTx = currentPage * rowsPerPage;
  const currentList = useMemo(() => {
    return filteredHistory.slice(indexOfFirstAllTx, indexOfLastAllTx);
  }, [filteredHistory, indexOfFirstAllTx, indexOfLastAllTx]);

  const handleResetFilters = () => {
    setRevenueSearch('');
    setRevenueBranchId('all');
    setRevenueDate('');
    setRevenueYear(String(new Date().getFullYear()));
    setRevenueMonth(String(new Date().getMonth() + 1));
    setRevenueSource('all');
    setRevenueMethod('all');
    setRevenueSplitType('all');
    setRevenueAmountRange('all');
    setRevenueDoctor('all');
    setCurrentPage(1);
  };

  const handleExportToExcel = () => {
    if (filteredHistory.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["S.N.O", "Reg ID", "Patient Name", "Phone", "Branch", "Doctor Treated", "Revenue Split", "Source", "Amount", "Method", "Date / Time", "Status"];
    const rows = filteredHistory.map((tx, index) => {
      const sno = index + 1;
      const regId = tx.regId || "-";
      const name = tx.patientName || "-";
      const phone = tx.phone || "-";
      const branch = tx.branch || "-";
      const doctor = tx.doctorName || "-";
      const split = tx.type || "-";
      const source = tx.source || "-";
      const amount = tx.amount || 0;
      const method = tx.method || "-";
      const dateTime = tx.dateTime || "-";
      const status = tx.status || "-";
      return [
        sno,
        `"${regId.replace(/"/g, '""')}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${phone.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        `"${doctor.replace(/"/g, '""')}"`,
        `"${split.replace(/"/g, '""')}"`,
        `"${source.replace(/"/g, '""')}"`,
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
    link.setAttribute("download", `hr_revenue_report_${dateSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading revenue data...</div>;
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h2>Total Revenue Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Track all consultation, pharmacy, and medicine fees collected across branches</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {fixResult && (
            <span style={{
              fontSize: '0.78rem', padding: '6px 12px', borderRadius: '8px',
              background: fixResult.errors > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              color: fixResult.errors > 0 ? '#ef4444' : '#10b981', fontWeight: 600
            }}>
              ✅ Fixed {fixResult.fixed} IDs &nbsp;|&nbsp; Skipped {fixResult.skipped}
              {fixResult.errors > 0 && ` | ${fixResult.errors} errors`}
            </span>
          )}
          <button
            onClick={fixTodayPatientIds}
            disabled={fixingIds}
            title="Regenerate today's new patient IDs to the new standard format"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #f59e0b',
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              cursor: fixingIds ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem',
              opacity: fixingIds ? 0.6 : 1
            }}
          >
            <Wrench size={14} />
            {fixingIds ? 'Fixing...' : "Fix Today's Patient IDs"}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--primary-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Grand Total Revenue</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>₹{grandTotalAmount.toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>{grandTotalCount} Transactions</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Total By Mode</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
            <div className="flex-between"><span>Cash</span> <strong style={{ color: '#f59e0b' }}>₹{grandCash.toLocaleString('en-IN')}</strong></div>
            <div className="flex-between"><span>UPI</span> <strong style={{ color: '#0ea5e9' }}>₹{grandUpi.toLocaleString('en-IN')}</strong></div>
            <div className="flex-between"><span>Card</span> <strong style={{ color: '#10b981' }}>₹{grandCard.toLocaleString('en-IN')}</strong></div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Revenue Split</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
            <div className="flex-between"><span>Consultation</span> <strong style={{ color: '#8b5cf6' }}>₹{splitCons.toLocaleString('en-IN')}</strong></div>
            <div className="flex-between"><span>Consultation & Medicine Fee</span> <strong style={{ color: '#14b8a6' }}>₹{splitConsMed.toLocaleString('en-IN')}</strong></div>
            <div className="flex-between"><span>Diet Plan</span> <strong style={{ color: '#f43f5e' }}>₹{splitDiet.toLocaleString('en-IN')}</strong></div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Patient Sources</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
            {topSourcesData.slice(0, 3).map(item => (
              <div key={item.source} className="flex-between">
                <span>{item.source}</span>
                <strong style={{ color: '#3b82f6' }}>₹{item.revenue.toLocaleString('en-IN')} ({item.percentage}%)</strong>
              </div>
            ))}
            {topSourcesData.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No source data</div>}
          </div>
        </div>
      </div>


      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Patient</label>
          <input
            type="text"
            placeholder="Name or phone..."
            className="glass-input"
            value={revenueSearch}
            onChange={(e) => { setRevenueSearch(e.target.value); setCurrentPage(1); }}
            style={{ fontSize: '0.85rem', padding: '8px 12px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter Branch</label>
          <select
            className="glass-input"
            value={revenueBranchId}
            onChange={(e) => { setRevenueBranchId(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueDate(e.target.value); setRevenueYear('all'); setRevenueMonth('all'); setCurrentPage(1); }}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            style={{ colorScheme: 'dark', fontSize: '0.85rem', padding: '8px 12px', cursor: 'pointer' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Year</label>
          <select
            className="glass-input"
            value={revenueYear}
            onChange={(e) => { setRevenueYear(e.target.value); setRevenueDate(''); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueMonth(e.target.value); setRevenueDate(''); if (revenueYear === 'all') setRevenueYear(new Date().getFullYear().toString()); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueDoctor(e.target.value); setCurrentPage(1); }}
            style={{ background: 'var(--bg-dark)', fontSize: '0.85rem', padding: '8px 12px' }}
          >
            <option value="all">All Doctors</option>
            <option value="Dr. Prashanth K Vaidya">Dr. Prashanth K Vaidya</option>
            <option value="Dr. Jobedah Parveej">Dr. Jobedah Parveej</option>
            <option value="Dr. Padma Priya">Dr. Padma Priya</option>
            <option value="Dr. Ramakrishna Chanduri">Dr. Ramakrishna Chanduri</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Patient Source</label>
          <select
            className="glass-input"
            value={revenueSource}
            onChange={(e) => { setRevenueSource(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueMethod(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueSplitType(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setRevenueAmountRange(e.target.value); setCurrentPage(1); }}
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
          <button onClick={handleResetFilters} className="btn-secondary" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={handleExportToExcel} className="btn-primary" style={{ flex: 1, padding: '8px', background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <ExternalLink size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveView('logs')}
          className={`tab-btn ${activeView === 'logs' ? 'active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            background: activeView === 'logs' ? 'var(--primary-color)' : 'transparent',
            color: activeView === 'logs' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
            fontSize: '0.85rem'
          }}
        >
          Transaction Logs ({filteredHistory.length})
        </button>
        <button
          onClick={() => setActiveView('sources')}
          className={`tab-btn ${activeView === 'sources' ? 'active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            background: activeView === 'sources' ? 'var(--primary-color)' : 'transparent',
            color: activeView === 'sources' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
            fontSize: '0.85rem'
          }}
        >
          Top Patient Sources
        </button>
      </div>

      {activeView === 'logs' ? (
        <>
          <div className="table-container glass-panel">
            <table>
              <thead>
                <tr>
                  <th>S.N.O</th>
                  <th>Reg ID</th>
                  <th>Patient Name</th>
                  <th>Phone</th>
                  <th>Branch</th>
                  <th>Doctor Treated</th>
                  <th>Revenue Split</th>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date / Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr><td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                ) : currentList.map((tx, idx) => (
                  <tr key={tx.id}>
                    <td>{indexOfFirstAllTx + idx + 1}</td>
                    <td style={{ color: 'var(--primary-color)', fontWeight: '600' }}>{tx.regId}</td>
                    <td style={{ fontWeight: 500 }}>{tx.patientName}</td>
                    <td>{tx.phone}</td>
                    <td><span className="badge" style={{ background: 'rgba(37, 142, 200, 0.1)', color: '#0ea5e9' }}>{tx.branch}</span></td>
                    <td>{tx.doctorName}</td>
                    <td><span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>{tx.type}</span></td>
                    <td><span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>{tx.source}</span></td>
                    <td style={{ fontWeight: 'bold' }}>₹{tx.amount}</td>
                    <td>
                      <span className="badge" style={{
                        background: tx.method === 'CASH' ? 'rgba(245, 158, 11, 0.1)' :
                          tx.method === 'UPI' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tx.method === 'CASH' ? '#f59e0b' :
                          tx.method === 'UPI' ? '#0ea5e9' : '#10b981'
                      }}>
                        {tx.method}
                      </span>
                    </td>
                    <td>{tx.dateTime}</td>
                    <td>
                      <span className="badge" style={{
                        background: tx.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: tx.status === 'PAID' ? '#10b981' : '#ef4444'
                      }}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredHistory.length > 0 && (
            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rows per page:</span>
                <select
                  className="glass-input"
                  style={{ padding: '4px 8px', width: 'auto', fontSize: '0.85rem' }}
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="75">75</option>
                </select>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Showing {indexOfFirstAllTx + 1} to {Math.min(indexOfLastAllTx, filteredHistory.length)} of {filteredHistory.length} entries
                </span>
              </div>

              <div className="pagination-controls" style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="table-container glass-panel">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px' }}>Rank</th>
                <th style={{ padding: '12px 16px' }}>Source Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Revenue</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Transactions Count</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Percentage of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topSourcesData.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No source data found.</td></tr>
              ) : topSourcesData.map((item, idx) => (
                <tr key={item.source} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-muted)' }}>#{idx + 1}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--primary-color)' }}>{item.source}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'right' }}>₹{item.revenue.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
                      {item.count} Patients
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'right', color: '#10b981' }}>{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HRTotalRevenue;
