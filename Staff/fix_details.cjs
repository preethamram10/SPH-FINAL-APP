const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/PatientDetails.js";
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const collectionName = patient\?._type === 'online' \? 'appointments' : 'patients';/g, "const collectionName = patient?.firestoreCollection || (patient?._type === 'online' ? 'appointments' : 'patients');");

fs.writeFileSync(file, content);
console.log("Done");
