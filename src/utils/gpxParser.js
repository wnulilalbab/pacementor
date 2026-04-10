// Haversine distance between two lat/lon points (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function elemText(parent, localName) {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i].textContent.trim();
  }
  return null;
}

function movingAvg(arr, win = 7) {
  return arr.map((_, i) => {
    const s = Math.max(0, i - Math.floor(win / 2));
    const e = Math.min(arr.length, s + win);
    const slice = arr.slice(s, e);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function calcElevationStats(elevations) {
  if (elevations.length < 2) return { gain: 0, loss: 0, max: null, min: null };
  const smoothed = movingAvg(elevations, 7);
  let gain = 0, loss = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const d = smoothed[i] - smoothed[i - 1];
    if (d > 0.5) gain += d;
    else if (d < -0.5) loss += Math.abs(d);
  }
  return { gain: Math.round(gain), loss: Math.round(loss), max: Math.round(Math.max(...elevations)), min: Math.round(Math.min(...elevations)) };
}

function calcSplits(points, cumDists) {
  const splits = [];
  let km = 1, startIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (cumDists[i] >= km * 1000) {
      const seg = points.slice(startIdx, i + 1);
      const dist = cumDists[i] - cumDists[startIdx];
      const duration = points[i].time && points[startIdx].time ? (points[i].time - points[startIdx].time) / 1000 : null;
      const hrs = seg.map((p) => p.hr).filter(Boolean);
      const eles = seg.map((p) => p.ele).filter((e) => e != null && !isNaN(e));
      splits.push({ km, distance: Math.round(dist), duration: duration ? Math.round(duration) : null,
        pace: duration && dist > 0 ? Math.round(duration / (dist / 1000)) : null,
        avgHR: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
        elevationDiff: eles.length > 1 ? Math.round(eles[eles.length - 1] - eles[0]) : 0 });
      startIdx = i; km++;
    }
  }
  const remDist = cumDists[points.length - 1] - cumDists[startIdx];
  if (remDist > 100) {
    const seg = points.slice(startIdx);
    const duration = points[points.length - 1].time && points[startIdx].time ? (points[points.length - 1].time - points[startIdx].time) / 1000 : null;
    const hrs = seg.map((p) => p.hr).filter(Boolean);
    splits.push({ km, distance: Math.round(remDist), duration: duration ? Math.round(duration) : null,
      pace: duration && remDist > 0 ? Math.round(duration / (remDist / 1000)) : null,
      avgHR: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null, elevationDiff: 0, isPartial: true });
  }
  return splits;
}

function bestEffort(points, cumDists, targetDist) {
  const n = points.length;
  if (cumDists[n - 1] < targetDist * 0.95) return null;
  let best = Infinity, j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (j <= i) j = i + 1;
    while (j < n - 1 && cumDists[j] - cumDists[i] < targetDist) j++;
    if (cumDists[j] - cumDists[i] >= targetDist && points[i].time && points[j].time) {
      const t = (points[j].time - points[i].time) / 1000;
      if (t > 0) best = Math.min(best, t);
    }
  }
  if (!isFinite(best)) return null;
  return { distance: targetDist, duration: Math.round(best), pace: Math.round(best / (targetDist / 1000)) };
}

function calcHRZones(hrValues, hrMax) {
  if (!hrValues.length || !hrMax) return null;
  const z = [0, 0, 0, 0, 0];
  for (const hr of hrValues) {
    const p = hr / hrMax;
    if (p < 0.6) z[0]++; else if (p < 0.7) z[1]++; else if (p < 0.8) z[2]++; else if (p < 0.9) z[3]++; else z[4]++;
  }
  const total = hrValues.length;
  return z.map((v) => Math.round((v / total) * 100));
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

function avgArr(arr) {
  const v = arr.filter((x) => x != null && !isNaN(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

function pctile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.floor((p / 100) * (sorted.length - 1))];
}

export function computePercentiles(values) {
  const v = values.filter((x) => x != null && !isNaN(x));
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return { p10: pctile(s, 10), p25: pctile(s, 25), p50: pctile(s, 50), p75: pctile(s, 75), p90: pctile(s, 90), p95: pctile(s, 95) };
}

// Aggregate raw points into 30-second interval analytics (no lat/lon stored)
function buildAnalytics(raw, cumDists) {
  const INTERVAL = 30; // seconds
  const hasTime = raw.length > 1 && raw[0].time != null;

  const hrSamples = [], eleSamples = [], cadSamples = [], paceSamples = [], distSamples = [];

  if (hasTime) {
    const startTime = raw[0].time;
    const endTime   = raw[raw.length - 1].time;
    const totalSecs = (endTime - startTime) / 1000;
    const numBuckets = Math.max(1, Math.ceil(totalSecs / INTERVAL));

    for (let b = 0; b < numBuckets; b++) {
      const tStart = startTime + b * INTERVAL * 1000;
      const tEnd   = tStart + INTERVAL * 1000;

      let firstIdx = -1, lastIdx = -1;
      const hrs = [], eles = [], cads = [];

      for (let i = 0; i < raw.length; i++) {
        if (raw[i].time == null) continue;
        if (raw[i].time >= tStart && raw[i].time < tEnd) {
          if (firstIdx < 0) firstIdx = i;
          lastIdx = i;
          if (raw[i].hr)  hrs.push(raw[i].hr);
          if (raw[i].ele != null && !isNaN(raw[i].ele)) eles.push(raw[i].ele);
          if (raw[i].cad) cads.push(raw[i].cad);
        }
      }

      if (firstIdx < 0) continue;

      const segDist = cumDists[lastIdx] - cumDists[firstIdx];
      const segTime = (raw[lastIdx].time - raw[firstIdx].time) / 1000;
      const pace = segDist > 10 && segTime > 5 ? Math.round(segTime / (segDist / 1000)) : null;

      hrSamples.push(avgArr(hrs));
      eleSamples.push(avgArr(eles));
      cadSamples.push(avgArr(cads));
      paceSamples.push(pace);
      distSamples.push(Math.round(cumDists[firstIdx]));
    }
  } else {
    // No timestamps — distance-based buckets, max 150 samples
    const totalDist = cumDists[cumDists.length - 1];
    const step = Math.max(100, Math.round(totalDist / 150));
    for (let d = 0; d < totalDist; d += step) {
      const hrs = [], eles = [], cads = [];
      for (let i = 0; i < raw.length; i++) {
        if (cumDists[i] >= d && cumDists[i] < d + step) {
          if (raw[i].hr)  hrs.push(raw[i].hr);
          if (raw[i].ele != null && !isNaN(raw[i].ele)) eles.push(raw[i].ele);
          if (raw[i].cad) cads.push(raw[i].cad);
        }
      }
      hrSamples.push(avgArr(hrs));
      eleSamples.push(avgArr(eles));
      cadSamples.push(avgArr(cads));
      paceSamples.push(null);
      distSamples.push(Math.round(d));
    }
  }

  return {
    intervalSecs: hasTime ? INTERVAL : null,
    hrSamples,
    eleSamples,
    cadSamples,
    paceSamples,
    distSamples,
    hrPercentiles:   computePercentiles(hrSamples),
    pacePercentiles: computePercentiles(paceSamples),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseGPX(file, settings = {}) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid GPX file');

  const nameEl = doc.querySelector('trk > name') || doc.querySelector('name');
  const name = nameEl ? nameEl.textContent.trim() : file.name.replace(/\.gpx$/i, '');

  const trkpts = [...doc.querySelectorAll('trkpt')];
  if (!trkpts.length) throw new Error('No track points found in GPX file');

  const raw = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lon)) return null;

    const eleText = pt.querySelector('ele')?.textContent;
    const ele = eleText ? parseFloat(eleText) : NaN;
    const timeText = pt.querySelector('time')?.textContent;
    const time = timeText ? new Date(timeText).getTime() : null;

    const hrRaw = elemText(pt, 'hr') || elemText(pt, 'heartrate') || elemText(pt, 'HeartRateBpm');
    const hr = hrRaw ? parseInt(hrRaw) || null : null;

    const cadRaw = elemText(pt, 'cad') || elemText(pt, 'cadence');
    const cadParsed = cadRaw ? parseInt(cadRaw) : null;
    const cad = cadParsed != null ? (cadParsed < 100 ? cadParsed * 2 : cadParsed) : null;

    return { lat, lon, ele, time, hr, cad };
  }).filter(Boolean);

  if (!raw.length) throw new Error('No valid track points');
  if (raw[0].time) raw.sort((a, b) => a.time - b.time);

  // Cumulative distances (needs lat/lon — computed here but not stored)
  const cumDists = [0];
  for (let i = 1; i < raw.length; i++) {
    cumDists.push(cumDists[i - 1] + haversine(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon));
  }
  const totalDist = cumDists[cumDists.length - 1];

  const startTime = raw[0].time;
  const endTime   = raw[raw.length - 1].time;
  const elapsed   = startTime && endTime ? (endTime - startTime) / 1000 : null;

  let movingTime = 0;
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].time || !raw[i - 1].time) continue;
    const segDist = cumDists[i] - cumDists[i - 1];
    const segTime = (raw[i].time - raw[i - 1].time) / 1000;
    if (segTime > 0 && segDist / segTime >= 0.5) movingTime += segTime;
  }

  const avgPace  = movingTime && totalDist > 0 ? Math.round(movingTime / (totalDist / 1000)) : null;
  const avgSpeed = movingTime && totalDist > 0 ? Math.round(((totalDist / movingTime) * 3.6) * 10) / 10 : null;

  let maxSpeedMs = 0;
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].time || !raw[i - 1].time) continue;
    const t = (raw[i].time - raw[i - 1].time) / 1000;
    if (t > 0) { const v = (cumDists[i] - cumDists[i - 1]) / t; if (v > maxSpeedMs) maxSpeedMs = v; }
  }
  const maxSpeed = maxSpeedMs > 0 ? Math.round(maxSpeedMs * 3.6 * 10) / 10 : null;

  const eles    = raw.map((p) => p.ele).filter((e) => !isNaN(e));
  const eleStats = calcElevationStats(eles);

  const hrVals  = raw.map((p) => p.hr).filter(Boolean);
  const avgHR   = hrVals.length ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length) : null;
  const maxHR   = hrVals.length ? Math.max(...hrVals) : null;
  let hrMax     = settings.hrMax || null;
  if (!hrMax && settings.birthYear) { const age = new Date().getFullYear() - Number(settings.birthYear); if (age > 10 && age < 100) hrMax = Math.round(220 - age); }
  if (!hrMax && maxHR) hrMax = Math.round(maxHR * 1.05);
  const hrZones = hrVals.length > 30 ? calcHRZones(hrVals, hrMax) : null;

  const cadVals    = raw.map((p) => p.cad).filter(Boolean);
  const avgCadence = cadVals.length ? Math.round(cadVals.reduce((a, b) => a + b, 0) / cadVals.length) : null;
  const maxCadence = cadVals.length ? Math.max(...cadVals) : null;

  const weight   = settings.weight || 70;
  const hours    = (movingTime || elapsed || 0) / 3600;
  const met      = avgSpeed ? Math.max(6, avgSpeed) : 10;
  const calories = Math.round(met * weight * hours);

  const splits      = calcSplits(raw, cumDists);
  const effortDefs  = [
    { name: '400m', dist: 400 }, { name: '1 km', dist: 1000 }, { name: '1 mile', dist: 1609 },
    { name: '5 km', dist: 5000 }, { name: '10 km', dist: 10000 }, { name: '15 km', dist: 15000 },
    { name: 'Half Marathon', dist: 21097 }, { name: 'Marathon', dist: 42195 },
  ];
  const bestEfforts = effortDefs.map(({ name: n, dist }) => { const r = bestEffort(raw, cumDists, dist); return r ? { name: n, ...r } : null; }).filter(Boolean);

  // Build analytics (no lat/lon stored — only aggregated metrics)
  const analytics = buildAnalytics(raw, cumDists);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    date:   startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
    source: 'gpx',
    type:   'run',
    distance:    Math.round(totalDist),
    duration:    elapsed ? Math.round(elapsed) : null,
    movingTime:  Math.round(movingTime),
    avgPace, avgSpeed, maxSpeed,
    elevationGain: eleStats.gain, elevationLoss: eleStats.loss, maxElevation: eleStats.max, minElevation: eleStats.min,
    avgHR, maxHR, hrZones,
    avgCadence, maxCadence,
    calories,
    splits, bestEfforts,
    analytics,
  };
}
