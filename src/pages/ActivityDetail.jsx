import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Route,
  Clock,
  TrendingUp,
  Mountain,
  Heart,
  Zap,
  Flame,
  Activity,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTrackPoints } from '../utils/storage';
import {
  fmtDistance,
  fmtDuration,
  fmtPace,
  fmtSpeed,
  fmtElevation,
  fmtDate,
  fmtTime,
  HR_ZONE_LABELS,
  HR_ZONE_COLORS,
} from '../utils/formatters';
import StatCard from '../components/StatCard';
import ActivityMap from '../components/map/ActivityMap';
import ElevationChart from '../components/charts/ElevationChart';
import PaceChart from '../components/charts/PaceChart';
import HRChart from '../components/charts/HRChart';
import HRZonesChart from '../components/charts/HRZonesChart';
import SplitsTable from '../components/SplitsTable';
import BestEfforts from '../components/BestEfforts';

function Section({ title, children, className = '' }) {
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activities, deleteActivity, settings } = useApp();
  const [trackPoints, setTrackPoints] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activity = activities.find((a) => a.id === id);
  const unit = settings.unit || 'metric';

  useEffect(() => {
    if (id) {
      const tp = getTrackPoints(id);
      setTrackPoints(tp || []);
    }
  }, [id]);

  if (!activity) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Activity not found.</p>
        <Link to="/activities" className="text-orange-400 text-sm mt-2 inline-block">
          ← Back to activities
        </Link>
      </div>
    );
  }

  function handleDelete() {
    if (confirmDelete) {
      deleteActivity(id);
      navigate('/activities');
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  const hasHR = activity.avgHR != null;
  const hasEle = activity.elevationGain != null;
  const hasCad = activity.avgCadence != null;

  // Effort score (0-100) based on HR zone distribution
  let effortScore = null;
  if (activity.hrZones) {
    const weights = [1, 2, 3, 4, 5];
    effortScore = Math.round(
      activity.hrZones.reduce((s, pct, i) => s + pct * weights[i], 0) / 100
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2 transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white leading-tight">{activity.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {fmtDate(activity.date)} · {fmtTime(activity.date)}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
            confirmDelete
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
          }`}
        >
          <Trash2 size={15} />
          {confirmDelete ? 'Confirm?' : ''}
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard label="Distance" value={fmtDistance(activity.distance, unit)} icon={Route} />
        <StatCard label="Moving Time" value={fmtDuration(activity.movingTime)} icon={Clock} />
        <StatCard
          label="Avg Pace"
          value={fmtPace(activity.avgPace, unit)}
          icon={TrendingUp}
          accent
        />
        {hasEle && (
          <StatCard
            label="Elevation"
            value={`+${fmtElevation(activity.elevationGain, unit)}`}
            icon={Mountain}
          />
        )}
        {hasHR && (
          <StatCard
            label="Avg HR"
            value={`${activity.avgHR} bpm`}
            sub={`Max ${activity.maxHR} bpm`}
            icon={Heart}
          />
        )}
        {hasCad && (
          <StatCard
            label="Cadence"
            value={`${activity.avgCadence} spm`}
            sub={`Max ${activity.maxCadence}`}
            icon={Activity}
          />
        )}
        <StatCard label="Calories" value={`${activity.calories}`} sub="kcal" icon={Flame} />
        {activity.avgSpeed && (
          <StatCard label="Avg Speed" value={fmtSpeed(activity.avgSpeed, unit)} icon={Zap} />
        )}
      </div>

      {/* Map */}
      <Section title="Route Map">
        {trackPoints !== null ? (
          <ActivityMap trackPoints={trackPoints} height={320} />
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
            Loading map…
          </div>
        )}
      </Section>

      {/* Elevation */}
      {trackPoints?.some((p) => p.ele != null) && (
        <Section title="Elevation Profile">
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            {activity.elevationGain != null && (
              <span>
                <span className="text-amber-400">↑</span>{' '}
                {fmtElevation(activity.elevationGain, unit)} gain
              </span>
            )}
            {activity.elevationLoss != null && (
              <span>
                <span className="text-sky-400">↓</span>{' '}
                {fmtElevation(activity.elevationLoss, unit)} loss
              </span>
            )}
            {activity.maxElevation != null && (
              <span>Max {fmtElevation(activity.maxElevation, unit)}</span>
            )}
          </div>
          <ElevationChart trackPoints={trackPoints} unit={unit} />
        </Section>
      )}

      {/* Pace */}
      {activity.splits?.length > 0 && (
        <Section title="Pace per km">
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            <span>Avg {fmtPace(activity.avgPace, unit)}</span>
            {activity.splits?.length > 1 && (
              <>
                <span className="text-green-400">
                  Best {fmtPace(Math.min(...activity.splits.map((s) => s.pace).filter(Boolean)), unit)}
                </span>
                <span className="text-red-400">
                  Worst {fmtPace(Math.max(...activity.splits.map((s) => s.pace).filter(Boolean)), unit)}
                </span>
              </>
            )}
          </div>
          <PaceChart splits={activity.splits} avgPace={activity.avgPace} unit={unit} />
        </Section>
      )}

      {/* HR chart + zones */}
      {hasHR && (
        <Section title="Heart Rate">
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            <span>Avg <span className="text-red-400">{activity.avgHR} bpm</span></span>
            <span>Max <span className="text-red-400">{activity.maxHR} bpm</span></span>
            {effortScore && (
              <span>
                Effort score{' '}
                <span className="text-orange-400 font-semibold">{effortScore}/5</span>
              </span>
            )}
          </div>
          {trackPoints?.some((p) => p.hr) && (
            <HRChart
              trackPoints={trackPoints}
              avgHR={activity.avgHR}
              maxHR={activity.maxHR}
              unit={unit}
            />
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

      {/* Additional stats */}
      <Section title="Activity Details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <DetailRow label="Total Distance" value={fmtDistance(activity.distance, unit)} />
          <DetailRow label="Elapsed Time" value={fmtDuration(activity.duration)} />
          <DetailRow label="Moving Time" value={fmtDuration(activity.movingTime)} />
          {activity.maxSpeed && (
            <DetailRow label="Max Speed" value={fmtSpeed(activity.maxSpeed, unit)} />
          )}
          {activity.elevationGain != null && (
            <DetailRow label="Elevation Gain" value={fmtElevation(activity.elevationGain, unit)} />
          )}
          {activity.elevationLoss != null && (
            <DetailRow label="Elevation Loss" value={fmtElevation(activity.elevationLoss, unit)} />
          )}
          {activity.maxElevation != null && (
            <DetailRow label="Max Elevation" value={fmtElevation(activity.maxElevation, unit)} />
          )}
          {hasCad && (
            <DetailRow label="Max Cadence" value={`${activity.maxCadence} spm`} />
          )}
          <DetailRow label="Calories" value={`${activity.calories} kcal`} />
        </div>
      </Section>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="bg-slate-700/30 rounded-lg px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-white font-medium text-sm">{value}</div>
    </div>
  );
}
