import { getValidToken } from './stravaAuth';

// ── Polyline decoder (Google encoded polyline format) ─────────────────────────
function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lon: lng / 1e5 });
  }
  return pts;
}

// Haversine distance (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Convert Strava activity → our format ─────────────────────────────────────
function toActivity(s) {
  const avgPace = s.average_speed > 0 ? Math.round(1000 / s.average_speed) : null;

  // Decode route from summary polyline (included in activities list)
  const rawPts = decodePolyline(s.map?.summary_polyline);
  const trackPoints = rawPts.map((p, idx) => {
    let d = 0;
    if (idx > 0) {
      // We'll fill cumulative dist in next step
    }
    return { lat: p.lat, lon: p.lon, ele: null, time: null, d: 0, hr: null, cad: null };
  });

  // Add cumulative distance
  let cum = 0;
  for (let k = 1; k < trackPoints.length; k++) {
    cum += haversine(trackPoints[k - 1].lat, trackPoints[k - 1].lon, trackPoints[k].lat, trackPoints[k].lon);
    trackPoints[k].d = Math.round(cum);
  }

  // Splits from Strava (metric)
  const splits = (s.splits_metric || []).map(sp => ({
    km: sp.split,
    distance: Math.round(sp.distance),
    duration: sp.moving_time,
    pace: sp.average_speed > 0 ? Math.round(1000 / sp.average_speed) : null,
    avgHR: sp.average_heartrate ? Math.round(sp.average_heartrate) : null,
    elevationDiff: Math.round(sp.elevation_difference || 0),
  }));

  // Best efforts from Strava
  const EFFORT_MAP = {
    '400m': '400m',
    '1/2 mile': null,
    '1k': '1 km',
    '1 mile': '1 mile',
    '2 mile': null,
    '5k': '5 km',
    '10k': '10 km',
    '15k': '15 km',
    '10 mile': null,
    'Half-Marathon': 'Half Marathon',
    'Marathon': 'Marathon',
  };
  const bestEfforts = (s.best_efforts || [])
    .map(e => {
      const name = EFFORT_MAP[e.name];
      if (!name) return null;
      return {
        name,
        distance: e.distance,
        duration: e.moving_time,
        pace: e.moving_time > 0 && e.distance > 0
          ? Math.round(e.moving_time / (e.distance / 1000))
          : null,
      };
    })
    .filter(Boolean);

  return {
    id: `strava-${s.id}`,
    stravaId: s.id,
    name: s.name,
    date: s.start_date,
    type: 'run',
    source: 'strava',

    distance: Math.round(s.distance),
    duration: s.elapsed_time,
    movingTime: s.moving_time,

    avgPace,
    avgSpeed: s.average_speed ? Math.round(s.average_speed * 3.6 * 10) / 10 : null,
    maxSpeed: s.max_speed ? Math.round(s.max_speed * 3.6 * 10) / 10 : null,

    elevationGain: Math.round(s.total_elevation_gain || 0),
    elevationLoss: null,
    maxElevation: null,
    minElevation: null,

    avgHR: s.average_heartrate ? Math.round(s.average_heartrate) : null,
    maxHR: s.max_heartrate ? Math.round(s.max_heartrate) : null,
    hrZones: null,

    avgCadence: s.average_cadence ? Math.round(s.average_cadence * 2) : null,
    maxCadence: null,
    calories: s.calories || null,

    splits,
    bestEfforts,
    trackPoints,
  };
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const token = await getValidToken();
  if (!token) throw new Error('Not authenticated with Strava');

  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (res.status === 401) throw new Error('Strava session expired — please reconnect');
  if (res.status === 429) throw new Error('Strava rate limit reached — please wait 15 min');
  if (!res.ok) throw new Error(`Strava API error ${res.status}`);
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchAthlete() {
  return apiFetch('/athlete');
}

export async function fetchActivitiesPage(page = 1, perPage = 100) {
  const data = await apiFetch(`/athlete/activities?per_page=${perPage}&page=${page}`);
  return data
    .filter(a => a.type === 'Run' || a.sport_type === 'Run')
    .map(toActivity);
}

// ── Fetch detailed streams for one activity and enrich it ────────────────────
export async function fetchActivityStreams(stravaId, existingActivity) {
  const streamTypes = 'latlng,altitude,heartrate,cadence,time,distance';
  const data = await apiFetch(`/activities/${stravaId}/streams?keys=${streamTypes}&key_by_type=true`);

  const latlng = data.latlng?.data || [];
  const altitude = data.altitude?.data || [];
  const heartrate = data.heartrate?.data || [];
  const cadence = data.cadence?.data || [];
  const time = data.time?.data || [];
  const distance = data.distance?.data || [];

  const trackPoints = latlng.map((ll, i) => ({
    lat: ll[0],
    lon: ll[1],
    ele: altitude[i] != null ? Math.round(altitude[i] * 10) / 10 : null,
    hr: heartrate[i] || null,
    cad: cadence[i] ? cadence[i] * 2 : null,
    time: time[i] != null ? time[i] : null,
    d: distance[i] != null ? Math.round(distance[i]) : null,
  }));

  // Recalculate elevation gain/loss from stream
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxElevation = -Infinity;
  let minElevation = Infinity;
  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1].ele;
    const curr = trackPoints[i].ele;
    if (prev != null && curr != null) {
      const diff = curr - prev;
      if (diff > 0) elevationGain += diff;
      else elevationLoss += Math.abs(diff);
      if (curr > maxElevation) maxElevation = curr;
      if (curr < minElevation) minElevation = curr;
    }
  }

  // HR zones from stream
  let hrZones = null;
  const hrs = heartrate.filter(Boolean);
  if (hrs.length > 0) {
    const maxHR = existingActivity?.maxHR || Math.max(...hrs);
    const zones = [0, 0, 0, 0, 0];
    const thresholds = [0.6, 0.7, 0.8, 0.9, 1.0].map((t) => t * maxHR);
    for (const hr of hrs) {
      if (hr < thresholds[0]) zones[0]++;
      else if (hr < thresholds[1]) zones[1]++;
      else if (hr < thresholds[2]) zones[2]++;
      else if (hr < thresholds[3]) zones[3]++;
      else zones[4]++;
    }
    const total = zones.reduce((a, b) => a + b, 0);
    hrZones = zones.map((z) => Math.round((z / total) * 100));
  }

  return {
    ...existingActivity,
    elevationGain: elevationGain > 0 ? Math.round(elevationGain) : existingActivity?.elevationGain,
    elevationLoss: elevationLoss > 0 ? Math.round(elevationLoss) : null,
    maxElevation: maxElevation !== -Infinity ? Math.round(maxElevation) : null,
    minElevation: minElevation !== Infinity ? Math.round(minElevation) : null,
    avgHR: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : existingActivity?.avgHR,
    maxHR: hrs.length ? Math.round(Math.max(...hrs)) : existingActivity?.maxHR,
    hrZones,
    avgCadence: cadence.length
      ? Math.round(cadence.filter(Boolean).reduce((a, b) => a + b, 0) / cadence.filter(Boolean).length) * 2
      : existingActivity?.avgCadence,
    trackPoints,
    streamsLoaded: true,
  };
}

// Fetch all run activities, calling onProgress(count) as each batch arrives
export async function fetchAllActivities(existingIds = new Set(), onProgress) {
  const all = [];
  let page = 1;
  while (true) {
    const batch = await fetchActivitiesPage(page, 100);
    if (!batch.length) break;

    // Only include activities not already in localStorage
    const fresh = batch.filter(a => !existingIds.has(a.id));
    all.push(...fresh);
    onProgress?.(all.length, batch.length);

    if (batch.length < 100) break; // Last page
    page++;
  }
  return all;
}
