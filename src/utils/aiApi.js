import { fmtPace, fmtDistance, fmtDuration } from './formatters';
import { getActivity } from './storage';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Model registry ────────────────────────────────────────────────────────────
export const MODELS = {
  opus:   { id: 'claude-opus-4-6',           label: 'Opus 4.6',   inputPricePerM: 15,   outputPricePerM: 75  },
  sonnet: { id: 'claude-sonnet-4-6',          label: 'Sonnet 4.6', inputPricePerM: 3,    outputPricePerM: 15  },
  haiku:  { id: 'claude-haiku-4-5-20251001',  label: 'Haiku 4.5',  inputPricePerM: 0.80, outputPricePerM: 4   },
};

export function estimateCost(inputTokens, outputTokens, modelKey = 'opus') {
  const p = MODELS[modelKey] ?? MODELS.opus;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// ── Core API call ─────────────────────────────────────────────────────────────
// Returns { text, inputTokens, outputTokens, modelKey }
async function callClaude(apiKey, userContent, systemPrompt, maxTokens = 8192, modelKey = 'opus') {
  const modelDef = MODELS[modelKey] ?? MODELS.opus;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelDef.id,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (res.status === 401) throw new Error('Invalid Anthropic API key. Check your key in Settings.');
  if (res.status === 429) throw new Error('API rate limit reached. Please wait a moment and try again.');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    if (msg.toLowerCase().includes('credit balance') || msg.toLowerCase().includes('billing')) {
      throw new Error('Your Anthropic API credit balance is too low. Add credits at console.anthropic.com → Billing.');
    }
    throw new Error(msg || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content[0].text;
  const inputTokens  = data.usage?.input_tokens  ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;

  if (data.stop_reason === 'max_tokens') {
    const err = new Error('AI response was cut off (token limit reached). Try a shorter deadline/plan or contact support.');
    err.rawResponse = text;
    throw err;
  }

  return { text, inputTokens, outputTokens, modelKey };
}

// ── Parse JSON robustly ───────────────────────────────────────────────────────
// Tries multiple strategies to extract valid JSON regardless of model quirks.
function parseJSON(text) {
  const strategies = [
    // 1. Direct parse
    () => JSON.parse(text.trim()),
    // 2. Strip markdown fences
    () => JSON.parse(text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim()),
    // 3. Extract first {...} block
    () => { const m = text.match(/(\{[\s\S]*\})/); if (m) return JSON.parse(m[1]); throw new Error('no match'); },
    // 4. Extract first [...] block
    () => { const m = text.match(/(\[[\s\S]*\])/); if (m) return JSON.parse(m[1]); throw new Error('no match'); },
  ];

  for (const strategy of strategies) {
    try { return strategy(); } catch { /* try next */ }
  }

  const err = new Error('Failed to parse AI response as JSON. The model may have returned unexpected text.');
  err.rawResponse = text;
  throw err;
}

// ── Benchmark summary for prompts ─────────────────────────────────────────────
export function summariseBenchmarks(activityIds) {
  const activities = activityIds.map((id) => getActivity(id)).filter(Boolean);
  if (!activities.length) return 'No benchmark data available.';

  const totalDist = activities.reduce((s, a) => s + (a.distance || 0), 0);
  const avgWeeklyDist = Math.round(totalDist / 1000);

  const zone2Runs = activities.filter((a) => a.hrZones && a.hrZones[1] > 40);
  const z2Pace = zone2Runs.length
    ? Math.round(zone2Runs.reduce((s, a) => s + (a.avgPace || 0), 0) / zone2Runs.length)
    : null;

  const effortRuns = activities.filter((a) => a.hrZones && a.hrZones[3] + (a.hrZones[4] || 0) > 30);
  const effortPace = effortRuns.length
    ? Math.round(effortRuns.reduce((s, a) => s + (a.avgPace || 0), 0) / effortRuns.length)
    : null;

  const maxDist = Math.max(...activities.map((a) => a.distance || 0));
  const avgHR = activities.filter((a) => a.avgHR).length
    ? Math.round(activities.filter((a) => a.avgHR).reduce((s, a) => s + a.avgHR, 0) / activities.filter((a) => a.avgHR).length)
    : null;

  return [
    `Benchmark runs: ${activities.length} run(s) analysed`,
    `Total distance covered: ${fmtDistance(totalDist)}`,
    `Longest run: ${fmtDistance(maxDist)}`,
    z2Pace ? `Estimated Zone 2 pace: ${fmtPace(z2Pace)}` : 'Zone 2 pace: insufficient data',
    effortPace ? `Estimated effort/threshold pace: ${fmtPace(effortPace)}` : '',
    avgHR ? `Average HR across benchmarks: ${avgHR} bpm` : '',
    `Recent weekly volume estimate: ~${avgWeeklyDist} km`,
  ].filter(Boolean).join('\n');
}

// ── Generate follow-up questions ──────────────────────────────────────────────
export async function generateFollowUpQuestions(apiKey, goal, benchmarkIds, testMode = false, modelKey = 'opus') {
  const benchmarkSummary = summariseBenchmarks(benchmarkIds);
  const goalDesc = formatGoalForPrompt(goal);

  const userContent = `Goal: ${goalDesc}

Benchmark data:
${benchmarkSummary}

Generate ${testMode ? 'exactly 3' : '6-8 targeted'} follow-up questions to personalise a running coaching plan.
Focus on: training availability, fitness context, lifestyle constraints${testMode ? '.' : ', injury history, motivation.'}

You MUST respond with ONLY a valid JSON array — no text before or after, no markdown.
Schema:
[
  {"id": "q1", "question": "...", "type": "number", "min": 1, "max": 7},
  {"id": "q2", "question": "...", "type": "multiselect", "options": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]},
  {"id": "q3", "question": "...", "type": "select", "options": ["Beginner (< 1 year)", "Intermediate (1–3 years)", "Experienced (3+ years)"]}
]
Allowed types: "number" (include min/max), "text", "select" (include options), "multiselect" (include options)`;

  const { text } = await callClaude(
    apiKey, userContent,
    'You are an expert running coach. Respond ONLY with a valid JSON array. No markdown, no explanation, no text outside the JSON.',
    testMode ? 600 : 8192, modelKey
  );
  return parseJSON(text);
}

// ── Generate full coaching plan ───────────────────────────────────────────────
export async function generateCoachingPlan(apiKey, goal, benchmarkIds, followUpQAs, userProfile, startDate, testMode = false, modelKey = 'opus') {
  const benchmarkSummary = summariseBenchmarks(benchmarkIds);
  const goalDesc = formatGoalForPrompt(goal);
  const hasDeadline = !!goal.deadline;
  const deadline = hasDeadline
    ? new Date(goal.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const age = userProfile.birthYear ? new Date().getFullYear() - Number(userProfile.birthYear) : null;

  const profileLines = [
    age ? `Age: ${age}` : '',
    `Weight: ${userProfile.weight || 70} kg`,
    userProfile.hrMax ? `Max HR: ${userProfile.hrMax} bpm` : '',
    `Units: ${userProfile.unit || 'metric'}`,
  ].filter(Boolean).join(', ');

  const qaLines = followUpQAs.map((q) => `- ${q.question}: ${q.answer}`).join('\n');

  const deadlineInstruction = hasDeadline
    ? `Deadline: ${deadline}`
    : `Deadline: Not specified — choose an appropriate timeline (8–20 weeks) based on goal difficulty and athlete fitness. Include "suggestedDeadline" (YYYY-MM-DD) in your JSON response.`;

  const scope = testMode
    ? 'Generate ONLY 7 days of sessions (one test week). Keep all descriptions to one sentence maximum. Include 1 milestone only.'
    : 'Generate a complete plan from start date to the deadline. Include at least one milestone every 3–4 weeks.';

  const userContent = `Goal: ${goalDesc}
${deadlineInstruction}
Plan start date: ${startDate}
Athlete profile: ${profileLines}

Benchmark data:
${benchmarkSummary}

Training preferences:
${qaLines}

${scope}

Rules (ALL models must follow exactly):
- Sessions must have exact dates in YYYY-MM-DD format
- pace values are seconds per km (e.g. 420 = 7:00/km), distance in meters
- type must be one of: zone2, easy, tempo, interval, long_run, rest, race_sim
- Include rest days as type "rest"
- Respect athlete's available days and weekly frequency from their answers
- Progress volume gradually (max 10% per week)

You MUST respond with ONLY a valid JSON object matching this exact schema — no text before or after, no markdown:
{
  "currentConditionSummary": "string",
  "approachSummary": "string",${!hasDeadline ? `
  "suggestedDeadline": "YYYY-MM-DD",` : ''}
  "sessions": [
    {
      "id": "s1",
      "date": "YYYY-MM-DD",
      "week": 1,
      "type": "zone2|easy|tempo|interval|long_run|rest|race_sim",
      "title": "string",
      "description": "string",
      "targets": { "distance": 5000, "paceMin": 390, "paceMax": 420, "zone": 2, "duration": null }
    }
  ],
  "milestones": [
    { "id": "m1", "week": 4, "date": "YYYY-MM-DD", "title": "string", "description": "string" }
  ]
}`;

  const { text, inputTokens, outputTokens } = await callClaude(
    apiKey, userContent,
    'You are an expert running coach. Respond ONLY with a valid JSON object. No markdown, no explanation, no text outside the JSON.',
    testMode ? 2000 : 32000, modelKey
  );

  const parsed = parseJSON(text);

  parsed.id             = `plan-${Date.now()}`;
  parsed.createdAt      = new Date().toISOString();
  parsed.startDate      = startDate;
  parsed.status         = 'active';
  parsed.lastStravaSync = null;
  parsed.adjustmentHistory = [];
  parsed.followUpQuestions = followUpQAs;
  parsed._generation = {
    inputTokens,
    outputTokens,
    modelKey,
    modelLabel: MODELS[modelKey]?.label ?? modelKey,
    testMode,
    estimatedCostUSD: estimateCost(inputTokens, outputTokens, modelKey),
  };

  parsed.sessions = (parsed.sessions || []).map((s, i) => ({
    ...s,
    id: s.id || `s${i + 1}`,
    resultActivityId: null,
    aiAnalysis: null,
    analysisStatus: null,
  }));

  parsed.milestones = (parsed.milestones || []).map((m, i) => ({
    ...m,
    id: m.id || `m${i + 1}`,
    achieved: false,
  }));

  return parsed;
}

// ── Analyse a completed run ───────────────────────────────────────────────────
export async function analyzeRunResult(apiKey, session, activity, goal, testMode = false, modelKey = 'opus') {
  const goalDesc = formatGoalForPrompt(goal);
  const targetPaceRange = session.targets.paceMin && session.targets.paceMax
    ? `${fmtPace(session.targets.paceMin)} – ${fmtPace(session.targets.paceMax)}`
    : session.targets.paceMax ? `slower than ${fmtPace(session.targets.paceMax)}` : 'no pace target';
  const hrZoneDesc = activity.hrZones
    ? `Z1:${activity.hrZones[0]}% Z2:${activity.hrZones[1]}% Z3:${activity.hrZones[2]}% Z4:${activity.hrZones[3]}% Z5:${activity.hrZones[4] || 0}%`
    : 'HR data not available';

  const depthInstruction = testMode
    ? 'Write exactly 1 short sentence of feedback.'
    : `Write 2-3 paragraphs covering: (1) adherence to plan, (2) what went well / needs work, (3) impact on goal progress. Be specific and encouraging.`;

  const userContent = `Planned session: "${session.title}" (${session.type})
Targets: ${fmtDistance(session.targets.distance)} · Zone ${session.targets.zone || 'any'} · Pace ${targetPaceRange}
Actual: distance ${fmtDistance(activity.distance)}, pace ${fmtPace(activity.avgPace)}, avg HR ${activity.avgHR ?? 'N/A'} bpm
HR zones: ${hrZoneDesc}
Goal: ${goalDesc}

${depthInstruction}`;

  const { text } = await callClaude(
    apiKey, userContent,
    'You are an expert running coach providing post-run analysis. Be specific, encouraging, and actionable.',
    testMode ? 200 : 8192, modelKey
  );
  return text;
}

// ── Adjust plan going forward ─────────────────────────────────────────────────
export async function adjustPlan(apiKey, plan, today, testMode = false, modelKey = 'opus') {
  const goal = plan.goalSnapshot;
  const goalDesc = formatGoalForPrompt(goal);
  const deadline = goal?.deadline
    ? new Date(goal.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'No fixed deadline';

  const completedSessions = plan.sessions.filter((s) => s.resultActivityId && new Date(s.date) < new Date(today));
  const missedSessions    = plan.sessions.filter((s) => !s.resultActivityId && s.type !== 'rest' && new Date(s.date) < new Date(today));

  const scope = testMode
    ? 'Generate ONLY 7 revised sessions. Keep descriptions to one sentence.'
    : 'Generate a revised plan from today to the deadline.';

  const userContent = `Goal: ${goalDesc}
Deadline: ${deadline}
Plan created: ${plan.createdAt?.slice(0, 10)}
Today: ${today}

Completed: ${completedSessions.length ? completedSessions.map((s) => `${s.date}: ${s.title}`).join(', ') : 'none'}
Missed: ${missedSessions.length ? missedSessions.map((s) => `${s.date}: ${s.title}`).join(', ') : 'none'}

${scope}
Adjust intensity based on actual progress. Don't try to make up all missed sessions at once.

You MUST respond with ONLY a valid JSON object — no text before or after, no markdown:
{
  "adjustmentNote": "string",
  "sessions": [{ "id": "string", "date": "YYYY-MM-DD", "week": 1, "type": "zone2|easy|tempo|interval|long_run|rest|race_sim", "title": "string", "description": "string", "targets": { "distance": 5000, "paceMin": 390, "paceMax": 420, "zone": 2, "duration": null } }],
  "milestones": [{ "id": "string", "week": 1, "date": "YYYY-MM-DD", "title": "string", "description": "string" }]
}`;

  const { text } = await callClaude(
    apiKey, userContent,
    'You are an expert running coach adjusting a training plan. Respond ONLY with a valid JSON object. No markdown, no explanation.',
    testMode ? 1500 : 32000, modelKey
  );
  return parseJSON(text);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatGoalForPrompt(goal) {
  if (!goal) return 'No goal set';
  if (goal.type === 'zone2_pace') {
    return `Run ${fmtDistance(goal.targetDistance || 5000)} in Zone 2 at ${fmtPace(goal.targetPace || 420)} pace`;
  }
  if (goal.type === 'race_pb') {
    const raceName = { half_marathon: 'Half Marathon', marathon: 'Marathon', '5k': '5K', '10k': '10K' }[goal.targetRace] || goal.targetRace;
    return goal.targetTime
      ? `${raceName} personal best — target time ${fmtDuration(goal.targetTime)}`
      : `${raceName} personal best`;
  }
  return JSON.stringify(goal);
}
