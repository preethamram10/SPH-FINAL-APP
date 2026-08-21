const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

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

async function checkCollection(collectionName, searchFields) {
  console.log(`\n=== Querying Collection: ${collectionName} ===`);
  for (const field of Object.keys(searchFields)) {
    const val = searchFields[field];
    if (!val) continue;
    console.log(`Searching where "${field}" == "${val}"...`);
    try {
      const q = query(collection(db, collectionName), where(field, "==", val));
      const snap = await getDocs(q);
      console.log(`Found ${snap.size} documents.`);
      snap.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    } catch (err) {
      console.error(`Error querying field "${field}":`, err.message);
    }
  }
}

async function run() {
  // Query allpatients
  await checkCollection("allpatients", {
    registrationId: "RK/KPHB/0001",
    phone: "9948171878",
    name: "Rama Devi"
  });

  // Query patients
  await checkCollection("patients", {
    registrationId: "RK/KPHB/0001",
    phone: "9948171878",
    name: "Rama Devi"
  });

  // Query appointments
  await checkCollection("appointments", {
    regId: "RK/KPHB/0001",
    registrationId: "RK/KPHB/0001",
    phone: "9948171878",
    patientName: "Rama Devi",
    name: "Rama Devi"
  });

  // Query alltransactions
  await checkCollection("alltransactions", {
    regId: "RK/KPHB/0001",
    registrationId: "RK/KPHB/0001",
    phone: "9948171878",
    patientName: "Rama Devi"
  });
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
