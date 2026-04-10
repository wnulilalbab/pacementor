import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, ChevronRight, ChevronLeft, Upload as UploadIcon,
  CheckCircle, Loader2, AlertCircle, X, Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveBenchmarkRunIds } from '../utils/coachStorage';
import { generateFollowUpQuestions, generateCoachingPlan } from '../utils/aiApi';
import { parseGPX } from '../utils/gpxParser';
import { fetchActivitiesPage } from '../utils/stravaApi';
import { getStoredToken } from '../utils/stravaAuth';
import { getActivity } from '../utils/storage';
import { fmtDistance, fmtPace, fmtDuration, fmtDate } from '../utils/formatters';
import ActivityCard from '../components/ActivityCard';

const STEPS = ['Goal', 'Benchmark', 'Questions', 'Generate'];
const SESSION_TYPE_COLORS = {
  zone2: 'bg-blue-100 text-blue-700',
  easy: 'bg-sky-100 text-sky-700',
  tempo: 'bg-orange-100 text-orange-700',
  interval: 'bg-red-100 text-red-700',
  long_run: 'bg-purple-100 text-purple-700',
  rest: 'bg-slate-100 text-slate-500',
  race_sim: 'bg-pink-100 text-pink-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsePaceInput(str) {
  // accepts "7:00" or "7.00" → sec/km
  const [m, s] = str.replace('.', ':').split(':').map(Number);
  if (isNaN(m)) return null;
  return m * 60 + (s || 0);
}

function formatPaceInput(secPerKm) {
  if (!secPerKm) return '';
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
            i < current ? 'bg-accent-500 text-white' :
            i === current ? 'bg-brand-500 text-white' :
            'bg-brand-100 text-slate-400'
          }`}>
            {i < current ? <CheckCircle size={14} /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${i === current ? 'text-slate-700' : 'text-slate-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-6 h-0.5 bg-brand-100" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Goal ──────────────────────────────────────────────────────────────
function GoalStep({ goal, setGoal }) {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 14);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">What's your goal?</h2>
        <p className="text-slate-400 text-sm mt-1">Your coach will build a personalised plan to get you there.</p>
      </div>

      {/* Goal type */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { type: 'zone2_pace', label: 'Zone 2 Fitness', sub: 'Run aerobically at a target pace', emoji: '💙' },
          { type: 'race_pb', label: 'Race PB', sub: 'Crush a 5K, 10K, half or full marathon', emoji: '🏆' },
        ].map(({ type, label, sub, emoji }) => (
          <button
            key={type}
            onClick={() => setGoal((g) => ({ ...g, type }))}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              goal.type === type
                ? 'border-brand-400 bg-brand-50'
                : 'border-brand-100 hover:border-brand-300 bg-white'
            }`}
          >
            <div className="text-2xl mb-2">{emoji}</div>
            <div className="font-semibold text-slate-800 text-sm">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
          </button>
        ))}
      </div>

      {/* Zone 2 Pace fields */}
      {goal.type === 'zone2_pace' && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Minimum session distance
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={3} max={21} step={0.5}
                value={(goal.targetDistance || 5000) / 1000}
                onChange={(e) => setGoal((g) => ({ ...g, targetDistance: Number(e.target.value) * 1000 }))}
                className="flex-1 accent-brand-500"
              />
              <span className="text-brand-600 font-bold w-14 text-right">
                {((goal.targetDistance || 5000) / 1000).toFixed(1)} km
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Target pace in Zone 2 (mm:ss per km)
            </label>
            <input
              type="text"
              placeholder="e.g. 7:00"
              value={formatPaceInput(goal.targetPace)}
              onChange={(e) => {
                const sec = parsePaceInput(e.target.value);
                if (sec) setGoal((g) => ({ ...g, targetPace: sec }));
              }}
              className="input-field w-32"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Target date <span className="text-slate-300">(optional — AI will choose if left blank)</span>
            </label>
            <input
              type="date"
              min={minDate.toISOString().slice(0, 10)}
              value={goal.deadline?.slice(0, 10) || ''}
              onChange={(e) => setGoal((g) => ({ ...g, deadline: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      )}

      {/* Race PB fields */}
      {goal.type === 'race_pb' && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Race distance</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: '5k', label: '5K' },
                { key: '10k', label: '10K' },
                { key: 'half_marathon', label: 'Half' },
                { key: 'marathon', label: 'Marathon' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setGoal((g) => ({ ...g, targetRace: key }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    goal.targetRace === key
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-brand-100 text-slate-500 hover:border-brand-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Target time (optional, mm:ss or h:mm:ss)
            </label>
            <input
              type="text"
              placeholder="e.g. 2:00:00"
              className="input-field"
              onChange={(e) => {
                const parts = e.target.value.split(':').map(Number);
                let sec = 0;
                if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
                if (sec > 0) setGoal((g) => ({ ...g, targetTime: sec }));
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Race / target date <span className="text-slate-300">(optional — AI will plan timeline if left blank)</span>
            </label>
            <input
              type="date"
              min={minDate.toISOString().slice(0, 10)}
              value={goal.deadline?.slice(0, 10) || ''}
              onChange={(e) => setGoal((g) => ({ ...g, deadline: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Benchmark ─────────────────────────────────────────────────────────
function BenchmarkStep({ benchmarkIds, setBenchmarkIds, addActivity, settings }) {
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
      // Last 14 days
      const after = new Date(Date.now() - 14 * 86400000).toISOString();
      const runs = await fetchActivitiesPage(1, 50, after);
      setStravaRuns(runs);
    } catch (err) {
      setStravaRuns([]);
    } finally {
      setLoadingStrava(false);
    }
  }

  function toggleStrava(act) {
    if (benchmarkIds.includes(act.id)) {
      setBenchmarkIds((ids) => ids.filter((x) => x !== act.id));
    } else {
      addActivity(act); // save to storage
      setBenchmarkIds((ids) => [...ids, act.id]);
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
      setBenchmarkIds((ids) => [...ids, parsed.id]);
    } catch (e) {
      setUploadError(e.message || 'Failed to parse GPX');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">Add benchmark runs</h2>
        <p className="text-slate-400 text-sm mt-1">
          Your coach needs real data to build an accurate plan. Add 1–5 recent runs.
        </p>
      </div>

      {benchmarkIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {benchmarkIds.map((id) => {
            const a = getActivity(id);
            return a ? (
              <div key={id} className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2.5 py-1 rounded-full">
                <span>{a.name || fmtDate(a.date)}</span>
                <button onClick={() => setBenchmarkIds((ids) => ids.filter((x) => x !== id))}>
                  <X size={11} />
                </button>
              </div>
            ) : null;
          })}
        </div>
      )}

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

      {/* Strava tab */}
      {tab === 'strava' && hasStrava && (
        <div className="space-y-2">
          {loadingStrava && (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Loading recent runs…
            </div>
          )}
          {stravaRuns && stravaRuns.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-6">No Strava runs found in the last 14 days.</p>
          )}
          {stravaRuns?.map((act) => {
            const selected = benchmarkIds.includes(act.id);
            return (
              <button
                key={act.id}
                onClick={() => toggleStrava(act)}
                className={`w-full text-left rounded-2xl border-2 transition-all ${selected ? 'border-brand-400 bg-brand-50' : 'border-transparent'}`}
              >
                <ActivityCard activity={act} unit={unit} noLink />
              </button>
            );
          })}
        </div>
      )}

      {/* GPX upload tab */}
      {tab === 'gpx' && (
        <div
          className="border-2 border-dashed border-brand-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".gpx" className="hidden"
            onChange={(e) => { if (e.target.files[0]) handleGpxUpload(e.target.files[0]); e.target.value = ''; }} />
          {uploading ? (
            <Loader2 size={28} className="text-brand-500 animate-spin" />
          ) : (
            <UploadIcon size={28} className="text-brand-400" />
          )}
          <div className="text-center">
            <p className="text-slate-700 font-medium text-sm">{uploading ? 'Parsing…' : 'Click to upload GPX'}</p>
            <p className="text-slate-400 text-xs mt-0.5">You can upload multiple runs one at a time</p>
          </div>
          {uploadError && (
            <div className="flex items-center gap-1.5 text-red-500 text-xs">
              <AlertCircle size={13} /> {uploadError}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Tip: include a mix of easy/Zone 2 runs and one harder effort for best results.
      </p>
    </div>
  );
}

// ── Step 3: Questions ─────────────────────────────────────────────────────────
function QuestionsStep({ goal, benchmarkIds, questions, setQuestions, answers, setAnswers, settings }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiKey = settings.anthropicApiKey;

  async function loadQuestions() {
    if (!apiKey) { setError('Add your Anthropic API key in Settings first.'); return; }
    setLoading(true);
    setError('');
    try {
      const qs = await generateFollowUpQuestions(apiKey, goal, benchmarkIds);
      setQuestions(qs);
      setAnswers(Object.fromEntries(qs.map((q) => [q.id, ''])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!apiKey) {
    return (
      <div className="space-y-4 text-center py-8">
        <AlertCircle size={40} className="mx-auto text-amber-400" />
        <p className="text-slate-700 font-medium">API key required</p>
        <p className="text-slate-400 text-sm">Go to Settings and add your Anthropic API key to enable AI features.</p>
      </div>
    );
  }

  if (!questions && !loading) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-4xl">🤖</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Personalise your plan</h2>
          <p className="text-slate-400 text-sm mt-1">Claude will ask you a few questions to tailor your coaching plan.</p>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={loadQuestions} className="btn-primary mx-auto flex items-center gap-2">
          <Target size={15} /> Generate Questions
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 size={36} className="text-brand-500 animate-spin" />
        <p className="text-slate-500 text-sm">Analysing your benchmark runs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">A few questions</h2>
        <p className="text-slate-400 text-sm mt-1">Help your coach understand your schedule and preferences.</p>
      </div>
      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{q.question}</label>
            {q.type === 'number' && (
              <input
                type="number" min={q.min} max={q.max}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="input-field w-28"
              />
            )}
            {q.type === 'text' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="input-field"
              />
            )}
            {q.type === 'select' && (
              <select
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="input-field"
              >
                <option value="">Select…</option>
                {q.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {q.type === 'multiselect' && (
              <div className="flex flex-wrap gap-2">
                {q.options?.map((o) => {
                  const selected = (answers[q.id] || '').split(',').filter(Boolean).includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => {
                        const cur = (answers[q.id] || '').split(',').filter(Boolean);
                        const next = selected ? cur.filter((x) => x !== o) : [...cur, o];
                        setAnswers((a) => ({ ...a, [q.id]: next.join(',') }));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        selected ? 'bg-brand-500 text-white border-brand-500' : 'border-brand-200 text-slate-500 hover:border-brand-400'
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 4: Generate ──────────────────────────────────────────────────────────
function GenerateStep({ goal, benchmarkIds, questions, answers, settings, onGenerated }) {
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [error, setError] = useState('');
  const unit = settings.unit || 'metric';

  const qas = (questions || []).map((q) => ({ ...q, answer: answers?.[q.id] || '' }));

  async function handleGenerate() {
    if (!settings.anthropicApiKey) { setError('Add your Anthropic API key in Settings.'); return; }
    setStatus('generating');
    setError('');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().slice(0, 10);

      const plan = await generateCoachingPlan(
        settings.anthropicApiKey,
        goal,
        benchmarkIds,
        qas,
        settings,
        startDate
      );
      onGenerated(plan);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Loader2 size={48} className="text-brand-500 animate-spin" />
        <div className="text-center">
          <p className="text-slate-800 font-semibold text-lg">Building your plan…</p>
          <p className="text-slate-400 text-sm mt-1">Claude is analysing your data and creating a personalised programme</p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-400">
          <p>✓ Reviewing benchmark runs</p>
          <p>✓ Calculating training zones</p>
          <p className="animate-pulse">⏳ Generating session schedule…</p>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <CheckCircle size={48} className="text-accent-500" />
        <p className="text-slate-800 font-semibold text-lg">Your plan is ready!</p>
        <p className="text-slate-400 text-sm">Redirecting to your coaching plan…</p>
      </div>
    );
  }

  const goalLabel = goal.type === 'zone2_pace'
    ? `Zone 2 run — ${fmtDistance(goal.targetDistance || 5000)} at ${fmtPace(goal.targetPace || 420)}`
    : { half_marathon: 'Half Marathon PB', marathon: 'Marathon PB', '5k': '5K PB', '10k': '10K PB' }[goal.targetRace] || 'Race PB';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">Ready to generate</h2>
        <p className="text-slate-400 text-sm mt-1">Review your setup before creating the plan.</p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">🎯</div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Goal</div>
            <div className="text-slate-800 font-semibold text-sm">{goalLabel}</div>
            {goal.deadline
              ? <div className="text-xs text-slate-400">By {fmtDate(goal.deadline)}</div>
              : <div className="text-xs text-slate-400 italic">AI will choose the timeline</div>
            }
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">📊</div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Benchmark runs</div>
            <div className="text-slate-800 font-semibold text-sm">{benchmarkIds.length} run{benchmarkIds.length !== 1 ? 's' : ''} added</div>
          </div>
        </div>
        {qas.filter((q) => q.answer).length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">💬</div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Preferences</div>
              <div className="space-y-0.5">
                {qas.filter((q) => q.answer).map((q) => (
                  <div key={q.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">{q.question}: </span>{q.answer}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <button onClick={handleGenerate} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
        <Target size={18} /> Generate My Coaching Plan
      </button>
    </div>
  );
}

// ── Main Setup component ──────────────────────────────────────────────────────
export default function Setup() {
  const navigate = useNavigate();
  const { settings, addActivity, saveCoachingPlan, saveGoal, coachingPlan } = useApp();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState({
    type: 'zone2_pace',
    targetDistance: 5000,
    targetPace: 420,
    targetZone: 2,
    targetRace: null,
    targetTime: null,
    deadline: '',
  });
  const [benchmarkIds, setBenchmarkIds] = useState([]);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});

  // If plan already exists, offer to restart
  if (coachingPlan) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="text-5xl">📋</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">You already have a coaching plan</h2>
          <p className="text-slate-400 text-sm mt-1">Creating a new plan will replace your current one.</p>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/plan')} className="btn-primary w-full">View Current Plan</button>
          <button
            onClick={() => { saveCoachingPlan(null); saveGoal(null); }}
            className="border border-red-200 text-red-400 hover:bg-red-50 py-2.5 px-4 rounded-xl text-sm font-medium transition-all"
          >
            Start Over (Replaces Existing Plan)
          </button>
        </div>
      </div>
    );
  }

  function canNext() {
    if (step === 0) return !!(goal.type && (goal.type === 'zone2_pace' ? goal.targetPace : goal.targetRace));
    if (step === 1) return benchmarkIds.length > 0;
    if (step === 2) return true; // questions optional
    return false;
  }

  function handleGenerated(plan) {
    // If user didn't set a deadline, use the AI-suggested one
    const finalGoal = goal.deadline
      ? goal
      : { ...goal, deadline: plan.suggestedDeadline || null };
    saveCoachingPlan(plan);
    saveGoal(finalGoal);
    saveBenchmarkRunIds(benchmarkIds);
    setTimeout(() => navigate('/plan'), 1200);
  }

  return (
    <div className="max-w-lg mx-auto">
      <StepIndicator current={step} />

      <div className="card p-6">
        {step === 0 && <GoalStep goal={goal} setGoal={setGoal} />}
        {step === 1 && (
          <BenchmarkStep
            benchmarkIds={benchmarkIds}
            setBenchmarkIds={setBenchmarkIds}
            addActivity={addActivity}
            settings={settings}
          />
        )}
        {step === 2 && (
          <QuestionsStep
            goal={goal}
            benchmarkIds={benchmarkIds}
            questions={questions}
            setQuestions={setQuestions}
            answers={answers}
            setAnswers={setAnswers}
            settings={settings}
          />
        )}
        {step === 3 && (
          <GenerateStep
            goal={goal}
            benchmarkIds={benchmarkIds}
            questions={questions}
            answers={answers}
            settings={settings}
            onGenerated={handleGenerated}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-4">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="btn-ghost flex items-center gap-2">
            <ChevronLeft size={15} /> Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
