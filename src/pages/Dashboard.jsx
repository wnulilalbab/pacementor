import { Link } from 'react-router-dom';
import { Upload, TrendingUp, Clock, Route, Flame, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import StatCard from '../components/StatCard';
import ActivityCard from '../components/ActivityCard';
import WeeklyChart from '../components/charts/WeeklyChart';
import {
  fmtDistance,
  fmtDuration,
  fmtPace,
  weekStart,
} from '../utils/formatters';

function useSummary(activities) {
  const now = new Date();
  const thisWeekMs = weekStart(now).getTime();
  const thisMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const weekly = activities.filter(
    (a) => new Date(a.date).getTime() >= thisWeekMs
  );
  const monthly = activities.filter(
    (a) => new Date(a.date).getTime() >= thisMonthMs
  );

  return {
    weekly: {
      runs: weekly.length,
      distance: weekly.reduce((s, a) => s + (a.distance || 0), 0),
      time: weekly.reduce((s, a) => s + (a.movingTime || 0), 0),
    },
    monthly: {
      runs: monthly.length,
      distance: monthly.reduce((s, a) => s + (a.distance || 0), 0),
    },
    allTime: {
      runs: activities.length,
      distance: activities.reduce((s, a) => s + (a.distance || 0), 0),
      time: activities.reduce((s, a) => s + (a.movingTime || 0), 0),
      calories: activities.reduce((s, a) => s + (a.calories || 0), 0),
    },
  };
}

function personalRecords(activities) {
  const records = {};
  const effortNames = ['1 km', '5 km', '10 km', 'Half Marathon', 'Marathon'];

  for (const act of activities) {
    for (const effort of act.bestEfforts || []) {
      if (!effortNames.includes(effort.name)) continue;
      if (!records[effort.name] || effort.duration < records[effort.name].duration) {
        records[effort.name] = { ...effort, date: act.date, actId: act.id };
      }
    }
  }

  return Object.values(records);
}

export default function Dashboard() {
  const { activities, settings } = useApp();
  const unit = settings.unit || 'metric';
  const summary = useSummary(activities);
  const prs = personalRecords(activities);
  const recent = activities.slice(0, 5);

  if (activities.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {settings.name ? `Hey, ${settings.name}! 👋` : 'Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Your training overview</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2 text-sm">
          <Upload size={15} />
          Upload
        </Link>
      </div>

      {/* This week */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">This Week</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Runs"
            value={summary.weekly.runs}
            icon={Route}
            accent={summary.weekly.runs > 0}
          />
          <StatCard
            label="Distance"
            value={fmtDistance(summary.weekly.distance, unit)}
            icon={TrendingUp}
          />
          <StatCard
            label="Time"
            value={fmtDuration(summary.weekly.time)}
            icon={Clock}
          />
        </div>
      </section>

      {/* Weekly chart */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Weekly Volume</h2>
        <WeeklyChart activities={activities} weeks={12} unit={unit} />
      </section>

      {/* All-time stats */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">All Time</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Runs" value={summary.allTime.runs} icon={Route} />
          <StatCard
            label="Total Distance"
            value={fmtDistance(summary.allTime.distance, unit)}
            icon={TrendingUp}
          />
          <StatCard
            label="Total Time"
            value={fmtDuration(summary.allTime.time)}
            icon={Clock}
          />
          <StatCard
            label="Calories"
            value={`${Math.round(summary.allTime.calories / 1000)}k`}
            sub="kcal burned"
            icon={Flame}
          />
        </div>
      </section>

      {/* Personal records */}
      {prs.length > 0 && (
        <section className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Personal Records</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {prs.map((pr) => (
              <Link
                key={pr.name}
                to={`/activities/${pr.actId}`}
                className="bg-slate-700/40 hover:bg-slate-700/60 rounded-xl p-3 transition-colors"
              >
                <div className="text-xs text-slate-400 mb-1">{pr.name}</div>
                <div className="text-base font-bold text-white tabular-nums">
                  {fmtDuration(pr.duration)}
                </div>
                <div className="text-xs text-orange-400 tabular-nums">
                  {fmtPace(pr.pace, unit)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent activities */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Activities</h2>
          <Link to="/activities" className="text-xs text-orange-400 hover:text-orange-300">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {recent.map((act) => (
            <ActivityCard key={act.id} activity={act} unit={unit} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <div className="text-7xl">🏃</div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to PaceMentor</h2>
        <p className="text-slate-400 max-w-sm">
          Upload your first GPX file to see advanced analytics, maps, splits, and more.
        </p>
      </div>
      <Link to="/upload" className="btn-primary flex items-center gap-2">
        <Upload size={16} />
        Upload Your First Run
      </Link>
    </div>
  );
}
