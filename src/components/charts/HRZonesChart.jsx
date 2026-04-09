import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HR_ZONE_COLORS, HR_ZONE_LABELS } from '../../utils/formatters';

export default function HRZonesChart({ hrZones }) {
  if (!hrZones) return null;

  const data = hrZones.map((pct, i) => ({
    zone: `Z${i + 1}`,
    label: HR_ZONE_LABELS[i],
    pct,
    color: HR_ZONE_COLORS[i],
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { label, pct } = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg px-3 py-2 text-xs shadow-md">
        <div className="text-slate-600 font-medium">{label}</div>
        <div style={{ color: payload[0].payload.color }} className="font-bold">{pct}%</div>
      </div>
    );
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="zone" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(74,174,224,0.08)' }} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry) => <Cell key={entry.zone} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {data.map((d) => (
          <div key={d.zone} className="flex items-center gap-1 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span>{d.label}</span>
            <span className="text-slate-700 font-medium">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
