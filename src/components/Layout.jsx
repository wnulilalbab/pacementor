import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Upload,
  BarChart2,
  Settings,
} from 'lucide-react';

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
            ? 'bg-orange-500/20 text-orange-400'
            : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
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
          isActive ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'
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
    <div className="flex min-h-screen bg-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-slate-700/50 px-3 py-6 sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 mb-8">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-lg">
            🏃
          </div>
          <span className="font-bold text-white text-lg leading-none">
            Pace<span className="text-orange-400">Mentor</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <p className="text-slate-600 text-xs px-4">v0.1.0</p>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-4 py-4 border-b border-slate-700/50 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-base">
            🏃
          </div>
          <span className="font-bold text-white">
            Pace<span className="text-orange-400">Mentor</span>
          </span>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/50 flex justify-around px-2 py-1 z-50">
        {nav.map((item) => (
          <MobileNavItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}
