import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { exchangeCode } from './utils/stravaAuth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Upload from './pages/Upload';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

// Handle Strava OAuth redirect — runs before any routing
// Strava appends ?code=XXX to the base URL (before the hash)
function useStravaCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code) {
      // Clean the URL immediately so refreshing doesn't re-trigger
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

export default function App() {
  useStravaCallback();

  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="activities" element={<Activities />} />
            <Route path="activities/:id" element={<ActivityDetail />} />
            <Route path="upload" element={<Upload />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
