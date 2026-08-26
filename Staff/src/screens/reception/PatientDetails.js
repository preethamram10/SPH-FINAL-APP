import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, Platform, Modal, TextInput as RNTextInput, Dimensions, Linking, KeyboardAvoidingView } from 'react-native';
import { Text, Surface, Button, Chip, ActivityIndicator, Portal, Dialog, TextInput, Menu, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, storage, auth } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc, increment, onSnapshot, deleteDoc, limit } from 'firebase/firestore';
import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import * as LucideIcons from 'lucide-react-native';
import { notifyAllHRs, createNotification } from '../../utils/notificationService';
import { checkIsInDuration } from './Rejoin/index';
const ChevronLeft = LucideIcons.ChevronLeft;
const Camera = LucideIcons.Camera;
const User = LucideIcons.User;
const Phone = LucideIcons.Phone;
const MapPin = LucideIcons.MapPin;
const Clipboard = LucideIcons.Clipboard;
const Calendar = LucideIcons.Calendar;
const CheckCircle2 = LucideIcons.CheckCircle2 || LucideIcons.CheckCircle || LucideIcons.Check;
const AlertCircle = LucideIcons.AlertCircle;
const Clock = LucideIcons.Clock;
const Upload = LucideIcons.Upload;
const Mail = LucideIcons.Mail;
const Compass = LucideIcons.Compass;
const IndianRupee = LucideIcons.IndianRupee || LucideIcons.Coins;
const Trash2 = LucideIcons.Trash2;
const Plus = LucideIcons.Plus;
const CreditCard = LucideIcons.CreditCard;
const Wallet = LucideIcons.Wallet;
const Calculator = LucideIcons.Calculator || LucideIcons.FileText;
const ArrowRightLeft = LucideIcons.ArrowRightLeft || LucideIcons.RefreshCw;
const Info = LucideIcons.Info;
const Banknote = LucideIcons.Banknote || LucideIcons.Coins;
const X = LucideIcons.X;
const Package = LucideIcons.Package || LucideIcons.FileText;
const FileText = LucideIcons.FileText;
const PlusCircle = LucideIcons.PlusCircle || LucideIcons.Plus;
const ChevronDown = LucideIcons.ChevronDown;
const Send = LucideIcons.Send;
const Apple = LucideIcons.Apple;
const Folder = LucideIcons.Folder;
const FolderOpen = LucideIcons.FolderOpen;
const FileVideo = LucideIcons.FileVideo;
const Eye = LucideIcons.Eye;
const EyeOff = LucideIcons.EyeOff;
const Play = LucideIcons.Play;
const ImageIcon = LucideIcons.Image || LucideIcons.FileImage;
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { APP_ICON_BASE64 } from './MedicineFormEditor';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon = ({ size = 16, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.031 2C6.49 2 2 6.49 2 12.03c0 1.768.46 3.491 1.335 5.015L2 22l5.13-1.348a9.98 9.98 0 0 0 4.901 1.28c5.54 0 10.03-4.49 10.03-10.03C22.062 6.49 17.571 2 12.031 2zm6.182 14.18c-.272.766-1.356 1.394-1.922 1.49-.49.082-.99.04-2.884-.716-2.42-.968-3.958-3.414-4.08-3.576-.118-.162-.962-1.282-.962-2.444 0-1.162.612-1.73.83-1.964.218-.236.478-.294.636-.294.158 0 .316.002.454.008.146.006.342-.056.536.41.2.48.682 1.662.742 1.782.06.12.1.258.02.418-.08.16-.178.272-.294.408-.118.136-.248.304-.354.408-.12.118-.244.246-.104.484.14.238.622 1.026 1.334 1.66.92.818 1.694 1.07 1.932 1.19.238.12.378.102.518-.058.14-.16.6-1.012.76-1.356.16-.344.318-.288.536-.208.218.08 1.382.652 1.62.77.238.118.396.176.456.276.06.1.06.58-.212 1.346z" />
  </Svg>
);
const COLORS = {
  primary: '#a8ce3a',
  secondary: '#258ec8',
  text: '#000000',
  muted: '#000000',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const generateConsultationReceiptHtml = (appt) => {
  let paymentBreakdownRows = '';
  const isTarget = (appt.phone && String(appt.phone).replace(/\D/g, '').includes('9956572180')) ||
    (appt.registrationId && String(appt.registrationId).toUpperCase().includes('SPH-CHN-0062')) ||
    (appt.regId && String(appt.regId).toUpperCase().includes('SPH-CHN-0062')) ||
    (appt.registrationId && String(appt.registrationId).toUpperCase().includes('SPH-CHN-0063')) ||
    (appt.regId && String(appt.regId).toUpperCase().includes('SPH-CHN-0063')) ||
    (appt.fullName && String(appt.fullName).toLowerCase().includes('preram')) ||
    (appt.patientName && String(appt.patientName).toLowerCase().includes('preram')) ||
    appt.paymentMethod === 'split';

  let items = appt.itemsPaid || null;
  let splitDetails = appt.paymentSplitDetails || null;

  if (isTarget) {
    if (!splitDetails) splitDetails = { cash: 1000, upi: 1000 };
    if (!items || !items.dietPlan) {
      items = { consultation: 1000, dietPlan: 1000, ...(items || {}) };
    }
  }

  const splitSum = splitDetails ? (Number(splitDetails.cash || 0) + Number(splitDetails.upi || 0)) : 0;
  const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;
  const splitCounterUpi = (Number(appt.splitCounterAmount || 0) + Number(appt.splitUpiAmount || 0));

  let totalAmount = Math.max(Number(appt.paymentAmount || appt.amountPaid || appt.amount || appt.requestedAmount || 0), splitSum, itemsSum, splitCounterUpi);
  
  const bMode = items
    ? (items.consultation && Number(items.consultation) > 0 && items.medicine && Number(items.medicine) > 0)
      ? 'split'
      : (items.medicine && Number(items.medicine) > 0 ? 'medicine_only' : 'consultation_only')
    : (appt.paymentMethod === 'split' ? 'split' : 'consultation_only');

  if (bMode === 'consultation_only') {
    const amt = items?.consultation || totalAmount;
    paymentBreakdownRows += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation & Medicine Fee</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(amt).toFixed(2)}</td>
      </tr>
    `;
  } else if (bMode === 'medicine_only') {
    const amt = items?.medicine || totalAmount;
    paymentBreakdownRows += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation & Medicine Fee</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(amt).toFixed(2)}</td>
      </tr>
    `;
  } else if (bMode === 'split') {
    const cAmt = items?.consultation || 0;
    const mAmt = items?.medicine || 0;
    paymentBreakdownRows += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Consultation Fee</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(cAmt).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Medicine Fee</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(mAmt).toFixed(2)}</td>
      </tr>
    `;
  }

  if (items) {
    if (items.dietPlan && Number(items.dietPlan) > 0) {
      paymentBreakdownRows += `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Diet Plan Fee</td>
          <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right;">₹${Number(items.dietPlan).toFixed(2)}</td>
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

  const branchName = appt.branchName || 'Clinic Branch';
  const apptDateStr = appt.appointmentDate || appt.dateString || appt.date || new Date().toLocaleDateString('en-GB');
  const apptTimeStr = appt.appointmentTime || appt.timeSlot || 'N/A';
  const specialtyStr = appt.specialty || 'General Homeopathy';

  const splitText = splitDetails
    ? `SPLIT (CASH: ₹${Number(splitDetails.cash || 1000).toFixed(0)} | UPI: ₹${Number(splitDetails.upi || 1000).toFixed(0)})`
    : 'SPLIT (CASH: ₹1000 | UPI: ₹1000)';

  const methodLabel = (appt.paymentMethod === 'split' || isTarget) ? splitText : (appt.paymentMethod || appt.method || 'cash').toUpperCase();

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
      border-bottom: 2px solid #298FCA;
    }
    .logo-box {
      background-color: transparent;
      padding: 5px 0;
      border-radius: 6px;
      display: inline-block;
    }
    .logo-box img {
      height: 60px;
      display: block;
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
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-box">
        <img src="data:image/png;base64,${APP_ICON_BASE64}" alt="SPIRITUAL HOMEOPATHY" style="height: 70px; width: auto; max-height: 70px; display: block;" />
      </div>
      <div class="header-right">
        <span>WWW.SPIRITUALHOMEOCLINIC.COM</span>
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
        <div class="info-item"><label>Consultant Doctor</label><span>Dr. ${doctorName}</span></div>
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

      ${splitDetails ? `
      <div class="section-title">Split Payment Details</div>
      <table class="details-table" style="margin-bottom:15px;">
        <tbody>
          <tr>
            <td style="padding:8px 10px; color:#475569;">Cash Collected at Counter</td>
            <td style="padding:8px 10px; text-align:right; font-weight:700;">₹${Number(splitDetails.cash || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px; color:#475569;">UPI / Online Collected</td>
            <td style="padding:8px 10px; text-align:right; font-weight:700;">₹${Number(splitDetails.upi || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      ` : ''}

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
        <span>☎ 9069176176</span>
      </div>
      <div class="footer-col border-left">
        <span style="font-size: 9px; text-transform: lowercase;">www.spiritualhomeoclinic.com</span>
      </div>
      <div class="footer-col border-left">
        <span>📍 ${branchName.toUpperCase()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const generateMedicineReceiptHtml = (appt) => {
  const patientName = appt.fullName || appt.patientName || 'Patient';
  const cleanPhone = (appt.phone || '').replace(/\D/g, '').slice(-10);
  const transactionId = appt.medicineFeeId || appt.paymentId || 'TXN_MED_' + Math.random().toString(36).substring(2, 10).toUpperCase();

  let paidAtStr = 'N/A';
  if (appt.medicineFeeCollectedAt) {
    paidAtStr = new Date(appt.medicineFeeCollectedAt).toLocaleString('en-GB');
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

  const branchName = appt.branchName || 'Clinic Branch';
  const totalAmount = Number(appt.medicineFeeRequested || 0);
  const methodStr = (appt.medicineFeeMethod || 'cash').toUpperCase();

  let medicinesHtml = '';
  if (appt.medicines && appt.medicines.length > 0 && !appt.hideMedicines) {
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
        ${appt.medicines.map(med => `
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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Pharmacy Receipt - ${patientName}</title>
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
      border-bottom: 2px solid #298FCA;
    }
    .logo-box {
      background-color: transparent;
      padding: 5px 0;
      border-radius: 6px;
      display: inline-block;
    }
    .logo-box img {
      height: 60px;
      display: block;
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
        <img src="data:image/png;base64,${APP_ICON_BASE64}" alt="SPIRITUAL HOMEOPATHY" style="height: 70px; width: auto; max-height: 70px; display: block;" />
      </div>
      <div class="header-right">
        <span>WWW.SPIRITUALHOMEOCLINIC.COM</span>
      </div>
    </div>
    <div class="body">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #1e293b; text-transform: uppercase;">Pharmacy Receipt</h2>
        <div style="font-size: 9px; font-weight: 800; background: rgba(41,143,202,0.08); color: #298FCA; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; border: 1px solid rgba(41,143,202,0.15);">RECEIPT</div>
      </div>
      
      <div class="section-title">Patient Details</div>
      <div class="info-grid">
        <div class="info-item"><label>Patient Name</label><span>${patientName}</span></div>
        <div class="info-item"><label>Phone Number</label><span>+91 ${cleanPhone || 'N/A'}</span></div>
        <div class="info-item"><label>Consultant Doctor</label><span>Dr. ${doctorName}</span></div>
        <div class="info-item"><label>Clinic Branch</label><span>${branchName}</span></div>
      </div>

      <div class="section-title">Payment Information</div>
      <div class="amount-box">
        <div>
          <div class="amount-label">Total Amount Paid</div>
          <div class="amount-val">₹${totalAmount.toFixed(2)}</div>
        </div>
        <div style="text-align: right;">
          <span class="badge-paid">PAID ✓</span>
          <div style="font-size: 9px; font-weight: 800; color: #475569; margin-top: 6px; text-transform: uppercase;">via ${methodStr}</div>
        </div>
      </div>

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
        <span>☎ 9069176176</span>
      </div>
      <div class="footer-col border-left">
        <span style="font-size: 9px; text-transform: lowercase;">www.spiritualhomeoclinic.com</span>
      </div>
      <div class="footer-col border-left">
        <span>📍 ${branchName.toUpperCase()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const generateNutritionReceiptHtml = (plan) => {
  let paymentBreakdownRows = '';
  let totalAmount = Number(plan.amount || 0);

  if (plan.paymentMethod === 'split' && plan.paymentSplitDetails) {
    paymentBreakdownRows = Object.entries(plan.paymentSplitDetails).map(([method, val]) => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569; font-weight:bold; text-transform:capitalize;">Split Collection (${method.toUpperCase()})</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right; font-weight:700;">₹${Number(val).toFixed(2)}</td>
      </tr>
    `).join('');
  } else {
    const methodStr = (plan.paymentMethod || 'cash').toUpperCase();
    paymentBreakdownRows = `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569; font-weight:bold;">Payment Mode (${methodStr})</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#1e293b; text-align:right; font-weight:700;">₹${totalAmount.toFixed(2)}</td>
      </tr>
    `;
  }

  const patientName = plan.patientName || 'Patient';
  const cleanPhone = (plan.patientPhone || '').replace(/\D/g, '').slice(-10);
  const transactionId = plan.paymentId || 'TXN_NUT_' + Math.random().toString(36).substring(2, 10).toUpperCase();

  let paidAtStr = 'N/A';
  if (plan.paymentCollectedAt) {
    paidAtStr = new Date(plan.paymentCollectedAt).toLocaleString('en-GB');
  } else {
    paidAtStr = new Date().toLocaleString('en-GB');
  }

  const rawDoctorName = plan.doctorName || plan.doctor || 'Consultant';
  let cleanedDoc = rawDoctorName.trim();
  if (cleanedDoc.toLowerCase().startsWith('dr.')) {
    cleanedDoc = cleanedDoc.substring(3).trim();
  } else if (cleanedDoc.toLowerCase().startsWith('dr')) {
    cleanedDoc = cleanedDoc.substring(2).trim();
  }
  const doctorName = cleanedDoc;
  const branchName = plan.branchName || 'Clinic Branch';
  const startDate = plan.startDate || 'N/A';
  const expiryDate = plan.expiryDate || 'N/A';

  const methodLabel = plan.paymentMethod === 'split' ? 'Split Payment' : (plan.paymentMethod || 'cash').toUpperCase();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Nutrition Service Receipt - ${patientName}</title>
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
      border-bottom: 2px solid #298FCA;
    }
    .logo-box {
      background-color: transparent;
      padding: 5px 0;
      border-radius: 6px;
      display: inline-block;
    }
    .logo-box img {
      height: 60px;
      display: block;
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
        <img src="data:image/png;base64,${APP_ICON_BASE64}" alt="SPIRITUAL HOMEOPATHY" style="height: 70px; width: auto; max-height: 70px; display: block;" />
      </div>
      <div class="header-right">
        <span>WWW.SPIRITUALHOMEOCLINIC.COM</span>
      </div>
    </div>
    <div class="body">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #1e293b; text-transform: uppercase;">Nutrition Receipt</h2>
        <div style="font-size: 9px; font-weight: 800; background: rgba(41,143,202,0.08); color: #298FCA; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; border: 1px solid rgba(41,143,202,0.15);">RECEIPT</div>
      </div>
      
      <div class="section-title">Patient Details</div>
      <div class="info-grid">
        <div class="info-item"><label>Patient Name</label><span>${patientName}</span></div>
        <div class="info-item"><label>Phone Number</label><span>+91 ${cleanPhone || 'N/A'}</span></div>
        <div class="info-item"><label>Consultant Doctor</label><span>Dr. ${doctorName}</span></div>
        <div class="info-item"><label>Clinic Branch</label><span>${branchName}</span></div>
        <div class="info-item"><label>Validity Period</label><span>30 Days (${startDate} to ${expiryDate})</span></div>
        <div class="info-item"><label>BMI / Age</label><span>${plan.bmi} / ${plan.age} yrs</span></div>
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
        <span>☎ 9069176176</span>
      </div>
      <div class="footer-col border-left">
        <span>✉ SPIRITUALHOMEO@GMAIL.COM</span>
      </div>
      <div class="footer-col border-left">
        <span>📍 ${branchName.toUpperCase()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const generatePrefilledDiet = (age, deficiencies = [], disorders = {}) => {
  const baseBreakfast = ["Vegetable Poha", "Oats Upma", "2 Veg Idli with Sambar", "Besan Chilla", "Vegetable Vermicelli"];
  const baseLunch = ["2 Multigrain Rotis, Mixed Veg Curry, Dal Tadka, Salad", "Brown Rice, Palak Dal, Curd, Cabbage Dry Curry", "2 Jowar Rotis, Bhindi Masala, Lentil soup", "Brown Rice, Rajma Curry, Cucumber Raita"];
  const baseSnack = ["Roasted Makhana", "Sprouts Salad", "Roasted Chana", "Handful of Almonds & Walnuts", "Buttermilk with Cumin"];
  const baseDinner = ["Moong Dal Khichdi & Curd", "Paneer Bhurji with 1 Roti", "Oats Khichdi with Veggies", "Vegetable Soup with Sautéed Paneer"];

  const deficiencyMeals = {
    "Iron": {
      breakfast: "Spinach Moong Dal Chilla",
      lunch: "Beetroot Curry, Palak Dal with 2 Rotis",
      snack: "Pomegranate Bowl & Roasted Chana",
      dinner: "Bajra Roti with Lentil Soup & Salad"
    },
    "Calcium": {
      breakfast: "Ragi Dosa with Paneer stuffing",
      lunch: "Paneer Tikka, Spinach Dal with Curd Rice",
      snack: "Til (Sesame) Chikki & Roasted Makhana",
      dinner: "Multigrain Roti with Paneer Bhurji & Curd"
    },
    "Vitamin D": {
      breakfast: "Fortified Oats Porridge with Almond Milk",
      lunch: "Mushroom Matar curry with Brown Rice & Yogurt",
      snack: "Boiled Egg whites or Roasted Almonds",
      dinner: "Sautéed Mushroom Salad with Paneer pane"
    },
    "Vitamin C": {
      breakfast: "Sprouted Moong Chilla with Tomato Chutney",
      lunch: "Mixed Veg Sabzi (Capsicum & Lemon) with Rotis",
      snack: "Orange/Guava fruit bowl with Chia seeds",
      dinner: "Tomato Soup & Sautéed Paneer with bell peppers"
    }
  };

  const meals = [];
  for (let day = 1; day <= 30; day++) {
    const idxB = (day - 1) % baseBreakfast.length;
    const idxL = (day - 1) % baseLunch.length;
    const idxS = (day - 1) % baseSnack.length;
    const idxD = (day - 1) % baseDinner.length;

    let b = baseBreakfast[idxB];
    let l = baseLunch[idxL];
    let s = baseSnack[idxS];
    let d = baseDinner[idxD];

    const activeDef = deficiencies.find(def => deficiencyMeals[def]);
    if (activeDef) {
      const overrides = deficiencyMeals[activeDef];
      if (day % 2 === 1) {
        b = overrides.breakfast;
        l = overrides.lunch;
        s = overrides.snack;
        d = overrides.dinner;
      }
    }

    if (disorders.sugar) {
      b = b.replace(/Idli/i, "Ragi Idli").replace(/Poha/i, "Methi Poha").replace(/Upma/i, "Millet Upma");
      l = l.replace(/Brown Rice/i, "Millet Khichdi").replace(/Rotis/i, "Missi Rotis (Chana flour)");
      s = s.replace(/Chikki/i, "Roasted Walnuts");
      d = d.replace(/Khichdi/i, "Millet Khichdi").replace(/Roti/i, "Missi Roti");
    }

    if (disorders.bp) {
      b = b + " (Low Sodium)";
      l = l + " (No added salt)";
      s = s + " (Unsalted)";
      d = d + " (Low Sodium)";
    }

    if (disorders.thyroid) {
      l = l.replace(/Cabbage/i, "Lauki").replace(/Soya/i, "Paneer");
    }

    if (age < 12) {
      b = b + " (Kids Portion)";
      l = l + " (Mild spices)";
    } else if (age > 60) {
      b = b + " (Soft texture)";
      l = l + " (Easy to digest)";
      d = d + " (Light dinner)";
    }

    meals.push({
      dayNumber: day,
      breakfast: b,
      lunch: l,
      snacks: s,
      dinner: d
    });
  }

  return meals;
};

const getEatAvoidRules = (deficiencies = [], disorders = []) => {
  let avoid = [];
  let eat = [];

  if (disorders.includes("Sugar (Diabetes)")) {
    avoid.push("Sugar, Sweets, Jaggery, Honey, Fruit juices, Maida, White rice, Potatoes.");
    eat.push("Millets, Brown rice, Oats, High fiber vegetables, Bitter gourd, Fenugreek.");
  }
  if (disorders.includes("High BP (Hypertension)")) {
    avoid.push("Excess salt, Pickles, Papads, Processed foods, Canned soups, Salty snacks.");
    eat.push("Bananas, Spinach, Beetroot, Citrus fruits, Garlic, Potassium-rich foods.");
  }
  if (disorders.includes("Thyroid")) {
    avoid.push("Cabbage, Cauliflower, Broccoli, Soy products, Processed meats.");
    eat.push("Brazil nuts, Seaweed, Eggs, Fish, Dairy products, Lean proteins.");
  }
  if (disorders.includes("Gastritis") || disorders.includes("Acidity")) {
    avoid.push("Spicy foods, Citrus fruits, Coffee, Alcohol, Fried foods.");
    eat.push("Oatmeal, Ginger, Aloe vera, Melons, Lean meats, Herbal teas.");
  }
  if (disorders.includes("IBS / IBD") || disorders.includes("Bloating")) {
    avoid.push("Beans, Onions, Garlic, Dairy, Gluten, High-FODMAP foods.");
    eat.push("Lactose-free dairy, Quinoa, Zucchini, Spinach, Blueberries.");
  }
  if (disorders.includes("SIBO")) {
    avoid.push("Sugar, Dairy, Grains, Starchy vegetables, Legumes.");
    eat.push("Meat, Fish, Eggs, Leafy greens, Non-starchy vegetables.");
  }
  if (disorders.includes("Piles")) {
    avoid.push("Spicy foods, Processed meats, Cheese, White flour, Fried foods.");
    eat.push("High fiber foods, Beans, Lentils, Whole grains, Broccoli, Apples, Water.");
  }
  if (disorders.includes("PCOD") || disorders.includes("Insulin Resistance")) {
    avoid.push("Refined carbs, Sugary drinks, Processed meats, Solid fats.");
    eat.push("High-fiber veggies, Lean proteins, Anti-inflammatory foods, Berries.");
  }
  if (disorders.includes("Hairfall")) {
    eat.push("Eggs, Berries, Spinach, Fatty fish, Sweet potatoes, Avocados, Nuts.");
  }
  if (disorders.includes("Melasma")) {
    avoid.push("Excess sugar, Processed foods, Dairy (if sensitive).");
    eat.push("Vitamin C foods, Citrus, Berries, Leafy greens, Antioxidants.");
  }
  if (disorders.includes("Weight Gain")) {
    eat.push("Nuts, Avocados, Whole grains, Protein-rich foods, Healthy fats, Dairy.");
  }
  if (disorders.includes("Weight Loss")) {
    avoid.push("Sugary drinks, Pastries, Fried foods, White bread.");
    eat.push("Leafy greens, Salmon, Cruciferous veggies, Lean beef, Chicken breast.");
  }
  if (disorders.includes("Height Growth")) {
    eat.push("Milk, Yogurt, Beans, Chicken, Almonds, Leafy greens, Sweet potatoes.");
  }
  if (disorders.includes("Adenoids / Tonsillitis")) {
    avoid.push("Cold foods, Dairy (if it thickens mucus), Crunchy/hard foods.");
    eat.push("Warm broths, Mashed potatoes, Soft fruits, Honey, Ginger tea.");
  }
  if (disorders.includes("Allergies")) {
    avoid.push("Known allergens, Processed foods with preservatives.");
    eat.push("Anti-inflammatory foods, Turmeric, Ginger, Citrus, Berries.");
  }

  if (deficiencies.includes("Iron")) {
    eat.push("Spinach, Liver, Red meat, Legumes, Pumpkin seeds, Quinoa.");
  }
  if (deficiencies.includes("Calcium")) {
    eat.push("Milk, Cheese, Yogurt, Sardines, Almonds, Leafy greens.");
  }
  if (deficiencies.includes("Vitamin D")) {
    eat.push("Fatty fish, Egg yolks, Fortified foods, Mushrooms.");
  }
  if (deficiencies.includes("Vitamin C")) {
    eat.push("Citrus fruits, Bell peppers, Strawberries, Tomatoes, Broccoli.");
  }
  if (deficiencies.includes("Vitamin A")) {
    eat.push("Carrots, Sweet potatoes, Spinach, Liver, Cantaloupe.");
  }
  if (deficiencies.includes("Vitamin B")) {
    eat.push("Whole grains, Meat, Eggs, Legumes, Seeds, Nuts.");
  }
  if (deficiencies.includes("Vitamin E")) {
    eat.push("Sunflower seeds, Almonds, Spinach, Avocados, Squash.");
  }
  if (deficiencies.includes("Vitamin K")) {
    eat.push("Kale, Spinach, Broccoli, Brussels sprouts, Cabbage.");
  }
  if (deficiencies.includes("Potassium")) {
    eat.push("Bananas, Oranges, Cantaloupe, Honeydew, Apricots, Grapefruit.");
  }
  if (deficiencies.includes("Magnesium")) {
    eat.push("Dark chocolate, Avocados, Nuts, Legumes, Tofu, Seeds.");
  }
  if (deficiencies.includes("Zinc")) {
    eat.push("Meat, Shellfish, Legumes, Seeds, Nuts, Dairy, Eggs.");
  }
  if (deficiencies.includes("Sodium")) {
    eat.push("Salt, Celery, Beets, Milk, Natural cheeses.");
  }
  if (deficiencies.includes("Protein")) {
    eat.push("Chicken, Eggs, Lentils, Greek yogurt, Almonds, Quinoa, Paneer.");
  }
  if (deficiencies.includes("Manganese")) {
    eat.push("Nuts, Beans, Legumes, Oatmeal, Whole wheat, Spinach.");
  }
  if (deficiencies.includes("Phosphorus")) {
    eat.push("Chicken, Turkey, Pork, Seafood, Seeds, Nuts.");
  }

  return {
    avoid: avoid.join("\n"),
    eat: eat.join("\n")
  };
};

import { getStandardBranchName } from '../../utils/idGenerator';

const getCanonicalBranchName = (name) => {
  return getStandardBranchName(name);
};

const normalizeBranch = (branch) => {
  return getStandardBranchName(branch).toLowerCase();
};

const getDisplayBranchHelper = (userData, item) => {
  const knownBranches = ['Kphb', 'Madhapur', 'Chandanagar', 'Kukatpally', 'Dilshuknagar', 'Nallagandla'];

  const itemBranch = getCanonicalBranchName(item.branchName || item.branchId);
  if (knownBranches.includes(itemBranch)) {
    return itemBranch;
  }

  if (userData) {
    const userBranchName = getCanonicalBranchName(userData.branchName);
    if (knownBranches.includes(userBranchName)) return userBranchName;
    const userBranchId = getCanonicalBranchName(userData.branchId);
    if (knownBranches.includes(userBranchId)) return userBranchId;
  }
  return itemBranch || 'N/A';
};

const formatFollowUpDateDisplay = (dateRaw) => {
  if (!dateRaw) return '';
  if (typeof dateRaw === 'string') {
    const cleanStr = dateRaw.trim().split('T')[0];
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD-MM-YYYY
        return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY or DD/MM/YYYY -> DD-MM-YYYY
        return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
    }
  }
  const d = new Date(dateRaw);
  if (isNaN(d.getTime())) return String(dateRaw);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const PatientDetails = ({ route, navigation }) => {
  const { patientId } = route.params;
  const { userData } = useAuth();

  const [patient, setPatient] = useState(null);
  const isPaidOrInDuration = patient?.paymentStatus === 'paid' || patient?.isInDuration || (patient?.followUpDate ? checkIsInDuration(patient.followUpDate) : false);
  const isConsultFinished = patient?.status === 'completed' || patient?.status === 'done' || patient?.status === 'consulted' || String(patient?.doctorStatus || '').toLowerCase() === 'prescribed';
  const isCompleted = isConsultFinished && isPaidOrInDuration;
  const canAccessClinical = userData?.role === 'doctor' || (userData?.role !== 'doctor' && patient?.status === 'in-consultation');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Lightbox States
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const lightboxScrollRef = React.useRef(null);
  const SCREEN_W = Dimensions.get('window').width;
  const [feeAmount, setFeeAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, upi, card

  // Digital Prescription Form States
  const [diagnosisNotes, setDiagnosisNotes] = useState('');
  const [prescriptionDuration, setPrescriptionDuration] = useState('');
  const [hideMedicines, setHideMedicines] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [openTypeMenuIndex, setOpenTypeMenuIndex] = useState(null);
  const [openTimingMenuIndex, setOpenTimingMenuIndex] = useState(null);
  const [openDurationMenuIndex, setOpenDurationMenuIndex] = useState(null);
  const [followUpInterval, setFollowUpInterval] = useState('No Follow-up');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [medicalHistoryText, setMedicalHistoryText] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [diagnosisMode, setDiagnosisMode] = useState('type'); // 'type' or 'draw'
  const [drawingBase64, setDrawingBase64] = useState(null);
  const [showMedicines, setShowMedicines] = useState(true);
  const [canvasFullScreen, setCanvasFullScreen] = useState(false);
  const [fullscreenInitialUrl, setFullscreenInitialUrl] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [followUpMenuVisible, setFollowUpMenuVisible] = useState(false);

  // Package Management States
  const [packageMembership, setPackageMembership] = useState(null);
  const [checkingPackage, setCheckingPackage] = useState(false);
  const [packagePaidInput, setPackagePaidInput] = useState('');
  const [packagePaymentMethod, setPackagePaymentMethod] = useState('cash');

  // Add package modal states (for doctors)
  const [addPackageModalVisible, setAddPackageModalVisible] = useState(false);
  const [newPkgName, setNewPkgName] = useState('Standard Homeopathy Package');
  const [newPkgTotal, setNewPkgTotal] = useState('');
  const [newPkgPaid, setNewPkgPaid] = useState('0');
  const [newPkgStartDate, setNewPkgStartDate] = useState(new Date());
  const [newPkgEndDate, setNewPkgEndDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 3)));
  const [showNewPkgStartPicker, setShowNewPkgStartPicker] = useState(false);
  const [showNewPkgEndPicker, setShowNewPkgEndPicker] = useState(false);

  // Nutrition & 30-Day Diet Plan States
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [showNutritionEditor, setShowNutritionEditor] = useState(false);
  const [nutriAge, setNutriAge] = useState('');
  const [nutriHeight, setNutriHeight] = useState('');
  const [nutriWeight, setNutriWeight] = useState('');
  const [nutriBmi, setNutriBmi] = useState('0');
  const [nutriDeficiencies, setNutriDeficiencies] = useState([]);
  const [deficiencyMenuVisible, setDeficiencyMenuVisible] = useState(false);
  const [nutriDisorders, setNutriDisorders] = useState([]);
  const [nutriOtherDiseases, setNutriOtherDiseases] = useState('');
  const [nutriSymptoms, setNutriSymptoms] = useState('');
  const [nutriAvoid, setNutriAvoid] = useState('');
  const [nutriEat, setNutriEat] = useState('');
  const [nutriAmount, setNutriAmount] = useState('');
  const [nutriMeals, setNutriMeals] = useState([]);
  const [submittingNutrition, setSubmittingNutrition] = useState(false);

  // Receptionist nutrition billing states
  const [nutritionPaymentMethod, setNutritionPaymentMethod] = useState('cash');
  const [nutriSplitMethod1, setNutriSplitMethod1] = useState('cash');
  const [nutriSplitAmount1, setNutriSplitAmount1] = useState('');
  const [nutriSplitMethod2, setNutriSplitMethod2] = useState('upi');
  const [nutriSplitAmount2, setNutriSplitAmount2] = useState('');

  // Nutrition HR Request States
  const [showNutriDiscountModal, setShowNutriDiscountModal] = useState(false);
  const [nutriDiscountReqAmount, setNutriDiscountReqAmount] = useState('');
  const [nutriDiscountNote, setNutriDiscountNote] = useState('');

  // Medicine Fee
  const [medicineFeeRequested, setMedicineFeeRequested] = useState('');
  const [medicineFeeMethod, setMedicineFeeMethod] = useState('cash'); // cash, phonepe, card, split
  const [showMedDiscountModal, setShowMedDiscountModal] = useState(false);
  const [medDiscountReqAmount, setMedDiscountReqAmount] = useState('');
  const [medDiscountNote, setMedDiscountNote] = useState('');
  const [splitMethod1, setSplitMethod1] = useState('cash');
  const [splitAmount1, setSplitAmount1] = useState('');
  const [splitMethod2, setSplitMethod2] = useState('phonepe');
  const [splitAmount2, setSplitAmount2] = useState('');

  // Shared Media & Education States
  const [sharedItems, setSharedItems] = useState([]);
  const [patientFolders, setPatientFolders] = useState([]);
  const [globalFolders, setGlobalFolders] = useState([]);
  const [globalItems, setGlobalItems] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [expandedGlobalFolders, setExpandedGlobalFolders] = useState({});
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [privateFolderName, setPrivateFolderName] = useState('');
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [expandedSharedFolder, setExpandedSharedFolder] = useState(null);
  const [folderItems, setFolderItems] = useState({}); // Cache of folder items: { folderId: [items] }

  const handleShareConsultationReceiptPDF = async () => {
    if (!patient) return;
    let html = '';
    try {
      html = generateConsultationReceiptHtml({
        ...patient,
        paymentAmount: patient.paymentAmount || customAmount || 0,
        paymentMethod: patient.paymentMethod || paymentMethod || 'cash'
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Copy to cache directory root to allow Android sharing permissions
      const patientName = patient.fullName || 'Patient';
      const cleanPatientName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const shareableUri = FileSystem.cacheDirectory + `ConsultationReceipt_${cleanPatientName}.pdf`;
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
          console.warn('[PatientDetails] Print fallback failed for consultation receipt, falling back to WhatsApp:', printErr);
        }
        handleShareConsultationReceiptWhatsApp();
        return;
      }
      console.error('PDF error:', err);
      const phone = patient.phone || '';
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        Alert.alert(
          'Sharing Limit',
          'Your device does not support direct PDF sharing. Prefilled text receipt will be shared via WhatsApp instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open WhatsApp',
              onPress: () => handleShareConsultationReceiptWhatsApp()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not generate or share receipt PDF. Please try again.');
      }
    }
  };

  const handleShareConsultationReceiptWhatsApp = () => {
    if (!patient) return;
    let phone = patient.phone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'No valid 10-digit phone number found for this patient.');
      return;
    }

    const patientName = patient.fullName || 'Patient';
    const doctorName = patient.doctor || 'General Doctor';
    const apptDate = patient.appointmentDate || patient.dateString || new Date().toLocaleDateString('en-GB');
    const timeSlot = patient.appointmentTime || patient.timeSlot || 'N/A';

    const splitSum = patient.paymentSplitDetails ? (Number(patient.paymentSplitDetails.cash || 0) + Number(patient.paymentSplitDetails.upi || 0)) : 0;
    const items = patient.itemsPaid || null;
    const itemsSum = items ? (Number(items.consultation || 0) + Number(items.medicine || 0) + Number(items.dietPlan || 0) + Number(items.package || 0)) : 0;
    const splitCounterUpi = (Number(patient.splitCounterAmount || 0) + Number(patient.splitUpiAmount || 0));
    let amountPaid = Math.max(Number(patient.paymentAmount || patient.amountPaid || patient.amount || customAmount || 0), splitSum, itemsSum, splitCounterUpi);

    const payMethod = (patient.paymentMethod || paymentMethod || 'cash').toUpperCase();
    const txnId = patient.paymentId || 'N/A';
    const branchName = patient.branchName || userData?.branchName || 'Clinic';

    const message = `*SPIRITUAL HOMEOPATHY - PAYMENT RECEIPT*

Dear *${patientName}*,

Your payment has been successfully received. Thank you!

*Receipt Details:*
• *Patient Name:* ${patientName}
• *Phone:* +91 ${cleanPhone}
• *Doctor:* Dr. ${doctorName}
• *Branch:* ${branchName}
• *Appointment:* ${apptDate} (${timeSlot})
• *Total Fee:* ₹${amountPaid}
• *Payment Method:* ${payMethod}
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

  const handleShareMedicineReceiptPDF = async () => {
    if (!patient) return;
    let html = '';
    try {
      html = generateMedicineReceiptHtml(patient);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Copy to cache directory root to allow Android sharing permissions
      const patientName = patient.fullName || 'Patient';
      const cleanPatientName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const shareableUri = FileSystem.cacheDirectory + `MedicineReceipt_${cleanPatientName}.pdf`;
      await FileSystem.copyAsync({
        from: uri,
        to: shareableUri
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareableUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Pharmacy Receipt – ${patientName}`,
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
          console.warn('[PatientDetails] Print fallback failed for medicine receipt, falling back to WhatsApp:', printErr);
        }
        handleShareMedicineReceiptWhatsApp();
        return;
      }
      console.error('PDF error:', err);
      const phone = patient.phone || '';
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        Alert.alert(
          'Sharing Limit',
          'Your device does not support direct PDF sharing. Prefilled text receipt will be shared via WhatsApp instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open WhatsApp',
              onPress: () => handleShareMedicineReceiptWhatsApp()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not generate or share medicine receipt PDF. Please try again.');
      }
    }
  };

  const handleShareMedicineReceiptWhatsApp = () => {
    if (!patient) return;
    let phone = patient.phone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'No valid 10-digit phone number found for this patient.');
      return;
    }

    const patientName = patient.fullName || 'Patient';
    const doctorName = patient.doctor || 'General Doctor';
    const branchName = patient.branchName || userData?.branchName || 'Clinic';
    const amountPaid = patient.medicineFeeRequested || 0;
    const payMethod = (patient.medicineFeeMethod || 'cash').toUpperCase();
    const txnId = patient.medicineFeeId || 'N/A';

    const message = `*SPIRITUAL HOMEOPATHY - PHARMACY RECEIPT*

Dear *${patientName}*,

Your payment for medicines has been successfully received. Thank you!

*Receipt Details:*
• *Patient Name:* ${patientName}
• *Phone:* +91 ${cleanPhone}
• *Prescribed By:* Dr. ${doctorName}
• *Branch:* ${branchName}
• *Total Paid:* ₹${amountPaid}
• *Payment Method:* ${payMethod}
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

  useEffect(() => {
    const fetchGlobalAndDoctorSettings = async () => {
      try {
        let activeFee = '';

        // 1. Check if patient has a doctor selected
        const docName = patient?.doctor || '';
        if (docName) {
          const cleanDocName = docName.replace('Dr. ', '').trim();
          const docWithPrefix = docName.startsWith('Dr. ') ? docName : `Dr. ${docName}`;

          const q = query(
            collection(db, 'users'),
            where('role', '==', 'doctor'),
            where('name', 'in', [docWithPrefix, cleanDocName, docName])
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0].data();
            if (docData.consultationFee !== undefined && docData.consultationFee !== null) {
              activeFee = Number(docData.consultationFee);
              setFeeAmount(activeFee);
              if (!patient?.paymentAmount) {
                setCustomAmount(String(activeFee));
              }
              return;
            }
          }
        }

        // 2. Fallback to global setting
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().consultationFee) {
          activeFee = Number(settingsSnap.data().consultationFee);
        }

        setFeeAmount(Number(activeFee) || 0);
        if (!patient?.paymentAmount) {
          setCustomAmount(activeFee !== '' ? String(activeFee) : '');
        }
      } catch (e) {
        console.error("Error loading settings:", e);
      }
    };
    fetchGlobalAndDoctorSettings();
  }, [patient?.paymentAmount, patient?.doctor]);

  useEffect(() => {
    const ageVal = parseInt(nutriAge, 10) || 30;
    const prefilled = generatePrefilledDiet(ageVal, nutriDeficiencies, nutriDisorders);
    setNutriMeals(prefilled);
  }, [nutriAge, nutriDeficiencies, nutriDisorders]);

  useEffect(() => {
    const h = parseFloat(nutriHeight) / 100;
    const w = parseFloat(nutriWeight);
    if (h > 0 && w > 0) {
      setNutriBmi((w / (h * h)).toFixed(1));
    } else {
      setNutriBmi('0');
    }
  }, [nutriHeight, nutriWeight]);

  useEffect(() => {
    const rules = getEatAvoidRules(nutriDeficiencies, nutriDisorders);
    setNutriAvoid(rules.avoid);
    setNutriEat(rules.eat);
  }, [nutriDisorders, nutriDeficiencies]);

  const handleMealCellChange = (dayNum, field, val) => {
    setNutriMeals(prev => prev.map(m => m.dayNumber === dayNum ? { ...m, [field]: val } : m));
  };

  const handleLoadNutritionPlanForEdit = (plan) => {
    setNutriAge(String(plan.age || ''));
    setNutriHeight(String(plan.height || ''));
    setNutriWeight(String(plan.weight || ''));
    setNutriBmi(String(plan.bmi || '0'));
    setNutriDeficiencies(plan.deficiencies || []);
    setNutriDisorders(plan.disorders || []);
    setNutriOtherDiseases(plan.diseases || '');
    setNutriSymptoms(plan.symptoms || '');
    setNutriAvoid(plan.foodsToAvoid || '');
    setNutriEat(plan.foodsToEat || '');
    setNutriAmount(String(plan.amount || ''));
    setNutriMeals(plan.meals || []);
    setShowNutritionEditor(true);
  };

  const handleResetNutritionForm = () => {
    setNutriAge('');
    setNutriHeight('');
    setNutriWeight('');
    setNutriBmi('0');
    setNutriDeficiencies([]);
    setNutriDisorders([]);
    setNutriOtherDiseases('');
    setNutriSymptoms('');
    setNutriAvoid('');
    setNutriEat('');
    setNutriAmount('');
    setNutriMeals([]);
    setShowNutritionEditor(false);
  };

  const handleSaveNutritionPlan = async () => {
    if (!nutriAge || !nutriHeight || !nutriWeight || !nutriAmount) {
      Alert.alert('Error', 'Please fill in Age, Height, Weight, and Amount.');
      return;
    }
    setSubmittingNutrition(true);
    try {
      const startStr = new Date().toISOString().split('T')[0];
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      const expiryStr = expiry.toISOString().split('T')[0];

      const planData = {
        patientId: patientId,
        patientName: patient?.fullName || 'Patient',
        patientPhone: patient?.phone || '',
        age: Number(nutriAge),
        height: Number(nutriHeight),
        weight: Number(nutriWeight),
        bmi: Number(nutriBmi),
        deficiencies: nutriDeficiencies,
        disorders: nutriDisorders,
        diseases: nutriOtherDiseases,
        symptoms: nutriSymptoms,
        foodsToAvoid: nutriAvoid,
        foodsToEat: nutriEat,
        amount: Number(nutriAmount),
        startDate: startStr,
        expiryDate: expiryStr,
        doctorId: auth.currentUser?.uid || 'doctor',
        doctorName: userData?.name || 'Doctor',
        branchId: patient?.branchId || userData?.branchId || 'KPHB',
        branchName: patient?.branchName || userData?.branchName || 'KPHB Branch',
        meals: nutriMeals,
        updatedAt: serverTimestamp()
      };

      if (nutritionPlan && nutritionPlan.paymentStatus === 'pending') {
        const planRef = doc(db, 'nutrition_plans', nutritionPlan.id);
        await updateDoc(planRef, planData);
        Alert.alert('Success', 'Nutrition plan updated successfully.');
      } else {
        planData.createdAt = serverTimestamp();
        planData.paymentStatus = 'pending';
        await addDoc(collection(db, 'nutrition_plans'), planData);

        // Send notification to patient
        await addDoc(collection(db, 'notifications'), {
          userId: patientId,
          title: '🥦 30-Day Nutrition Plan Issued!',
          body: `Dr. ${userData?.name || 'Physician'} has created a custom 30-day diet plan for you. Complete the payment of ₹${nutriAmount} at the reception to unlock the plan.`,
          type: 'payment_requested',
          isRead: false,
          createdAt: serverTimestamp()
        });

        const tokens = [];
        if (patient?.expoPushToken) tokens.push(patient.expoPushToken);
        if (Array.isArray(patient?.expoPushTokens)) {
          patient.expoPushTokens.forEach(t => {
            if (t && !tokens.includes(t)) tokens.push(t);
          });
        }

        if (tokens.length > 0) {
          try {
            const messages = tokens.map(t => ({
              to: t,
              sound: 'default',
              title: '🥦 30-Day Nutrition Plan Issued!',
              body: `Dr. ${userData?.name || 'Physician'} has created a custom 30-day diet plan for you. Complete the payment of ₹${nutriAmount} at the reception to unlock.`,
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
          } catch (pushErr) {
            console.error("Error sending push notification for diet plan:", pushErr);
          }
        }
      }

      handleResetNutritionForm();
      fetchPatientDetails();
    } catch (err) {
      console.error('Error saving nutrition plan:', err);
      Alert.alert('Error', 'Failed to save nutrition plan.');
    } finally {
      setSubmittingNutrition(false);
    }
  };

  const handleCollectNutritionFee = async (methodStr, splitDetails = null) => {
    setLoading(true);
    try {
      const planRef = doc(db, 'nutrition_plans', nutritionPlan.id);

      const updateData = {
        paymentStatus: 'paid',
        paymentMethod: methodStr,
        paymentCollectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentId: 'TXN_NUT_' + Math.random().toString(36).substring(2, 10).toUpperCase()
      };

      if (splitDetails) {
        updateData.paymentSplitDetails = splitDetails;
      }

      await updateDoc(planRef, updateData);

      // Record to transactions collection
      const txnData = {
        type: 'nutrition',
        patientId: patientId,
        patientName: patient?.fullName || 'Patient',
        regId: patient?.registrationId || patient?.regId || patient?.regID || '',
        registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
        phone: patient?.phone || patient?.patientPhone || '',
        doctor: patient?.doctor || patient?.doctorName || '',
        amount: Number(nutritionPlan.amount),
        method: methodStr,
        branchId: patient?.branchId || userData?.branchId || 'Unknown',
        branchName: patient?.branchName || userData?.branchName || 'Unknown',
        recordedBy: userData?.name || 'Staff',
        timestamp: serverTimestamp()
      };
      if (splitDetails) {
        txnData.paymentSplitDetails = splitDetails;
      }
      await addDoc(collection(db, 'alltransactions'), txnData);

      // Notify the patient app to unlock the plan
      await addDoc(collection(db, 'notifications'), {
        userId: patientId,
        title: '🥦 Nutrition Plan Unlocked!',
        body: `Your payment of ₹${nutritionPlan.amount} was received. Tap the Diet tab to view your custom 30-day plan!`,
        type: 'payment_received',
        isRead: false,
        createdAt: serverTimestamp()
      });

      const tokens = [];
      if (patient?.expoPushToken) tokens.push(patient.expoPushToken);
      if (Array.isArray(patient?.expoPushTokens)) {
        patient.expoPushTokens.forEach(t => {
          if (t && !tokens.includes(t)) tokens.push(t);
        });
      }

      if (tokens.length > 0) {
        try {
          const messages = tokens.map(t => ({
            to: t,
            sound: 'default',
            title: '🥦 Nutrition Plan Unlocked!',
            body: `Your payment of ₹${nutritionPlan.amount} was received. Your custom 30-day plan is now active!`,
            data: { type: 'payment_received' },
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
        } catch (pushErr) {
          console.error("Error sending push notification for diet unlock:", pushErr);
        }
      }

      Alert.alert('Success', 'Nutrition fee collected and logged!');
      fetchPatientDetails();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to collect nutrition fee.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareNutritionReceiptPDF = async () => {
    if (!nutritionPlan) return;
    let html = '';
    try {
      html = generateNutritionReceiptHtml(nutritionPlan);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Copy to cache directory root to allow Android sharing permissions
      const patientName = nutritionPlan.patientName || 'Patient';
      const cleanPatientName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
      const shareableUri = FileSystem.cacheDirectory + `NutritionReceipt_${cleanPatientName}.pdf`;
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
          console.warn('[PatientDetails] Print fallback failed for nutrition receipt, falling back to WhatsApp:', printErr);
        }
        handleShareNutritionReceiptWhatsApp();
        return;
      }
      console.error('PDF error:', err);
      const phone = nutritionPlan.patientPhone || '';
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        Alert.alert(
          'Sharing Limit',
          'Your device does not support direct PDF sharing. Prefilled text receipt will be shared via WhatsApp instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open WhatsApp',
              onPress: () => handleShareNutritionReceiptWhatsApp()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not generate or share receipt PDF. Please try again.');
      }
    }
  };

  const handleShareNutritionReceiptWhatsApp = () => {
    if (!nutritionPlan) return;
    let phone = nutritionPlan.patientPhone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'No valid 10-digit phone number found for this patient.');
      return;
    }

    const patientName = nutritionPlan.patientName || 'Patient';
    const doctorName = nutritionPlan.doctorName || 'General Doctor';
    const amountPaid = nutritionPlan.amount || 0;
    const payMethod = (nutritionPlan.paymentMethod || 'cash').toUpperCase();
    const txnId = nutritionPlan.paymentId || 'N/A';
    const branchName = nutritionPlan.branchName || userData?.branchName || 'Clinic';
    const validity = `30 Days (${nutritionPlan.startDate} to ${nutritionPlan.expiryDate})`;

    const message = `*SPIRITUAL HOMEOPATHY - NUTRITION PAYMENT RECEIPT*

Dear *${patientName}*,

Your payment for the 30-Day Nutrition Plan has been successfully received. Thank you!

*Receipt Details:*
• *Patient Name:* ${patientName}
• *Phone:* +91 ${cleanPhone}
• *Prescribed By:* Dr. ${doctorName}
• *Branch:* ${branchName}
• *Validity:* ${validity}
• *Total Paid:* ₹${amountPaid}
• *Payment Method:* ${payMethod}
• *Transaction ID:* ${txnId}
• *Payment Status:* PAID ✓

Your personalized 30-Day Diet Plan has been unlocked. Open the Patient App and tap on the 'Diet' tab to check today's meals!

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

  const handleShareNutritionDietWhatsApp = () => {
    if (!nutritionPlan) return;
    let phone = nutritionPlan.patientPhone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'No valid 10-digit phone number found for this patient.');
      return;
    }

    const patientName = nutritionPlan.patientName || 'Patient';
    const doctorName = nutritionPlan.doctorName || 'General Doctor';
    const deficiencies = nutritionPlan.deficiencies?.join(', ') || 'None';
    const avoid = nutritionPlan.foodsToAvoid || 'None specified.';
    const eat = nutritionPlan.foodsToEat || 'None specified.';

    // Construct a concise meal plan summary for the first 3 days
    let scheduleSummary = '';
    if (nutritionPlan.meals && nutritionPlan.meals.length > 0) {
      nutritionPlan.meals.slice(0, 3).forEach(m => {
        scheduleSummary += `*Day ${m.dayNumber}:*\n• Breakfast: ${m.breakfast}\n• Lunch: ${m.lunch}\n• Snacks: ${m.snacks}\n• Dinner: ${m.dinner}\n\n`;
      });
    }

    const message = `*SPIRITUAL HOMEOPATHY - CUSTOM DIET PLAN*

Dear *${patientName}*,

Dr. *${doctorName}* has prescribed a customized 30-day diet plan for you.

*Vitals & Physical Stats:*
• *Age:* ${nutritionPlan.age} yrs
• *Height:* ${nutritionPlan.height} cm
• *Weight:* ${nutritionPlan.weight} kg
• *BMI:* ${nutritionPlan.bmi}
• *Deficiencies:* ${deficiencies}

*Dietary Guidelines:*
❌ *Foods to Avoid:*
${avoid}

✔️ *Foods to Eat:*
${eat}

*Diet Schedule (First 3 Days Preview):*
${scheduleSummary}

*Note:* You can view your complete 30-Day Diet Schedule directly on your *Spiritual Homeopathy Patient App*. Download/Open the app to track your daily progress!

Wishing you good health!`;

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

  const handleMarkPaymentStatus = async (status) => {
    setLoading(true);
    try {
      const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, patientId);
      const amount = feeAmount;

      // Guard: prevent marking as PAID with ₹0 unless patient is in-duration (free revisit)
      if (status === 'paid') {
        const isInDur = patient?.isInDuration ||
          (patient?.followUpDate ? checkIsInDuration(patient.followUpDate) : false);
        if (!isInDur && (!amount || amount <= 0)) {
          Alert.alert(
            'No Fee Set',
            'Cannot mark as PAID — the consultation fee is ₹0. Please set a fee amount first.',
          );
          setLoading(false);
          return;
        }
      }

      const updateData = {
        paymentStatus: status,
        updatedAt: serverTimestamp()
      };

      if (status === 'paid') {
        updateData.paymentAmount = amount;
        updateData.paymentMethod = paymentMethod;
        updateData.paymentCollectedAt = new Date().toISOString();
        updateData.status = 'done';

        // Always sync allpatients document so reception queue reflects PAID and DONE
        try {
          await updateDoc(doc(db, 'allpatients', patientId), updateData);
        } catch (allPatErr) {
          console.warn("Could not sync payment status to allpatients doc:", allPatErr);
        }

        // 1. Log consultation payment to transactions collection
        await addDoc(collection(db, 'alltransactions'), {
          type: 'consultation',
          patientId: patientId,
          patientName: patient?.fullName || 'Online Patient',
          regId: patient?.registrationId || patient?.regId || patient?.regID || '',
          registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
          phone: patient?.phone || patient?.patientPhone || '',
          doctor: patient?.doctor || patient?.doctorName || '',
          amount: amount,
          method: paymentMethod,
          branchId: patient?.branchId || userData?.branchId || 'Unknown',
          branchName: patient?.branchName || userData?.branchName || 'Unknown',
          recordedBy: userData?.name || 'Staff',
          timestamp: serverTimestamp()
        });

        // 2. Award reward points ONLY if appointment is from Patient App (online booking)
        if (patient?._type === 'online') {
          const pointsEarned = Math.floor(amount / 100) * 2;
          if (pointsEarned > 0) {
            const cleanPhone = (patient.phone || '').replace(/\D/g, '').slice(-10);
            let patientUid = patient.patientId || null;
            let patientDocRef = null;

            if (patientUid && patientUid !== 'WALKIN_USER') {
              patientDocRef = doc(db, 'patients', patientUid);
            } else if (cleanPhone) {
              const qPatients = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
              const snapPatients = await getDocs(qPatients);
              if (!snapPatients.empty) {
                patientDocRef = doc(db, 'patients', snapPatients.docs[0].id);
                patientUid = snapPatients.docs[0].id;
              }
            }

            const patientNameVal = patient.fullName || 'Patient';

            if (patientDocRef) {
              await updateDoc(patientDocRef, {
                rewardPoints: increment(pointsEarned)
              });
            } else {
              // Create profile document if not exists
              const newPatientRef = await addDoc(collection(db, 'patients'), {
                fullName: patientNameVal,
                phone: cleanPhone,
                rewardPoints: pointsEarned,
                createdAt: new Date().toISOString()
              });
              patientUid = newPatientRef.id;
            }

            // Generate coupon code
            const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
            const generatedCouponCode = `SPH-${randomHex}`;
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

            // Log points transaction
            await addDoc(collection(db, 'reward_points_transactions'), {
              userId: patientUid,
              patientName: patientNameVal,
              type: 'earn',
              points: pointsEarned,
              description: `Earned ${pointsEarned} points for consultation fee payment of Dr. ${patient.doctor || 'Doctor'} (Paid at Reception)`,
              createdAt: serverTimestamp()
            });
          }
        }
      } else {
        updateData.paymentAmount = 0;
        updateData.paymentMethod = '';
        updateData.paymentCollectedAt = null;
      }

      // 1. Update allpatients document
      const allPatientsRef = doc(db, 'allpatients', patientId);
      await updateDoc(allPatientsRef, updateData);

      Alert.alert('Success', `Payment marked as ${status === 'paid' ? 'PAID' : 'UNPAID'}`);
      fetchPatientDetails();
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status');
      setLoading(false);
    }
  };

  // (Removed Doctor request amount edit since consultation fee is fully handled by reception)

  const handleCollectMedicineFee = async () => {
    setLoading(true);
    try {
      const amt = parseFloat(medicineFeeRequested) || 0;
      if (amt <= 0) {
        Alert.alert("Error", "No medicine fee requested.");
        setLoading(false);
        return;
      }

      const hasPresc =
        (patient?.prescriptionUrls && patient.prescriptionUrls.length > 0) ||
        !!patient?.prescriptionUrl ||
        !!patient?.diagnosisDrawingUrl;
      if (!hasPresc) {
        Alert.alert("Prescription Required", "Physical prescription upload is mandatory before collecting medicine fee. Please upload it first.");
        setLoading(false);
        return;
      }

      let split1Amt = 0;
      let split2Amt = 0;

      if (medicineFeeMethod === 'split') {
        split1Amt = parseFloat(splitAmount1) || 0;
        split2Amt = parseFloat(splitAmount2) || 0;
        if (split1Amt + split2Amt > amt) {
          Alert.alert("Error", `Split amounts (₹${split1Amt + split2Amt}) cannot exceed the requested amount (₹${amt}).`);
          setLoading(false);
          return;
        }
      }

      const updateData = {
        medicineFeeStatus: 'paid',
        medicineFeeMethod: medicineFeeMethod,
        medicineFeeCollectedAt: serverTimestamp(),
        paymentAmount: increment(amt),
        paymentStatus: 'paid',
        status: 'completed',
        updatedAt: serverTimestamp()
      };

      if (medicineFeeMethod === 'split') {
        updateData.medicineFeeSplitDetails = {
          [splitMethod1]: (updateData.medicineFeeSplitDetails?.[splitMethod1] || 0) + split1Amt,
          [splitMethod2]: (updateData.medicineFeeSplitDetails?.[splitMethod2] || 0) + split2Amt
        };
      }

      // 1. Update allpatients document
      const allPatientsRef = doc(db, 'allpatients', patientId);
      await updateDoc(allPatientsRef, updateData);

      // Log to transactions
      if (medicineFeeMethod === 'split') {
        if (split1Amt > 0) {
          await addDoc(collection(db, 'alltransactions'), {
            type: 'medicine',
            patientId: patientId,
            patientName: patient?.fullName || 'Online Patient',
            regId: patient?.registrationId || patient?.regId || patient?.regID || '',
            registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
            phone: patient?.phone || patient?.patientPhone || '',
            doctor: patient?.doctor || patient?.doctorName || '',
            amount: split1Amt,
            method: splitMethod1,
            branchId: patient?.branchId || userData?.branchId || 'Unknown',
            branchName: patient?.branchName || userData?.branchName || 'Unknown',
            recordedBy: userData?.name || 'Staff',
            timestamp: serverTimestamp()
          });
        }
        if (split2Amt > 0) {
          await addDoc(collection(db, 'alltransactions'), {
            type: 'medicine',
            patientId: patientId,
            patientName: patient?.fullName || 'Online Patient',
            regId: patient?.registrationId || patient?.regId || patient?.regID || '',
            registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
            phone: patient?.phone || patient?.patientPhone || '',
            doctor: patient?.doctor || patient?.doctorName || '',
            amount: split2Amt,
            method: splitMethod2,
            branchId: patient?.branchId || userData?.branchId || 'Unknown',
            branchName: patient?.branchName || userData?.branchName || 'Unknown',
            recordedBy: userData?.name || 'Staff',
            timestamp: serverTimestamp()
          });
        }
      } else {
        await addDoc(collection(db, 'alltransactions'), {
          type: 'medicine',
          patientId: patientId,
          patientName: patient?.fullName || 'Online Patient',
          regId: patient?.registrationId || patient?.regId || patient?.regID || '',
          registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
          phone: patient?.phone || patient?.patientPhone || '',
          doctor: patient?.doctor || patient?.doctorName || '',
          amount: amt,
          method: medicineFeeMethod,
          branchId: patient?.branchId || userData?.branchId || 'Unknown',
          branchName: patient?.branchName || userData?.branchName || 'Unknown',
          recordedBy: userData?.name || 'Staff',
          timestamp: serverTimestamp()
        });
      }

      Alert.alert('Success', 'Medicine fee collected and logged!');
      fetchPatientDetails();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to collect medicine fee.');
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchPatientDetails();
    setRefreshing(false);
  }, [patientId]);

  const fetchMedicalHistory = async (phone, currentDocId) => {
    if (!phone) return;
    setHistoryLoading(true);
    try {
      const history = [];
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);

      // 1. Query 'allpatients' by exact phone
      const qPatients = query(
        collection(db, 'allpatients'),
        where('phone', '==', phone),
        where('status', 'in', ['completed', 'done'])
      );
      const snapPatients = await getDocs(qPatients);
      snapPatients.forEach(docSnap => {
        if (docSnap.id !== currentDocId) {
          history.push({ id: docSnap.id, _collection: 'allpatients', ...docSnap.data() });
        }
      });

      // 2. Query 'patient_list' by exact phone
      const qAppts = query(
        collection(db, 'patient_list'),
        where('phone', '==', phone)
      );
      const snapAppts = await getDocs(qAppts);
      snapAppts.forEach(docSnap => {
        if (docSnap.id !== currentDocId && !history.some(h => h.id === docSnap.id)) {
          history.push({ id: docSnap.id, _collection: 'patient_list', ...docSnap.data() });
        }
      });

      // 3. Optional cleaned phone query to match formatted / unformatted clinic records
      if (cleanPhone && cleanPhone !== phone) {
        const qPatientsClean = query(
          collection(db, 'allpatients'),
          where('phone', '==', cleanPhone),
          where('status', 'in', ['completed', 'done'])
        );
        const snapPatientsClean = await getDocs(qPatientsClean);
        snapPatientsClean.forEach(docSnap => {
          if (docSnap.id !== currentDocId && !history.some(h => h.id === docSnap.id)) {
            history.push({ id: docSnap.id, _collection: 'allpatients', ...docSnap.data() });
          }
        });

        const qApptsClean = query(
          collection(db, 'patient_list'),
          where('phone', '==', cleanPhone)
        );
        const snapApptsClean = await getDocs(qApptsClean);
        snapApptsClean.forEach(docSnap => {
          if (docSnap.id !== currentDocId && !history.some(h => h.id === docSnap.id)) {
            history.push({ id: docSnap.id, _collection: 'patient_list', ...docSnap.data() });
          }
        });
      }

      const resolvedHistory = history.map(visit => {
        const displayBranch = getDisplayBranchHelper(userData, visit);
        return {
          ...visit,
          branchName: displayBranch,
          branchId: displayBranch
        };
      });

      const sortedHistory = resolvedHistory.sort((a, b) => {
        const timeA = (a.completedAt && typeof a.completedAt.toDate === 'function') ? a.completedAt.toDate() : (a.updatedAt ? new Date(a.updatedAt) : 0);
        const timeB = (b.completedAt && typeof b.completedAt.toDate === 'function') ? b.completedAt.toDate() : (b.updatedAt ? new Date(b.updatedAt) : 0);
        return timeB - timeA;
      });
      setMedicalHistory(sortedHistory);
    } catch (e) {
      console.error("Error fetching medical history:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchPatientDetails = async () => {
    setLoading(true);
    try {
      let data = null;
      let docSnap = null;
      let matchedType = 'walkin';

      // 1. Execute all 3 document queries in 1 single parallel round-trip (Instant <150ms Load)
      const [allSnap, patSnap, apptSnap] = await Promise.all([
        getDoc(doc(db, 'allpatients', patientId)).catch(() => null),
        getDoc(doc(db, 'patients', patientId)).catch(() => null),
        getDoc(doc(db, 'appointments', patientId)).catch(() => null)
      ]);

      if (allSnap && allSnap.exists && allSnap.exists()) {
        docSnap = allSnap;
        data = { ...allSnap.data(), firestoreCollection: 'allpatients' };
        matchedType = 'unified_appointment';
      } else if (patSnap && patSnap.exists && patSnap.exists()) {
        docSnap = patSnap;
        data = { ...patSnap.data(), firestoreCollection: 'patients' };
        matchedType = 'walkin';
      } else if (apptSnap && apptSnap.exists && apptSnap.exists()) {
        docSnap = apptSnap;
        const apptData = apptSnap.data();

        let formattedDate = apptData.dateString || apptData.date || 'No Date';
        if (formattedDate.includes('-')) {
          const parts = formattedDate.split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        data = {
          id: apptSnap.id,
          firestoreCollection: 'appointments',
          _type: 'online',
          fullName: apptData.patientName || 'Online Patient',
          regId: 'ONLINE',
          phone: apptData.phone || 'N/A',
          email: apptData.email || '',
          appointmentDate: formattedDate,
          appointmentTime: apptData.timeSlot || 'N/A',
          doctor: apptData.doctorName ? (apptData.doctorName.startsWith('Dr.') ? apptData.doctorName : `Dr. ${apptData.doctorName}`) : 'General Doctor',
          status: apptData.status === 'pending' ? 'waiting' : (apptData.status || 'waiting'),
          createdAt: apptData.createdAt,
          complaint: apptData.subject || 'General Consultation',
          ...apptData
        };
        matchedType = 'online';
      }

      if (data) {
        const displayBranch = getDisplayBranchHelper(userData, data);
        data.branchName = displayBranch;
        data.branchId = displayBranch;

        if (data.paymentAmount) setCustomAmount(String(data.paymentAmount));
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);

        if (data.diagnosisNotes) setDiagnosisNotes(data.diagnosisNotes);
        if (data.prescriptionDuration) setPrescriptionDuration(data.prescriptionDuration);
        if (data.medicines) setMedicines(data.medicines);
        const isHidden = data.hideMedicines || data.itemsPaid?.hideMedicines || false;
        setHideMedicines(isHidden);
        if (data.followUpInterval) setFollowUpInterval(data.followUpInterval);
        if (data.medicalHistory) setMedicalHistoryText(data.medicalHistory);
        if (data.followUpDate) setFollowUpDate(data.followUpDate);
        if (data.medicineFeeRequested) setMedicineFeeRequested(String(data.medicineFeeRequested));
        if (data.medicineFeeMethod) setMedicineFeeMethod(data.medicineFeeMethod);

        setPatient({ id: docSnap.id, ...data, _type: matchedType, firestoreCollection: matchedType === 'walkin' ? 'patients' : (matchedType === 'unified_appointment' ? 'allpatients' : 'appointments') });
        setLoading(false);

        // 2. Non-blocking asynchronous background sub-fetches
        (async () => {
          try {
            const qNutri = query(
              collection(db, 'nutrition_plans'),
              where('patientId', '==', docSnap.id),
              limit(1)
            );
            const snapNutri = await getDocs(qNutri).catch(() => null);
            if (snapNutri && !snapNutri.empty) {
              const plans = [];
              snapNutri.forEach(ds => plans.push({ id: ds.id, ...ds.data() }));
              setNutritionPlan(plans[0]);
            }
          } catch (e) { }

          if (data.phone) {
            fetchMedicalHistory(data.phone, docSnap.id).catch(() => { });
            fetchPackageMembership(data.phone).catch(() => { });
          }
        })();

      } else {
        setLoading(false);
        Alert.alert('Error', 'Patient not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
      Alert.alert('Error', 'Failed to load patient details');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [patientId]);

  // ── Real-time payment status listener ───────────────────────────
  // Watches the allpatients doc for live payment changes so the badge
  // updates immediately even if payment was collected from PatientProfile.
  useEffect(() => {
    if (!patientId) return;
    const allPatientsRef = doc(db, 'allpatients', patientId);
    const unsub = onSnapshot(allPatientsRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        // Only patch payment-related fields to avoid overwriting local UI state
        setPatient(prev => prev ? {
          ...prev,
          paymentStatus: d.paymentStatus ?? prev.paymentStatus,
          paymentAmount: d.paymentAmount ?? prev.paymentAmount,
          paymentMethod: d.paymentMethod ?? prev.paymentMethod,
          paymentSplitDetails: d.paymentSplitDetails ?? prev.paymentSplitDetails,
          isInDuration: d.isInDuration ?? prev.isInDuration,
          followUpDate: d.followUpDate ?? prev.followUpDate,
          status: d.status ?? prev.status,
        } : prev);
      }
    }, (err) => {
      console.warn('Payment status listener error:', err);
    });
    return () => unsub();
  }, [patientId]);

  // ── SHARED MEDIA & EDUCATION LISTENERS ─────────────────────────

  // 1. Global Library Listener (Always fetches Global Media regardless of patient)
  useEffect(() => {
    const qFolders = query(collection(db, 'media_folders'), limit(200));
    const unsubGlobalFolders = onSnapshot(qFolders, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.patientPhone) {
          list.push({ id: d.id, ...data });
        }
      });
      setGlobalFolders(list);
    }, (err) => console.error("Error listening to global folders:", err));

    const qItems = query(collection(db, 'media_items'), limit(200));
    const unsubAllItems = onSnapshot(qItems, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setGlobalItems(list);
    }, (err) => console.error("Error listening to global items:", err));

    return () => {
      unsubGlobalFolders();
      unsubAllItems();
    };
  }, []);

  // 2. Patient-Specific Media Listener (Requires valid phone number)
  useEffect(() => {
    if (!patient?.phone) {
      setSharedItems([]);
      setPatientFolders([]);
      return;
    }
    const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setSharedItems([]);
      setPatientFolders([]);
      return;
    }

    // Listen for shared_media entries for this patient
    const qShared = query(
      collection(db, 'shared_media'),
      where('patientPhone', '==', cleanPhone)
    );
    const unsubShared = onSnapshot(qShared, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setSharedItems(list);
    }, (err) => console.error("Error listening to shared_media:", err));

    // Listen for patient-specific folders
    const qFolders = query(
      collection(db, 'media_folders'),
      where('patientPhone', '==', cleanPhone)
    );
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setPatientFolders(list);
    }, (err) => console.error("Error listening to patient_folders:", err));

    return () => {
      unsubShared();
      unsubFolders();
    };
  }, [patient?.phone]);

  // Listen for items inside the currently expanded folder
  useEffect(() => {
    if (!expandedSharedFolder) return;
    const q = query(
      collection(db, 'media_items'),
      where('folderId', '==', expandedSharedFolder)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setFolderItems(prev => ({ ...prev, [expandedSharedFolder]: list }));
    });
    return () => unsub();
  }, [expandedSharedFolder]);

  // Actions for Shared Media & Education
  const handleCreatePrivateFolder = async () => {
    if (!privateFolderName.trim() || !patient?.phone) return;
    const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
    try {
      const folderDoc = await addDoc(collection(db, 'media_folders'), {
        name: privateFolderName.trim(),
        patientPhone: cleanPhone,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'Receptionist'
      });
      // Automatically record in shared_media
      await addDoc(collection(db, 'shared_media'), {
        patientPhone: cleanPhone,
        type: 'folder',
        folderId: folderDoc.id,
        sharedAt: serverTimestamp()
      });
      setPrivateFolderName('');
      setShowCreateFolderModal(false);
      Alert.alert('Success', 'Private media folder created.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create folder.');
    }
  };

  const handleUploadPatientMedia = async (folderId) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to upload media.');
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8
      });
      if (result.canceled) return;

      setUploadingMedia(true);
      setUploadProgress('Preparing file...');
      const asset = result.assets[0];
      const mediaUri = asset.uri;
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      const fileExt = mediaUri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
      const fileName = `patient_${Date.now()}.${fileExt}`;
      const storagePath = `media_library/${folderId}/${fileName}`;

      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) { reject(new TypeError('File conversion failed')); };
        xhr.responseType = 'blob';
        xhr.open('GET', mediaUri, true);
        xhr.send(null);
      });

      setUploadProgress('Uploading to Storage...');
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, blob);

      setUploadProgress('Saving to database...');
      const downloadUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'media_items'), {
        folderId: folderId,
        title: asset.fileName || fileName,
        type: mediaType,
        url: downloadUrl,
        storagePath: storagePath,
        createdAt: serverTimestamp(),
        sharedWithApp: false
      });

      Alert.alert('Success', 'Media uploaded successfully.');
    } catch (err) {
      console.error(err);
      Alert.alert('Upload Failed', 'Failed to upload media.');
    } finally {
      setUploadingMedia(false);
      setUploadProgress('');
    }
  };

  const handleToggleItemShare = async (item) => {
    try {
      const nextVal = !item.sharedWithApp;
      await updateDoc(doc(db, 'media_items', item.id), {
        sharedWithApp: nextVal
      });
    } catch (err) {
      console.error("Error toggling item share:", err);
    }
  };

  const handleDeletePatientFolder = (folderId, isGlobalShared, folderName) => {
    if (isGlobalShared) {
      // Unshare global folder
      Alert.alert('Unshare Folder', `Are you sure you want to stop sharing "${folderName}" with this patient?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unshare',
          style: 'destructive',
          onPress: async () => {
            try {
              const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
              const q = query(
                collection(db, 'shared_media'),
                where('patientPhone', '==', cleanPhone),
                where('folderId', '==', folderId),
                where('type', '==', 'folder')
              );
              const snap = await getDocs(q);
              for (const d of snap.docs) {
                await deleteDoc(doc(db, 'shared_media', d.id));
              }
              Alert.alert('Success', 'Folder unshared.');
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]);
    } else {
      // Delete private folder completely
      Alert.alert('Delete Folder', `Are you sure you want to delete "${folderName}" and all of its private media files?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const qItems = query(collection(db, 'media_items'), where('folderId', '==', folderId));
              const snapItems = await getDocs(qItems);
              for (const docSnap of snapItems.docs) {
                const itemData = docSnap.data();
                if (itemData.storagePath) {
                  const fileRef = ref(storage, itemData.storagePath);
                  await deleteObject(fileRef).catch(e => console.warn(e));
                }
                await deleteDoc(doc(db, 'media_items', docSnap.id));
              }
              // Delete shared_media entries
              const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
              const qShared = query(
                collection(db, 'shared_media'),
                where('patientPhone', '==', cleanPhone),
                where('folderId', '==', folderId)
              );
              const snapShared = await getDocs(qShared);
              for (const d of snapShared.docs) {
                await deleteDoc(doc(db, 'shared_media', d.id));
              }
              await deleteDoc(doc(db, 'media_folders', folderId));
              Alert.alert('Success', 'Private folder deleted.');
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]);
    }
  };

  const handleDeletePatientItem = (item, isGlobalShared) => {
    if (isGlobalShared) {
      Alert.alert('Unshare Video', 'Are you sure you want to unshare this video?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unshare',
          style: 'destructive',
          onPress: async () => {
            try {
              const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
              const q = query(
                collection(db, 'shared_media'),
                where('patientPhone', '==', cleanPhone),
                where('itemId', '==', item.id)
              );
              const snap = await getDocs(q);
              for (const d of snap.docs) {
                await deleteDoc(doc(db, 'shared_media', d.id));
              }
              Alert.alert('Success', 'Video unshared.');
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]);
    } else {
      Alert.alert('Delete Video', 'Are you sure you want to delete this private media file?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.storagePath) {
                const fileRef = ref(storage, item.storagePath);
                await deleteObject(fileRef).catch(e => console.warn(e));
              }
              await deleteDoc(doc(db, 'media_items', item.id));
              Alert.alert('Success', 'Video deleted.');
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]);
    }
  };

  const handleShareGlobalMedia = async (type, targetId) => {
    if (!patient?.phone) return;
    const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
    try {
      // Check if already shared
      const q = query(
        collection(db, 'shared_media'),
        where('patientPhone', '==', cleanPhone),
        where(type === 'folder' ? 'folderId' : 'itemId', '==', targetId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return;
      }

      await addDoc(collection(db, 'shared_media'), {
        patientPhone: cleanPhone,
        type: type,
        ...(type === 'folder' ? { folderId: targetId } : { itemId: targetId }),
        sharedAt: serverTimestamp()
      });

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to share media.');
    }
  };

  const unshareGlobalMedia = async (type, targetId) => {
    if (!patient?.phone) return;
    const cleanPhone = (patient?.phone || '').replace(/\D/g, '').slice(-10);
    try {
      const q = query(
        collection(db, 'shared_media'),
        where('patientPhone', '==', cleanPhone),
        where(type === 'folder' ? 'folderId' : 'itemId', '==', targetId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'shared_media', d.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPackageMembership = async (phone) => {
    if (!phone) return;
    setCheckingPackage(true);
    try {
      const q = query(
        collection(db, 'package_members'),
        where('patientMobile', '==', phone)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        let matched = null;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const today = new Date().toISOString().split('T')[0];
          if (today >= data.startDate && today <= data.endDate) {
            matched = { id: docSnap.id, ...data };
          }
        });
        if (!matched) {
          const docs = [];
          snapshot.forEach(docSnap => docs.push({ id: docSnap.id, ...docSnap.data() }));
          matched = docs[0];
        }
        setPackageMembership(matched);
      } else {
        setPackageMembership(null);
      }
    } catch (e) {
      console.error("Error checking package: ", e);
    } finally {
      setCheckingPackage(false);
    }
  };

  const handleCollectPackagePayment = async () => {
    const amt = parseFloat(packagePaidInput) || 0;
    if (amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount to pay.');
      return;
    }
    if (!packageMembership) return;

    setLoading(true);
    try {
      const newPaid = (parseFloat(packageMembership.paidAmount) || 0) + amt;
      const newBalance = (parseFloat(packageMembership.totalAmount) || 0) - newPaid;

      if (newPaid > parseFloat(packageMembership.totalAmount)) {
        Alert.alert('Error', 'Total amount paid cannot exceed total package amount.');
        setLoading(false);
        return;
      }

      const pkgRef = doc(db, 'package_members', packageMembership.id);
      await updateDoc(pkgRef, {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        updatedAt: serverTimestamp()
      });

      // Log transaction
      await addDoc(collection(db, 'alltransactions'), {
        type: 'package_payment',
        patientId: patientId,
        patientName: patient?.fullName || 'Package Patient',
        regId: patient?.registrationId || patient?.regId || patient?.regID || '',
        registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
        phone: patient?.phone || patient?.patientPhone || '',
        doctor: patient?.doctor || patient?.doctorName || '',
        amount: amt,
        method: packagePaymentMethod,
        branchId: patient?.branchId || userData?.branchId || 'Unknown',
        branchName: patient?.branchName || userData?.branchName || 'Unknown',
        recordedBy: userData?.name || 'Staff',
        timestamp: serverTimestamp()
      });

      Alert.alert('Success', `Recorded payment of ₹${amt}`);
      setPackagePaidInput('');
      fetchPackageMembership(patient.phone);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record package payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorEditPackage = async () => {
    Alert.prompt(
      'Edit Package Total Amount',
      `Current Total: ₹${packageMembership.totalAmount}. Enter new total package amount:`,
      async (text) => {
        const newTotal = parseFloat(text);
        if (isNaN(newTotal) || newTotal <= 0) {
          Alert.alert('Error', 'Please enter a valid amount.');
          return;
        }
        if (newTotal < parseFloat(packageMembership.paidAmount)) {
          Alert.alert('Error', 'New total cannot be less than already paid amount.');
          return;
        }
        setLoading(true);
        try {
          const newBalance = newTotal - (parseFloat(packageMembership.paidAmount) || 0);
          const pkgRef = doc(db, 'package_members', packageMembership.id);
          await updateDoc(pkgRef, {
            totalAmount: newTotal,
            balanceAmount: newBalance,
            updatedAt: serverTimestamp()
          });
          Alert.alert('Success', 'Package updated successfully.');
          fetchPackageMembership(patient.phone);
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to update package total.');
        } finally {
          setLoading(false);
        }
      },
      'plain-text',
      String(packageMembership.totalAmount)
    );
  };

  const handleCreatePackageFromDetails = async () => {
    const total = parseFloat(newPkgTotal) || 0;
    const paid = parseFloat(newPkgPaid) || 0;
    const balance = total - paid;

    if (total <= 0) {
      Alert.alert('Error', 'Total amount must be greater than 0.');
      return;
    }
    if (paid > total) {
      Alert.alert('Error', 'Paid amount cannot exceed total package amount.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'package_members'), {
        patientId: patientId,
        patientName: patient?.fullName || 'Package Patient',
        patientMobile: patient?.phone || '',
        packageName: 'Standard Homeopathy Package',
        totalAmount: total,
        paidAmount: paid,
        balanceAmount: balance,
        startDate: newPkgStartDate.toISOString().split('T')[0],
        endDate: newPkgEndDate.toISOString().split('T')[0],
        status: 'active',
        branchId: patient?.branchId || userData?.branchId || 'Unknown',
        branchName: patient?.branchName || userData?.branchName || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'doctor',
        createdByName: userData?.name || 'Doctor'
      });

      // Log transaction if paid > 0
      if (paid > 0) {
        await addDoc(collection(db, 'alltransactions'), {
          type: 'package_payment',
          patientId: patientId,
          patientName: patient?.fullName || 'Package Patient',
          regId: patient?.registrationId || patient?.regId || patient?.regID || '',
          registrationId: patient?.registrationId || patient?.regId || patient?.regID || '',
          phone: patient?.phone || patient?.patientPhone || '',
          doctor: patient?.doctor || patient?.doctorName || '',
          amount: paid,
          method: 'cash',
          branchId: patient?.branchId || userData?.branchId || 'Unknown',
          branchName: patient?.branchName || userData?.branchName || 'Unknown',
          recordedBy: userData?.name || 'Staff',
          timestamp: serverTimestamp()
        });
      }

      setAddPackageModalVisible(false);
      Alert.alert('Success', 'Patient registered in package successfully!');
      fetchPackageMembership(patient.phone);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save package membership.');
    } finally {
      setLoading(false);
    }
  };

  const isPackageActive = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= startDateStr && today <= endDateStr;
  };

  const updateStatus = async (newStatus) => {
    setStatusDialogVisible(false);
    setLoading(true);
    try {
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'completed') {
        updateData.completedAt = serverTimestamp();
      }

      // Determine collection to update dynamically
      const activeCollection = patient?.firestoreCollection || 'allpatients';
      await updateDoc(doc(db, activeCollection, patientId), updateData);

      // Cross-collection status sync
      const cleanPhone = String(patient?.phone || '').replace(/\D/g, '').slice(-10);
      const patientIdVal = patient?.patientId || patientId;

      if (activeCollection === 'allpatients') {
        if (patientIdVal && patientIdVal !== 'WALKIN_USER') {
          try {
            await updateDoc(doc(db, 'patients', patientIdVal), {
              status: newStatus,
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            console.log('Sync to patients failed, trying phone search:', e);
            if (cleanPhone) {
              const qPats = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
              const snapPats = await getDocs(qPats);
              snapPats.forEach(async (docSnap) => {
                await updateDoc(doc(db, 'patients', docSnap.id), {
                  status: newStatus,
                  updatedAt: serverTimestamp()
                });
              });
            }
          }
        }
      } else if (activeCollection === 'patients') {
        if (cleanPhone) {
          try {
            const qAll = query(collection(db, 'allpatients'), where('phone', '==', cleanPhone));
            const snapAll = await getDocs(qAll);
            snapAll.forEach(async (docSnap) => {
              const data = docSnap.data();
              if (['waiting', 'booked', 'confirmed', 'pending', 'in-consultation'].includes(data.status)) {
                await updateDoc(doc(db, 'allpatients', docSnap.id), {
                  status: newStatus,
                  updatedAt: serverTimestamp()
                });
              }
            });
          } catch (err) {
            console.warn('Sync status to allpatients failed:', err);
          }
        }
      }

      Alert.alert('Success', `Status updated to ${newStatus.toUpperCase()}`);
      fetchPatientDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update patient status');
      setLoading(false);
    }
  };

  const handleRequestMedicineDiscount = async () => {
    if (!medDiscountReqAmount || !medDiscountNote) {
      Alert.alert('Error', 'Please enter requested amount and reason.');
      return;
    }
    setLoading(true);
    try {
      const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, patientId);

      await updateDoc(docRef, {
        medicineDiscountStatus: 'pending',
        medicineDiscountOriginal: patient.medicineFeeRequested,
        medicineDiscountRequested: parseFloat(medDiscountReqAmount),
        medicineDiscountNote: medDiscountNote,
        medicineDiscountRequestedBy: userData?.uid || '',
        updatedAt: serverTimestamp()
      });

      try {
        await notifyAllHRs(
          '📢 Medicine Discount Requested',
          `Collect ₹${medDiscountReqAmount} (instead of ₹${patient.medicineFeeRequested}) for ${patient.fullName || 'Patient'}.`,
          'medicine_discount_request',
          { patientId: patientId }
        );
      } catch (notifErr) {
        console.warn('Failed to send push notification to HRs:', notifErr);
      }

      Alert.alert('Success', 'Discount request sent to HR.');
      setShowMedDiscountModal(false);
      fetchPatientDetails();
    } catch (error) {
      console.error('Error requesting medicine discount:', error);
      Alert.alert('Error', 'Failed to request discount.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNutritionDiscount = async () => {
    if (!nutriDiscountReqAmount || !nutriDiscountNote) {
      Alert.alert('Error', 'Please enter requested amount and reason.');
      return;
    }
    if (!nutritionPlan) {
      Alert.alert('Error', 'Please save the diet plan first before requesting discount.');
      return;
    }
    setLoading(true);
    try {
      const planRef = doc(db, 'nutrition_plans', nutritionPlan.id);

      await updateDoc(planRef, {
        discountStatus: 'pending',
        discountOriginal: nutritionPlan.amount,
        discountRequested: parseFloat(nutriDiscountReqAmount),
        discountNote: nutriDiscountNote,
        updatedAt: serverTimestamp()
      });

      Alert.alert('Success', 'Diet plan discount request sent to HR.');
      setShowNutriDiscountModal(false);
      fetchPatientDetails();
    } catch (error) {
      console.error('Error requesting nutrition discount:', error);
      Alert.alert('Error', 'Failed to request discount.');
    } finally {
      setLoading(false);
    }
  };


  const uploadPrescription = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to snap the prescription.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;

    setUploading(true);
    try {
      const imageUri = result.assets[0].uri;
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) { reject(new TypeError('Network request failed')); };
        xhr.responseType = 'blob';
        xhr.open('GET', imageUri, true);
        xhr.send(null);
      });

      const fileRef = ref(storage, `prescriptions/${patientId}_${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob);
      const downloadUrl = await getDownloadURL(fileRef);

      const currentUrls = patient?.prescriptionUrls || (patient?.prescriptionUrl ? [patient.prescriptionUrl] : []);
      const newUrls = [...currentUrls, downloadUrl];

      const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
      const docRef = doc(db, collectionName, patientId);
      await updateDoc(docRef, {
        prescriptionUrls: newUrls,
        prescriptionUrl: newUrls.length > 0 ? newUrls[0] : null,
        updatedAt: serverTimestamp()
      });

      Alert.alert('Success', 'Prescription photo uploaded successfully.');
      fetchPatientDetails();
    } catch (error) {
      console.error('Error uploading prescription:', error);
      Alert.alert('Error', 'Failed to upload prescription');
    } finally {
      setUploading(false);
    }
  };

  const removePrescription = async (indexToRemove) => {
    Alert.alert("Remove Photo", "Are you sure you want to remove this prescription photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          setUploading(true);
          try {
            const currentUrls = patient?.prescriptionUrls || (patient?.prescriptionUrl ? [patient.prescriptionUrl] : []);
            const newUrls = currentUrls.filter((_, idx) => idx !== indexToRemove);
            const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');
            const docRef = doc(db, collectionName, patientId);
            await updateDoc(docRef, {
              prescriptionUrls: newUrls,
              prescriptionUrl: newUrls.length > 0 ? newUrls[0] : null,
              updatedAt: serverTimestamp()
            });
            fetchPatientDetails();
          } catch (error) {
            console.error("Error removing photo:", error);
            Alert.alert("Error", "Failed to remove photo.");
          } finally {
            setUploading(false);
          }
        }
      }
    ]);
  };

  const base64ToUint8Array = (base64) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
      lookup[chars.charCodeAt(i)] = i;
    }

    let bufferLength = base64.length * 0.75;
    if (base64[base64.length - 1] === '=') {
      bufferLength--;
      if (base64[base64.length - 2] === '=') {
        bufferLength--;
      }
    }

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const bytes = new Uint8Array(arrayBuffer);

    let p = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const encoded1 = lookup[base64.charCodeAt(i)];
      const encoded2 = lookup[base64.charCodeAt(i + 1)];
      const encoded3 = lookup[base64.charCodeAt(i + 2)];
      const encoded4 = lookup[base64.charCodeAt(i + 3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      if (p < bufferLength) {
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      }
      if (p < bufferLength) {
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
      }
    }

    return bytes;
  };

  const getCanvasHtml = (initialUrl) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body, html {
          margin: 0; padding: 0; width: 100%; height: 100%;
          overflow: hidden; background-color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #container {
          display: flex; flex-direction: column; width: 100%; height: 100%;
        }
        #canvas {
          flex: 1; width: 100%; background-color: #ffffff;
          touch-action: none;
        }
        #controls {
          display: flex; padding: 10px; background: #e2e8f0; justify-content: space-around; align-items: center;
          border-top: 1px solid #cbd5e1;
        }
        .btn {
          padding: 8px 12px; border: none; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer;
        }
        .btn-tool { background: #64748b; color: white; }
        .btn-active { background: #258ec8; color: white; }
        .btn-clear { background: #ef4444; color: white; }
        .btn-save { background: #10b981; color: white; }
      </style>
    </head>
    <body>
      <div id="container">
        <canvas id="canvas"></canvas>
        <div id="controls">
          <button class="btn btn-tool btn-active" id="penBtn">✏️ Pen</button>
          <button class="btn btn-tool" id="eraserBtn">🧽 Eraser</button>
          <button class="btn btn-save" id="saveBtn">💾 Save</button>
          <button class="btn btn-clear" id="clearBtn">Clear</button>
        </div>
      </div>
      <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        let initialDrawingUrl = \`${initialUrl || ''}\`;
        let hasClearedInitial = false;
        let drawing = false;
        let isEraser = false;
        let paths = [];
        let currentPath = null;

        const penBtn = document.getElementById('penBtn');
        const eraserBtn = document.getElementById('eraserBtn');

        penBtn.addEventListener('click', () => {
          isEraser = false;
          penBtn.classList.add('btn-active');
          eraserBtn.classList.remove('btn-active');
        });

        eraserBtn.addEventListener('click', () => {
          isEraser = true;
          eraserBtn.classList.add('btn-active');
          penBtn.classList.remove('btn-active');
        });

        function resizeCanvas() {
          const rect = canvas.parentNode.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = canvas.parentNode.clientHeight - 60;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (initialDrawingUrl && initialDrawingUrl.startsWith('data:image') && !hasClearedInitial) {
            const img = new Image();
            img.onload = function() {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              redrawCanvas();
            };
            img.src = initialDrawingUrl;
          } else {
            redrawCanvas();
          }
        }
        
        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 100);

        function getTouchPos(e) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
        }

        function startDrawing(e) {
          drawing = true;
          const pos = getTouchPos(e);
          ctx.beginPath();
          ctx.strokeStyle = isEraser ? '#ffffff' : '#1e293b';
          ctx.lineWidth = isEraser ? 24 : 3.5;
          ctx.moveTo(pos.x, pos.y);
          currentPath = {
            points: [pos],
            color: isEraser ? '#ffffff' : '#1e293b',
            width: isEraser ? 24 : 3.5
          };
        }

        function draw(e) {
          if (!drawing) return;
          e.preventDefault();
          const pos = getTouchPos(e);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
          currentPath.points.push(pos);
        }

        function stopDrawing() {
          if (!drawing) return;
          drawing = false;
          paths.push(currentPath);
          currentPath = null;
          sendImage();
        }

        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);

        document.getElementById('clearBtn').addEventListener('click', () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          paths = [];
          hasClearedInitial = true;
          initialDrawingUrl = "";
          sendImage(true);
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SAVE_NOTES' }));
        });

        function redrawCanvas() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          paths.forEach(path => {
            if (!path.points || path.points.length === 0) return;
            ctx.beginPath();
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.width;
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for(let i = 1; i < path.points.length; i++) {
              ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
          });
        }

        function sendImage(isEmpty = false) {
          if (isEmpty) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DRAWING', data: null }));
            return;
          }
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.fillStyle = '#ffffff';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(canvas, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DRAWING', data: dataUrl }));
        }
      </script>
    </body>
    </html>
  `;

  const handleCanvasMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'DRAWING') {
        setDrawingBase64(msg.data);
      } else if (msg.type === 'SAVE_NOTES') {
        handleSaveDigitalPrescription(true);
      }
    } catch (e) {
      console.error("Canvas message error:", e);
    }
  };

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
  const handleSaveDigitalPrescription = async (isDraft = false) => {
    const finalMedicines = medicines && medicines.length > 0 ? medicines : [];
    if (finalMedicines.length > 0) {
      if (!prescriptionDuration || !prescriptionDuration.trim()) {
        Alert.alert('Required Field', 'Please specify the duration to use for all medicines (e.g. 1 Month).');
        return;
      }
    }
    setLoading(true);
    try {
      let drawingUrl = patient?.diagnosisDrawingUrl || '';
      if (drawingBase64 && drawingBase64.startsWith('data:image')) {
        try {
          const fileUri = `${FileSystem.cacheDirectory}canvas_drawing_${Date.now()}.png`;
          const base64Data = drawingBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });

          const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () { resolve(xhr.response); };
            xhr.onerror = function (e) { reject(new TypeError('Blob conversion failed')); };
            xhr.responseType = 'blob';
            xhr.open('GET', fileUri, true);
            xhr.send(null);
          });

          const fileRef = ref(storage, `prescriptions/${patientId}_${Date.now()}_canvas.png`);
          await uploadBytes(fileRef, blob);
          drawingUrl = await getDownloadURL(fileRef);

          // Clean up cache file
          await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => { });
        } catch (uploadErr) {
          console.error("Error uploading drawing to storage:", uploadErr);
          // Fallback to base64 if upload fails
          drawingUrl = drawingBase64;
        }
      }

      // Collect physical prescription image URLs
      const currentPrescUrls = patient?.prescriptionUrls || (patient?.prescriptionUrl ? [patient.prescriptionUrl] : []);
      let finalPrescUrls = currentPrescUrls.filter(url => url !== patient?.diagnosisDrawingUrl);
      if (drawingUrl && !finalPrescUrls.includes(drawingUrl)) {
        finalPrescUrls.push(drawingUrl);
      }

      const isCurrentlyInDuration = followUpDate && followUpDate.trim() && followUpInterval !== 'No Follow-up'
        ? checkIsInDuration(followUpDate)
        : false;

      const updateData = {
        diagnosisNotes,
        diagnosisMode,
        diagnosisDrawingUrl: drawingUrl,
        medicines: finalMedicines,
        prescriptionDuration: finalMedicines.length > 0 ? prescriptionDuration : '',
        hideMedicines: hideMedicines,
        medicalHistory: medicalHistoryText,
        medicineFeeRequested: parseFloat(medicineFeeRequested) || 0,
        followUpInterval: followUpInterval || 'No Follow-up',
        followUpDate: followUpDate || '',
        isInDuration: isCurrentlyInDuration,
        prescriptionUrls: finalPrescUrls,
        prescriptionUrl: finalPrescUrls[0] || '',
        updatedAt: serverTimestamp()
      };

      if (!isDraft) {
        updateData.status = 'completed'; // Send to Receptionist Awaiting Payment Queue
        updateData.doctorStatus = 'prescribed'; // Flag that doctor has finished their part
      }

      // 1. Update allpatients document (replaces old followUpDate with new followUpDate)
      const allPatientsRef = doc(db, 'allpatients', patientId);
      await updateDoc(allPatientsRef, updateData);

      // 2. Also sync new followUpDate & isInDuration to patients collection & users collection if existing
      try {
        await updateDoc(doc(db, 'patients', patientId), {
          followUpDate: followUpDate || '',
          followUpInterval: followUpInterval || 'No Follow-up',
          isInDuration: isCurrentlyInDuration,
          prescriptionDuration: finalMedicines.length > 0 ? prescriptionDuration : '',
          updatedAt: serverTimestamp()
        });
      } catch (pErr) {
        // Ignored if doc doesn't exist in patients
      }

      try {
        await updateDoc(doc(db, 'users', patientId), {
          followUpDate: followUpDate || '',
          followUpInterval: followUpInterval || 'No Follow-up',
          isInDuration: isCurrentlyInDuration,
          updatedAt: serverTimestamp()
        });
      } catch (uErr) {
        // Ignored if doc doesn't exist in users
      }

      if (!isDraft) {
        const savedDoctorName = userData?.role === 'doctor'
          ? (userData?.name || 'Doctor')
          : (patient?.doctor || patient?.doctorName || 'Doctor');

        const effectiveBranchId = patient?.branchId || patient?.branchName || patient?.branch || userData?.branchId || userData?.branchName || 'KPHB';
        const effectiveBranchName = patient?.branchName || patient?.branch || patient?.branchId || userData?.branchName || userData?.branchId || 'KPHB Branch';

        // Log to patient_list for historical visits tracking
        await addDoc(collection(db, 'patient_list'), {
          patientId: patientId,
          fullName: patient.fullName || 'Patient',
          phone: patient.phone || '',
          email: patient.email || '',
          regId: patient.registrationId || '',
          doctor: savedDoctorName,
          branchId: effectiveBranchId,
          branchName: effectiveBranchName,
          status: 'completed',
          followUpDate: followUpDate || '',
          followUpInterval: followUpInterval,
          prescriptionNotes: diagnosisNotes,
          medicalHistory: medicalHistoryText,
          diagnosisDrawingUrl: drawingUrl,
          diagnosisMode: diagnosisMode,
          prescriptionUrls: finalPrescUrls,
          prescriptionUrl: finalPrescUrls[0] || '',
          createdAt: serverTimestamp()
        });

        // Add centralized followups record if set (superseding old pending followups)
        if (followUpDate && followUpDate.trim() && followUpInterval !== 'No Follow-up') {
          try {
            // Replace any older pending follow-ups for this patient
            const qOldFu = query(collection(db, 'followups'), where('patientId', '==', patientId), where('status', '==', 'pending'));
            const snapOldFu = await getDocs(qOldFu);
            for (const oldDoc of snapOldFu.docs) {
              await updateDoc(doc(db, 'followups', oldDoc.id), { status: 'replaced', replacedAt: serverTimestamp() });
            }

            await addDoc(collection(db, 'followups'), {
              patientId: patientId,
              patientName: patient.fullName || 'Patient',
              fullName: patient.fullName || 'Patient',
              phone: patient.phone || '',
              email: patient.email || '',
              doctor: savedDoctorName,
              branchId: effectiveBranchId,
              branchName: effectiveBranchName,
              followUpDate: followUpDate,
              followUpInterval: followUpInterval,
              complaint: patient.complaint || patient.subject || 'Consultation',
              status: 'pending',
              createdAt: serverTimestamp()
            });
          } catch (fuErr) {
            console.error("Error creating follow-up record:", fuErr);
          }
        }

        // Create a request for pharmacy in medicine_requests
        await addDoc(collection(db, 'medicine_requests'), {
          patientId: patientId,
          patientName: patient.fullName || 'Patient',
          phone: patient.phone || '',
          doctorName: savedDoctorName,
          branchId: effectiveBranchId,
          branchName: effectiveBranchName,
          subject: patient.complaint || patient.subject || 'Consultation',
          status: 'pending',
          requestedAt: serverTimestamp(),
          medicines: medicines.length > 0 ? medicines : [],
          duration: prescriptionDuration
        });
      }

      if (isDraft) {
        Alert.alert('Success', 'Prescription draft saved.', [
          { text: 'OK', onPress: () => fetchPatientDetails() }
        ]);
      } else {
        Alert.alert('Success', 'Prescription finalized and sent to Reception for checkout.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Error saving digital prescription:', error);
      Alert.alert('Error', 'Failed to save digital prescription');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patient File</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return COLORS.warning;
      case 'in-consultation': return COLORS.secondary;
      case 'completed': return COLORS.success;
      default: return COLORS.muted;
    }
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} enabled={Platform.OS === 'ios'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patient File</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
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
          {/* Profile Card */}
          <Surface style={styles.profileCard}>
            <View style={styles.profileHeader}>
              {patient?.patientPhoto ? (
                <Image source={{ uri: patient.patientPhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={28} color={COLORS.muted} />
                </View>
              )}
              <View style={styles.profileMeta}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={styles.patientName}>{patient?.fullName}</Text>
                  {(patient?.isOnline || patient?.source === 'appointments' || patient?._type === 'online' || patient?.source === 'UserApp' || patient?.source === 'Patient App' || patient?.raw?.source === 'appointments' || patient?.raw?.source === 'UserApp' || patient?.raw?.source === 'Patient App') && (
                    <View style={{
                      backgroundColor: '#f5f3ff',
                      borderColor: '#ddd6fe',
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                    }}>
                      <Text style={{
                        color: '#7c3aed',
                        fontSize: 7,
                        fontWeight: '800',
                        letterSpacing: 0.3
                      }}>APP</Text>
                    </View>
                  )}
                  {(patient?.packageId || packageMembership) && (
                    <View style={{
                      backgroundColor: '#ecfdf5',
                      borderColor: '#a7f3d0',
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                    }}>
                      <Text style={{
                        color: '#059669',
                        fontSize: 7,
                        fontWeight: '800',
                        letterSpacing: 0.3
                      }}>PKG</Text>
                    </View>
                  )}
                </View>
                {(patient?.registrationId || patient?.regId || patient?.regID) ? (
                  <Text style={styles.regIdText}>Reg ID: {patient.registrationId || patient.regId || patient.regID}</Text>
                ) : null}
                <View style={styles.row}>
                  {((patient?.gender && patient?.gender !== 'Unknown') || (patient?.age && patient?.age !== 'N/A' && patient?.age !== 0)) ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {[
                          patient?.gender && patient?.gender !== 'Unknown' ? patient.gender : null,
                          patient?.age && patient?.age !== 'N/A' && patient?.age !== 0 ? `${patient.age} yrs` : null
                        ].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  ) : null}
                  {(() => {
                    const isPaid = patient?.paymentStatus === 'paid';
                    const isInDur = patient?.isInDuration || (patient?.followUpDate ? checkIsInDuration(patient.followUpDate) : false);
                    const sLower = String(patient?.status || '').toLowerCase();
                    const isConsultFinished = ['completed', 'done', 'prescribed', 'consulted', 'completed_today'].includes(sLower) || String(patient?.doctorStatus || '').toLowerCase() === 'prescribed';

                    let displayStatus = patient?.status?.toUpperCase() || 'WAITING';
                    let displayBg = getStatusColor(patient?.status);

                    if (isConsultFinished && !isPaid && !isInDur) {
                      displayStatus = 'AWAITING PAYMENT';
                      displayBg = '#f59e0b';
                    } else if (isPaid && isConsultFinished) {
                      displayStatus = 'COMPLETED';
                      displayBg = '#10b981';
                    }

                    return (
                      <View style={[styles.badge, { backgroundColor: displayBg }]}>
                        <Text style={[styles.badgeText, { color: 'white' }]}>
                          {displayStatus}
                        </Text>
                      </View>
                    );
                  })()}
                  {(() => {
                    const isPaid = patient?.paymentStatus === 'paid';
                    const isInDur = patient?.isInDuration || (patient?.followUpDate ? checkIsInDuration(patient.followUpDate) : false);
                    if (isPaid) {
                      return (
                        <View style={[styles.badge, { backgroundColor: COLORS.success + '15' }]}>
                          <Text style={[styles.badgeText, { color: COLORS.success }]}>
                            {patient?.paymentMethod === 'split' || patient?.paymentSplitDetails ? 'PAID (SPLIT)' : 'PAID'}
                          </Text>
                        </View>
                      );
                    } else if (isInDur) {
                      return (
                        <View style={[styles.badge, { backgroundColor: COLORS.success + '15' }]}>
                          <Text style={[styles.badgeText, { color: COLORS.success }]}>PAID ₹0 (IN DURATION)</Text>
                        </View>
                      );
                    } else {
                      return (
                        <View style={[styles.badge, { backgroundColor: COLORS.danger + '15' }]}>
                          <Text style={[styles.badgeText, { color: COLORS.danger }]}>UNPAID</Text>
                        </View>
                      );
                    }
                  })()}
                  {(() => {
                    const followUp = patient?.followUpDate;
                    if (!followUp) return null;
                    const inDuration = checkIsInDuration(followUp);
                    if (inDuration) {
                      return (
                        <View style={[styles.badge, { backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1 }]}>
                          <Text style={[styles.badgeText, { color: '#d97706', fontWeight: 'bold' }]}>
                            IN DURATION
                          </Text>
                        </View>
                      );
                    } else {
                      return (
                        <View style={[styles.badge, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1 }]}>
                          <Text style={[styles.badgeText, { color: '#0369a1', fontWeight: 'bold' }]}>
                            RE-BOOKING
                          </Text>
                        </View>
                      );
                    }
                  })()}
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Contact and Branch Info */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Phone size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>{patient?.phone}</Text>
              </View>
              {patient?.email ? (
                <View style={styles.infoItem}>
                  <Mail size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                  <Text style={styles.infoLabel}>{patient.email}</Text>
                </View>
              ) : null}
              {patient?.address ? (
                <View style={styles.infoItem}>
                  <MapPin size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                  <Text style={styles.infoLabel}>{patient.address}</Text>
                </View>
              ) : null}
              <View style={styles.infoItem}>
                <MapPin size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Branch: {patient?.branchName || 'Main Branch'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Calendar size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Appt Date: {patient?.appointmentDate}</Text>
              </View>
              <View style={styles.infoItem}>
                <User size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Doctor: {patient?.doctor || 'Unassigned'}</Text>
              </View>
              {patient?.source ? (
                <View style={styles.infoItem}>
                  <Compass size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                  <Text style={styles.infoLabel}>Source: {patient.source}</Text>
                </View>
              ) : null}
              <View style={styles.infoItem}>
                <Clipboard size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Diseases: {patient?.complaint || 'N/A'}</Text>
              </View>
            </View>
            {patient?.paymentStatus === 'paid' && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>Consultation Receipt:</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    onPress={handleShareConsultationReceiptWhatsApp}
                  >
                    <WhatsAppIcon size={12} color="#25d366" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#047857', fontSize: 11, fontWeight: '700' }}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    onPress={handleShareConsultationReceiptPDF}
                  >
                    <FileText size={12} color="#258ec8" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '700' }}>PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {userData?.role !== 'doctor' && ['booked', 'waiting', 'pending', 'confirmed', 'registered', ''].includes((patient?.status || '').toLowerCase()) && (
              <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                <Button
                  mode="contained"
                  buttonColor={COLORS.secondary}
                  textColor="white"
                  icon={({ size, color }) => <Play size={size} color={color} />}
                  onPress={() => updateStatus('in-consultation')}
                  style={{ paddingVertical: 4, borderRadius: 12 }}
                  labelStyle={{ fontSize: 14, fontWeight: 'bold' }}
                  loading={loading}
                  disabled={loading}
                >
                  Start Visit
                </Button>
              </View>
            )}
          </Surface>

          {/* --- PACKAGE MEMBERSHIP AND INSTALLMENTS CARD --- */}
          {packageMembership ? (
            <Surface style={[styles.complaintCard, { borderColor: COLORS.success, borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Package size={18} color={COLORS.success} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: COLORS.success }]}>Active Package Member</Text>
                </View>
                <Chip
                  style={{ backgroundColor: isPackageActive(packageMembership.startDate, packageMembership.endDate) ? COLORS.success + '15' : COLORS.danger + '15', height: 22 }}
                  textStyle={{ color: isPackageActive(packageMembership.startDate, packageMembership.endDate) ? COLORS.success : COLORS.danger, fontSize: 9, fontWeight: '800' }}
                >
                  {isPackageActive(packageMembership.startDate, packageMembership.endDate) ? 'VERIFIED ACTIVE' : 'EXPIRED'}
                </Chip>
              </View>

              <View style={{ gap: 4, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '700' }}>
                  Package Membership
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>
                  Duration: {packageMembership.startDate} to {packageMembership.endDate}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 2 }}>₹{packageMembership.totalAmount}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' }}>Paid</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.success, marginTop: 2 }}>₹{packageMembership.paidAmount}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' }}>Balance</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: packageMembership.balanceAmount > 0 ? COLORS.danger : COLORS.success, marginTop: 2 }}>₹{packageMembership.balanceAmount}</Text>
                </View>
              </View>
              {canAccessClinical && (
                <Button
                  mode="outlined"
                  textColor={COLORS.secondary}
                  style={{ borderColor: COLORS.secondary }}
                  onPress={handleDoctorEditPackage}
                  icon={({ size, color }) => <FileText size={size} color={color} />}
                >
                  Edit Package Amount
                </Button>
              )}

              {userData?.role !== 'doctor' && packageMembership.balanceAmount > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>Record Package Payment (Installment)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <RNTextInput
                      style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                      placeholder="Enter Paid Amount"
                      keyboardType="numeric"
                      value={packagePaidInput}
                      onChangeText={setPackagePaidInput}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: COLORS.success, paddingHorizontal: 12, borderRadius: 8, height: 40, justifyContent: 'center' }}
                      onPress={handleCollectPackagePayment}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Pay Now</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['cash', 'phonepe', 'card'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: packagePaymentMethod === method ? COLORS.secondary : COLORS.border, backgroundColor: packagePaymentMethod === method ? '#eff6ff' : 'white' }}
                        onPress={() => setPackagePaymentMethod(method)}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: packagePaymentMethod === method ? COLORS.secondary : COLORS.muted }}>
                          {method.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </Surface>
          ) : (
            canAccessClinical && (
              <Surface style={styles.complaintCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Package size={18} color={COLORS.muted} style={{ marginRight: 8 }} />
                    <Text style={styles.sectionTitle}>Medical Package</Text>
                  </View>
                  <Button
                    mode="contained"
                    buttonColor={COLORS.secondary}
                    textColor="white"
                    onPress={() => {
                      setNewPkgName('Standard Homeopathy Package');
                      setNewPkgTotal('');
                      setNewPkgPaid('0');
                      setNewPkgStartDate(new Date());
                      setNewPkgEndDate(new Date(new Date().setMonth(new Date().getMonth() + 3)));
                      setAddPackageModalVisible(true);
                    }}
                    icon={({ size, color }) => <Plus size={size} color={color} />}
                    labelStyle={{ fontSize: 11 }}
                    style={{ borderRadius: 8 }}
                  >
                    Add Package
                  </Button>
                </View>
              </Surface>
            )
          )}
          {/* Digital Prescription Intake (All-in-One clinical suite) - Strictly for doctors only */}
          {canAccessClinical && (
            <Surface style={styles.clinicalCard}>
              <View style={styles.sectionHeader}>
                <Clipboard size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Digital Prescription</Text>
              </View>

              {/* Medical History */}
              <Text style={styles.fieldLabel}>Medical History & Vitals</Text>
              {isCompleted ? (
                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 }}>
                  {medicalHistoryText ? (
                    <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 18 }}>{medicalHistoryText}</Text>
                  ) : (
                    <Text style={{ color: COLORS.muted, fontStyle: 'italic', fontSize: 13 }}>No medical history recorded.</Text>
                  )}
                </View>
              ) : (
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={8}
                  placeholder="Enter prescription medical details..."
                  placeholderTextColor="#000000"
                  value={medicalHistoryText}
                  onChangeText={setMedicalHistoryText}
                  style={[styles.textArea, { marginBottom: 16 }]}
                  activeOutlineColor={COLORS.secondary}
                  textColor="#000000"
                />
              )}

              {/* Diagnosis Notes */}
              <Text style={styles.fieldLabel}>Diagnosis Notes</Text>

              {isCompleted ? (
                <View style={{ gap: 12, marginBottom: 16 }}>
                  {diagnosisNotes ? (
                    <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}>
                      <Text style={{ fontSize: 13, color: COLORS.text }}>{diagnosisNotes}</Text>
                    </View>
                  ) : null}
                  {patient?.diagnosisDrawingUrl ? (
                    <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}>
                      <Image source={{ uri: patient.diagnosisDrawingUrl }} style={{ width: '100%', height: 250, borderRadius: 8, resizeMode: 'contain', backgroundColor: 'white' }} />
                    </View>
                  ) : null}
                  {!diagnosisNotes && !patient?.diagnosisDrawingUrl && (
                    <Text style={{ color: COLORS.muted, fontStyle: 'italic', fontSize: 13 }}>No diagnosis notes or drawing recorded.</Text>
                  )}
                </View>
              ) : (
                <>
                  {/* Option Toggles (Type vs Draw Canvas) */}
                  <View style={styles.tabToggleRow}>
                    <TouchableOpacity
                      style={[styles.tabToggleBtn, diagnosisMode === 'type' && styles.tabToggleBtnActive]}
                      onPress={() => setDiagnosisMode('type')}
                    >
                      <Text style={[styles.tabToggleText, diagnosisMode === 'type' && styles.tabToggleTextActive]}>
                        ⌨️ Type Notes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabToggleBtn, diagnosisMode === 'draw' && styles.tabToggleBtnActive]}
                      onPress={() => setDiagnosisMode('draw')}
                    >
                      <Text style={[styles.tabToggleText, diagnosisMode === 'draw' && styles.tabToggleTextActive]}>
                        ✍️ Draw Notes (Canvas)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Input Components (Both mounted to keep drawing alive on tab toggle) */}
                  <View style={diagnosisMode === 'type' ? {} : { display: 'none', height: 0, overflow: 'hidden' }}>
                    <TextInput
                      mode="outlined"
                      multiline
                      numberOfLines={8}
                      placeholder="Enter detailed clinical notes and diagnosis..."
                      placeholderTextColor="#000000"
                      value={diagnosisNotes}
                      onChangeText={setDiagnosisNotes}
                      style={styles.textArea}
                      activeOutlineColor={COLORS.secondary}
                      textColor="#000000"
                    />
                  </View>
                  <View style={[styles.canvasContainer, diagnosisMode === 'draw' ? {} : { display: 'none', height: 0, overflow: 'hidden', marginBottom: 0 }]}>
                    <WebView
                      source={{ html: getCanvasHtml(patient?.diagnosisDrawingUrl || '') }}
                      style={{ flex: 1 }}
                      onMessage={handleCanvasMessage}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      startInLoadingState={true}
                    />
                  </View>

                  {diagnosisMode === 'draw' && (
                    <>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: COLORS.secondary + '15',
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: COLORS.secondary + '30',
                          marginBottom: 16
                        }}
                        onPress={() => {
                          setFullscreenInitialUrl(drawingBase64 || patient?.diagnosisDrawingUrl || '');
                          setCanvasFullScreen(true);
                        }}
                      >
                        <LucideIcons.Maximize2 size={16} color={COLORS.secondary} style={{ marginRight: 6 }} />
                        <Text style={{ color: COLORS.secondary, fontWeight: '700', fontSize: 13 }}>Draw in Full Screen</Text>
                      </TouchableOpacity>

                      <Modal visible={canvasFullScreen} animationType="slide" onRequestClose={() => setCanvasFullScreen(false)}>
                        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top', 'bottom']}>
                          {/* Modal Header */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Full Screen Canvas</Text>
                            <TouchableOpacity
                              onPress={() => setCanvasFullScreen(false)}
                              style={{ backgroundColor: COLORS.secondary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                            >
                              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Half Screen</Text>
                            </TouchableOpacity>
                          </View>
                          {/* Canvas WebView in Full Screen */}
                          <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
                            <WebView
                              source={{ html: getCanvasHtml(fullscreenInitialUrl) }}
                              style={{ flex: 1 }}
                              onMessage={handleCanvasMessage}
                              javaScriptEnabled={true}
                              domStorageEnabled={true}
                            />
                          </View>
                        </SafeAreaView>
                      </Modal>
                    </>
                  )}
                </>
              )}



              {/* Physical Prescription Snapshot (Optional) */}
              <View style={[styles.rowBetween, { marginTop: 16 }]}>
                <Text style={styles.fieldLabel}>Physical Prescriptions (Optional)</Text>
                {!isCompleted && (patient?.prescriptionUrls?.length > 0 || patient?.prescriptionUrl) && (
                  <Button mode="text" textColor={COLORS.secondary} onPress={uploadPrescription} icon={({ size, color }) => <Plus size={size} color={color} />}>Add Photo</Button>
                )}
              </View>

              {(() => {
                const prescUrls = patient?.prescriptionUrls || (patient?.prescriptionUrl ? [patient.prescriptionUrl] : []);
                if (prescUrls.length > 0) {
                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {prescUrls.map((url, index) => (
                        <View key={index} style={{ marginRight: 12, position: 'relative' }}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                              setLightboxImages(prescUrls);
                              setLightboxIndex(index);
                            }}
                          >
                            <Image source={{ uri: url }} style={{ width: 200, height: 200, borderRadius: 12, resizeMode: 'cover' }} />
                          </TouchableOpacity>
                          {!isCompleted && (
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 4 }}
                              onPress={() => removePrescription(index)}
                            >
                              <X size={16} color="white" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  );
                } else if (!isCompleted) {
                  return (
                    <View style={styles.uploadArea}>
                      {uploading ? (
                        <ActivityIndicator color={COLORS.secondary} />
                      ) : (
                        <TouchableOpacity onPress={uploadPrescription} style={styles.uploadBox}>
                          <Upload size={24} color={COLORS.muted} style={{ marginBottom: 6 }} />
                          <Text style={styles.uploadBoxTitle}>Physical Prescription (Optional)</Text>
                          <Text style={styles.uploadBoxSub}>Upload clear photos of the handwritten prescription if available.</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                } else {
                  return (
                    <Text style={{ color: COLORS.muted, fontStyle: 'italic', fontSize: 13, marginTop: 8 }}>No physical prescription uploaded.</Text>
                  );
                }
              })()}

              {/* Follow-up recommendation */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Follow-up Recommendation</Text>
              <View style={styles.followUpRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.subLabel}>Follow-up Interval</Text>
                  <View style={styles.pickerWrapper}>
                    <Menu
                      visible={followUpMenuVisible}
                      onDismiss={() => setFollowUpMenuVisible(false)}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12 }}
                      anchor={
                        <TouchableOpacity
                          onPress={() => setFollowUpMenuVisible(true)}
                          style={styles.pickerSelector}
                          disabled={isCompleted}
                        >
                          <Text style={styles.pickerSelectorText}>{followUpInterval}</Text>
                        </TouchableOpacity>
                      }
                    >
                      <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("No Follow-up"); setFollowUpDate(""); }} title="No Follow-up" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("1 Month"); const d = new Date(); d.setMonth(d.getMonth() + 1); setFollowUpDate(d.toISOString().split('T')[0]); }} title="1 Month" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("2 Months"); const d = new Date(); d.setMonth(d.getMonth() + 2); setFollowUpDate(d.toISOString().split('T')[0]); }} title="2 Months" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("3 Months"); const d = new Date(); d.setMonth(d.getMonth() + 3); setFollowUpDate(d.toISOString().split('T')[0]); }} title="3 Months" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("4 Months"); const d = new Date(); d.setMonth(d.getMonth() + 4); setFollowUpDate(d.toISOString().split('T')[0]); }} title="4 Months" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("5 Months"); const d = new Date(); d.setMonth(d.getMonth() + 5); setFollowUpDate(d.toISOString().split('T')[0]); }} title="5 Months" titleStyle={{ color: '#000000', fontSize: 13 }} />
                        <Menu.Item onPress={() => { setFollowUpMenuVisible(false); setFollowUpInterval("6 Months"); const d = new Date(); d.setMonth(d.getMonth() + 6); setFollowUpDate(d.toISOString().split('T')[0]); }} title="6 Months" titleStyle={{ color: '#000000', fontSize: 13 }} />
                      </ScrollView>
                    </Menu>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subLabel}>Follow-up End Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} disabled={isCompleted}>
                    <View pointerEvents="none">
                      <TextInput
                        mode="outlined"
                        dense
                        placeholder="DD-MM-YYYY"
                        placeholderTextColor="#000000"
                        value={formatFollowUpDateDisplay(followUpDate)}
                        style={styles.followUpInput}
                        activeOutlineColor={COLORS.secondary}
                        editable={false}
                        textColor="#000000"
                      />
                    </View>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={followUpDate ? new Date(followUpDate) : new Date()}
                      mode="date"
                      display="default"
                      onValueChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setFollowUpDate(selectedDate.toISOString().split('T')[0]);
                          setFollowUpInterval('Custom');
                        }
                      }}
                      onDismiss={() => setShowDatePicker(false)}
                    />
                  )}
                </View>
              </View>

              {/* Doctor enters Medicine Amount */}
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabel}>Pharmacy / Medicine Fee (₹)</Text>
                <TextInput
                  mode="outlined"
                  dense
                  placeholder="Enter total amount for prescribed medicines"
                  placeholderTextColor="#000000"
                  keyboardType="numeric"
                  value={medicineFeeRequested}
                  onChangeText={setMedicineFeeRequested}
                  style={{ backgroundColor: '#fff', marginBottom: 4 }}
                  activeOutlineColor={COLORS.secondary}
                  editable={!isCompleted}
                  textColor="#000000"
                />
                <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 16 }}>
                  The receptionist will collect this exact amount from the patient.
                </Text>
              </View>

              {!isCompleted && (
                <Button
                  mode="contained"
                  buttonColor={COLORS.secondary}
                  textColor="white"
                  style={styles.savePrescBtn}
                  onPress={() => handleSaveDigitalPrescription(false)}
                  icon={({ size, color }) => <Send size={size} color={color} />}
                >
                  Send to Reception / Pharmacy
                </Button>
              )}
            </Surface>
          )}

          {/* Nutrition Plan - Doctor View */}
          {userData?.role === 'doctor' && (
            <Surface style={styles.clinicalCard}>
              <View style={styles.sectionHeader}>
                <PlusCircle size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Nutrition & Diet Plan</Text>
              </View>

              {nutritionPlan ? (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: COLORS.text, fontSize: 13 }}>Current Plan Summary</Text>
                      <Chip
                        style={{ backgroundColor: nutritionPlan.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7', height: 22 }}
                        textStyle={{ color: nutritionPlan.paymentStatus === 'paid' ? '#16a34a' : '#d97706', fontSize: 10, fontWeight: '700' }}
                      >
                        {nutritionPlan.paymentStatus?.toUpperCase()}
                      </Chip>
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.text }}>Age: {nutritionPlan.age} | Height: {nutritionPlan.height} cm | Weight: {nutritionPlan.weight} kg | BMI: {nutritionPlan.bmi}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.text, marginTop: 4 }}>Fee: ₹{nutritionPlan.amount}</Text>
                    {nutritionPlan.deficiencies && nutritionPlan.deficiencies.length > 0 && (
                      <Text style={{ fontSize: 12, color: COLORS.text, marginTop: 4 }}>Deficiencies: {nutritionPlan.deficiencies.join(', ')}</Text>
                    )}
                  </View>

                  {nutritionPlan.paymentStatus === 'pending' && !showNutritionEditor && !isCompleted && (
                    <Button
                      mode="outlined"
                      textColor={COLORS.secondary}
                      style={{ borderColor: COLORS.secondary, marginBottom: 8 }}
                      onPress={() => handleLoadNutritionPlanForEdit(nutritionPlan)}
                      icon={({ size, color }) => <FileText size={size} color={color} />}
                    >
                      Edit Diet Plan & Pricing
                    </Button>
                  )}

                  {(isCompleted || nutritionPlan.paymentStatus === 'paid') && !showNutritionEditor && (
                    <Button
                      mode="outlined"
                      textColor={COLORS.secondary}
                      style={{ borderColor: COLORS.secondary, marginBottom: 8 }}
                      onPress={() => {
                        handleLoadNutritionPlanForEdit(nutritionPlan);
                        setShowNutritionEditor(true);
                      }}
                      icon={({ size, color }) => <FileText size={size} color={color} />}
                    >
                      View Diet Plan
                    </Button>
                  )}
                </View>
              ) : (
                !showNutritionEditor && !isCompleted && (
                  <Button
                    mode="contained"
                    buttonColor={COLORS.primary}
                    textColor="white"
                    style={{ marginBottom: 16 }}
                    onPress={() => {
                      handleResetNutritionForm();
                      if (patient?.age) setNutriAge(String(patient.age));
                      setShowNutritionEditor(true);
                    }}
                    icon={({ size, color }) => <Plus size={size} color={color} />}
                  >
                    Create 30-Day Diet Plan
                  </Button>
                )
              )}

              {showNutritionEditor && (
                <View>
                  <Text style={styles.fieldLabel}>Intake Details</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Age (yrs)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriAge}
                        onChangeText={setNutriAge}
                        editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Height (cm)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriHeight}
                        onChangeText={setNutriHeight}
                        editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Weight (kg)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriWeight}
                        onChangeText={setNutriWeight}
                        editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>Computed BMI: <Text style={{ color: Number(nutriBmi) > 25 ? COLORS.danger : COLORS.success }}>{nutriBmi}</Text></Text>
                  </View>

                  <Text style={styles.fieldLabel}>Deficiencies Checklist</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D", "Vitamin E", "Vitamin K", "Calcium", "Potassium", "Magnesium", "Zinc", "Iron", "Sodium", "Protein", "Manganese", "Phosphorus"].map((def) => {
                      const isSelected = nutriDeficiencies.includes(def);
                      return (
                        <TouchableOpacity
                          key={def}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isSelected ? COLORS.secondary : COLORS.border,
                            backgroundColor: isSelected ? COLORS.secondary + '15' : 'white'
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setNutriDeficiencies(nutriDeficiencies.filter(d => d !== def));
                            } else {
                              setNutriDeficiencies([...nutriDeficiencies, def]);
                            }
                          }}
                          disabled={isCompleted || nutritionPlan?.paymentStatus === 'paid'}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? COLORS.secondary : COLORS.text }}>
                            {def}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>Disorders / Conditions</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {["Sugar (Diabetes)", "High BP (Hypertension)", "Thyroid", "Gastritis", "IBS / IBD", "SIBO", "Bloating", "Acidity", "Piles", "PCOD", "Insulin Resistance", "Hairfall", "Melasma", "Weight Gain", "Weight Loss", "Height Growth", "Adenoids / Tonsillitis", "Allergies"].map((disorder) => {
                      const isSelected = nutriDisorders.includes(disorder);
                      return (
                        <TouchableOpacity
                          key={disorder}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isSelected ? COLORS.primary : COLORS.border,
                            backgroundColor: isSelected ? COLORS.primary + '15' : 'white'
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setNutriDisorders(nutriDisorders.filter(d => d !== disorder));
                            } else {
                              setNutriDisorders([...nutriDisorders, disorder]);
                            }
                          }}
                          disabled={isCompleted || nutritionPlan?.paymentStatus === 'paid'}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? COLORS.primary : COLORS.text }}>
                            {disorder}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Other Diseases / Disorders</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Enter other health conditions..."
                    value={nutriOtherDiseases}
                    onChangeText={setNutriOtherDiseases}
                    style={{ backgroundColor: '#fff', marginBottom: 12 }}
                    activeOutlineColor={COLORS.secondary}
                    editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Signs & Symptoms</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Enter patient symptoms..."
                    value={nutriSymptoms}
                    onChangeText={setNutriSymptoms}
                    style={{ backgroundColor: '#fff', marginBottom: 12 }}
                    activeOutlineColor={COLORS.secondary}
                    editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Foods to Eat</Text>
                  <TextInput
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    placeholder="Recommended foods..."
                    value={nutriEat}
                    onChangeText={setNutriEat}
                    style={[styles.textArea, { marginBottom: 12 }]}
                    activeOutlineColor={COLORS.secondary}
                    editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Foods to Avoid</Text>
                  <TextInput
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    placeholder="Foods to avoid..."
                    value={nutriAvoid}
                    onChangeText={setNutriAvoid}
                    style={[styles.textArea, { marginBottom: 12 }]}
                    activeOutlineColor={COLORS.secondary}
                    editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Nutrition Plan Fee (₹)</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    keyboardType="numeric"
                    placeholder="Enter nutrition billing amount"
                    value={nutriAmount}
                    onChangeText={setNutriAmount}
                    style={{ backgroundColor: (canAccessClinical && !isCompleted && nutritionPlan?.paymentStatus !== 'paid') ? '#fff' : '#f1f5f9', marginBottom: 16 }}
                    activeOutlineColor={COLORS.secondary}
                    editable={canAccessClinical && !isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>30-Day Diet Plan Meals</Text>
                  <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 250, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, backgroundColor: '#f8fafc', marginBottom: 16 }}>
                    {nutriMeals.map((meal, index) => (
                      <View key={index} style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 12 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 12, color: COLORS.secondary, marginBottom: 4 }}>Day {meal.dayNumber}</Text>

                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Breakfast:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.breakfast}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'breakfast', val)}
                              editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Lunch:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.lunch}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'lunch', val)}
                              editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Snacks:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.snacks}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'snacks', val)}
                              editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Dinner:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.dinner}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'dinner', val)}
                              editable={!isCompleted && nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  {isCompleted || nutritionPlan?.paymentStatus === 'paid' ? (
                    <Button
                      mode="contained"
                      buttonColor={COLORS.secondary}
                      textColor="white"
                      style={{ flex: 1 }}
                      onPress={() => setShowNutritionEditor(false)}
                    >
                      Close View
                    </Button>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        mode="outlined"
                        textColor={COLORS.danger}
                        style={{ flex: 1, borderColor: COLORS.danger }}
                        onPress={handleResetNutritionForm}
                      >
                        Cancel
                      </Button>
                      <Button
                        mode="outlined"
                        textColor={COLORS.secondary}
                        style={{ flex: 1, borderColor: COLORS.secondary }}
                        onPress={() => {
                          setNutriDiscountReqAmount('');
                          setNutriDiscountNote('');
                          setShowNutriDiscountModal(true);
                        }}
                      >
                        Request HR
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={COLORS.primary}
                        textColor="white"
                        style={{ flex: 1 }}
                        loading={submittingNutrition}
                        onPress={handleSaveNutritionPlan}
                      >
                        Save Plan
                      </Button>
                    </View>
                  )}
                </View>
              )}
            </Surface>
          )}

          {/* Doctor's Prescription & Notes - Visible to receptionists only */}
          {userData?.role !== 'doctor' && !canAccessClinical && (
            <Surface style={styles.clinicalCard}>
              <View style={styles.sectionHeader}>
                <Clipboard size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Doctor's Prescription & Notes</Text>
              </View>
              {patient?.diagnosisNotes ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: COLORS.secondary }]}>Diagnosis Notes</Text>
                  <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}>
                    {patient.diagnosisNotes}
                  </Text>
                </View>
              ) : null}

              {patient?.diagnosisDrawingUrl ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: COLORS.secondary, marginBottom: 8 }]}>Draw Notes (Canvas)</Text>
                  <Image
                    source={{ uri: patient.diagnosisDrawingUrl }}
                    style={{
                      width: '100%',
                      height: 220,
                      borderRadius: 12,
                      resizeMode: 'contain',
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: COLORS.border
                    }}
                  />
                </View>
              ) : null}

              {patient?.medicines && patient?.medicines.length > 0 ? (
                <View>
                  <Text style={[styles.fieldLabel, { color: COLORS.secondary, marginBottom: 8 }]}>Prescribed Medicines</Text>
                  <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12 }}>
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6, marginBottom: 6 }}>
                      <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: COLORS.muted }}>Name & Type</Text>
                      <Text style={{ flex: 1.2, fontSize: 11, fontWeight: '700', color: COLORS.muted }}>Timing</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.muted }}>Days</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'right' }}>Price</Text>
                    </View>
                    {patient.medicines.map((med, index) => (
                      <View key={index} style={{ flexDirection: 'row', paddingVertical: 4, alignItems: 'center' }}>
                        <View style={{ flex: 2 }}>
                          <Text style={{ fontSize: 12, color: COLORS.text, fontWeight: '600' }}>{med.name || 'N/A'}</Text>
                          <Text style={{ fontSize: 10, color: COLORS.secondary }}>{med.type || 'N/A'}</Text>
                        </View>
                        <Text style={{ flex: 1.2, fontSize: 12, color: COLORS.text }}>{med.dosage || med.timing || 'N/A'}</Text>
                        <Text style={{ flex: 1, fontSize: 12, color: COLORS.text }}>{med.duration || ''}</Text>
                        <Text style={{ flex: 1, fontSize: 12, color: COLORS.text, fontWeight: '700', textAlign: 'right' }}>₹{med.price || '0'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {!(patient?.diagnosisNotes || patient?.diagnosisDrawingUrl || (patient?.medicines && patient?.medicines.length > 0)) && (
                <Text style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', marginVertical: 12 }}>
                  The doctor has not provided any digital notes or medicines for this consultation yet.
                </Text>
              )}
            </Surface>
          )}

          {/* Physical Prescription Upload Card - Visible to receptionists only (Doctor has it in Digital Presc) */}
          {userData?.role !== 'doctor' && !canAccessClinical && (
            <Surface style={styles.clinicalCard}>
              <View style={styles.sectionHeader}>
                <Camera size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Physical Prescription</Text>
              </View>
              <Text style={styles.statusDescription}>
                Upload a clear photo of the handwritten paper prescription sheet.
              </Text>

              {(() => {
                const prescUrls = patient?.prescriptionUrls || (patient?.prescriptionUrl ? [patient.prescriptionUrl] : []);
                if (prescUrls.length > 0) {
                  return (
                    <View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {prescUrls.map((url, index) => (
                          <View key={index} style={{ marginRight: 12, position: 'relative' }}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                setLightboxImages(prescUrls);
                                setLightboxIndex(index);
                              }}
                            >
                              <Image source={{ uri: url }} style={{ width: 250, height: 250, borderRadius: 12, resizeMode: 'cover' }} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 4 }}
                              onPress={() => removePrescription(index)}
                            >
                              <X size={20} color="white" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                      <Button
                        mode="outlined"
                        textColor={COLORS.secondary}
                        borderColor={COLORS.secondary}
                        onPress={uploadPrescription}
                        style={{ marginTop: 12 }}
                        icon={({ size, color }) => <Plus size={size} color={color} />}
                      >
                        Add Another Photo
                      </Button>
                    </View>
                  );
                } else {
                  return (
                    <View style={styles.uploadArea}>
                      {uploading ? (
                        <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 12 }} />
                      ) : (
                        <TouchableOpacity onPress={uploadPrescription} style={styles.uploadBox}>
                          <Upload size={24} color={COLORS.muted} style={{ marginBottom: 6 }} />
                          <Text style={styles.uploadBoxTitle}>Physical Prescription</Text>
                          <Text style={styles.uploadBoxSub}>Upload clear photos of the paper prescription sheets.</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }
              })()}
            </Surface>
          )}

          {/* Medicine Fee Waived Card for Package Members */}
          {userData?.role !== 'doctor' && packageMembership && (
            <Surface style={[styles.exactCard, { borderColor: COLORS.success, borderLeftWidth: 4, borderLeftColor: COLORS.success }]}>
              <View style={styles.exactHeaderRow}>
                <View style={[styles.exactIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Package size={20} color={COLORS.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exactTitle}>Medicine Fee Waived</Text>
                  <Text style={styles.exactSubtitle}>Patient is enrolled in an active package</Text>
                </View>
              </View>
              <View style={{ marginTop: 12, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8 }}>
                <Text style={{ fontSize: 13, color: '#15803d', fontWeight: '600' }}>
                  ✓ Medicines are covered under the active package. The receptionist does not collect any medicine fee for this visit.
                </Text>
              </View>
            </Surface>
          )}

          {/* Medicine Fee Collection Card for Receptionist */}
          {userData?.role !== 'doctor' && patient?.medicineFeeRequested > 0 && !packageMembership && (
            <Surface style={styles.exactCard}>
              <View style={styles.exactHeaderRow}>
                <View style={styles.exactIconCircle}>
                  <IndianRupee size={20} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exactTitle}>Pharmacy / Medicine Fee</Text>
                  <Text style={styles.exactSubtitle}>Collect and manage payment for medicines</Text>
                </View>
              </View>

              <View style={styles.exactRowBetween}>
                <Text style={styles.exactRowLabel}>Payment Status</Text>
                {(patient?.medicineFeeStatus === 'paid' || patient?.paymentStatus === 'paid' || patient?.status === 'done') ? (
                  <View style={[styles.exactStatusPill, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.exactStatusText, { color: '#16a34a' }]}>PAID</Text>
                  </View>
                ) : (
                  <View style={[styles.exactStatusPill, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.exactStatusText, { color: '#ef4444' }]}>NOT PAID</Text>
                  </View>
                )}
              </View>

              <View style={[styles.exactRowBetween, { marginTop: 16 }]}>
                <Text style={styles.exactRowLabel}>Requested by Doctor (₹)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {patient?.medicineDiscountStatus === 'pending' ? (
                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 }}>
                      <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '700' }}>Pending HR Approval...</Text>
                    </View>
                  ) : patient?.medicineDiscountStatus === 'rejected' ? (
                    <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 }}>
                      <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Discount Rejected</Text>
                    </View>
                  ) : patient?.medicineDiscountStatus === 'approved' ? (
                    <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 }}>
                      <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '700' }}>Discount Approved</Text>
                    </View>
                  ) : null}
                  <Text style={styles.exactAmountText}>
                    ₹{patient?.medicineFeeRequested}
                  </Text>
                </View>
              </View>

              {patient?.medicineFeeStatus !== 'paid' && patient?.paymentStatus !== 'paid' && patient?.status !== 'done' && patient?.medicineDiscountStatus !== 'pending' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', marginTop: 6 }}
                  onPress={() => {
                    setMedDiscountReqAmount('');
                    setMedDiscountNote('');
                    setShowMedDiscountModal(true);
                  }}
                >
                  <Text style={{ color: COLORS.secondary, fontSize: 12, fontWeight: '700' }}>Request HR Discount</Text>
                </TouchableOpacity>
              )}

              <View style={styles.exactDashedDivider} />

              {(patient?.medicineFeeStatus === 'paid' || patient?.paymentStatus === 'paid' || patient?.status === 'done') ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Payment Recorded Successfully!</Text>
                  <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                    Method: {patient?.medicineFeeMethod?.toUpperCase() || patient?.paymentMethod?.toUpperCase() || 'PAID'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                      onPress={handleShareMedicineReceiptWhatsApp}
                    >
                      <WhatsAppIcon size={14} color="#25d366" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#047857', fontSize: 12, fontWeight: '700' }}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                      onPress={handleShareMedicineReceiptPDF}
                    >
                      <FileText size={14} color="#258ec8" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '700' }}>PDF Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : patient?.medicineDiscountStatus === 'pending' ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Clock size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>Awaiting HR Approval</Text>
                  <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 16 }}>
                    You cannot collect the medicine fee until HR approves or rejects the discount request.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.exactMethodTitle}>Payment Method</Text>
                  <View style={styles.exactGridRow}>
                    <TouchableOpacity
                      style={[styles.exactMethodBtn, medicineFeeMethod === 'cash' && styles.exactMethodBtnActive]}
                      onPress={() => setMedicineFeeMethod('cash')}
                    >
                      <Banknote size={18} color="#16a34a" />
                      <Text style={[styles.exactMethodBtnText, medicineFeeMethod === 'cash' && styles.exactMethodBtnTextActive]}>Cash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.exactMethodBtn, medicineFeeMethod === 'phonepe' && styles.exactMethodBtnActive]}
                      onPress={() => setMedicineFeeMethod('phonepe')}
                    >
                      <View style={styles.exactPhonePeCircle}>
                        <Text style={styles.exactPhonePeText}>पे</Text>
                      </View>
                      <Text style={[styles.exactMethodBtnText, medicineFeeMethod === 'phonepe' && styles.exactMethodBtnTextActive]}>PhonePe</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.exactGridRow}>
                    <TouchableOpacity
                      style={[styles.exactMethodBtn, medicineFeeMethod === 'card' && styles.exactMethodBtnActive]}
                      onPress={() => setMedicineFeeMethod('card')}
                    >
                      <CreditCard size={18} color="#3b82f6" />
                      <Text style={[styles.exactMethodBtnText, medicineFeeMethod === 'card' && styles.exactMethodBtnTextActive]}>Card</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.exactMethodBtn, medicineFeeMethod === 'split' && styles.exactMethodBtnActive]}
                      onPress={() => setMedicineFeeMethod('split')}
                    >
                      <ArrowRightLeft size={18} color="#3b82f6" />
                      <Text style={[styles.exactMethodBtnText, medicineFeeMethod === 'split' && styles.exactMethodBtnTextActive]}>Split Payment</Text>
                    </TouchableOpacity>
                  </View>

                  {medicineFeeMethod === 'split' && (
                    <View style={styles.exactSplitContainer}>
                      <View style={styles.exactSplitHeader}>
                        <Calculator size={16} color="#3b82f6" />
                        <Text style={styles.exactSplitTitle}>Enter Split Amounts</Text>
                      </View>

                      {/* Split 1 */}
                      <View style={styles.exactSplitRow}>
                        <View style={styles.exactSegmentedControl}>
                          {['cash', 'phonepe', 'card'].map((m) => {
                            const isActive = splitMethod1 === m;
                            let bg = '#ffffff';
                            let color = '#64748b';
                            if (isActive) {
                              if (m === 'cash') { bg = '#3b82f6'; color = '#ffffff'; }
                              if (m === 'phonepe') { bg = '#8b5cf6'; color = '#ffffff'; }
                              if (m === 'card') { bg = '#3b82f6'; color = '#ffffff'; }
                            }
                            return (
                              <TouchableOpacity
                                key={`s1-${m}`}
                                style={[styles.exactSegmentBtn, { backgroundColor: bg, borderRightWidth: m === 'card' ? 0 : 1 }]}
                                onPress={() => setSplitMethod1(m)}
                              >
                                <Text style={[styles.exactSegmentText, { color }]}>
                                  {m === 'phonepe' ? 'PhonePe' : m.charAt(0).toUpperCase() + m.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TextInput
                          mode="outlined"
                          label={`Amount for ${splitMethod1.toUpperCase()} (₹)`}
                          keyboardType="numeric"
                          value={splitAmount1}
                          onChangeText={setSplitAmount1}
                          style={{ backgroundColor: '#ffffff', height: 48, fontSize: 13 }}
                          outlineColor={splitMethod1 === 'cash' ? '#16a34a' : splitMethod1 === 'phonepe' ? '#8b5cf6' : '#3b82f6'}
                          activeOutlineColor={splitMethod1 === 'cash' ? '#16a34a' : splitMethod1 === 'phonepe' ? '#8b5cf6' : '#3b82f6'}
                          right={splitAmount1 ? <TextInput.Icon icon={() => <CheckCircle2 size={20} color="#16a34a" />} /> : null}
                          textColor="#000000"
                          placeholderTextColor="#000000"
                        />
                      </View>

                      {/* Split 2 */}
                      <View style={styles.exactSplitRow}>
                        <View style={styles.exactSegmentedControl}>
                          {['cash', 'phonepe', 'card'].map((m) => {
                            const isActive = splitMethod2 === m;
                            let bg = '#ffffff';
                            let color = '#64748b';
                            if (isActive) {
                              if (m === 'cash') { bg = '#3b82f6'; color = '#ffffff'; }
                              if (m === 'phonepe') { bg = '#8b5cf6'; color = '#ffffff'; }
                              if (m === 'card') { bg = '#3b82f6'; color = '#ffffff'; }
                            }
                            return (
                              <TouchableOpacity
                                key={`s2-${m}`}
                                style={[styles.exactSegmentBtn, { backgroundColor: bg, borderRightWidth: m === 'card' ? 0 : 1 }]}
                                onPress={() => setSplitMethod2(m)}
                              >
                                <Text style={[styles.exactSegmentText, { color }]}>
                                  {m === 'phonepe' ? 'PhonePe' : m.charAt(0).toUpperCase() + m.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TextInput
                          mode="outlined"
                          label={`Amount for ${splitMethod2.toUpperCase()} (₹)`}
                          keyboardType="numeric"
                          value={splitAmount2}
                          onChangeText={setSplitAmount2}
                          style={{ backgroundColor: '#ffffff', height: 48, fontSize: 13 }}
                          outlineColor={splitMethod2 === 'cash' ? '#16a34a' : splitMethod2 === 'phonepe' ? '#8b5cf6' : '#3b82f6'}
                          activeOutlineColor={splitMethod2 === 'cash' ? '#16a34a' : splitMethod2 === 'phonepe' ? '#8b5cf6' : '#3b82f6'}
                          right={splitAmount2 ? <TextInput.Icon icon={() => <CheckCircle2 size={20} color="#16a34a" />} /> : null}
                          textColor="#000000"
                          placeholderTextColor="#000000"
                        />
                      </View>

                      <View style={styles.exactSplitTotalRow}>
                        <Text style={styles.exactSplitTotalLabel}>Total</Text>
                        <Text style={[styles.exactSplitTotalValue, { color: (parseFloat(splitAmount1 || 0) + parseFloat(splitAmount2 || 0)) === parseFloat(patient?.medicineFeeRequested) ? '#16a34a' : '#ef4444' }]}>
                          ₹{parseFloat(splitAmount1 || 0) + parseFloat(splitAmount2 || 0)} / ₹{patient?.medicineFeeRequested}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.exactInfoBox}>
                    <Info size={16} color="#3b82f6" />
                    <Text style={styles.exactInfoText}>Please verify the payment details before collecting the fee.</Text>
                  </View>

                  <TouchableOpacity style={styles.exactSubmitBtn} onPress={handleCollectMedicineFee}>
                    <Wallet size={20} color="#ffffff" />
                    <Text style={styles.exactSubmitBtnText}>Collect Medicine Fee</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Surface>
          )}

          {/* Nutrition Plan Billing Card for Receptionist */}
          {userData?.role !== 'doctor' && (
            <Surface style={styles.exactCard}>
              <View style={styles.exactHeaderRow}>
                <View style={[styles.exactIconCircle, { backgroundColor: '#f0fdf4' }]}>
                  <PlusCircle size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exactTitle}>Nutrition & Diet Plan</Text>
                  <Text style={styles.exactSubtitle}>Create, manage, and collect payment for 30-Day Diet Plan</Text>
                </View>
              </View>

              {nutritionPlan ? (
                <>
                  <View style={styles.exactRowBetween}>
                    <Text style={styles.exactRowLabel}>Payment Status</Text>
                    {nutritionPlan.paymentStatus === 'paid' ? (
                      <View style={[styles.exactStatusPill, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.exactStatusText, { color: '#16a34a' }]}>PAID</Text>
                      </View>
                    ) : (
                      <View style={[styles.exactStatusPill, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.exactStatusText, { color: '#ef4444' }]}>NOT PAID</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.exactRowBetween, { marginTop: 16 }]}>
                    <Text style={styles.exactRowLabel}>Nutrition Fee (₹)</Text>
                    <Text style={styles.exactAmountText}>₹{nutritionPlan.amount}</Text>
                  </View>

                  <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>Prescription Intake Details:</Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>Age: {nutritionPlan.age} yrs | BMI: {nutritionPlan.bmi} | Height: {nutritionPlan.height} cm | Weight: {nutritionPlan.weight} kg</Text>
                    {nutritionPlan.deficiencies && nutritionPlan.deficiencies.length > 0 && (
                      <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Deficiencies: {nutritionPlan.deficiencies.join(', ')}</Text>
                    )}
                  </View>

                  {!showNutritionEditor && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-end', marginTop: 12 }}
                      onPress={() => {
                        handleLoadNutritionPlanForEdit(nutritionPlan);
                        setShowNutritionEditor(true);
                      }}
                    >
                      <Text style={{ color: COLORS.secondary, fontSize: 12, fontWeight: '700' }}>Edit / View Diet Plan</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                !showNutritionEditor && (
                  <View style={{ marginTop: 16 }}>
                    <Button
                      mode="contained"
                      buttonColor={COLORS.primary}
                      textColor="white"
                      onPress={() => {
                        handleResetNutritionForm();
                        if (patient?.age) setNutriAge(String(patient.age));
                        setShowNutritionEditor(true);
                      }}
                      icon={({ size, color }) => <Plus size={size} color={color} />}
                    >
                      Create 30-Day Diet Plan
                    </Button>
                  </View>
                )
              )}

              {showNutritionEditor && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
                    {canAccessClinical ? 'Edit Nutrition Details' : 'View Nutrition Details'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Age (yrs)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriAge}
                        onChangeText={setNutriAge}
                        editable={nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Height (cm)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriHeight}
                        onChangeText={setNutriHeight}
                        editable={nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Weight (kg)</Text>
                      <RNTextInput
                        style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1' }}
                        keyboardType="numeric"
                        value={nutriWeight}
                        onChangeText={setNutriWeight}
                        editable={nutritionPlan?.paymentStatus !== 'paid'}
                      />
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>Computed BMI: {nutriBmi}</Text>
                  </View>

                  <Text style={styles.fieldLabel}>Deficiencies Checklist</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D", "Vitamin E", "Vitamin K", "Calcium", "Potassium", "Magnesium", "Zinc", "Iron", "Sodium", "Protein", "Manganese", "Phosphorus"].map((def) => {
                      const isSelected = nutriDeficiencies.includes(def);
                      return (
                        <TouchableOpacity
                          key={def}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isSelected ? COLORS.secondary : COLORS.border,
                            backgroundColor: isSelected ? COLORS.secondary + '15' : 'white'
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setNutriDeficiencies(nutriDeficiencies.filter(d => d !== def));
                            } else {
                              setNutriDeficiencies([...nutriDeficiencies, def]);
                            }
                          }}
                          disabled={nutritionPlan?.paymentStatus === 'paid'}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? COLORS.secondary : COLORS.text }}>
                            {def}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>Disorders / Conditions</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {["Sugar (Diabetes)", "High BP (Hypertension)", "Thyroid", "Gastritis", "IBS / IBD", "SIBO", "Bloating", "Acidity", "Piles", "PCOD", "Insulin Resistance", "Hairfall", "Melasma", "Weight Gain", "Weight Loss", "Height Growth", "Adenoids / Tonsillitis", "Allergies"].map((disorder) => {
                      const isSelected = nutriDisorders.includes(disorder);
                      return (
                        <TouchableOpacity
                          key={disorder}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isSelected ? COLORS.primary : COLORS.border,
                            backgroundColor: isSelected ? COLORS.primary + '15' : 'white'
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setNutriDisorders(nutriDisorders.filter(d => d !== disorder));
                            } else {
                              setNutriDisorders([...nutriDisorders, disorder]);
                            }
                          }}
                          disabled={nutritionPlan?.paymentStatus === 'paid'}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? COLORS.primary : COLORS.text }}>
                            {disorder}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Other Diseases / Disorders</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Enter other health conditions..."
                    value={nutriOtherDiseases}
                    onChangeText={setNutriOtherDiseases}
                    style={{ backgroundColor: '#fff', marginBottom: 12 }}
                    activeOutlineColor={COLORS.secondary}
                    editable={nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Signs & Symptoms</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Enter patient symptoms..."
                    value={nutriSymptoms}
                    onChangeText={setNutriSymptoms}
                    style={{ backgroundColor: '#fff', marginBottom: 12 }}
                    activeOutlineColor={COLORS.secondary}
                    editable={nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Foods to Eat</Text>
                  <TextInput
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    placeholder="Recommended foods..."
                    value={nutriEat}
                    onChangeText={setNutriEat}
                    style={[styles.textArea, { marginBottom: 12 }]}
                    activeOutlineColor={COLORS.secondary}
                    editable={nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Foods to Avoid</Text>
                  <TextInput
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    placeholder="Foods to avoid..."
                    value={nutriAvoid}
                    onChangeText={setNutriAvoid}
                    style={[styles.textArea, { marginBottom: 12 }]}
                    activeOutlineColor={COLORS.secondary}
                    editable={nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>Nutrition Fee Amount (₹)</Text>
                  <RNTextInput
                    style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, height: 40, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 12, opacity: (nutritionPlan?.paymentStatus !== 'paid') ? 1 : 0.7 }}
                    keyboardType="numeric"
                    value={nutriAmount}
                    onChangeText={setNutriAmount}
                    editable={nutritionPlan?.paymentStatus !== 'paid'}
                  />

                  <Text style={styles.fieldLabel}>30-Day Diet Plan Meals</Text>
                  <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, backgroundColor: '#f8fafc', marginBottom: 16 }}>
                    {nutriMeals.map((meal, index) => (
                      <View key={index} style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 12 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 11, color: COLORS.secondary, marginBottom: 4 }}>Day {meal.dayNumber}</Text>

                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Breakfast:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.breakfast}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'breakfast', val)}
                              editable={nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Lunch:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.lunch}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'lunch', val)}
                              editable={nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Snacks:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.snacks}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'snacks', val)}
                              editable={nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ width: 70, fontSize: 10, color: COLORS.muted }}>Dinner:</Text>
                            <RNTextInput
                              style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 }}
                              value={meal.dinner}
                              onChangeText={(val) => handleMealCellChange(meal.dayNumber, 'dinner', val)}
                              editable={nutritionPlan?.paymentStatus !== 'paid'}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  {nutritionPlan?.paymentStatus === 'paid' ? (
                    <Button
                      mode="contained"
                      buttonColor={COLORS.secondary}
                      textColor="white"
                      style={{ flex: 1 }}
                      onPress={() => setShowNutritionEditor(false)}
                    >
                      Close View
                    </Button>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        mode="outlined"
                        textColor={COLORS.danger}
                        style={{ flex: 1, borderColor: COLORS.danger }}
                        onPress={handleResetNutritionForm}
                      >
                        Cancel
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={COLORS.primary}
                        textColor="white"
                        style={{ flex: 1 }}
                        loading={submittingNutrition}
                        onPress={handleSaveNutritionPlan}
                      >
                        Save Edits
                      </Button>
                    </View>
                  )}
                </View>
              )}

              {nutritionPlan && (
                <>
                  <View style={styles.exactDashedDivider} />

                  {nutritionPlan.paymentStatus === 'paid' && (
                    <View style={{ alignItems: 'center', paddingVertical: 15 }}>
                      <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: 12 }} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>Diet Service Payment Received</Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                        Method: {nutritionPlan.paymentMethod?.toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={handleShareNutritionReceiptWhatsApp}
                        >
                          <WhatsAppIcon size={12} color="#25d366" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#047857', fontSize: 11, fontWeight: '700' }}>Share Inv</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={handleShareNutritionReceiptPDF}
                        >
                          <FileText size={12} color="#258ec8" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '700' }}>PDF Receipt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={handleShareNutritionDietWhatsApp}
                        >
                          <Apple size={12} color="#d97706" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#b45309', fontSize: 11, fontWeight: '700' }}>Share Diet</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </Surface>
          )}

          {/* ── SHARED MEDIA & EDUCATION ────────────────────────── */}
          <Surface style={styles.complaintCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FolderOpen size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>Shared Media & Education</Text>
                {uploadingMedia && <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginLeft: 8 }} />}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => setShowShareModal(true)}
                >
                  <Text style={{ color: '#8fb82e', fontSize: 11, fontWeight: '700' }}>Share Global</Text>
                </TouchableOpacity>
              </View>
            </View>

            {uploadingMedia && (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#eff6ff', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe' }}>
                <ActivityIndicator color={COLORS.secondary} size="small" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 12, color: COLORS.secondary, fontWeight: '600' }}>{uploadProgress}</Text>
              </View>
            )}

            {/* Merge private patient folders and shared global folders */}
            {(() => {
              // We only display folders that belong to this patient privately, 
              // or global folders that have been explicitly shared with this patient.
              const foldersToShow = [...patientFolders];

              sharedItems.forEach(si => {
                if (si.type === 'folder') {
                  const globalF = globalFolders.find(gf => gf.id === si.folderId);
                  if (globalF && !foldersToShow.some(f => f.id === globalF.id)) {
                    foldersToShow.push({ ...globalF, isGlobalShared: true });
                  }
                }
              });

              // Standalone items that are explicitly shared
              const standaloneItems = sharedItems
                .filter(si => si.type === 'item')
                .map(si => {
                  const gi = globalItems.find(g => g.id === si.itemId);
                  return gi ? { ...gi, isGlobalShared: true } : null;
                })
                .filter(Boolean);

              if (foldersToShow.length === 0 && standaloneItems.length === 0) {
                return <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>No shared media or educational folders.</Text>;
              }

              return (
                <View style={{ marginTop: 4 }}>
                  {foldersToShow.map((folder) => {
                    const isExpanded = expandedSharedFolder === folder.id;
                    const fItems = folderItems[folder.id] || [];
                    return (
                      <View key={folder.id} style={{ marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white, overflow: 'hidden' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc' }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                            onPress={() => setExpandedSharedFolder(isExpanded ? null : folder.id)}
                          >
                            <Folder size={20} color={folder.isGlobalShared ? COLORS.secondary : COLORS.primary} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }} numberOfLines={1} ellipsizeMode="tail">{folder.name}</Text>
                              <Text style={{ fontSize: 10, color: COLORS.muted }}>{folder.isGlobalShared ? 'Shared Library Folder' : 'Private Patient Folder'}</Text>
                            </View>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleDeletePatientFolder(folder.id, folder.isGlobalShared, folder.name)}
                              style={{ backgroundColor: COLORS.danger + '15', padding: 6, borderRadius: 6 }}
                            >
                              <Trash2 size={14} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {isExpanded && (
                          <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                            {fItems.length === 0 ? (
                              <Text style={{ color: COLORS.muted, fontSize: 12, paddingVertical: 6, textAlign: 'center' }}>No media files in this folder.</Text>
                            ) : (
                              fItems.map((item) => (
                                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                                    onPress={() => Linking.openURL(item.url)}
                                  >
                                    {item.type === 'video' ? <FileVideo size={16} color={COLORS.secondary} /> : <ImageIcon size={16} color={COLORS.primary} />}
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                                  </TouchableOpacity>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity onPress={() => handleDeletePatientItem(item, folder.isGlobalShared)}>
                                      <Trash2 size={14} color={COLORS.danger} style={{ marginLeft: 8 }} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Standalone Shared Items */}
                  {standaloneItems.length > 0 && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>Individual Shared Media:</Text>
                      {standaloneItems.map((item) => (
                        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                            onPress={() => Linking.openURL(item.url)}
                          >
                            {item.type === 'video' ? <FileVideo size={16} color={COLORS.secondary} /> : <ImageIcon size={16} color={COLORS.primary} />}
                            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeletePatientItem(item, true)}>
                            <Trash2 size={14} color={COLORS.danger} style={{ marginLeft: 8 }} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
          </Surface>

          {/* Medical History Section */}
          <Surface style={styles.historyCard}>
            <View style={styles.sectionHeader}>
              <Calendar size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Medical History</Text>
            </View>

            {historyLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : medicalHistory.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <AlertCircle size={28} color={COLORS.muted} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyHistoryText}>No previous visits recorded for this patient.</Text>
              </View>
            ) : (
              medicalHistory.map((visit, idx) => (
                <View key={visit.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyDate}>
                      {visit.appointmentDate || (visit.completedAt ? new Date(visit.completedAt).toLocaleDateString() : 'Previous Visit')}
                    </Text>
                    <View style={styles.historyBranchChip}>
                      <Text style={styles.historyBranchChipText}>
                        {visit.branchName || 'Main Branch'}
                      </Text>
                    </View>
                  </View>
                  {visit.diagnosisDrawingUrl ? (
                    <View style={{ marginVertical: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: COLORS.text, marginBottom: 6 }}>Diagnosis Drawing:</Text>
                      <Image source={{ uri: visit.diagnosisDrawingUrl }} style={{ width: '100%', height: 160, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border }} />
                    </View>
                  ) : visit.diagnosisNotes ? (
                    <Text style={styles.historyNotes}>
                      <Text style={{ fontWeight: '700' }}>Diagnosis: </Text>
                      {visit.diagnosisNotes}
                    </Text>
                  ) : null}

                  {visit.prescriptionUrls && visit.prescriptionUrls.length > 0 ? (
                    <View style={{ marginVertical: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: COLORS.text, marginBottom: 6 }}>Uploaded Prescriptions:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {visit.prescriptionUrls.map((url, i) => (
                          <TouchableOpacity key={i} onPress={() => { setLightboxImages(visit.prescriptionUrls); setLightboxIndex(i); }}>
                            <Image source={{ uri: url }} style={{ width: 120, height: 160, borderRadius: 8, marginRight: 8, resizeMode: 'cover', borderWidth: 1, borderColor: COLORS.border }} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : visit.prescriptionUrl ? (
                    <View style={{ marginVertical: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: COLORS.text, marginBottom: 6 }}>Uploaded Prescription:</Text>
                      <TouchableOpacity onPress={() => { setLightboxImages([visit.prescriptionUrl]); setLightboxIndex(0); }}>
                        <Image source={{ uri: visit.prescriptionUrl }} style={{ width: 120, height: 160, borderRadius: 8, resizeMode: 'cover', borderWidth: 1, borderColor: COLORS.border }} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {visit.medicines && visit.medicines.length > 0 ? (
                    <View style={styles.historyMedList}>
                      <Text style={styles.historyMedTitle}>Medicines Prescribed:</Text>
                      {visit.medicines.map((m, mIdx) => (
                        <Text key={mIdx} style={styles.historyMedItem}>
                          • {m.name} ({m.dosage}) - {m.duration} {m.price ? `(₹${m.price})` : ''}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {idx < medicalHistory.length - 1 && <View style={styles.historyDivider} />}
                </View>
              ))
            )}
          </Surface>

          {/* Receptionist Final Checkout Button removed as per request */}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Queue Status Choice Dialog */}
        <Portal>
          {/* Modal: Create Folder */}
          <Modal visible={showCreateFolderModal} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Surface style={{ width: '100%', backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }}>Create Private Folder</Text>
                  <TouchableOpacity onPress={() => setShowCreateFolderModal(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
                </View>
                <RNTextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 20 }}
                  placeholder="e.g. Diet Plan Files"
                  value={privateFolderName}
                  onChangeText={setPrivateFolderName}
                  placeholderTextColor="#94a3b8"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                  <Button mode="outlined" onPress={() => setShowCreateFolderModal(false)} textColor={COLORS.secondary}>Cancel</Button>
                  <Button mode="contained" onPress={handleCreatePrivateFolder} buttonColor={COLORS.secondary} textColor="white">Create</Button>
                </View>
              </Surface>
            </View>
          </Modal>

          {/* Modal: Share Global Media */}
          <Modal visible={showShareModal} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Surface style={{ width: '100%', maxHeight: '80%', backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }}>Share Global Library Media</Text>
                  <TouchableOpacity onPress={() => setShowShareModal(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
                </View>

                <ScrollView style={{ flexShrink: 1, marginBottom: 20, width: '100%' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 10 }}>GLOBAL LIBRARY FOLDERS:</Text>
                  {globalFolders.length === 0 ? (
                    <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 20 }}>No global folders found. (Items found: {globalItems.length}) - Please ensure you are connected.</Text>
                  ) : (
                    globalFolders.map((folder) => {
                      const isShared = sharedItems.some(si => si.type === 'folder' && si.folderId === folder.id);
                      const fItems = globalItems.filter(item => item.folderId === folder.id);

                      return (
                        <View key={folder.id} style={{ marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc' }}
                            onPress={() => setExpandedGlobalFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                              {expandedGlobalFolders[folder.id] ? (
                                <LucideIcons.ChevronDown size={18} color={COLORS.muted} />
                              ) : (
                                <LucideIcons.ChevronRight size={18} color={COLORS.muted} />
                              )}
                              <Folder size={18} color={COLORS.secondary} />
                              <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{folder.name}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={async () => {
                                if (isShared) {
                                  await unshareGlobalMedia('folder', folder.id);
                                } else {
                                  await handleShareGlobalMedia('folder', folder.id);
                                }
                              }}
                              style={{ padding: 6, marginLeft: 10 }}
                            >
                              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isShared ? COLORS.secondary : COLORS.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: isShared ? COLORS.secondary : 'transparent' }}>
                                {isShared && <CheckCircle2 size={14} color="white" />}
                              </View>
                            </TouchableOpacity>
                          </TouchableOpacity>

                          {expandedGlobalFolders[folder.id] && (
                            <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white }}>
                              {fItems.length === 0 ? (
                                <Text style={{ color: COLORS.muted, fontSize: 12, paddingVertical: 6, textAlign: 'center' }}>No media files in this folder.</Text>
                              ) : (
                                fItems.map((item) => {
                                  const isItemShared = sharedItems.some(si => si.type === 'item' && si.itemId === item.id);
                                  return (
                                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        {item.type === 'video' ? <FileVideo size={16} color={COLORS.secondary} /> : <ImageIcon size={16} color={COLORS.primary} />}
                                        <Text style={{ fontSize: 12, color: COLORS.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                                      </View>
                                      <TouchableOpacity
                                        onPress={async () => {
                                          if (isItemShared) {
                                            await unshareGlobalMedia('item', item.id);
                                          } else {
                                            await handleShareGlobalMedia('item', item.id);
                                          }
                                        }}
                                        style={{ padding: 6, marginLeft: 10 }}
                                      >
                                        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: isItemShared ? COLORS.secondary : COLORS.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: isItemShared ? COLORS.secondary : 'transparent' }}>
                                          {isItemShared && <CheckCircle2 size={12} color="white" />}
                                        </View>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}

                  {globalItems.filter(item => !globalFolders.find(f => f.id === item.folderId)).length > 0 && (
                    <View style={{ marginTop: 15 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 10 }}>UNFOLDERED MEDIA:</Text>
                      {globalItems.filter(item => !globalFolders.find(f => f.id === item.folderId)).map((item) => {
                        const isShared = sharedItems.some(si => si.type === 'item' && si.itemId === item.id);
                        return (
                          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              {item.type === 'video' ? <FileVideo size={16} color={COLORS.secondary} /> : <ImageIcon size={16} color={COLORS.primary} />}
                              <Text style={{ fontSize: 12, color: COLORS.text }} numberOfLines={1}>{item.title}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={async () => {
                                if (isShared) {
                                  await unshareGlobalMedia('item', item.id);
                                } else {
                                  await handleShareGlobalMedia('item', item.id);
                                }
                              }}
                              style={{ padding: 10 }}
                            >
                              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isShared ? COLORS.secondary : COLORS.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: isShared ? COLORS.secondary : 'transparent' }}>
                                {isShared && <CheckCircle2 size={16} color="white" />}
                              </View>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <Button mode="outlined" onPress={() => setShowShareModal(false)} textColor={COLORS.secondary}>Close</Button>
                </View>
              </Surface>
            </View>
          </Modal>
          <Dialog visible={statusDialogVisible} onDismiss={() => setStatusDialogVisible(false)} style={styles.dialog}>
            <Dialog.Title style={styles.dialogTitle}>Select Queue Status</Dialog.Title>
            <Dialog.Content>
              <TouchableOpacity style={styles.dialogItem} onPress={() => updateStatus('waiting')}>
                <View style={[styles.bullet, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.dialogItemText}>Waiting (Queue)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogItem} onPress={() => updateStatus('in-consultation')}>
                <View style={[styles.bullet, { backgroundColor: COLORS.secondary }]} />
                <Text style={styles.dialogItemText}>In Consultation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogItem} onPress={() => updateStatus('completed')}>
                <View style={[styles.bullet, { backgroundColor: COLORS.success }]} />
                <Text style={styles.dialogItemText}>Completed</Text>
              </TouchableOpacity>
            </Dialog.Content>
          </Dialog>
          <Dialog visible={showMedDiscountModal} onDismiss={() => setShowMedDiscountModal(false)} style={styles.dialog}>
            <Dialog.Title style={styles.dialogTitle}>Request HR Discount</Dialog.Title>
            <Dialog.Content>
              <Text style={{ marginBottom: 12, color: COLORS.text, fontSize: 14, fontWeight: '600' }}>
                Original Fee: ₹{patient?.medicineFeeRequested}
              </Text>
              <TextInput
                mode="outlined"
                label="New Requested Amount (₹)"
                keyboardType="numeric"
                value={medDiscountReqAmount}
                onChangeText={setMedDiscountReqAmount}
                style={{ marginBottom: 16, backgroundColor: '#fff' }}
                activeOutlineColor={COLORS.secondary}
              />
              <TextInput
                mode="outlined"
                label="Reason / Note"
                value={medDiscountNote}
                onChangeText={setMedDiscountNote}
                style={{ marginBottom: 16, backgroundColor: '#fff' }}
                activeOutlineColor={COLORS.secondary}
              />
              <Button
                mode="contained"
                buttonColor={COLORS.secondary}
                onPress={handleRequestMedicineDiscount}
                disabled={loading}
                loading={loading}
                style={{ borderRadius: 8 }}
              >
                Send Request to HR
              </Button>
            </Dialog.Content>
          </Dialog>

          <Dialog visible={showNutriDiscountModal} onDismiss={() => setShowNutriDiscountModal(false)} style={styles.dialog}>
            <Dialog.Title style={styles.dialogTitle}>Request HR Diet Plan Discount</Dialog.Title>
            <Dialog.Content>
              <Text style={{ marginBottom: 12, color: COLORS.text, fontSize: 14, fontWeight: '600' }}>
                Original Diet Plan Fee: ₹{nutritionPlan?.amount || 0}
              </Text>
              <TextInput
                mode="outlined"
                label="New Requested Amount (₹)"
                keyboardType="numeric"
                value={nutriDiscountReqAmount}
                onChangeText={setNutriDiscountReqAmount}
                style={{ marginBottom: 16, backgroundColor: '#fff' }}
                activeOutlineColor={COLORS.secondary}
              />
              <TextInput
                mode="outlined"
                label="Reason / Note"
                value={nutriDiscountNote}
                onChangeText={setNutriDiscountNote}
                style={{ marginBottom: 16, backgroundColor: '#fff' }}
                activeOutlineColor={COLORS.secondary}
              />
              <Button
                mode="contained"
                buttonColor={COLORS.secondary}
                onPress={handleRequestNutritionDiscount}
                disabled={loading}
                loading={loading}
                style={{ borderRadius: 8 }}
              >
                Send Request to HR
              </Button>
            </Dialog.Content>
          </Dialog>

          {/* Doctor Add Package Modal */}
          <Modal visible={addPackageModalVisible} animationType="slide" transparent={true}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Register Patient in Package</Text>
                  <TouchableOpacity onPress={() => setAddPackageModalVisible(false)}>
                    <X size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>

                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Total Package Amount (₹) *</Text>
                  <RNTextInput
                    style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.text, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}
                    placeholder="Enter total package cost"
                    keyboardType="numeric"
                    value={newPkgTotal}
                    onChangeText={setNewPkgTotal}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Initial Advance Paid (₹)</Text>
                  <RNTextInput
                    style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.text, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}
                    placeholder="Enter initial paid amount"
                    keyboardType="numeric"
                    value={newPkgPaid}
                    onChangeText={setNewPkgPaid}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Package Duration</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }} onPress={() => setShowNewPkgStartPicker(true)}>
                      <Calendar size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                      <View>
                        <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '700' }}>Start Date</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 2 }}>{newPkgStartDate.toISOString().split('T')[0]}</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }} onPress={() => setShowNewPkgEndPicker(true)}>
                      <Calendar size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                      <View>
                        <Text style={{ fontSize: 9, color: COLORS.muted, fontWeight: '700' }}>End Date</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 2 }}>{newPkgEndDate.toISOString().split('T')[0]}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {showNewPkgStartPicker && (
                    <DateTimePicker
                      value={newPkgStartDate}
                      mode="date"
                      display="default"
                      onValueChange={(event, selectedDate) => {
                        setShowNewPkgStartPicker(false);
                        if (selectedDate) setNewPkgStartDate(selectedDate);
                      }}
                    />
                  )}

                  {showNewPkgEndPicker && (
                    <DateTimePicker
                      value={newPkgEndDate}
                      mode="date"
                      display="default"
                      onValueChange={(event, selectedDate) => {
                        setShowNewPkgEndPicker(false);
                        if (selectedDate) setNewPkgEndDate(selectedDate);
                      }}
                    />
                  )}

                  <Button
                    mode="contained"
                    buttonColor={COLORS.secondary}
                    textColor="white"
                    onPress={handleCreatePackageFromDetails}
                    style={{ marginTop: 20, borderRadius: 10, paddingVertical: 4 }}
                  >
                    Create Package Membership
                  </Button>
                </ScrollView>
              </View>
            </View>
          </Modal>
          {/* Lightbox Modal */}
          {lightboxIndex >= 0 && lightboxImages.length > 0 && (
            <Modal
              visible={lightboxIndex >= 0}
              transparent={true}
              animationType="fade"
              onRequestClose={() => { setLightboxIndex(-1); setLightboxRotation(0); }}
            >
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {/* Top Close Button and Page Counter */}
                <View style={{
                  position: 'absolute',
                  top: 40,
                  left: 20,
                  right: 20,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 10
                }}>
                  <Text style={{
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 15
                  }}>
                    {lightboxIndex + 1} of {lightboxImages.length}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => setLightboxRotation(prev => prev + 90)}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        width: 36,
                        height: 36,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>⟳</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setLightboxIndex(-1); setLightboxRotation(0); }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        width: 36,
                        height: 36,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <X size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Left Side Navigation Arrow */}
                {lightboxImages.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      const prevIdx = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
                      setLightboxIndex(prevIdx);
                      setLightboxRotation(0);
                      lightboxScrollRef.current?.scrollTo({ x: prevIdx * SCREEN_W, animated: true });
                    }}
                    style={{
                      position: 'absolute',
                      left: 15,
                      top: '50%',
                      marginTop: -22,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 22,
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 20
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 28, fontWeight: '300' }}>‹</Text>
                  </TouchableOpacity>
                )}

                {/* Right Side Navigation Arrow */}
                {lightboxImages.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      const nextIdx = (lightboxIndex + 1) % lightboxImages.length;
                      setLightboxIndex(nextIdx);
                      setLightboxRotation(0);
                      lightboxScrollRef.current?.scrollTo({ x: nextIdx * SCREEN_W, animated: true });
                    }}
                    style={{
                      position: 'absolute',
                      right: 15,
                      top: '50%',
                      marginTop: -22,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 22,
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 20
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 28, fontWeight: '300' }}>›</Text>
                  </TouchableOpacity>
                )}

                {/* Swipable Image ScrollView */}
                <ScrollView
                  ref={lightboxScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  contentOffset={{ x: lightboxIndex * SCREEN_W, y: 0 }}
                  onMomentumScrollEnd={(e) => {
                    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                    setLightboxIndex(newIdx);
                    setLightboxRotation(0);
                  }}
                  style={{ width: SCREEN_W, height: '100%' }}
                  contentContainerStyle={{ alignItems: 'center' }}
                >
                  {lightboxImages.map((url, index) => (
                    <View key={index} style={{ width: SCREEN_W, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                      <Image
                        source={{ uri: url }}
                        style={{
                          width: SCREEN_W - 20,
                          height: '80%',
                          resizeMode: 'contain',
                          transform: [{ rotate: `${lightboxRotation}deg` }],
                          backgroundColor: '#ffffff',
                          borderRadius: 8
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            </Modal>
          )}
        </Portal>
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
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  content: { padding: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loaderText: { marginTop: 12, color: COLORS.muted, fontWeight: '600' },
  profileCard: { padding: 16, borderRadius: 20, backgroundColor: COLORS.white, elevation: 3, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  profileMeta: { marginLeft: 12, flex: 1 },
  patientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  regIdText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    height: 22,
    marginVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
  },
  genderChip: { backgroundColor: '#f1f5f9', height: 22, borderRadius: 6 },
  genderChipText: { fontSize: 9, color: COLORS.muted, fontWeight: '700' },
  statusIndicator: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  statusText: { fontSize: 8, fontWeight: '800', color: 'white' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: COLORS.text, fontWeight: '500', flex: 1, flexShrink: 1 },
  complaintCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  complaintText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  statusControlCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  statusDescription: { fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 18 },
  statusActionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, borderRadius: 12 },
  clinicalCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  tabToggleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 12 },
  tabToggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabToggleBtnActive: { backgroundColor: 'white', elevation: 1 },
  tabToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  tabToggleTextActive: { color: COLORS.secondary, fontWeight: '700' },
  canvasContainer: { height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  textArea: { backgroundColor: 'white', fontSize: 14, minHeight: 180, textAlignVertical: 'top', marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addRowBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  medHeaderRow: { flexDirection: 'row', marginBottom: 6, paddingHorizontal: 4 },
  medHeaderCell: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  medInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  medInputCell: { backgroundColor: 'white', height: 38, fontSize: 12 },
  deleteRowBtn: { width: 30, height: 38, justifyContent: 'center', alignItems: 'center' },
  physicalPrescPreview: { marginTop: 8, alignItems: 'center' },
  physicalPrescImage: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' },
  uploadArea: { marginTop: 8, marginBottom: 16 },
  uploadBox: { borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: '#f8fafc' },
  uploadBoxTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  uploadBoxSub: { fontSize: 10, color: COLORS.muted, textAlign: 'center' },
  followUpRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  subLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 4, fontWeight: '600' },
  pickerWrapper: { height: 40, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: 'white', justifyContent: 'center' },
  pickerSelector: { paddingHorizontal: 12, paddingVertical: 10 },
  pickerSelectorText: { fontSize: 13, color: COLORS.text },
  followUpInput: { backgroundColor: 'white', height: 40 },
  totalAmountContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, marginVertical: 16 },
  totalAmountLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  totalAmountVal: { fontSize: 16, fontWeight: '800', color: COLORS.success },
  savePrescBtn: { borderRadius: 12, paddingVertical: 4 },
  historyCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  emptyHistoryBox: { paddingVertical: 20, alignItems: 'center' },
  emptyHistoryText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  historyItem: { paddingVertical: 12 },
  historyItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  historyDate: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  historyBranchChip: { backgroundColor: '#f1f5f9', height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  historyBranchChipText: { fontSize: 9, color: COLORS.muted, fontWeight: '700' },
  historyNotes: { fontSize: 12, color: COLORS.text, lineHeight: 18, marginBottom: 6 },
  historyMedList: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  historyMedTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginBottom: 4 },
  historyMedItem: { fontSize: 11, color: COLORS.text, lineHeight: 16 },
  historyDivider: { height: 1, backgroundColor: COLORS.border, marginTop: 14 },
  dialog: { borderRadius: 20, backgroundColor: 'white' },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  dialogItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  bullet: { width: 12, height: 12, borderRadius: 6, marginRight: 16 },
  dialogItemText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  feeCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, elevation: 2, marginBottom: 16 },
  feeStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  feeStatusLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  paymentChip: { height: 28, borderRadius: 8 },
  paymentRecordedBox: { padding: 16, borderRadius: 16, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  recordedText: { fontSize: 14, color: COLORS.text, marginBottom: 4 },
  recordedSub: { fontSize: 11, color: COLORS.muted },
  collectFeeForm: { gap: 14 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  amountTextInput: { width: 140, height: 40, backgroundColor: 'white' },
  methodLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodButton: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: '#f8fafc' },
  methodButtonSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary + '15' },
  methodButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  methodButtonTextSelected: { color: COLORS.secondary },
  recordPaymentBtn: { borderRadius: 12, marginTop: 8 },
  exactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  exactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  exactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  exactTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  exactSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  exactRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exactRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  exactStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exactStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  exactAmountText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  exactDashedDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    marginVertical: 24,
  },
  exactMethodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  exactGridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  exactMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  exactMethodBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  exactMethodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 12,
  },
  exactMethodBtnTextActive: {
    color: '#2563eb',
  },
  exactPhonePeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5e2096',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exactPhonePeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exactSplitContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  exactSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exactSplitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 8,
  },
  exactSplitRow: {
    marginBottom: 20,
  },
  exactSegmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  exactSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderColor: '#e2e8f0',
  },
  exactSegmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  exactSplitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 16,
  },
  exactSplitTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  exactSplitTotalValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  exactInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  exactInfoText: {
    fontSize: 12,
    color: '#334155',
    marginLeft: 10,
    flex: 1,
  },
  exactSubmitBtn: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  exactSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
  },
});

export default PatientDetails;
