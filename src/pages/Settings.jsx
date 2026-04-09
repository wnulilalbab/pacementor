import { useState } from 'react';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStorageUsage } from '../utils/storage';
import { fmtBytes as fmtBytesFormatter } from '../utils/formatters';

export default function Settings() {
  const { settings, updateSettings, activities, deleteActivity } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const usage = getStorageUsage();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Personalize your experience</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Profile */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">Profile</h2>

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
          <h2 className="text-sm font-semibold text-white">Units</h2>
          <div className="flex gap-3">
            {['metric', 'imperial'].map((u) => (
              <label
                key={u}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  form.unit === u
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
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
                <span className="text-xs text-slate-500">
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
        <h2 className="text-sm font-semibold text-white">Storage</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Data stored locally</span>
          <span className="text-white font-medium">{fmtBytesFormatter(usage)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div
            className="bg-orange-500 h-1.5 rounded-full"
            style={{ width: `${Math.min(100, (usage / (5 * 1024 * 1024)) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          {activities.length} activities · ~5 MB limit
        </p>
      </div>

      {/* Danger zone */}
      {activities.length > 0 && (
        <div className="card p-4 border-red-500/20 space-y-3">
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
                : 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
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
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
