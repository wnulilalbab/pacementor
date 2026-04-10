import { fmtPace, fmtDistance, fmtDuration } from './formatters';
import { getActivity } from './storage';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-6';

// Pricing per million tokens (claude-opus-4-6)
const PRICE_INPUT_PER_M  = 15;   // $15 / 1M input tokens
const PRICE_OUTPUT_PER_M = 75;   // $75 / 1M output tokens

export function estimateCost(inputTokens, outputTokens) {
  return (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) / 1_000_000;
}

// ── Core API call ─────────────────────────────────────────────────────────────
// Returns { text, inputTokens, outputTokens }
async function callClaude(apiKey, userContent, systemPrompt, maxTokens = 8192) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
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

  return { text, inputTokens, outputTokens };
}

// ── Parse JSON robustly (handles markdown code fences) ─────────────────────
function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error(`Failed to parse AI response: ${e.message}`);
    err.rawResponse = text;
    throw err;
  }
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

  const lines = [
    `Benchmark runs: ${activities.length} run(s) analysed`,
    `Total distance covered: ${fmtDistance(totalDist)}`,
    `Longest run: ${fmtDistance(maxDist)}`,
    z2Pace ? `Estimated Zone 2 pace: ${fmtPace(z2Pace)}` : 'Zone 2 pace: insufficient data',
    effortPace ? `Estimated effort/threshold pace: ${fmtPace(effortPace)}` : '',
    avgHR ? `Average HR across benchmarks: ${avgHR} bpm` : '',
    `Recent weekly volume estimate: ~${avgWeeklyDist} km`,
  ].filter(Boolean);

  return lines.join('\n');
}

// ── Generate follow-up questions ──────────────────────────────────────────────
export async function generateFollowUpQuestions(apiKey, goal, benchmarkIds) {
  const benchmarkSummary = summariseBenchmarks(benchmarkIds);
  const goalDesc = formatGoalForPrompt(goal);

  const userContent = `Goal: ${goalDesc}

Benchmark data:
${benchmarkSummary}

Generate 6-8 targeted follow-up questions to personalise a running coaching plan for this athlete.
Focus on: training availability, current fitness context, lifestyle constraints, injury history, motivation.

Respond ONLY with a JSON array in this exact format:
[
  {"id": "q1", "question": "How many days per week can you train?", "type": "number", "min": 1, "max": 7},
  {"id": "q2", "question": "Which days are you typically available?", "type": "multiselect", "options": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]},
  {"id": "q3", "question": "How would you describe your running experience?", "type": "select", "options": ["Beginner (< 1 year)", "Intermediate (1–3 years)", "Experienced (3+ years)"]},
  ...
]
Allowed types: "number", "text", "select", "multiselect"`;

  const { text } = await callClaude(
    apiKey,
    userContent,
    'You are an expert running coach. Respond only with valid JSON.'
  );
  return parseJSON(text);
}

// ── Generate full coaching plan ───────────────────────────────────────────────
export async function generateCoachingPlan(apiKey, goal, benchmarkIds, followUpQAs, userProfile, startDate) {
  const benchmarkSummary = summariseBenchmarks(benchmarkIds);
  const goalDesc = formatGoalForPrompt(goal);
  const hasDeadline = !!goal.deadline;
  const deadline = hasDeadline
    ? new Date(goal.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const age = userProfile.birthYear
    ? new Date().getFullYear() - Number(userProfile.birthYear)
    : null;

  const profileLines = [
    age ? `Age: ${age}` : '',
    `Weight: ${userProfile.weight || 70} kg`,
    userProfile.hrMax ? `Max HR: ${userProfile.hrMax} bpm` : '',
    `Units: ${userProfile.unit || 'metric'}`,
  ].filter(Boolean).join(', ');

  const qaLines = followUpQAs.map((q) => `- ${q.question}: ${q.answer}`).join('\n');

  const schema = `{
  "currentConditionSummary": "2-3 sentence assessment of athlete's current fitness",
  "approachSummary": "2-3 sentence explanation of the training approach to reach the goal",${!hasDeadline ? `
  "suggestedDeadline": "YYYY-MM-DD (the end date of the plan you have chosen)",` : ''}
  "sessions": [
    {
      "id": "s1",
      "date": "YYYY-MM-DD",
      "week": 1,
      "type": "zone2|easy|tempo|interval|long_run|rest|race_sim",
      "title": "Short title",
      "description": "What to do and why",
      "targets": {
        "distance": 5000,
        "paceMin": 390,
        "paceMax": 420,
        "zone": 2,
        "duration": null
      }
    }
  ],
  "milestones": [
    {
      "id": "m1",
      "week": 4,
      "date": "YYYY-MM-DD",
      "title": "First milestone title",
      "description": "What to assess at this point"
    }
  ]
}`;

  const deadlineInstruction = hasDeadline
    ? `Deadline: ${deadline}`
    : `Deadline: Not specified — choose an appropriate timeline (8–20 weeks) based on the goal difficulty and the athlete's current fitness. Return your chosen end date as "suggestedDeadline" (YYYY-MM-DD) in the JSON.`;

  const userContent = `Goal: ${goalDesc}
${deadlineInstruction}
Plan start date: ${startDate}

Athlete profile: ${profileLines}

Benchmark data:
${benchmarkSummary}

Training preferences from athlete:
${qaLines}

Generate a complete personalised running coaching plan from ${startDate} to the deadline.
Rules:
- Include ONLY running sessions and rest days (no cross-training unless asked)
- Respect the athlete's available days and frequency from their answers
- Progress volume and intensity gradually (no more than 10% increase per week)
- Include at least one milestone every 3-4 weeks
- Sessions must have exact dates in YYYY-MM-DD format
- pace values are seconds per km (e.g. 420 = 7:00/km), distance in meters
- Include rest days as type "rest" with minimal targets

Respond ONLY with valid JSON matching this schema:
${schema}`;

  // Plan generation can be large (many sessions) — use max output tokens
  const { text, inputTokens, outputTokens } = await callClaude(
    apiKey,
    userContent,
    'You are an expert running coach. Respond only with valid JSON. Do not include any explanation outside the JSON.',
    32000
  );

  const parsed = parseJSON(text);

  // Validate and add missing fields
  parsed.id = `plan-${Date.now()}`;
  parsed.createdAt = new Date().toISOString();
  parsed.startDate = startDate;
  parsed.status = 'active';
  parsed.lastStravaSync = null;
  parsed.adjustmentHistory = [];
  parsed.followUpQuestions = followUpQAs;

  // Attach token usage so UI can display cost
  parsed._generation = {
    inputTokens,
    outputTokens,
    estimatedCostUSD: estimateCost(inputTokens, outputTokens),
  };

  // Ensure session IDs and analysisStatus
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
export async function analyzeRunResult(apiKey, session, activity, goal) {
  const goalDesc = formatGoalForPrompt(goal);
  const targetPaceRange = session.targets.paceMin && session.targets.paceMax
    ? `${fmtPace(session.targets.paceMin)} – ${fmtPace(session.targets.paceMax)}`
    : session.targets.paceMax ? `slower than ${fmtPace(session.targets.paceMax)}` : 'no pace target';

  const hrZoneDesc = activity.hrZones
    ? `Z1:${activity.hrZones[0]}% Z2:${activity.hrZones[1]}% Z3:${activity.hrZones[2]}% Z4:${activity.hrZones[3]}% Z5:${activity.hrZones[4] || 0}%`
    : 'HR data not available';

  const userContent = `Planned session: "${session.title}" (${session.type})
Description: ${session.description}
Targets: ${fmtDistance(session.targets.distance)} · Zone ${session.targets.zone || 'any'} · Pace ${targetPaceRange}

Actual result:
- Distance: ${fmtDistance(activity.distance)}
- Moving time: ${fmtDuration(activity.movingTime)}
- Average pace: ${fmtPace(activity.avgPace)}
- Average HR: ${activity.avgHR ? `${activity.avgHR} bpm` : 'N/A'}
- Max HR: ${activity.maxHR ? `${activity.maxHR} bpm` : 'N/A'}
- HR zone distribution: ${hrZoneDesc}
- Elevation gain: ${activity.elevationGain ?? 0}m

Overall goal: ${goalDesc}

Provide a focused 2-3 paragraph coaching analysis:
1. How well did this session adhere to the plan?
2. What went well and what needs attention?
3. How does this impact progress toward the goal?

Be specific, data-driven, and encouraging.`;

  const { text } = await callClaude(
    apiKey,
    userContent,
    'You are an expert running coach providing post-run analysis. Be specific, encouraging, and actionable.'
  );
  return text;
}

// ── Adjust plan going forward ─────────────────────────────────────────────────
export async function adjustPlan(apiKey, plan, today) {
  const goal = plan.goalSnapshot;
  const goalDesc = formatGoalForPrompt(goal);
  const deadline = goal.deadline
    ? new Date(goal.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'No fixed deadline';

  const completedSessions = plan.sessions.filter(
    (s) => s.resultActivityId && new Date(s.date) < new Date(today)
  );
  const missedSessions = plan.sessions.filter(
    (s) => !s.resultActivityId && s.type !== 'rest' && new Date(s.date) < new Date(today)
  );

  const completedSummary = completedSessions.length
    ? completedSessions.map((s) => `${s.date}: ${s.title} (${s.type})`).join('\n')
    : 'None completed yet';

  const missedSummary = missedSessions.length
    ? missedSessions.map((s) => `${s.date}: ${s.title} (${s.type})`).join('\n')
    : 'None missed';

  const userContent = `Goal: ${goalDesc}
Deadline: ${deadline}
Plan created: ${plan.createdAt?.slice(0, 10)}
Today: ${today}

Completed sessions:
${completedSummary}

Missed/skipped sessions:
${missedSummary}

The athlete needs a revised training plan from ${today} to the deadline.
Adjust intensity and volume based on actual progress.
If behind, be realistic — don't try to make up all missed sessions at once.

Respond ONLY with valid JSON:
{
  "adjustmentNote": "1-2 sentence explanation of the adjustment rationale",
  "sessions": [ ...same session schema as original plan... ],
  "milestones": [ ...same milestone schema... ]
}`;

  const { text } = await callClaude(
    apiKey,
    userContent,
    'You are an expert running coach adjusting a training plan. Respond only with valid JSON.'
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
