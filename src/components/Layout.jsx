import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Upload, BarChart2, Settings } from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/activities', label: 'Activities', icon: List },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ to, label, icon: Icon, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-brand-100 text-brand-600'
            : 'text-slate-500 hover:bg-brand-50 hover:text-slate-800'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, label, icon: Icon, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
          isActive ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600'
        }`
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-brand-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-brand-100 bg-white px-3 py-6 sticky top-0 h-screen shadow-sm">
        <div className="flex items-center gap-2 px-3 mb-8">
          <img src="/pacementor/icon.svg" alt="PaceMentor" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-slate-800 text-lg leading-none">
            Pace<span className="text-brand-500">Mentor</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        <p className="text-slate-300 text-xs px-4">v0.1.0</p>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-brand-100 bg-white/90 backdrop-blur sticky top-0 z-10 shadow-sm">
          <img src="/pacementor/icon.svg" alt="PaceMentor" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-slate-800">
            Pace<span className="text-brand-500">Mentor</span>
          </span>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-brand-100 flex justify-around px-2 py-1 z-50 shadow-lg">
        {nav.map((item) => <MobileNavItem key={item.to} {...item} />)}
      </nav>
    </div>
  );
}
