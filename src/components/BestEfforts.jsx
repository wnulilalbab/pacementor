import { fmtDuration, fmtPace } from '../utils/formatters';
import { Award } from 'lucide-react';

export default function BestEfforts({ bestEfforts, unit = 'metric' }) {
  if (!bestEfforts?.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {bestEfforts.map((effort) => (
        <div key={effort.name} className="bg-brand-50 border border-brand-100 rounded-xl p-3">
          <div className="flex items-center gap-1 mb-1">
            <Award size={12} className="text-brand-500" />
            <span className="text-xs text-slate-500 font-medium">{effort.name}</span>
          </div>
          <div className="text-lg font-bold text-slate-800 tabular-nums">
            {fmtDuration(effort.duration)}
          </div>
          <div className="text-xs text-brand-500 tabular-nums">
            {fmtPace(effort.pace, unit)}
          </div>
        </div>
      ))}
    </div>
  );
}
