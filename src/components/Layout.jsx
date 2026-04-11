import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Trophy, Target, Settings, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStoredToken } from '../utils/stravaAuth';
import { fetchActivitiesSince } from '../utils/stravaApi';
import { saveCoachingPlan as storagesSavePlan } from '../utils/coachStorage';
import { fmtRelative } from '../utils/formatters';
import { useState } from 'react';

const nav = [
  { to: '/plan', label: 'My Plan', icon: Trophy },
  { to: '/benchmark', label: 'Benchmark', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-brand-100 text-brand-600'
            : 'text-slate-500 hover:bg-brand-50 hover:text-slate-800'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
          isActive ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600'
        }`
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

function SyncButton() {
  const { coachingPlan, activities, addActivity, saveCoachingPlan } = useApp();
  const [syncing, setSyncing] = useState(false);
  const stravaToken = getStoredToken();

  if (!coachingPlan || !stravaToken) return null;

  const lastSync = coachingPlan.lastStravaSync;

  async function handleSync() {
    setSyncing(true);
    try {
      const existingIds = new Set(activities.map((a) => a.id));

      // Fetch 1 day before startDate to cover timezone edge-cases where a local
      // "plan day 1" run ends up with a UTC timestamp from the day before.
      const planStart = coachingPlan.startDate
        ? new Date(new Date(coachingPlan.startDate).getTime() - 86400000).toISOString()
        : coachingPlan.startDate;
      const afterISO = lastSync ?? planStart;

      const fresh = await fetchActivitiesSince(afterISO, existingIds);
      for (const act of fresh) addActivity(act);

      // Auto-match: consider BOTH newly fetched AND pre-existing activities so
      // that benchmark runs (already in context) also link to plan sessions.
      const allActivities = [...activities, ...fresh];
      const ONE_DAY = 86400000;

      const updatedSessions = coachingPlan.sessions.map((s) => {
        if (s.resultActivityId || s.type === 'rest') return s;
        const sessTime = new Date(s.date).getTime();
        const match = allActivities.find(
          (act) => Math.abs(new Date(act.date).getTime() - sessTime) <= ONE_DAY
        );
        return match ? { ...s, resultActivityId: match.id } : s;
      });

      const updatedPlan = {
        ...coachingPlan,
        sessions: updatedSessions,
        lastStravaSync: new Date().toISOString(),
      };
      saveCoachingPlan(updatedPlan);
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 disabled:opacity-60 transition-colors"
      title={lastSync ? `Last synced ${fmtRelative(lastSync)}` : 'Sync Strava activities'}
    >
      <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{syncing ? 'Syncing…' : lastSync ? fmtRelative(lastSync) : 'Sync Strava'}</span>
    </button>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-brand-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-brand-100 bg-white px-3 py-6 sticky top-0 h-screen shadow-sm">
        <div className="flex items-center gap-2 px-3 mb-8">
          <img src="/pacementor/icon.svg" alt="PaceMentor" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-slate-800 text-lg leading-none">
            Pace<span className="text-brand-500">Mentor</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="px-4 pb-2">
          <SyncButton />
        </div>
        <p className="text-slate-300 text-xs px-4 pt-2">v0.2.0</p>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-brand-100 bg-white/90 backdrop-blur sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <img src="/pacementor/icon.svg" alt="PaceMentor" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-slate-800">
              Pace<span className="text-brand-500">Mentor</span>
            </span>
          </div>
          <SyncButton />
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-brand-100 flex justify-around px-2 py-1 z-50 shadow-lg">
        {nav.map((item) => <MobileNavItem key={item.to} {...item} />)}
      </nav>
    </div>
  );
}
