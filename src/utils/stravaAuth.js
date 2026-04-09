const WORKER_URL = 'https://pacementor-strava.ulielalbab1993.workers.dev';
const REDIRECT_URI = 'https://wnulilalbab.github.io/pacementor/';
const STORAGE_KEY = 'pacementor_strava_token';

export function getStoredToken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function storeToken(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

function isExpired(token) {
  // Consider expired if < 2 minutes remaining
  return !token?.expires_at || token.expires_at < Date.now() / 1000 + 120;
}

export function getStravaAuthUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function callWorker(body) {
  const res = await fetch(`${WORKER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Worker error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function exchangeCode(code) {
  const data = await callWorker({ code, grant_type: 'authorization_code' });
  storeToken(data);
  return data;
}

export async function getValidToken() {
  const token = getStoredToken();
  if (!token) return null;
  if (!isExpired(token)) return token;

  // Refresh
  try {
    const refreshed = await callWorker({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    });
    const updated = { ...token, ...refreshed };
    storeToken(updated);
    return updated;
  } catch {
    clearToken();
    return null;
  }
}
