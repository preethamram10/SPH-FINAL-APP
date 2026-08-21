const parseDateRobust = (rawDateStr) => {
  if (!rawDateStr) return null;
  if (rawDateStr.toDate) return rawDateStr.toDate();
  if (rawDateStr.seconds) return new Date(rawDateStr.seconds * 1000);
  if (typeof rawDateStr === 'string') {
    if (rawDateStr.includes('T')) return new Date(rawDateStr);
    if (rawDateStr.includes('/')) {
      const parts = rawDateStr.split('/');
      if (parts.length === 3) {
         if (parts[2].length === 4) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
         if (parts[0].length === 4) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    if (rawDateStr.includes('-')) {
      const parts = rawDateStr.split('-');
      if (parts.length === 3) {
         if (parts[0].length === 4) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
         if (parts[2].length === 4) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    return new Date(rawDateStr);
  }
  if (rawDateStr instanceof Date) return rawDateStr;
  return new Date(rawDateStr);
};
console.log('22-06-2026:', parseDateRobust('22-06-2026'));
console.log('2026-06-22:', parseDateRobust('2026-06-22'));
console.log('22/06/2026:', parseDateRobust('22/06/2026'));
console.log('timestamp:', parseDateRobust({seconds: 1700000000}).toISOString());

