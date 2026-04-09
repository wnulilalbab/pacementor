import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { fmtPace } from '../../utils/formatters';

export default function PaceChart({ splits, avgPace, unit = 'metric' }) {
  if (!splits?.length) return null;
  const data = splits.filter((s) => s.pace).map((s) => ({ km: s.km, pace: s.pace, partial: !!s.isPartial }));
  if (!data.length) return null;

  const paces = data.map((d) => d.pace);
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const padding = Math.max(10, (maxP - minP) * 0.2);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { km, pace, partial } = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-400">km {km}{partial ? ' *' : ''}</div>
        <div className="text-brand-500 font-semibold">{fmtPace(pace, unit)}</div>
      </div>
    );
  };

  function barColor(pace) {
    if (!avgPace) return '#4AAEE0';
    if (pace < avgPace * 0.97) return '#5DCE7A';
    if (pace > avgPace * 1.03) return '#f87171';
    return '#4AAEE0';
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
        <XAxis dataKey="km" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[minP - padding, maxP + padding]} tickFormatter={(v) => fmtPace(v, unit)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={60} reversed />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(74,174,224,0.08)' }} />
        {avgPace && <ReferenceLine y={avgPace} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />}
        <Bar dataKey="pace" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => <Cell key={entry.km} fill={barColor(entry.pace)} fillOpacity={entry.partial ? 0.5 : 1} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
