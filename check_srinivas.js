const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs, doc: firestoreDoc, getDoc } = require("firebase/firestore");

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

async function run() {
  console.log("Searching transactions for SPH-DSN-181...");
  const q = query(
    collection(db, "alltransactions"),
    where("regId", "==", "SPH-DSN-181")
  );
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} transactions:`);
  snap.forEach(doc => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });

  console.log("\nSearching patient document in allpatients matching SPH-DSN-181 phone/id...");
  const qPat = query(
    collection(db, "allpatients"),
    where("registrationId", "==", "SPH-DSN-181")
  );
  const snapPat = await getDocs(qPat);
  console.log(`Found ${snapPat.size} patient documents by registrationId:`);
  snapPat.forEach(doc => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });

  // Also search by phone matching
  const qPatPhone = query(
    collection(db, "allpatients"),
    where("phone", "==", "9849133067")
  );
  const snapPatPhone = await getDocs(qPatPhone);
  console.log(`Found ${snapPatPhone.size} patient documents by phone 9849133067:`);
  snapPatPhone.forEach(doc => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });
}

run().catch(console.error);
