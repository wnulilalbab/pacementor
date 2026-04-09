import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import WeeklyChart from '../components/charts/WeeklyChart';
import {
  fmtDistance, fmtDuration, fmtPace, fmtDate, weekStart,
} from '../utils/formatters';

const PERIODS = [
  { label: '4 weeks', days: 28 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'All time', days: Infinity },
];

function personalRecords(activities) {
  const records = {};
  const effortDefs = ['400m', '1 km', '1 mile', '5 km', '10 km', '15 km', 'Half Marathon', 'Marathon'];

  for (const act of activities) {
    for (const effort of act.bestEfforts || []) {
      if (!effortDefs.includes(effort.name)) continue;
      if (!records[effort.name] || effort.duration < records[effort.name].duration) {
        records[effort.name] = { ...effort, date: act.date, actId: act.id };
      }
    }
  }

  return effortDefs
    .map((name) => records[name])
    .filter(Boolean);
}

export default function Analytics() {
  const { activities, settings } = useApp();
  const unit = settings.unit || 'metric';
  const [periodIdx, setPeriodIdx] = useState(1);

  const period = PERIODS[periodIdx];
  const since = period.days === Infinity
    ? new Date(0)
    : new Date(Date.now() - period.days * 86400000);

  const filtered = useMemo(
    () => activities.filter((a) => new Date(a.date) >= since),
    [activities, periodIdx]
  );

  const prs = personalRecords(activities);

  const paceTrend = [...filtered]
    .filter((a) => a.avgPace)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((a) => ({
      date: fmtDate(a.date),
      pace: a.avgPace,
      dist: a.distance,
      id: a.id,
    }));

  const distTrend = [...filtered]
    .filter((a) => a.distance)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((a) => ({
      date: fmtDate(a.date),
      dist: unit === 'imperial'
        ? Math.round((a.distance / 1609.34) * 10) / 10
        : Math.round((a.distance / 1000) * 10) / 10,
      id: a.id,
    }));

  const totalDist = filtered.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = filtered.reduce((s, a) => s + (a.movingTime || 0), 0);
  const avgPaceArr = filtered.filter((a) => a.avgPace).map((a) => a.avgPace);
  const avgPace = avgPaceArr.length
    ? Math.round(avgPaceArr.reduce((a, b) => a + b, 0) / avgPaceArr.length)
    : null;

  const mid = Math.floor(paceTrend.length / 2);
  const firstHalf = paceTrend.slice(0, mid).map((d) => d.pace);
  const secondHalf = paceTrend.slice(mid).map((d) => d.pace);
  const avgFirst = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : null;
  const avgSecond = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : null;
  const paceImprovement = avgFirst && avgSecond ? avgFirst - avgSecond : null;

  const CustomPaceTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { date, pace } = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-400">{date}</div>
        <div className="text-brand-500 font-semibold">{fmtPace(pace, unit)}</div>
      </div>
    );
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-6xl">📈</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">No data yet</h2>
          <p className="text-slate-400 text-sm mt-1">Upload activities to see your analytics</p>
        </div>
        <Link to="/upload" className="btn-primary">Upload GPX</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-slate-400 text-sm">{filtered.length} activities in period</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-brand-50 border border-brand-100 rounded-xl p-1">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                i === periodIdx
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-slate-400 mb-1">Runs</div>
          <div className="text-2xl font-bold text-slate-800">{filtered.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400 mb-1">Total Distance</div>
          <div className="text-2xl font-bold text-slate-800">{fmtDistance(totalDist, unit)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400 mb-1">Total Time</div>
          <div className="text-2xl font-bold text-slate-800">{fmtDuration(totalTime)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-400 mb-1">Avg Pace</div>
          <div className="text-2xl font-bold text-brand-500">{fmtPace(avgPace, unit)}</div>
        </div>
      </div>

      {/* Pace improvement indicator */}
      {paceImprovement != null && Math.abs(paceImprovement) > 5 && (
        <div className={`card p-4 flex items-center gap-3 ${paceImprovement > 0 ? 'border-accent-400' : 'border-red-200'}`}>
          {paceImprovement > 0 ? (
            <TrendingDown size={24} className="text-accent-500" />
          ) : (
            <TrendingUp size={24} className="text-red-400" />
          )}
          <div>
            <p className="text-slate-700 font-medium text-sm">
              {paceImprovement > 0 ? "You're getting faster!" : 'Pace has slowed recently'}
            </p>
            <p className="text-slate-400 text-xs">
              {Math.abs(paceImprovement)} sec/km {paceImprovement > 0 ? 'improvement' : 'slower'} compared to earlier in this period
            </p>
          </div>
        </div>
      )}

      {/* Weekly volume */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Weekly Volume</h2>
        <WeeklyChart
          activities={filtered}
          weeks={period.days === Infinity ? 52 : Math.ceil(period.days / 7)}
          unit={unit}
        />
      </div>

      {/* Pace trend */}
      {paceTrend.length > 1 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Pace Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceTrend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(paceTrend.length / 6) - 1)}
              />
              <YAxis
                tickFormatter={(v) => fmtPace(v, unit)}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                reversed
                width={65}
              />
              <Tooltip content={<CustomPaceTooltip />} />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#4AAEE0"
                strokeWidth={2}
                dot={{ fill: '#4AAEE0', r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Distance trend */}
      {distTrend.length > 1 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Distance per Run</h2>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={distTrend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(distTrend.length / 6) - 1)}
              />
              <YAxis
                tickFormatter={(v) => `${v}${unit === 'imperial' ? 'mi' : 'km'}`}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e0f2fe', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#5DCE7A' }}
              />
              <Line
                type="monotone"
                dataKey="dist"
                stroke="#5DCE7A"
                strokeWidth={2}
                dot={{ fill: '#5DCE7A', r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Personal Records */}
      {prs.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-slate-700">Personal Records</h2>
          </div>
          <div className="space-y-2">
            {prs.map((pr) => (
              <Link
                key={pr.name}
                to={`/activities/${pr.actId}`}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-brand-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Award size={14} className="text-brand-500 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-700">{pr.name}</div>
                    <div className="text-xs text-slate-400">{fmtDate(pr.date)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-800 tabular-nums">{fmtDuration(pr.duration)}</div>
                  <div className="text-xs text-brand-500 tabular-nums">{fmtPace(pr.pace, unit)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
