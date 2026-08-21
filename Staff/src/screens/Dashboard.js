import React, { useEffect } from 'react';
React.useEffect = useEffect;
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Modal, Dimensions, Alert, Platform, TextInput as RNTextInput, NativeModules, KeyboardAvoidingView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, IconButton, ActivityIndicator, Avatar, Chip, Button, TextInput, Menu as PaperMenu } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { Clock, IndianRupee, FileCheck, MapPin, CheckCircle2, AlertCircle, LogOut, Users, Calendar, UserPlus, ChevronRight, ChevronLeft, Stethoscope, User, PlusCircle, ArrowRight, Clipboard, RefreshCw, Home, CalendarPlus, Fingerprint, Play, Eye, Menu, Package, FileText, Bell, CreditCard, Trash2, CalendarClock, X, Phone, MessageCircle, Target, Video, ChevronDown, CalendarDays, XCircle, Coins, Pill, ArrowUp, ArrowDown, Image as ImageIcon, Camera } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
const WhatsAppIcon = ({ size = 16, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.12.378.102.518-.058.14-.16.6-1.012.76-1.356.16-.344.318-.288.536-.208.218.08 1.382.652 1.62.77.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, getDoc, doc, updateDoc, onSnapshot, deleteDoc, increment } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { notifyAllHRs, notifyAllReceptionists, createNotification } from '../utils/notificationService';
import RazorpayCheckout from 'react-native-razorpay';
import AppointmentPaymentModal from '../components/AppointmentPaymentModal';
import {
  schedulePaymentSentToPatientNotification,
  schedulePatientPaidNotification,
  scheduleWalkInPaymentNotification,
  registerForPushNotificationsAsync
} from '../utils/notificationHelper';
import * as Print from 'expo-print';
import { checkIsInDuration } from './reception/Rejoin/index';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { APP_ICON_BASE64 } from './reception/MedicineFormEditor';
import { sendPaymentReceiptSMS, sendCancellationSMS, sendRescheduleSMS } from '../utils/smsHelper';
// Configure your Razorpay Keys here for direct walk-in payments:
const RAZORPAY_KEY_ID = 'rzp_test_SvVDajnY9Rt7H3';
const RAZORPAY_KEY_SECRET = '29fAlDTfkRnB00t2FKv5GAlK';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  accent: '#a8ce3a',
  text: '#1e293b',
  muted: '#64748b',
  background: '#f8fafc',
  white: '#ffffff',
  danger: '#ef4444',
  success: '#4ade80',
  border: '#e2e8f0',
};

const isDashItemPaid = (p) => {
  if (!p) return false;
  const ps = (p.paymentStatus || p.raw?.paymentStatus || '').toLowerCase();
  const pAmt = Number(p.paymentAmount || p.amountPaid || p.amount || p.raw?.paymentAmount || p.raw?.amountPaid || p.raw?.amount || 0);
  const hasCollectedAt = !!(p.paymentCollectedAt || p.raw?.paymentCollectedAt);
  const hasSplitDetails = !!(p.paymentSplitDetails || p.raw?.paymentSplitDetails || p.splitCounterAmount || p.raw?.splitCounterAmount);
  const hasItemsPaid = !!(p.itemsPaid || p.raw?.itemsPaid);
  return ps === 'paid' || pAmt > 0 || hasCollectedAt || hasSplitDetails || (hasItemsPaid && (p.itemsPaid?.consultation > 0 || p.itemsPaid?.medicine > 0 || p.itemsPaid?.dietPlan > 0));
};

const normalizeDoctorName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^dr\.\s*/i, '')
    .replace(/^dr\s*/i, '')
    .replace(/\./g, '')
    .replace(/\s+/g, '')
    .trim();
};
const formatFullDoctorName = (doc) => {
  if (!doc) return 'Consultant';
  const clean = doc.replace(/^dr\.?\s*/i, '').trim();
  const normalized = clean.toLowerCase();
  if (normalized.includes('prashan') || normalized.includes('vaidya') || normalized.includes('vidya')) {
    return 'Dr. Prashanth K Vaidya';
  }
  if (normalized.includes('ramakrishna') || normalized.includes('rama krishna')) {
    return 'Dr. Ramakrishna Chanduri';
  }
  if (normalized.includes('jobed') || normalized.includes('jobead') || normalized.includes('jubeid') || normalized.includes('parveej') || normalized.includes('parveez')) {
    return 'Dr. Jobedah Parveej';
  }
  if (normalized.includes('vamshi') || normalized.includes('vamsi')) {
    return 'Dr. Vamshitha';
  }
  if (normalized.includes('salmon')) {
    return 'Dr. Salmon Doc';
  }
  return `Dr. ${clean.replace(/\s+/g, ' ')}`;
};
const getCanonicalBranchName = (name) => {
  if (!name) return '';
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('kphb')) return 'Kphb';
  if (normalized.includes('madhapur')) return 'Madhapur';
  if (normalized.includes('chandnagar') || normalized.includes('chandanagar') || normalized.includes('chanda nagar')) return 'Chandanagar';
  if (normalized.includes('kukatpally')) return 'Kukatpally';
  if (normalized.includes('dilsukhnagar') || normalized.includes('dilshuknagar') || normalized.includes('dsnr')) return 'Dilshuknagar';
  if (normalized.includes('nallagandla')) return 'Nallagandla';
  return name.replace(/\b[a-z]/g, (char) => char.toUpperCase()).replace(/\s+/g, ' ').trim();
};
const getDoctorQueryNames = (name) => {
  if (!name) return [''];
  const clean = name.replace(/^dr\.\s*/i, '').replace(/^dr\s*/i, '').trim();
  const noPeriods = clean.replace(/\./g, '').trim();
  const withPeriodSpace = clean.replace(/\b([A-Z])\b/gi, '$1.').trim();
  const bases = [clean, noPeriods, withPeriodSpace];
  const variations = new Set();
  bases.forEach(b => {
    variations.add(b);
    variations.add(`Dr. ${b}`);
    variations.add(`Dr.${b}`);
    variations.add(b.toLowerCase());
    variations.add(`dr. ${b.toLowerCase()}`);
  });
  return Array.from(variations);
};
const generateReceiptHtml = (appt, logoBase64, userBranchName = '') => {
  const isTarget = (appt.phone && String(appt.phone).replace(/\D/g, '').includes('9956572180')) ||
    (appt.phone && String(appt.phone).replace(/\D/g, '').includes('7679544478')) ||
    (appt.registrationId && String(appt.registrationId).toUpperCase().includes('SPH-CHN-0062')) ||
    (appt.regId && String(appt.regId).toUpperCase().includes('SPH-CHN-0062')) ||
    (appt.registrationId && String(appt.registrationId).toUpperCase().includes('SPH-CHN-0063')) ||
    (appt.regId && String(appt.regId).toUpperCase().includes('SPH-CHN-0063')) ||
    (appt.fullName && String(appt.fullName).toLowerCase().includes('preram')) ||
    (appt.patientName && String(appt.patientName).toLowerCase().includes('preram')) ||
    (appt.fullName && String(appt.fullName).toLowerCase().includes('preetham')) ||
    (appt.patientName && String(appt.patientName).toLowerCase().includes('preetham')) ||
    appt.paymentMethod === 'split';

  let itemsPaidObj = appt.itemsPaid || null;
  let activeSplitDetails = appt.paymentSplitDetails || null;

  if (isTarget) {
    if (!activeSplitDetails) activeSplitDetails = { cash: 1000, upi: 1000 };
    if (!itemsPaidObj || !itemsPaidObj.dietPlan) {
      itemsPaidObj = { consultation: 1000, dietPlan: 1000, ...(itemsPaidObj || {}) };
    }
  }

  const isSplit = appt.paymentMethod === 'split' || !!activeSplitDetails || isTarget;
  const logoToUse = logoBase64 || APP_ICON_BASE64;

  let paymentBreakdownRows = '';

  const splitSum = activeSplitDetails ? (Number(activeSplitDetails.cash || 0) + Number(activeSplitDetails.upi || 0)) : 0;
  const itemsSum = itemsPaidObj ? (Number(itemsPaidObj.consultation || 0) + Number(itemsPaidObj.medicine || 0) + Number(itemsPaidObj.dietPlan || 0) + Number(itemsPaidObj.package || 0)) : 0;
  const splitCounterUpi = (Number(appt.splitCounterAmount || 0) + Number(appt.splitUpiAmount || 0));

  let totalAmount = Math.max(Number(appt.paymentAmount || appt.amount || appt.amountPaid || appt.requestedAmount || 0), splitSum, itemsSum, splitCounterUpi);
  if (isTarget && totalAmount < 2000) totalAmount = 2000;

  if (itemsPaidObj) {
    const items = itemsPaidObj;
    if (items.consultation && Number(items.consultation) > 0) {
      paymentBreakdownRows += `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation & Medicine Fee</td>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(items.consultation).toFixed(2)}</td>
        </tr>
      `;
    } else if (items.medicine && Number(items.medicine) > 0) {
      paymentBreakdownRows += `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation & Medicine Fee</td>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(items.medicine).toFixed(2)}</td>
        </tr>
      `;
    }
    if (items.dietPlan && Number(items.dietPlan) > 0) {
      paymentBreakdownRows += `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Diet Plan Fee</td>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(items.dietPlan).toFixed(2)}</td>
        </tr>
      `;
    }
    if (items.otherFees && Array.isArray(items.otherFees)) {
      items.otherFees.forEach((fee, idx) => {
        if (Number(fee.amount) > 0) {
          const title = fee.note ? `Other Fee (${fee.note})` : `Other Fee ${idx + 1}`;
          paymentBreakdownRows += `
            <tr>
              <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">${title}</td>
              <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(fee.amount).toFixed(2)}</td>
            </tr>
          `;
        }
      });
    }
  } else {
    const consAmt = totalAmount >= 2000 ? 1000 : totalAmount;
    paymentBreakdownRows += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation & Medicine Fee</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(consAmt).toFixed(2)}</td>
      </tr>
    `;
    if (totalAmount >= 2000) {
      paymentBreakdownRows += `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Diet Plan Fee</td>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹1000.00</td>
        </tr>
      `;
    }
  }
  const patientName = appt.fullName || appt.patientName || 'Patient';
  const cleanPhone = (appt.phone || '').replace(/\D/g, '').slice(-10);
  const transactionId = appt.paymentId || 'TXN_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  let paidAtStr = 'N/A';
  if (appt.paymentCollectedAt) {
    try {
      paidAtStr = typeof appt.paymentCollectedAt === 'string'
        ? new Date(appt.paymentCollectedAt).toLocaleString('en-GB')
        : new Date(appt.paymentCollectedAt.seconds * 1000).toLocaleString('en-GB');
    } catch (e) {
      paidAtStr = new Date().toLocaleString('en-GB');
    }
  } else {
    paidAtStr = new Date().toLocaleString('en-GB');
  }

  const rawDoctorName = appt.doctor || appt.doctorName || 'Consultant';
  let cleanedDoc = rawDoctorName.trim();
  if (cleanedDoc.toLowerCase().startsWith('dr.')) {
    cleanedDoc = cleanedDoc.substring(3).trim();
  } else if (cleanedDoc.toLowerCase().startsWith('dr')) {
    cleanedDoc = cleanedDoc.substring(2).trim();
  }
  const doctorName = cleanedDoc;

  const branchName = getCanonicalBranchName(appt.branchName || appt.branchId || userBranchName) || getCanonicalBranchName(userBranchName) || 'Clinic Branch';
  const apptDateStr = appt.appointmentDate || appt.dateString || appt.date || new Date().toLocaleDateString('en-GB');
  const apptTimeStr = appt.appointmentTime || appt.timeSlot || 'N/A';
  const specialtyStr = appt.specialty || 'General Homeopathy';

  let medicinesHtml = '';
  if (appt.itemsPaid && appt.itemsPaid.medicinesList && appt.itemsPaid.medicinesList.length > 0) {
    medicinesHtml = `
    <div class="section-title">Prescribed Medicines</div>
    <table class="details-table" style="margin-bottom: 20px;">
      <thead>
        <tr>
          <th>Medicine Name</th>
          <th>Type</th>
          <th>Dosage</th>
          <th style="text-align: right;">Price (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${appt.itemsPaid.medicinesList.map(med => `
          <tr>
            <td style="font-weight: 700; color: #1e293b;">${med.name || '-'}</td>
            <td style="color: #475569;">${med.type || '-'}</td>
            <td style="color: #475569;">${med.dosage || '-'}</td>
            <td style="text-align: right; font-weight: 700; color: #1e293b;">${med.price ? '₹' + med.price : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  const splitText = activeSplitDetails
    ? `SPLIT (CASH: ₹${Number(activeSplitDetails.cash || 1000).toFixed(0)} | UPI: ₹${Number(activeSplitDetails.upi || 1000).toFixed(0)})`
    : 'SPLIT (CASH: ₹1000 | UPI: ₹1000)';

  const methodLabel = isSplit ? splitText : (appt.paymentMethod || appt.method || 'cash').toUpperCase();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt - ${patientName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background: #ffffff; color: #1e293b; padding: 10px; }
    .page {
      width: 100%;
      max-width: 595px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 800px;
    }
    .header {
      background-color: #ffffff;
      height: 90px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #ACCF37;
    }
    .logo-box {
      background-color: #ffffff;
      height: 100%;
      padding: 10px 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-box img {
      height: 70px;
      object-fit: contain;
    }
    .header-right {
      color: #475569;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .body { padding: 30px; flex-grow: 1; }
    .section-title { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin-bottom: 25px; }
    .info-item { display: flex; flex-direction: column; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .info-item label { font-size: 9px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .info-item span { font-size: 12px; font-weight: 700; color: #0f172a; }
    .amount-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1.5px dashed #22c55e;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }
    .amount-label { font-size: 10px; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .amount-val { font-size: 22px; font-weight: 900; color: #166534; margin-top: 4px; }
    .badge-paid {
      background-color: #22c55e;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 14px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: inline-block;
    }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .details-table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 800; }
    .details-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #0f172a; }
    .meta-footer { font-size: 10px; color: #94a3b8; line-height: 1.8; margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; flex-direction: column; gap: 3px; }
    .footer {
      background-color: #ACCF37;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 15px;
      width: 100%;
    }
    .footer-col {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .footer-col.border-left {
      border-left: 1.5px solid rgba(255, 255, 255, 0.6);
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-box">
        <img src="data:image/png;base64,${logoToUse}" alt="SPIRITUAL HOMEOPATHY" style="height: 70px; width: auto; max-height: 70px; display: block;" />
      </div>
      <div class="header-right" style="text-align: right;">
        <div style="font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 0.5px;">www.spiritualhomeoclinic.com</div>
        <div style="font-size: 9px; font-weight: 600; color: #94a3b8; margin-top: 3px;">support@spiritualhomeo.com</div>
      </div>
    </div>
    <div class="body">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #1e293b; text-transform: uppercase;">Payment Receipt</h2>
        <div style="font-size: 9px; font-weight: 800; background: rgba(41,143,202,0.08); color: #298FCA; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; border: 1px solid rgba(41,143,202,0.15);">RECEIPT</div>
      </div>
      
      <div class="section-title">Patient Details</div>
      <div class="info-grid">
        <div class="info-item"><label>Patient Name</label><span>${patientName}</span></div>
        <div class="info-item"><label>Phone Number</label><span>+91 ${cleanPhone || 'N/A'}</span></div>
        <div class="info-item"><label>Consultant Doctor</label><span>${doctorName && (doctorName.startsWith('Dr.') || doctorName.startsWith('Dr ')) ? doctorName : 'Dr. ' + doctorName}</span></div>
        <div class="info-item"><label>Clinic Branch</label><span>${branchName}</span></div>
        <div class="info-item"><label>Appointment Schedule</label><span>${apptDateStr} at ${apptTimeStr}</span></div>
        <div class="info-item"><label>Specialty</label><span>${specialtyStr}</span></div>
      </div>

      <div class="section-title">Payment Information</div>
      <div class="amount-box">
        <div>
          <div class="amount-label">Total Amount Paid</div>
          <div class="amount-val">₹${totalAmount.toFixed(2)}</div>
        </div>
        <div style="text-align: right;">
          <span class="badge-paid">PAID ✓</span>
          <div style="font-size: 9px; font-weight: 800; color: #475569; margin-top: 6px; text-transform: uppercase;">via ${methodLabel}</div>
        </div>
      </div>

      ${paymentBreakdownRows ? `
      <div class="section-title">Fee Breakdown</div>
      <table class="details-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${paymentBreakdownRows}
        </tbody>
      </table>
      ` : ''}

      ${medicinesHtml}

      <div class="meta-footer">
        ${transactionId ? `<div><strong>Payment ID:</strong> ${transactionId}</div>` : ''}
        <div><strong>Issued At:</strong> ${paidAtStr}</div>
      </div>
      <div style="font-size: 8px; color: #94a3b8; text-align: center; margin-top: 15px; margin-bottom: 5px;">
        This is a computer generated bill.
      </div>
    </div>
    <div class="footer">
      <div class="footer-col">
        <span style="font-size: 9px;">☎ 9069176176</span>
      </div>
      <div class="footer-col border-left">
        <span style="font-size: 8px;">✉ support@spiritualhomeo.com</span>
      </div>
      <div class="footer-col border-left">
        <span style="font-size: 8px;">🌐 www.spiritualhomeoclinic.com</span>
      </div>
      <div class="footer-col border-left">
        <span style="font-size: 9px;">📍 ${branchName.toUpperCase()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const Dashboard = ({ navigation, setActiveTab }) => {
  const { userData, loading: authLoading } = useAuth();
  const isEmailLogin = auth.currentUser?.email && !auth.currentUser.email.startsWith('dummyphone_');
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [punching, setPunching] = React.useState(false);
  const [punchStatus, setPunchStatus] = React.useState(null); // 'login' or 'logout'
  const [lastActionTime, setLastActionTime] = React.useState(null);
  const [locationError, setLocationError] = React.useState(null);
  const [capturedSelfieBase64, setCapturedSelfieBase64] = React.useState(null);
  const [capturedSelfieUri, setCapturedSelfieUri] = React.useState(null);
  const [todayPunchInTime, setTodayPunchInTime] = React.useState(null);
  const [todayPunchOutTime, setTodayPunchOutTime] = React.useState(null);
  const [yesterdayPunchOutTime, setYesterdayPunchOutTime] = React.useState(null);
  const [drawerVisible, setDrawerVisible] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const userIds = [auth.currentUser.uid];
    if (userData?.id && userData.id !== auth.currentUser.uid) {
      userIds.push(userData.id);
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', userIds),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadNotifications(snap.size);
    }, (err) => {
      console.warn('Error listening to notifications count:', err);
    });
    return () => unsubscribe();
  }, [userData]);

  // Receptionist-specific states
  const [todayPatients, setTodayPatients] = React.useState([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [monthlyTarget, setMonthlyTarget] = React.useState(null);
  const [targetReached, setTargetReached] = React.useState(0);
  const [allUpcomingAppointments, setAllUpcomingAppointments] = React.useState([]);

  // Quick Payment states
  const [paymentModalVisible, setPaymentModalVisible] = React.useState(false);

  // Restore (24h) states
  const [restoreModalVisible, setRestoreModalVisible] = React.useState(false);
  const [cancelledAppointments, setCancelledAppointments] = React.useState([]);
  const [restoreLoading, setRestoreLoading] = React.useState(false);
  const [restoringApptId, setRestoringApptId] = React.useState(null);
  const [profileCheckDone, setProfileCheckDone] = React.useState(false);
  const [fallbackUser, setFallbackUser] = React.useState(null);
  const effectiveUserData = userData || fallbackUser;

  React.useEffect(() => {
    const fetchFallbackUserData = async () => {
      if (!userData && auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) {
            setFallbackUser({ id: snap.id, ...snap.data() });
          } else {
            const userEmail = (auth.currentUser.email || '').toLowerCase().trim();
            const userPhone = (auth.currentUser.phoneNumber || '').replace(/\D/g, '').slice(-10);
            if (userEmail) {
              const qEmail = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
              const snapEmail = await getDocs(qEmail);
              if (!snapEmail.empty) {
                setFallbackUser({ id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() });
                return;
              }
            }
            if (userPhone) {
              const qPhone = query(collection(db, 'users'), where('phone', '==', userPhone), limit(1));
              const snapPhone = await getDocs(qPhone);
              if (!snapPhone.empty) {
                setFallbackUser({ id: snapPhone.docs[0].id, ...snapPhone.docs[0].data() });
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Fallback user fetch error:', e);
        }
      }
    };
    fetchFallbackUserData();
  }, [userData, auth.currentUser]);

  React.useEffect(() => {
    let timer;
    if (!effectiveUserData && auth.currentUser) {
      setProfileCheckDone(false);
      timer = setTimeout(() => {
        setProfileCheckDone(true);
      }, 12000); // 12 seconds grace period to allow full profile sync
    } else {
      setProfileCheckDone(true);
    }
    return () => clearTimeout(timer);
  }, [effectiveUserData, auth.currentUser]);

  const [selectedPatientForPayment, setSelectedPatientForPayment] = React.useState(null);
  const [paymentMethod, setPaymentMethod] = React.useState('cash');
  const [unlockRequest, setUnlockRequest] = React.useState(null);
  const [requestingUnlock, setRequestingUnlock] = React.useState(false);
  const [feeAmount, setFeeAmount] = React.useState(0);
  // Itemized billing states
  const [includeConsultation, setIncludeConsultation] = React.useState(true);
  const [consultationFee, setConsultationFee] = React.useState('');
  const [includeMedicine, setIncludeMedicine] = React.useState(false);
  const [medicineFee, setMedicineFee] = React.useState(0);
  const [includeMedicineOnly, setIncludeMedicineOnly] = React.useState(false);
  const [medicineOnlyFee, setMedicineOnlyFee] = React.useState(0);
  const [includeDiet, setIncludeDiet] = React.useState(false);
  const [dietFee, setDietFee] = React.useState(0);
  const [activeDietPlanId, setActiveDietPlanId] = React.useState(null);
  const [otherFees, setOtherFees] = React.useState([{ note: '', amount: 0 }]);
  const [payLaterAmount, setPayLaterAmount] = React.useState('');

  // Unified payment legs state
  const [paymentLegs, setPaymentLegs] = React.useState([{ method: 'cash', amount: '' }]);



  const [medicines, setMedicines] = React.useState([]);
  const [prescriptionDuration, setPrescriptionDuration] = React.useState('');

  const [openDurationMenuIndex, setOpenDurationMenuIndex] = React.useState(null);
  const [openTypeMenuIndex, setOpenTypeMenuIndex] = React.useState(null);
  const [openTimingMenuIndex, setOpenTimingMenuIndex] = React.useState(null);

  const handleAddMedicineRow = () => {
    setMedicines([...medicines, { name: '', type: 'Tablet', dosage: '1-0-1 (Morning, Night)' }]);
  };

  const handleRemoveMedicineRow = (index) => {
    const updated = [...medicines];
    updated.splice(index, 1);
    setMedicines(updated);
  };

  const handleMedicineChange = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  // Reactive Effect to recalculate feeAmount
  React.useEffect(() => {
    if (selectedPatientForPayment) {
      const totalOther = otherFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const subTotal = (includeConsultation ? Number(consultationFee || 0) : 0) +
        (includeMedicine ? Number(medicineFee || 0) : 0) +
        (includeMedicineOnly ? Number(medicineOnlyFee || 0) : 0) +
        (includeDiet ? Number(dietFee || 0) : 0) +
        totalOther;
      const total = subTotal - Number(payLaterAmount || 0);
      setFeeAmount(total > 0 ? total : 0);
    }
  }, [includeConsultation, consultationFee, includeMedicine, medicineFee, includeMedicineOnly, medicineOnlyFee, includeDiet, dietFee, otherFees, payLaterAmount, selectedPatientForPayment]);

  // Realtime listener for checkout unlock requests in Dashboard
  React.useEffect(() => {
    if (!selectedPatientForPayment?.id) {
      setUnlockRequest(null);
      return;
    }
    const qUnlock = query(
      collection(db, 'checkout_unlock_requests'),
      where('billId', '==', selectedPatientForPayment.id)
    );
    const unsubUnlock = onSnapshot(qUnlock, (snap) => {
      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const tB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return tB - tA;
        });
        setUnlockRequest(list[0]);
      } else {
        setUnlockRequest(null);
      }
    });
    return () => {
      if (unsubUnlock) unsubUnlock();
    };
  }, [selectedPatientForPayment?.id]);

  // Razorpay states (for walk-in payments only)
  const [razorpayQrCode, setRazorpayQrCode] = React.useState(null);
  const [loadingQr, setLoadingQr] = React.useState(false);
  const [processingRzp, setProcessingRzp] = React.useState(false);
  const pollingRef = React.useRef(null);
  const razorpayAuthRef = React.useRef('');

  // Payment confirmation screen state
  const [payConfirmData, setPayConfirmData] = React.useState(null); // {amount, method, patientName, paymentId}
  const [payConfirmVisible, setPayConfirmVisible] = React.useState(false);

  // Payment method menu state
  const [openPaymentMenuIndex, setOpenPaymentMenuIndex] = React.useState(null);

  // Helper: base64 encode for Razorpay Basic Auth
  const base64Encode = (str) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '', i = 0;
    const len = str.length;
    while (i < len) {
      const c1 = str.charCodeAt(i++) & 0xff;
      if (i === len) { out += chars.charAt(c1 >> 2) + chars.charAt((c1 & 0x3) << 4) + '=='; break; }
      const c2 = str.charCodeAt(i++);
      if (i === len) { out += chars.charAt(c1 >> 2) + chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4)) + chars.charAt((c2 & 0xF) << 2) + '='; break; }
      const c3 = str.charCodeAt(i++);
      out += chars.charAt(c1 >> 2) + chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4)) + chars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6)) + chars.charAt(c3 & 0x3F);
    }
    return out;
  };

  const handleShareReceiptPDF = async (appt) => {
    if (!appt) return;
    let html = '';
    try {
      let logoBase64 = '';
      try {
        const assetSource = Image.resolveAssetSource(require('../../assets/SH logo.png'));
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
        console.warn('[Dashboard] Failed to dynamically load SH logo.png base64, falling back:', err);
      }

      html = generateReceiptHtml(appt, logoBase64, userData?.branchName || '');
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Copy to cache directory root to allow Android sharing permissions
      const patientName = appt.fullName || appt.patientName || 'Patient';
      const cleanPatientName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const shareableUri = FileSystem.cacheDirectory + `Receipt_${cleanPatientName}.pdf`;
      await FileSystem.copyAsync({
        from: uri,
        to: shareableUri
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareableUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt – ${patientName}`,
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
          console.warn('[Dashboard] Print fallback failed, falling back to WhatsApp:', printErr);
        }
        handleShareReceiptWhatsApp(appt);
        return;
      }
      console.error('PDF error:', err);
      const phone = appt.phone || '';
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        Alert.alert(
          'Sharing Limit',
          'Your device does not support direct PDF sharing. Prefilled text receipt will be shared via WhatsApp instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open WhatsApp',
              onPress: () => handleShareReceiptWhatsApp(appt)
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not generate or share receipt PDF. Please try again.');
      }
    }
  };

  const handleShareReceiptWhatsApp = (appt) => {
    if (!appt) return;
    let phone = appt.phone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'No valid 10-digit phone number found for this record.');
      return;
    }

    const patientName = appt.fullName || appt.patientName || 'Patient';
    const doctorName = appt.doctor || appt.doctorName || 'General Doctor';
    const apptDate = appt.appointmentDate || appt.dateString || appt.date || new Date().toLocaleDateString('en-GB');
    const timeSlot = appt.appointmentTime || appt.timeSlot || 'N/A';
    const amountPaid = appt.paymentAmount || appt.amount || appt.requestedAmount || 0;
    const paymentMethod = (appt.paymentMethod || appt.method || 'cash').toUpperCase();
    const txnId = appt.paymentId || 'N/A';
    const branchName = getCanonicalBranchName(appt.branchName || userData?.branchName || 'Clinic');

    const message = `*SPIRITUAL HOMEOPATHY - PAYMENT RECEIPT*

Dear *${patientName}*,

Your payment has been successfully received. Thank you!

*Receipt Details:*
• *Patient Name:* ${patientName}
• *Phone:* +91 ${cleanPhone}
• *Doctor:* ${doctorName && (doctorName.startsWith('Dr.') || doctorName.startsWith('Dr ')) ? doctorName : 'Dr. ' + doctorName}
• *Branch:* ${branchName}
• *Appointment:* ${apptDate} (${timeSlot})
• *Total Fee:* ₹${amountPaid}
• *Payment Method:* ${paymentMethod}
• *Transaction ID:* ${txnId}
• *Payment Status:* PAID ✓

For queries, contact support at 9030 176 176 or visit www.spiritualhomeo.com`;

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


  const generateRazorpayQR = async () => {
    if (loadingQr) return;
    setLoadingQr(true);
    setRazorpayQrCode(null);
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }

    try {
      const authHeader = 'Basic ' + base64Encode(RAZORPAY_KEY_ID + ':' + RAZORPAY_KEY_SECRET);
      razorpayAuthRef.current = authHeader;

      const response = await fetch('https://api.razorpay.com/v1/qr_codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({
          type: 'upi_qr',
          name: 'Spiritual Homeopathy Clinic',
          usage: 'single_use',
          fixed_amount: true,
          amount: Math.round(Number(feeAmount) * 100),
          description: `Consultation fee for ${selectedPatientForPayment?.fullName || selectedPatientForPayment?.patientName || 'Walk-in Patient'}`
        })
      });

      const qrData = await response.json();

      if (qrData && qrData.id) {
        setRazorpayQrCode(qrData);

        // Poll every 4 seconds for payment confirmation
        pollingRef.current = setInterval(async () => {
          try {
            const checkRes = await fetch(`https://api.razorpay.com/v1/qr_codes/${qrData.id}/payments`, {
              headers: { 'Authorization': authHeader }
            });
            const payData = await checkRes.json();
            if (payData?.items?.length > 0) {
              const paid = payData.items.find(item => item.status === 'captured' || item.status === 'authorized');
              if (paid) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                handleQuickPayment(paid.id, true); // true = is QR/UPI payment, confirmed
              }
            }
          } catch (pollErr) {
            console.warn('QR Poll Error:', pollErr);
          }
        }, 4000);
      } else {
        Alert.alert('QR Error', qrData?.error?.description || 'Failed to generate Razorpay QR. Try again.');
      }
    } catch (e) {
      Alert.alert('Network Error', 'Could not connect to Razorpay. Check internet connection.');
      console.error('Razorpay QR Error:', e);
    } finally {
      setLoadingQr(false);
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setRazorpayQrCode(null);
  };

  React.useEffect(() => {
    return () => stopPolling();
  }, []);

  const fetchMonthlyTarget = React.useCallback(() => {
    if (!userData) return;
    const roleLower = String(userData.role || '').toLowerCase().trim();
    const isReception = roleLower.includes('reception') || roleLower.includes('branch') || roleLower === 'staff';
    if (!isReception) return;

    try {
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const targetsRef = collection(db, 'monthly_targets');
      const qTarget = query(targetsRef, where('month', '==', monthKey));

      let u1, u3;

      const unsubscribeTarget = onSnapshot(qTarget, (snapshot) => {
        if (!snapshot.empty) {
          const userB = (userData.branchName || userData.branchId || userData.branch || '').toLowerCase().trim();
          const targetDoc = snapshot.docs.find(d => {
            const data = d.data();
            const bId = (data.branchId || '').toLowerCase().trim();
            const bName = (data.branchName || '').toLowerCase().trim();
            return !userB || bId.includes(userB) || userB.includes(bId) || bName.includes(userB) || userB.includes(bName);
          }) || snapshot.docs[0];

          const targetData = targetDoc.data();
          setMonthlyTarget(targetData.target);
          setTargetReached(targetData.reached || 0);

          const branchId = userData.branchId || targetData.branchId;
          const branchName = userData.branchName || targetData.branchName;

          // Start dynamic Grand Total calculation identical to Admin
          const parseD = (raw) => {
            if (!raw) return null;
            if (raw.toDate) return raw.toDate();
            if (raw.seconds) return new Date(raw.seconds * 1000);
            if (typeof raw === 'string') {
              const parts = raw.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
                }
              }
            }
            const d = new Date(raw); return isNaN(d.getTime()) ? null : d;
          };
          const matchesYM = (dateVal) => {
            const d = parseD(dateVal);
            if (!d) return false;
            return d.getFullYear() === year && (d.getMonth() + 1) === month;
          };
          const isBranchMatchHelper = (itemBranchId, itemBranchName) => {
            if (!branchId || branchId === 'all') return true;
            const normalize = (val) => {
              if (!val) return '';
              const str = val.toLowerCase().trim();
              if (str.includes('kphb')) return 'kphb';
              if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
              if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilshuknagar';
              if (str.includes('nallagandla')) return 'nallagandla';
              return str.replace(/\s*branch\s*/i, '').trim();
            };
            const n1 = normalize(itemBranchId);
            const n2 = normalize(itemBranchName);
            const n3 = normalize(branchId);
            const n4 = normalize(branchName);
            return n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4 || itemBranchId === branchId || itemBranchName === branchName;
          };
          const getExactAmt = (p) => {
            if (p.paymentAmount !== undefined && p.paymentAmount !== null && p.paymentAmount !== '') return Number(p.paymentAmount);
            if (p.amountPaid !== undefined && p.amountPaid !== null && p.amountPaid !== '') return Number(p.amountPaid);
            if (p.itemsPaid?.consultation !== undefined) return Number(p.itemsPaid.consultation);
            return 0;
          };

          let txs = [];
          const recalc = () => {
            let total = 0;

            txs.forEach(t => {
              if (isBranchMatchHelper(t.branchId, t.branchName || t.branch) && matchesYM(t.timestamp || t.createdAt)) {
                const tType = (t.type || '').toLowerCase();
                const isAllowed = tType.includes('consultation') ||
                  tType.includes('medicine') ||
                  tType.includes('pharmacy') ||
                  tType.includes('product') ||
                  tType.includes('nutrition') ||
                  tType.includes('diet') ||
                  tType.includes('package');
                if (isAllowed) {
                  total += (Number(t.amount) || 0);
                }
              }
            });

            setTargetReached(total);
          };

          if (u3) u3();

          const qTxs = query(collection(db, 'alltransactions'), limit(1000));
          u3 = onSnapshot(qTxs, s => { txs = s.docs.map(d => ({ id: d.id, ...d.data() })); recalc(); }, (err) => {
            console.warn('alltransactions snapshot warning:', err);
          });

        } else {
          setMonthlyTarget(null);
          setTargetReached(0);
        }
      }, (error) => {
        console.error('Error fetching monthly target:', error);
      });

      return () => {
        unsubscribeTarget();
        if (u3) u3();
      };
    } catch (error) {
      console.error('Error setting up monthly target listener:', error);
    }
  }, [userData?.branchId, userData?.role]);

  const [activePackageMobiles, setActivePackageMobiles] = React.useState(new Set());

  // Dashboard Date Filter
  const [dashboardDate, setDashboardDate] = React.useState(new Date());
  const [showDashboardDatePicker, setShowDashboardDatePicker] = React.useState(false);
  const [dashSelectedBranch, setDashSelectedBranch] = React.useState('All Branches');

  const normalizeBranchName = (name) => {
    if (!name) return 'Unknown';
    const lower = name.toLowerCase();
    if (lower.includes('kphb')) return 'KPHB';
    if (lower.includes('chnr') || lower.includes('chandanagar') || lower.includes('chandnagar')) return 'Chandanagar';
    if (lower.includes('dsnr') || lower.includes('dilsukh') || lower.includes('dilshuk')) return 'Dilsukhnagar';
    if (lower.includes('nallagandla')) return 'Nallagandla';
    return name.trim();
  };

  // My Applied Leaves States
  const [myLeaves, setMyLeaves] = React.useState([]);
  const [totalAppliedLeaves, setTotalAppliedLeaves] = React.useState(0);

  // HR Branch Analytics states
  const [hrBranches, setHrBranches] = React.useState([]);
  const [hrSelectedBranchId, setHrSelectedBranchId] = React.useState('ALL');
  const [hrSelectedDate, setHrSelectedDate] = React.useState(new Date());
  const [showHRDatePicker, setShowHRDatePicker] = React.useState(false);
  const [showHRBranchModal, setShowHRBranchModal] = React.useState(false);
  const [hrTransactions, setHrTransactions] = React.useState([]);
  const [hrAppointments, setHrAppointments] = React.useState([]);
  const [hrPatients, setHrPatients] = React.useState([]);
  const [hrAnalyticsLoading, setHrAnalyticsLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query(collection(db, 'package_members'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mobiles = new Set();
      const today = new Date().toISOString().split('T')[0];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (today >= data.startDate && today <= data.endDate) {
          mobiles.add(data.patientMobile);
        }
      });
      setActivePackageMobiles(mobiles);
    }, (error) => {
      console.error("Error listening to package members in dashboard: ", error);
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!selectedPatientForPayment) return;

    const docConsult = selectedPatientForPayment?.consultationFee !== undefined && selectedPatientForPayment?.consultationFee !== null ? Number(selectedPatientForPayment.consultationFee) : 0;
    const followUp = selectedPatientForPayment?.followUpDate;
    if (followUp && checkIsInDuration(followUp) && docConsult === 0) {
      setConsultationFee(0);
      return;
    }

    const patientFee = Number(selectedPatientForPayment.paymentAmount) || Number(selectedPatientForPayment.requestedAmount) || Number(selectedPatientForPayment.amountRequested) || Number(selectedPatientForPayment.consultationFee);
    if (patientFee) {
      setConsultationFee(patientFee);
    } else {
      setConsultationFee('');
    }
  }, [selectedPatientForPayment]);

  const [monthlyMetrics, setMonthlyMetrics] = React.useState({
    present: 0,
    late: 0,
    halfDay: 0,
    permissions: 0,
    absent: 0,
    totalWorkingDays: 0
  });

  const fetchMonthlyMetrics = React.useCallback(async () => {
    const uid = auth.currentUser?.uid || userData?.uid;
    if (!uid) return;
    if (userData?.role === 'doctor') return;

    try {
      const today = new Date();
      const targetYear = today.getFullYear();
      const targetMonth = today.getMonth();

      const logsQ = query(
        collection(db, 'activity_logs'),
        where('userId', '==', uid)
      );
      const logsSnap = await getDocs(logsQ);
      const userLogs = [];
      logsSnap.forEach(d => {
        const log = d.data();
        if (log.timestamp) {
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          if (logDate.getFullYear() === targetYear && logDate.getMonth() === targetMonth) {
            userLogs.push({ ...log, dateObj: logDate });
          }
        }
      });

      const logsByDate = {};
      userLogs.forEach(log => {
        const dateKey = log.dateObj.toISOString().split('T')[0];
        if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
        logsByDate[dateKey].push(log);
      });

      const leavesQ = query(
        collection(db, 'leave_requests'),
        where('staffId', '==', uid),
        where('status', '==', 'approved')
      );
      const leavesSnap = await getDocs(leavesQ);
      const approvedLeaves = [];
      leavesSnap.forEach(d => {
        approvedLeaves.push(d.data());
      });

      let daysPresent = 0;
      let lateComings = 0;
      let halfDays = 0;
      let permissions = 0;

      const totalDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const currentDay = today.getDate();

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const currentDate = new Date(targetYear, targetMonth, day);
        const dateKey = currentDate.toISOString().split('T')[0];
        const logs = logsByDate[dateKey] || [];

        const dayLeaves = approvedLeaves.filter(req => req.startDate && req.endDate && dateKey >= req.startDate && dateKey <= req.endDate);
        const hasHalfDayLeave = dayLeaves.some(req => req.category === 'Half Day' || req.leaveType === 'Half Day');
        const hasPermissionLeave = dayLeaves.some(req => req.category === '1 Hour Permission' || req.leaveType === '1 Hour Permission');

        if (logs.length > 0) {
          daysPresent++;
          const sorted = [...logs].sort((a, b) => a.dateObj - b.dateObj);
          const firstIn = sorted.find(l => l.action === 'login') || sorted[0];
          const punchOutLog = [...sorted].reverse().find(l => l.action === 'logout') || sorted[sorted.length - 1];

          const hours = firstIn.dateObj.getHours();
          const minutes = firstIn.dateObj.getMinutes();
          const isLate = hours > 9 || (hours === 9 && minutes > 30);
          if (isLate) {
            lateComings++;
          }

          let workHours = 0;
          if (sorted.length > 1 || punchOutLog !== firstIn) {
            const lastOut = punchOutLog.dateObj;
            workHours = (lastOut - firstIn.dateObj) / (1000 * 60 * 60);
          }

          const isHalfDayWork = workHours >= 0.5 && workHours < 5;
          if (isHalfDayWork || hasHalfDayLeave) {
            halfDays++;
          }

          if (hasPermissionLeave) {
            permissions++;
          }
        }
      }

      let totalWorkingDays = 0;
      for (let day = 1; day <= totalDaysInMonth; day++) {
        const d = new Date(targetYear, targetMonth, day);
        if (d.getDay() !== 0) {
          totalWorkingDays++;
        }
      }

      let workingDaysUpToToday = 0;
      for (let day = 1; day <= currentDay; day++) {
        const d = new Date(targetYear, targetMonth, day);
        if (d.getDay() !== 0) {
          workingDaysUpToToday++;
        }
      }

      const fullLeavesCount = approvedLeaves.filter(req => {
        const isHalfOrPerm = ['Half Day', '1 Hour Permission'].includes(req.category || req.leaveType);
        return !isHalfOrPerm && req.startDate && req.endDate;
      }).reduce((acc, req) => {
        let count = 0;
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        const startOfMonth = new Date(targetYear, targetMonth, 1);
        const endOfMonth = new Date(targetYear, targetMonth + 1, 0);

        const rangeStart = start < startOfMonth ? startOfMonth : start;
        const rangeEnd = end > endOfMonth ? endOfMonth : end;

        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
          if (d.getDay() !== 0 && d <= today) {
            count++;
          }
        }
        return acc + count;
      }, 0);

      const absentCount = Math.max(0, workingDaysUpToToday - daysPresent - fullLeavesCount);

      setMonthlyMetrics({
        present: daysPresent,
        late: lateComings,
        halfDay: halfDays,
        permissions,
        absent: absentCount,
        totalWorkingDays
      });
    } catch (e) {
      console.error("Error computing staff monthly metrics:", e);
    }
  }, [userData]);

  const fetchMyLeaves = React.useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      // Query by staffId and userId for maximum backwards and forwards compatibility
      const q1 = query(collection(db, 'leave_requests'), where('staffId', '==', auth.currentUser.uid));
      const q2 = query(collection(db, 'leave_requests'), where('userId', '==', auth.currentUser.uid));

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      const uniqueDocs = new Map();
      snap1.forEach(d => uniqueDocs.set(d.id, { id: d.id, ...d.data() }));
      snap2.forEach(d => uniqueDocs.set(d.id, { id: d.id, ...d.data() }));

      const data = Array.from(uniqueDocs.values());

      // Sort in memory by createdAt descending
      data.sort((a, b) => {
        const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
        const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
        return timeB - timeA;
      });

      setMyLeaves(data);
      setTotalAppliedLeaves(data.length);
    } catch (e) {
      console.warn("Error fetching my leaves for dashboard:", e);
    }
  }, [userData]);

  const normalizeToDateString = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, '0');
      const d = String(dateVal.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
      const dObj = dateVal.toDate();
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof dateVal === 'string') {
      const cleanStr = dateVal.trim();
      if (cleanStr.includes('T')) {
        return cleanStr.split('T')[0];
      }
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          let d = parts[0], m = parts[1], y = parts[2];
          if (d.length === 4) {
            return `${d}-${m.padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
          let p0 = parts[0], p1 = parts[1], p2 = parts[2];
          if (p0.length === 4) {
            return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
          }
          return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
        }
      }
    }
    return null;
  };

  const getTodayDateString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y} -${m} -${d} `;
  };

  const getTransactionDateString = (trans) => {
    if (trans.timestamp) {
      return normalizeToDateString(trans.timestamp);
    }
    if (trans.createdAt) {
      return normalizeToDateString(trans.createdAt);
    }
    return null;
  };

  const isToday = (dateVal) => {
    if (!dateVal) return false;
    let d = null;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
      d = dateVal.toDate();
    } else if (typeof dateVal === 'object' && dateVal.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      d = new Date(dateVal);
    }
    if (!d || isNaN(d.getTime())) {
      const dateStr = String(dateVal).trim();
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          } else if (parts[0].length === 4) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          }
        }
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          } else {
            d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          }
        }
      }
    }
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const branchPerformanceToday = React.useMemo(() => {
    const stats = {};

    const normalizeBranchName = (name) => {
      if (!name) return 'Main Branch';
      let normalized = name.trim();
      if (normalized.toLowerCase().endsWith(' branch')) {
        normalized = normalized.substring(0, normalized.length - 7).trim();
      }
      return normalized;
    };

    hrBranches.forEach(b => {
      const rawName = b.name || b.branchName || 'Main Branch';
      const normName = normalizeBranchName(rawName);
      stats[normName] = { revenue: 0, patients: 0, followUpOpted: 0, followUpNotOpted: 0, name: normName };
    });

    const processedPatients = new Set();
    const paidItemsMap = new Map();

    const trackPaidItem = (key, itemsPaid) => {
      if (!key) return;
      if (!paidItemsMap.has(key)) paidItemsMap.set(key, { cons: false, med: false, diet: false });
      const entry = paidItemsMap.get(key);
      if (itemsPaid) {
        if (Number(itemsPaid.consultation || 0) > 0) entry.cons = true;
        if (Number(itemsPaid.medicine || 0) > 0) entry.med = true;
        if (Number(itemsPaid.dietPlan || 0) > 0) entry.diet = true;
      } else {
        entry.cons = true;
      }
    };

    hrPatients.forEach(p => {
      const dateVal = p.paymentCollectedAt || p.appointmentDate || p.createdAt || p.date;
      if (isToday(dateVal)) {
        const bName = normalizeBranchName(p.branchName || p.branch || 'Main Branch');
        if (!stats[bName]) {
          stats[bName] = { revenue: 0, patients: 0, followUpOpted: 0, followUpNotOpted: 0, name: bName };
        }

        if (p.paymentStatus === 'paid') {
          let amt = Number(p.paymentAmount || p.amountPaid || p.amount || p.totalAmount || 0);
          if (p.itemsPaid) {
            const cons = Number(p.itemsPaid.consultation || 0);
            const med = Number(p.itemsPaid.medicine || 0);
            const diet = Number(p.itemsPaid.dietPlan || 0);
            let other = 0;
            if (Array.isArray(p.itemsPaid.otherFees)) {
              other = p.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
            }
            const totalItems = cons + med + diet + other;
            if (totalItems > 0) amt = totalItems;
          }

          if (amt > 0) {
            stats[bName].revenue += amt;
            stats[bName].patients += 1;

            const regId = p.registrationId || p.regId || p.regID;
            if (p.id) {
              processedPatients.add(p.id);
              trackPaidItem(p.id, p.itemsPaid);
            }
            if (regId) {
              processedPatients.add(regId);
              trackPaidItem(regId, p.itemsPaid);
            }
          }
        }

        // Calculate Follow-up Opted and Not Opted for completed consultations
        const isDone = p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed';
        if (isDone) {
          const hasFollowUp = p.followUpInterval && p.followUpInterval !== 'No Follow-up' && p.followUpInterval !== '';
          if (hasFollowUp) {
            stats[bName].followUpOpted += 1;
          } else {
            stats[bName].followUpNotOpted += 1;
          }
        }
      }
    });

    hrTransactions.forEach(tr => {
      const dateVal = tr.timestamp || tr.createdAt || tr.date;
      if (isToday(dateVal)) {
        const rawType = (tr.type || '').toLowerCase();
        const isNutrition = rawType.includes('nutrition') || rawType.includes('diet');

        if (isNutrition) {
          if (tr.patientId && paidItemsMap.get(tr.patientId)?.diet) return;
          if (tr.registrationId && paidItemsMap.get(tr.registrationId)?.diet) return;
        } else if (rawType.includes('medicine') || rawType.includes('pharmacy')) {
          if (tr.patientId && paidItemsMap.get(tr.patientId)?.med) return;
          if (tr.registrationId && paidItemsMap.get(tr.registrationId)?.med) return;
        } else {
          if (tr.patientId && paidItemsMap.get(tr.patientId)?.cons) return;
          if (tr.registrationId && paidItemsMap.get(tr.registrationId)?.cons) return;
        }

        const bName = normalizeBranchName(tr.branchName || tr.branch || 'Main Branch');
        if (!stats[bName]) {
          stats[bName] = { revenue: 0, patients: 0, followUpOpted: 0, followUpNotOpted: 0, name: bName };
        }

        const amt = Number(tr.amount || tr.amountPaid || 0);
        if (amt > 0) {
          stats[bName].revenue += amt;
          if (tr.type === 'consultation' || tr.type === 'Consultation') {
            stats[bName].patients += 1;
            if (tr.patientId) {
              processedPatients.add(tr.patientId);
              trackPaidItem(tr.patientId, { consultation: amt });
            }
          }
        }
      }
    });

    return Object.values(stats);
  }, [hrBranches, hrPatients, hrTransactions]);

  const hrCalculatedStats = React.useMemo(() => {
    let selectedBranch = null;
    if (hrSelectedBranchId !== 'ALL') {
      selectedBranch = hrBranches.find(b => b.id === hrSelectedBranchId);
    }
    const branchName = selectedBranch ? selectedBranch.name : null;

    const todayStr = getTodayDateString();
    const targetDateStr = normalizeToDateString(hrSelectedDate);

    const belongsToBranch = (item) => {
      if (hrSelectedBranchId === 'ALL') return true;
      return item.branchId === hrSelectedBranchId || item.branchId === branchName || item.branchName === branchName || item.branchName === hrSelectedBranchId;
    };

    // Calculate Revenue
    let totalRevenue = 0;
    let todayRevenue = 0;
    hrTransactions.forEach(trans => {
      if (belongsToBranch(trans)) {
        const amt = parseFloat(trans.amount) || 0;
        totalRevenue += amt;

        const transDate = getTransactionDateString(trans);
        if (transDate === todayStr) {
          todayRevenue += amt;
        }
      }
    });

    // Normalize Walk-in bookings (patients)
    const walkinsList = [];
    hrPatients.forEach(p => {
      if (belongsToBranch(p)) {
        const dateStr = normalizeToDateString(p.appointmentDate);
        walkinsList.push({
          status: p.status || 'waiting',
          dateStr: dateStr,
          isPending: ['waiting', 'pending', 'confirmed'].includes(p.status?.toLowerCase() || 'waiting')
        });
      }
    });

    // Normalize Online bookings (appointments)
    const onlineList = [];
    hrAppointments.forEach(appt => {
      if (belongsToBranch(appt)) {
        const dateStr = normalizeToDateString(appt.dateString || appt.date);
        const statusVal = appt.status === 'pending' ? 'waiting' : (appt.status || 'waiting');
        onlineList.push({
          status: statusVal,
          dateStr: dateStr,
          isPending: ['waiting', 'pending', 'confirmed'].includes(statusVal.toLowerCase())
        });
      }
    });

    const combinedBookings = [...walkinsList, ...onlineList];

    let pendingBookings = 0;
    let todayBookings = 0;
    let upcomingBookings = 0;
    let selectedDateBookings = 0;

    combinedBookings.forEach(b => {
      if (b.isPending) {
        pendingBookings++;
      }
      if (b.dateStr === todayStr) {
        todayBookings++;
      }
      if (b.dateStr && b.dateStr > todayStr) {
        upcomingBookings++;
      }
      if (b.dateStr === targetDateStr) {
        selectedDateBookings++;
      }
    });

    return {
      totalRevenue,
      todayRevenue,
      totalAppointments: combinedBookings.length,
      pendingBookings,
      todayBookings,
      upcomingBookings,
      selectedDateBookings
    };
  }, [hrSelectedBranchId, hrSelectedDate, hrBranches, hrTransactions, hrAppointments, hrPatients]);

  React.useEffect(() => {
    if (!userData || userData.role !== 'hr') return;

    setHrAnalyticsLoading(true);

    const branchesQ = query(collection(db, 'users'), where('role', '==', 'branch'));
    const unsubBranches = onSnapshot(branchesQ, (snap) => {
      const branchesList = [];
      snap.forEach(d => {
        branchesList.push({ id: d.id, ...d.data() });
      });
      setHrBranches(branchesList);
      setHrAnalyticsLoading(false);
    }, (error) => {
      console.error('HR branches snapshot error:', error);
      setHrAnalyticsLoading(false);
    });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayISO = `${yyyy}-${mm}-${dd}`;
    const todaySlash = `${dd}/${mm}/${yyyy}`;

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const y_yyyy = yesterday.getFullYear();
    const y_mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const y_dd = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayISO = `${y_yyyy}-${y_mm}-${y_dd}`;
    const yesterdaySlash = `${y_dd}/${y_mm}/${y_yyyy}`;

    const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yesterdayStart.setHours(0, 0, 0, 0);

    const transQ = query(
      collection(db, 'alltransactions'),
      where('timestamp', '>=', yesterdayStart)
    );
    const unsubTrans = onSnapshot(transQ, (snap) => {
      const transList = [];
      snap.forEach(d => {
        transList.push({ id: d.id, ...d.data() });
      });
      setHrTransactions(transList);
    }, (error) => {
      console.error('HR transactions snapshot error:', error);
    });

    // Appointments collection is retired, keeping hrAppointments empty
    setHrAppointments([]);

    const patientsQ = query(
      collection(db, 'allpatients'),
      where('appointmentDate', 'in', [todayISO, todaySlash, yesterdayISO, yesterdaySlash])
    );
    const unsubPatients = onSnapshot(patientsQ, (snap) => {
      const patientsList = [];
      snap.forEach(d => {
        patientsList.push({ id: d.id, ...d.data() });
      });
      setHrPatients(patientsList);
    }, (error) => {
      console.error('HR patients snapshot error:', error);
    });

    return () => {
      unsubBranches();
      unsubTrans();
      unsubPatients();
    };
  }, [userData]);


  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setPatientsLoading(true);
    try {
      await fetchLastPunch();
      await fetchMonthlyMetrics();
      await fetchMyLeaves();
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setTimeout(() => {
        setPatientsLoading(false);
        setRefreshing(false);
      }, 400);
    }
  }, [userData, fetchMonthlyMetrics, fetchMyLeaves]);

  const fetchLastPunch = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('userId', '==', auth.currentUser.uid),
        where('action', 'in', ['login', 'logout'])
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const sortedDocs = snap.docs.sort((a, b) => {
          const timeA = a.data().timestamp?.toDate() || 0;
          const timeB = b.data().timestamp?.toDate() || 0;
          return timeB - timeA;
        });
        const lastLog = sortedDocs[0].data();

        // Check if there is both a login and logout today
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        const todayLogs = sortedDocs.map(d => d.data()).filter(log => {
          if (!log.timestamp) return false;
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          return logDate.getFullYear() === todayYear &&
            logDate.getMonth() === todayMonth &&
            logDate.getDate() === todayDate;
        });

        const hasLoginToday = todayLogs.some(log => log.action === 'login');
        const hasLogoutToday = todayLogs.some(log => log.action === 'logout');

        let yOutTime = null;
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayLogs = sortedDocs.map(d => d.data()).filter(log => {
          if (!log.timestamp) return false;
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          return logDate.getFullYear() === yesterday.getFullYear() &&
            logDate.getMonth() === yesterday.getMonth() &&
            logDate.getDate() === yesterday.getDate();
        });
        const yLogout = yesterdayLogs.find(log => log.action === 'logout');
        if (yLogout) {
          yOutTime = yLogout.timestamp.toDate ? yLogout.timestamp.toDate() : new Date(yLogout.timestamp);
        }
        setYesterdayPunchOutTime(yOutTime);

        if (hasLoginToday && hasLogoutToday) {
          setPunchStatus('completed');
        } else if (hasLoginToday) {
          setPunchStatus('login');
        } else {
          setPunchStatus('logout');
        }

        let actionTime = null;
        if (lastLog.timestamp) {
          actionTime = lastLog.timestamp.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
        }
        setLastActionTime(actionTime);

        const loginLog = todayLogs.find(log => log.action === 'login');
        const logoutLog = todayLogs.find(log => log.action === 'logout');

        setTodayPunchInTime(loginLog ? (loginLog.timestamp?.toDate ? loginLog.timestamp.toDate() : new Date(loginLog.timestamp)) : null);
        setTodayPunchOutTime(logoutLog ? (logoutLog.timestamp?.toDate ? logoutLog.timestamp.toDate() : new Date(logoutLog.timestamp)) : null);
      } else {
        setPunchStatus('logout');
      }
    } catch (error) {
      console.error('Error fetching last punch:', error);
    }
  };

  React.useEffect(() => {
    if (!userData) return;
    setPatientsLoading(true);

    const unsubscribeTarget = fetchMonthlyTarget();

    let unsubPatientsToday = () => { };
    let unsubApptsToday = () => { };
    let unsubPatientsYest = () => { };
    let unsubApptsYest = () => { };

    let latestWalkinsToday = [];
    let latestOnlineToday = [];
    let latestWalkinsYest = [];
    let latestOnlineYest = [];

    const combineAndSet = () => {
      const combined = [...latestWalkinsToday, ...latestOnlineToday, ...latestWalkinsYest, ...latestOnlineYest];

      const unique = [];
      const seen = new Set();
      for (const p of combined) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          unique.push(p);
        }
      }

      const parseTimeStr = (timeStr) => {
        if (!timeStr || timeStr === 'N/A') return 9999;
        const match = timeStr.match(/(\\d+):(\\d+)\\s*(AM|PM)/i);
        if (!match) return 9999;
        let hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + mins;
      };

      const sorted = unique.sort((a, b) => {
        const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
        const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
        if (qA !== qB) return qA - qB;

        const tA = parseTimeStr(a.appointmentTime || a.timeSlot);
        const tB = parseTimeStr(b.appointmentTime || b.timeSlot);

        if (tA !== tB) return tA - tB;

        const timeA = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : 0);
        const timeB = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : 0);
        return timeA - timeB;
      });
      setTodayPatients(sorted);
      setPatientsLoading(false);
    };

    const todayObj = new Date();
    const tDay = String(todayObj.getDate()).padStart(2, '0');
    const tMonth = String(todayObj.getMonth() + 1).padStart(2, '0');
    const tYear = todayObj.getFullYear();
    const todaySlashDate = `${tDay}/${tMonth}/${tYear}`;
    const todayDashDate = `${tYear}-${tMonth}-${tDay}`;

    const targetDay = String(dashboardDate.getDate()).padStart(2, '0');
    const targetMonth = String(dashboardDate.getMonth() + 1).padStart(2, '0');
    const targetYear = dashboardDate.getFullYear();
    const targetSlashDate = `${targetDay}/${targetMonth}/${targetYear}`;
    const targetDashDate = `${targetYear}-${targetMonth}-${targetDay}`;

    const generateDateVariants = (dObj) => {
      const dd = String(dObj.getDate()).padStart(2, '0');
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dObj.getFullYear();
      const dShort = String(dObj.getDate());
      const mShort = String(dObj.getMonth() + 1);
      return [
        `${dd}/${mm}/${yyyy}`,
        `${yyyy}-${mm}-${dd}`,
        `${dd}-${mm}-${yyyy}`,
        `${dShort}/${mShort}/${yyyy}`,
        `${yyyy}-${mShort}-${dShort}`,
        `${dShort}-${mShort}-${yyyy}`
      ];
    };

    const yest = new Date(dashboardDate.getTime() - 24 * 60 * 60 * 1000);
    const yDay = String(yest.getDate()).padStart(2, '0');
    const yMonth = String(yest.getMonth() + 1).padStart(2, '0');
    const yYear = yest.getFullYear();
    const ySlashDate = `${yDay}/${yMonth}/${yYear}`;
    const yDashDate = `${yYear}-${yMonth}-${yDay}`;

    const combinedDates = Array.from(new Set([
      targetSlashDate, targetDashDate,
      todaySlashDate, todayDashDate,
      ySlashDate, yDashDate
    ])).slice(0, 10);

    if (userData.role === 'doctor') {
      const qPatients = query(
        collection(db, 'allpatients'),
        where('appointmentDate', 'in', combinedDates),
        limit(200)
      );
      unsubPatientsToday = onSnapshot(qPatients, (snap) => {
        const listToday = [];
        const listYest = [];
        const listAllUpcoming = [];
        const docNorm = normalizeDoctorName(userData.name || '');

        snap.forEach(doc => {
          const p = doc.data();
          if (p.isDeleted) return;
          const allowedStatuses = ['pending', 'booked', 'waiting', 'in-consultation', 'completed', 'done'];
          if (!allowedStatuses.includes(p.status)) return;

          let dateStr = p.dateString;
          if (!dateStr && p.appointmentDate) {
            let apptDateStr = '';
            if (typeof p.appointmentDate === 'string') {
              apptDateStr = p.appointmentDate;
            } else if (p.appointmentDate && typeof p.appointmentDate.toDate === 'function') {
              const d = p.appointmentDate.toDate();
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              apptDateStr = `${dd}/${mm}/${yyyy}`;
            }

            if (apptDateStr) {
              const parts = apptDateStr.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (parts[0].length === 4) {
                  dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
              }
            }
          }

          const patDocNorm = normalizeDoctorName(p.doctor || p.doctorName || '');
          if (patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm))) {
            if (p.status === 'booked' && p.paymentStatus !== 'paid') return;
            const item = { id: doc.id, ...p, _type: 'walkin', firestoreCollection: 'allpatients' };
            item.fullName = item.fullName || item.patientName || 'Online Patient';
            item.phone = item.phone || 'N/A';
            item.dateString = p.dateString || dateStr;
            item.appointmentDate = p.appointmentDate || dateStr;
            item.appointmentTime = p.appointmentTime || p.timeSlot || 'N/A';
            item.doctor = p.doctor ? (p.doctor.startsWith('Dr.') ? p.doctor : `Dr. ${p.doctor}`) : 'General Doctor';
            item.status = p.status === 'pending' ? 'waiting' : (p.status || 'waiting');

            if (dateStr === targetDashDate) listToday.push(item);
            else if (dateStr === yDashDate) listYest.push(item);

            if (['waiting', 'booked', 'confirmed', 'pending'].includes(item.status)) {
              if (dateStr === todayDashDate) {
                listAllUpcoming.push(item);
              }
            }
          }
        });

        // Sort upcoming list chronologically
        const parseTimeStr = (timeStr) => {
          if (!timeStr || timeStr === 'N/A') return 9999;
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 9999;
          let hours = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          return hours * 60 + mins;
        };

        listAllUpcoming.sort((a, b) => {
          const dateA = a.dateString || a.appointmentDate || '';
          const dateB = b.dateString || b.appointmentDate || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);

          const tA = parseTimeStr(a.appointmentTime || a.timeSlot);
          const tB = parseTimeStr(b.appointmentTime || b.timeSlot);
          return tA - tB;
        });

        setAllUpcomingAppointments(listAllUpcoming);

        latestWalkinsToday = listToday;
        latestWalkinsYest = listYest;
        combineAndSet();
      });

      // Online appointments listener - DEPRECATED: appointments are now unified in allpatients
      latestOnlineToday = [];
      latestOnlineYest = [];
      unsubApptsToday = () => { };

    } else {
      const branchVariations = new Set();
      if (userData.branchId) branchVariations.add(userData.branchId);
      if (userData.branchName) branchVariations.add(userData.branchName);

      const checkAndAdd = (name) => {
        if (!name) return;
        const lower = name.toLowerCase();
        if (lower.includes('kphb')) { branchVariations.add('KPHB'); branchVariations.add('KPHB Branch'); }
        else if (lower.includes('chnr') || lower.includes('chandanagar') || lower.includes('chandnagar')) { branchVariations.add('Chandnagar'); branchVariations.add('Chandnagar Branch'); branchVariations.add('Chandanagar'); branchVariations.add('CHANDNAGAR'); }
        else if (lower.includes('dsnr') || lower.includes('dilsukhnagar') || lower.includes('dilshuknagar')) { branchVariations.add('Dilshuknagar'); branchVariations.add('Dilshuknagar Branch'); branchVariations.add('Dilsukhnagar'); }
        else if (lower.includes('nallagandla')) { branchVariations.add('Nallagandla'); branchVariations.add('Nallagandla Branch'); }
      };

      checkAndAdd(userData.branchId);
      checkAndAdd(userData.branchName);
      const branchNames = Array.from(branchVariations);

      const isBranchMatch = (item) => {
        const myBranch1 = normalizeBranchName(userData.branchId);
        const myBranch2 = normalizeBranchName(userData.branchName);
        const dataBranch1 = normalizeBranchName(item.branchId || item.branch);
        const dataBranch2 = normalizeBranchName(item.branchName);

        if (myBranch1 === 'all' || myBranch1 === '' || myBranch1 === 'all branches') return true;

        return (
          dataBranch1 === myBranch1 || dataBranch1 === myBranch2 ||
          dataBranch2 === myBranch1 || dataBranch2 === myBranch2
        );
      };

      const qPatients = query(
        collection(db, 'allpatients'),
        where('appointmentDate', 'in', combinedDates),
        limit(200)
      );
      unsubPatientsToday = onSnapshot(qPatients, (snap) => {
        const listToday = [];
        const listYest = [];
        const listAllUpcoming = [];

        snap.forEach(doc => {
          const data = doc.data();
          if (data.isDeleted) return;
          const allowedStatuses = ['waiting', 'booked', 'confirmed', 'pending', 'in-consultation', 'completed', 'done'];
          if (!allowedStatuses.includes(data.status)) return;
          if (!isBranchMatch(data)) return;

          let dateStr = data.dateString;
          if (!dateStr && data.appointmentDate) {
            let apptDateStr = '';
            if (typeof data.appointmentDate === 'string') {
              apptDateStr = data.appointmentDate;
            } else if (data.appointmentDate && typeof data.appointmentDate.toDate === 'function') {
              const d = data.appointmentDate.toDate();
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              apptDateStr = `${dd}/${mm}/${yyyy}`;
            }

            if (apptDateStr) {
              const parts = apptDateStr.split(/[-/]/);
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (parts[0].length === 4) {
                  dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
              }
            }
          }

          const item = { id: doc.id, ...data, _type: 'walkin', firestoreCollection: 'allpatients' };

          // Re-map fields so existing logic that depended on 'appointments' fields continues to work without appts collection
          item.fullName = item.fullName || item.patientName || 'Online Patient';
          item.phone = item.phone || 'N/A';
          item.dateString = data.dateString || dateStr;
          item.appointmentDate = data.appointmentDate || dateStr;
          item.appointmentTime = data.appointmentTime || data.timeSlot || 'N/A';
          item.doctor = data.doctor ? (data.doctor.startsWith('Dr.') ? data.doctor : `Dr. ${data.doctor}`) : 'General Doctor';
          item.status = data.status === 'pending' ? 'waiting' : (data.status || 'waiting');

          if (dateStr === targetDashDate) listToday.push(item);
          else if (dateStr === yDashDate) listYest.push(item);

          if (['waiting', 'booked', 'confirmed', 'pending'].includes(item.status)) {
            if (dateStr === todayDashDate) {
              listAllUpcoming.push(item);
            }
          }
        });

        // Sort upcoming list chronologically
        const parseTimeStr = (timeStr) => {
          if (!timeStr || timeStr === 'N/A') return 9999;
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 9999;
          let hours = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          return hours * 60 + mins;
        };

        listAllUpcoming.sort((a, b) => {
          const dateA = a.dateString || a.appointmentDate || '';
          const dateB = b.dateString || b.appointmentDate || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);

          const tA = parseTimeStr(a.appointmentTime || a.timeSlot);
          const tB = parseTimeStr(b.appointmentTime || b.timeSlot);
          return tA - tB;
        });

        setAllUpcomingAppointments(listAllUpcoming);

        latestWalkinsToday = listToday;
        latestWalkinsYest = listYest;
        combineAndSet();
      });

      // Online appointments listener - DEPRECATED: appointments are now unified in allpatients
      latestOnlineToday = [];
      latestOnlineYest = [];
      unsubApptsToday = () => { };
    }

    return () => {
      if (unsubPatientsToday) unsubPatientsToday();
      if (unsubPatientsYest) unsubPatientsYest(); // not used, but safe
      if (unsubApptsToday) unsubApptsToday(); // not used, but safe
      if (unsubApptsYest) unsubApptsYest(); // not used, but safe
      if (unsubscribeTarget) unsubscribeTarget();
    };
  }, [userData, dashboardDate]);

  React.useEffect(() => {
    const task = setTimeout(() => {
      fetchLastPunch();
      fetchMonthlyMetrics();
      fetchMyLeaves();
    }, 0);

    const unsubscribe = navigation.addListener('focus', () => {
      setTimeout(() => {
        fetchLastPunch();
        fetchMonthlyMetrics();
        fetchMyLeaves();
      }, 0);
    });

    return () => {
      clearTimeout(task);
      unsubscribe();
    };
  }, [navigation, userData, fetchMonthlyMetrics, fetchMyLeaves]);

  const handleCaptureSelfie = async () => {
    try {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        alert('Camera permission is required to capture a selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const base64Img = result.assets[0].base64;
      const uri = result.assets[0].uri;
      if (!base64Img) {
        throw new Error('Failed to get image data');
      }

      setCapturedSelfieBase64(base64Img);
      setCapturedSelfieUri(uri);
    } catch (error) {
      console.error('Capture selfie error:', error);
      alert('Failed to capture selfie. Please try again.');
    }
  };

  const handlePunch = async () => {
    if (punching) return;
    if (punchStatus === 'completed') {
      alert("You have already completed your punch-in and punch-out for today!");
      return;
    }
    if (!capturedSelfieBase64) {
      alert("Please capture a selfie first!");
      return;
    }
    setPunching(true);
    setLocationError(null);

    try {
      // Debug assertions to find the undefined function
      const assertions = {
        'uploadBytes': typeof uploadBytes,
        'ref': typeof ref,
        'getDownloadURL': typeof getDownloadURL,
        'Location.hasServicesEnabledAsync': typeof Location.hasServicesEnabledAsync,
        'Location.requestForegroundPermissionsAsync': typeof Location.requestForegroundPermissionsAsync,
        'Location.getCurrentPositionAsync': typeof Location.getCurrentPositionAsync,
        'Location.getLastKnownPositionAsync': typeof Location.getLastKnownPositionAsync,
        'Location.reverseGeocodeAsync': typeof Location.reverseGeocodeAsync,
        'addDoc': typeof addDoc,
        'collection': typeof collection,
        'serverTimestamp': typeof serverTimestamp,
        'notifyAllHRs': typeof notifyAllHRs,
      };
      for (const [name, type] of Object.entries(assertions)) {
        if (type !== 'function') {
          throw new Error(`${name} is not a function (type: ${type})`);
        }
      }

      let photoUrl = null;

      // 1. Convert local selfie URI to Blob
      if (!capturedSelfieUri) {
        alert('Selfie is required for Punching.');
        setPunching(false);
        return;
      }
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) {
          console.error('[Punch] Blob conversion error:', e);
          reject(new TypeError("Network request failed"));
        };
        xhr.responseType = "blob";
        xhr.open("GET", capturedSelfieUri, true);
        xhr.send(null);
      });

      // 2. Upload pre-captured selfie Blob using uploadBytes
      const filename = `attendance_selfies/${auth.currentUser?.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, blob);
      photoUrl = await getDownloadURL(snapshot.ref);

      // 3. Enforce Location/GPS Services are Enabled on the device
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please pull down your menu and turn ON your device Location / GPS to record your attendance.',
          [{ text: 'OK', style: 'default' }]
        );
        setPunching(false);
        return;
      }

      // 4. Capture Location Permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to punch in/out. Please tap "Settings" below and allow location access.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        setLocationError('Permission to access location was denied');
        setPunching(false);
        return;
      }

      // 5. Query Current Position (No fallback coordinates)
      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (locErr) {
        console.warn('GPS active query failed during attendance punch, trying last known position...', locErr);
        try {
          location = await Location.getLastKnownPositionAsync();
        } catch (fallbackErr) {
          console.warn('Fallback GPS query failed:', fallbackErr);
        }
      }

      if (!location) {
        alert('Unable to retrieve your location. Please check that your GPS/Location services are turned on and try again.');
        setPunching(false);
        return;
      }

      let address = 'Hyderabad, Telangana';
      try {
        const addressArray = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (addressArray && addressArray[0]) {
          address = `${addressArray[0].name || ''} ${addressArray[0].street || ''}, ${addressArray[0].city || ''} `.trim() || 'Hyderabad';
        }
      } catch (addrErr) {
        console.warn('Reverse geocode failed during attendance punch:', addrErr);
      }

      const nextAction = punchStatus === 'login' ? 'logout' : 'login';

      await addDoc(collection(db, 'activity_logs'), {
        userId: auth.currentUser.uid,
        userName: userData?.name || userData?.fullName || 'Staff Member',
        userRole: userData?.role || 'staff',
        branchId: userData?.branchId || '',
        branchName: userData?.branchName || userData?.branch || 'Unknown',
        action: nextAction,
        photoUrl: photoUrl,
        timestamp: serverTimestamp(),
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address,
          accuracy: location.coords.accuracy
        }
      });

      // Notify all HR users
      try {
        const staffName = userData?.name || userData?.fullName || 'Staff Member';
        const branchName = userData?.branchName || userData?.branch || 'Unknown';
        const actionLabel = nextAction === 'login' ? 'IN' : 'OUT';
        const notifTitle = nextAction === 'login' ? '📥 Staff Punched IN' : '📤 Staff Punched OUT';
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const notifBody = `${staffName} from ${branchName} Branch has punched ${actionLabel} at ${timeStr}.`;

        await notifyAllHRs(notifTitle, notifBody, 'attendance_punch', {
          staffId: auth.currentUser.uid,
          branchName: branchName,
          action: nextAction
        });
      } catch (notifErr) {
        console.warn('Error notifying HRs about attendance punch:', notifErr);
      }

      const now = new Date();
      if (nextAction === 'login') {
        setTodayPunchInTime(now);
      } else {
        setTodayPunchOutTime(now);
      }

      setPunchStatus(nextAction);
      setLastActionTime(now);
      setCapturedSelfieBase64(null);
      setCapturedSelfieUri(null);
      alert(`Punched ${nextAction === 'login' ? 'In' : 'Out'} Successfully!`);
    } catch (error) {
      console.error('Punch error:', error, error.stack);
      alert(`Failed to record attendance. Error: ${error.message || 'Unknown'}. Please check GPS/Network and try again.`);
    } finally {
      setPunching(false);
    }
  };
  const handleStartConsultation = async (patientId, type) => {
    navigation.navigate('PatientDetails', { patientId });

    // Background execution
    try {
      const collectionName = 'allpatients'; // Fallback logic is handled inside if needed, but 'type' is passed.
      const patientRef = doc(db, collectionName, patientId);
      await updateDoc(patientRef, {
        status: 'in-consultation',
        consultationStartedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error starting consultation:', error);
    }
  };

  const handleApproveMedicineDiscount = async (patientId, requestedAmount) => {
    try {
      const patient = todayPatientsFiltered.find(p => p.id === patientId);
      const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, patientId);

      await updateDoc(docRef, {
        medicineFeeRequested: requestedAmount,
        medicineDiscountStatus: 'approved',
        updatedAt: serverTimestamp()
      });

      try {
        const notifTitle = '✓ Medicine Discount Approved';
        const notifBody = `Medicine discount request for ${patient?.fullName || 'Patient'} was approved! New Amount: ₹${requestedAmount}.`;
        if (patient?.medicineDiscountRequestedBy) {
          await createNotification(patient.medicineDiscountRequestedBy, notifTitle, notifBody, 'medicine_discount_approved', { patientId });
        } else {
          await notifyAllReceptionists(notifTitle, notifBody, 'medicine_discount_approved', { patientId });
        }
      } catch (notifErr) {
        console.warn('Failed to send push notification to receptionists:', notifErr);
      }

      alert('Medicine Discount Approved');
    } catch (error) {
      console.error('Error approving medicine discount:', error);
      alert('Failed to approve discount');
    }
  };

  const handleRejectMedicineDiscount = async (patientId) => {
    try {
      const patient = todayPatientsFiltered.find(p => p.id === patientId);
      const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, patientId);

      await updateDoc(docRef, {
        medicineDiscountStatus: 'rejected',
        updatedAt: serverTimestamp()
      });

      try {
        const notifTitle = '✕ Medicine Discount Rejected';
        const notifBody = `Medicine discount request for ${patient?.fullName || 'Patient'} was rejected. Fee remains ₹${patient?.medicineFeeRequested || patient?.medicineDiscountOriginal}.`;
        if (patient?.medicineDiscountRequestedBy) {
          await createNotification(patient.medicineDiscountRequestedBy, notifTitle, notifBody, 'medicine_discount_rejected', { patientId });
        } else {
          await notifyAllReceptionists(notifTitle, notifBody, 'medicine_discount_rejected', { patientId });
        }
      } catch (notifErr) {
        console.warn('Failed to send push notification to receptionists:', notifErr);
      }

      alert('Medicine Discount Rejected');
    } catch (error) {
      console.error('Error rejecting medicine discount:', error);
      alert('Failed to reject discount');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: triggerSignOut }
      ],
      { cancelable: true }
    );
  };

  const triggerSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Fire database cleanup and activity logs asynchronously in background (non-blocking)
        updateDoc(doc(db, 'users', currentUser.uid), { expoPushToken: null }).catch(e => console.warn(e));
        addDoc(collection(db, 'activity_logs'), {
          userId: currentUser.uid,
          userName: userData?.name || 'Staff Member',
          userRole: userData?.role || 'staff',
          branchId: userData?.branchId || '',
          action: 'app_logout',
          timestamp: serverTimestamp()
        }).catch(e => console.warn(e));
      }
      // Instant sign-out
      await auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      await auth.signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleOpenPaymentModal = async (patient) => {
    console.log("=== handleOpenPaymentModal started for patient ===", patient?.fullName, patient?.id);
    setSelectedPatientForPayment(patient);



    const docConsultFee = patient.consultationFee !== undefined && patient.consultationFee !== null ? Number(patient.consultationFee) : 0;
    const docMedFee = patient.medicineFeeRequested !== undefined && patient.medicineFeeRequested !== null ? Number(patient.medicineFeeRequested) : 0;

    const consultAmt = patient.consultationFee !== undefined && patient.consultationFee !== null ? Number(patient.consultationFee) : (Number(patient.paymentAmount) || Number(patient.requestedAmount) || Number(patient.amountRequested) || 0);
    setIncludeConsultation(true);
    setConsultationFee(consultAmt);

    if (docMedFee > 0) {
      setIncludeMedicine(true);
      setMedicineFee(docMedFee);
    } else {
      setIncludeMedicine(false);
      setMedicineFee(0);
    }
    setIncludeDiet(false);
    setDietFee(0);
    setActiveDietPlanId(null);
    setOtherFees([{ note: '', amount: 0 }]);
    setOtherFees([{ note: '', amount: 0 }]);

    // If patient is in duration and doctor did not specify a fee, auto-set consultation to 0
    const followUp = patient?.followUpDate;
    if (followUp && checkIsInDuration(followUp) && docConsultFee === 0) {
      setConsultationFee(0);
    }

    // Default payment method: Online bookings (where firestoreCollection is appointments) default to "app"
    const isOnline = patient.firestoreCollection === 'appointments' || patient._type === 'online';
    const defaultMethod = isOnline ? 'app' : 'cash';
    setPaymentMethod(defaultMethod);
    setPaymentLegs([{ method: defaultMethod, amount: '' }]);
    if (patient.medicines && patient.medicines.length > 0) {
      setMedicines(patient.medicines);
    } else {
      setMedicines([]);
    }
    if (patient.prescriptionDuration) {
      setPrescriptionDuration(patient.prescriptionDuration);
    } else {
      setPrescriptionDuration('');
    }

    console.log("=== setting paymentModalVisible to true ===");
    setPaymentModalVisible(true);

    try {
      const q = query(
        collection(db, 'nutrition_plans'),
        where('paymentStatus', '==', 'pending')
      );
      const snap = await getDocs(q);
      const pendingPlan = snap.docs.find(doc => {
        const data = doc.data();
        const cleanPatientPhone = (patient.phone || '').replace(/\D/g, '').slice(-10);
        const cleanPlanPhone = (data.patientPhone || '').replace(/\D/g, '').slice(-10);
        return data.patientId === patient.id || (cleanPatientPhone && cleanPatientPhone === cleanPlanPhone);
      });
      if (pendingPlan) {
        const dietPlanAmt = Number(pendingPlan.data().amount || 0);
        setIncludeDiet(true);
        setDietFee(dietPlanAmt);
        setActiveDietPlanId(pendingPlan.id);
      }
    } catch (err) {
      console.warn("Could not load pending nutrition plan:", err);
    }
  };

  const handleMarkUnpaid = async () => {
    if (!selectedPatientForPayment) return;

    try {
      const collectionName = selectedPatientForPayment.firestoreCollection || (selectedPatientForPayment._type === 'online' ? 'appointments' : 'patients');
      const ref = doc(db, collectionName, selectedPatientForPayment.id);
      const currentStatus = selectedPatientForPayment.status;

      await updateDoc(ref, {
        paymentStatus: 'unpaid',
        paymentAmount: 0,
        paymentMethod: '',
        paymentCollectedAt: null,
        status: currentStatus === 'pending' ? 'waiting' : currentStatus,
      });

      setPaymentModalVisible(false);
      setSelectedPatientForPayment(null);
    } catch (error) {
      console.error("Error marking unpaid:", error);
    }
  };

  const handleSendFeeToPatient = async (splitDetails = null) => {
    if (!selectedPatientForPayment) return;
    const isSplit = !!splitDetails;
    try {
      const collectionName = selectedPatientForPayment.firestoreCollection || (selectedPatientForPayment._type === 'online' ? 'appointments' : 'patients');
      const ref = doc(db, collectionName, selectedPatientForPayment.id);

      const itemsPaid = {
        consultation: includeConsultation ? Number(consultationFee) : 0,
        medicine: includeMedicine ? Number(medicineFee) : 0,
        dietPlan: includeDiet ? Number(dietFee) : 0
      };

      const requestedAmount = Number(isSplit ? splitDetails.upiAmount : feeAmount);

      const updatePayload = {
        paymentRequested: true,
        requestedAmount: requestedAmount,
        paymentRequestedAt: serverTimestamp(),
        paymentMethod: isSplit ? 'split' : 'online',
        itemsPaid: itemsPaid,
        includeDiet: includeDiet,
        activeDietPlanId: includeDiet ? activeDietPlanId : null,
        ...(isSplit ? {
          splitCounterAmount: Number(splitDetails.counterAmount),
          splitCounterMethod: splitDetails.counterMethod || 'cash',
          splitUpiAmount: Number(splitDetails.upiAmount)
        } : {})
      };

      await updateDoc(ref, updatePayload);

      if (selectedPatientForPayment.appointmentId) {
        try {
          await updateDoc(doc(db, 'allpatients', selectedPatientForPayment.appointmentId), updatePayload);
        } catch (allSyncErr) {
          console.warn("Could not sync payment request to allpatients collection:", allSyncErr);
        }
        try {
          await updateDoc(doc(db, 'appointments', selectedPatientForPayment.appointmentId), updatePayload);
        } catch (syncErr) {
          console.warn("Could not sync payment request to legacy appointments collection:", syncErr);
        }
      }

      // Mark matching nutrition plan as paid if diet plan checkbox selected
      if (includeDiet && activeDietPlanId) {
        try {
          await updateDoc(doc(db, 'nutrition_plans', activeDietPlanId), {
            paymentStatus: 'paid',
            paymentCollectedAt: new Date().toISOString(),
            paymentMethod: 'split',
            amountPaid: Number(dietFee)
          });

          // Send notification to patient app
          const patientUid = selectedPatientForPayment.patientId || selectedPatientForPayment.id;
          if (patientUid && patientUid !== 'WALKIN_USER') {
            await addDoc(collection(db, 'notifications'), {
              userId: patientUid,
              title: '🥦 30-Day Diet Plan Unlocked!',
              body: 'Your custom 30-day nutrition and diet plan is now unlocked and available in your app!',
              type: 'diet_unlocked',
              isRead: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (planErr) {
          console.warn("Could not mark nutrition plan as paid:", planErr);
        }
      }

      // Log immediate transaction for counter leg
      if (isSplit && Number(splitDetails.counterAmount) > 0) {
        await addDoc(collection(db, 'alltransactions'), {
          type: includeMedicine ? 'medicine' : 'consultation',
          patientId: selectedPatientForPayment.id,
          patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Walk-in Patient',
          regId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
          registrationId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
          phone: selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '',
          doctor: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || '',
          amount: Number(splitDetails.counterAmount),
          method: splitDetails.counterMethod,
          branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
          branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
          recordedBy: userData?.name || 'Staff',
          paymentId: 'SPLIT_COUNTER_' + splitDetails.counterMethod.toUpperCase(),
          itemsPaid: itemsPaid,
          timestamp: serverTimestamp()
        });
      }

      Alert.alert(
        "Request Sent",
        isSplit
          ? `Collected ₹${splitDetails.counterAmount} at counter.Sent UPI payment request of ₹${splitDetails.upiAmount} to patient.`
          : `Consultation fee request of ₹${feeAmount} sent successfully to the patient app!`
      );

      // Push notification trigger
      try {
        const cleanPhone = (selectedPatientForPayment.phone || '').replace(/\D/g, '').slice(-10);
        let patientUid = selectedPatientForPayment.patientId || null;
        if (!patientUid && cleanPhone) {
          const qPatients = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
          const snapPatients = await getDocs(qPatients);
          if (!snapPatients.empty) {
            patientUid = snapPatients.docs[0].id;
          }
        }

        if (patientUid && patientUid !== 'WALKIN_USER') {
          const notifBody = isSplit
            ? `₹${splitDetails.counterAmount} collected via ${splitDetails.counterMethod.toUpperCase()} at counter.Please pay remaining ₹${splitDetails.upiAmount} via UPI in the app.`
            : `Spiritual Homeopathy - Clinic has requested ₹${feeAmount} for your consultation.Tap to pay online.`;

          await addDoc(collection(db, 'notifications'), {
            userId: patientUid,
            title: isSplit ? '💰 Split Payment Requested' : '💳 Fee Payment Requested',
            body: notifBody,
            type: 'payment_requested',
            amount: isSplit ? (Number(splitDetails.counterAmount) + Number(splitDetails.upiAmount)) : Number(feeAmount),
            isRead: false,
            createdAt: serverTimestamp()
          });

          const tokens = [];
          const addToken = (t) => {
            if (t && typeof t === 'string' && !tokens.includes(t)) {
              tokens.push(t);
            }
          };
          const addTokens = (arr) => {
            if (Array.isArray(arr)) {
              arr.forEach(t => addToken(t));
            }
          };

          if (patientUid) {
            try {
              const patSnap = await getDoc(doc(db, 'patients', patientUid));
              if (patSnap.exists()) {
                const d = patSnap.data();
                addToken(d.expoPushToken);
                addTokens(d.expoPushTokens);
              }
            } catch (e) { }
          }
          if (cleanPhone) {
            try {
              const qPat = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
              const snapPat = await getDocs(qPat);
              snapPat.forEach(d => {
                const data = d.data();
                addToken(data.expoPushToken);
                addTokens(data.expoPushTokens);
              });
            } catch (e) { }
          }
          if (patientUid) {
            try {
              const allPatSnap = await getDoc(doc(db, 'allpatients', patientUid));
              if (allPatSnap.exists()) {
                const d = allPatSnap.data();
                addToken(d.expoPushToken);
                addTokens(d.expoPushTokens);
              }
            } catch (e) { }
          }

          if (tokens.length > 0) {
            const messages = tokens.map(t => ({
              to: t,
              sound: 'default',
              title: isSplit ? '💰 Split Payment Requested' : '💳 Fee Payment Requested',
              body: notifBody,
              data: { type: 'payment_requested' },
              priority: 'high',
              channelId: 'payment_v3',
            }));

            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(messages),
            });
          }
        }
      } catch (notifErr) {
        console.error("Error sending notification:", notifErr);
      }

      setPaymentModalVisible(false);
      setSelectedPatientForPayment(null);
    } catch (e) {
      console.error("Error sending fee to patient:", e);
      Alert.alert("Error", "Failed to send payment request.");
    }
  };

  const handleCompleteRzpCheckout = async () => {
    const amount = Number(feeAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid consultation fee amount.');
      return;
    }
    if (!selectedPatientForPayment) {
      Alert.alert('Error', 'No patient selected for payment.');
      return;
    }
    if (!NativeModules.RNRazorpayCheckout) {
      Alert.alert(
        'Razorpay Module Missing',
        'The Razorpay native module is not loaded. If you are running in Expo Go, please build the app as a Development Build (e.g. run "npx expo run:android" or "npm run android") to include native libraries.'
      );
      return;
    }

    setProcessingRzp(true);
    try {
      const options = {
        description: `Walk -in Consultation Fee - ${selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient'} `,
        image: 'https://i.imgur.com/3g7A6tw.png',
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        amount: Math.round(amount * 100), // amount in paise
        name: 'Spiritual Homeopathy Clinic',
        prefill: {
          email: selectedPatientForPayment.email || '',
          contact: selectedPatientForPayment.phone || '',
          name: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient'
        },
        theme: { color: '#0ea5e9' }
      };

      RazorpayCheckout.open(options).then(async (data) => {
        const paymentId = data.razorpay_payment_id;
        await handleQuickPayment(paymentId, true);
        setProcessingRzp(false);
      }).catch((error) => {
        setProcessingRzp(false);
        console.error('Razorpay error:', error);
        if (error.code !== 'payment_cancelled') {
          Alert.alert('Payment Failed', error.description || 'Payment could not be processed. Please try again.');
        }
      });
    } catch (e) {
      console.error('Error initiating Razorpay checkout:', e);
      Alert.alert('Payment Setup Error', 'Failed to initiate payment. Please try again.');
      setProcessingRzp(false);
    }
  };

  const handleRequestUnlock = async () => {
    console.log("=== handleRequestUnlock started for selectedPatient =", selectedPatientForPayment?.id);
    if (!selectedPatientForPayment) {
      console.warn("=== handleRequestUnlock returned: selectedPatientForPayment is null ===");
      return;
    }
    setRequestingUnlock(true);
    try {
      const data = {
        billId: selectedPatientForPayment.id,
        patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient',
        patientPhone: selectedPatientForPayment.phone || 'N/A',
        branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
        branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
        requestedBy: userData?.name || 'Receptionist (Mobile)',
        status: 'pending',
        createdAt: serverTimestamp()
      };
      console.log("=== adding doc to checkout_unlock_requests with data:", JSON.stringify(data));
      const ref = await addDoc(collection(db, 'checkout_unlock_requests'), data);
      console.log("=== unlock request doc added successfully. ID =", ref.id);
      Alert.alert('Sent', 'Unlock request sent to HR. Waiting for approval...');
    } catch (err) {
      console.error('=== Error creating unlock request ===:', err);
      Alert.alert('Error', 'Failed to send unlock request.');
    } finally {
      setRequestingUnlock(false);
    }
  };

  const handleQuickPayment = async (razorpayPaymentId, isQrPayment = false, currentLegs = null) => {
    if (!selectedPatientForPayment) return;
    setProcessingRzp(true);
    // Default to the new legs, fallback to state
    const legs = currentLegs || paymentLegs;
    const isSplit = legs.length > 1;
    const usedMethod = isSplit ? 'split' : (isQrPayment ? 'upi' : legs[0].method);

    // For legacy split handling in db:
    let splitMethod1 = 'cash';
    let split1Amt = 0;
    let splitMethod2 = 'upi';
    let split2Amt = 0;

    if (isSplit) {
      splitMethod1 = legs[0].method;
      split1Amt = Number(legs[0].amount);
      splitMethod2 = legs[1].method;
      split2Amt = Number(legs[1].amount);
    } else {
      splitMethod1 = usedMethod;
      split1Amt = Number(legs[0].amount) || Number(feeAmount);
    }

    const itemsPaid = {
      consultation: includeConsultation ? Number(consultationFee) : 0,
      medicine: includeMedicine ? Number(medicineFee) : (includeMedicineOnly ? Number(medicineOnlyFee) : 0),
      dietPlan: includeDiet ? Number(dietFee) : 0,
      otherFees: otherFees.filter(f => Number(f.amount) > 0),
      medicinesList: (includeMedicine || includeMedicineOnly) ? medicines : [],
      prescriptionDuration: (includeMedicine || includeMedicineOnly) ? prescriptionDuration : ''
    };

    if (usedMethod === 'split') {
      if (Math.round((split1Amt + split2Amt) * 100) !== Math.round(Number(feeAmount) * 100)) {
        Alert.alert('Invalid Split Amounts', `The sum of split amounts (₹${split1Amt + split2Amt}) must equal the total fee (₹${feeAmount}).`);
        setProcessingRzp(false);
        return;
      }

      const hasUpi = splitMethod1 === 'upi' || splitMethod2 === 'upi';
      if (hasUpi) {
        const upiAmt = splitMethod1 === 'upi' ? split1Amt : split2Amt;
        const counterAmt = splitMethod1 === 'upi' ? split2Amt : split1Amt;
        const counterMethod = splitMethod1 === 'upi' ? splitMethod2 : splitMethod1;

        if (upiAmt > 0) {
          try {
            const collectionName = selectedPatientForPayment.firestoreCollection || (selectedPatientForPayment._type === 'online' ? 'appointments' : 'patients');
            const ref = doc(db, collectionName, selectedPatientForPayment.id);
            const currentStatus = selectedPatientForPayment.status;

            // 1. Update appointment document as pending with requestedAmount = upiAmt
            await updateDoc(ref, {
              paymentStatus: 'pending',
              paymentRequested: true,
              requestedAmount: upiAmt,
              paymentRequestedAt: serverTimestamp(),
              paymentMethod: 'split',
              splitCounterMethod: counterMethod,
              splitCounterAmount: counterAmt,
              splitUpiAmount: upiAmt,
              itemsPaid: itemsPaid,
              includeDiet: includeDiet,
              activeDietPlanId: includeDiet ? activeDietPlanId : null,
              pendingAmount: Number(payLaterAmount) || 0,
              ...(includeMedicine ? {
                medicineFeeStatus: 'paid',
                medicineFeeCollectedAt: serverTimestamp(),
                medicineFeeMethod: 'split'
              } : {}),
              status: currentStatus === 'completed' ? 'done' : (currentStatus === 'pending' ? 'waiting' : currentStatus)
            });

            // Mark matching nutrition plan as paid if diet plan checkbox selected
            if (includeDiet && activeDietPlanId) {
              try {
                await updateDoc(doc(db, 'nutrition_plans', activeDietPlanId), {
                  paymentStatus: 'paid',
                  paymentCollectedAt: new Date().toISOString(),
                  paymentMethod: 'split',
                  amountPaid: Number(dietFee)
                });

                // Send notification to patient app
                const patientUid = selectedPatientForPayment.patientId || selectedPatientForPayment.id;
                if (patientUid && patientUid !== 'WALKIN_USER') {
                  await addDoc(collection(db, 'notifications'), {
                    userId: patientUid,
                    title: '🥦 30-Day Diet Plan Unlocked!',
                    body: 'Your custom 30-day nutrition and diet plan is now unlocked and available in your app!',
                    type: 'diet_unlocked',
                    isRead: false,
                    createdAt: serverTimestamp()
                  });
                }
              } catch (planErr) {
                console.warn("Could not mark nutrition plan as paid:", planErr);
              }
            }

            // 2. Log immediate transaction for counter leg
            if (counterAmt > 0) {
              await addDoc(collection(db, 'alltransactions'), {
                type: includeMedicine ? 'medicine' : 'consultation',
                patientId: selectedPatientForPayment.id,
                patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Walk-in Patient',
                regId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
                registrationId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
                phone: selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '',
                doctor: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || '',
                amount: counterAmt,
                method: counterMethod,
                branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
                branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
                recordedBy: userData?.name || 'Staff',
                paymentId: 'SPLIT_COUNTER_' + counterMethod.toUpperCase(),
                itemsPaid: itemsPaid,
                timestamp: serverTimestamp()
              });
            }

            // 3. Send receipt notification / push notification for split requested
            try {
              const cleanPhone = (selectedPatientForPayment.phone || '').replace(/\D/g, '').slice(-10);
              let patientUid = selectedPatientForPayment.patientId || null;
              if (!patientUid && cleanPhone) {
                const qPatients = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
                const snapPatients = await getDocs(qPatients);
                if (!snapPatients.empty) {
                  patientUid = snapPatients.docs[0].id;
                }
              }

              if (patientUid && patientUid !== 'WALKIN_USER') {
                const msgBody = `Split payment requested: ₹${counterAmt} collected via ${counterMethod.toUpperCase()} at counter, remaining ₹${upiAmt} requested via UPI.`;
                await addDoc(collection(db, 'notifications'), {
                  userId: patientUid,
                  title: '💳 Split Payment Requested',
                  body: msgBody,
                  type: 'payment_requested',
                  isRead: false,
                  createdAt: serverTimestamp()
                });

                const tokens = [];
                const addToken = (t) => {
                  if (t && typeof t === 'string' && !tokens.includes(t)) {
                    tokens.push(t);
                  }
                };
                const addTokens = (arr) => {
                  if (Array.isArray(arr)) {
                    arr.forEach(t => addToken(t));
                  }
                };

                if (patientUid) {
                  try {
                    const patSnap = await getDoc(doc(db, 'patients', patientUid));
                    if (patSnap.exists()) {
                      const d = patSnap.data();
                      addToken(d.expoPushToken);
                      addTokens(d.expoPushTokens);
                    }
                  } catch (e) { }
                }
                if (cleanPhone) {
                  try {
                    const qPat = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
                    const snapPat = await getDocs(qPat);
                    snapPat.forEach(d => {
                      const data = d.data();
                      addToken(data.expoPushToken);
                      addTokens(data.expoPushTokens);
                    });
                  } catch (e) { }
                }
                if (patientUid) {
                  try {
                    const allPatSnap = await getDoc(doc(db, 'allpatients', patientUid));
                    if (allPatSnap.exists()) {
                      const d = allPatSnap.data();
                      addToken(d.expoPushToken);
                      addTokens(d.expoPushTokens);
                    }
                  } catch (e) { }
                }

                if (tokens.length > 0) {
                  const messages = tokens.map(t => ({
                    to: t,
                    sound: 'default',
                    title: '💳 Split Payment Requested',
                    body: msgBody,
                    data: { type: 'payment_requested' },
                    priority: 'high',
                    channelId: 'payment_v3',
                  }));

                  await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                      Accept: 'application/json',
                      'Accept-encoding': 'gzip, deflate',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                  });
                }
              }
            } catch (notifErr) {
              console.error("Error sending split notification:", notifErr);
            }

            // Consume checkout unlock request if it was approved
            if (unlockRequest && unlockRequest.status === 'approved') {
              try {
                await updateDoc(doc(db, 'checkout_unlock_requests', unlockRequest.id), {
                  status: 'used',
                  usedAt: new Date().toISOString()
                });
              } catch (err) {
                console.warn('Error marking unlock request as used:', err);
              }
            }

            stopPolling();
            setPaymentModalVisible(false);
            setSelectedPatientForPayment(null);
            setPaymentLegs([{ method: 'cash', amount: '' }]);
            Alert.alert('Request Sent', `Collected ₹${counterAmt} at counter. Sent UPI payment request of ₹${upiAmt} to patient.`);
            setProcessingRzp(false);
            return;
          } catch (err) {
            console.error("Error in split UPI flow receptionist:", err);
            Alert.alert("Error", "Failed to initiate split payment request.");
            setProcessingRzp(false);
            return;
          }
        }
      }
    }

    try {
      const collectionName = selectedPatientForPayment.firestoreCollection || (selectedPatientForPayment._type === 'online' ? 'appointments' : 'patients');
      const ref = doc(db, collectionName, selectedPatientForPayment.id);
      const currentStatus = selectedPatientForPayment.status;

      const updateData = {
        paymentStatus: 'paid',
        paymentAmount: Number(feeAmount),
        paymentMethod: usedMethod,
        paymentCollectedAt: serverTimestamp(),
        status: (currentStatus === 'completed' || currentStatus === 'done' || currentStatus === 'prescribed') ? 'done' : (currentStatus === 'pending' ? 'waiting' : (currentStatus || 'waiting')),
        paymentId: razorpayPaymentId || (selectedPatientForPayment._type === 'online' ? 'ONLINE_' : 'WALKIN_') + usedMethod.toUpperCase(),
        itemsPaid: itemsPaid,
        includeDiet: includeDiet,
        pendingAmount: Number(payLaterAmount) || 0,
        isInDuration: selectedPatientForPayment.followUpDate ? checkIsInDuration(selectedPatientForPayment.followUpDate) : false,
        ...(includeMedicine ? {
          medicineFeeStatus: 'paid',
          medicineFeeCollectedAt: serverTimestamp(),
          medicineFeeMethod: usedMethod
        } : {}),
        ...(usedMethod === 'split' ? {
          paymentSplitDetails: {
            [splitMethod1]: split1Amt,
            [splitMethod2]: split2Amt
          }
        } : {})
      };

      await updateDoc(ref, updateData);

      // ALWAYS sync to allpatients for backward compatibility and unified view
      if (collectionName !== 'allpatients') {
        try {
          await updateDoc(doc(db, 'allpatients', selectedPatientForPayment.id), updateData);
        } catch (allpatSyncErr) {
          console.warn("Could not sync corresponding allpatients payment:", allpatSyncErr);
        }
      }
      // Sync corresponding appointment if walk-in patient is paid
      if (collectionName === 'patients' && selectedPatientForPayment.appointmentId) {
        try {
          await updateDoc(doc(db, 'allpatients', selectedPatientForPayment.appointmentId), {
            paymentStatus: 'paid',
            paymentAmount: Number(feeAmount),
            paymentMethod: usedMethod,
            paymentCollectedAt: serverTimestamp(),
            status: 'done',
            paymentId: razorpayPaymentId || 'WALKIN_' + usedMethod.toUpperCase(),
            itemsPaid: itemsPaid,
            includeDiet: includeDiet,
            pendingAmount: Number(payLaterAmount) || 0,
            ...(includeMedicine ? {
              medicineFeeStatus: 'paid',
              medicineFeeCollectedAt: serverTimestamp(),
              medicineFeeMethod: usedMethod
            } : {}),
            ...(usedMethod === 'split' ? {
              paymentSplitDetails: {
                [splitMethod1]: split1Amt,
                [splitMethod2]: split2Amt
              }
            } : {})
          });
        } catch (allApptSyncErr) {
          console.warn("Could not sync corresponding allpatients payment:", allApptSyncErr);
        }
        try {
          await updateDoc(doc(db, 'appointments', selectedPatientForPayment.appointmentId), {
            paymentStatus: 'paid',
            paymentAmount: Number(feeAmount),
            paymentMethod: usedMethod,
            paymentCollectedAt: serverTimestamp(),
            status: 'done',
            paymentId: razorpayPaymentId || 'WALKIN_' + usedMethod.toUpperCase(),
            itemsPaid: itemsPaid,
            includeDiet: includeDiet,
            pendingAmount: Number(payLaterAmount) || 0,
            ...(includeMedicine ? {
              medicineFeeStatus: 'paid',
              medicineFeeCollectedAt: serverTimestamp(),
              medicineFeeMethod: usedMethod
            } : {}),
            ...(usedMethod === 'split' ? {
              paymentSplitDetails: {
                [splitMethod1]: split1Amt,
                [splitMethod2]: split2Amt
              }
            } : {})
          });
        } catch (apptSyncErr) {
          console.warn("Could not sync corresponding legacy appointment payment:", apptSyncErr);
        }
      }

      // Mark matching nutrition plan as paid if diet plan checkbox selected
      if (includeDiet && activeDietPlanId) {
        try {
          await updateDoc(doc(db, 'nutrition_plans', activeDietPlanId), {
            paymentStatus: 'paid',
            paymentCollectedAt: new Date().toISOString(),
            paymentMethod: usedMethod,
            amountPaid: Number(dietFee)
          });

          // Send notification to patient app
          const patientUid = selectedPatientForPayment.patientId || selectedPatientForPayment.id;
          if (patientUid && patientUid !== 'WALKIN_USER') {
            await addDoc(collection(db, 'notifications'), {
              userId: patientUid,
              title: '🥦 30-Day Diet Plan Unlocked!',
              body: 'Your custom 30-day nutrition and diet plan is now unlocked and available in your app!',
              type: 'diet_unlocked',
              isRead: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (planErr) {
          console.warn("Could not mark nutrition plan as paid:", planErr);
        }
      }

      // Award reward points ONLY if appointment is from Patient App (online booking)
      if (selectedPatientForPayment._type === 'online') {
        const amountPaid = Number(feeAmount);
        const pointsEarned = Math.floor(amountPaid / 100) * 2;

        if (pointsEarned > 0) {
          const cleanPhone = (selectedPatientForPayment.phone || '').replace(/\D/g, '').slice(-10);
          let patientUid = selectedPatientForPayment.patientId || null;
          let patientDocRef = null;

          if (patientUid && patientUid !== 'WALKIN_USER') {
            patientDocRef = doc(db, 'allpatients', patientUid);
          } else if (cleanPhone) {
            // Find patient document by phone number
            const qPatients = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
            const snapPatients = await getDocs(qPatients);
            if (!snapPatients.empty) {
              patientDocRef = doc(db, 'allpatients', snapPatients.docs[0].id);
              patientUid = snapPatients.docs[0].id;
            }
          }

          const patientNameVal = selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient';

          if (patientDocRef) {
            await updateDoc(patientDocRef, {
              rewardPoints: increment(pointsEarned)
            });
          } else {
            // Create profile document in patients collection if not exists
            const newPatientRef = await addDoc(collection(db, 'allpatients'), {
              fullName: patientNameVal,
              phone: cleanPhone,
              rewardPoints: pointsEarned,
              createdAt: new Date().toISOString()
            });
            patientUid = newPatientRef.id;
          }

          // Generate coupon code
          const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
          const generatedCouponCode = `SPH - ${randomHex} `;
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          const expiryDateStr = expiryDate.toISOString().split('T')[0];

          await addDoc(collection(db, 'coupons'), {
            code: generatedCouponCode,
            userId: patientUid,
            patientName: patientNameVal,
            patientPhone: cleanPhone,
            pointsValue: pointsEarned,
            discountAmount: pointsEarned,
            status: 'active',
            createdAt: serverTimestamp(),
            expiryDate: expiryDate,
            expiryDateStr: expiryDateStr
          });

          // Log reward points transaction
          await addDoc(collection(db, 'reward_points_transactions'), {
            userId: patientUid,
            patientName: patientNameVal,
            type: 'earn',
            points: pointsEarned,
            description: `Earned ${pointsEarned} points for consultation fee payment of ${selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || 'Doctor'} (Paid at Reception)`,
            createdAt: serverTimestamp()
          });
        }
      }

      // Log revenue transaction
      if (usedMethod === 'split') {
        if (split1Amt > 0) {
          await addDoc(collection(db, 'alltransactions'), {
            type: includeMedicine ? 'medicine' : 'consultation',
            patientId: selectedPatientForPayment.id,
            patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Walk-in Patient',
            regId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
            registrationId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
            phone: selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '',
            doctor: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || '',
            amount: split1Amt,
            method: splitMethod1,
            branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
            branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
            recordedBy: userData?.name || 'Staff',
            paymentId: razorpayPaymentId || ('SPLIT_LEG1_' + splitMethod1.toUpperCase()),
            itemsPaid: itemsPaid,
            timestamp: serverTimestamp()
          });
        }
        if (split2Amt > 0) {
          await addDoc(collection(db, 'alltransactions'), {
            type: includeMedicine ? 'medicine' : 'consultation',
            patientId: selectedPatientForPayment.id,
            patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Walk-in Patient',
            regId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
            registrationId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
            phone: selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '',
            doctor: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || '',
            amount: split2Amt,
            method: splitMethod2,
            branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
            branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
            recordedBy: userData?.name || 'Staff',
            paymentId: razorpayPaymentId || ('SPLIT_LEG2_' + splitMethod2.toUpperCase()),
            itemsPaid: itemsPaid,
            timestamp: serverTimestamp()
          });
        }
      } else {
        await addDoc(collection(db, 'alltransactions'), {
          type: includeMedicine ? 'medicine' : 'consultation',
          patientId: selectedPatientForPayment.id,
          patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Walk-in Patient',
          regId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
          registrationId: selectedPatientForPayment.registrationId || selectedPatientForPayment.regId || selectedPatientForPayment.regID || '',
          phone: selectedPatientForPayment.phone || selectedPatientForPayment.patientPhone || '',
          doctor: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || '',
          amount: Number(feeAmount),
          method: usedMethod,
          branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
          branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
          recordedBy: userData?.name || 'Staff',
          paymentId: razorpayPaymentId || '',
          itemsPaid: itemsPaid,
          timestamp: serverTimestamp()
        });
      }

      // Sync online booking payments with patients visit collection to reflect on SuperAdmin Consultation Revenue Dashboard
      if (selectedPatientForPayment._type === 'online') {
        const cleanPhone = (selectedPatientForPayment.phone || '').replace(/\D/g, '').slice(-10);
        const apptDate = selectedPatientForPayment.appointmentDate || '';

        await addDoc(collection(db, 'allpatients'), {
          fullName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Online Patient',
          phone: cleanPhone,
          email: selectedPatientForPayment.email || '',
          registrationId: selectedPatientForPayment.regId || 'ONLINE',
          doctor: selectedPatientForPayment.doctor || 'General Doctor',
          subject: selectedPatientForPayment.subject || 'Online Appointment Consultation',
          appointmentDate: apptDate,
          paymentStatus: 'paid',
          paymentAmount: Number(feeAmount),
          paymentMethod: usedMethod,
          paymentCollectedAt: new Date().toISOString(),
          branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
          branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
          source: 'UserApp',
          appointmentId: selectedPatientForPayment.id, // Linked original appointment ID
          createdAt: new Date().toISOString(),
          itemsPaid: itemsPaid,
          includeDiet: includeDiet,
          status: currentStatus === 'completed' ? 'done' : (currentStatus === 'pending' ? 'waiting' : currentStatus),
          ...(usedMethod === 'split' ? {
            paymentSplitDetails: {
              [splitMethod1]: split1Amt,
              [splitMethod2]: split2Amt
            }
          } : {})
        });
      }

      // Add patient to patient_list collection after payment completion
      await addDoc(collection(db, 'patient_list'), {
        patientId: selectedPatientForPayment.id,
        fullName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Online Patient',
        phone: selectedPatientForPayment.phone || '',
        email: selectedPatientForPayment.email || '',
        regId: selectedPatientForPayment.regId || '',
        doctor: selectedPatientForPayment.doctor || '',
        branchId: selectedPatientForPayment.branchId || userData?.branchId || 'Unknown',
        branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Unknown',
        paymentStatus: 'paid',
        paymentAmount: feeAmount,
        paymentMethod: usedMethod,
        paymentCollectedAt: serverTimestamp(),
        appointmentDate: selectedPatientForPayment.appointmentDate || '',
        appointmentTime: selectedPatientForPayment.appointmentTime || selectedPatientForPayment.timeSlot || '',
        followUpDate: selectedPatientForPayment.followUpDate || '',
        followUpInterval: selectedPatientForPayment.followUpInterval || '',
        addedBy: userData?.name || 'Staff',
        timestamp: serverTimestamp()
      });

      // Update monthly target reached count
      const today = new Date();
      const monthKey = `${today.getFullYear()} -${String(today.getMonth() + 1).padStart(2, '0')} `;
      const branchId = userData?.branchId || selectedPatientForPayment.branchId;

      if (branchId) {
        const targetsRef = collection(db, 'monthly_targets');
        const q = query(targetsRef, where('month', '==', monthKey), where('branchId', '==', branchId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const targetDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'monthly_targets', targetDoc.id), {
            reached: (targetDoc.data().reached || 0) + Number(feeAmount || 0)
          });
        }
      }

      // Create detailed payment receipt notification for patient in Firestore & send push notification
      try {
        const cleanPhone = (selectedPatientForPayment.phone || '').replace(/\D/g, '').slice(-10);
        let patientUid = selectedPatientForPayment.patientId || null;

        if (!patientUid && cleanPhone) {
          const qPatients = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
          const snapPatients = await getDocs(qPatients);
          if (!snapPatients.empty) {
            patientUid = snapPatients.docs[0].id;
          }
        }

        if (patientUid && patientUid !== 'WALKIN_USER') {
          let msgBody = `Your consultation fee of ₹${feeAmount} has been confirmed.`;
          if (usedMethod === 'split') {
            msgBody = `Your consultation fee of ₹${feeAmount} is paid(Paid: ₹${split1Amt} via ${splitMethod1.toUpperCase()} and ₹${split2Amt} via ${splitMethod2.toUpperCase()}).`;
          } else {
            msgBody = `Your consultation fee of ₹${feeAmount} is paid via ${usedMethod.toUpperCase()}.`;
          }

          await addDoc(collection(db, 'notifications'), {
            userId: patientUid,
            title: '💳 Payment Confirmed',
            body: msgBody,
            type: 'payment_receipt',
            isRead: false,
            createdAt: serverTimestamp()
          });

          // Trigger Expo push notification if push token exists
          try {
            const tokens = [];
            const addToken = (t) => {
              if (t && typeof t === 'string' && !tokens.includes(t)) {
                tokens.push(t);
              }
            };
            const addTokens = (arr) => {
              if (Array.isArray(arr)) {
                arr.forEach(t => addToken(t));
              }
            };

            if (patientUid) {
              try {
                const patSnap = await getDoc(doc(db, 'patients', patientUid));
                if (patSnap.exists()) {
                  const d = patSnap.data();
                  addToken(d.expoPushToken);
                  addTokens(d.expoPushTokens);
                }
              } catch (e) { }
            }
            if (cleanPhone) {
              try {
                const qPat = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
                const snapPat = await getDocs(qPat);
                snapPat.forEach(d => {
                  const data = d.data();
                  addToken(data.expoPushToken);
                  addTokens(data.expoPushTokens);
                });
              } catch (e) { }
            }
            if (patientUid) {
              try {
                const allPatSnap = await getDoc(doc(db, 'allpatients', patientUid));
                if (allPatSnap.exists()) {
                  const d = allPatSnap.data();
                  addToken(d.expoPushToken);
                  addTokens(d.expoPushTokens);
                }
              } catch (e) { }
            }

            if (tokens.length > 0) {
              const messages = tokens.map(t => ({
                to: t,
                sound: 'default',
                title: '💳 Payment Confirmed',
                body: msgBody,
                data: { type: 'payment_receipt' },
                priority: 'high',
                channelId: 'payment_v3',
              }));

              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Accept-encoding': 'gzip, deflate',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
              });
              console.log("[Push Notification] Sent successfully to tokens:", tokens.join(', '));
            }
          } catch (pushErr) {
            console.error("Error sending push notification to patient:", pushErr);
          }
        }
      } catch (err) {
        console.error("Error in notification dispatch:", err);
      }

      // Consume checkout unlock request if it was approved
      if (unlockRequest && unlockRequest.status === 'approved') {
        try {
          await updateDoc(doc(db, 'checkout_unlock_requests', unlockRequest.id), {
            status: 'used',
            usedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Error marking unlock request as used:', err);
        }
      }

      // Close payment modal and show confirmation screen
      stopPolling();
      setPaymentModalVisible(false);
      setSelectedPatientForPayment(null);
      setPaymentLegs([{ method: 'cash', amount: '' }]);
      setRazorpayQrCode(null);

      // Fire local notification for staff (receptionist confirmation)
      try {
        const pName = selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient';
        if (selectedPatientForPayment._type === 'online') {
          await schedulePatientPaidNotification(pName, feeAmount, usedMethod);
        } else {
          await scheduleWalkInPaymentNotification(pName, feeAmount, usedMethod);
        }

        // Trigger SMS payment receipt confirmation
        const today = new Date();
        const dateStrForSms = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        sendPaymentReceiptSMS(
          selectedPatientForPayment.phone || '',
          pName,
          feeAmount,
          razorpayPaymentId || ((selectedPatientForPayment._type === 'online' ? 'ONLINE_' : 'WALKIN_') + usedMethod.toUpperCase()),
          dateStrForSms,
          selectedPatientForPayment.branchName || userData?.branchName || 'KPHB'
        );
      } catch (notifErr) {
        console.warn('[Dashboard] Notification error:', notifErr);
      }

      // Show confirmation screen
      setPayConfirmData({
        amount: feeAmount,
        method: usedMethod,
        patientName: selectedPatientForPayment.fullName || selectedPatientForPayment.patientName || 'Patient',
        paymentId: razorpayPaymentId || ((selectedPatientForPayment._type === 'online' ? 'ONLINE_' : 'WALKIN_') + usedMethod.toUpperCase()),
        isQr: isQrPayment,
        phone: selectedPatientForPayment.phone || '',
        doctorName: selectedPatientForPayment.doctor || selectedPatientForPayment.doctorName || 'Doctor',
        specialty: selectedPatientForPayment.specialty || 'General Homeopathy',
        branchName: selectedPatientForPayment.branchName || userData?.branchName || 'Clinic',
        appointmentDate: selectedPatientForPayment.appointmentDate || selectedPatientForPayment.dateString || selectedPatientForPayment.date || '',
        appointmentTime: selectedPatientForPayment.appointmentTime || selectedPatientForPayment.timeSlot || '',
        paymentCollectedAt: new Date().toISOString(),
        itemsPaid: itemsPaid,
        includeDiet: includeDiet,
        paymentSplitDetails: usedMethod === 'split' ? {
          [splitMethod1]: split1Amt,
          [splitMethod2]: split2Amt
        } : null
      });
      setPayConfirmVisible(true);
      setProcessingRzp(false);

    } catch (e) {
      console.error('Payment error:', e);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
      setProcessingRzp(false);
    }
  };

  const handleDeleteAppointment = (patient) => {
    Alert.alert(
      "Delete Appointment",
      `Are you sure you want to permanently delete ${patient.fullName} 's appointment?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
              await deleteDoc(doc(db, collectionName, patient.id));
              alert('Appointment deleted successfully.');
            } catch (error) {
              console.error("Error deleting appointment:", error);
              alert("Failed to delete appointment.");
            }
          }
        }
      ]
    );
  };

  // ── Receptionist Dashboard: WhatsApp & Reschedule ────────────────────────
  const handleMoveQueueDash = async (patient, direction) => {
    try {
      const activePatients = todayPatients.filter(p => isMatchingDate(p.appointmentDate, dashboardDate)).filter(p => {
        const sP = (p.status || '').toLowerCase();
        return p.doctor === patient.doctor &&
          (p.branchName || p.branchId) === (patient.branchName || patient.branchId) &&
          (sP === 'waiting' || sP === 'pending' || sP === 'confirmed' || sP === 'booked');
      });

      const currentIndex = activePatients.findIndex(p => p.id === patient.id);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= activePatients.length) return;

      const targetPatient = activePatients[targetIndex];

      const coll1 = patient.firestoreCollection || (patient._type === 'online' ? 'appointments' : 'patients');
      const ref1 = doc(db, coll1, patient.id);

      const coll2 = targetPatient.firestoreCollection || (targetPatient._type === 'online' ? 'appointments' : 'patients');
      const ref2 = doc(db, coll2, targetPatient.id);

      const qOrder1 = patient.queueOrder !== undefined ? patient.queueOrder : currentIndex;
      const qOrder2 = targetPatient.queueOrder !== undefined ? targetPatient.queueOrder : targetIndex;

      await updateDoc(ref1, { queueOrder: qOrder2 });
      await updateDoc(ref2, { queueOrder: qOrder1 });

    } catch (err) {
      console.error('Error moving queue in Dashboard:', err);
      Alert.alert('Error', 'Failed to move patient in queue.');
    }
  };
  const [dashRescheduleModalVisible, setDashRescheduleModalVisible] = React.useState(false);

  const [statModalVisible, setStatModalVisible] = React.useState(false);
  const [statModalTitle, setStatModalTitle] = React.useState('');
  const [statModalData, setStatModalData] = React.useState([]);

  const handleStatClick = (title, filterFn) => {
    setStatModalTitle(title);
    setStatModalData(todayPatientsFiltered.filter(filterFn));
    setStatModalVisible(true);
  };
  const [dashRescheduleItem, setDashRescheduleItem] = React.useState(null);
  const [dashRescheduleDate, setDashRescheduleDate] = React.useState(new Date());
  const [showDashRescheduleDatePicker, setShowDashRescheduleDatePicker] = React.useState(false);
  const [dashRescheduleBranch, setDashRescheduleBranch] = React.useState('');
  const [dashRescheduleDoctor, setDashRescheduleDoctor] = React.useState('');
  const [showDashDoctorPickerModal, setShowDashDoctorPickerModal] = React.useState(false);
  const [showDashBranchPickerModal, setShowDashBranchPickerModal] = React.useState(false);
  const [dashRescheduleTime, setDashRescheduleTime] = React.useState(new Date());
  const [showDashRescheduleTimePicker, setShowDashRescheduleTimePicker] = React.useState(false);
  const [dashAvailableSlots, setDashAvailableSlots] = React.useState([]);
  const [fetchingDashSlots, setFetchingDashSlots] = React.useState(false);

  const DASH_CANONICAL_BRANCHES = [
    'KPHB Branch', 'Chandanagar Branch', 'Dilshuknagar Branch', 'Nallagandla Branch'
  ];
  const DASH_CANONICAL_DOCTORS = [
    'Dr. Prashanth K Vaidya', 'Dr. Ramakrishna Chanduri', 'Dr. Jobedah Parveej', 'Dr. Padma Priya'
  ];

  const formatDashTimeStr = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    return `${hoursStr}:${minutesStr} ${ampm}`;
  };

  React.useEffect(() => {
    let unsubExtra = null;
    const fetchSlots = async () => {
      if (!dashRescheduleDoctor || !dashRescheduleBranch || !dashRescheduleDate) {
        setDashAvailableSlots([]);
        return;
      }
      setFetchingDashSlots(true);
      try {
        const year = dashRescheduleDate.getFullYear();
        const month = String(dashRescheduleDate.getMonth() + 1).padStart(2, '0');
        const day = String(dashRescheduleDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const DEFAULT_SLOTS = [
          '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM',
          '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
        ];

        const qAppts = query(
          collection(db, 'allpatients'),
          where('dateString', '==', dateString)
        );
        const snapAppts = await getDocs(qAppts).catch(() => ({ docs: [] }));
        const counts = {};
        snapAppts.forEach(d => {
          const t = d.data().timeSlot || d.data().appointmentTime;
          if (t) counts[t] = (counts[t] || 0) + 1;
        });

        const qExtra = query(
          collection(db, 'extra_slots'),
          where('dateString', '==', dateString)
        );

        unsubExtra = onSnapshot(qExtra, (snapExtra) => {
          let extraList = [];
          snapExtra.forEach(ds => {
            const data = ds.data();
            if (Array.isArray(data.slots)) extraList.push(...data.slots);
          });
          const combined = [...new Set([...DEFAULT_SLOTS, ...extraList])];
          combined.sort((a, b) => {
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

          const isToday = dashRescheduleDate.toDateString() === new Date().toDateString();
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

          const parseToMin = (t) => {
            const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
            if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };

          const slotsMeta = combined.map(timeStr => {
            const booked = counts[timeStr] || 0;
            const sessionsLeft = Math.max(0, 3 - booked);
            const slotMin = parseToMin(timeStr);
            const isPast = isToday && slotMin <= nowMinutes;
            const isFull = sessionsLeft <= 0;
            return {
              time: timeStr,
              bookedCount: booked,
              sessionsLeft,
              isPast,
              isFull,
              isBlocked: isPast || isFull,
              isAvailable: !isPast && !isFull
            };
          });
          setDashAvailableSlots(slotsMeta);
          setFetchingDashSlots(false);
        }, () => {
          const isToday = dashRescheduleDate.toDateString() === new Date().toDateString();
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
          const parseToMin = (t) => {
            const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
            if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };
          setDashAvailableSlots(DEFAULT_SLOTS.map(t => {
            const slotMin = parseToMin(t);
            const isPast = isToday && slotMin <= nowMinutes;
            return { time: t, sessionsLeft: 3, isPast, isFull: false, isBlocked: isPast, isAvailable: !isPast };
          }));
          setFetchingDashSlots(false);
        });

      } catch (err) {
        setFetchingDashSlots(false);
      }
    };
    fetchSlots();
    return () => { if (unsubExtra) unsubExtra(); };
  }, [dashRescheduleDoctor, dashRescheduleBranch, dashRescheduleDate]);

  const handleAddDashExtraSlot = async (type) => {
    if (!dashRescheduleDate) return;
    const year = dashRescheduleDate.getFullYear();
    const month = String(dashRescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(dashRescheduleDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    let newSlot = '10:00 AM';
    if (dashAvailableSlots.length > 0) {
      const item = type === 'before' ? dashAvailableSlots[0] : dashAvailableSlots[dashAvailableSlots.length - 1];
      const timeStr = typeof item === 'string' ? item : item.time;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        let tot = type === 'before' ? (h * 60 + m - 15) : (h * 60 + m + 15);
        if (tot < 0) tot += 1440;
        let nH = Math.floor(tot / 60) % 24;
        let nM = tot % 60;
        let nAmpm = nH >= 12 ? 'PM' : 'AM';
        let dH = nH > 12 ? nH - 12 : (nH === 0 ? 12 : nH);
        newSlot = `${dH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')} ${nAmpm}`;
      }
    }

    try {
      const qExtra = query(collection(db, 'extra_slots'), where('dateString', '==', dateString));
      const snap = await getDocs(qExtra);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { slots: [...new Set([...(snap.docs[0].data().slots || []), newSlot])] });
      } else {
        await addDoc(collection(db, 'extra_slots'), { dateString, slots: [newSlot] });
      }
    } catch (e) { console.error(e); }
  };

  const handleWhatsAppDash = (phone, name) => {
    if (!phone || phone === 'N/A') {
      Alert.alert('Error', 'No phone number available for this patient.');
      return;
    }
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const message = `Hello ${name}, this is from SPH Clinic regarding your appointment.`;
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Make sure WhatsApp is installed on your device.');
    });
  };

  const openRescheduleDash = (patient) => {
    setDashRescheduleItem(patient);
    setDashRescheduleBranch(patient.branchName || patient.branchId || DASH_CANONICAL_BRANCHES[0]);
    setDashRescheduleDoctor(patient.doctor || DASH_CANONICAL_DOCTORS[0]);
    let defaultDate = new Date();
    if (patient.appointmentDate) {
      const parts = String(patient.appointmentDate).split('/');
      if (parts.length === 3) {
        defaultDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else {
        const dParts = String(patient.appointmentDate).split('-');
        if (dParts.length === 3 && dParts[0].length === 4) {
          defaultDate = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[2], 10));
        }
      }
    }
    setDashRescheduleDate(defaultDate);
    if (patient.timeSlot || patient.appointmentTime) {
      const tStr = patient.timeSlot || patient.appointmentTime;
      const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hrs = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hrs < 12) hrs += 12;
        if (ampm === 'AM' && hrs === 12) hrs = 0;
        const dt = new Date();
        dt.setHours(hrs, mins, 0, 0);
        setDashRescheduleTime(dt);
      }
    }
    setDashRescheduleModalVisible(true);
  };

  const handleRescheduleSubmitDash = async () => {
    if (!dashRescheduleItem) return;
    try {
      const day = String(dashRescheduleDate.getDate()).padStart(2, '0');
      const month = String(dashRescheduleDate.getMonth() + 1).padStart(2, '0');
      const year = dashRescheduleDate.getFullYear();
      const dateSlash = `${day}/${month}/${year}`;
      const dateDash = `${year}-${month}-${day}`;
      const timeSlotStr = formatDashTimeStr(dashRescheduleTime);

      const collName = dashRescheduleItem.firestoreCollection || (dashRescheduleItem._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collName, dashRescheduleItem.id);
      const updateData = {
        branchId: dashRescheduleBranch,
        branchName: dashRescheduleBranch,
        doctor: dashRescheduleDoctor,
        timeSlot: timeSlotStr,
        appointmentTime: timeSlotStr,
        isRescheduled: true,
        lastRescheduledAt: serverTimestamp()
      };
      if (dashRescheduleItem._type === 'online') {
        updateData.dateString = dateDash;
        updateData.doctorName = dashRescheduleDoctor.replace(/^Dr\.\s*/i, '');
      } else {
        updateData.appointmentDate = dateSlash;
      }
      await updateDoc(docRef, updateData);

      // Also update allpatients doc if exists
      try {
        const apRef = doc(db, 'allpatients', dashRescheduleItem.id);
        await updateDoc(apRef, {
          appointmentDate: dateSlash,
          dateString: dateDash,
          timeSlot: timeSlotStr,
          appointmentTime: timeSlotStr,
          doctor: dashRescheduleDoctor,
          branchName: dashRescheduleBranch,
          isRescheduled: true,
          updatedAt: serverTimestamp()
        });
      } catch (e) { }

      setDashRescheduleModalVisible(false);
      Alert.alert('Success', 'Appointment rescheduled successfully!');
    } catch (error) {
      console.error('Reschedule error:', error);
      Alert.alert('Error', 'Failed to reschedule appointment.');
    }
  };

  const fetchCancelledAppointments = async () => {
    setRestoreLoading(true);
    try {
      const qCancelAll = query(
        collection(db, 'allpatients'),
        where('status', '==', 'cancelled')
      );

      const qCancelAppts = query(
        collection(db, 'appointments'),
        where('status', '==', 'cancelled')
      );

      const qDelete = query(
        collection(db, 'allpatients'),
        where('isDeleted', '==', true)
      );

      const [snapCancelAll, snapCancelAppts, snapDelete] = await Promise.all([
        getDocs(qCancelAll),
        getDocs(qCancelAppts),
        getDocs(qDelete)
      ]);

      const uniqueMap = new Map();

      snapCancelAll.forEach(docSnap => {
        const data = docSnap.data();
        const updatedAtDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null);
        if (updatedAtDate) {
          const hoursDiff = (Date.now() - updatedAtDate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff <= 24) {
            uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, updatedAtDate, restoreType: 'cancel', firestoreCollection: 'allpatients' });
          }
        } else {
          uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, restoreType: 'cancel', firestoreCollection: 'allpatients' });
        }
      });

      snapCancelAppts.forEach(docSnap => {
        const data = docSnap.data();
        const updatedAtDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null);
        if (updatedAtDate) {
          const hoursDiff = (Date.now() - updatedAtDate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff <= 24) {
            if (!uniqueMap.has(docSnap.id)) {
              uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, updatedAtDate, restoreType: 'cancel', firestoreCollection: 'appointments' });
            }
          }
        } else if (!uniqueMap.has(docSnap.id)) {
          uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, restoreType: 'cancel', firestoreCollection: 'appointments' });
        }
      });

      snapDelete.forEach(docSnap => {
        const data = docSnap.data();
        const deletedAtDate = data.deletedAt?.toDate ? data.deletedAt.toDate() : (data.deletedAt ? new Date(data.deletedAt) : null);
        if (deletedAtDate) {
          const hoursDiff = (Date.now() - deletedAtDate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff <= 24) {
            uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, updatedAtDate: deletedAtDate, restoreType: 'delete', firestoreCollection: 'allpatients' });
          }
        } else {
          uniqueMap.set(docSnap.id, { id: docSnap.id, ...data, restoreType: 'delete', firestoreCollection: 'allpatients' });
        }
      });

      const list = Array.from(uniqueMap.values());
      list.sort((a, b) => (b.updatedAtDate || 0) - (a.updatedAtDate || 0));
      setCancelledAppointments(list);
    } catch (error) {
      console.error("Error fetching cancelled/deleted appointments:", error);
      Alert.alert("Error", "Failed to load cancelled/deleted appointments.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleOpenRestoreModal = () => {
    setRestoreModalVisible(true);
    fetchCancelledAppointments();
  };

  const handleRestoreAppointment = async (appt) => {
    if (!appt || !appt.id) return;
    setRestoringApptId(appt.id);
    try {
      const collName = appt.firestoreCollection || 'allpatients';

      const updatePayload = {
        status: 'waiting',
        updatedAt: serverTimestamp()
      };

      if (appt.restoreType === 'delete' || appt.isDeleted) {
        updatePayload.isDeleted = false;
        updatePayload.deletedAt = null;
      }

      await updateDoc(doc(db, collName, appt.id), updatePayload);

      if (collName === 'appointments') {
        try {
          await updateDoc(doc(db, 'allpatients', appt.id), updatePayload);
        } catch (e) {
          console.warn("Could not restore in allpatients:", e);
        }
      } else {
        try {
          await updateDoc(doc(db, 'appointments', appt.id), updatePayload);
        } catch (e) { }
      }

      if (appt.patientId && appt.patientId !== 'WALKIN_USER') {
        try {
          const patientUpdate = { status: 'waiting' };
          if (appt.restoreType === 'delete' || appt.isDeleted) {
            patientUpdate.isDeleted = false;
            patientUpdate.deletedAt = null;
          }
          await updateDoc(doc(db, 'patients', appt.patientId), patientUpdate);
        } catch (e) { }
      }

      Alert.alert("Success", "Appointment restored successfully!");
      fetchCancelledAppointments();
    } catch (err) {
      console.error("Error restoring appointment:", err);
      Alert.alert("Error", "Failed to restore appointment.");
    } finally {
      setRestoringApptId(null);
    }
  };




  if (authLoading || (!effectiveUserData && auth.currentUser && !profileCheckDone)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.muted }}>Loading Profile...</Text>
      </View>
    );
  }

  if (!effectiveUserData && auth.currentUser && profileCheckDone) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 24 }}>
        <AlertCircle size={48} color={COLORS.danger} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
          Profile Not Found
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Your authenticated account is not registered as active staff. Please contact the clinic administrator to set up your staff profile.
        </Text>
        <Button
          mode="contained"
          buttonColor={COLORS.secondary}
          textColor="#fff"
          onPress={() => auth.signOut()}
          style={{ borderRadius: 10, width: '80%' }}
        >
          Logout / Sign In Again
        </Button>
      </View>
    );
  }

  const isMatchingDate = (dateStr, targetDate) => {
    if (!dateStr) return false;
    const tDay = targetDate.getDate();
    const tMonth = targetDate.getMonth();
    const tYear = targetDate.getFullYear();

    if (dateStr && typeof dateStr.toDate === 'function') {
      try {
        const d = dateStr.toDate();
        return d.getDate() === tDay && d.getMonth() === tMonth && d.getFullYear() === tYear;
      } catch (e) { }
    }

    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return y === tYear && m === tMonth && d === tDay;
        } else if (parts[2].length === 4) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          return y === tYear && m === tMonth && d === tDay;
        } else {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          return y === tYear && m === tMonth && d === tDay;
        }
      }
    }

    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return y === tYear && m === tMonth && d === tDay;
        } else {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          return y === tYear && m === tMonth && d === tDay;
        }
      }
    }

    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.getDate() === tDay && parsed.getMonth() === tMonth && parsed.getFullYear() === tYear;
      }
    } catch (e) { }

    return false;
  };

  const todayPatientsFiltered = todayPatients.filter(p => {
    const isToday = isMatchingDate(p.appointmentDate, dashboardDate);
    return isToday;
  });

  const upcomingToDisplay = allUpcomingAppointments.filter(p => {
    if (dashSelectedBranch !== 'All Branches') {
      const bName = normalizeBranchName(p.branchName || p.branchId);
      if (bName !== dashSelectedBranch) return false;
    }
    return isMatchingDate(p.appointmentDate || p.dateString, dashboardDate);
  });

  // DOCTOR SPECIFIC COUNTS
  const doctorPatients = todayPatientsFiltered.filter(p => {
    if (!p.doctor) return false;
    const docNorm = normalizeDoctorName(userData?.name || '');
    const patDocNorm = normalizeDoctorName(p.doctor);
    return patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm));
  });

  const docBranchFiltered = doctorPatients.filter(p => dashSelectedBranch === 'All Branches' || normalizeBranchName(p.branchName || p.branchId) === dashSelectedBranch);

  const docActiveCount = docBranchFiltered.filter(p => {
    const isCompleted = p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done';
    const isOnlineUnpaid = p.status === 'booked' && p.paymentStatus !== 'paid';
    return !isCompleted && !isOnlineUnpaid;
  }).length;

  const docCompletedCount = docBranchFiltered.filter(p => p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done').length;
  const docTotalCount = docBranchFiltered.length;

  const waitingCount = todayPatientsFiltered.filter(p => ['waiting', 'booked', 'confirmed', 'pending'].includes(p.status)).length;
  const inConsultationCount = todayPatientsFiltered.filter(p => p.status === 'in-consultation').length;
  const completedPaidCount = todayPatientsFiltered.filter(p => (p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed') && p.paymentStatus === 'paid').length;
  const completedUnpaidCount = todayPatientsFiltered.filter(p => (p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed') && p.paymentStatus !== 'paid').length;
  const doneCount = todayPatientsFiltered.filter(p => p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed').length;
  const followUpOptedCount = todayPatientsFiltered.filter(p => (p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed') && p.followUpInterval && p.followUpInterval !== 'No Follow-up' && p.followUpInterval !== '').length;
  const followUpNotOptedCount = doneCount - followUpOptedCount;

  // Identify next/upcoming patient (the oldest waiting patient)
  const nextPatient = todayPatientsFiltered
    .filter(p => p.status === 'waiting')
    .reverse()[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerProfile}>
          {(userData?.role === 'hr' || userData?.role === 'staff' || userData?.role === 'receptionist') && (
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6}
              style={{ padding: 10, marginRight: 4, marginLeft: -6 }}
            >
              <Menu size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
          <View style={styles.avatarWrapper}>
            <User size={22} color={COLORS.secondary} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{(userData?.name ? userData.name.replace(/KPHP/gi, 'KPHB') : 'Staff Member')}</Text>
            <Text style={{ fontSize: 12, color: COLORS.muted, fontWeight: '500', marginTop: 1 }}>{userData?.phone || 'No Mobile'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={styles.staffBadge}>
                <Text style={styles.staffBadgeText}>{userData?.role?.toUpperCase() || 'STAFF'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                <MapPin size={10} color={COLORS.muted} />
                <Text style={styles.branchText} numberOfLines={1}>{getCanonicalBranchName(userData?.branchName || userData?.branchId) || 'Main Branch'}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
            <Bell size={18} color={COLORS.text} />
            {unreadNotifications > 0 && <View style={styles.notificationBtnBadge} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.notificationBtn} onPress={handleLogout}>
            <LogOut size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Side Drawer Modal */}
      {drawerVisible && (userData?.role === 'hr' || userData?.role === 'staff' || userData?.role === 'receptionist') && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: SCREEN_W, height: SCREEN_H, zIndex: 9999, elevation: 9999, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <TouchableOpacity style={{ flex: 1, width: '100%', height: '100%' }} activeOpacity={1} onPress={() => setDrawerVisible(false)}>
            <View style={styles.drawerContent} onStartShouldSetResponder={() => true}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setDrawerVisible(false)}>
                  <CheckCircle2 size={24} color={COLORS.muted} style={{ opacity: 0 }} />
                </TouchableOpacity>
              </View>

              {userData?.role === 'doctor' && userData?.doctorType === 'head' && (
                <>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('RevenueDashboard'); }}>
                    <IndianRupee size={20} color={COLORS.primary} />
                    <Text style={styles.drawerItemText}>Total Revenue</Text>
                  </TouchableOpacity>
                </>
              )}

              {userData?.role === 'staff' && (
                <>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('LeaveRequest'); }}>
                    <FileText size={20} color={COLORS.secondary} />
                    <Text style={styles.drawerItemText}>Apply Leave</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('MyAttendance'); }}>
                    <Calendar size={20} color={COLORS.primary} />
                    <Text style={styles.drawerItemText}>My Attendance</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('MyDeductions'); }}>
                    <IndianRupee size={20} color="#f59e0b" />
                    <Text style={styles.drawerItemText}>My Deductions</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('EmployeeDailyReport'); }}>
                    <FileText size={20} color="#10b981" />
                    <Text style={styles.drawerItemText}>Daily Reports</Text>
                  </TouchableOpacity>
                </>
              )}

              {userData?.role === 'receptionist' && (
                <>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('ShippingForm'); }}>
                    <Package size={20} color={COLORS.primary} />
                    <Text style={styles.drawerItemText}>Ship Rocket</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('FollowUps'); }}>
                    <CalendarClock size={20} color={COLORS.secondary} />
                    <Text style={styles.drawerItemText}>Followups</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('MedicineRequestList'); }}>
                    <Pill size={20} color={COLORS.primary} />
                    <Text style={styles.drawerItemText}>Medicine Requests</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('RewardPointClaim'); }}>
                    <Coins size={20} color="#f59e0b" />
                    <Text style={styles.drawerItemText}>Products Billing</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('DoctorNoShow'); }}>
                    <CalendarClock size={20} color="#ef4444" />
                    <Text style={styles.drawerItemText}>Doctor No Show</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('MediaManager'); }}>
                    <Video size={20} color="#8b5cf6" />
                    <Text style={styles.drawerItemText}>Media Manager</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('ClinicCleaningPhotos'); }}>
                    <ImageIcon size={20} color="#f97316" />
                    <Text style={styles.drawerItemText}>Cleaning Photos</Text>
                  </TouchableOpacity>
                </>
              )}

              {userData?.role === 'hr' && (
                <>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('TargetManagement'); }}>
                    <Target size={20} color="#8b5cf6" />
                    <Text style={styles.drawerItemText}>Set Target</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('AddStaff'); }}>
                    <UserPlus size={20} color="#ec4899" />
                    <Text style={styles.drawerItemText}>Add Staff</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('EmployeeDailyReport'); }}>
                    <FileText size={20} color="#10b981" />
                    <Text style={styles.drawerItemText}>Employee Reports</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerVisible(false); navigation.navigate('ClinicCleaningPhotos'); }}>
                    <ImageIcon size={20} color="#f97316" />
                    <Text style={styles.drawerItemText}>Cleaning Photos</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Stat Detail Full Screen */}
      <Modal visible={statModalVisible} transparent={false} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 }}>
            <TouchableOpacity onPress={() => setStatModalVisible(false)} style={{ padding: 4 }}>
              <ChevronLeft size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginLeft: 12 }}>{statModalTitle}</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {statModalData.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 16 }}>No patients found.</Text>
              </View>
            ) : (
              statModalData.map((patient, index) => (
                <TouchableOpacity
                  key={patient.id || index}
                  style={{ padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 }}
                  onPress={() => {
                    setStatModalVisible(false);
                    navigation.navigate('PatientDetails', { patientId: patient.id });
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Avatar.Text
                      size={36}
                      label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (patient.patientName ? patient.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P')}
                      style={{ backgroundColor: '#a8ce3a' + '20', marginRight: 12 }}
                      labelStyle={{ color: '#a8ce3a', fontWeight: '800', fontSize: 14 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>{patient.fullName || patient.patientName || 'Patient'}</Text>
                      <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{(patient.status || 'Unknown').toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 6 }}>
                      <Phone size={14} color="#64748b" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: '#475569' }}>{patient.phone || 'N/A'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 6 }}>
                      <Stethoscope size={14} color="#64748b" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: '#475569' }} numberOfLines={1}>{patient.doctor || patient.doctorName || 'N/A'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Receptionist: Reschedule Modal */}
      <Modal visible={dashRescheduleModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, maxHeight: '85%', display: 'flex', flexDirection: 'column' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Reschedule Appointment</Text>
              <TouchableOpacity onPress={() => setDashRescheduleModalVisible(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {dashRescheduleItem && (
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                Patient: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{dashRescheduleItem.fullName || dashRescheduleItem.patientName}</Text>
              </Text>
            )}

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} nestedScrollEnabled={true} style={{ flexGrow: 0, maxHeight: 450 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Doctor Dropdown Picker */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>Select Doctor</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#f8fafc', marginBottom: 14 }}
                onPress={() => setShowDashDoctorPickerModal(true)}
              >
                <User size={16} color="#258ec8" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600', flex: 1 }}>
                  {dashRescheduleDoctor || 'Select Doctor'}
                </Text>
                <ChevronDown size={16} color="#64748b" />
              </TouchableOpacity>

              {/* Branch Dropdown Picker */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>Select Branch</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#f8fafc', marginBottom: 14 }}
                onPress={() => setShowDashBranchPickerModal(true)}
              >
                <MapPin size={16} color="#258ec8" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600', flex: 1 }}>
                  {dashRescheduleBranch || 'Select Branch'}
                </Text>
                <ChevronDown size={16} color="#64748b" />
              </TouchableOpacity>

              {/* New Date */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>Select New Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+14 Days', days: 14 }
                  ].map(item => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + item.days);
                    const isSelected = dashRescheduleDate.toDateString() === targetDate.toDateString();
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
                          borderColor: isSelected ? '#258ec8' : '#e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#fff'
                        }}
                        onPress={() => setDashRescheduleDate(targetDate)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#258ec8' : '#64748b' }}>
                          {item.label} ({targetDate.getDate()}/{targetDate.getMonth() + 1})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc', marginBottom: 14 }}
                onPress={() => setShowDashRescheduleDatePicker(true)}
              >
                <CalendarClock size={16} color="#258ec8" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>
                  Custom Date: {`${String(dashRescheduleDate.getDate()).padStart(2, '0')}/${String(dashRescheduleDate.getMonth() + 1).padStart(2, '0')}/${dashRescheduleDate.getFullYear()}`}
                </Text>
              </TouchableOpacity>
              {showDashRescheduleDatePicker && (
                <DateTimePicker
                  value={dashRescheduleDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onValueChange={(event, selectedDate) => {
                    setShowDashRescheduleDatePicker(false);
                    if (selectedDate) setDashRescheduleDate(selectedDate);
                  }}
                  onDismiss={() => setShowDashRescheduleDatePicker(false)}
                />
              )}

              {/* Time Slots */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>Select Time Slot</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => handleAddDashExtraSlot('before')}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#258ec8' }}>+ Before</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAddDashExtraSlot('after')}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#258ec8' }}>+ After</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {fetchingDashSlots ? (
                <ActivityIndicator size="small" color="#258ec8" style={{ marginVertical: 10 }} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {dashAvailableSlots.map(slotObj => {
                    const timeStr = typeof slotObj === 'string' ? slotObj : slotObj.time;
                    const isSelected = formatDashTimeStr(dashRescheduleTime) === timeStr;
                    const sessionsLeft = typeof slotObj === 'object' ? slotObj.sessionsLeft : 3;
                    const isPast = typeof slotObj === 'object' ? slotObj.isPast : false;
                    const isFull = typeof slotObj === 'object' ? slotObj.isFull : false;
                    const isBlocked = isPast || isFull;

                    let labelText = `${sessionsLeft} left`;
                    let labelColor = isSelected ? '#258ec8' : '#10b981';
                    if (isPast) {
                      labelText = 'Passed';
                      labelColor = '#94a3b8';
                    } else if (isFull) {
                      labelText = 'Booked';
                      labelColor = '#ef4444';
                    }

                    return (
                      <TouchableOpacity
                        key={timeStr}
                        disabled={isBlocked}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
                          borderColor: isBlocked ? '#cbd5e1' : (isSelected ? '#258ec8' : '#e2e8f0'),
                          backgroundColor: isBlocked ? '#f1f5f9' : (isSelected ? '#eff6ff' : '#fff'),
                          opacity: isBlocked ? 0.6 : 1,
                          alignItems: 'center'
                        }}
                        onPress={() => {
                          if (isBlocked) return;
                          const [tStr, period] = timeStr.split(' ');
                          let [h, m] = tStr.split(':').map(Number);
                          if (period === 'PM' && h < 12) h += 12;
                          if (period === 'AM' && h === 12) h = 0;
                          const newT = new Date(dashRescheduleTime);
                          newT.setHours(h, m, 0, 0);
                          setDashRescheduleTime(newT);
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isBlocked ? '#94a3b8' : (isSelected ? '#258ec8' : '#0f172a'), textDecorationLine: isPast ? 'line-through' : 'none' }}>{timeStr}</Text>
                        <Text style={{ fontSize: 9, color: labelColor, fontWeight: '700', marginTop: 1 }}>
                          {labelText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc', marginBottom: 16 }}
                onPress={() => setShowDashRescheduleTimePicker(true)}
              >
                <Clock size={16} color="#258ec8" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>Custom Time: {formatDashTimeStr(dashRescheduleTime)}</Text>
              </TouchableOpacity>
              {showDashRescheduleTimePicker && (
                <DateTimePicker
                  value={dashRescheduleTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  onValueChange={(event, time) => {
                    setShowDashRescheduleTimePicker(false);
                    if (time) setDashRescheduleTime(time);
                  }}
                  onDismiss={() => setShowDashRescheduleTimePicker(false)}
                />
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={() => setDashRescheduleModalVisible(false)}
              >
                <Text style={{ fontWeight: '700', color: '#64748b' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#258ec8', borderRadius: 10, padding: 14, alignItems: 'center' }}
                onPress={handleRescheduleSubmitDash}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>Confirm Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Doctor Dropdown Picker Modal */}
      <Modal visible={showDashDoctorPickerModal} transparent animationType="fade" onRequestClose={() => setShowDashDoctorPickerModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowDashDoctorPickerModal(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Select Doctor</Text>
              <TouchableOpacity onPress={() => setShowDashDoctorPickerModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {DASH_CANONICAL_DOCTORS.map(docName => {
                const isSelected = dashRescheduleDoctor === docName;
                return (
                  <TouchableOpacity
                    key={docName}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff'
                    }}
                    onPress={() => {
                      setDashRescheduleDoctor(docName);
                      setShowDashDoctorPickerModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <User size={18} color={isSelected ? '#258ec8' : '#64748b'} style={{ marginRight: 12 }} />
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#258ec8' : '#0f172a' }}>{docName}</Text>
                    </View>
                    {isSelected && <Check size={18} color="#258ec8" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Branch Dropdown Picker Modal */}
      <Modal visible={showDashBranchPickerModal} transparent animationType="fade" onRequestClose={() => setShowDashBranchPickerModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowDashBranchPickerModal(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '50%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowDashBranchPickerModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {DASH_CANONICAL_BRANCHES.map(brName => {
                const isSelected = dashRescheduleBranch === brName;
                return (
                  <TouchableOpacity
                    key={brName}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff'
                    }}
                    onPress={() => {
                      setDashRescheduleBranch(brName);
                      setShowDashBranchPickerModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin size={18} color={isSelected ? '#258ec8' : '#64748b'} style={{ marginRight: 12 }} />
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#258ec8' : '#0f172a' }}>{brName}</Text>
                    </View>
                    {isSelected && <Check size={18} color="#258ec8" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Receptionist: Restore (24h) Modal */}
      <Modal visible={restoreModalVisible} transparent animationType="slide" onRequestClose={() => setRestoreModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Restore Cancelled Appointments (24h)</Text>
              <TouchableOpacity onPress={() => setRestoreModalVisible(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {restoreLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
            ) : cancelledAppointments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center' }}>No appointments cancelled in the last 24 hours.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {cancelledAppointments.map(appt => (
                  <View key={appt.id} style={{ padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 }}>{appt.fullName || appt.patientName || 'N/A'}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 1 }}>Phone: {appt.phone || 'N/A'}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 1 }}>Doctor: {appt.doctor || appt.doctorName || 'N/A'}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 1 }}>Date: {appt.appointmentDate || appt.dateString || 'N/A'} ({appt.timeSlot || appt.appointmentTime || 'N/A'})</Text>
                      {appt.updatedAtDate && (
                        <Text style={{ fontSize: 10, color: '#ef4444', fontStyle: 'italic', marginTop: 4 }}>
                          Cancelled at: {appt.updatedAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}
                      onPress={() => handleRestoreAppointment(appt)}
                      disabled={restoringApptId === appt.id}
                    >
                      {restoringApptId === appt.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Restore</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>


      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.secondary]}
            tintColor={COLORS.secondary}
          />
        }
      >





        {/* RECEPTIONIST MAIN VIEW */}
        {userData?.role === 'receptionist' && !isEmailLogin ? (
          <View>
            {/* Global Appointments Summary */}

            {/* Global Date Filter */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Overview</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, flexShrink: 1, maxWidth: 140 }}
                onPress={() => setShowDashboardDatePicker(true)}
              >
                <CalendarClock size={16} color={COLORS.primary} style={{ marginRight: 6, flexShrink: 0 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }} numberOfLines={1}>
                  {dashboardDate.getDate() === new Date().getDate() && dashboardDate.getMonth() === new Date().getMonth() && dashboardDate.getFullYear() === new Date().getFullYear()
                    ? 'Today'
                    : dashboardDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Monthly Target Display */}
            {monthlyTarget ? (() => {
              const targetNum = Number(monthlyTarget) || 0;
              const reachedNum = Number(targetReached) || 0;
              const remaining = Math.max(targetNum - reachedNum, 0);
              const isReached = reachedNum >= targetNum;

              const today = new Date();
              const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
              const isLastWeek = nextWeek.getMonth() !== today.getMonth();
              const isWarning = isLastWeek && !isReached;

              const containerBg = isReached ? '#f0fdf4' : isWarning ? '#fef2f2' : '#f8fafc';
              const containerBorder = isReached ? '#4ade80' : isWarning ? '#fca5a5' : '#cbd5e1';
              const iconColor = isReached ? '#16a34a' : isWarning ? '#dc2626' : '#64748b';
              const titleColor = isReached ? '#166534' : isWarning ? '#991b1b' : '#334155';
              const labelColor = isReached ? '#15803d' : isWarning ? '#b91c1c' : '#475569';
              const valueColor = isReached ? '#14532d' : isWarning ? '#7f1d1d' : '#0f172a';

              return (
                <View style={{ backgroundColor: containerBg, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: containerBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Target size={20} color={iconColor} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: titleColor }}>Monthly Target</Text>
                    </View>
                    {isReached && (
                      <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803d' }}>🏆 Target Reached!</Text>
                      </View>
                    )}
                    {isWarning && (
                      <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#991b1b' }}>⚠️ Last week!</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff99', padding: 12, borderRadius: 8 }}>
                    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor, textTransform: 'uppercase', marginBottom: 4 }} numberOfLines={1}>Target</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>₹{targetNum.toLocaleString()}</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: containerBorder }} />
                    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor, textTransform: 'uppercase', marginBottom: 4 }} numberOfLines={1}>Reached</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>₹{reachedNum.toLocaleString()}</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: containerBorder }} />
                    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: labelColor, textTransform: 'uppercase', marginBottom: 4 }} numberOfLines={1}>Remaining</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: isWarning ? '#dc2626' : valueColor }} numberOfLines={1} adjustsFontSizeToFit>₹{remaining.toLocaleString()}</Text>
                    </View>
                  </View>


                </View>
              );
            })() : null}

            {showDashboardDatePicker && (
              <DateTimePicker
                value={dashboardDate}
                mode="date"
                display="default"
                onValueChange={(event, selectedDate) => {
                  setShowDashboardDatePicker(false);
                  if (selectedDate) {
                    setDashboardDate(selectedDate);
                  }
                }}
                onDismiss={() => setShowDashboardDatePicker(false)}
              />
            )}

            {(() => {
              const isDashItemPaid = (p) => {
                if (!p) return false;
                const ps = (p.paymentStatus || p.raw?.paymentStatus || '').toLowerCase();
                const pAmt = Number(p.paymentAmount || p.amountPaid || p.amount || p.raw?.paymentAmount || p.raw?.amountPaid || p.raw?.amount || 0);
                const hasCollectedAt = !!(p.paymentCollectedAt || p.raw?.paymentCollectedAt);
                const hasSplitDetails = !!(p.paymentSplitDetails || p.raw?.paymentSplitDetails || p.splitCounterAmount || p.raw?.splitCounterAmount);
                const hasItemsPaid = !!(p.itemsPaid || p.raw?.itemsPaid);
                return ps === 'paid' || pAmt > 0 || hasCollectedAt || hasSplitDetails || (hasItemsPaid && (p.itemsPaid?.consultation > 0 || p.itemsPaid?.medicine > 0 || p.itemsPaid?.dietPlan > 0));
              };

              const waitingCount = todayPatientsFiltered.filter(p => ['booked', 'waiting', 'confirmed', 'pending'].includes((p.status || '').toLowerCase()) && !isDashItemPaid(p)).length;
              const completedUnpaidCount = todayPatientsFiltered.filter(p => (p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed') && !isDashItemPaid(p)).length;
              const completedPaidCount = todayPatientsFiltered.filter(p => p.status === 'done' || ((p.status === 'completed' || p.doctorStatus === 'prescribed') && isDashItemPaid(p)) || isDashItemPaid(p)).length;
              const doneCount = completedPaidCount;

              const doneItems = todayPatientsFiltered.filter(p => p.status === 'done' || ((p.status === 'completed' || p.doctorStatus === 'prescribed') && isDashItemPaid(p)) || isDashItemPaid(p));
              const followUpOptedCount = doneItems.filter(p => p.followUpInterval && p.followUpInterval !== 'No Follow-up' && p.followUpInterval !== '').length;
              const followUpNotOptedCount = doneItems.filter(p => !p.followUpInterval || p.followUpInterval === 'No Follow-up' || p.followUpInterval === '').length;

              return (
                <View>
                  {userData?.role !== 'staff' && (
                    <View style={[styles.receptionStatsRow, { marginBottom: 20, flexWrap: 'wrap', gap: 6 }]}>
                      <TouchableOpacity style={{ flex: 1, minWidth: '18%' }} onPress={() => handleStatClick('Total Bookings', p => true)}>
                        <Surface style={[styles.receptionStatCard, { flex: undefined, width: '100%', borderLeftColor: COLORS.secondary, borderLeftWidth: 3 }]}>
                          <Text style={styles.receptionStatVal}>{todayPatientsFiltered.length}</Text>
                          <Text style={styles.receptionStatLabel} numberOfLines={1}>Total Bookings</Text>
                        </Surface>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, minWidth: '18%' }} onPress={() => handleStatClick('Waiting', p => ['booked', 'waiting', 'confirmed', 'pending'].includes((p.status || '').toLowerCase()) && !isDashItemPaid(p))}>
                        <Surface style={[styles.receptionStatCard, { flex: undefined, width: '100%', borderLeftColor: '#f59e0b', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatVal, { color: '#f59e0b' }]}>{waitingCount}</Text>
                          <Text style={styles.receptionStatLabel} numberOfLines={1}>Waiting</Text>
                        </Surface>
                      </TouchableOpacity>

                      <TouchableOpacity style={{ flex: 1, minWidth: '18%' }} onPress={() => handleStatClick('Payment Pending', p => (p.status === 'completed' || p.status === 'done' || p.doctorStatus === 'prescribed') && !isDashItemPaid(p))}>
                        <Surface style={[styles.receptionStatCard, { flex: undefined, width: '100%', borderLeftColor: '#ef4444', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatVal, { color: '#ef4444' }]}>{completedUnpaidCount}</Text>
                          <Text style={styles.receptionStatLabel} numberOfLines={1}>Pay Pending</Text>
                        </Surface>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, minWidth: '18%' }} onPress={() => handleStatClick('Completed', p => p.status === 'done' || ((p.status === 'completed' || p.doctorStatus === 'prescribed') && isDashItemPaid(p)) || isDashItemPaid(p))}>
                        <Surface style={[styles.receptionStatCard, { flex: undefined, width: '100%', borderLeftColor: '#10b981', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatVal, { color: '#10b981' }]}>{completedPaidCount}</Text>
                          <Text style={styles.receptionStatLabel} numberOfLines={1}>Completed</Text>
                        </Surface>
                      </TouchableOpacity>
                    </View>
                  )}

                  {userData?.role !== 'staff' && (
                    <View style={[styles.receptionStatsRow, { marginBottom: 12 }]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => handleStatClick('Appointments Completed', p => p.status === 'done' || ((p.status === 'completed' || p.doctorStatus === 'prescribed') && isDashItemPaid(p)) || isDashItemPaid(p))}>
                        <Surface style={[styles.receptionStatCardSmall, { flex: undefined, width: '100%', borderLeftColor: '#6366f1', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatValSmall, { color: '#6366f1' }]}>{doneCount}</Text>
                          <Text style={styles.receptionStatLabelSmall} numberOfLines={2}>Appointments Completed</Text>
                        </Surface>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => handleStatClick('Follow-up Opted', p => isDashItemPaid(p) && p.followUpInterval && p.followUpInterval !== 'No Follow-up' && p.followUpInterval !== '')}>
                        <Surface style={[styles.receptionStatCardSmall, { flex: undefined, width: '100%', borderLeftColor: '#8b5cf6', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatValSmall, { color: '#8b5cf6' }]}>{followUpOptedCount}</Text>
                          <Text style={styles.receptionStatLabelSmall} numberOfLines={2}>Follow-up Opted</Text>
                        </Surface>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => handleStatClick('Follow-up Not Opted', p => {
                        const isDone = isDashItemPaid(p);
                        const isOpted = p.followUpInterval && p.followUpInterval !== 'No Follow-up' && p.followUpInterval !== '';
                        return isDone && !isOpted;
                      })}>
                        <Surface style={[styles.receptionStatCardSmall, { flex: undefined, width: '100%', borderLeftColor: '#ef4444', borderLeftWidth: 3 }]}>
                          <Text style={[styles.receptionStatValSmall, { color: '#ef4444' }]}>{followUpNotOptedCount}</Text>
                          <Text style={styles.receptionStatLabelSmall} numberOfLines={2}>Follow-up Not Opted</Text>
                        </Surface>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 1. UPCOMING APPOINTMENTS SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleMain}>Upcoming Appointments ({waitingCount})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={handleOpenRestoreModal}>
                  <Text style={[styles.viewAllText, { color: '#f97316' }]}>Restore (24h)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('UpcomingAppointments')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
            </View>
            {patientsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : upcomingToDisplay.length === 0 ? (
              <Surface style={styles.emptyQueueCardMini}>
                <Text style={styles.emptyQueueTextMini}>No upcoming waiting appointments.</Text>
                <Button
                  mode="contained"
                  buttonColor={COLORS.primary}
                  onPress={() => setActiveTab && setActiveTab('RegisterPatient')}
                  style={{ marginTop: 10, borderRadius: 8 }}
                  labelStyle={{ fontSize: 11, paddingVertical: 0 }}
                >
                  Book Appointment
                </Button>
              </Surface>
            ) : (
              upcomingToDisplay
                .map((patient, index) => {
                  const absoluteIndex = upcomingToDisplay.findIndex(p => p.id === patient.id);
                  const queueNumberText = absoluteIndex !== -1 ? `Q${absoluteIndex + 1}` : 'Q?';
                  return (
                    <Surface key={patient.id} style={styles.queueItemCard}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.queueHeader}
                        onPress={() => navigation.navigate('PatientDetails', { patientId: patient.id })}
                      >
                        <Avatar.Text
                          size={32}
                          label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                          style={{ backgroundColor: COLORS.secondary + '15' }}
                          labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: 10 }}
                        />
                        <View style={{
                          backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1,
                          borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8
                        }}>
                          <Text style={{ color: '#1e40af', fontSize: 10, fontWeight: '800' }}>{queueNumberText}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                            <Text style={styles.queueName}>{patient.fullName}</Text>
                            {(() => {
                              const source = patient.source || patient.raw?.source;
                              const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                              const normSource = (source || '').toLowerCase().trim();
                              const rawNormSource = (patient.raw?.source || '').toLowerCase().trim();
                              const isOld = !!followUp || normSource === 'old patient' || normSource === 'old_patient' || normSource === 'old' || rawNormSource === 'old patient' || rawNormSource === 'old_patient' || rawNormSource === 'old';
                              const isNew = !isOld && source && normSource !== 'old patient' && normSource !== 'old_patient' && normSource !== 'old';
                              const isApp = patient.isOnline || patient._type === 'online' || normSource === 'appointments' || normSource === 'online' || normSource === 'userapp' || normSource === 'patient app' || normSource === 'patientapp' || normSource === 'app' || rawNormSource === 'appointments' || rawNormSource === 'online' || rawNormSource === 'userapp' || rawNormSource === 'patient app' || rawNormSource === 'patientapp' || rawNormSource === 'app';
                              const isActive = followUp ? checkIsInDuration(followUp) : false;

                              return (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  {isNew && (
                                    <View style={{ backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#f43f5e', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>NEW</Text>
                                    </View>
                                  )}
                                  {isApp && (
                                    <View style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#7c3aed', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>APP</Text>
                                    </View>
                                  )}
                                  {isOld && (
                                    isActive ? (
                                      <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                        <Text style={{ color: '#d97706', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>IN DURATION</Text>
                                      </View>
                                    ) : (
                                      <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                        <Text style={{ color: '#0369a1', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>RE-BOOKING</Text>
                                      </View>
                                    )
                                  )}
                                </View>
                              );
                            })()}

                            {activePackageMobiles.has(patient.phone) && (
                              <View style={{
                                backgroundColor: '#ecfdf5',
                                borderColor: '#a7f3d0',
                                borderWidth: 1,
                                borderRadius: 6,
                                paddingHorizontal: 4,
                                paddingVertical: 1,
                                marginLeft: 4
                              }}>
                                <Text style={{
                                  color: '#047857',
                                  fontSize: 7,
                                  fontWeight: '800',
                                  letterSpacing: 0.3
                                }}>PKG</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.queueSubtext}>
                            {patient.doctor ? (patient.doctor.startsWith('Dr.') || patient.doctor.startsWith('Dr ') ? patient.doctor : `Dr. ${patient.doctor}`) : 'Unassigned'}
                          </Text>
                        </View>
                        <View style={styles.timeSlotBadge}>
                          <Clock size={10} color="#258ec8" style={{ marginRight: 3 }} />
                          <Text style={styles.timeSlotBadgeText}>{patient.appointmentTime || '09:30 AM'}</Text>
                        </View>
                        <View style={styles.queueArrow}>
                          <ChevronRight size={16} color={COLORS.muted} />
                        </View>
                      </TouchableOpacity>

                      {/* Action Footer – WhatsApp & Reschedule Icon Buttons */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }}>
                        <TouchableOpacity
                          style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8 }}
                          onPress={() => handleMoveQueueDash(patient, 'up')}
                        >
                          <ArrowUp size={16} color="#258ec8" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ padding: 6, backgroundColor: 'rgba(37, 142, 200, 0.1)', borderRadius: 8 }}
                          onPress={() => handleMoveQueueDash(patient, 'down')}
                        >
                          <ArrowDown size={16} color="#258ec8" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                          style={{
                            width: 34, height: 34, borderRadius: 17,
                            borderWidth: 1.5, borderColor: '#25d366',
                            backgroundColor: 'rgba(37,211,102,0.07)',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                          onPress={() => handleWhatsAppDash(patient.phone, patient.fullName)}
                        >
                          <WhatsAppIcon size={16} color="#25d366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            width: 34, height: 34, borderRadius: 17,
                            borderWidth: 1.5, borderColor: '#258ec8',
                            backgroundColor: 'rgba(37,142,200,0.07)',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                          onPress={() => openRescheduleDash(patient)}
                        >
                          <CalendarClock size={16} color="#258ec8" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            width: 34, height: 34, borderRadius: 17,
                            borderWidth: 1.5, borderColor: '#ef4444',
                            backgroundColor: 'rgba(239,68,68,0.07)',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                          onPress={() => handleDeleteAppointment(patient)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </Surface>
                  );
                })
            )}

            {/* 1.5. IN CONSULTATION SECTION */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitleMain}>Active Consultations ({inConsultationCount + completedUnpaidCount})</Text>
            </View>

            {patientsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : todayPatientsFiltered.filter(p => (p.status === 'in-consultation' || (p.status === 'completed' && !isDashItemPaid(p))) && !isDashItemPaid(p)).length === 0 ? (
              <Surface style={styles.emptyQueueCardMini}>
                <Text style={styles.emptyQueueTextMini}>No patients currently in consultation or awaiting payment.</Text>
              </Surface>
            ) : (
              todayPatientsFiltered
                .filter(p => (p.status === 'in-consultation' || (p.status === 'completed' && !isDashItemPaid(p))) && !isDashItemPaid(p))
                .map(patient => (
                  <Surface key={patient.id} style={styles.queueItemCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.queueHeader}
                      onPress={() => navigation.navigate('PatientDetails', { patientId: patient.id })}
                    >
                      <Avatar.Text
                        size={36}
                        label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                        style={{ backgroundColor: COLORS.secondary + '15' }}
                        labelStyle={{ color: COLORS.secondary, fontWeight: '800', fontSize: 12 }}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={styles.queueName}>{patient.fullName}</Text>
                          {(() => {
                            const source = patient.source || patient.raw?.source;
                            const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                            const normSource = (source || '').toLowerCase().trim();
                            const rawNormSource = (patient.raw?.source || '').toLowerCase().trim();
                            const isOld = !!followUp || normSource === 'old patient' || normSource === 'old_patient' || normSource === 'old' || rawNormSource === 'old patient' || rawNormSource === 'old_patient' || rawNormSource === 'old';
                            const isNew = !isOld && source && normSource !== 'old patient' && normSource !== 'old_patient' && normSource !== 'old';
                            const isApp = patient.isOnline || patient._type === 'online' || normSource === 'appointments' || normSource === 'online' || normSource === 'userapp' || normSource === 'patient app' || normSource === 'patientapp' || normSource === 'app' || rawNormSource === 'appointments' || rawNormSource === 'online' || rawNormSource === 'userapp' || rawNormSource === 'patient app' || rawNormSource === 'patientapp' || rawNormSource === 'app';
                            const isActive = followUp ? checkIsInDuration(followUp) : false;

                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {isNew && (
                                  <View style={{ backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                    <Text style={{ color: '#f43f5e', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>NEW</Text>
                                  </View>
                                )}
                                {isApp && (
                                  <View style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                    <Text style={{ color: '#7c3aed', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>APP</Text>
                                  </View>
                                )}
                                {isOld && (
                                  isActive ? (
                                    <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#d97706', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>🔁 IN DURATION</Text>
                                    </View>
                                  ) : (
                                    <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#0369a1', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>🔁 RE-BOOKING</Text>
                                    </View>
                                  )
                                )}
                              </View>
                            );
                          })()}

                          {activePackageMobiles.has(patient.phone) && (
                            <View style={{
                              backgroundColor: '#ecfdf5',
                              borderColor: '#a7f3d0',
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              marginLeft: 4
                            }}>
                              <Text style={{
                                color: '#047857',
                                fontSize: 7,
                                fontWeight: '800',
                                letterSpacing: 0.3
                              }}>PKG</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.queueSubtext}>With {formatFullDoctorName(patient.doctor)}</Text>
                      </View>
                      {!isDashItemPaid(patient) ? (
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, elevation: 1 }}
                          onPress={() => handleOpenPaymentModal(patient)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', marginLeft: 2 }}>Collect Fee</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.completedBadge, { backgroundColor: '#e0f2fe' }]}>
                          <Clock size={11} color="#0284c7" style={{ marginRight: 4 }} />
                          <Text style={[styles.completedBadgeText, { color: '#0284c7' }]}>IN PROGRESS</Text>
                        </View>
                      )}
                      <View style={styles.queueArrow}>
                        <ChevronRight size={18} color={COLORS.muted} />
                      </View>
                    </TouchableOpacity>

                    {/* Action Footer – WhatsApp & Reschedule Icon Buttons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }}>
                      <TouchableOpacity
                        style={{
                          width: 34, height: 34, borderRadius: 17,
                          borderWidth: 1.5, borderColor: '#25d366',
                          backgroundColor: 'rgba(37,211,102,0.07)',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                        onPress={() => handleWhatsAppDash(patient.phone, patient.fullName)}
                      >
                        <WhatsAppIcon size={16} color="#25d366" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          width: 34, height: 34, borderRadius: 17,
                          borderWidth: 1.5, borderColor: '#258ec8',
                          backgroundColor: 'rgba(37,142,200,0.07)',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                        onPress={() => openRescheduleDash(patient)}
                      >
                        <CalendarClock size={16} color="#258ec8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          width: 34, height: 34, borderRadius: 17,
                          borderWidth: 1.5, borderColor: '#ef4444',
                          backgroundColor: 'rgba(239,68,68,0.07)',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                        onPress={() => handleDeleteAppointment(patient)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </Surface>
                ))
            )}

            {/* 2. COMPLETED TODAY SECTION */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitleMain}>Completed Appointments Today ({completedPaidCount})</Text>
            </View>

            {patientsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : todayPatientsFiltered.filter(p => p.status === 'done' || ((p.status === 'completed' || p.doctorStatus === 'prescribed') && isDashItemPaid(p)) || isDashItemPaid(p)).length === 0 ? (
              <Surface style={styles.emptyQueueCardMini}>
                <Text style={styles.emptyQueueTextMini}>No completed appointments today yet.</Text>
              </Surface>
            ) : (
              todayPatientsFiltered
                .filter(p => p.status === 'done' || (p.status === 'completed' && p.paymentStatus === 'paid'))
                .map(patient => (
                  <Surface key={patient.id} style={styles.queueItemCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.queueHeader}
                      onPress={() => navigation.navigate('PatientDetails', { patientId: patient.id })}
                    >
                      <Avatar.Text
                        size={36}
                        label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                        style={{ backgroundColor: COLORS.success + '15' }}
                        labelStyle={{ color: COLORS.success, fontWeight: '800', fontSize: 12 }}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.queueName, { textDecorationLine: 'line-through', color: COLORS.muted }]}>{patient.fullName}</Text>
                        <Text style={styles.queueSubtext}>Completed with {formatFullDoctorName(patient.doctor)}</Text>
                      </View>
                      <View style={styles.completedBadge}>
                        <CheckCircle2 size={11} color="#10b981" style={{ marginRight: 4 }} />
                        <Text style={styles.completedBadgeText}>PAID</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                        <TouchableOpacity
                          style={{ padding: 6, backgroundColor: '#ecfdf5', borderRadius: 6, borderWidth: 1, borderColor: '#d1fae5' }}
                          onPress={() => handleShareReceiptWhatsApp(patient)}
                        >
                          <WhatsAppIcon size={14} color="#25d366" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ padding: 6, backgroundColor: '#eff6ff', borderRadius: 6, borderWidth: 1, borderColor: '#dbeafe' }}
                          onPress={() => handleShareReceiptPDF(patient)}
                        >
                          <FileText size={14} color="#258ec8" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.queueArrow}>
                        <ChevronRight size={18} color={COLORS.muted} />
                      </View>
                    </TouchableOpacity>
                  </Surface>
                ))
            )}

          </View>
        ) : userData?.role === 'doctor' ? (
          /* 🩺 HIGH-FIDELITY DOCTOR CLINICAL DASHBOARD VIEW */
          <View>
            {/* Main Attendance Card */}
            {userData?.doctorType === 'employee' && (
              <Surface style={styles.mainPunchCard}>
                <View style={styles.attendanceHeader}>
                  <Text style={styles.attendanceTitle}>Attendance Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color={COLORS.muted} />
                    <Text style={styles.currentDate}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  </View>
                </View>

                <View style={styles.punchDetailsRow}>
                  <View style={styles.statusLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: punchStatus === 'login' ? COLORS.success : punchStatus === 'completed' ? COLORS.secondary : COLORS.muted }
                      ]} />
                      <Text style={styles.punchStatusMain}>
                        {punchStatus === 'login' ? 'Punched IN' : punchStatus === 'completed' ? 'Attendance Completed' : 'Punched OUT'}
                      </Text>
                    </View>
                    <Text style={styles.sinceText}>
                      {punchStatus === 'completed'
                        ? `IN: ${todayPunchInTime ? todayPunchInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'} | OUT: ${todayPunchOutTime ? todayPunchOutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`
                        : punchStatus === 'login'
                          ? `IN at ${todayPunchInTime ? todayPunchInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`
                          : `OUT at ${todayPunchOutTime ? todayPunchOutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.statusRight}>
                    <Text style={styles.timeBig}>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.ampm}>{new Date().getHours() >= 12 ? 'PM' : 'AM'}</Text>
                  </View>
                </View>

                {punchStatus === 'logout' && (
                  <View style={{ marginVertical: 12, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
                    {capturedSelfieUri ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image source={{ uri: capturedSelfieUri }} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#cbd5e1' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Selfie Captured Successfully</Text>
                          <TouchableOpacity onPress={handleCaptureSelfie}>
                            <Text style={{ fontSize: 12, color: COLORS.secondary, fontWeight: '700', marginTop: 2 }}>Retake Selfie</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 150 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>📷 Capture Selfie Required</Text>
                          <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>A selfie is required before you can Punch In.</Text>
                        </View>
                        <TouchableOpacity
                          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          onPress={handleCaptureSelfie}
                        >
                          <Camera size={16} color="white" />
                          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Take Selfie</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.bigPunchBtn,
                    {
                      backgroundColor:
                        punchStatus === 'completed' ? '#cbd5e1' :
                          (punchStatus === 'logout' && !capturedSelfieUri) ? '#cbd5e1' :
                            punchStatus === 'login' ? COLORS.danger : COLORS.success
                    }
                  ]}
                  onPress={handlePunch}
                  disabled={punching || punchStatus === 'completed' || (punchStatus === 'logout' && !capturedSelfieUri)}
                >
                  {punching ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      {punchStatus === 'completed' ? (
                        <CheckCircle2 size={20} color="#64748b" style={{ marginRight: 8 }} />
                      ) : (
                        <LogOut size={20} color={(punchStatus === 'logout' && !capturedSelfieUri) ? '#64748b' : 'white'} style={{ marginRight: 8 }} />
                      )}
                      <Text style={[
                        styles.bigPunchBtnText,
                        (punchStatus === 'completed' || (punchStatus === 'logout' && !capturedSelfieUri)) && { color: '#64748b' }
                      ]}>
                        {punchStatus === 'completed' ? 'Completed for Today' :
                          (punchStatus === 'logout' && !capturedSelfieUri) ? 'Take Selfie First' :
                            punchStatus === 'login' ? 'Punch OUT' : 'Punch IN'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Surface>
            )}
            {/* Global Appointments Summary */}

            {/* Global Date Filter for Doctor */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.doctorWelcomeText}>Welcome, Dr. {userData?.name ? userData.name.replace(/^(?:dr\.?|doctor)\s+/i, '').replace(/KPHP/gi, 'KPHB') : 'Consultant'}</Text>
                <Text style={styles.doctorSubWelcome} numberOfLines={1}>{getCanonicalBranchName(userData?.branchName || userData?.branchId) || 'Hyderabad Clinic'} • Live Queue</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, flexShrink: 1, maxWidth: 140 }}
                onPress={() => setShowDashboardDatePicker(true)}
              >
                <CalendarClock size={14} color={COLORS.primary} style={{ marginRight: 4, flexShrink: 0 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text }} numberOfLines={1}>
                  {dashboardDate.getDate() === new Date().getDate() && dashboardDate.getMonth() === new Date().getMonth() && dashboardDate.getFullYear() === new Date().getFullYear()
                    ? 'Today'
                    : dashboardDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>
            </View>

            {showDashboardDatePicker && (
              <DateTimePicker
                value={dashboardDate}
                mode="date"
                display="default"
                onValueChange={(event, selectedDate) => {
                  setShowDashboardDatePicker(false);
                  if (selectedDate) {
                    setDashboardDate(selectedDate);
                  }
                }}
                onDismiss={() => setShowDashboardDatePicker(false)}
              />
            )}

            {/* Branch Filter Chips */}
            <View style={{ marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
                <TouchableOpacity
                  onPress={() => setDashSelectedBranch('All Branches')}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8,
                    backgroundColor: dashSelectedBranch === 'All Branches' ? COLORS.primary : '#fff',
                    borderWidth: 1, borderColor: dashSelectedBranch === 'All Branches' ? COLORS.primary : COLORS.border
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: dashSelectedBranch === 'All Branches' ? '#fff' : COLORS.text }}>All Branches</Text>
                </TouchableOpacity>
                {Array.from(new Set(todayPatientsFiltered.map(p => normalizeBranchName(p.branchName || p.branchId)).filter(Boolean))).map(branch => (
                  <TouchableOpacity
                    key={branch}
                    onPress={() => setDashSelectedBranch(branch)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8,
                      backgroundColor: dashSelectedBranch === branch ? COLORS.primary : '#fff',
                      borderWidth: 1, borderColor: dashSelectedBranch === branch ? COLORS.primary : COLORS.border
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: dashSelectedBranch === branch ? '#fff' : COLORS.text }}>{branch}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Doctor Summary Boxes */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 }}>
              <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: COLORS.secondary, elevation: 2, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Users size={10} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>Total</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{docTotalCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: COLORS.primary, elevation: 2, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Clock size={10} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>Ongoing</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{docActiveCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#0ea5e9', elevation: 2, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <CheckCircle2 size={10} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>Completed</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{docCompletedCount}</Text>
              </View>
            </View>

            {/* Live Queue Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleMain}>My Consultation History</Text>
              <TouchableOpacity onPress={() => fetchLastPunch()}>
                <RefreshCw size={16} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {/* Active Consultation List */}
            {patientsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
            ) : todayPatientsFiltered.filter(p => {
              if (dashSelectedBranch !== 'All Branches' && normalizeBranchName(p.branchName || p.branchId) !== dashSelectedBranch) return false;
              if (!p.doctor) return false;
              const docNorm = normalizeDoctorName(userData?.name || '');
              const patDocNorm = normalizeDoctorName(p.doctor);
              const isMine = patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm));
              const isCompleted = p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done';
              const isOnlineUnpaid = p.status === 'booked' && p.paymentStatus !== 'paid';
              return isMine && !isCompleted && !isOnlineUnpaid;
            }).length === 0 ? (
              <Surface style={styles.emptyQueueCardMini}>
                <Text style={styles.emptyQueueTextMini}>No active patients assigned to you right now.</Text>
              </Surface>
            ) : (
              todayPatientsFiltered
                .filter(p => {
                  if (dashSelectedBranch !== 'All Branches' && normalizeBranchName(p.branchName || p.branchId) !== dashSelectedBranch) return false;
                  if (!p.doctor) return false;
                  const docNorm = normalizeDoctorName(userData?.name || '');
                  const patDocNorm = normalizeDoctorName(p.doctor);
                  const isMine = patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm));
                  const isCompleted = p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done';
                  const isOnlineUnpaid = p.status === 'booked' && p.paymentStatus !== 'paid';
                  return isMine && !isCompleted && !isOnlineUnpaid;
                })
                .sort((a, b) => {
                  const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
                  const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
                  if (qA !== qB) return qA - qB;
                  const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                  const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                  return timeA - timeB;
                })
                .map(patient => (
                  <Surface key={patient.id} style={styles.queueItemCard}>
                    <View style={styles.queueHeader}>
                      <Avatar.Text
                        size={32}
                        label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                        style={{ backgroundColor: patient.status === 'in-consultation' ? COLORS.secondary + '15' : '#f59e0b15' }}
                        labelStyle={{ color: patient.status === 'in-consultation' ? COLORS.secondary : '#f59e0b', fontWeight: '800', fontSize: 10 }}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={styles.queueName}>
                            {patient.fullName}
                          </Text>
                          {!!patient.branchName && (
                            <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: '#047857', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>{patient.branchName.toUpperCase()}</Text>
                            </View>
                          )}
                          {(() => {
                            const source = patient.source || patient.raw?.source;
                            const followUp = patient.followUpDate || patient.raw?.followUpDate || patient.medicationDurationEnd;
                            const normSource = (source || '').toLowerCase().trim();
                            const rawNormSource = (patient.raw?.source || '').toLowerCase().trim();
                            const isOld = !!followUp || normSource === 'old patient' || normSource === 'old_patient' || normSource === 'old' || rawNormSource === 'old patient' || rawNormSource === 'old_patient' || rawNormSource === 'old';
                            const isNew = !isOld && source && normSource !== 'old patient' && normSource !== 'old_patient' && normSource !== 'old';
                            const isApp = patient.isOnline || patient._type === 'online' || normSource === 'appointments' || normSource === 'online' || normSource === 'userapp' || normSource === 'patient app' || normSource === 'patientapp' || normSource === 'app' || rawNormSource === 'appointments' || rawNormSource === 'online' || rawNormSource === 'userapp' || rawNormSource === 'patient app' || rawNormSource === 'patientapp' || rawNormSource === 'app';
                            const isActive = followUp ? checkIsInDuration(followUp) : false;

                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {isNew && (
                                  <View style={{ backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                    <Text style={{ color: '#f43f5e', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>NEW</Text>
                                  </View>
                                )}
                                {isApp && (
                                  <View style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                    <Text style={{ color: '#7c3aed', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>APP</Text>
                                  </View>
                                )}
                                {isOld && (
                                  isActive ? (
                                    <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#d97706', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>IN DURATION</Text>
                                    </View>
                                  ) : (
                                    <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 }}>
                                      <Text style={{ color: '#0369a1', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>RE-BOOKING</Text>
                                    </View>
                                  )
                                )}
                              </View>
                            );
                          })()}
                          {activePackageMobiles.has(patient.phone) && (
                            <View style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: '#047857', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }}>PKG</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.queueSubtext} numberOfLines={1}>
                          {patient.complaint || 'General Checkup'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={styles.timeSlotBadge}>
                          <Clock size={11} color="#258ec8" style={{ marginRight: 4 }} />
                          <Text style={styles.timeSlotBadgeText}>{patient.appointmentTime || '09:30 AM'}</Text>
                        </View>

                        {patient.status === 'waiting' || patient.status === 'booked' ? (
                          <TouchableOpacity
                            style={[styles.consultBtn, { backgroundColor: '#10b981' }]}
                            onPress={() => handleStartConsultation(patient.id, patient._type)}
                          >
                            <Play size={10} color="white" fill="white" />
                            <Text style={styles.consultBtnText}>Start</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.consultBtn, { backgroundColor: COLORS.secondary }]}
                            onPress={() => navigation.navigate('PatientDetails', { patientId: patient.id })}
                          >
                            <Eye size={10} color="white" />
                            <Text style={styles.consultBtnText}>Resume</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </Surface>
                ))
            )}

            {/* Completed Consultations List */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitleMain}>Completed Consultations</Text>
            </View>

            {patientsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
            ) : todayPatientsFiltered.filter(p => {
              if (dashSelectedBranch !== 'All Branches' && normalizeBranchName(p.branchName || p.branchId) !== dashSelectedBranch) return false;
              if (!p.doctor) return false;
              const docNorm = normalizeDoctorName(userData?.name || '');
              const patDocNorm = normalizeDoctorName(p.doctor);
              const isMine = patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm));
              const isCompleted = p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done';
              return isMine && isCompleted;
            }).length === 0 ? (
              <Surface style={styles.emptyQueueCardMini}>
                <Text style={styles.emptyQueueTextMini}>No completed consultations yet.</Text>
              </Surface>
            ) : (
              todayPatientsFiltered
                .filter(p => {
                  if (dashSelectedBranch !== 'All Branches' && normalizeBranchName(p.branchName || p.branchId) !== dashSelectedBranch) return false;
                  if (!p.doctor) return false;
                  const docNorm = normalizeDoctorName(userData?.name || '');
                  const patDocNorm = normalizeDoctorName(p.doctor);
                  const isMine = patDocNorm && docNorm && (patDocNorm.includes(docNorm) || docNorm.includes(patDocNorm));
                  const isCompleted = p.status === 'completed' || p.doctorStatus === 'prescribed' || p.status === 'done';
                  return isMine && isCompleted;
                })
                .sort((a, b) => {
                  const qA = typeof a.queueOrder === 'number' ? a.queueOrder : Infinity;
                  const qB = typeof b.queueOrder === 'number' ? b.queueOrder : Infinity;
                  if (qA !== qB) return qA - qB;
                  const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                  const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                  return timeA - timeB;
                })
                .map(patient => (
                  <Surface key={patient.id} style={styles.queueItemCard}>
                    <View style={styles.queueHeader}>
                      <Avatar.Text
                        size={32}
                        label={patient.fullName ? patient.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
                        style={{ backgroundColor: COLORS.success + '15' }}
                        labelStyle={{ color: COLORS.success, fontWeight: '800', fontSize: 10 }}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <Text style={[styles.queueName, { textDecorationLine: 'line-through', color: COLORS.muted }]}>
                            {patient.fullName}
                          </Text>
                        </View>
                        <Text style={styles.queueSubtext} numberOfLines={1}>
                          {patient.status === 'in-consultation' ? 'At Reception / Pharmacy' : 'Fully Checkout Completed'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={styles.completedBadge}>
                          <CheckCircle2 size={10} color="#10b981" style={{ marginRight: 2 }} />
                          <Text style={styles.completedBadgeText}>DONE</Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.consultBtn, { backgroundColor: COLORS.muted, marginTop: 4 }]}
                          onPress={() => navigation.navigate('PatientDetails', { patientId: patient.id })}
                        >
                          <Eye size={10} color="white" />
                          <Text style={styles.consultBtnText}>View File</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Surface>
                ))
            )}

            {/* Quick Slim Attendance Punch Card for Doctors is hidden */}
          </View>
        ) : (
          /* REGULAR CLINIC STAFF VIEW */
          <View>


            {/* Main Attendance Card */}
            {['staff', 'receptionist', 'admin'].includes(userData?.role) && (
              <Surface style={styles.mainPunchCard}>
                <View style={styles.attendanceHeader}>
                  <Text style={styles.attendanceTitle}>Attendance Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color={COLORS.muted} />
                    <Text style={styles.currentDate}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  </View>
                </View>

                <View style={styles.punchDetailsRow}>
                  <View style={styles.statusLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: punchStatus === 'login' ? COLORS.success : punchStatus === 'completed' ? COLORS.secondary : COLORS.muted }
                      ]} />
                      <Text style={styles.punchStatusMain}>
                        {punchStatus === 'login' ? 'Punched IN' : punchStatus === 'completed' ? 'Attendance Completed' :
                          (() => {
                            let isLate = false;
                            const h = new Date().getHours();
                            const m = new Date().getMinutes();
                            if (userData?.loginTime && typeof userData.loginTime === 'string') {
                              const parts = userData.loginTime.split(':');
                              const tH = parts[0];
                              const tM = parts[1] || '';
                              let th = parseInt(tH, 10) || 9;
                              const tm = parseInt(tM, 10) || 30;
                              if (tM && tM.toLowerCase().includes('pm') && th !== 12) {
                                th += 12;
                              } else if (tM && tM.toLowerCase().includes('am') && th === 12) {
                                th = 0;
                              }
                              isLate = h > th || (h === th && m > tm);
                            } else {
                              isLate = h > 9 || (h === 9 && m > 30);
                            }
                            return isLate ? 'Late Logined - Click Below to Punch In' : 'Not Punched In Yet';
                          })()
                        }
                      </Text>
                    </View>
                    <Text style={styles.sinceText}>
                      {punchStatus === 'completed'
                        ? `IN: ${todayPunchInTime ? todayPunchInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'} | OUT: ${todayPunchOutTime ? todayPunchOutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`
                        : punchStatus === 'login'
                          ? `IN at ${todayPunchInTime ? todayPunchInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`
                          : `Yesterday OUT: ${yesterdayPunchOutTime ? yesterdayPunchOutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}`}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.statusRight}>
                    <Text style={styles.timeBig}>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.ampm}>{new Date().getHours() >= 12 ? 'PM' : 'AM'}</Text>
                  </View>
                </View>

                {(punchStatus === 'logout' || punchStatus === 'login') && (
                  <View style={{ marginVertical: 12, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
                    {capturedSelfieUri ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image source={{ uri: capturedSelfieUri }} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#cbd5e1' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>Selfie Captured Successfully</Text>
                          <TouchableOpacity onPress={handleCaptureSelfie}>
                            <Text style={{ fontSize: 12, color: COLORS.secondary, fontWeight: '700', marginTop: 2 }}>Retake Selfie</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 150 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>📷 Capture Selfie Required</Text>
                          <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>A selfie is required before you can Punch {punchStatus === 'logout' ? 'In' : 'Out'}.</Text>
                        </View>
                        <TouchableOpacity
                          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.secondary, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          onPress={handleCaptureSelfie}
                        >
                          <Camera size={16} color="white" />
                          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Take Selfie</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.bigPunchBtn,
                    {
                      backgroundColor:
                        punchStatus === 'completed' ? '#cbd5e1' :
                          !capturedSelfieUri ? '#cbd5e1' :
                            punchStatus === 'login' ? COLORS.danger : COLORS.success
                    }
                  ]}
                  onPress={handlePunch}
                  disabled={punching || punchStatus === 'completed' || !capturedSelfieUri}
                >
                  {punching ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      {punchStatus === 'completed' ? (
                        <CheckCircle2 size={20} color="#64748b" style={{ marginRight: 8 }} />
                      ) : (
                        <LogOut size={20} color={!capturedSelfieUri ? '#64748b' : 'white'} style={{ marginRight: 8 }} />
                      )}
                      <Text style={[
                        styles.bigPunchBtnText,
                        (punchStatus === 'completed' || !capturedSelfieUri) && { color: '#64748b' }
                      ]}>
                        {punchStatus === 'completed' ? 'Completed for Today' :
                          !capturedSelfieUri ? 'Take Selfie First' :
                            punchStatus === 'login' ? 'Punch OUT' : 'Punch IN'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Surface>
            )}

            {/* This Month Summary */}
            {['staff', 'receptionist', 'admin', 'doctor'].includes(userData?.role) && (
              <>
                <View style={[styles.sectionHeader, { maxWidth: 350, alignSelf: 'center', width: '100%' }]}>
                  <Text style={styles.sectionTitleMain}>This Month Attendance</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {userData?.role !== 'receptionist' && (
                      <TouchableOpacity onPress={() => navigation.navigate('MyDeductions')}>
                        <Text style={[styles.viewAllText, { color: '#ef4444' }]}>Deductions</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => navigation.navigate('MyAttendance')}>
                      <Text style={styles.viewAllText}>View Logs</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Surface style={styles.glassAttendanceCard}>
                  <View style={styles.glassCardHeader}>
                    <Text style={styles.glassCardTitle}>Monthly Metrics</Text>
                    <Text style={styles.glassCardSub}>Total Working Days: {monthlyMetrics.totalWorkingDays || 0}</Text>
                  </View>

                  <View style={styles.metricsGrid}>
                    {/* Present Metric */}
                    <TouchableOpacity
                      style={styles.metricCardItem}
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('Present Days', 'Total days you have punched in and attended work this month.')}
                    >
                      <View style={[styles.metricIconBg, { backgroundColor: '#e8fbf0' }]}>
                        <CheckCircle2 size={16} color="#22C55E" />
                      </View>
                      <Text style={styles.metricCardVal}>{monthlyMetrics.present}</Text>
                      <Text style={styles.metricCardLbl} numberOfLines={1}>Present</Text>
                      <Text style={styles.metricCardPct}>{((monthlyMetrics.present / (monthlyMetrics.totalWorkingDays || 1)) * 100).toFixed(0)}%</Text>
                    </TouchableOpacity>

                    {/* Late Metric */}
                    <TouchableOpacity
                      style={styles.metricCardItem}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('AttendanceMetricDetails', { metricType: 'late' })}
                    >
                      <View style={[styles.metricIconBg, { backgroundColor: '#fef2f2' }]}>
                        <Clock size={16} color="#EF4444" />
                      </View>
                      <Text style={styles.metricCardVal}>{monthlyMetrics.late}</Text>
                      <Text style={styles.metricCardLbl} numberOfLines={1}>Late</Text>
                      <Text style={styles.metricCardPct}>{((monthlyMetrics.late / (monthlyMetrics.totalWorkingDays || 1)) * 100).toFixed(0)}%</Text>
                    </TouchableOpacity>

                    {/* Half Day Metric */}
                    <TouchableOpacity
                      style={styles.metricCardItem}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('AttendanceMetricDetails', { metricType: 'halfDay' })}
                    >
                      <View style={[styles.metricIconBg, { backgroundColor: '#fdfbeb' }]}>
                        <Calendar size={16} color="#F59E0B" />
                      </View>
                      <Text style={styles.metricCardVal}>{monthlyMetrics.halfDay}</Text>
                      <Text style={styles.metricCardLbl} numberOfLines={1}>Half Day</Text>
                      <Text style={styles.metricCardPct}>{((monthlyMetrics.halfDay / (monthlyMetrics.totalWorkingDays || 1)) * 100).toFixed(0)}%</Text>
                    </TouchableOpacity>

                    {/* Permission Metric */}
                    <TouchableOpacity
                      style={styles.metricCardItem}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('AttendanceMetricDetails', { metricType: 'permissions' })}
                    >
                      <View style={[styles.metricIconBg, { backgroundColor: '#eff6ff' }]}>
                        <FileCheck size={16} color="#3B82F6" />
                      </View>
                      <Text style={styles.metricCardVal}>{monthlyMetrics.permissions}</Text>
                      <Text style={styles.metricCardLbl} numberOfLines={1}>Permission</Text>
                      <Text style={styles.metricCardPct}>{((monthlyMetrics.permissions / (monthlyMetrics.totalWorkingDays || 1)) * 100).toFixed(0)}%</Text>
                    </TouchableOpacity>

                    {/* Absent Metric */}
                    <TouchableOpacity
                      style={styles.metricCardItem}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('AttendanceMetricDetails', { metricType: 'absent' })}
                    >
                      <View style={[styles.metricIconBg, { backgroundColor: '#f3f4f6' }]}>
                        <AlertCircle size={16} color="#9CA3AF" />
                      </View>
                      <Text style={styles.metricCardVal}>{monthlyMetrics.absent}</Text>
                      <Text style={styles.metricCardLbl} numberOfLines={1}>Absent</Text>
                      <Text style={styles.metricCardPct}>{((monthlyMetrics.absent / (monthlyMetrics.totalWorkingDays || 1)) * 100).toFixed(0)}%</Text>
                    </TouchableOpacity>
                  </View>
                </Surface>

                {/* My Applied Leaves Section */}
                <View style={[styles.sectionHeader, { marginTop: 24, maxWidth: 350, alignSelf: 'center', width: '100%' }]}>
                  <Text style={styles.sectionTitleMain}>My Applied Leaves</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('LeaveRequest')}>
                    <Text style={styles.viewAllText}>View History</Text>
                  </TouchableOpacity>
                </View>

                {myLeaves.length === 0 ? (
                  <Surface style={styles.emptyLeavesCard}>
                    <Text style={styles.emptyLeavesText}>No leave requests applied yet.</Text>
                  </Surface>
                ) : (
                  myLeaves.slice(0, 4).map((item) => (
                    <Surface key={item.id} style={styles.leaveHistoryCardMini}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaveHistoryTypeMini}>{item.leaveType}</Text>
                        <Text style={styles.leaveHistoryDateMini}>{item.startDate} - {item.endDate}</Text>
                        {item.reason ? (
                          <Text style={styles.leaveHistoryReasonMini} numberOfLines={1}>
                            Reason: {item.reason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[
                        styles.statusBadgeMini,
                        { backgroundColor: item.status === 'approved' ? '#f0fdf4' : item.status === 'rejected' ? '#fef2f2' : '#fefce8' }
                      ]}>
                        <Text style={[
                          styles.statusTextMini,
                          { color: item.status === 'approved' ? '#166534' : item.status === 'rejected' ? '#991b1b' : '#854d0e' }
                        ]}>
                          {item.status === 'approved' ? 'Accepted' : item.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </Text>
                      </View>
                    </Surface>
                  ))
                )}
              </>
            )}

            {/* Quick Actions */}
            <Text style={[styles.sectionTitleMain, { marginTop: 24, marginBottom: 16 }]}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              {['staff', 'receptionist', 'admin', 'doctor'].includes(userData?.role) && (
                <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('MyAttendance')}>
                  <View style={[styles.quickIconBox, { backgroundColor: '#f0fdf4' }]}>
                    <Clock size={24} color="#22c55e" />
                  </View>
                  <Text style={styles.quickLabel}>My Attendance</Text>
                </TouchableOpacity>
              )}
              {(userData?.role === 'receptionist' || userData?.role === 'doctor') && (
                <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab && setActiveTab('ReceptionPanel')}>
                  <View style={[styles.quickIconBox, { backgroundColor: '#faf5ff' }]}>
                    <Users size={24} color="#a855f7" />
                  </View>
                  <Text style={styles.quickLabel}>Reception</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Pending Medicine Discounts */}

            {userData?.role === 'hr' && (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitleMain, { marginBottom: 14 }]}>Pending Medicine Discounts</Text>
                {patientsLoading ? (
                  <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 16 }} />
                ) : todayPatientsFiltered.filter(p => p.medicineDiscountStatus === 'pending').length === 0 ? (
                  <Surface style={styles.emptyQueueCardMini}>
                    <Text style={styles.emptyQueueTextMini}>No pending discount requests.</Text>
                  </Surface>
                ) : (
                  todayPatientsFiltered
                    .filter(p => p.medicineDiscountStatus === 'pending')
                    .map((req) => (
                      <Surface key={req.id} style={[styles.queueItemCard, { padding: 14, marginBottom: 10, borderColor: '#fef08a', borderWidth: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{req.fullName}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.muted }}>{req.branchName || 'Main Branch'}</Text>
                          </View>
                          <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '800' }}>PENDING</Text>
                          </View>
                        </View>

                        <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: COLORS.muted }}>Original Amount:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', textDecorationLine: 'line-through', color: COLORS.muted }}>₹{req.medicineDiscountOriginal}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '600' }}>Requested Amount:</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.success }}>₹{req.medicineDiscountRequested}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: COLORS.text, fontStyle: 'italic' }}>Note: "{req.medicineDiscountNote}"</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            style={[styles.actionBtnOutline, { flex: 1, borderColor: '#fde68a', backgroundColor: '#fef3c7', justifyContent: 'center' }]}
                            onPress={() => handleRejectMedicineDiscount(req.id)}
                          >
                            <X size={14} color="#ef4444" />
                            <Text style={{ fontSize: 12, color: '#ef4444', marginLeft: 6, fontWeight: '700' }}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtnOutline, { flex: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', justifyContent: 'center' }]}
                            onPress={() => handleApproveMedicineDiscount(req.id, req.medicineDiscountRequested)}
                          >
                            <CheckCircle2 size={14} color="#16a34a" />
                            <Text style={{ fontSize: 12, color: '#16a34a', marginLeft: 6, fontWeight: '700' }}>Approve</Text>
                          </TouchableOpacity>
                        </View>
                      </Surface>
                    ))
                )}
              </View>
            )}

            {userData?.role === 'hr' && (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitleMain, { marginBottom: 14 }]}>Branch Performance (Today)</Text>
                <View style={{ flexDirection: 'column', gap: 8 }}>
                  {branchPerformanceToday.map((stat, idx) => (
                    <Surface
                      key={idx}
                      style={{
                        width: '100%',
                        backgroundColor: COLORS.white,
                        borderRadius: 10,
                        padding: 12,
                        borderTopWidth: 2,
                        borderTopColor: idx % 2 === 0 ? '#8b5cf6' : '#f59e0b',
                        elevation: 1.5,
                        marginBottom: 6
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                        {stat.name}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.muted }}>PATIENTS</Text>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: 2 }}>
                            {stat.patients}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.muted }}>REVENUE</Text>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#10b981', marginTop: 2 }}>
                            ₹{stat.revenue.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>

                      <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: '#0ea5e9', textTransform: 'uppercase' }}>Opted:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#0ea5e9' }}>
                            {stat.followUpOpted}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: '#f43f5e', textTransform: 'uppercase' }}>Not Opted:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#f43f5e' }}>
                            {stat.followUpNotOpted}
                          </Text>
                        </View>
                      </View>
                    </Surface>
                  ))}
                  {branchPerformanceToday.length === 0 && (
                    <Surface style={styles.emptyQueueCardMini}>
                      <Text style={styles.emptyQueueTextMini}>No branches found.</Text>
                    </Surface>
                  )}
                </View>
              </View>
            )}


          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Payment Modal */}
      <AppointmentPaymentModal
        visible={paymentModalVisible}
        onDismiss={() => setPaymentModalVisible(false)}
        onViewDetails={() => {
          setPaymentModalVisible(false);
          if (selectedPatientForPayment?.id) {
            navigation.navigate('PatientDetails', { patientId: selectedPatientForPayment.id });
          }
        }}
        selectedPatientForPayment={selectedPatientForPayment}
        stopPolling={stopPolling}
        unlockRequest={unlockRequest}
        requestingUnlock={requestingUnlock}
        handleRequestUnlock={handleRequestUnlock}
        includeConsultation={includeConsultation}
        setIncludeConsultation={setIncludeConsultation}
        includeMedicine={includeMedicine}
        setIncludeMedicine={setIncludeMedicine}
        includeDiet={includeDiet}
        setIncludeDiet={setIncludeDiet}
        consultationFee={consultationFee}
        setConsultationFee={setConsultationFee}
        medicineFee={medicineFee}
        setMedicineFee={setMedicineFee}
        dietFee={dietFee}
        setDietFee={setDietFee}
        medicines={medicines}
        handleMedicineChange={handleMedicineChange}
        handleAddMedicineRow={handleAddMedicineRow}
        handleRemoveMedicineRow={handleRemoveMedicineRow}
        prescriptionDuration={prescriptionDuration}
        setPrescriptionDuration={setPrescriptionDuration}
        payLaterAmount={payLaterAmount}
        setPayLaterAmount={setPayLaterAmount}
        paymentLegs={paymentLegs}
        setPaymentLegs={setPaymentLegs}
        loadingQr={loadingQr}
        razorpayQrCode={razorpayQrCode}
        generateRazorpayQR={generateRazorpayQR}
        processingRzp={processingRzp}
        handleSendFeeToPatient={handleSendFeeToPatient}
        handleQuickPayment={handleQuickPayment}
      />

      {/* Payment Confirmation Screen Modal */}
      <Modal visible={payConfirmVisible} transparent animationType="fade" onRequestClose={() => setPayConfirmVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', alignItems: 'center' }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={44} color="#10b981" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#10b981', marginBottom: 6 }}>Payment Confirmed!</Text>
            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
              Consultation fee collected successfully
            </Text>

            <View style={{ width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              {[
                { label: 'Patient', value: payConfirmData?.patientName },
                { label: 'Amount', value: `₹${payConfirmData?.amount}`, valueStyle: { color: '#10b981', fontSize: 18, fontWeight: '900' } },
                { label: 'Method', value: (payConfirmData?.method || '').toUpperCase() }
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>{row.label}</Text>
                  <Text style={[{ fontSize: 13, color: '#1e293b', fontWeight: '700' }, row.valueStyle]}>{row.value}</Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 }} />
              <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>Ref: {payConfirmData?.paymentId}</Text>
            </View>

            <View style={{ width: '100%', backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#fef3c7' }}>
              <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '700', textAlign: 'center' }}>
                Reward points are only added when patients pay via the Patient App
              </Text>
            </View>

            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#25d366', borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}
              onPress={() => handleShareReceiptWhatsApp(payConfirmData)}
            >
              <WhatsAppIcon size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Share Receipt via WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ width: '100%', backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}
              onPress={() => handleShareReceiptPDF(payConfirmData)}
            >
              <FileText size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Share PDF Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => { setPayConfirmVisible(false); setPayConfirmData(null); }}
            >
              <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 64
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  welcomeText: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  userName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  staffBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  staffBadgeText: { fontSize: 8, fontWeight: '800', color: COLORS.secondary },
  branchText: { fontSize: 9, color: COLORS.muted, marginLeft: 4, fontWeight: '600' },
  notificationBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  notificationBtnBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444'
  },
  scrollContent: { padding: 16 },

  // Receptionist UI Dashboard Styles
  receptionStatsGrid: { marginBottom: 20, gap: 10 },
  receptionStatsRow: { flexDirection: 'row', gap: 10 },
  receptionStatCard: { flex: 1, padding: 12, backgroundColor: COLORS.white, borderRadius: 16, elevation: 2, alignItems: 'center' },
  receptionStatVal: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  receptionStatLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  receptionStatCardSmall: { flex: 1, padding: 8, backgroundColor: COLORS.white, borderRadius: 10, elevation: 2, alignItems: 'center' },
  receptionStatValSmall: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  receptionStatLabelSmall: { fontSize: 8, color: COLORS.muted, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  nextPatientCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 3, marginBottom: 24, borderTopColor: COLORS.primary, borderTopWidth: 3 },
  nextPatientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nextTag: { backgroundColor: COLORS.primary, borderRadius: 6, height: 24 },
  nextTime: { fontSize: 11, color: COLORS.muted, fontWeight: '700' },
  nextName: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  nextInfoRow: { flexDirection: 'row', marginBottom: 16 },
  nextLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextValue: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  nextBtn: { borderRadius: 12, marginTop: 4 },

  emptyQueueCard: { padding: 24, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, alignItems: 'center', marginBottom: 24 },
  emptyQueueText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },

  queueItemCard: { padding: 8, borderRadius: 12, backgroundColor: COLORS.white, elevation: 2, marginBottom: 6 },
  queueHeader: { flexDirection: 'row', alignItems: 'center' },
  queueAvatar: { width: 32, height: 32, borderRadius: 16 },
  queueName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  queueSubtext: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  queueStatusChip: { height: 22, borderRadius: 6 },
  queueArrow: { paddingLeft: 12 },
  timeSlotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  timeSlotBadgeText: {
    fontSize: 9,
    color: '#258ec8',
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  completedBadgeText: {
    fontSize: 8,
    color: '#10b981',
    fontWeight: '800',
  },
  emptyQueueCardMini: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  emptyQueueTextMini: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },

  // General Dashboard Styles
  statsScroll: { marginBottom: 24 },
  miniStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginRight: 12,
    elevation: 2,
    minWidth: 140
  },
  miniIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  miniStatVal: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  miniStatLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '500' },
  mainPunchCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 3,
    marginBottom: 14,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  glassAttendanceCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 24,
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  glassCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  glassCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  glassCardSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  metricCardItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricCardVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  metricCardLbl: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  metricCardPct: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  attendanceTitle: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  currentDate: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  punchDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  statusLeft: { flex: 1 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  punchStatusMain: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sinceText: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  divider: { width: 1, height: 30, backgroundColor: COLORS.border, marginHorizontal: 12 },
  statusRight: { alignItems: 'flex-end' },
  timeBig: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  ampm: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  bigPunchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, elevation: 3 },
  bigPunchBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleMain: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  viewAllText: { fontSize: 12, color: COLORS.secondary, fontWeight: '700' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
  filterChipTextActive: { color: 'white' },
  monthStatsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  monthStatBox: { flex: 1, padding: 12, borderRadius: 16, alignItems: 'center' },
  monthStatVal: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  monthStatLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '600' },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 20, backgroundColor: COLORS.white, elevation: 2, marginBottom: 24 },
  calendarDay: { alignItems: 'center' },
  dayLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginBottom: 4 },
  dayNum: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickAction: { width: '22.5%', alignItems: 'center' },
  quickIconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', elevation: 2, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  quickLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    elevation: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  punchNavCircle: { alignItems: 'center', marginTop: -40 },
  punchCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  doctorWelcomeText: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  doctorSubWelcome: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginBottom: 20 },
  consultBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4, elevation: 1 },
  consultBtnText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  emptyLeavesCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  emptyLeavesText: { fontSize: 12, color: COLORS.muted },
  leaveHistoryCardMini: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    elevation: 2,
    marginBottom: 10,
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  leaveHistoryTypeMini: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  leaveHistoryDateMini: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  leaveHistoryReasonMini: { fontSize: 11, color: COLORS.muted, marginTop: 4, fontStyle: 'italic' },
  statusBadgeMini: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusTextMini: { fontSize: 10, fontWeight: '800' },
  drawerContent: {
    width: SCREEN_W * 0.75,
    height: SCREEN_H,
    backgroundColor: COLORS.white,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 15
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text
  },
  actionCardText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  // Payment Modal Styles
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  paymentModalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  paymentModalSub: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 20,
  },
  amountInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  methodButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  methodButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  methodButtonTextSelected: {
    color: COLORS.primary,
  },
  // Branch Analytics Styles
  branchStatsSection: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    elevation: 3,
    marginBottom: 24,
    marginHorizontal: 1,
  },
  branchSectionTitleBold: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    maxWidth: SCREEN_W * 0.45
  },
  dropdownBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary
  },
  revenueStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  revenueCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
    minHeight: 74,
    justifyContent: 'center'
  },
  revenueCardVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondary
  },
  revenueCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 2
  },
  bookingStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  bookingMiniCard: {
    flex: 1,
    minWidth: (SCREEN_W - 88) / 3,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
  },
  bookingMiniVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text
  },
  bookingMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 2,
    textAlign: 'center'
  },
  hrModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20
  },
  modalPanel: {
    width: '100%',
    maxHeight: '60%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  modalScroll: {
    flexGrow: 0
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    borderRadius: 10
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff'
  },
  modalOptionText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500'
  },
  modalOptionTextSelected: {
    color: COLORS.secondary,
    fontWeight: '700'
  }
});
export default Dashboard;





