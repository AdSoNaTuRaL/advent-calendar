export function validate(calendar) {
  if (!Number.isInteger(calendar?.year) || calendar.year < 2000 || calendar.year > 9998 ||
      typeof calendar.timezone !== 'string' || typeof calendar.language !== 'string' ||
      !Array.isArray(calendar.days) || calendar.days.length !== 24) throw Error('Configuración del calendario inválida');
  new Intl.DateTimeFormat(calendar.language, { timeZone: calendar.timezone }).format();
  for (const [index, entry] of calendar.days.entries()) {
    if (entry?.day !== index + 1 || ![entry.title, entry.message].every(value =>
      typeof value === 'string' && value.trim() && value.length <= 8000)) throw Error('Revisa los títulos, mensajes y el orden de los 24 días');
  }
  return calendar;
}

export function unlockAt(calendar, day) {
  const target = Date.UTC(calendar.year, 11, day);
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: calendar.timezone, year:'numeric', month:'numeric', day:'numeric'
  });
  let low = target - 36 * 3600000;
  let high = target + 36 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((high + low) / 2);
    const parts = Object.fromEntries(format.formatToParts(middle).map(({type,value}) => [type, Number(value)]));
    if (Date.UTC(parts.year, parts.month - 1, parts.day) >= target) high = middle;
    else low = middle;
  }
  return high;
}

export function doorState(calendar, day, now) {
  if (now < unlockAt(calendar, day)) return 'future';
  if (calendar.todayOnly && now >= unlockAt(calendar, day + 1)) return 'past';
  return 'open';
}

export const specialDays = new Set([6, 12, 18, 24]);
export const manifestPath = () => process.env.BLOB_CALENDAR_PATH || 'calendar/manifest.json';
