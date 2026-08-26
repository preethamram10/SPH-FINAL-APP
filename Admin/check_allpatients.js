import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, limit, getDocs } from "firebase/firestore";

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

async function checkAllPatients() {
  const q = query(collection(db, 'allpatients'), limit(3));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log("ID:", doc.id);
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
    console.log("-----------------------------------------");
  });
  process.exit(0);
}

checkAllPatients().catch(err => {
  console.error(err);
  process.exit(1);
});
