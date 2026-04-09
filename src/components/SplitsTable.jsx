import { fmtPace, fmtDuration, fmtDistance, fmtElevation } from '../utils/formatters';

export default function SplitsTable({ splits, unit = 'metric' }) {
  if (!splits?.length) return null;

  const paces = splits.map((s) => s.pace).filter(Boolean);
  const minPace = paces.length ? Math.min(...paces) : null;
  const maxPace = paces.length ? Math.max(...paces) : null;
  const paceRange = maxPace && minPace ? maxPace - minPace : 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-brand-100">
            <th className="pb-2 text-left">km</th>
            <th className="pb-2 text-right">Dist</th>
            <th className="pb-2 text-right">Time</th>
            <th className="pb-2 text-right">Pace</th>
            <th className="pb-2 text-right">Elev</th>
            <th className="pb-2 text-right">HR</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => {
            const paceRel = split.pace && paceRange ? (split.pace - minPace) / paceRange : 0.5;
            const barColor = paceRel < 0.33 ? 'bg-accent-500' : paceRel < 0.66 ? 'bg-brand-400' : 'bg-red-400';

            return (
              <tr key={split.km} className="border-b border-brand-50 hover:bg-brand-50 transition-colors">
                <td className="py-2 text-left">
                  <span className="font-medium text-slate-700">
                    {split.km}{split.isPartial && <span className="text-slate-300 text-xs"> *</span>}
                  </span>
                </td>
                <td className="py-2 text-right text-slate-500">{fmtDistance(split.distance, unit)}</td>
                <td className="py-2 text-right text-slate-500">{fmtDuration(split.duration)}</td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1.5 bg-brand-100 rounded-full overflow-hidden hidden sm:block">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${(1 - paceRel) * 100}%` }} />
                    </div>
                    <span className="font-medium text-slate-700 tabular-nums">{fmtPace(split.pace, unit)}</span>
                  </div>
                </td>
                <td className="py-2 text-right">
                  {split.elevationDiff != null ? (
                    <span className={split.elevationDiff > 0 ? 'text-amber-500' : split.elevationDiff < 0 ? 'text-brand-400' : 'text-slate-300'}>
                      {split.elevationDiff > 0 ? '+' : ''}{fmtElevation(split.elevationDiff, unit)}
                    </span>
                  ) : '--'}
                </td>
                <td className="py-2 text-right text-slate-500">
                  {split.avgHR ? <span className="text-red-400">{split.avgHR}</span> : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-300 mt-2">* Partial km</p>
    </div>
  );
}
