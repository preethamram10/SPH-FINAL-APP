const fs = require('fs');
const file = "c:/Users/Shaik Ansar/Downloads/sph/SPH-staff-app-19-06-2026/src/screens/reception/UpcomingAppointmentsScreen.js";
let content = fs.readFileSync(file, 'utf8');

const targetBlock =     // Query appointments where date is today or later (filtered by branch locally to avoid Firestore index requirement)
    const q = query(
      collection(db, 'appointments'),
      where('dateString', '>=', todayDashDate)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();

        // Local branch filter
        if (!branchNames.includes(data.branchId)) {
          return;
        }

        const statusLower = (data.status || '').toLowerCase();
        
        // Only show upcoming appointments (waiting, confirmed, booked, pending, in-consultation)
        const isUpcoming = 
          statusLower === 'waiting' || 
          statusLower === 'confirmed' || 
          statusLower === 'booked' || 
          statusLower === 'pending' ||
          statusLower === 'in-consultation';

        if (isUpcoming) {
          list.push({
            id: docSnap.id,
            ...data
          });
        }
      });;

const replacementBlock =     // Query unified patients where status indicates an active/upcoming state
    const q = query(
      collection(db, 'allpatients'),
      where('status', 'in', ['waiting', 'confirmed', 'booked', 'pending', 'in-consultation'])
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = [];
      
      // We need to parse DD/MM/YYYY to compare with todayDashDate
      const parseDateStr = (dStr) => {
          if (!dStr) return null;
          if (dStr.includes('/')) {
              const parts = dStr.split('/');
              if (parts.length === 3) {
                  return \\-\-\\;
              }
          }
          if (dStr.includes('-')) return dStr;
          return null;
      };

      snap.forEach((docSnap) => {
        const data = docSnap.data();

        // Local branch filter
        const docBranch = data.branchId || data.branchName || data.branch;
        if (!branchNames.includes(docBranch)) {
          return;
        }

        // Parse date and filter only today or future
        const docDateStr = data.appointmentDate || data.dateString || data.date;
        const normalizedDashDate = parseDateStr(docDateStr);
        if (!normalizedDashDate || normalizedDashDate < todayDashDate) {
            return; // Skip past appointments
        }

        list.push({
          id: docSnap.id,
          ...data,
          dateString: normalizedDashDate, // Standardize for the UI grouping logic
          timeSlot: data.appointmentTime || data.timeSlot || 'N/A',
          fullName: data.fullName || data.patientName || 'Walk-in Patient',
          doctorName: data.doctor || data.doctorName || 'Doctor'
        });
      });;

content = content.replace(targetBlock, replacementBlock);
fs.writeFileSync(file, content);
console.log("Done");
