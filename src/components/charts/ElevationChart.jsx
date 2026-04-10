import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtDistance, fmtElevation } from '../../utils/formatters';

export default function ElevationChart({ analytics, unit = 'metric' }) {
  if (!analytics?.distSamples?.length) return null;

  const data = analytics.distSamples
    .map((d, i) => {
      const ele = analytics.eleSamples?.[i];
      if (ele == null) return null;
      return { d, ele: unit === 'imperial' ? Math.round(ele * 3.28084) : Math.round(ele) };
    })
    .filter(Boolean);

  if (data.length < 2) return null;

  const eleValues = data.map((d) => d.ele);
  const minEle = Math.min(...eleValues);
  const maxEle = Math.max(...eleValues);
  const padding = Math.max(5, (maxEle - minEle) * 0.15);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { d, ele } = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-400">{fmtDistance(d, unit)}</div>
        <div className="text-brand-500 font-semibold">{fmtElevation(ele, unit)}</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4AAEE0" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4AAEE0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
        <XAxis dataKey="d" tickFormatter={(v) => fmtDistance(v, unit)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[minEle - padding, maxEle + padding]} tickFormatter={(v) => fmtElevation(v, unit)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="ele" stroke="#4AAEE0" strokeWidth={2} fill="url(#eleGrad)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
