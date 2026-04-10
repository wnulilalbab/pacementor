import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { exchangeCode } from './utils/stravaAuth';
import Layout from './components/Layout';

// Coaching pages (primary)
import Setup from './pages/Setup';
import Plan from './pages/Plan';
import Benchmark from './pages/Benchmark';
import Settings from './pages/Settings';

// Legacy pages (still routable for deep-linking from plan, but not in nav)
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Upload from './pages/Upload';
import Analytics from './pages/Analytics';

// Handle Strava OAuth redirect — runs before any routing
function useStravaCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      exchangeCode(code)
        .then(() => { window.location.hash = '#/settings?strava=connected'; })
        .catch(() => { window.location.hash = '#/settings?strava=error'; });
    } else if (error) {
      window.history.replaceState({}, '', window.location.pathname);
      window.location.hash = '#/settings?strava=error';
    }
  }, []);
}

// Smart root redirect: go to /plan if one exists, else /setup
function RootRedirect() {
  const { coachingPlan } = useApp();
  return <Navigate to={coachingPlan ? '/plan' : '/setup'} replace />;
}

export default function App() {
  useStravaCallback();

  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<RootRedirect />} />

            {/* Coaching routes */}
            <Route path="setup" element={<Setup />} />
            <Route path="plan" element={<Plan />} />
            <Route path="benchmark" element={<Benchmark />} />
            <Route path="settings" element={<Settings />} />

            {/* Legacy routes (still accessible via direct link) */}
            <Route path="activities" element={<Activities />} />
            <Route path="activities/:id" element={<ActivityDetail />} />
            <Route path="upload" element={<Upload />} />
            <Route path="analytics" element={<Analytics />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
