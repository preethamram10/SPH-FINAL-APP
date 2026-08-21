import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput as RNTextInput, Platform, Linking, Modal, FlatList, KeyboardAvoidingView, Keyboard,
  Image
} from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import {
  doc, updateDoc, addDoc, collection, serverTimestamp, setDoc, query, where, getDocs, getDoc, limit
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Send, Download, Plus, Trash2, FilePen, X, User } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export const APP_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAARkAAAEZCAIAAAAscsZAAAAACXBIWXMAABJ0AAASdAHeZh94AAAFXGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDI2LTA1LTMxPC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkRhdGE+eyZxdW90O2RvYyZxdW90OzomcXVvdDtEQUhGYUk0MkVhcyZxdW90OywmcXVvdDt1c2VyJnF1b3Q7OiZxdW90O1VBRkhvNTkwX0xVJnF1b3Q7LCZxdW90O2JyYW5kJnF1b3Q7OiZxdW90O0plZXZhbiBSZWRkeSZxdW90O308L0F0dHJpYjpEYXRhPgogICAgIDxBdHRyaWI6RXh0SWQ+ZDg4ZDIxNGUtOWFlYi00YWQ0LWI2ZGQtYjVhMTE5YWVkNmUwPC9BdHRyaWI6RXh0SWQ+CiAgICAgPEF0dHJpYjpGYklkPjUyNTI2NTkxNDE3OTU4MDwvQXR0cmliOlZiSWQ+CiAgICAgPEF0dHJpYjpUb3VjaFR5cGU+MjwvQXR0cmliOlRvdWNoVHlwZT4KICAgIDwvcmRmOmxpPgogICA8L3JkZjpTZXE+CiAgPC9BdHRyaWI6QWRzPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpkYz0naHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8nPgogIDxkYzp0aXRsZT4KICAgPHJkZjpBbHQ+CiAgICA8cmRmOmxpIHhtbDpsYW5nPSd4LWRlZmF1bHQnPkxvY2FsTmVlZHMgJmFtcDtKb2JzIC0gMTA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+UHJlZXRoYW0gcmFtIEF2YWxhPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgKFJlbmRlcmVyKSBkb2M9REFIRmFJNDJFYXMgdXNlcj1VQUZIbzU5MF9MVSBicmFuZD1KZWV2YW4gUmVkZHk8L3htcDpDcmVhdG9yVG9vbD4KIDwvcmRmOkRlc2NyaXB0aW9uPgo8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8P3hwYWNrZXQgZW5kPSdyJz8+WkY3+QAAAE5lWElmTU0AKgAAAAgABAEaAAUAAAABAAAAPgEbAAUAAAABAAAARgEoAAMAAAABAAIAAAITAAMAAAABAAEAAAAAAAAAAAB4AAAAAQAAAHgAAAAByZF2EwAAI0FJREFUeJzt3Xl8FPX9P/DPzOx9Z3dzbO47IYQI4UY5FDxQOby1B62VVq3fb+vXtvpr1fqVeqDWVmtti7RaChUpXhSUinILcsmRkJBArs197ZG9d2dn5vsH/CiFQDKzn83uzr6fD/6APPjMvAN57cx85nMQHMchAEDEyFgXAIBIQJYAwAOyBAAekCUA8IAsAYAHZAkAPCBLAOABWQIAD8gSAHhAlgDAA7IEAB6QJQDwgCwBgAdkCQA8IEsA4AFZAgAPyBIAeECWAMADsgQAHpAlAPCALAGAB2QJADwgSwDgAVkCAA/IEgB4QJYAwAOyBAAekCUA8IAsAYAHZAkAPCBLAOABWQIAD8gSAHhAlgDAA7IEAB6QJQDwgCwBgAdkCQA8IEsA4AFZAgAPyBIAeECWAMADsgQAHpAlAPCALAGAB2QJADwgSwDgAVkCAA/IEgB4QJYAwAOyBAAekCUA8IAsAYAHZAkAPCBLAOABWQIAD8gSAHhAlgDAA7IEAB6QJQDwgCwBgAdkCQA8IEsA4AFZAgAPyBIAeECWAMADsgQAHpAlAPCALAGAB2QJADwgSwDgAVkCAA/IEgB4QJYAwAOyBAAekCUA8IAsAYAHZAkAPCBLAOABWQIAj/8Dby64yJO0J5oAAAAASUVORK5CYII=';

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
  danger: '#ef4444',
  clinicBlue: '#298FCA',
  clinicGreen: '#ACCF37',
};

// Editable field component
const Field = ({ label, value, onChangeText, placeholder, multiline, keyboardType, half, disabled }) => (
  <View style={[styles.fieldWrap, half && { width: '48%' }]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || label}
      placeholderTextColor="#94a3b8"
      editable={!disabled}
      style={[
        styles.fieldInput,
        multiline && { height: 72, textAlignVertical: 'top', paddingTop: 10 },
        disabled && { backgroundColor: '#f1f5f9', color: '#64748b' }
      ]}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

const MedicineFormEditor = ({ navigation, route }) => {
  const { request } = route.params || {};
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  const today = new Date();
  const todayStr = today.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Form fields — pre-filled from the request
  const [formDate, setFormDate] = useState(todayStr);
  const [patientName, setPatientName] = useState(request?.patientName || '');
  const [patientAge, setPatientAge] = useState(request?.age || '');
  const [gender, setGender] = useState(request?.gender || 'Mr.');
  const [subject, setSubject] = useState(request?.subject || request?.condition || '');
  const [duration, setDuration] = useState(request?.duration || '3');
  const [amountPaid, setAmountPaid] = useState(request?.amountPaid || '');
  const [medicines, setMedicines] = useState(
    request?.medicines?.length > 0 ? request.medicines : [{ name: '', timing: '', duration: '' }]
  );
  const [additionalNote, setAdditionalNote] = useState(request?.additionalNote || '');
  const [phone, setPhone] = useState(request?.phone || '');
  const [certificateTitle, setCertificateTitle] = useState(request?.certificateTitle || 'TO WHOM SO EVER IT MAY CONCERN');
  const [customCertificateText, setCustomCertificateText] = useState(request?.customCertificateText || '');

  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [showPatientModal, setShowPatientModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [masterTemplateData, setMasterTemplateData] = useState(null);

  useEffect(() => {
    const fetchMasterTemplate = async () => {
      try {
        const docRef = doc(db, 'settings', 'medicine_form_template');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMasterTemplateData(data);
          if (!request?.certificateTitle && data.certificateTitle) {
            setCertificateTitle(data.certificateTitle);
          }
          if (!request?.customCertificateText && data.customCertificateText) {
            setCustomCertificateText(data.customCertificateText);
          }
        }
      } catch (err) {
        console.warn('[MedicineFormEditor] Error loading master certificate template:', err);
      }
    };
    fetchMasterTemplate();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Global server-side search across all branches
  useEffect(() => {
    if (!showPatientModal) return;
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const fetchGlobalPatients = async () => {
      setIsSearching(true);
      try {
        const queryText = debouncedSearch.trim();
        const textLower = queryText.toLowerCase();
        const textCapitalized = queryText.charAt(0).toUpperCase() + queryText.slice(1).toLowerCase();
        const textUpper = queryText.toUpperCase();

        const promises = [];
        if (/^\d+$/.test(queryText)) {
          const cleanPhone = queryText.slice(-10);
          promises.push(getDocs(query(collection(db, 'allpatients'), where('phone', '==', cleanPhone))));
          promises.push(getDocs(query(collection(db, 'patients'), where('phone', '==', cleanPhone))));
        } else {
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textCapitalized), where('fullName', '<=', textCapitalized + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textLower), where('fullName', '<=', textLower + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('fullName', '>=', textUpper), where('fullName', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'allpatients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\\uf8ff'), limit(20))));
          promises.push(getDocs(query(collection(db, 'patients'), where('registrationId', '>=', textUpper), where('registrationId', '<=', textUpper + '\\uf8ff'), limit(20))));
        }

        const snaps = await Promise.all(promises);
        const results = [];
        snaps.forEach(snap => {
          snap.forEach(docSnap => {
            results.push({ id: docSnap.id, ...docSnap.data() });
          });
        });

        // Deduplicate
        const uniqueResults = [];
        const phones = new Set();

        results.forEach(r => {
          const clean = (r.phone || '').replace(/\D/g, '').slice(-10);
          if (clean && !phones.has(clean)) {
            phones.add(clean);
            uniqueResults.push(r);
          }
        });
        setSearchResults(uniqueResults);
      } catch (err) {
        console.error("Error globally searching patients for picker:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchGlobalPatients();
  }, [debouncedSearch, showPatientModal]);

  const selectPatient = (p) => {
    setPatientName(p.fullName || '');
    setPatientAge(p.age || p.patientAge || '');
    setGender(p.gender || 'Mr.');
    setPhone(p.phone || '');
    setShowPatientModal(false);
  };

  // Medicine row handlers
  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    setMedicines(updated);
  };

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', timing: '', duration: '' }]);
  };

  const removeMedicineRow = (index) => {
    if (medicines.length <= 1) return;
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  // Build the complete form data object
  const buildFormData = () => ({
    requestId: request?.id,
    patientId: request?.patientId,
    patientName: patientName.trim(),
    phone: phone,
    age: patientAge.trim(),
    gender: gender,
    subject: subject.trim(),
    duration: duration.trim(),
    amountPaid: amountPaid.trim(),
    medicines: medicines.filter(m => m.name.trim()),
    additionalNote: additionalNote.trim(),
    formDate: formDate,
    certificateTitle: certificateTitle || 'TO WHOM SO EVER IT MAY CONCERN',
    customCertificateText: customCertificateText || '',
    doctorName: request?.doctorName || '',
    branchName: request?.branchName || userData?.branchName || '',
    branchId: request?.branchId || userData?.branchId || '',
    preparedBy: userData?.name || 'Receptionist',
    status: 'completed',
  });

  // Generate the HTML for the PDF matching the Spiritual Homeopathy letterhead
  const generateHtml = (data, logoBase64) => {
    const logoToUse = logoBase64 || APP_ICON_BASE64;
    const medicineRows = data.medicines
      .map(m => `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: bold; color: #1e293b; font-family: 'Plus Jakarta Sans', sans-serif;">
            ${m.name}
          </td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #475569; font-family: 'Plus Jakarta Sans', sans-serif;">
            --- ${m.timing}
          </td>
        </tr>`)
      .join('');

    const genderTitle = data.gender || 'Mr.';
    const heShe = (genderTitle === 'Mrs.' || genderTitle === 'Ms.' || genderTitle === 'She')
      ? 'SHE'
      : (genderTitle === 'He / She' || genderTitle === 'He/She' ? 'HE / SHE' : 'HE');
    const branchNameRaw = (data.branchName || userData?.branchName || 'Chandnagar').toUpperCase();
    const displayBranch = branchNameRaw.includes('HYD') ? branchNameRaw : `${branchNameRaw}, HYD, TS`;
    let bodyParagraphsHtml = '';
    if (data.customCertificateText) {
      bodyParagraphsHtml = `<p style="white-space: pre-wrap; font-size: 13px; color: #334155; line-height: 1.8;">${data.customCertificateText}</p>`;
    } else if (masterTemplateData?.customCertificateText) {
      bodyParagraphsHtml = `<p style="white-space: pre-wrap; font-size: 13px; color: #334155; line-height: 1.8;">${masterTemplateData.customCertificateText}</p>`;
    } else {
      let p1 = masterTemplateData?.paragraph1Text || 'THIS IS TO CERTIFY THAT {GENDER} {PATIENT_NAME} AGED ABOUT {AGE} YEARS, HAS BEEN UNDER OUR TREATMENT AT SPIRITUAL HOMEOPATHY FOR THE MANAGEMENT OF {CONDITION}.';
      let p2 = masterTemplateData?.paragraph2Text || '{HE_SHE} NEEDED TO TAKE HOMEOPATHY MEDICINE FOR {DURATION} MONTHS. WE RECOMMENDED THAT {GENDER} {PATIENT_NAME} CONTINUES TO FOLLOW THE PRESCRIBED MEDICATIONS.';

      p1 = p1
        .replace(/\{GENDER\}/gi, genderTitle)
        .replace(/\{PATIENT_NAME\}/gi, `<span style="color: #298FCA; font-weight: 800;">${data.patientName.toUpperCase()}</span>`)
        .replace(/\{AGE\}/gi, `<strong>${data.age || '__'} YEARS</strong>`)
        .replace(/\{CONDITION\}/gi, `<span style="font-weight: 800; color: #0f172a;">${(data.subject || '').toUpperCase()}</span>`);

      p2 = p2
        .replace(/\{HE_SHE\}/gi, heShe)
        .replace(/\{DURATION\}/gi, `<strong>${data.duration} MONTHS</strong>`)
        .replace(/\{GENDER\}/gi, genderTitle)
        .replace(/\{PATIENT_NAME\}/gi, data.patientName.toUpperCase());

      bodyParagraphsHtml = `<p>${p1}</p><p style="margin-top: 10px;">${p2}</p>`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #ffffff; color: #1e293b; }
    .page {
      width: 100%;
      min-height: 100vh;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .header {
      background-color: #ffffff;
      height: 95px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #298FCA;
    }
    .logo-box img { height: 80px; object-fit: contain; }
    .header-right { display: flex; align-items: center; gap: 6px; color: #475569; font-size: 11px; font-weight: 800; }
    .body { padding: 35px 40px; flex-grow: 1; }
    .doc-meta { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .subject-heading { text-align: center; font-size: 15px; font-weight: 900; letter-spacing: 1.5px; padding: 15px 0 25px; color: #0f172a; text-transform: uppercase; }
    .body-text { font-size: 13px; color: #334155; line-height: 1.8; margin-bottom: 25px; }
    .body-text p { margin-bottom: 12px; }
    .medicine-section { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 25px; }
    .medicine-header { background: #f8fafc; padding: 10px 14px; font-size: 11px; font-weight: 800; color: #298FCA; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
    .medicine-table { width: 100%; border-collapse: collapse; }
    .payment-text { font-size: 13px; color: #1e293b; font-weight: 600; margin-bottom: 25px; background: #fafafb; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .seal-area { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; }
    .footer { background-color: #ACCF37; height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; width: 100%; }
    .footer-col { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; color: #ffffff; font-size: 11px; font-weight: 700; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo-box">
      <img src="data:image/png;base64,${logoToUse}" alt="SPIRITUAL HOMEOPATHY" />
    </div>
    <div class="header-right">
      <span>www.spiritualhomeoclinic.com</span>
    </div>
  </div>
  <div class="body">
    <div class="doc-meta">
      <div><strong>DATE:</strong> ${data.formDate}</div>
      <div>support@spiritualhomeo.com</div>
    </div>
    <div class="subject-heading">${(data.certificateTitle || masterTemplateData?.certificateTitle || 'TO WHOM SO EVER IT MAY CONCERN').toUpperCase()}</div>
    <div class="body-text">
      ${bodyParagraphsHtml}
    </div>
    <div class="medicine-section">
      <div class="medicine-header">PRESCRIBED MEDICINES</div>
      <table class="medicine-table">${medicineRows}</table>
    </div>
    ${data.amountPaid ? `<div class="payment-text">Paid Rs.${data.amountPaid}/- for ${data.duration} Months consultation and medicines.</div>` : ''}
    ${data.additionalNote ? `<div style="font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 20px;">Note: ${data.additionalNote}</div>` : ''}
    <div class="seal-area">
      <p style="font-style: italic;">This is a computer-generated document and does not require a physical signature.</p>
      <p style="margin-top: 6px; font-weight: bold; color: #64748b;">Spiritual Homeopathy Clinic · ${displayBranch}</p>
    </div>
  </div>

  <div class="footer">
    <div class="footer-col">
      <svg class="footer-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      <span>9069 176 176</span>
    </div>
    <div class="footer-col border-left">
      <svg class="footer-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      <span>support@spiritualhomeo.com</span>
    </div>
    <div class="footer-col border-left">
      <svg class="footer-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      <span>${displayBranch}</span>
    </div>
  </div>
</div>
</body>
</html>`;
  };

  const handleShareMedicinePrescriptionWhatsApp = (data, cleanPhone) => {
    const genderTitle = data.gender || 'Mr.';
    const patientName = data.patientName || 'Patient';
    const duration = data.duration || '3';
    const amountPaid = data.amountPaid || '';
    const medicinesList = data.medicines
      .map((m, idx) => `${idx + 1}. *${m.name}* (${m.timing}) ${m.duration ? `[${m.duration}]` : ''}`)
      .join('\n');
    const additionalNote = data.additionalNote ? `\n*Note:* ${data.additionalNote}` : '';
    const doctorName = data.doctorName || 'Doctor';
    const branchName = data.branchName || 'Clinic';

    const message = `*SPIRITUAL HOMEOPATHY - MEDICINE PRESCRIPTION*

Dear *${genderTitle} ${patientName}*,

Your medicine prescription has been prepared.

*Prescription Details:*
• *Patient Name:* ${genderTitle} ${patientName}
• *Condition:* ${data.subject || 'General Consultation'}
• *Treatment Duration:* ${duration} Months
• *Branch:* ${branchName}
• *Date:* ${data.formDate}

*Prescribed Medicines:*
${medicinesList}
${additionalNote}
${amountPaid ? `\n*Amount Paid:* ₹${amountPaid}` : ''}

For queries, contact support at 9030 176 176 or visit www.spiritualhomeoclinic.com`;

    const url = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`);
      }
    }).catch(err => {
      Linking.openURL(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`);
    });
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    const data = buildFormData();
    if (!data.patientName) {
      Alert.alert('Required', 'Please enter the patient name before downloading.');
      return;
    }
    setDownloading(true);
    let html = '';
    try {
      let logoBase64 = '';
      try {
        const assetSource = Image.resolveAssetSource(require('../../../assets/SH logo.png'));
        if (assetSource && assetSource.uri) {
          let localUri = assetSource.uri;
          if (localUri.startsWith('http')) {
            const { uri } = await FileSystem.downloadAsync(
              localUri,
              FileSystem.cacheDirectory + 'temp_logo.png'
            );
            localUri = uri;
          }
          logoBase64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
        }
      } catch (err) {
        console.warn('[MedicineFormEditor] Failed to dynamically load SH logo.png base64, falling back:', err);
      }

      html = generateHtml(data, logoBase64);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Copy to cache directory root to allow Android sharing permissions
      const cleanPatientName = data.patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const shareableUri = FileSystem.cacheDirectory + `MedicineForm_${cleanPatientName}.pdf`;
      await FileSystem.copyAsync({
        from: uri,
        to: shareableUri
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareableUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Medicine Form – ${data.patientName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Saved', `PDF saved at: ${shareableUri}`);
      }
    } catch (err) {
      const errMsg = err?.message || String(err);
      // Silently ignore user-initiated dismissals
      if (
        errMsg.toLowerCase().includes('cancel') ||
        errMsg.toLowerCase().includes('reject') ||
        errMsg.toLowerCase().includes('dismiss') ||
        errMsg.toLowerCase().includes('processing')
      ) {
        return;
      }
      // Android file permission restriction: fall back to Print/Save PDF or WhatsApp
      if (
        errMsg.toLowerCase().includes('not allowed') ||
        errMsg.toLowerCase().includes('given url') ||
        errMsg.toLowerCase().includes('file under')
      ) {
        try {
          await Print.printAsync({ html });
          return;
        } catch (printErr) {
          console.warn('[MedicineFormEditor] Print fallback failed, falling back to WhatsApp:', printErr);
        }
        const phone = data.phone || '';
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length === 10) {
          handleShareMedicinePrescriptionWhatsApp(data, cleanPhone);
        }
        return;
      }
      console.error('PDF error:', err);
      const phone = data.phone || '';
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        Alert.alert(
          'Sharing Limit',
          'Your device does not support direct PDF sharing. Prefilled prescription details will be shared via WhatsApp instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open WhatsApp',
              onPress: () => handleShareMedicinePrescriptionWhatsApp(data, cleanPhone)
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not generate PDF. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  // Send form to patient app
  const handleSendToPatient = async () => {
    const data = buildFormData();
    if (!data.patientName.trim()) {
      Alert.alert('Required', 'Please enter the patient name.');
      return;
    }
    if (!data.subject.trim()) {
      Alert.alert('Required', 'Please enter the consultation subject / condition.');
      return;
    }
    if (data.medicines.filter(m => m.name.trim()).length === 0) {
      Alert.alert('Required', 'Please add at least one medicine.');
      return;
    }

    Alert.alert(
      'Send to Patient',
      `Send this completed medicine form to ${data.patientName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              // 1. Save form to medicine_forms collection
              await addDoc(collection(db, 'medicine_forms'), {
                ...data,
                createdAt: serverTimestamp(),
              });

              // 2. Update the original request status to 'completed'
              if (request?.id) {
                await updateDoc(doc(db, 'medicine_requests', request.id), {
                  status: 'completed',
                  completedAt: serverTimestamp(),
                  completedBy: userData?.name || 'Receptionist',
                });
              }

              // 3. Send a notification to the patient
              if (data.patientId) {
                await addDoc(collection(db, 'notifications'), {
                  userId: data.patientId,
                  title: '📋 Medicine Form Ready',
                  body: `Your medicine form has been prepared by the reception team. Open your appointments to view and download it.`,
                  type: 'medicine_form',
                  appointmentId: request?.appointmentId || null,
                  isRead: false,
                  createdAt: serverTimestamp(),
                });
              }

              Alert.alert(
                '✅ Sent Successfully',
                `The medicine form has been sent to ${data.patientName}. They can view and download it from their app.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (err) {
              console.error('Send form error:', err);
              Alert.alert('Error', 'Failed to send the form. Please try again.');
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };



  return (
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Medicine Form</Text>
          <Text style={styles.headerSub}>{request?.patientName || 'New Form'}</Text>
        </View>
        {/* Download PDF */}
        <TouchableOpacity
          style={[styles.actionBtnSmall, { marginRight: 8, backgroundColor: '#eff6ff' }]}
          onPress={handleDownloadPDF}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator size={16} color="#2563eb" />
          ) : (
            <Download size={18} color="#2563eb" />
          )}
        </TouchableOpacity>
        {/* Send to Patient */}
        <TouchableOpacity
          style={[styles.actionBtnSmall, { backgroundColor: COLORS.success }]}
          onPress={handleSendToPatient}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* LETTERHEAD PREVIEW CARD */}
          <Surface style={styles.letterheadCard}>
            {/* Clinic header strip */}
            <View style={styles.clinicHeader}>
              <View>
                <Text style={styles.clinicName}>SPIRITUAL</Text>
                <Text style={styles.clinicWebsite}>www.spiritualhomeo.com</Text>
              </View>
              <Text style={styles.clinicSub}>HOMEOPATHY</Text>
            </View>
            <View style={styles.greenStripe} />

            {/* Form meta */}
            <View style={styles.formMeta}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabelSmall}>DATE</Text>
                <RNTextInput
                  value={formDate}
                  onChangeText={setFormDate}
                  style={styles.metaInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.toWhomHeading}>
              <Text style={styles.toWhomText}>TO WHOM SO EVER IT MAY CONCERN</Text>
            </View>
          </Surface>

          {/* PATIENT DETAILS SECTION */}
          <Surface style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FilePen size={16} color={COLORS.secondary} />
              <Text style={styles.sectionTitle}>Patient Details</Text>
            </View>

            {/* Patient Selection Dropdown Trigger */}
            <Text style={styles.fieldLabel}>Select Patient</Text>
            <TouchableOpacity onPress={() => setShowPatientModal(true)} style={styles.pickerTrigger}>
              <User size={18} color={COLORS.muted} style={{ marginRight: 8 }} />
              <Text style={[styles.pickerTriggerText, !patientName && { color: COLORS.muted }]}>
                {patientName ? `${patientName} (${phone})` : 'Select Patient from list...'}
              </Text>
            </TouchableOpacity>

            <Modal visible={showPatientModal} animationType="slide" transparent={true}>
              <View style={styles.modalBackdrop}>
                <View style={styles.pickerModalContent}>
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>Select Patient</Text>
                    <TouchableOpacity onPress={() => setShowPatientModal(false)}>
                      <X size={24} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                  <RNTextInput
                    placeholder="Search by name, phone or reg ID..."
                    placeholderTextColor="#000000"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInputModal}
                  />
                  {isSearching ? (
                    <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 20 }} />
                  ) : (
                    <FlatList
                      data={searchResults}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.patientListItem} onPress={() => selectPatient(item)}>
                          <Text style={styles.patientListName}>{item.fullName}</Text>
                          <Text style={styles.patientListPhone}>{item.phone}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 400, marginTop: 12 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      persistentScrollbar={true}
                      indicatorStyle="black"
                    />
                  )}
                </View>
              </View>
            </Modal>

            {/* Gender selector */}
            <Text style={styles.fieldLabel}>Title / Gender</Text>
            <View style={styles.genderRow}>
              {['Mr.', 'Mrs.', 'Ms.', 'Master', 'He', 'She', 'He / She'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderPill, gender === g && styles.genderPillActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderPillText, gender === g && styles.genderPillTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowWrap}>
              <Field label="Patient Name" value={patientName} onChangeText={setPatientName}
                placeholder="Full name" half />
              <Field label="Age (Years)" value={patientAge} onChangeText={setPatientAge}
                placeholder="e.g. 24" keyboardType="numeric" half />
            </View>

            <Field
              label="Consultation Subject / Condition"
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. URTICARIA AND SINUS"
            />

            <View style={styles.rowWrap}>
              <Field label="Treatment Duration (months)" value={duration}
                onChangeText={setDuration} placeholder="e.g. 3" keyboardType="numeric" half />
              <Field label="Amount Paid (₹)" value={amountPaid}
                onChangeText={setAmountPaid} placeholder="e.g. 6000" keyboardType="numeric" half />
            </View>

            <Field
              label={`Certificate Heading ${isAdmin ? '' : '(🔒 Admin Only)'}`}
              value={certificateTitle}
              onChangeText={setCertificateTitle}
              placeholder="TO WHOM SO EVER IT MAY CONCERN"
              disabled={!isAdmin}
            />

            <Field
              label={`Custom Certificate Wording ${isAdmin ? '' : '(🔒 Admin Only)'}`}
              value={customCertificateText}
              onChangeText={setCustomCertificateText}
              placeholder={isAdmin ? "Leave empty for standard auto-generated certificate text, or type custom wording here..." : "Standard auto-generated certificate text (Editable by Admin)"}
              multiline
              disabled={!isAdmin}
            />
          </Surface>

          {/* MEDICINES SECTION */}
          <Surface style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FilePen size={16} color={COLORS.secondary} />
              <Text style={styles.sectionTitle}>Prescribed Medicines</Text>
            </View>

            {medicines.map((med, index) => (
              <View key={index} style={styles.medicineRow}>
                <View style={styles.medIndexBadge}>
                  <Text style={styles.medIndexText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <RNTextInput
                    value={med.name}
                    onChangeText={val => updateMedicine(index, 'name', val)}
                    placeholder="Medicine name (e.g. NASH sulph)"
                    placeholderTextColor="#94a3b8"
                    style={styles.medNameInput}
                  />
                  <RNTextInput
                    value={med.timing}
                    onChangeText={val => updateMedicine(index, 'timing', val)}
                    placeholder="Timing (e.g. morning medicine / drops)"
                    placeholderTextColor="#94a3b8"
                    style={styles.medTimingInput}
                  />
                  <RNTextInput
                    value={med.duration}
                    onChangeText={val => updateMedicine(index, 'duration', val)}
                    placeholder="Duration (e.g. 1 Month)"
                    placeholderTextColor="#94a3b8"
                    style={styles.medTimingInput}
                  />
                </View>
                <TouchableOpacity
                  style={styles.removeMedBtn}
                  onPress={() => removeMedicineRow(index)}
                >
                  <Trash2 size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addMedBtn} onPress={addMedicineRow}>
              <Plus size={16} color={COLORS.secondary} />
              <Text style={styles.addMedText}>Add Medicine Row</Text>
            </TouchableOpacity>
          </Surface>

          {/* ADDITIONAL NOTE */}
          <Surface style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FilePen size={16} color={COLORS.secondary} />
              <Text style={styles.sectionTitle}>Additional Note (Optional)</Text>
            </View>
            <RNTextInput
              value={additionalNote}
              onChangeText={setAdditionalNote}
              placeholder="Any additional instructions or note for the patient..."
              placeholderTextColor="#94a3b8"
              style={[styles.fieldInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline
              numberOfLines={3}
            />
          </Surface>

          {/* ACTION BUTTONS */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.downloadBtn]}
              onPress={handleDownloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size={18} color="#2563eb" />
              ) : (
                <Download size={18} color="#2563eb" />
              )}
              <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.sendBtn]}
              onPress={handleSendToPatient}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size={18} color="#fff" />
              ) : (
                <Send size={18} color="#fff" />
              )}
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Send to Patient</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.muted, fontWeight: '500', marginTop: 1 },
  actionBtnSmall: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { padding: 14 },

  // Letterhead preview card
  letterheadCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    marginBottom: 12,
  },
  clinicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.clinicBlue,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  clinicName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  clinicWebsite: {
    fontSize: 9,
    color: '#c8e8ff',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  clinicSub: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.clinicGreen,
    letterSpacing: 2,
  },
  greenStripe: { height: 5, backgroundColor: COLORS.clinicGreen },
  formMeta: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  fieldLabelSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaInput: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  toWhomHeading: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  toWhomText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1.5,
  },

  // Section cards
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },

  // Gender selector
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  genderPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  genderPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  genderPillText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  genderPillTextActive: { color: '#fff' },

  rowWrap: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },

  fieldWrap: { marginBottom: 12, width: '100%' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Medicine rows
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  medIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.secondary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  medIndexText: { fontSize: 11, fontWeight: '800', color: COLORS.secondary },
  medNameInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  medTimingInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
  },
  removeMedBtn: {
    padding: 8,
    marginTop: 6,
  },
  addMedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  addMedText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },

  pickerTrigger: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 12 },
  pickerTriggerText: { fontSize: 13, color: COLORS.text, flex: 1, fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '60%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  searchInputModal: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14 },
  patientListItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  patientListName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  patientListPhone: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 2,
  },
  downloadBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  sendBtn: { backgroundColor: COLORS.success },
  actionBtnText: { fontSize: 14, fontWeight: '800' },
});

export default MedicineFormEditor;
