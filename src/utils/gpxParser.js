// Haversine distance between two lat/lon points (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get text content of first descendant element with a given localName
function elemText(parent, localName) {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i].textContent.trim();
  }
  return null;
}

// Smooth an array of numbers with a moving average
function movingAvg(arr, win = 7) {
  return arr.map((_, i) => {
    const s = Math.max(0, i - Math.floor(win / 2));
    const e = Math.min(arr.length, s + win);
    const slice = arr.slice(s, e);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Elevation gain / loss with noise filtering
function calcElevationStats(elevations) {
  if (elevations.length < 2) return { gain: 0, loss: 0, max: null, min: null };
  const smoothed = movingAvg(elevations, 7);
  let gain = 0,
    loss = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const d = smoothed[i] - smoothed[i - 1];
    if (d > 0.5) gain += d;
    else if (d < -0.5) loss += Math.abs(d);
  }
  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    max: Math.round(Math.max(...elevations)),
    min: Math.round(Math.min(...elevations)),
  };
}

// Per-km splits
function calcSplits(points, cumDists) {
  const splits = [];
  let km = 1;
  let startIdx = 0;

  for (let i = 1; i < points.length; i++) {
    if (cumDists[i] >= km * 1000) {
      const seg = points.slice(startIdx, i + 1);
      const dist = cumDists[i] - cumDists[startIdx];
      const duration =
        points[i].time && points[startIdx].time
          ? (points[i].time - points[startIdx].time) / 1000
          : null;
      const hrs = seg.map((p) => p.hr).filter(Boolean);
      const eles = seg.map((p) => p.ele).filter((e) => e != null && !isNaN(e));
      splits.push({
        km,
        distance: Math.round(dist),
        duration: duration ? Math.round(duration) : null,
        pace:
          duration && dist > 0
            ? Math.round(duration / (dist / 1000))
            : null,
        avgHR: hrs.length
          ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
          : null,
        elevationDiff:
          eles.length > 1
            ? Math.round(eles[eles.length - 1] - eles[0])
            : 0,
      });
      startIdx = i;
      km++;
    }
  }

  // Partial last km
  const remDist = cumDists[points.length - 1] - cumDists[startIdx];
  if (remDist > 100) {
    const seg = points.slice(startIdx);
    const duration =
      points[points.length - 1].time && points[startIdx].time
        ? (points[points.length - 1].time - points[startIdx].time) / 1000
        : null;
    const hrs = seg.map((p) => p.hr).filter(Boolean);
    splits.push({
      km,
      distance: Math.round(remDist),
      duration: duration ? Math.round(duration) : null,
      pace:
        duration && remDist > 0
          ? Math.round(duration / (remDist / 1000))
          : null,
      avgHR: hrs.length
        ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
        : null,
      elevationDiff: 0,
      isPartial: true,
    });
  }

  return splits;
}

// Best effort for a given target distance using two-pointer approach
function bestEffort(points, cumDists, targetDist) {
  const n = points.length;
  const total = cumDists[n - 1];
  if (total < targetDist * 0.95) return null;

  let best = Infinity;
  let j = 0;

  for (let i = 0; i < n - 1; i++) {
    if (j <= i) j = i + 1;
    while (j < n - 1 && cumDists[j] - cumDists[i] < targetDist) j++;
    if (cumDists[j] - cumDists[i] >= targetDist) {
      if (points[i].time && points[j].time) {
        const t = (points[j].time - points[i].time) / 1000;
        if (t > 0) best = Math.min(best, t);
      }
    }
  }

  if (!isFinite(best)) return null;
  return {
    distance: targetDist,
    duration: Math.round(best),
    pace: Math.round(best / (targetDist / 1000)),
  };
}

// HR zone distribution (% time in each zone)
function calcHRZones(hrValues, hrMax) {
  if (!hrValues.length || !hrMax) return null;
  const z = [0, 0, 0, 0, 0];
  for (const hr of hrValues) {
    const p = hr / hrMax;
    if (p < 0.6) z[0]++;
    else if (p < 0.7) z[1]++;
    else if (p < 0.8) z[2]++;
    else if (p < 0.9) z[3]++;
    else z[4]++;
  }
  const total = hrValues.length;
  return z.map((v) => Math.round((v / total) * 100));
}

// Downsample to at most maxPts points
function downsample(points, maxPts) {
  if (points.length <= maxPts) return points;
  const step = Math.ceil(points.length / maxPts);
  const result = [];
  for (let i = 0; i < points.length; i += step) result.push(points[i]);
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function parseGPX(file, settings = {}) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) throw new Error('Invalid GPX file');

  // Activity name
  const nameEl =
    doc.querySelector('trk > name') ||
    doc.querySelector('name');
  const name = nameEl
    ? nameEl.textContent.trim()
    : file.name.replace(/\.gpx$/i, '');

  // Track points
  const trkpts = [...doc.querySelectorAll('trkpt')];
  if (!trkpts.length) throw new Error('No track points found in GPX file');

  const raw = trkpts
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) return null;

      const eleText = pt.querySelector('ele')?.textContent;
      const ele = eleText ? parseFloat(eleText) : NaN;

      const timeText = pt.querySelector('time')?.textContent;
      const time = timeText ? new Date(timeText).getTime() : null;

      // HR — several common namespace variants
      const hrRaw =
        elemText(pt, 'hr') ||
        elemText(pt, 'heartrate') ||
        elemText(pt, 'HeartRateBpm');
      const hr = hrRaw ? parseInt(hrRaw) || null : null;

      // Cadence (some devices record one foot, multiply × 2 for SPM)
      const cadRaw = elemText(pt, 'cad') || elemText(pt, 'cadence');
      const cadParsed = cadRaw ? parseInt(cadRaw) : null;
      // Heuristic: if cadence < 100 it's likely per-foot, double it
      const cad =
        cadParsed != null
          ? cadParsed < 100
            ? cadParsed * 2
            : cadParsed
          : null;

      return { lat, lon, ele, time, hr, cad };
    })
    .filter(Boolean);

  if (!raw.length) throw new Error('No valid track points');

  // Sort by time if timestamps available
  if (raw[0].time) raw.sort((a, b) => a.time - b.time);

  // Cumulative distances
  const cumDists = [0];
  for (let i = 1; i < raw.length; i++) {
    cumDists.push(
      cumDists[i - 1] + haversine(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon)
    );
  }
  const totalDist = cumDists[cumDists.length - 1];

  // Time metrics
  const startTime = raw[0].time;
  const endTime = raw[raw.length - 1].time;
  const elapsed = startTime && endTime ? (endTime - startTime) / 1000 : null;

  // Moving time (segments where speed ≥ 0.5 m/s count as moving)
  let movingTime = 0;
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].time || !raw[i - 1].time) continue;
    const segDist = cumDists[i] - cumDists[i - 1];
    const segTime = (raw[i].time - raw[i - 1].time) / 1000;
    if (segTime > 0 && segDist / segTime >= 0.5) movingTime += segTime;
  }

  // Pace / speed
  const avgPace =
    movingTime && totalDist > 0
      ? Math.round(movingTime / (totalDist / 1000))
      : null;
  const avgSpeed =
    movingTime && totalDist > 0
      ? Math.round(((totalDist / movingTime) * 3.6) * 10) / 10
      : null;

  // Max instantaneous speed
  let maxSpeedMs = 0;
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].time || !raw[i - 1].time) continue;
    const t = (raw[i].time - raw[i - 1].time) / 1000;
    if (t > 0) {
      const v = (cumDists[i] - cumDists[i - 1]) / t;
      if (v > maxSpeedMs) maxSpeedMs = v;
    }
  }
  const maxSpeed = maxSpeedMs > 0 ? Math.round(maxSpeedMs * 3.6 * 10) / 10 : null;

  // Elevation
  const eles = raw.map((p) => p.ele).filter((e) => !isNaN(e));
  const eleStats = calcElevationStats(eles);

  // HR
  const hrVals = raw.map((p) => p.hr).filter(Boolean);
  const avgHR = hrVals.length
    ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
    : null;
  const maxHR = hrVals.length ? Math.max(...hrVals) : null;
  const hrMax = settings.hrMax || maxHR;
  const hrZones = hrVals.length > 30 ? calcHRZones(hrVals, hrMax) : null;

  // Cadence
  const cadVals = raw.map((p) => p.cad).filter(Boolean);
  const avgCadence = cadVals.length
    ? Math.round(cadVals.reduce((a, b) => a + b, 0) / cadVals.length)
    : null;
  const maxCadence = cadVals.length ? Math.max(...cadVals) : null;

  // Calories (MET-based estimate)
  const weight = settings.weight || 70;
  const hours = (movingTime || elapsed || 0) / 3600;
  const met = avgSpeed ? Math.max(6, avgSpeed) : 10;
  const calories = Math.round(met * weight * hours);

  // Splits
  const splits = calcSplits(raw, cumDists);

  // Best efforts
  const effortDefs = [
    { name: '400m', dist: 400 },
    { name: '1 km', dist: 1000 },
    { name: '1 mile', dist: 1609 },
    { name: '5 km', dist: 5000 },
    { name: '10 km', dist: 10000 },
    { name: '15 km', dist: 15000 },
    { name: 'Half Marathon', dist: 21097 },
    { name: 'Marathon', dist: 42195 },
  ];
  const bestEfforts = effortDefs
    .map(({ name: n, dist }) => {
      const r = bestEffort(raw, cumDists, dist);
      return r ? { name: n, ...r } : null;
    })
    .filter(Boolean);

  // Downsample track for storage (max 2000 pts)
  const trackPoints = downsample(
    raw.map((p, i) => ({
      lat: Math.round(p.lat * 1e5) / 1e5,
      lon: Math.round(p.lon * 1e5) / 1e5,
      ele: isNaN(p.ele) ? null : Math.round(p.ele * 10) / 10,
      time: p.time,
      d: Math.round(cumDists[i]),
      hr: p.hr,
      cad: p.cad,
    })),
    2000
  );

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    date: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
    type: 'run',

    distance: Math.round(totalDist),
    duration: elapsed ? Math.round(elapsed) : null,
    movingTime: Math.round(movingTime),

    avgPace,
    avgSpeed,
    maxSpeed,

    elevationGain: eleStats.gain,
    elevationLoss: eleStats.loss,
    maxElevation: eleStats.max,
    minElevation: eleStats.min,

    avgHR,
    maxHR,
    hrZones,

    avgCadence,
    maxCadence,
    calories,

    splits,
    bestEfforts,
    trackPoints,
  };
}
