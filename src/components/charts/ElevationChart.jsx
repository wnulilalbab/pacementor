import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { fmtDistance, fmtElevation } from '../../utils/formatters';

export default function ElevationChart({ trackPoints, unit = 'metric' }) {
  if (!trackPoints?.length) return null;

  // Build chart data from track points that have elevation
  const data = trackPoints
    .filter((p) => p.ele != null && p.d != null)
    .map((p) => ({
      d: p.d,
      ele: unit === 'imperial' ? Math.round(p.ele * 3.28084) : Math.round(p.ele),
    }));

  if (data.length < 2) return null;

  const eleValues = data.map((d) => d.ele);
  const minEle = Math.min(...eleValues);
  const maxEle = Math.max(...eleValues);
  const padding = Math.max(5, (maxEle - minEle) * 0.15);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { d, ele } = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs">
        <div className="text-slate-400">{fmtDistance(d, unit)}</div>
        <div className="text-orange-400 font-semibold">
          {fmtElevation(ele, unit)}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
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
          domain={[minEle - padding, maxEle + padding]}
          tickFormatter={(v) => fmtElevation(v, unit)}
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="ele"
          stroke="#fb923c"
          strokeWidth={2}
          fill="url(#eleGrad)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
