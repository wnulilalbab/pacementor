import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { fmtPace } from '../../utils/formatters';

export default function PaceChart({ splits, avgPace, unit = 'metric' }) {
  if (!splits?.length) return null;

  const data = splits
    .filter((s) => s.pace)
    .map((s) => ({ km: s.km, pace: s.pace, partial: !!s.isPartial }));

  if (!data.length) return null;

  const paces = data.map((d) => d.pace);
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const padding = Math.max(10, (maxP - minP) * 0.2);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { km, pace, partial } = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs">
        <div className="text-slate-400">km {km}{partial ? ' *' : ''}</div>
        <div className="text-orange-400 font-semibold">{fmtPace(pace, unit)}</div>
      </div>
    );
  };

  // Color bars by pace relative to average
  function barColor(pace) {
    if (!avgPace) return '#fb923c';
    if (pace < avgPace * 0.97) return '#4ade80'; // fast
    if (pace > avgPace * 1.03) return '#f87171'; // slow
    return '#fb923c'; // average
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="km"
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'km', position: 'insideRight', fill: '#64748b', fontSize: 10 }}
        />
        <YAxis
          domain={[minP - padding, maxP + padding]}
          tickFormatter={(v) => fmtPace(v, unit)}
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={60}
          reversed
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {avgPace && (
          <ReferenceLine
            y={avgPace}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}
        <Bar dataKey="pace" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.km} fill={barColor(entry.pace)} fillOpacity={entry.partial ? 0.5 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
