export default function StatCard({ label, value, sub, icon: Icon, accent = false, className = '' }) {
  return (
    <div className={`card p-4 flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && (
          <Icon
            size={16}
            className={accent ? 'text-orange-400' : 'text-slate-500'}
          />
        )}
      </div>
      <div className={`stat-value ${accent ? 'text-orange-400' : 'text-white'}`}>
        {value ?? '--'}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
