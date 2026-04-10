import { useState, useRef } from 'react';
import { Target, Plus, X, Upload as UploadIcon, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getBenchmarkRunIds, saveBenchmarkRunIds, addBenchmarkRunId, removeBenchmarkRunId,
} from '../utils/coachStorage';
import { getActivity } from '../utils/storage';
import { parseGPX } from '../utils/gpxParser';
import { fetchActivitiesPage } from '../utils/stravaApi';
import { getStoredToken } from '../utils/stravaAuth';
import { fmtDistance, fmtPace, fmtDuration, fmtDate } from '../utils/formatters';
import ActivityCard from '../components/ActivityCard';

// ── Coverage check: what run types are represented ────────────────────────────
function getCoverage(activities) {
  const coverage = {
    zone2:       { label: 'Zone 2 / Easy', met: false, tip: 'A run where most time is in HR Zone 1–2' },
    tempo:       { label: 'Tempo / Threshold', met: false, tip: 'A comfortably hard run, HR Zone 3–4' },
    long_run:    { label: 'Long Run', met: false, tip: 'Your longest recent run (10+ km)' },
    best_effort: { label: 'Best Effort / Race', met: false, tip: 'A race or all-out time trial' },
  };

  for (const act of activities) {
    if (!act) continue;
    const z2pct = act.hrZones ? act.hrZones[0] + act.hrZones[1] : 0;
    const hardPct = act.hrZones ? act.hrZones[3] + (act.hrZones[4] || 0) : 0;

    if (z2pct > 60) coverage.zone2.met = true;
    if (hardPct > 25) coverage.tempo.met = true;
    if ((act.distance || 0) >= 10000) coverage.long_run.met = true;
    if (act.bestEfforts?.length > 0 || hardPct > 50) coverage.best_effort.met = true;
  }
  return coverage;
}

// ── Add run modal ─────────────────────────────────────────────────────────────
function AddRunModal({ onClose, settings, addActivity, onAdd }) {
  const [tab, setTab] = useState('strava');
  const [stravaRuns, setStravaRuns] = useState(null);
  const [loadingStrava, setLoadingStrava] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const unit = settings.unit || 'metric';
  const hasStrava = !!getStoredToken();

  async function loadStravaRuns() {
    setLoadingStrava(true);
    try {
      const after = new Date(Date.now() - 14 * 86400000).toISOString();
      const runs = await fetchActivitiesPage(1, 50, after);
      setStravaRuns(runs);
    } catch {
      setStravaRuns([]);
    } finally {
      setLoadingStrava(false);
    }
  }

  async function handleGpxUpload(file) {
    if (!file?.name.toLowerCase().endsWith('.gpx')) {
      setUploadError('Please select a .gpx file');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const parsed = await parseGPX(file, settings);
      addActivity(parsed);
      onAdd(parsed.id);
      onClose();
    } catch (e) {
      setUploadError(e.message || 'Failed to parse GPX');
    } finally {
      setUploading(false);
    }
  }

  function handleSelectStrava(act) {
    addActivity(act);
    onAdd(act.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-brand-100">
          <h3 className="font-semibold text-slate-800">Add benchmark run</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-brand-50 border border-brand-100 rounded-xl p-1">
            {hasStrava && (
              <button
                onClick={() => { setTab('strava'); if (!stravaRuns) loadStravaRuns(); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'strava' ? 'bg-brand-500 text-white' : 'text-slate-500'}`}
              >
                From Strava
              </button>
            )}
            <button
              onClick={() => setTab('gpx')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'gpx' ? 'bg-brand-500 text-white' : 'text-slate-500'}`}
            >
              Upload GPX
            </button>
          </div>

          {tab === 'strava' && hasStrava && (
            <div className="space-y-2">
              {loadingStrava && (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 size={18} className="animate-spin" /> Loading…
                </div>
              )}
              {stravaRuns?.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">No runs found in the last 14 days.</p>
              )}
              {stravaRuns?.map((act) => (
                <button key={act.id} onClick={() => handleSelectStrava(act)} className="w-full text-left hover:opacity-80 transition-opacity">
                  <ActivityCard activity={act} unit={unit} />
                </button>
              ))}
            </div>
          )}

          {tab === 'gpx' && (
            <div
              className="border-2 border-dashed border-brand-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".gpx" className="hidden"
                onChange={(e) => { if (e.target.files[0]) handleGpxUpload(e.target.files[0]); e.target.value = ''; }} />
              {uploading ? <Loader2 size={28} className="text-brand-500 animate-spin" /> : <UploadIcon size={28} className="text-brand-400" />}
              <div className="text-center">
                <p className="text-slate-700 font-medium text-sm">{uploading ? 'Parsing…' : 'Click to upload GPX'}</p>
              </div>
              {uploadError && (
                <div className="flex items-center gap-1.5 text-red-500 text-xs">
                  <AlertCircle size={13} /> {uploadError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Benchmark component ──────────────────────────────────────────────────
export default function Benchmark() {
  const { settings, addActivity } = useApp();
  const [ids, setIds] = useState(() => getBenchmarkRunIds());
  const [showModal, setShowModal] = useState(false);
  const unit = settings.unit || 'metric';

  const activities = ids.map((id) => getActivity(id)).filter(Boolean);
  const coverage = getCoverage(activities);
  const coveredCount = Object.values(coverage).filter((c) => c.met).length;

  function handleAdd(id) {
    addBenchmarkRunId(id);
    setIds(getBenchmarkRunIds());
  }

  function handleRemove(id) {
    removeBenchmarkRunId(id);
    setIds(getBenchmarkRunIds());
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Benchmark Runs</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            These runs define your current fitness baseline for AI coaching.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={15} /> Add Run
        </button>
      </div>

      {/* Coverage overview */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-slate-700">Coverage</h2>
          </div>
          <span className="text-xs text-slate-400">{coveredCount}/4 run types</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(coverage).map(([key, { label, met, tip }]) => (
            <div
              key={key}
              title={tip}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                met
                  ? 'bg-accent-50 border-accent-200 text-accent-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              {met ? <CheckCircle size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
              {label}
            </div>
          ))}
        </div>
        {coveredCount < 4 && (
          <p className="text-xs text-slate-400">
            Add more benchmark runs to improve your coaching plan accuracy.
            Hover over each type to see what qualifies.
          </p>
        )}
      </div>

      {/* Run list */}
      {activities.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">📭</div>
          <p className="text-slate-700 font-medium">No benchmark runs yet</p>
          <p className="text-slate-400 text-sm">Add your recent runs to set a fitness baseline.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 mx-auto">
            <Plus size={15} /> Add Your First Run
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div key={act.id} className="relative group">
              <ActivityCard activity={act} unit={unit} />
              <button
                onClick={() => handleRemove(act.id)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove from benchmarks"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddRunModal
          onClose={() => setShowModal(false)}
          settings={settings}
          addActivity={addActivity}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
