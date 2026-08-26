import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAohSNLyeS6bYtnk2QvB4HGo0LbHDw9b6Q",
  authDomain: "spiritual-homeopathy-3b552.firebaseapp.com",
  projectId: "spiritual-homeopathy-3b552",
  storageBucket: "spiritual-homeopathy-3b552.firebasestorage.app",
  messagingSenderId: "81822616559",
  appId: "1:81822616559:web:98a0b9cd974938cc87841a",
  measurementId: "G-SWSZ49BB14"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const q = query(collection(db, 'allpatients'), where('pendingAmount', '>', 0), limit(10));
    const snap = await getDocs(q);
    console.log("Found pending documents count:", snap.size);
    snap.forEach(d => {
      const data = d.data();
      console.log(`Document ID: ${d.id}`);
      console.log(`  Patient Name: ${data.fullName || data.patientName}`);
      console.log(`  Phone: ${data.phone}`);
      console.log(`  PatientPhone: ${data.patientPhone}`);
      console.log(`  PhoneNumber: ${data.phoneNumber}`);
      console.log(`  PendingAmount: ${data.pendingAmount}`);
      console.log(`  CreatedAt: ${data.createdAt}`);
      console.log("-----------------------------------------");
    });
  } catch (e) {
    console.error("Query failed:", e);
  }
  process.exit(0);
}

run();
