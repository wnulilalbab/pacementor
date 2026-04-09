import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { fmtDistance } from '../../utils/formatters';

export default function HRChart({ trackPoints, avgHR, unit = 'metric' }) {
  const data = (trackPoints || []).filter((p) => p.hr && p.d != null).map((p) => ({ d: p.d, hr: p.hr }));
  if (data.length < 2) return null;

  const hrs = data.map((d) => d.hr);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-400">{fmtDistance(payload[0].payload.d, unit)}</div>
        <div className="text-red-500 font-semibold">{payload[0].value} bpm</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
        <XAxis dataKey="d" tickFormatter={(v) => fmtDistance(v, unit)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[Math.min(...hrs) - 5, Math.max(...hrs) + 5]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
        <Tooltip content={<CustomTooltip />} />
        {avgHR && <ReferenceLine y={avgHR} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />}
        <Line type="monotone" dataKey="hr" stroke="#f87171" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
