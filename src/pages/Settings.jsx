import { useState, useEffect } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, Link, Unlink, CheckCircle, XCircle, Eye, EyeOff, Bot } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStorageUsage } from '../utils/storage';
import { fmtBytes as fmtBytesFormatter } from '../utils/formatters';
import { getStoredToken, clearToken, getStravaAuthUrl } from '../utils/stravaAuth';
import { fetchAllActivities, fetchAthlete } from '../utils/stravaApi';

function StravaLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FC4C02">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z"/>
      <path d="M9.997 0L3.29 13.061h4.915l1.79-3.527 1.793 3.527h4.913z" opacity=".6"/>
    </svg>
  );
}

export default function Settings() {
  const { settings, updateSettings, activities, deleteActivity, addActivity } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [stravaToken, setStravaToken] = useState(getStoredToken);
  const [stravaStatus, setStravaStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [syncDone, setSyncDone] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('strava=connected')) {
      setStravaToken(getStoredToken());
      setStravaStatus('connected');
      window.location.hash = '#/settings';
    } else if (hash.includes('strava=error')) {
      setStravaStatus('error');
      window.location.hash = '#/settings';
    }
  }, []);

  function handleSave(e) {
    e.preventDefault();
    const parsed = {
      ...form,
      weight: Number(form.weight) || 70,
      hrMax: form.hrMax ? Number(form.hrMax) : null,
      birthYear: form.birthYear ? Number(form.birthYear) : null,
    };
    updateSettings(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearAll() {
    if (confirmClear) {
      [...activities].forEach((a) => deleteActivity(a.id));
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
    }
  }

  function handleConnect() {
    const clientId = form.stravaClientId?.trim();
    if (!clientId) {
      alert('Please enter your Strava Client ID first, then save settings.');
      return;
    }
    updateSettings({ ...settings, ...form, stravaClientId: clientId });
    window.location.href = getStravaAuthUrl(clientId);
  }

  function handleDisconnect() {
    clearToken();
    setStravaToken(null);
    setStravaStatus(null);
    setSyncDone(null);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncCount(0);
    setSyncDone(null);
    try {
      const existingIds = new Set(activities.map((a) => a.id));
      const imported = await fetchAllActivities(existingIds, (count) => {
        setSyncCount(count);
      });
      for (const act of imported) {
        addActivity(act);
      }
      setSyncDone(imported.length);
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const usage = getStorageUsage();
  const athlete = stravaToken?.athlete;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Personalize your experience</p>
      </div>

      {/* AI */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-slate-700">AI Coaching (Claude)</h2>
        </div>
        <Field
          label="Anthropic API Key"
          hint={<>Get your key at <span className="text-brand-500">console.anthropic.com</span></>}
        >
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.anthropicApiKey || ''}
              onChange={(e) => setForm((f) => ({ ...f, anthropicApiKey: e.target.value }))}
              placeholder="sk-ant-..."
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>
        {form.anthropicApiKey && (
          <div className="flex items-center gap-2 text-xs text-accent-600 bg-accent-50 border border-accent-200 rounded-xl px-3 py-2">
            <CheckCircle size={13} /> API key saved — AI coaching features are enabled
          </div>
        )}
      </div>

      {/* Strava */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <StravaLogo />
          <h2 className="text-sm font-semibold text-slate-700">Strava</h2>
        </div>

        {stravaStatus === 'connected' && (
          <div className="flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-xl px-3 py-2 text-sm text-accent-600">
            <CheckCircle size={15} /> Connected successfully!
          </div>
        )}
        {stravaStatus === 'error' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-500">
            <XCircle size={15} /> Connection failed — please try again.
          </div>
        )}

        {!stravaToken ? (
          <div className="space-y-3">
            <Field
              label="Strava Client ID"
              hint={<>Get it from <span className="text-brand-500">strava.com/settings/api</span></>}
            >
              <input
                type="text"
                value={form.stravaClientId || ''}
                onChange={(e) => setForm((f) => ({ ...f, stravaClientId: e.target.value }))}
                placeholder="e.g. 123456"
                className="input-field"
              />
            </Field>
            <button
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-2 bg-[#FC4C02] hover:bg-[#e04300] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Link size={15} />
              Connect with Strava
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-[#FC4C02]/10 flex items-center justify-center">
                <StravaLogo size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 text-sm font-medium">
                  {athlete ? `${athlete.firstname} ${athlete.lastname}` : 'Strava Account'}
                </p>
                <p className="text-slate-400 text-xs truncate">
                  {athlete?.city ? `${athlete.city}, ` : ''}{athlete?.country || 'Connected'}
                </p>
              </div>
              <div className="w-2 h-2 bg-accent-400 rounded-full shrink-0" />
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 bg-[#FC4C02] hover:bg-[#e04300] disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing
                ? `Syncing… (${syncCount} activities)`
                : 'Sync Activities from Strava'}
            </button>

            {syncDone !== null && (
              <p className="text-center text-sm text-accent-600">
                ✓ {syncDone > 0
                  ? `${syncDone} new ${syncDone === 1 ? 'activity' : 'activities'} imported`
                  : 'Already up to date'}
              </p>
            )}

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 text-sm py-2 transition-colors"
            >
              <Unlink size={14} />
              Disconnect Strava
            </button>
          </div>
        )}
      </div>

      {/* Profile */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Profile</h2>

          <Field label="Your name (optional)">
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Alex"
              className="input-field"
            />
          </Field>

          <Field label="Body weight (kg)">
            <input
              type="number"
              value={form.weight || ''}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="70"
              min={30}
              max={200}
              className="input-field"
            />
          </Field>

          <Field label="Max heart rate (bpm)" hint="Leave blank to auto-detect from activities">
            <input
              type="number"
              value={form.hrMax || ''}
              onChange={(e) => setForm((f) => ({ ...f, hrMax: e.target.value }))}
              placeholder="Auto"
              min={100}
              max={230}
              className="input-field"
            />
          </Field>

          <Field label="Birth year (optional)" hint="Used for estimated HRmax (220 − age)">
            <input
              type="number"
              value={form.birthYear || ''}
              onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
              placeholder="e.g. 1990"
              min={1920}
              max={2010}
              className="input-field"
            />
          </Field>
        </div>

        {/* Units */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Units</h2>
          <div className="flex gap-3">
            {['metric', 'imperial'].map((u) => (
              <label
                key={u}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  form.unit === u
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-brand-100 text-slate-400 hover:border-brand-300'
                }`}
              >
                <input
                  type="radio"
                  name="unit"
                  value={u}
                  checked={form.unit === u}
                  onChange={() => setForm((f) => ({ ...f, unit: u }))}
                  className="sr-only"
                />
                <span className="capitalize text-sm font-medium">{u}</span>
                <span className="text-xs text-slate-400">
                  {u === 'metric' ? 'km · m' : 'mi · ft'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={15} />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>

      {/* Storage */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Storage</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Data stored locally</span>
          <span className="text-slate-700 font-medium">{fmtBytesFormatter(usage)}</span>
        </div>
        <div className="w-full bg-brand-50 rounded-full h-1.5">
          <div
            className="bg-brand-500 h-1.5 rounded-full"
            style={{ width: `${Math.min(100, (usage / (5 * 1024 * 1024)) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          {activities.length} activities · ~5 MB limit
        </p>
      </div>

      {/* Danger zone */}
      {activities.length > 0 && (
        <div className="card p-4 border-red-100 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
          </div>
          <p className="text-slate-400 text-sm">
            Permanently delete all {activities.length} activities. This cannot be undone.
          </p>
          <button
            onClick={handleClearAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              confirmClear
                ? 'bg-red-500 text-white'
                : 'border border-red-200 text-red-400 hover:bg-red-50'
            }`}
          >
            <Trash2 size={14} />
            {confirmClear ? 'Click again to confirm' : 'Delete all activities'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-500 font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
