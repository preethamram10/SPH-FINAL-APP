import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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

const getStandardBranchName = (name) => {
  if (!name) return '';
  const normalized = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('kphb')) return 'Kphb';
  if (normalized.includes('chandnagar') || normalized.includes('chandanagar') || normalized.includes('chanda nagar') || normalized.includes('chnr')) return 'Chandanagar';
  if (normalized.includes('dilsukhnagar') || normalized.includes('dilshuknagar') || normalized.includes('dsnr')) return 'Dilshuknagar';
  if (normalized.includes('nallagandla')) return 'Nallagandla';
  if (normalized.includes('madhapur')) return 'Madhapur';
  if (normalized.includes('kukatpally')) return 'Kukatpally';
  
  const clean = String(name).replace(/\s*branch\s*/i, '').trim();
  return clean.replace(/\b[a-z]/g, (char) => char.toUpperCase()).replace(/\s+/g, ' ').trim();
};

const COLLECTIONS = ["allpatients", "users", "patients", "appointments", "doctor_no_shows"];

async function runMigration() {
  console.log("🚀 Starting SPH Firestore Branch Name Standardization...");
  
  for (const collName of COLLECTIONS) {
    try {
      console.log(`\nChecking collection: '${collName}'...`);
      const snap = await getDocs(collection(db, collName));
      let updatedCount = 0;
      let totalCount = 0;

      for (const docSnap of snap.docs) {
        totalCount++;
        const data = docSnap.data();
        const docRef = doc(db, collName, docSnap.id);
        const updates = {};

        // 1. Standardize branchName string field
        if (data.branchName !== undefined && data.branchName !== null) {
          const original = String(data.branchName);
          const standardized = getStandardBranchName(original);
          if (original !== standardized && standardized !== '') {
            updates.branchName = standardized;
          }
        }

        // 2. Standardize branchId string field (if it contains branch name keywords)
        if (data.branchId !== undefined && data.branchId !== null) {
          const original = String(data.branchId);
          // Only clean if it is NOT a typical Firestore document ID (document IDs are alphanumeric, usually 20 chars)
          const isDocId = original.length >= 18 && /^[a-zA-Z0-9]+$/.test(original);
          if (!isDocId) {
            const standardized = getStandardBranchName(original);
            if (original !== standardized && standardized !== '') {
              updates.branchId = standardized;
            }
          }
        }

        // 3. Standardize location string field (often used as branch location)
        if (data.location !== undefined && data.location !== null) {
          const original = String(data.location);
          const isDocId = original.length >= 18 && /^[a-zA-Z0-9]+$/.test(original);
          if (!isDocId) {
            const standardized = getStandardBranchName(original);
            if (original !== standardized && standardized !== '') {
              updates.location = standardized;
            }
          }
        }

        // 4. Standardize branch field (can be a string or a nested object)
        if (data.branch !== undefined && data.branch !== null) {
          if (typeof data.branch === 'object') {
            const originalObj = data.branch;
            let objChanged = false;
            const updatedBranchObj = { ...originalObj };

            if (originalObj.name !== undefined && originalObj.name !== null) {
              const original = String(originalObj.name);
              const standardized = getStandardBranchName(original);
              if (original !== standardized && standardized !== '') {
                updatedBranchObj.name = standardized;
                objChanged = true;
              }
            }

            if (originalObj.id !== undefined && originalObj.id !== null) {
              const original = String(originalObj.id);
              const isDocId = original.length >= 18 && /^[a-zA-Z0-9]+$/.test(original);
              if (!isDocId) {
                const standardized = getStandardBranchName(original);
                if (original !== standardized && standardized !== '') {
                  updatedBranchObj.id = standardized;
                  objChanged = true;
                }
              }
            }

            if (objChanged) {
              updates.branch = updatedBranchObj;
            }
          } else if (typeof data.branch === 'string') {
            const original = data.branch;
            const standardized = getStandardBranchName(original);
            if (original !== standardized && standardized !== '') {
              updates.branch = standardized;
            }
          }
        }

        // 5. Standardize specific user name fields for role: 'branch'
        if (data.role === 'branch' && data.name !== undefined && data.name !== null) {
          const original = String(data.name);
          const standardized = getStandardBranchName(original);
          if (original !== standardized && standardized !== '') {
            updates.name = standardized;
          }
        }

        // Apply updates if there are any
        if (Object.keys(updates).length > 0) {
          await updateDoc(docRef, updates);
          updatedCount++;
          console.log(`  Updated doc ID ${docSnap.id}:`, JSON.stringify(updates));
        }
      }

      console.log(`Finished ${collName}. Standardized ${updatedCount} / ${totalCount} records.`);
    } catch (err) {
      console.error(`Error migrating collection ${collName}:`, err.message);
    }
  }
  
  console.log("\n✅ Firestore Branch Name Standardization complete!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
