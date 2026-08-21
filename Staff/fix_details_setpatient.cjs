const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/PatientDetails.js";
let content = fs.readFileSync(file, 'utf8');

const target = "setPatient({ id: docSnap.id, ...data, _type: matchedType, firestoreCollection: matchedType === 'walkin' ? 'patients' : 'appointments' });";
const replacement = "setPatient({ id: docSnap.id, ...data, _type: matchedType, firestoreCollection: matchedType === 'walkin' ? 'patients' : (matchedType === 'unified_appointment' ? 'allpatients' : 'appointments') });";

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log("Done");
