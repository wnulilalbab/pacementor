import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { fmtDistance } from '../../utils/formatters';

export default function HRChart({ trackPoints, avgHR, maxHR, unit = 'metric' }) {
  const data = (trackPoints || [])
    .filter((p) => p.hr && p.d != null)
    .map((p) => ({ d: p.d, hr: p.hr }));

  if (data.length < 2) return null;

  const hrs = data.map((d) => d.hr);
  const minHR = Math.min(...hrs) - 5;
  const maxHRVal = Math.max(...hrs) + 5;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs">
        <div className="text-slate-400">{fmtDistance(payload[0].payload.d, unit)}</div>
        <div className="text-red-400 font-semibold">{payload[0].value} bpm</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="d"
          tickFormatter={(v) => fmtDistance(v, unit)}
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minHR, maxHRVal]}
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={35}
        />
        <Tooltip content={<CustomTooltip />} />
        {avgHR && (
          <ReferenceLine y={avgHR} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
        )}
        <Line
          type="monotone"
          dataKey="hr"
          stroke="#f87171"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
