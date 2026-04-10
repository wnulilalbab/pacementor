import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, AlertTriangle, RefreshCw, Link, Unlink, CheckCircle, XCircle, Eye, EyeOff, Bot, Download, Upload, FlaskConical } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStorageUsage, exportAllData, importAllData } from '../utils/storage';
import { fmtBytes as fmtBytesFormatter } from '../utils/formatters';
import { MODELS } from '../utils/aiApi';
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
  const [importStatus, setImportStatus] = useState(null); // null | 'ok' | 'error'
  const [importMsg, setImportMsg] = useState('');
  const importRef = useRef();

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

  async function handleImport(file) {
    try {
      const count = await importAllData(file);
      setImportStatus('ok');
      setImportMsg(`Imported ${count} data entries. Reloading…`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setImportStatus('error');
      setImportMsg(e.message);
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

        {/* API key */}
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

        {/* Model selector */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-2">Model</label>
          <div className="space-y-2">
            {Object.entries(MODELS).map(([key, m]) => {
              const selected = (form.aiModel || 'opus') === key;
              const costHint = {
                opus:   '$15 / $75 per MTok · Best quality',
                sonnet: '$3 / $15 per MTok · Balanced',
                haiku:  '$0.80 / $4 per MTok · Fastest & cheapest',
              }[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, aiModel: key }))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-200'
                  }`}
                >
                  <div>
                    <span className={`text-sm font-medium ${selected ? 'text-brand-700' : 'text-slate-700'}`}>
                      {m.label}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">{costHint}</p>
                  </div>
                  {selected && <CheckCircle size={15} className="text-brand-500 shrink-0" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Input price / Output price per million tokens</p>
        </div>

        {/* Testing mode toggle */}
        <div className={`flex items-center justify-between rounded-xl border px-3 py-3 transition-all ${
          form.testingMode ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className={form.testingMode ? 'text-amber-500' : 'text-slate-400'} />
            <div>
              <p className={`text-sm font-medium ${form.testingMode ? 'text-amber-700' : 'text-slate-700'}`}>
                Testing Mode
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                7-day plans, 3 questions, 1-sentence analyses — minimal token use
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, testingMode: !f.testingMode }))}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
              form.testingMode ? 'bg-amber-400' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              form.testingMode ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
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
        {(() => {
          const pct = (usage / (5 * 1024 * 1024)) * 100;
          const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-brand-500';
          const textColor = pct > 90 ? 'text-red-500' : pct > 70 ? 'text-amber-500' : 'text-slate-700';
          return (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Data stored locally</span>
                <span className={`font-medium ${textColor}`}>{fmtBytesFormatter(usage)} / 5 MB</span>
              </div>
              <div className="w-full bg-brand-50 rounded-full h-1.5">
                <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              {pct > 70 && (
                <p className={`text-xs ${pct > 90 ? 'text-red-400' : 'text-amber-500'}`}>
                  {pct > 90
                    ? 'Storage almost full — delete old activities to free up space.'
                    : 'Storage getting full — consider clearing old GPS tracks.'}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'} · GPS tracks use the most space
              </p>
            </>
          );
        })()}
      </div>

      {/* Export / Import */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Backup & Restore</h2>
        <p className="text-xs text-slate-400">
          Export saves everything — activities, GPS tracks, coaching plan, settings — as a single JSON file.
        </p>
        <div className="flex gap-2">
          <button
            onClick={exportAllData}
            className="flex-1 flex items-center justify-center gap-2 border border-brand-200 text-brand-600 hover:bg-brand-50 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Download size={14} /> Export All Data
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Upload size={14} /> Import Backup
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
        {importStatus && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${
            importStatus === 'ok'
              ? 'bg-accent-50 border-accent-200 text-accent-600'
              : 'bg-red-50 border-red-100 text-red-500'
          }`}>
            {importStatus === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {importMsg}
          </div>
        )}
        <p className="text-xs text-slate-300">
          Import will overwrite existing data and reload the page.
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
