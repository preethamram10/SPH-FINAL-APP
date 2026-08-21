const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/UpcomingAppointmentsScreen.js";
let content = fs.readFileSync(file, 'utf8');

content = content.replace("list.push({", "console.log('PUSHING:', docSnap.id, data.fullName, normalizedDashDate, data.status); list.push({");

fs.writeFileSync(file, content);
console.log("Done");
