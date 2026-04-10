const ACTIVITIES_KEY = 'pacementor_activities';
const SETTINGS_KEY = 'pacementor_settings';

// Reuse same key name for backward compat — now stores analytics object, not raw track points
function analyticsKey(id) { return `pacementor_track_${id}`; }

// ── Activities ───────────────────────────────────────────────────────────────

export function getActivities() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITIES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getActivity(id) {
  const activities = getActivities();
  return activities.find((a) => a.id === id) || null;
}

export function saveActivity(activity) {
  const { analytics, trackPoints, ...summary } = activity; // strip both old and new data fields
  const activities = getActivities().filter((a) => a.id !== activity.id);
  activities.unshift(summary);

  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
    if (analytics) {
      localStorage.setItem(analyticsKey(activity.id), JSON.stringify(analytics));
    }
  } catch (e) {
    // Storage quota exceeded — remove oldest activity and retry
    if (activities.length > 1) {
      const oldest = activities.pop();
      localStorage.removeItem(analyticsKey(oldest.id));
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
      try {
        if (analytics) localStorage.setItem(analyticsKey(activity.id), JSON.stringify(analytics));
      } catch {
        // Still no space — save without analytics
      }
    }
  }
}

export function deleteActivity(id) {
  const activities = getActivities().filter((a) => a.id !== id);
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  localStorage.removeItem(analyticsKey(id));
}

export function getActivityAnalytics(id) {
  try {
    const raw = localStorage.getItem(analyticsKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Reject old format (array of track points with lat/lon)
    if (Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  name: '',
  weight: 70,
  hrMax: null,
  birthYear: null,
  unit: 'metric', // 'metric' | 'imperial'
};

export function getSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Storage usage ─────────────────────────────────────────────────────────────

export function getStorageUsage() {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('pacementor_')) {
      total += (localStorage.getItem(key) || '').length * 2; // UTF-16 ~2 bytes/char
    }
  }
  return total; // bytes
}

// ── Export / Import ───────────────────────────────────────────────────────────

export function exportAllData() {
  const data = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('pacementor_')) {
      data[key] = localStorage.getItem(key);
    }
  }
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pacementor-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const keys = Object.keys(data).filter((k) => k.startsWith('pacementor_'));
        if (keys.length === 0) {
          reject(new Error('No PaceMentor data found in this file.'));
          return;
        }
        for (const key of keys) {
          localStorage.setItem(key, data[key]);
        }
        resolve(keys.length);
      } catch {
        reject(new Error('Invalid backup file — could not parse JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
