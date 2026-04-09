import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ActivityCard from '../components/ActivityCard';
import { fmtDistance, fmtDuration } from '../utils/formatters';

const SORT_OPTIONS = [
  { label: 'Date (newest)', key: 'date', dir: 'desc' },
  { label: 'Date (oldest)', key: 'date', dir: 'asc' },
  { label: 'Distance (longest)', key: 'distance', dir: 'desc' },
  { label: 'Distance (shortest)', key: 'distance', dir: 'asc' },
  { label: 'Pace (fastest)', key: 'avgPace', dir: 'asc' },
  { label: 'Pace (slowest)', key: 'avgPace', dir: 'desc' },
];

export default function Activities() {
  const { activities, settings } = useApp();
  const unit = settings.unit || 'metric';
  const [search, setSearch] = useState('');
  const [sortIdx, setSortIdx] = useState(0);

  const sorted = useMemo(() => {
    const { key, dir } = SORT_OPTIONS[sortIdx];
    let filtered = activities;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = activities.filter((a) => a.name?.toLowerCase().includes(q));
    }

    return [...filtered].sort((a, b) => {
      const va = a[key] ?? (dir === 'asc' ? Infinity : -Infinity);
      const vb = b[key] ?? (dir === 'asc' ? Infinity : -Infinity);
      if (key === 'date') {
        return dir === 'desc'
          ? new Date(b.date) - new Date(a.date)
          : new Date(a.date) - new Date(b.date);
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [activities, search, sortIdx]);

  const totalDist = activities.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = activities.reduce((s, a) => s + (a.movingTime || 0), 0);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-6xl">📭</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">No activities yet</h2>
          <p className="text-slate-400 text-sm mt-1">Upload a GPX file to get started</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <Upload size={15} />
          Upload GPX
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activities</h1>
          <p className="text-slate-400 text-sm">
            {activities.length} runs · {fmtDistance(totalDist, unit)} · {fmtDuration(totalTime)}
          </p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2 text-sm">
          <Upload size={15} />
          Upload
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-9"
          />
        </div>
        <select
          value={sortIdx}
          onChange={(e) => setSortIdx(Number(e.target.value))}
          className="input-field px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((opt, i) => (
            <option key={i} value={i}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No activities match your search</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((act) => (
            <ActivityCard key={act.id} activity={act} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
