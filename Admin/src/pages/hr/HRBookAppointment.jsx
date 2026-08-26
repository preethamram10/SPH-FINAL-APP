import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import {
  collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp, setDoc
} from 'firebase/firestore';
import {
  User, Phone, Mail, Megaphone, Stethoscope, BookOpen,
  Calendar, Building2, Search, X, UserSearch, CalendarPlus,
  Clock, CheckCircle, ChevronDown
} from 'lucide-react';
import { generateRegistrationId, getStandardBranchName } from '../../utils/idGenerator';
import { checkIsInDuration } from '../reception/Rejoin/index';

// ─── SMS Helper (inline) ────────────────────────────────────────────────────
const _SMS_CFG = {
  username: 'SPHOMEO',
  apikey: 'b93e415cf967f949dfff',
  senderid: 'SPHMEO',
  templateid: '1777178462816194857',
};

const _normalisePhone = (phone) => {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d;
};

const _sendBookingSMS = (phone, patientName, doctorName, date, time, branchName) => {
  const mobile = _normalisePhone(phone);
  if (!mobile || mobile.length < 10) return;
  const cleanDocName = doctorName ? doctorName.replace(/^(dr\.|dr)\s+/i, '').trim() : '';
  const message =
    `Dear ${patientName}, your appointment has been booked successfully.\n\n` +
    `Doctor: Dr. ${cleanDocName}\n` +
    `Date: ${date} | Time: ${time}\n` +
    `Branch: ${branchName}\n\n` +
    `Website: www.spiritualhomeoclinic.com\n` +
    `Phone: 9069 176 176\n` +
    `Spiritual Homeopathy Clinics`;
  const params = new URLSearchParams({
    username: _SMS_CFG.username,
    apikey: _SMS_CFG.apikey,
    senderid: _SMS_CFG.senderid,
    mobile,
    message,
    templateid: _SMS_CFG.templateid,
  });
  fetch('https://smslogin.co/v3/api.php?' + params.toString())
    .then(r => r.text())
    .then(t => console.log('[SMS] Sent. Response:', t))
    .catch(e => console.warn('[SMS] Non-critical failure:', e));
};
// ─────────────────────────────────────────────────────────────────────────────

const DOCTOR_SCHEDULES = {
  'Dr. Prashanth K Vaidya': {
    branches: ['Kphb', 'Chandanagar', 'Nallagandla'],
    timings: [
      { branch: 'Kphb', dayOfWeek: [1, 3, 5, 6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] },
      { branch: 'Chandanagar', dayOfWeek: [1, 3, 5, 6], intervals: [['10:00', '12:00'], ['19:30', '21:00']] },
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['11:00', '13:00']] },
      { branch: 'Nallagandla', dayOfWeek: [4], intervals: [['11:00', '13:00'], ['18:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['18:00', '20:00']] }
    ]
  },
  'Dr. Ramakrishna Chanduri': {
    branches: ['Dilshuknagar', 'Nallagandla'],
    timings: [
      { branch: 'Dilshuknagar', dayOfWeek: [0, 1, 2, 3, 4], intervals: [['10:00', '14:00'], ['17:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [5, 6], intervals: [['10:00', '20:00']] }
    ]
  },
  'Dr. Jobedah Parveej': {
    branches: ['Nallagandla', 'Kphb'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [1], intervals: [['11:00', '13:00'], ['18:00', '19:30']] },
      { branch: 'Kphb', dayOfWeek: [2, 3, 5], intervals: [['12:30', '14:00']] },
      { branch: 'Kphb', dayOfWeek: [6], intervals: [['12:30', '14:00'], ['17:00', '19:00']] }
    ]
  },
  'Dr. Padma Priya': {
    branches: ['Nallagandla', 'Chandanagar'],
    timings: [
      { branch: 'Nallagandla', dayOfWeek: [2, 3], intervals: [['10:00', '20:00']] },
      { branch: 'Nallagandla', dayOfWeek: [0], intervals: [['10:00', '17:00']] },
      { branch: 'Chandanagar', dayOfWeek: [1, 5], intervals: [['12:00', '20:00']] },
      { branch: 'Chandanagar', dayOfWeek: [0], intervals: [['17:30', '20:00']] },
      { branch: 'Chandanagar', dayOfWeek: [4], intervals: [['10:00', '20:00']] }
    ]
  }
};


const normalizeBranchName = (name) => {
  return getStandardBranchName(name).toLowerCase();
};

const getDoctorSchedulesAndTimings = (doctorName, doctorObj) => {
  if (doctorObj && doctorObj.timings && Array.isArray(doctorObj.timings) && doctorObj.timings.length > 0) {
    return doctorObj.timings;
  }
  if (!doctorName) return [];
  const cleanName = doctorName.toLowerCase().replace('dr. ', '').replace('dr ', '').trim();
  for (const [key, value] of Object.entries(DOCTOR_SCHEDULES)) {
    if (key.toLowerCase().replace('dr. ', '').replace('dr ', '').trim() === cleanName) {
      return value.timings;
    }
  }
  const defaultBranches = ['Kphb', 'Chandanagar', 'Nallagandla', 'Dilshuknagar'];
  return defaultBranches.map(brName => ({
    branch: brName,
    dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
    intervals: [['10:00', '14:00'], ['17:00', '20:00']]
  }));
};

const parseDateStringToLocal = (dateStr) => {
  if (!dateStr) return null;
  let normalized = dateStr;
  if (typeof dateStr === 'object' && dateStr.seconds) {
    const d = new Date(dateStr.seconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    normalized = `${y}-${m}-${day}`;
  }
  if (typeof normalized !== 'string') return null;
  const clean = normalized.trim().split('T')[0];
  const parts = clean.split(/[-/]/);
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  if (parts[2].length === 4) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return null;
};

const isDoctorScheduledAtBranchOnDate = (doctorObj, branchName, dateObj) => {
  if (!doctorObj || !branchName || !dateObj || isNaN(dateObj.getTime())) return true;
  const day = dateObj.getDay();
  const doctorName = typeof doctorObj === 'string' ? doctorObj : (doctorObj?.name || doctorObj?.doctorName || '');
  const timings = getDoctorSchedulesAndTimings(doctorName, doctorObj);
  if (!timings || timings.length === 0) return true;
  
  return timings.some(t => {
    if (getStandardBranchName(t.branch).toLowerCase() !== getStandardBranchName(branchName).toLowerCase()) return false;
    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      return ivs.length > 0;
    }
    if (t.dayOfWeek) {
      return t.dayOfWeek.includes(day);
    }
    return true;
  });
};

const generateSlotsForSelected = (doctorName, doctorObj, branchName, dateString) => {
  if (!doctorName || !branchName || !dateString) return [];
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) return [];
  const date = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
  const day = date.getDay();
  const timings = getDoctorSchedulesAndTimings(doctorName, doctorObj);

  const dayTimings = [];
  (timings || []).forEach(t => {
    if (normalizeBranchName(t.branch) !== normalizeBranchName(branchName)) return;
    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      if (ivs.length > 0) {
        dayTimings.push({ intervals: ivs });
      }
    } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
      dayTimings.push({ intervals: t.intervals || [] });
    }
  });

  if (dayTimings.length === 0) return [];
  const slots = [];
  dayTimings.forEach(t => {
    (t.intervals || []).forEach(iv => {
      const startStr = Array.isArray(iv) ? iv[0] : (iv ? iv.start : '');
      const endStr = Array.isArray(iv) ? iv[1] : (iv ? iv.end : '');
      if (!startStr || !endStr) return;
      const [startHour, startMin] = startStr.split(':').map(Number);
      const [endHour, endMin] = endStr.split(':').map(Number);
      let currentHour = startHour;
      let currentMin = startMin;
      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const period = currentHour >= 12 ? 'PM' : 'AM';
        const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
        const formattedTime = `${displayHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')} ${period}`;
        slots.push(formattedTime);
        currentMin += 15;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }
    });
  });
  return slots;
};

const CustomSelect = ({ value, onChange, options, disabled, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, height: '100%' }}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '100%', cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0 0 0 10px', fontSize: '0.85rem', color: disabled ? '#94a3b8' : 'var(--text-main)',
          userSelect: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? options.find(o => o.value === value)?.label || value : placeholder}
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </div>

      {isOpen && !disabled && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto',
          padding: '6px'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem',
                cursor: 'pointer', backgroundColor: value === opt.value ? 'rgba(168,206,58,0.1)' : 'transparent',
                color: value === opt.value ? 'var(--primary-color)' : 'var(--text-main)',
                fontWeight: value === opt.value ? '700' : '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function HRBookAppointment() {
  const [doctors, setDoctors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [existingProfilesModalVisible, setExistingProfilesModalVisible] = useState(false);
  const [existingProfilesList, setExistingProfilesList] = useState([]);
  const [checkedPhone, setCheckedPhone] = useState('');
  const [checkingProfilesLoading, setCheckingProfilesLoading] = useState(false);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [bookedPatientInfo, setBookedPatientInfo] = useState(null);

  const [patientForm, setPatientForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    source: 'Walk-in',
    modeOfConsultation: 'In-Clinic',
    subject: '',
    branch: '',
    doctor: '',
    appointmentDate: '',
    appointmentTime: '',
    patientId: '',
    registrationId: ''
  });

  const findProfilesByPhone = async (rawPhone) => {
    if (!rawPhone) return [];
    const clean = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (clean.length < 10) return [];

    const possibleValues = [
      clean,
      rawPhone.trim(),
      `+91${clean}`,
      `+91 ${clean}`,
      `91${clean}`
    ];
    const numClean = Number(clean);
    if (!isNaN(numClean)) possibleValues.push(numClean);

    const safeQuery = (q) => getDocs(q).catch(() => ({ docs: [] }));
    const promises = [];

    for (const val of possibleValues) {
      promises.push(safeQuery(query(collection(db, 'allpatients'), where('phone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'patients'), where('phone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'allpatients'), where('patientPhone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'patients'), where('patientPhone', '==', val), limit(20))));
      promises.push(safeQuery(query(collection(db, 'users'), where('phone', '==', val), limit(20))));
    }

    promises.push(safeQuery(query(collection(db, 'allpatients'), limit(150))));
    promises.push(safeQuery(query(collection(db, 'patients'), limit(150))));

    const snapshots = await Promise.all(promises);
    const profilesMap = new Map();

    snapshots.forEach(snap => {
      if (!snap || !snap.docs) return;
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const pName = data.fullName || data.patientName || data.name;
        const docPhone = data.phone || data.patientPhone || data.phoneNumber || data.mobile || '';
        const cleanDocPhone = String(docPhone).replace(/\D/g, '').slice(-10);

        if (pName && cleanDocPhone.length === 10 && cleanDocPhone === clean) {
          const key = (data.registrationId || data.regId || docSnap.id).toLowerCase();
          if (!profilesMap.has(key)) {
            profilesMap.set(key, {
              id: docSnap.id,
              fullName: pName,
              registrationId: data.registrationId || data.regId || docSnap.id,
              phone: docPhone || clean,
              gender: data.gender || '',
              age: data.age || '',
              source: data.source || 'Registered Patient',
              branchName: data.branchName || ''
            });
          }
        }
      });
    });

    return Array.from(profilesMap.values());
  };

  const handleManualPhoneCheck = async (phoneVal) => {
    const clean = phoneVal.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }
    setCheckingProfilesLoading(true);
    try {
      const list = await findProfilesByPhone(phoneVal);
      if (list.length > 0) {
        setExistingProfilesList(list);
        setCheckedPhone(clean);
        setExistingProfilesModalVisible(true);
      } else {
        alert(`No existing patient profiles found for +91 ${clean}. Entering details will create a new patient profile.`);
      }
    } catch (err) {
      console.error("Manual check error:", err);
      alert("Unable to check profiles right now. Please try again.");
    } finally {
      setCheckingProfilesLoading(false);
    }
  };

  const handlePhoneInputChange = (e) => {
    const text = e.target.value;
    setPatientForm(prev => ({ ...prev, phone: text }));
    const clean = text.replace(/\D/g, '').slice(-10);
    if (clean.length === 10) {
      handleManualPhoneCheck(text);
    }
  };

  const handleSelectExistingProfile = (prof) => {
    setPatientForm(prev => ({
      ...prev,
      fullName: prof.fullName,
      phone: prof.phone,
      source: 'Old Patient',
      patientId: prof.id,
      registrationId: prof.registrationId
    }));
    setExistingProfilesModalVisible(false);
  };

  const handleCreateNewFamilyProfile = () => {
    setPatientForm(prev => ({
      ...prev,
      patientId: '',
      registrationId: ''
    }));
    setExistingProfilesModalVisible(false);
  };

  useEffect(() => {
    // Load Doctors
    const qDocs = query(collection(db, 'users'), where('role', '==', 'doctor'));
    getDocs(qDocs).then(snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDoctors(list);
    });

    // Load Branches
    const qBranches = query(collection(db, 'users'), where('role', '==', 'branch'));
    getDocs(qBranches).then(snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setBranches(list);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchSlots = async () => {
      if (patientForm.doctor && patientForm.branch && patientForm.appointmentDate) {
        const selectedDoc = doctors.find(d => d.name === patientForm.doctor);
        let slots = generateSlotsForSelected(patientForm.doctor, selectedDoc, patientForm.branch, patientForm.appointmentDate);

        try {
          const doctorId = selectedDoc?.id || patientForm.doctor;
          const targetBranch = normalizeBranchName(patientForm.branch);
          const qExtra = query(
            collection(db, 'extra_slots'),
            where('doctorId', '==', doctorId),
            where('dateString', '==', patientForm.appointmentDate)
          );
          const snap = await getDocs(qExtra);
          let extra = [];
          snap.forEach(d => {
            const dbBranch = normalizeBranchName(d.data().branchName || d.data().branchId);
            if (dbBranch === targetBranch && d.data().slots) {
              extra = [...extra, ...d.data().slots];
            }
          });
          slots = [...new Set([...slots, ...extra])];

          slots.sort((a, b) => {
            const parseToMin = (t) => {
              const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
              if (!m) return 0;
              let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
              if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
              if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
              return h * 60 + min;
            };
            return parseToMin(a) - parseToMin(b);
          });
        } catch (e) { console.error(e); }

        if (isMounted) setAvailableSlots(slots);
      } else {
        if (isMounted) setAvailableSlots([]);
      }
    };
    fetchSlots();
    return () => { isMounted = false; };
  }, [patientForm.doctor, patientForm.branch, patientForm.appointmentDate, doctors]);

  const handleSearchPatient = async (e) => {
    const text = e.target.value;
    setGlobalSearchText(text);
    if (!text.trim()) {
      setGlobalSearchResults([]);
      return;
    }
    setIsSearchingGlobal(true);
    try {
      const cleanQuery = text.trim();
      const list = [];
      const seen = new Set();
      const patientsRef = collection(db, 'allpatients');

      const addResults = (snapshot) => {
        snapshot.forEach(docSnap => {
          if (!seen.has(docSnap.id)) {
            seen.add(docSnap.id);
            list.push({ id: docSnap.id, ...docSnap.data() });
          }
        });
      };

      if (/^\d+$/.test(cleanQuery)) {
        const cleanPhone = cleanQuery.slice(-10);
        const q1 = query(patientsRef, where('phone', '==', cleanPhone));
        const q2 = query(patientsRef, where('phone', '==', `+91${cleanPhone}`));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        addResults(snap1);
        addResults(snap2);
      } else if (cleanQuery.toLowerCase().startsWith('wk-') || cleanQuery.toLowerCase().startsWith('sph-')) {
        const qReg = query(patientsRef, where('registrationId', '==', cleanQuery.toUpperCase()));
        const snap = await getDocs(qReg);
        addResults(snap);
      } else {
        const searchNameCap = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
        const searchNameLower = cleanQuery.toLowerCase();
        const q1 = query(patientsRef, where('fullName', '>=', searchNameCap), where('fullName', '<=', searchNameCap + '\uf8ff'), limit(15));
        const q2 = query(patientsRef, where('fullName', '>=', searchNameLower), where('fullName', '<=', searchNameLower + '\uf8ff'), limit(15));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        addResults(snap1);
        addResults(snap2);
      }

      setGlobalSearchResults(list.slice(0, 10));
    } catch (err) {
      console.warn("Search error:", err);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!patientForm.fullName || !patientForm.phone || !patientForm.doctor || !patientForm.appointmentDate || !patientForm.appointmentTime) {
      alert('Please fill out Name, Phone, Doctor, Appointment Date, and select an Available Time Slot.');
      return;
    }

    try {
      const formatToAppDate = (htmlDateStr) => {
        if (!htmlDateStr) return '';
        const parts = htmlDateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return htmlDateStr;
      };

      const finalAppDate = formatToAppDate(patientForm.appointmentDate);
      const cleanPhone = patientForm.phone.replace(/\D/g, '').slice(-10);
      const regId = patientForm.registrationId || await generateRegistrationId(patientForm.branch);

      const selectedDocObj = doctors.find(d => d.name === patientForm.doctor);
      const doctorId = selectedDocObj ? selectedDocObj.id : '';
      const specialty = selectedDocObj?.specialty || 'Homeopathic Physician';
      const doctorImage = selectedDocObj?.image || '';

      const apptDateObj = new Date(patientForm.appointmentDate);
      const dateISO = apptDateObj.toISOString();
      const dateString = dateISO.split('T')[0];

      // Check if patient has active treatment duration
      let inDuration = false;
      let existingFollowUpDate = '';
      if (patientForm.patientId) {
        const pRef = doc(db, 'allpatients', patientForm.patientId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const data = pSnap.data();
          const followUpDate = data.followUpDate;
          if (followUpDate && checkIsInDuration(followUpDate)) {
            inDuration = true;
            existingFollowUpDate = followUpDate;
          }
        }
      }

      const apptId = doc(collection(db, 'allpatients')).id;

      // 1. Create walk-in patient document in allpatients
      await setDoc(doc(db, 'allpatients', apptId), {
        id: apptId,
        patientId: apptId,
        patientName: patientForm.fullName,
        fullName: patientForm.fullName,
        phone: cleanPhone,
        patientPhone: cleanPhone,
        email: patientForm.email,
        age: '',
        gender: '',

        branchId: getStandardBranchName(patientForm.branch || 'Kphb'),
        branchName: getStandardBranchName(patientForm.branch || 'Kphb'),

        doctorId: doctorId,
        doctorName: patientForm.doctor,
        doctor: patientForm.doctor,
        specialty: specialty,
        doctorImage: doctorImage,

        date: dateISO,
        dateString: dateString,
        appointmentDate: finalAppDate,

        timeSlot: patientForm.appointmentTime,
        appointmentTime: patientForm.appointmentTime,

        subject: patientForm.subject,
        symptoms: patientForm.subject,
        complaint: patientForm.subject,

        registeredBy: auth.currentUser?.displayName || auth.currentUser?.email || 'HR Portal',
        status: 'waiting',
        paymentStatus: inDuration ? 'paid' : 'pending',
        paymentId: inDuration ? 'IN_DURATION_FREE' : 'WALKIN_PENDING',
        consultationFee: inDuration ? 0 : '',
        isInDuration: inDuration,
        followUpDate: existingFollowUpDate || '',
        registrationId: regId,
        rewardPoints: 0,
        amountPaid: 0,

        createdAt: serverTimestamp(),
        bookedAt: serverTimestamp(),
        checkedInAt: serverTimestamp(),

        source: patientForm.source || 'Walk-in',
        modeOfConsultation: patientForm.modeOfConsultation || 'In-Clinic',
        appointmentId: apptId
      });

      // Notify all HR users about this booking
      try {
        const qHr = query(collection(db, 'users'), where('role', '==', 'hr'));
        const snapHr = await getDocs(qHr);
        snapHr.forEach(async (docSnap) => {
          const hrUser = docSnap.data();
          await addDoc(collection(db, 'notifications'), {
            userId: hrUser.uid || docSnap.id,
            title: '📅 New Appointment Alert',
            body: `${patientForm.fullName} booked with ${patientForm.doctor ? (patientForm.doctor.toLowerCase().startsWith('dr') ? patientForm.doctor : `Dr. ${patientForm.doctor}`) : 'Doctor'} on ${finalAppDate} at ${patientForm.appointmentTime} (${getStandardBranchName(patientForm.branch)}).`,
            type: 'new_booking_hr_alert',
            isRead: false,
            createdAt: serverTimestamp(),
            metadata: {
              appointmentId: apptId,
              patientName: patientForm.fullName,
              date: finalAppDate,
              timeSlot: patientForm.appointmentTime,
              branchName: getStandardBranchName(patientForm.branch)
            }
          });
        });
      } catch (hrNotifErr) {
        console.warn("Error notifying HRs of new booking:", hrNotifErr);
      }

      // Send SMS confirmation (fire-and-forget, non-blocking)
      try {
        _sendBookingSMS(
          patientForm.phone,
          patientForm.fullName,
          patientForm.doctor,
          finalAppDate,
          patientForm.appointmentTime,
          `${patientForm.branch} Branch`
        );
      } catch (smsErr) {
        console.warn('[SMS] Non-critical booking SMS error:', smsErr);
      }

      setBookedPatientInfo({
        name: patientForm.fullName,
        doctor: patientForm.doctor,
        branch: `${patientForm.branch} Branch`
      });
      setShowBookingSuccess(true);

      setPatientForm({
        fullName: '',
        phone: '',
        email: '',
        source: 'Walk-in',
        modeOfConsultation: 'In-Clinic',
        subject: '',
        branch: '',
        doctor: '',
        appointmentDate: '',
        appointmentTime: '',
        patientId: '',
        registrationId: ''
      });
    } catch (err) {
      alert("Error booking appointment: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: 'var(--primary-color)', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarPlus size={24} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>Book Appointment</h2>
          <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Schedule patient visits from HR Portal</p>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', borderRadius: '8px', padding: '6px 12px', border: '1px solid var(--border-color)' }}>
          <Search size={18} color="var(--text-muted)" style={{ margin: '0 8px' }} />
          <input
            type="text"
            placeholder="Search existing patients to prefill..."
            value={globalSearchText}
            onChange={handleSearchPatient}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: 'var(--text-main)' }}
          />
          {isSearchingGlobal && <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', marginRight: '12px' }}>Searching...</span>}
          {globalSearchText.length > 0 && (
            <button type="button" onClick={() => { setGlobalSearchText(''); setGlobalSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '12px' }}>
              <X size={18} color="var(--text-muted)" />
            </button>
          )}
        </div>

        {globalSearchResults.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid var(--border-color)', maxHeight: '250px', overflowY: 'auto' }}>
            {globalSearchResults.map((patient) => (
              <div
                key={patient.id}
                onClick={() => {
                  setPatientForm({
                    ...patientForm,
                    fullName: patient.fullName || '',
                    phone: patient.phone || '',
                    email: patient.email || '',
                    source: patient.source || 'Walk-in',
                    patientId: patient.id || '',
                    registrationId: patient.registrationId || patient.regId || '',
                    subject: patient.subject || patient.complaint || patient.disease || patient.symptoms || ''
                  });
                  setGlobalSearchText('');
                  setGlobalSearchResults([]);
                }}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(14,165,233,0.1)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  {(patient.fullName || 'P').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {patient.fullName}
                    {patient.followUpDate && checkIsInDuration(patient.followUpDate) && (
                      <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                        In Duration
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {patient.phone} • Branch: {patient.branchName || 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleRegisterPatient}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={18} color="var(--primary-color)" />
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)' }}>Patient Information</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Patient Name</label>
              <input
                type="text"
                required
                className="glass-input"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={patientForm.fullName}
                onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>Phone Number (+91)</label>
                {patientForm.phone.replace(/\D/g, '').length >= 10 && (
                  <button
                    type="button"
                    onClick={() => handleManualPhoneCheck(patientForm.phone)}
                    disabled={checkingProfilesLoading}
                    style={{ background: 'none', border: 'none', color: checkingProfilesLoading ? '#94a3b8' : 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '700', cursor: checkingProfilesLoading ? 'wait' : 'pointer' }}
                  >
                    {checkingProfilesLoading ? 'Checking...' : 'Check Profiles'}
                  </button>
                )}
              </div>
              <input
                type="tel"
                required
                className="glass-input"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={patientForm.phone}
                onChange={handlePhoneInputChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Email Address</label>
              <input
                type="email"
                className="glass-input"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={patientForm.email}
                onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Diseases</label>
              <input
                type="text"
                className="glass-input"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={patientForm.subject}
                onChange={e => setPatientForm({ ...patientForm, subject: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} color="var(--primary-color)" />
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)' }}>Appointment Details</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Mode of Consultation</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', height: '42px', display: 'flex', alignItems: 'center' }}>
                <CustomSelect
                  value={patientForm.modeOfConsultation}
                  onChange={val => setPatientForm({ ...patientForm, modeOfConsultation: val, doctor: '', appointmentTime: '' })}
                  placeholder="-- Select Mode --"
                  options={[{ value: 'In-Clinic', label: 'In-Clinic' }, { value: 'Online', label: 'Online' }]}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Select Branch</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', height: '42px', display: 'flex', alignItems: 'center' }}>
                <CustomSelect
                  value={patientForm.branch}
                  onChange={val => setPatientForm({ ...patientForm, branch: val, doctor: '', appointmentTime: '' })}
                  placeholder="-- Select Branch --"
                  options={['Kphb', 'Chandanagar', 'Nallagandla', 'Dilshuknagar'].map(b => ({ value: b, label: b }))}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Select Doctor</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', height: '42px', display: 'flex', alignItems: 'center' }}>
                <CustomSelect
                  value={patientForm.doctor}
                  disabled={!patientForm.branch}
                  onChange={val => setPatientForm({ ...patientForm, doctor: val, appointmentTime: '' })}
                  placeholder="-- Select Doctor --"
                  options={doctors.filter(d => {
                    if (patientForm.modeOfConsultation === 'Online') return true;
                    if (!patientForm.branch) return false;
                    const dObj = parseDateStringToLocal(patientForm.appointmentDate);
                    return isDoctorScheduledAtBranchOnDate(d, patientForm.branch, dObj);
                  }).map(d => ({ value: d.name, label: `${d.name} (${d.specialty || 'Physician'})` }))}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>Appointment Date</label>
              <input
                type="date"
                required
                className="glass-input"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={patientForm.appointmentDate}
                onChange={e => setPatientForm({ ...patientForm, appointmentDate: e.target.value, appointmentTime: '' })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Select Time Slot</span>
                {patientForm.doctor && patientForm.branch && patientForm.appointmentDate && (
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem' }}>
                    <span onClick={() => {
                      if (availableSlots.length > 0) {
                        const first = availableSlots[0];
                        const match = first.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (match) {
                          let h = parseInt(match[1], 10);
                          let m = parseInt(match[2], 10);
                          const ampm = match[3].toUpperCase();
                          if (ampm === 'PM' && h < 12) h += 12;
                          if (ampm === 'AM' && h === 12) h = 0;
                          let tot = h * 60 + m - 15;
                          if (tot < 0) tot += 1440;
                          let nH = Math.floor(tot / 60) % 24;
                          let nM = tot % 60;
                          let nAmpm = nH >= 12 ? 'PM' : 'AM';
                          let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
                          const newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
                          setAvailableSlots(prev => [newSlot, ...prev]);
                        }
                      }
                    }} style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '700' }}>+ Before</span>
                    <span onClick={() => {
                      if (availableSlots.length > 0) {
                        const last = availableSlots[availableSlots.length - 1];
                        const match = last.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (match) {
                          let h = parseInt(match[1], 10);
                          let m = parseInt(match[2], 10);
                          const ampm = match[3].toUpperCase();
                          if (ampm === 'PM' && h < 12) h += 12;
                          if (ampm === 'AM' && h === 12) h = 0;
                          let tot = h * 60 + m + 15;
                          let nH = Math.floor(tot / 60) % 24;
                          let nM = tot % 60;
                          let nAmpm = nH >= 12 ? 'PM' : 'AM';
                          let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
                          const newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
                          setAvailableSlots(prev => [...prev, newSlot]);
                        }
                      }
                    }} style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '700' }}>+ After</span>
                  </div>
                )}
              </label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', height: '42px', display: 'flex', alignItems: 'center' }}>
                <CustomSelect
                  value={patientForm.appointmentTime}
                  disabled={availableSlots.length === 0}
                  onChange={val => setPatientForm({ ...patientForm, appointmentTime: val })}
                  placeholder={availableSlots.length === 0 ? "No Slots Available" : "-- Select Slot --"}
                  options={availableSlots.map(s => ({ value: s, label: s }))}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CalendarPlus size={18} /> Book Appointment & Confirm
          </button>
        </form>
      </div>

      {/* Existing Mobile Profiles Web Modal */}
      {existingProfilesModalVisible && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary-color)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#1e293b' }}>Existing Profiles Found</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Multiple family members share this mobile number</p>
                </div>
              </div>
              <button onClick={() => setExistingProfilesModalVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#d48806' }}>
                  📱 Phone Number: +91 {checkedPhone}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#8c6b00', marginTop: '4px', lineHeight: '1.4' }}>
                  This mobile number is already registered for <strong>{existingProfilesList.length} family member profile(s)</strong>. Choose an existing profile to pre-fill or create a new profile below.
                </div>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {existingProfilesList.map((prof) => (
                  <div key={prof.id} style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', transition: 'all 0.2s' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>{prof.fullName}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--primary-color)', marginTop: '2px' }}>
                        Reg ID: {prof.registrationId}
                      </div>
                      {prof.branchName && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Branch: {prof.branchName}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectExistingProfile(prof)}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                      Book for {prof.fullName.split(' ')[0]}
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '20px 0 16px 0' }} />

              <button
                type="button"
                onClick={handleCreateNewFamilyProfile}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px dashed var(--primary-color)', backgroundColor: 'rgba(14, 165, 233, 0.06)', color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
              >
                + Create New Profile / Add Family Member
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookingSuccess && bookedPatientInfo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="glass-panel" style={{ padding: '30px', maxWidth: '400px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={36} />
            </div>
            <h3 style={{ margin: 0 }}>Appointment Confirmed!</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Appointment successfully booked for <strong style={{ color: 'var(--text-main)' }}>{bookedPatientInfo.name}</strong> with <strong style={{ color: 'var(--text-main)' }}>{bookedPatientInfo.doctor}</strong> at <strong style={{ color: 'var(--text-main)' }}>{bookedPatientInfo.branch}</strong>.
            </p>
            <button className="btn-primary" onClick={() => setShowBookingSuccess(false)} style={{ width: '100%', padding: '10px' }}>
              Great, Thank You
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
