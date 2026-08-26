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

const COLLECTIONS = ["allpatients", "users", "patients", "appointments", "doctor_no_shows"];

async function scanBranches() {
  console.log("Scanning Firestore for branch name variations...");
  
  for (const collName of COLLECTIONS) {
    try {
      console.log(`Scanning collection: ${collName}`);
      const snap = await getDocs(collection(db, collName));
      const branchNames = {};
      const branchIds = {};
      const branchNestedNames = {};

      snap.forEach(doc => {
        const data = doc.data();
        
        // Check direct branchName
        if (data.branchName !== undefined) {
          const val = String(data.branchName);
          branchNames[val] = (branchNames[val] || 0) + 1;
        }

        // Check direct branchId
        if (data.branchId !== undefined) {
          const val = String(data.branchId);
          branchIds[val] = (branchIds[val] || 0) + 1;
        }

        // Check nested branch object (e.g., branch: { name, id })
        if (data.branch && typeof data.branch === 'object') {
          if (data.branch.name !== undefined) {
            const val = String(data.branch.name);
            branchNestedNames[val] = (branchNestedNames[val] || 0) + 1;
          }
        }
      });

      console.log(`Results for ${collName}:`);
      if (Object.keys(branchNames).length > 0) {
        console.log("  branchName field values:", branchNames);
      }
      if (Object.keys(branchIds).length > 0) {
        console.log("  branchId field values:", branchIds);
      }
      if (Object.keys(branchNestedNames).length > 0) {
        console.log("  branch.name nested field values:", branchNestedNames);
      }
      console.log("--------------------------------------------------");
    } catch (err) {
      console.error(`Error scanning ${collName}:`, err.message);
    }
  }
  process.exit(0);
}

scanBranches().catch(console.error);
