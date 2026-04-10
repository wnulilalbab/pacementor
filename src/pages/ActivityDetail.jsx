import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Trash2, Route, Clock, TrendingUp, Mountain,
  Heart, Zap, Flame, Activity, Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getActivityAnalytics, saveActivity } from '../utils/storage';
import {
  fmtDistance, fmtDuration, fmtPace, fmtSpeed, fmtElevation, fmtDate, fmtTime,
} from '../utils/formatters';
import StatCard from '../components/StatCard';
import ElevationChart from '../components/charts/ElevationChart';
import PaceChart from '../components/charts/PaceChart';
import HRChart from '../components/charts/HRChart';
import HRZonesChart from '../components/charts/HRZonesChart';
import SplitsTable from '../components/SplitsTable';
import BestEfforts from '../components/BestEfforts';
import { fetchActivityStreams } from '../utils/stravaApi';

function Section({ title, children, className = '' }) {
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activities, deleteActivity, updateActivity, settings } = useApp();
  const [analytics, setAnalytics] = useState(undefined); // undefined = loading, null = none
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);

  const activity = activities.find((a) => a.id === id);
  const unit = settings.unit || 'metric';

  useEffect(() => {
    if (id) {
      const a = getActivityAnalytics(id);
      setAnalytics(a ?? null);
      if (a?.hrSamples?.some(Boolean) || a?.eleSamples?.some(Boolean)) {
        setStreamsLoaded(true);
      }
    }
  }, [id]);

  if (!activity) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Activity not found.</p>
        <Link to="/activities" className="text-brand-500 text-sm mt-2 inline-block">← Back to activities</Link>
      </div>
    );
  }

  function handleDelete() {
    if (confirmDelete) { deleteActivity(id); navigate('/activities'); }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  }

  async function handleLoadStreams() {
    if (!activity.stravaId) return;
    setLoadingStreams(true);
    try {
      const enriched = await fetchActivityStreams(activity.stravaId, activity, settings);
      saveActivity(enriched);
      setAnalytics(getActivityAnalytics(id));
      setStreamsLoaded(true);
      if (updateActivity) updateActivity(enriched);
    } catch (err) {
      alert(`Failed to load detailed data: ${err.message}`);
    } finally {
      setLoadingStreams(false);
    }
  }

  const hasHR  = activity.avgHR != null;
  const hasEle = activity.elevationGain != null;
  const hasCad = activity.avgCadence != null;

  let effortScore = null;
  if (activity.hrZones) {
    effortScore = Math.round(activity.hrZones.reduce((s, pct, i) => s + pct * (i + 1), 0) / 100);
  }

  const hrPct = analytics?.hrPercentiles;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm mb-2 transition-colors">
            <ArrowLeft size={15} /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{activity.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{fmtDate(activity.date)} · {fmtTime(activity.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {activity.source === 'strava' && !streamsLoaded && (
            <button
              onClick={handleLoadStreams}
              disabled={loadingStreams}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-brand-50 border border-brand-200 text-brand-600 hover:bg-brand-100 transition-all disabled:opacity-60"
            >
              <Download size={14} className={loadingStreams ? 'animate-bounce' : ''} />
              {loadingStreams ? 'Loading…' : 'Load full data'}
            </button>
          )}
          <button
            onClick={handleDelete}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${confirmDelete ? 'bg-red-50 text-red-500 border border-red-200' : 'text-slate-400 hover:text-red-400 hover:bg-red-50'}`}
          >
            <Trash2 size={15} />
            {confirmDelete ? 'Confirm?' : ''}
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard label="Distance" value={fmtDistance(activity.distance, unit)} icon={Route} />
        <StatCard label="Moving Time" value={fmtDuration(activity.movingTime)} icon={Clock} />
        <StatCard label="Avg Pace" value={fmtPace(activity.avgPace, unit)} icon={TrendingUp} accent />
        {hasEle && <StatCard label="Elevation" value={`+${fmtElevation(activity.elevationGain, unit)}`} icon={Mountain} />}
        {hasHR && <StatCard label="Avg HR" value={`${activity.avgHR} bpm`} sub={`Max ${activity.maxHR} bpm`} icon={Heart} />}
        {hasCad && <StatCard label="Cadence" value={`${activity.avgCadence} spm`} sub={`Max ${activity.maxCadence}`} icon={Activity} />}
        <StatCard label="Calories" value={`${activity.calories}`} sub="kcal" icon={Flame} />
        {activity.avgSpeed && <StatCard label="Avg Speed" value={fmtSpeed(activity.avgSpeed, unit)} icon={Zap} />}
      </div>

      {/* Elevation */}
      {analytics?.eleSamples?.some(Boolean) && (
        <Section title="Elevation Profile">
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            {activity.elevationGain != null && <span><span className="text-amber-500">↑</span> {fmtElevation(activity.elevationGain, unit)} gain</span>}
            {activity.elevationLoss != null && <span><span className="text-brand-500">↓</span> {fmtElevation(activity.elevationLoss, unit)} loss</span>}
            {activity.maxElevation != null && <span>Max {fmtElevation(activity.maxElevation, unit)}</span>}
          </div>
          <ElevationChart analytics={analytics} unit={unit} />
        </Section>
      )}

      {/* Pace per km */}
      {activity.splits?.length > 0 && (
        <Section title="Pace per km">
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            <span>Avg {fmtPace(activity.avgPace, unit)}</span>
            {activity.splits.length > 1 && (
              <>
                <span className="text-accent-500">Best {fmtPace(Math.min(...activity.splits.map((s) => s.pace).filter(Boolean)), unit)}</span>
                <span className="text-red-400">Worst {fmtPace(Math.max(...activity.splits.map((s) => s.pace).filter(Boolean)), unit)}</span>
              </>
            )}
          </div>
          <PaceChart splits={activity.splits} avgPace={activity.avgPace} unit={unit} />
        </Section>
      )}

      {/* Heart Rate */}
      {hasHR && (
        <Section title="Heart Rate">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
            <span>Avg <span className="text-red-400 font-medium">{activity.avgHR} bpm</span></span>
            <span>Max <span className="text-red-400 font-medium">{activity.maxHR} bpm</span></span>
            {effortScore != null && <span>Effort <span className="text-brand-500 font-semibold">{effortScore}/5</span></span>}
          </div>

          {analytics?.hrSamples?.some(Boolean) && (
            <HRChart analytics={analytics} avgHR={activity.avgHR} unit={unit} />
          )}

          {/* HR percentile strip */}
          {hrPct && (
            <div className="mt-4 grid grid-cols-6 gap-1 text-center">
              {[['p10', 'P10'], ['p25', 'P25'], ['p50', 'Median'], ['p75', 'P75'], ['p90', 'P90'], ['p95', 'P95']].map(([key, label]) => (
                <div key={key} className="bg-red-50 rounded-lg px-1 py-2">
                  <div className="text-xs text-red-400 font-semibold">{hrPct[key]}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {activity.hrZones && (
            <div className="mt-4">
              <HRZonesChart hrZones={activity.hrZones} />
            </div>
          )}
        </Section>
      )}

      {/* Best efforts */}
      {activity.bestEfforts?.length > 0 && (
        <Section title="Best Efforts">
          <BestEfforts bestEfforts={activity.bestEfforts} unit={unit} />
        </Section>
      )}

      {/* Splits */}
      {activity.splits?.length > 0 && (
        <Section title="Splits">
          <SplitsTable splits={activity.splits} unit={unit} />
        </Section>
      )}

      {/* Activity details */}
      <Section title="Activity Details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <DetailRow label="Total Distance" value={fmtDistance(activity.distance, unit)} />
          <DetailRow label="Elapsed Time" value={fmtDuration(activity.duration)} />
          <DetailRow label="Moving Time" value={fmtDuration(activity.movingTime)} />
          {activity.maxSpeed && <DetailRow label="Max Speed" value={fmtSpeed(activity.maxSpeed, unit)} />}
          {activity.elevationGain != null && <DetailRow label="Elevation Gain" value={fmtElevation(activity.elevationGain, unit)} />}
          {activity.elevationLoss != null && <DetailRow label="Elevation Loss" value={fmtElevation(activity.elevationLoss, unit)} />}
          {activity.maxElevation != null && <DetailRow label="Max Elevation" value={fmtElevation(activity.maxElevation, unit)} />}
          {hasCad && <DetailRow label="Max Cadence" value={`${activity.maxCadence} spm`} />}
          <DetailRow label="Calories" value={`${activity.calories} kcal`} />
        </div>
      </Section>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="bg-brand-50 rounded-lg px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-800 font-medium text-sm">{value}</div>
    </div>
  );
}
