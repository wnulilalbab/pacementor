// Format seconds into h:mm:ss or m:ss
export function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '--';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Format pace (sec/km) → "m:ss /km" or "m:ss /mi"
export function fmtPace(secPerKm, unit = 'metric') {
  if (secPerKm == null || isNaN(secPerKm) || secPerKm <= 0) return '--';
  const spm = unit === 'imperial' ? secPerKm * 1.60934 : secPerKm;
  const m = Math.floor(spm / 60);
  const s = Math.round(spm % 60);
  const suffix = unit === 'imperial' ? '/mi' : '/km';
  return `${m}:${String(s).padStart(2, '0')} ${suffix}`;
}

// Format distance in meters → "5.23 km" or "3.25 mi"
export function fmtDistance(meters, unit = 'metric') {
  if (meters == null || isNaN(meters)) return '--';
  if (unit === 'imperial') {
    const miles = meters / 1609.34;
    return `${miles.toFixed(2)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// Format elevation in meters → "123 m" or "404 ft"
export function fmtElevation(meters, unit = 'metric') {
  if (meters == null || isNaN(meters)) return '--';
  if (unit === 'imperial') return `${Math.round(meters * 3.28084)} ft`;
  return `${Math.round(meters)} m`;
}

// Format speed km/h → "10.5 km/h" or "6.5 mph"
export function fmtSpeed(kmh, unit = 'metric') {
  if (kmh == null || isNaN(kmh)) return '--';
  if (unit === 'imperial') return `${(kmh * 0.621371).toFixed(1)} mph`;
  return `${kmh.toFixed(1)} km/h`;
}

// Format date ISO string → "Jan 15, 2024"
export function fmtDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format date → short "Mon, Jan 15"
export function fmtDateShort(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Format date → time of day "9:30 AM"
export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Relative time "2 days ago"
export function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Week start (Monday) for a given date
export function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Format bytes → "1.2 MB"
export function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// HR zone label and color
export const HR_ZONE_COLORS = [
  '#94a3b8', // Z1 gray
  '#60a5fa', // Z2 blue
  '#34d399', // Z3 green
  '#fb923c', // Z4 orange
  '#f87171', // Z5 red
];
export const HR_ZONE_LABELS = ['Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO₂Max'];
