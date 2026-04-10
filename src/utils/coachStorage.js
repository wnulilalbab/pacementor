const KEYS = {
  PLAN: 'pacementor_coaching_plan',
  GOAL: 'pacementor_goal',
  BENCHMARKS: 'pacementor_benchmark_runs',
};

// ── Coaching Plan ─────────────────────────────────────────────────────────────
export function getCoachingPlan() {
  try {
    const raw = localStorage.getItem(KEYS.PLAN);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCoachingPlan(plan) {
  if (plan === null) {
    localStorage.removeItem(KEYS.PLAN);
    return;
  }
  try {
    localStorage.setItem(KEYS.PLAN, JSON.stringify(plan));
  } catch (e) {
    // Quota exceeded — strip AI analyses (largest part) and retry
    const slim = {
      ...plan,
      sessions: plan.sessions?.map((s) => ({ ...s, aiAnalysis: null })) ?? [],
    };
    try {
      localStorage.setItem(KEYS.PLAN, JSON.stringify(slim));
      console.warn('Storage quota near limit — AI analyses were dropped from plan to save space.');
    } catch {
      throw new Error('Storage full. Free up space by removing old activities in Settings.');
    }
  }
}

export function clearCoachingPlan() {
  localStorage.removeItem(KEYS.PLAN);
}

// ── Goal ─────────────────────────────────────────────────────────────────────
export function getGoal() {
  try {
    const raw = localStorage.getItem(KEYS.GOAL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGoal(goal) {
  localStorage.setItem(KEYS.GOAL, JSON.stringify(goal));
}

export function clearGoal() {
  localStorage.removeItem(KEYS.GOAL);
}

// ── Benchmark Run IDs ─────────────────────────────────────────────────────────
export function getBenchmarkRunIds() {
  try {
    const raw = localStorage.getItem(KEYS.BENCHMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBenchmarkRunIds(ids) {
  localStorage.setItem(KEYS.BENCHMARKS, JSON.stringify(ids));
}

export function addBenchmarkRunId(id) {
  const ids = getBenchmarkRunIds();
  if (!ids.includes(id)) saveBenchmarkRunIds([...ids, id]);
}

export function removeBenchmarkRunId(id) {
  saveBenchmarkRunIds(getBenchmarkRunIds().filter((x) => x !== id));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function clearAllCoachingData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
