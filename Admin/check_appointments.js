import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function searchPatients() {
  const searchTerms = ["prakash", "miraya"];
  const collections = ["allpatients", "patients", "alltransactions"];
  
  for (const collName of collections) {
    console.log(`\n=== SEARCHING IN COLLECTION: ${collName} ===`);
    try {
      const snap = await getDocs(collection(db, collName));
      let matchCount = 0;
      snap.forEach(doc => {
        const data = doc.data();
        const name = (data.fullName || data.patientName || data.name || "").toLowerCase();
        if (searchTerms.some(term => name.includes(term))) {
          matchCount++;
          console.log(`Document ID: ${doc.id}`);
          console.log(`Name:        "${data.fullName || data.patientName || data.name}"`);
          console.log(`RegID field: "${data.registrationId || data.regId || data.regID || "N/A"}"`);
          console.log(`Phone:       "${data.phone || data.patientPhone || "N/A"}"`);
          console.log(`Branch:      "${data.branchName || data.branchId || "N/A"}"`);
          console.log(`PatientId:   "${data.patientId || "N/A"}"`);
          console.log("------------------------------------------------");
        }
      });
      console.log(`Total matches in ${collName}: ${matchCount}`);
    } catch (err) {
      console.error(`Error querying ${collName}:`, err.message);
    }
  }
  process.exit(0);
}

searchPatients().catch(err => {
  console.error(err);
  process.exit(1);
});
