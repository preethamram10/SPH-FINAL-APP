const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/RegisterPatient.js";
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/regID: 'RK\/Dilshuknagar\/0001',/g, "regID: '',");
content = content.replace(/setPatientData\(prev => \(\{ \.\.\.prev, regID: \RK\/\$\{branchCode\}\/0001\ \}\)\);/g, "// Auto-generated regID");

// We only want to replace the FIRST occurrence of ddDoc(collection(db, 'allpatients'), {
// Because that's the patient doc. The second one is the appointment doc!
let replacedAddDoc = false;
content = content.replace(/const patientDoc = await addDoc\(collection\(db, 'allpatients'\), \{/g, () => {
    if (!replacedAddDoc) {
        replacedAddDoc = true;
        return "const patientDoc = await addDoc(collection(db, 'patients'), {";
    }
    return "const patientDoc = await addDoc(collection(db, 'allpatients'), {";
});

// We only want to replace the specific updateDocs that point to patientDocId
content = content.replace(/await updateDoc\(doc\(db, 'allpatients', patientDocId\), \{/g, "await updateDoc(doc(db, 'patients', patientDocId), {");

fs.writeFileSync(file, content);
console.log("Done");
