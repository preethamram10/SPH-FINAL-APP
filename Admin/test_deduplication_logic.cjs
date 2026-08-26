const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAohSNLyeS6bYtnk2QvB4HGo0LbHDw9b6Q",
  authDomain: "spiritual-homeopathy-3b552.firebaseapp.com",
  projectId: "spiritual-homeopathy-3b552",
  storageBucket: "spiritual-homeopathy-3b552.firebasestorage.app",
  messagingSenderId: "81822616559",
  appId: "1:81822616559:web:98a0b9cd974938cc87841a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testDedupe() {
  const [pResult, tResult, npResult] = await Promise.all([
    getDocs(collection(db, 'allpatients')),
    getDocs(collection(db, 'alltransactions')),
    getDocs(collection(db, 'nutrition_plans'))
  ]);

  const phones = ['8919154821', '9951693621', '9961593638'];

  const pats = [];
  pResult.forEach(d => {
    const data = d.data();
    if (phones.some(p => JSON.stringify(data).includes(p))) {
      pats.push({ id: d.id, ...data });
    }
  });

  const txs = [];
  tResult.forEach(d => {
    const data = d.data();
    if (phones.some(p => JSON.stringify(data).includes(p))) {
      txs.push({ id: d.id, ...data });
    }
  });

  const nps = [];
  npResult.forEach(d => {
    const data = d.data();
    if (phones.some(p => JSON.stringify(data).includes(p))) {
      nps.push({ id: d.id, ...data });
    }
  });

  console.log(`Matching records found: Patients=${pats.length}, Transactions=${txs.length}, NutritionPlans=${nps.length}`);

  // Let's inspect how visit keys map
  // A visit key can be regId + date (YYYY-MM-DD + approximate time or YYYY-MM-DD-HH-MM)
  const getVisitTimeKey = (rawDate) => {
    if (!rawDate) return '';
    let d = null;
    if (rawDate.toDate) d = rawDate.toDate();
    else if (rawDate.seconds) d = new Date(rawDate.seconds * 1000);
    else d = new Date(rawDate);
    if (!d || isNaN(d.getTime())) return '';
    // Group by year-month-day-hour-minute (within 5 minutes window)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = Math.floor(d.getMinutes() / 5) * 5; // 5-minute bucket
    return `${year}-${month}-${day}_${hour}:${String(minute).padStart(2, '0')}`;
  };

  txs.forEach(t => {
    const key = `${t.regId || t.phone}_${getVisitTimeKey(t.paymentCollectedAt || t.createdAt)}`;
    console.log(`TX [${t.id}] -> Key: ${key}, Amount: ${t.amount}, Method: ${t.paymentMethod}, Type: ${t.type}`);
  });

  pats.forEach(p => {
    const key = `${p.regId || p.phone}_${getVisitTimeKey(p.paymentCollectedAt || p.createdAt)}`;
    console.log(`PAT [${p.id}] -> Key: ${key}, Amount: ${p.amount}, Method: ${p.paymentMethod}`);
  });

  nps.forEach(np => {
    const key = `${np.regId || np.phone}_${getVisitTimeKey(np.paymentCollectedAt || np.createdAt)}`;
    console.log(`NP [${np.id}] -> Key: ${key}, Amount: ${np.amount}, Method: ${np.paymentMethod}`);
  });
}

testDedupe().then(() => process.exit(0)).catch(console.error);
