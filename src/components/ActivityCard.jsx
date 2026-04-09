import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, Clock, Heart } from 'lucide-react';
import { fmtDate, fmtDistance, fmtDuration, fmtPace, fmtElevation } from '../utils/formatters';

export default function ActivityCard({ activity, unit = 'metric' }) {
  const { id, name, date, distance, movingTime, avgPace, elevationGain, avgHR } = activity;

  return (
    <Link
      to={`/activities/${id}`}
      className="card p-4 hover:border-orange-500/40 hover:bg-slate-700/30 transition-all block"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white text-sm line-clamp-1">{name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Calendar size={11} />
            {fmtDate(date)}
          </p>
        </div>
        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
          Run
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Metric label="Distance" value={fmtDistance(distance, unit)} />
        <Metric label="Time" value={fmtDuration(movingTime)} />
        <Metric
          label="Avg Pace"
          value={fmtPace(avgPace, unit)}
          icon={<TrendingUp size={10} className="text-orange-400" />}
        />
        <Metric
          label={elevationGain != null ? 'Elevation' : (avgHR ? 'Avg HR' : 'Calories')}
          value={
            elevationGain != null
              ? fmtElevation(elevationGain, unit)
              : avgHR
              ? `${avgHR} bpm`
              : `${activity.calories ?? '--'} cal`
          }
          icon={avgHR ? <Heart size={10} className="text-red-400" /> : <TrendingUp size={10} className="text-slate-500" />}
        />
      </div>
    </Link>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
    </div>
  );
}
