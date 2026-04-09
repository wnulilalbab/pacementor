import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtDistance, weekStart } from '../../utils/formatters';

export default function WeeklyChart({ activities, weeks = 12, unit = 'metric' }) {
  if (!activities?.length) return null;

  const now = new Date();
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const ws = weekStart(d);
    buckets.push({ label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), weekMs: ws.getTime(), distance: 0, runs: 0 });
  }

  for (const act of activities) {
    const actMs = weekStart(new Date(act.date)).getTime();
    const bucket = buckets.find((b) => b.weekMs === actMs);
    if (bucket) { bucket.distance += act.distance || 0; bucket.runs++; }
  }

  const data = buckets.map((b) => ({
    ...b,
    distKm: unit === 'imperial'
      ? Math.round((b.distance / 1609.34) * 10) / 10
      : Math.round((b.distance / 1000) * 10) / 10,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { label, runs, distance } = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-400 mb-1">{label}</div>
        <div className="text-brand-500 font-semibold">{fmtDistance(distance, unit)}</div>
        <div className="text-slate-400">{runs} {runs === 1 ? 'run' : 'runs'}</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(weeks / 6)} />
        <YAxis tickFormatter={(v) => `${v}${unit === 'imperial' ? 'mi' : 'km'}`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(74,174,224,0.08)' }} />
        <Bar dataKey="distKm" fill="#4AAEE0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
