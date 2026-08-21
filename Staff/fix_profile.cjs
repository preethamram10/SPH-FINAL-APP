const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/PatientProfile.js";
let content = fs.readFileSync(file, 'utf8');

const oldBlock = "          let docSnap = await getDoc(doc(db, 'patients', patientId));\n          let data;\n          if (docSnap.exists()) {\n            data = { id: docSnap.id, ...docSnap.data(), _type: 'walkin', firestoreCollection: 'patients' };\n          } else {\n            docSnap = await getDoc(doc(db, 'appointments', patientId));\n            if (docSnap.exists()) {\n              const appt = docSnap.data();";
const newBlock = "          let docSnap = await getDoc(doc(db, 'patients', patientId));\n          let data;\n          if (docSnap.exists()) {\n            data = { id: docSnap.id, ...docSnap.data(), _type: 'walkin', firestoreCollection: 'patients' };\n          } else {\n            docSnap = await getDoc(doc(db, 'allpatients', patientId));\n            if (docSnap.exists()) {\n              data = { id: docSnap.id, ...docSnap.data(), _type: 'unified_appointment', firestoreCollection: 'allpatients' };\n            } else {\n              docSnap = await getDoc(doc(db, 'appointments', patientId));\n              if (docSnap.exists()) {\n                const appt = docSnap.data();";

content = content.replace(oldBlock, newBlock);

const oldBlock2 = "              };\n            } else {\n              Alert.alert('Not Found', 'Patient profile or booking details could not be found.');\n              navigation.goBack();\n              return;\n            }\n          }";
const newBlock2 = "              };\n            } else {\n              Alert.alert('Not Found', 'Patient profile or booking details could not be found.');\n              navigation.goBack();\n              return;\n            }\n            } // End of allpatients else\n          }";

content = content.replace(oldBlock2, newBlock2);

fs.writeFileSync(file, content);
console.log("Replaced successfully!");
