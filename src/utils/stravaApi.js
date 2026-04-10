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

// ── Determine true HRmax for zone calculation ─────────────────────────────────
// Priority: settings.hrMax → 220-age formula → run max + 5% safety buffer
function resolveHRmax(settings, runMaxHR) {
  if (settings?.hrMax) return settings.hrMax;
  if (settings?.birthYear) {
    const age = new Date().getFullYear() - Number(settings.birthYear);
    if (age > 10 && age < 100) return Math.round(220 - age);
  }
  // Use run max with a 5% buffer — a typical run rarely reaches true HRmax
  if (runMaxHR) return Math.round(runMaxHR * 1.05);
  return null;
}

// ── HR zone distribution ──────────────────────────────────────────────────────
function calcHRZones(hrs, hrMax) {
  if (!hrs.length || !hrMax) return null;
  const z = [0, 0, 0, 0, 0];
  for (const hr of hrs) {
    const p = hr / hrMax;
    if (p < 0.6)      z[0]++;
    else if (p < 0.7) z[1]++;
    else if (p < 0.8) z[2]++;
    else if (p < 0.9) z[3]++;
    else              z[4]++;
  }
  const total = z.reduce((a, b) => a + b, 0);
  return z.map((v) => Math.round((v / total) * 100));
}

// ── Convert Strava SummaryActivity → our format (used for list import) ────────
function toActivity(s) {
  const avgPace = s.average_speed > 0 ? Math.round(1000 / s.average_speed) : null;

  const rawPts = decodePolyline(s.map?.summary_polyline);
  const trackPoints = rawPts.map((p) => ({
    lat: p.lat, lon: p.lon, ele: null, time: null, d: 0, hr: null, cad: null,
  }));
  let cum = 0;
  for (let k = 1; k < trackPoints.length; k++) {
    cum += haversine(trackPoints[k - 1].lat, trackPoints[k - 1].lon, trackPoints[k].lat, trackPoints[k].lon);
    trackPoints[k].d = Math.round(cum);
  }

  // NOTE: splits_metric, best_efforts, calories are only in DetailedActivity.
  // They will be populated when the user clicks "Load full data".
  const splits = parseSplits(s.splits_metric);
  const bestEfforts = parseBestEfforts(s.best_efforts);

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

// ── Parse splits from Strava API response ────────────────────────────────────
function parseSplits(splitsMetric) {
  return (splitsMetric || []).map(sp => ({
    km: sp.split,
    distance: Math.round(sp.distance),
    duration: sp.moving_time,
    pace: sp.average_speed > 0 ? Math.round(1000 / sp.average_speed) : null,
    avgHR: sp.average_heartrate ? Math.round(sp.average_heartrate) : null,
    elevationDiff: Math.round(sp.elevation_difference || 0),
  }));
}

// ── Parse best efforts from Strava API response ──────────────────────────────
const EFFORT_MAP = {
  '400m': '400m', '1k': '1 km', '1 mile': '1 mile',
  '5k': '5 km', '10k': '10 km', '15k': '15 km',
  'Half-Marathon': 'Half Marathon', 'Marathon': 'Marathon',
};

function parseBestEfforts(efforts) {
  return (efforts || [])
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

export async function fetchActivitiesPage(page = 1, perPage = 100, after = null) {
  let url = `/athlete/activities?per_page=${perPage}&page=${page}`;
  if (after) url += `&after=${Math.floor(new Date(after).getTime() / 1000)}`;
  const data = await apiFetch(url);
  return data
    .filter(a => a.type === 'Run' || a.sport_type === 'Run')
    .map(toActivity);
}

// Fetch all run activities, calling onProgress(count) as each batch arrives
export async function fetchAllActivities(existingIds = new Set(), onProgress) {
  const all = [];
  let page = 1;
  while (true) {
    const batch = await fetchActivitiesPage(page, 100);
    if (!batch.length) break;
    const fresh = batch.filter(a => !existingIds.has(a.id));
    all.push(...fresh);
    onProgress?.(all.length, batch.length);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

// Fetch activities since a given ISO date (for coaching plan sync)
export async function fetchActivitiesSince(afterISO, existingIds = new Set(), onProgress) {
  const all = [];
  let page = 1;
  while (true) {
    const batch = await fetchActivitiesPage(page, 100, afterISO);
    if (!batch.length) break;
    const fresh = batch.filter(a => !existingIds.has(a.id));
    all.push(...fresh);
    onProgress?.(all.length);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

// ── Fetch analytics data + detailed metadata for one Strava activity ─────────
// Calls two endpoints in parallel:
//   1. /activities/{id}         → calories, splits, best efforts, cadence
//   2. /activities/{id}/streams → per-second HR, altitude, cadence, time, distance
//   No lat/lon fetched — route is not needed, only metrics.
import { computePercentiles } from './gpxParser';

export async function fetchActivityStreams(stravaId, existingActivity, settings = {}) {
  const streamKeys = 'altitude,heartrate,cadence,time,distance';
  const [detail, streams] = await Promise.all([
    apiFetch(`/activities/${stravaId}`),
    apiFetch(`/activities/${stravaId}/streams?keys=${streamKeys}&key_by_type=true`),
  ]);

  const altitude  = streams.altitude?.data  || [];
  const heartrate = streams.heartrate?.data || [];
  const cadence   = streams.cadence?.data   || [];
  const timeArr   = streams.time?.data      || [];
  const distArr   = streams.distance?.data  || [];
  const n = timeArr.length || altitude.length || heartrate.length;

  // ── Elevation stats ───────────────────────────────────────────────────────
  let elevationGain = 0, elevationLoss = 0;
  let maxEle = -Infinity, minEle = Infinity;
  for (let i = 1; i < altitude.length; i++) {
    const prev = altitude[i - 1], curr = altitude[i];
    if (prev != null && curr != null) {
      const diff = curr - prev;
      if (diff > 1) elevationGain += diff;
      else if (diff < -1) elevationLoss += Math.abs(diff);
      if (curr > maxEle) maxEle = curr;
      if (curr < minEle) minEle = curr;
    }
  }

  // ── HR ────────────────────────────────────────────────────────────────────
  const hrs = heartrate.filter(Boolean);
  const runMaxHR = hrs.length ? Math.max(...hrs) : (detail.max_heartrate || existingActivity?.maxHR);
  const hrMax   = resolveHRmax(settings, runMaxHR);
  const hrZones = hrs.length > 30 ? calcHRZones(hrs, hrMax) : null;

  // ── Build analytics (30-second aggregation, no route data) ───────────────
  const INTERVAL = 30;
  const hrSamples = [], eleSamples = [], cadSamples = [], paceSamples = [], distSamples = [];

  for (let i = 0; i < n; i += INTERVAL) {
    const end = Math.min(i + INTERVAL, n);
    const bHR  = heartrate.slice(i, end).filter(Boolean);
    const bEle = altitude.slice(i, end).filter((v) => v != null);
    const bCad = cadence.slice(i, end).filter(Boolean);

    const segDist = distArr.length ? (distArr[end - 1] ?? 0) - (distArr[i] ?? 0) : 0;
    const segTime = timeArr.length ? (timeArr[end - 1] ?? 0) - (timeArr[i] ?? 0) : 0;
    const pace = segDist > 10 && segTime > 5 ? Math.round(segTime / (segDist / 1000)) : null;

    const avgOf = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    hrSamples.push(avgOf(bHR));
    eleSamples.push(avgOf(bEle));
    cadSamples.push(bCad.length ? avgOf(bCad) * 2 : null);
    paceSamples.push(pace);
    distSamples.push(distArr.length ? Math.round(distArr[i] ?? 0) : Math.round(i * (existingActivity?.distance ?? 0) / n));
  }

  const analytics = {
    intervalSecs:    INTERVAL,
    hrSamples,
    eleSamples,
    cadSamples,
    paceSamples,
    distSamples,
    hrPercentiles:   computePercentiles(hrSamples),
    pacePercentiles: computePercentiles(paceSamples),
  };

  // ── Metadata ──────────────────────────────────────────────────────────────
  const splits      = parseSplits(detail.splits_metric);
  const bestEfforts = parseBestEfforts(detail.best_efforts);

  const avgCadFromStream = cadence.filter(Boolean);
  const avgCad = avgCadFromStream.length
    ? Math.round(avgCadFromStream.reduce((a, b) => a + b, 0) / avgCadFromStream.length) * 2
    : (detail.average_cadence ? Math.round(detail.average_cadence * 2) : existingActivity?.avgCadence);
  const maxCad = avgCadFromStream.length ? Math.max(...avgCadFromStream) * 2 : (detail.max_cadence ? detail.max_cadence * 2 : null);

  return {
    ...existingActivity,
    calories:     detail.calories    || existingActivity?.calories,
    splits:       splits.length      ? splits      : existingActivity?.splits,
    bestEfforts:  bestEfforts.length ? bestEfforts : existingActivity?.bestEfforts,
    avgCadence:   avgCad,
    maxCadence:   maxCad,
    elevationGain: elevationGain > 0 ? Math.round(elevationGain) : existingActivity?.elevationGain,
    elevationLoss: elevationLoss > 0 ? Math.round(elevationLoss) : null,
    maxElevation:  maxEle !== -Infinity ? Math.round(maxEle) : null,
    minElevation:  minEle !== Infinity  ? Math.round(minEle) : null,
    avgHR: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : existingActivity?.avgHR,
    maxHR: runMaxHR || existingActivity?.maxHR,
    hrZones,
    analytics,
    streamsLoaded: true,
  };
}
