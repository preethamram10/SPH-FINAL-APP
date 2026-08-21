const fs = require('fs');

const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const collectionName = \.firestoreCollection \|\| \(\._type/g, "const collectionName = patient?.firestoreCollection || (patient?._type");
    
    fs.writeFileSync(file, content);
}

fixFile("c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/Dashboard.js");
fixFile("c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/FollowUps.js");
console.log("Done");
