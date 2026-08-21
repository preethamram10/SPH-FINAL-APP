const fs = require('fs');

const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const collectionName = (patient|type)\?*\._type === 'online' \? 'appointments' : 'patients';/g, "const collectionName = .firestoreCollection || (._type === 'online' ? 'appointments' : 'patients');");
    
    // specifically for Dashboard.js line 1632 where it's 	ype === 'online':
    content = content.replace(/const collectionName = type === 'online' \? 'appointments' : 'patients';/g, "const collectionName = 'allpatients'; // Fallback logic is handled inside if needed, but 'type' is passed.");
    
    fs.writeFileSync(file, content);
}

fixFile("c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/Dashboard.js");
console.log("Done");
