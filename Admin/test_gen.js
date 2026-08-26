
  const DOCTOR_SCHEDULES = {
    'Dr. CH. Rama Krishna': {
      branches: ['Dilshuknagar', 'Nallagandla'],
      timings: [
        { branch: 'Dilshuknagar', dayOfWeek: [0, 1, 2, 3, 4], intervals: [['10:00', '14:00'], ['17:00', '20:00']] },
        { branch: 'Nallagandla', dayOfWeek: [5, 6], intervals: [['10:00', '20:00']] }
      ]
    }
  };
  
  const getDoctorSchedulesAndTimings = (doctorName, doctorObj) => {
  if (doctorObj && doctorObj.timings && Array.isArray(doctorObj.timings) && doctorObj.timings.length > 0) {
    return doctorObj.timings;
  }
  if (!doctorName) return [];
  const cleanName = doctorName.toLowerCase().replace('dr. ', '').replace('dr ', '').trim();
  for (const [key, value] of Object.entries(DOCTOR_SCHEDULES)) {
    if (key.toLowerCase().replace('dr. ', '').replace('dr ', '').trim() === cleanName) {
      return value.timings;
    }
  }
  const defaultBranches = ['KPHB', 'Chandnagar', 'Nallagandla', 'Dilshuknagar'];
  return defaultBranches.map(brName => ({
    branch: brName,
    dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
    intervals: [['10:00', '14:00'], ['17:00', '20:00']]
  }));
};


  const normalizeBranchName = (name) => {
  if (!name) return '';
  const str = name.toLowerCase().replace(/\s*branch\s*/i, '').replace(/[^a-z0-9]/g, '').trim();
  if (str.includes('kphb')) return 'kphb';
  if (str.includes('chnr') || str.includes('chandanagar') || str.includes('chandnagar')) return 'chandnagar';
  if (str.includes('dsnr') || str.includes('dilsukhnagar') || str.includes('dilshuknagar')) return 'dilsukhnagar';
  if (str.includes('nallagandla')) return 'nallagandla';
  if (str.includes('madhapur')) return 'madhapur';
  if (str.includes('kukatpally')) return 'kukatpally';
  return str;
};


  const generateSlotsForSelected = (doctorName, doctorObj, branchName, dateString) => {
  if (!doctorName || !branchName || !dateString) return [];
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) return [];
  const date = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
  const day = date.getDay();
  const timings = getDoctorSchedulesAndTimings(doctorName, doctorObj);

  const dayTimings = [];
  (timings || []).forEach(t => {
    if (normalizeBranchName(t.branch) !== normalizeBranchName(branchName)) return;
    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      if (ivs.length > 0) {
        dayTimings.push({ intervals: ivs });
      }
    } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
      dayTimings.push({ intervals: t.intervals || [] });
    }
  });

  if (dayTimings.length === 0) return [];
  const slots = [];
  dayTimings.forEach(t => {
    (t.intervals || []).forEach(iv => {
      let startStr = '';
      let endStr = '';
      if (Array.isArray(iv)) {
        startStr = iv[0]; endStr = iv[1];
      } else if (iv && typeof iv === 'object') {
        startStr = iv.start; endStr = iv.end;
      } else if (typeof iv === 'string' && iv.includes('-')) {
        const parts = iv.split('-');
        startStr = parts[0]?.trim(); endStr = parts[1]?.trim();
      }
      if (!startStr || !endStr) return;
      const parseTimeStr = (str) => {
        const match = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const p = match[3] ? match[3].toUpperCase() : null;
          if (p === 'PM' && h !== 12) h += 12;
          if (p === 'AM' && h === 12) h = 0;
          return [h, m];
        }
        return str.split(':').map(Number);
      };
      const [startHour, startMin] = parseTimeStr(startStr);
      const [endHour, endMin] = parseTimeStr(endStr);
      let currentHour = startHour;
      let currentMin = startMin;
      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const period = currentHour >= 12 ? 'PM' : 'AM';
        const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
        const formattedTime = `${displayHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')} ${period}`;
        slots.push(formattedTime);
        currentMin += 15;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }
    });
  });
  return slots;
};

const getDoctorBranches = (doctorName) => {
  if (!doctorName) return [];
  const cleanName = doctorName.toLowerCase().replace('dr. ', '').trim();
  for (const [key, value] of Object.entries(DOCTOR_BRANCH_MAP)) {
    if (key.toLowerCase().replace('dr. ', '').trim() === cleanName) {
      return value;
    }
  }
  return ['KPHB', 'Chandnagar', 'Nallagandla', 'Dilshuknagar']; // Default fallback if not matched
};

const parseTimeStr = (timeStr) => {
  if (!timeStr || timeStr === 'N/A') return 9999;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 9999;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
};

const getCanonicalBranchName = (name) => {
  if (!name) return '';
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('kphb')) return 'KPHB Branch';
  if (normalized.includes('madhapur')) return 'Madhapur Branch';
  if (normalized.includes('chandnagar') || normalized.includes('chandanagar') || normalized.includes('chanda nagar')) return 'Chandanagar Branch';
  if (normalized.includes('kukatpally')) return 'Kukatpally Branch';
  if (normalized.includes('dilsukhnagar') || normalized.includes('dilshuknagar') || normalized.includes('dsnr')) return 'Dilshuknagar Branch';
  if (normalized.includes('nallagandla')) return 'Nallagandla Branch';
  return name.replace(/\b[a-z]/g, (char) => char.toUpperCase()).replace(/\s+/g, ' ').trim();
};

const getDoctorScheduledDaysAtBranch = (doctor, branchName) => {
  if (!doctor || !branchName || !doctor.timings) return '';

  const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workingDays = new Set();

  const normBranch = branchName.toLowerCase().replace(/\s*branch\s*/i, '').trim();

  doctor.timings.forEach(t => {
    const bName = t.branch || '';
    if (bName.toLowerCase().replace(/\s*branch\s*/i, '').trim() !== normBranch) return;

    if (t.daySchedule) {
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        const ivs = t.daySchedule[d] || t.daySchedule[String(d)] || [];
        if (ivs.length > 0) {
          workingDays.add(d);
        }
      });
    } else if (t.dayOfWeek) {
      t.dayOfWeek.forEach(d => {
        if (t.intervals && t.intervals.length > 0) {
          workingDays.add(d);
        }
      });
    }
  });

  if (workingDays.size === 0) return 'No scheduled days at this branch';

  return Array.from(workingDays)
    .sort((a, b) => a - b)
    .map(d => daysOfWeekNames[d])
    .join(', ');
};

const isDoctorScheduledAtBranchOnDate = (doctor, branchName, dateObj) => {
  if (!doctor || !branchName || !dateObj) return false;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateString = `${y}-${m}-${d}`;
  const slots = generateSlotsForSelected(doctor.name, doctor, branchName, dateString);
  return slots.length > 0;
};

const getOtherBranchAvailability = (doctor, selectedBranchName, dateObj) => {
  if (!doctor || !dateObj || !selectedBranchName) return '';
  const day = dateObj.getDay();
  const docNameFormatted = doctor.name ? (doctor.name.startsWith('Dr.') || doctor.name.startsWith('Dr ') ? doctor.name : `Dr. ${doctor.name}`) : '';
  
  const timings = getDoctorSchedulesAndTimings(doctor.name, doctor);
  if (!timings || timings.length === 0) return '';
  const weekdayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  const availableOtherBranches = [];
  timings.forEach(t => {
    if (normalizeBranchName(t.branch) === normalizeBranchName(selectedBranchName)) return;
    if (t.daySchedule) {
      const ivs = t.daySchedule[day] || t.daySchedule[String(day)] || [];
      if (ivs.length > 0) availableOtherBranches.push({ branch: t.branch, intervals: ivs });
    } else if (t.dayOfWeek && t.dayOfWeek.includes(day)) {
      availableOtherBranches.push({ branch: t.branch, intervals: t.intervals || [] });
    }
  });

  if (availableOtherBranches.length > 0) {
    const branchStrings = availableOtherBranches.map(t => {
      const intervalsStr = t.intervals.map(iv => {
        const start = Array.isArray(iv) ? iv[0] : (iv ? iv.start : '');
        const end = Array.isArray(iv) ? iv[1] : (iv ? iv.end : '');
        if (!start || !end) return '';
        const fmt = (tStr) => { const [h, m] = tStr.split(':').map(Number); const p = h >= 12 ? 'PM' : 'AM'; const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h); return `${dh}:${m.toString().padStart(2, '0')} ${p}`; };
        return `${fmt(start)} - ${fmt(end)}`;
      }).filter(Boolean).join(', ');
      return `${t.branch} (${intervalsStr})`;
    });
    return `On ${weekdayName}s, ${docNameFormatted} is available at: ${branchStrings.join(' | ')}.`;
  }

  const allWorkDays = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  timings.forEach(t => {
    if (!allWorkDays[t.branch]) allWorkDays[t.branch] = [];
    if (t.daySchedule) {
      [0, 1, 2, 3, 4, 5, 6].forEach(d => {
        const ivs = t.daySchedule[d] || t.daySchedule[String(d)] || [];
        if (ivs.length > 0 && !allWorkDays[t.branch].includes(days[d])) allWorkDays[t.branch].push(days[d]);
      });
    } else if (t.dayOfWeek) {
      t.dayOfWeek.forEach(d => { if (!allWorkDays[t.branch].includes(days[d])) allWorkDays[t.branch].push(days[d]); });
    }
  });
  const generalSchedules = Object.keys(allWorkDays).map(brName => `${brName} (${allWorkDays[brName].join(', ')})`);
  if (generalSchedules.length > 0) return `Weekly Schedule for ${docNameFormatted}: ${generalSchedules.join(' | ')}.`;
  return '';
};


  
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
