
const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/Shaik Ansar/Downloads/sph/SPH-Admin-19-06-2026-main/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const q = await db.collection('appointments').get();
  console.log("Appointments:", q.size);
  let c = 0;
  q.forEach(doc => {
     if(JSON.stringify(doc.data()).toLowerCase().includes('exit')) {
         console.log(doc.data());
         c++;
     }
  });
  console.log("Found:", c);
}
check();
