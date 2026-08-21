const fs = require('fs');

const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/firestoreCollection: 'patients'/g, "firestoreCollection: 'allpatients'");
    
    fs.writeFileSync(file, content);
}

fixFile("c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/Dashboard.js");
console.log("Done");
