import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { parseGPX } from '../utils/gpxParser';
import { useApp } from '../context/AppContext';
import { fmtDistance, fmtDuration, fmtPace, fmtDate } from '../utils/formatters';

export default function Upload() {
  const { addActivity, settings } = useApp();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState('idle'); // idle | parsing | preview | success | error
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  async function processFile(file) {
    if (!file?.name.toLowerCase().endsWith('.gpx')) {
      setError('Please upload a .gpx file');
      setState('error');
      return;
    }
    setState('parsing');
    setProgress(0);
    try {
      const ticker = setInterval(() => setProgress((p) => Math.min(p + 15, 85)), 100);
      const activity = await parseGPX(file, settings);
      clearInterval(ticker);
      setProgress(100);
      setParsed(activity);
      setState('preview');
    } catch (e) {
      setError(e.message || 'Failed to parse GPX file');
      setState('error');
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  function onFileChange(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleSave() {
    if (!parsed) return;
    addActivity(parsed);
    setState('success');
    setTimeout(() => navigate(`/activities/${parsed.id}`), 1200);
  }

  function reset() {
    setState('idle');
    setParsed(null);
    setError('');
    setProgress(0);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Activity</h1>
        <p className="text-slate-400 text-sm mt-1">Import your GPX file from Garmin, Strava, or any GPS device</p>
      </div>

      {/* Drop zone */}
      {(state === 'idle' || state === 'error') && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${
              dragOver
                ? 'border-brand-400 bg-brand-50'
                : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50/50'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dragOver ? 'bg-brand-100' : 'bg-brand-50'}`}>
              <UploadIcon size={32} className={dragOver ? 'text-brand-500' : 'text-brand-400'} />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-medium">Drop your GPX file here</p>
              <p className="text-slate-400 text-sm mt-1">or click to browse</p>
            </div>
            <div className="flex gap-2">
              {['Garmin', 'Strava', 'Wahoo', 'Polar', 'Suunto'].map((brand) => (
                <span key={brand} className="text-xs bg-brand-50 border border-brand-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {brand}
                </span>
              ))}
            </div>
          </div>
          <input ref={inputRef} type="file" accept=".gpx" className="hidden" onChange={onFileChange} />
          {state === 'error' && (
            <div className="mt-3 flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Parsing progress */}
      {state === 'parsing' && (
        <div className="card p-8 flex flex-col items-center gap-4">
          <FileText size={40} className="text-brand-500 animate-pulse" />
          <p className="text-slate-700 font-medium">Parsing GPX file…</p>
          <div className="w-full bg-brand-50 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-400 text-sm">Calculating splits, best efforts, and HR zones</p>
        </div>
      )}

      {/* Preview */}
      {state === 'preview' && parsed && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{parsed.name}</h2>
                <p className="text-slate-400 text-sm">{fmtDate(parsed.date)}</p>
              </div>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <PreviewStat label="Distance" value={fmtDistance(parsed.distance, settings.unit)} />
              <PreviewStat label="Moving Time" value={fmtDuration(parsed.movingTime)} />
              <PreviewStat label="Avg Pace" value={fmtPace(parsed.avgPace, settings.unit)} />
              <PreviewStat label="Elevation" value={`+${parsed.elevationGain ?? 0}m`} />
              {parsed.avgHR && <PreviewStat label="Avg HR" value={`${parsed.avgHR} bpm`} />}
              {parsed.avgCadence && <PreviewStat label="Cadence" value={`${parsed.avgCadence} spm`} />}
              <PreviewStat label="Calories" value={`${parsed.calories} cal`} />
              <PreviewStat label="Splits" value={`${parsed.splits?.length ?? 0} km`} />
            </div>

            {parsed.bestEfforts?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-brand-100">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Best Efforts Found</p>
                <div className="flex flex-wrap gap-2">
                  {parsed.bestEfforts.map((e) => (
                    <span key={e.name} className="text-xs bg-brand-50 border border-brand-100 text-brand-600 px-2 py-1 rounded-lg">
                      {e.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-ghost flex-1">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary flex-1">
              Save Activity
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === 'success' && (
        <div className="card p-12 flex flex-col items-center gap-4">
          <CheckCircle size={48} className="text-accent-500" />
          <p className="text-slate-800 font-semibold text-lg">Activity saved!</p>
          <p className="text-slate-400 text-sm">Redirecting to activity details…</p>
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value }) {
  return (
    <div className="bg-brand-50 rounded-xl p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="font-semibold text-slate-800 text-sm">{value}</div>
    </div>
  );
}
