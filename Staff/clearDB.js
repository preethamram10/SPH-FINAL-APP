const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAohSNLyeS6bYtnk2QvB4HGo0LbHDw9b6Q",
  projectId: "spiritual-homeopathy-3b552",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clear() {
  console.log("Fetching medicine_requests...");
  const snapshot = await getDocs(collection(db, "medicine_requests"));
  let count = 0;
  const promises = [];
  snapshot.forEach((d) => {
    promises.push(deleteDoc(doc(db, "medicine_requests", d.id)));
    count++;
  });
  await Promise.all(promises);
  console.log(`Deleted ${count} documents.`);
  process.exit(0);
}
clear().catch(console.error);
