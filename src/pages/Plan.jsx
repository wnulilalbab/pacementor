import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy, ChevronDown, ChevronUp, Upload, RefreshCw,
  CheckCircle, Clock, AlertCircle, Loader2, Sparkles,
  SkipForward, BarChart2, Calendar, Target, Flag, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getActivity, getTrackPoints } from '../utils/storage';
import { analyzeRunResult, adjustPlan as aiAdjustPlan } from '../utils/aiApi';
import { fmtDistance, fmtPace, fmtDuration, fmtDate } from '../utils/formatters';
import HRZonesChart from '../components/charts/HRZonesChart';
import { useRef } from 'react';

// ── Session type config ───────────────────────────────────────────────────────
const SESSION_STYLES = {
  zone2:     { color: 'bg-blue-50 border-blue-200 text-blue-700',    badge: 'bg-blue-100 text-blue-700',    label: 'Zone 2' },
  easy:      { color: 'bg-sky-50 border-sky-200 text-sky-700',       badge: 'bg-sky-100 text-sky-700',      label: 'Easy' },
  tempo:     { color: 'bg-orange-50 border-orange-200 text-orange-700', badge: 'bg-orange-100 text-orange-700', label: 'Tempo' },
  interval:  { color: 'bg-red-50 border-red-200 text-red-700',       badge: 'bg-red-100 text-red-700',      label: 'Interval' },
  long_run:  { color: 'bg-purple-50 border-purple-200 text-purple-700', badge: 'bg-purple-100 text-purple-700', label: 'Long Run' },
  rest:      { color: 'bg-slate-50 border-slate-200 text-slate-400', badge: 'bg-slate-100 text-slate-400',  label: 'Rest' },
  race_sim:  { color: 'bg-pink-50 border-pink-200 text-pink-700',    badge: 'bg-pink-100 text-pink-700',    label: 'Race Sim' },
};

function sessionStyle(type) {
  return SESSION_STYLES[type] || SESSION_STYLES.easy;
}

// ── Goal banner ───────────────────────────────────────────────────────────────
function GoalBanner({ plan }) {
  const goal = plan.goalSnapshot;
  const sessions = plan.sessions.filter((s) => s.type !== 'rest');
  const done = sessions.filter((s) => s.resultActivityId).length;
  const pct = sessions.length ? Math.round((done / sessions.length) * 100) : 0;

  const today = new Date();
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline - today) / 86400000)) : null;

  const goalLabel = goal.type === 'zone2_pace'
    ? `${fmtDistance(goal.targetDistance || 5000)} Zone 2 @ ${fmtPace(goal.targetPace)}`
    : { half_marathon: 'Half Marathon PB', marathon: 'Marathon PB', '5k': '5K PB', '10k': '10K PB' }[goal.targetRace] || 'Race PB';

  return (
    <div className="card p-4 bg-gradient-to-r from-brand-500 to-accent-500 text-white border-0">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} />
            <span className="text-xs font-medium opacity-80">Goal</span>
          </div>
          <h1 className="text-lg font-bold leading-tight">{goalLabel}</h1>
          {deadline && (
            <p className="text-xs opacity-70 mt-0.5">
              {daysLeft > 0 ? `${daysLeft} days remaining` : 'Target date reached'} · {fmtDate(goal.deadline)}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{pct}%</div>
          <div className="text-xs opacity-70">{done}/{sessions.length} sessions</div>
        </div>
      </div>
      <div className="w-full bg-white/20 rounded-full h-1.5">
        <div className="bg-white h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs opacity-70">{plan.approachSummary}</div>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, goal, settings, updateSession }) {
  const [expanded, setExpanded] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const fileRef = useRef();
  const unit = settings.unit || 'metric';
  const apiKey = settings.anthropicApiKey;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessDate = new Date(session.date);
  sessDate.setHours(0, 0, 0, 0);
  const isPast = sessDate < today;
  const isToday = sessDate.getTime() === today.getTime();

  const resultActivity = session.resultActivityId ? getActivity(session.resultActivityId) : null;
  const style = sessionStyle(session.type);

  const statusIcon = resultActivity
    ? <CheckCircle size={14} className="text-accent-500" />
    : isPast && !resultActivity && session.type !== 'rest'
      ? <AlertCircle size={14} className="text-amber-400" />
      : <Clock size={14} className="text-slate-300" />;

  if (session.type === 'rest') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
        {statusIcon}
        <span className="text-xs text-slate-400 font-medium">{fmtDate(session.date)} — Rest Day</span>
      </div>
    );
  }

  async function handleAnalyse() {
    if (!apiKey) { setAnalysisError('Add Anthropic API key in Settings'); return; }
    if (!resultActivity) return;
    setAnalysing(true);
    setAnalysisError('');
    try {
      const analysis = await analyzeRunResult(apiKey, session, resultActivity, goal, !!settings.testingMode, settings.aiModel || 'opus');
      updateSession(session.id, { aiAnalysis: analysis, analysisStatus: 'done' });
    } catch (e) {
      setAnalysisError(e.message);
    } finally {
      setAnalysing(false);
    }
  }

  async function handleUploadResult(file) {
    if (!file) return;
    try {
      const { addActivity } = await import('../context/AppContext').then(m => m.useApp?.() || {});
      // fallback: parse and link
    } catch { }
  }

  function handleSkip() {
    updateSession(session.id, { analysisStatus: 'skipped' });
  }

  return (
    <div className={`rounded-2xl border transition-all ${
      resultActivity ? 'border-accent-200 bg-accent-50/30' :
      isPast ? 'border-amber-200 bg-amber-50/30' :
      isToday ? 'border-brand-400 bg-brand-50' :
      'border-brand-100 bg-white'
    }`}>
      {/* Card header */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            {statusIcon}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">{fmtDate(session.date)}</span>
                {isToday && <span className="text-xs bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-medium">Today</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>{style.label}</span>
              </div>
              <div className="font-semibold text-slate-800 text-sm mt-0.5 truncate">{session.title}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                {session.targets.distance && <span>{fmtDistance(session.targets.distance, unit)}</span>}
                {session.targets.paceMin && session.targets.paceMax && (
                  <span>{fmtPace(session.targets.paceMin, unit)} – {fmtPace(session.targets.paceMax, unit)}</span>
                )}
                {session.targets.zone && <span>Zone {session.targets.zone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {resultActivity && (
              <span className="text-xs text-accent-600 font-medium hidden sm:inline">
                {fmtDistance(resultActivity.distance, unit)}
              </span>
            )}
            {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-brand-100 p-4 space-y-4">
          <p className="text-sm text-slate-600">{session.description}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Planned */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Planned</h4>
              <div className="space-y-1.5 text-sm">
                {session.targets.distance && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Distance</span>
                    <span className="font-medium text-slate-700">{fmtDistance(session.targets.distance, unit)}</span>
                  </div>
                )}
                {session.targets.paceMin && session.targets.paceMax && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pace range</span>
                    <span className="font-medium text-slate-700">{fmtPace(session.targets.paceMin, unit)} – {fmtPace(session.targets.paceMax, unit)}</span>
                  </div>
                )}
                {session.targets.zone && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">HR Zone</span>
                    <span className="font-medium text-slate-700">Zone {session.targets.zone}</span>
                  </div>
                )}
                {session.targets.duration && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration</span>
                    <span className="font-medium text-slate-700">{fmtDuration(session.targets.duration)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actual */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Result</h4>
              {resultActivity ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Distance</span>
                    <span className="font-medium text-accent-600">{fmtDistance(resultActivity.distance, unit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pace</span>
                    <span className="font-medium text-accent-600">{fmtPace(resultActivity.avgPace, unit)}</span>
                  </div>
                  {resultActivity.avgHR && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg HR</span>
                      <span className="font-medium text-accent-600">{resultActivity.avgHR} bpm</span>
                    </div>
                  )}
                  {resultActivity.hrZones && (
                    <div className="mt-2">
                      <HRZonesChart hrZones={resultActivity.hrZones} />
                    </div>
                  )}
                  <Link
                    to={`/activities/${resultActivity.id}`}
                    className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 mt-1"
                  >
                    <BarChart2 size={11} /> View full activity
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">No result linked yet.</p>
                  {isPast && (
                    <>
                      <input ref={fileRef} type="file" accept=".gpx" className="hidden"
                        onChange={(e) => { e.target.value = ''; }}
                      />
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-all"
                      >
                        <Upload size={12} /> Upload GPX result
                      </button>
                      <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <SkipForward size={11} /> Mark as skipped
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          {resultActivity && (
            <div className="border-t border-brand-50 pt-3">
              {session.aiAnalysis ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 mb-2">
                    <Sparkles size={12} /> AI Analysis
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{session.aiAnalysis}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
                  <button
                    onClick={handleAnalyse}
                    disabled={analysing || !apiKey}
                    className="flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-all disabled:opacity-60"
                  >
                    {analysing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {analysing ? 'Analysing…' : apiKey ? 'Analyse with AI' : 'Add API key in Settings to analyse'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Milestone badge ───────────────────────────────────────────────────────────
function MilestoneBadge({ milestone }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${
      milestone.achieved ? 'bg-accent-50 border-accent-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <Flag size={14} className={milestone.achieved ? 'text-accent-500 mt-0.5' : 'text-amber-400 mt-0.5'} />
      <div>
        <div className="text-xs font-semibold text-slate-700">{milestone.title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{milestone.description}</div>
        <div className="text-xs text-slate-400">{fmtDate(milestone.date)}</div>
      </div>
    </div>
  );
}

// ── Adjust Plan ───────────────────────────────────────────────────────────────
function AdjustPlanButton({ plan, settings, saveCoachingPlan }) {
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState('');
  const apiKey = settings.anthropicApiKey;

  const missedCount = plan.sessions.filter(
    (s) => s.type !== 'rest' && !s.resultActivityId &&
    new Date(s.date) < new Date()
  ).length;

  if (missedCount < 2) return null;

  async function handleAdjust() {
    if (!apiKey) { setError('Add API key in Settings'); return; }
    setAdjusting(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await aiAdjustPlan(apiKey, plan, today, !!settings.testingMode, settings.aiModel || 'opus');

      // Replace future sessions + milestones
      const pastSessions = plan.sessions.filter((s) => new Date(s.date) < new Date(today));
      const newSessions = (result.sessions || []).map((s, i) => ({
        ...s,
        id: s.id || `adj-${Date.now()}-${i}`,
        resultActivityId: null,
        aiAnalysis: null,
        analysisStatus: null,
      }));

      const updatedPlan = {
        ...plan,
        sessions: [...pastSessions, ...newSessions],
        milestones: result.milestones || plan.milestones,
        status: 'active',
        adjustmentHistory: [
          ...(plan.adjustmentHistory || []),
          { date: today, reason: result.adjustmentNote || 'Manual adjustment', sessionsReplanned: newSessions.length },
        ],
      };
      saveCoachingPlan(updatedPlan);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="card p-4 border-amber-200 bg-amber-50 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="text-amber-500" />
        <span className="text-sm font-semibold text-amber-700">{missedCount} sessions missed</span>
      </div>
      <p className="text-xs text-amber-600">Your plan may need to be adjusted based on your recent progress.</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleAdjust}
        disabled={adjusting || !apiKey}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60"
      >
        {adjusting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {adjusting ? 'Adjusting plan…' : apiKey ? 'Adjust Plan with AI' : 'Add API key in Settings'}
      </button>
    </div>
  );
}

// ── Main Plan component ───────────────────────────────────────────────────────
export default function Plan() {
  const navigate = useNavigate();
  const { coachingPlan, goal, settings, updateSession, saveCoachingPlan } = useApp();
  const [activeWeek, setActiveWeek] = useState(null);
  const unit = settings.unit || 'metric';

  if (!coachingPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="text-6xl">🏃</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">No coaching plan yet</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            Set your goal and add benchmark runs to get your personalised AI coaching plan.
          </p>
        </div>
        <button onClick={() => navigate('/setup')} className="btn-primary flex items-center gap-2">
          <Target size={16} /> Create My Plan
        </button>
      </div>
    );
  }

  // Group sessions by week
  const weeks = useMemo(() => {
    const map = {};
    for (const s of coachingPlan.sessions) {
      const w = s.week || 1;
      if (!map[w]) map[w] = [];
      map[w].push(s);
    }
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([week, sessions]) => ({ week: Number(week), sessions }));
  }, [coachingPlan]);

  // Find current week
  const today = new Date();
  const currentWeek = useMemo(() => {
    for (const { week, sessions } of weeks) {
      const dates = sessions.map((s) => new Date(s.date));
      const min = new Date(Math.min(...dates));
      const max = new Date(Math.max(...dates));
      max.setDate(max.getDate() + 1);
      if (today >= min && today <= max) return week;
    }
    return weeks[0]?.week ?? 1;
  }, [weeks]);

  const displayWeek = activeWeek ?? currentWeek;

  // Milestones for current week range
  const weekMilestones = coachingPlan.milestones?.filter(
    (m) => m.week === displayWeek
  ) || [];

  return (
    <div className="space-y-5 max-w-2xl">
      <GoalBanner plan={coachingPlan} />

      <div className="card p-4 space-y-1.5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Condition</div>
        <p className="text-sm text-slate-600 leading-relaxed">{coachingPlan.currentConditionSummary}</p>
      </div>

      <AdjustPlanButton
        plan={coachingPlan}
        settings={settings}
        saveCoachingPlan={saveCoachingPlan}
      />

      {/* Week selector */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {weeks.map(({ week }) => (
          <button
            key={week}
            onClick={() => setActiveWeek(week)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              displayWeek === week
                ? 'bg-brand-500 text-white'
                : week === currentWeek
                  ? 'bg-brand-50 border border-brand-300 text-brand-600'
                  : 'bg-white border border-brand-100 text-slate-500 hover:border-brand-300'
            }`}
          >
            Wk {week}
          </button>
        ))}
      </div>

      {/* Milestones for this week */}
      {weekMilestones.length > 0 && (
        <div className="space-y-2">
          {weekMilestones.map((m) => <MilestoneBadge key={m.id} milestone={m} />)}
        </div>
      )}

      {/* Sessions for selected week */}
      <div className="space-y-3">
        {weeks.find((w) => w.week === displayWeek)?.sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            goal={coachingPlan.goalSnapshot}
            settings={settings}
            updateSession={updateSession}
          />
        ))}
      </div>

      {/* All milestones section */}
      {coachingPlan.milestones?.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-slate-700">All Milestones</h2>
          </div>
          <div className="space-y-2">
            {coachingPlan.milestones.map((m) => <MilestoneBadge key={m.id} milestone={m} />)}
          </div>
        </div>
      )}

      {/* Reset plan link */}
      <div className="text-center pt-2">
        <button
          onClick={() => navigate('/setup')}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Start a new plan
        </button>
      </div>
    </div>
  );
}
