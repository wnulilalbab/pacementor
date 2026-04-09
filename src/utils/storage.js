const ACTIVITIES_KEY = 'pacementor_activities';
const SETTINGS_KEY = 'pacementor_settings';

function trackKey(id) {
  return `pacementor_track_${id}`;
}

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
  const { trackPoints, ...summary } = activity;
  const activities = getActivities().filter((a) => a.id !== activity.id);
  activities.unshift(summary);

  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
    if (trackPoints) {
      localStorage.setItem(trackKey(activity.id), JSON.stringify(trackPoints));
    }
  } catch (e) {
    // Storage quota exceeded — remove oldest activity and retry
    if (activities.length > 1) {
      const oldest = activities.pop();
      localStorage.removeItem(trackKey(oldest.id));
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
      try {
        if (trackPoints) {
          localStorage.setItem(trackKey(activity.id), JSON.stringify(trackPoints));
        }
      } catch {
        // Still no space — save without track
      }
    }
  }
}

export function deleteActivity(id) {
  const activities = getActivities().filter((a) => a.id !== id);
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  localStorage.removeItem(trackKey(id));
}

export function getTrackPoints(id) {
  try {
    return JSON.parse(localStorage.getItem(trackKey(id)) || 'null');
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
