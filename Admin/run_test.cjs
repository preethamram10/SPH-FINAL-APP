const fs = require('fs');
const code = fs.readFileSync('c:/Users/Shaik Ansar/Downloads/sph1/SPH-admin30-06-2026-main/src/pages/reception/ReceptionDashboard.jsx', 'utf8');

let funcStart = code.indexOf('const getDoctorSchedulesAndTimings =');
let funcEnd = code.indexOf('const normalizeBranchName =', funcStart);
let getDocStr = code.substring(funcStart, funcEnd);

let normStart = code.indexOf('const normalizeBranchName =');
let normEnd = code.indexOf('const generateSlotsForSelected =', normStart);
let normStr = code.substring(normStart, normEnd);

let genStart = code.indexOf('const generateSlotsForSelected =');
let genEnd = code.indexOf('const isSlotBlockedByNoShow =', genStart);
let genStr = code.substring(genStart, genEnd);

let evalCode = `
  const DOCTOR_SCHEDULES = {
    'Dr. CH. Rama Krishna': {
      branches: ['Dilshuknagar', 'Nallagandla'],
      timings: [
        { branch: 'Dilshuknagar', dayOfWeek: [0, 1, 2, 3, 4], intervals: [['10:00', '14:00'], ['17:00', '20:00']] },
        { branch: 'Nallagandla', dayOfWeek: [5, 6], intervals: [['10:00', '20:00']] }
      ]
    }
  };
  
  ${getDocStr}
  ${normStr}
  ${genStr}
  
  const docObj1 = {
    name: 'Dr. Rama Krishna',
    timings: [
      { branch: 'Dilshuknagar', daySchedule: { '2': [{start: '10:00', end: '14:00'}] } }
    ]
  };
  console.log('Test 1:', generateSlotsForSelected('Dr. Rama Krishna', docObj1, 'Dilshuknagar', '2026-06-30').length);
  
  const docObj2 = {
    name: 'Dr. CH. Rama Krishna'
  };
  console.log('Test 2:', generateSlotsForSelected('Dr. CH. Rama Krishna', docObj2, 'Dilshuknagar', '2026-06-30').length);
  
  console.log('Test 3:', generateSlotsForSelected('Dr. Dr. Rama Krishna', undefined, 'Dilshuknagar', '2026-06-30').length);
`;

fs.writeFileSync('test_gen.js', evalCode);
console.log('Wrote to test_gen.js');
