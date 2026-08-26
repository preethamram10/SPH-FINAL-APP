const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAohSNLyeS6bYtnk2QvB4HGo0LbHDw9b6Q",
  projectId: "spiritual-homeopathy-3b552",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkRevenue() {
  console.log("Fetching from Firestore...");
  
  const pSnap = await getDocs(collection(db, 'patients'));
  const allpSnap = await getDocs(collection(db, 'allpatients'));
  const tSnap = await getDocs(collection(db, 'alltransactions'));
  const mfSnap = await getDocs(collection(db, 'medicine_forms'));
  const npSnap = await getDocs(collection(db, 'nutrition_plans'));
  
  let totalRawAmount = 0;
  
  const patients = [];
  pSnap.forEach(d => patients.push({id: d.id, ...d.data()}));
  allpSnap.forEach(d => patients.push({id: d.id, ...d.data()}));
  
  const paidItemsMap = new Map();
  const list = [];
  
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
  
  const parseD = (raw) => {
    if (!raw) return null;
    if (raw.toDate) return raw.toDate();
    if (raw.seconds) return new Date(raw.seconds * 1000);
    return new Date(raw);
  };
  
  // 1. Patients (Consultations)
  patients.forEach(p => {
    if (p.paymentStatus !== 'paid') return;
    
    let amount = Number(p.paymentAmount || p.amountPaid || p.amount || p.totalAmount || p.consultationFee || 0);
    if (p.itemsPaid) {
      const cons = Number(p.itemsPaid.consultation || 0);
      const med = Number(p.itemsPaid.medicine || 0);
      const diet = Number(p.itemsPaid.dietPlan || 0);
      let other = 0;
      if (Array.isArray(p.itemsPaid.otherFees)) {
        other = p.itemsPaid.otherFees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
      }
      const totalItems = cons + med + diet + other;
      if (totalItems > 0) amount = totalItems;
    }
    
    const d = parseD(p.paymentCollectedAt || p.appointmentDate || p.createdAt || p.date);
    const timestamp = d ? d.getTime() : 0;
    
    const k1 = p.id ? `${p.id}_${d ? d.toDateString() : ''}` : null;
    if (k1) trackPaidItem(k1, p.itemsPaid);
    const regId = p.registrationId || p.regId || p.regID;
    const k2 = regId ? `${regId}_${d ? d.toDateString() : ''}` : null;
    if (k2) trackPaidItem(k2, p.itemsPaid);
    
    list.push({ id: p.id, amount, timestamp, method: p.paymentMethod || '-', type: 'Consultation', phone: p.phone, itemsPaid: p.itemsPaid });
  });
  
  // 2. Old Transactions
  tSnap.forEach(doc => {
    const tr = { id: doc.id, ...doc.data() };
    const d = parseD(tr.timestamp);
    const k1 = `${tr.patientId}_${d ? d.toDateString() : ''}`;
    const regId = tr.registrationId || tr.regId || tr.regID || '-';
    const k2 = (regId !== '-') ? `${regId}_${d ? d.toDateString() : ''}` : null;
    
    if (tr.type === 'consultation') {
      if ((k1 && paidItemsMap.get(k1)?.cons) || (k2 && paidItemsMap.get(k2)?.cons)) return;
      list.push({ id: tr.id, amount: Number(tr.amount) || 0, timestamp: d?d.getTime():0, method: tr.method || '-', type: 'Consultation', phone: tr.phone, itemsPaid: tr.itemsPaid });
    } else {
      if (tr.type === 'nutrition') {
        if ((k1 && paidItemsMap.get(k1)?.diet) || (k2 && paidItemsMap.get(k2)?.diet)) return;
      } else {
        if ((k1 && paidItemsMap.get(k1)?.med) || (k2 && paidItemsMap.get(k2)?.med)) return;
      }
      
      let amt = Number(tr.amount) || 0;
      if (tr.type !== 'nutrition') {
        // check split
        const m = (tr.method || '-').toUpperCase();
        if (m === 'SPLIT' || m === 'APP_SPLIT') {
          if (tr.itemsPaid) {
            const med = Number(tr.itemsPaid.medicine || 0);
            const diet = Number(tr.itemsPaid.dietPlan || 0);
            const tot = med + diet;
            if (tot > 0) amt = tot;
          }
        }
      }
      list.push({ id: tr.id, amount: amt, timestamp: d?d.getTime():0, method: tr.method || '-', type: tr.type === 'nutrition' ? 'Diet Plan' : 'Pharmacy', phone: tr.phone, itemsPaid: tr.itemsPaid });
    }
  });
  
  // 3. Medicine Forms
  mfSnap.forEach(doc => {
    const form = { id: doc.id, ...doc.data() };
    const amt = Number(form.amountPaid) || 0;
    if (amt <= 0) return;
    
    const d = parseD(form.createdAt || form.formDate);
    const k1 = `${form.patientId}_${d ? d.toDateString() : ''}`;
    if (k1 && paidItemsMap.get(k1)?.med) return;
    
    list.push({ id: form.id, amount: amt, timestamp: d?d.getTime():0, method: form.paymentMethod || '-', type: 'Pharmacy', phone: form.phone, itemsPaid: {medicine: amt} });
  });
  
  // Grouping
  let finalTxList = list.filter(tr => Number(tr.amount) > 0);
  const groupedTx = new Map();
  
  finalTxList.forEach(tr => {
    let dateKey = 'unknown';
    if (tr.timestamp) {
      const d = new Date(tr.timestamp);
      dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }
    
    let phoneStr = String(tr.phone || '').trim();
    if (phoneStr.length >= 10) phoneStr = phoneStr.slice(-10);
    const key = `${phoneStr}_${dateKey}`;
    
    if (!groupedTx.has(key)) {
      groupedTx.set(key, { amount: Number(tr.amount || 0) });
    } else {
      groupedTx.get(key).amount += Number(tr.amount || 0);
    }
  });
  
  const deduplicatedArray = Array.from(groupedTx.values());
  const grandTotal = deduplicatedArray.reduce((acc, curr) => acc + curr.amount, 0);
  
  console.log(`Deduplicated Transactions Count: ${deduplicatedArray.length}`);
  console.log(`Grand Total Revenue: ₹${grandTotal.toLocaleString('en-IN')}`);
}

checkRevenue();
