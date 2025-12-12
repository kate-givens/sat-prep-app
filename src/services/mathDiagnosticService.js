// src/services/mathDiagnosticService.js
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { APP_ID } from '../config/constants.js';

// Helper to get the math diagnostic doc ref for a user
function getMathDiagnosticRef(db, userId) {
  return doc(db, 'artifacts', APP_ID, 'users', userId, 'diagnostics', 'math');
}

// Map route -> Stage 2 moduleId
export const MATH_STAGE2_MODULES = {
  Easy: 'Stage2_Easy',
  Medium: 'Stage2_Medium',
  Hard: 'Stage2_Hard',
};

/**
 * Start (or restart) a math module timer for a user.
 * - moduleName: "Routing" | "Stage2_Easy" | "Stage2_Medium" | "Stage2_Hard"
 * - durationSec: usually 20 * 60 (20 minutes)
 */
export async function startMathModule(db, userId, moduleName, durationSec = 20 * 60) {
  if (!db || !userId) return;

  const diagRef = getMathDiagnosticRef(db, userId);
  const snap = await getDoc(diagRef);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationSec * 1000);

  const status =
    moduleName === 'Routing' ? 'routing_in_progress' : 'stage2_in_progress';

  if (!snap.exists()) {
    // First time: create the diagnostic doc
    await setDoc(diagRef, {
      userId,
      status,
      currentModule: moduleName,
      currentModuleStartedAt: serverTimestamp(),
      currentModuleDurationSec: durationSec,
      currentModuleExpiresAt: expiresAt,
      stage2Route: null,
      stage2ModuleId: null,
      summary: null,
      responses: [],
    });
  } else {
    // Update module + timer, leave responses and summary alone
    await updateDoc(diagRef, {
      status,
      currentModule: moduleName,
      currentModuleStartedAt: serverTimestamp(),
      currentModuleDurationSec: durationSec,
      currentModuleExpiresAt: expiresAt,
    });
  }
}

/**
 * Score a Math response from a question + raw student selection.
 *
 * - question: a Math question from your bank
 * - answer: { questionId, selectedChoiceLabel, timeTakenMs? }
 *
 * Blanks (selectedChoiceLabel === null) simply get 0 points.
 */
export function scoreMathResponse(question, answer) {
  const isCorrect =
    answer.selectedChoiceLabel != null &&
    answer.selectedChoiceLabel === question.correctChoiceLabel;

  const pointsPossible = (question.scoring && question.scoring.points) || 1;
  const pointsEarned = isCorrect ? pointsPossible : 0;

  return {
    questionId: question.questionId,
    section: question.section, // "Math"
    module: question.module,   // "Routing" or "Stage2_*"
    slot: question.slot,
    skillId: question.skillId,
    seedId: question.seedId,
    difficulty: question.difficulty,
    domain: question.metadata?.domain ?? null,
    subdomain: question.metadata?.subdomain ?? null,
    blueprintSection: question.metadata?.blueprintSection ?? null,
    selectedChoiceLabel: answer.selectedChoiceLabel,  // may be null
    correctChoiceLabel: question.correctChoiceLabel,
    isCorrect,
    pointsEarned,
    pointsPossible,
    timeTakenMs: answer.timeTakenMs ?? null,
    answeredAt: new Date(),
  };
}

/**
 * Upsert a ScoredQuestionResponse into an array of responses.
 * If a response with the same questionId exists, replace it.
 */
function upsertResponse(existingResponses, newResponse) {
  const idx = existingResponses.findIndex(
    (r) => r.questionId === newResponse.questionId
  );
  if (idx === -1) {
    return [...existingResponses, newResponse];
  }
  const copy = [...existingResponses];
  copy[idx] = newResponse;
  return copy;
}

/**
 * Save (or overwrite) a student's answer for a question in the current diagnostic.
 */
export async function saveMathResponse(db, userId, scoredResponse) {
  if (!db || !userId) return;

  const diagRef = getMathDiagnosticRef(db, userId);
  const snapshot = await getDoc(diagRef);

  if (!snapshot.exists()) {
    throw new Error(`Math diagnostic not initialized for user ${userId}`);
  }

  const data = snapshot.data();
  const existing = Array.isArray(data.responses) ? data.responses : [];

  const newResponses = upsertResponse(existing, {
    ...scoredResponse,
    answeredAt: scoredResponse.answeredAt ?? new Date(),
  });

  await updateDoc(diagRef, {
    responses: newResponses,
  });
}

/**
 * Given the list of questionIds in a module and the current responses,
 * return questionIds that are either:
 * - missing entirely, OR
 * - present but selectedChoiceLabel === null
 *
 * Used for the "review" screen before submit.
 */
export function getUnansweredQuestions(moduleQuestionIds, responses, moduleName) {
  const moduleResponses = (responses || []).filter(
    (r) => r.module === moduleName
  );
  const byId = new Map();

  for (const r of moduleResponses) {
    byId.set(r.questionId, r);
  }

  const unanswered = [];

  for (const qid of moduleQuestionIds) {
    const r = byId.get(qid);
    if (!r || r.selectedChoiceLabel == null) {
      unanswered.push(qid);
    }
  }

  return unanswered;
}

/**
 * Compute routing destination from Routing-module Math responses.
 *
 * Blanks simply do not contribute to E_correct / M_correct / H_correct.
 *
 * Routing rules:
 * - Hard if H_correct ≥ 2 AND (M_correct + H_correct) ≥ 6
 * - Easy if T_correct ≤ 3
 * - Else Medium
 */
export function computeRoutingRoute(responses) {
  const routingResponses = (responses || []).filter(
    (r) => r.section === 'Math' && r.module === 'Routing'
  );

  let E_correct = 0;
  let M_correct = 0;
  let H_correct = 0;

  for (const r of routingResponses) {
    if (!r.isCorrect) continue;

    if (r.difficulty === 'Easy') E_correct += 1;
    else if (r.difficulty === 'Medium') M_correct += 1;
    else if (r.difficulty === 'Hard') H_correct += 1;
  }

  const T_correct = E_correct + M_correct + H_correct;
  const totalQuestions = routingResponses.length;

  const goesHard = H_correct >= 2 && (M_correct + H_correct) >= 6;
  const goesEasy = T_correct <= 3;

  let route = 'Medium';
  if (goesHard) route = 'Hard';
  else if (goesEasy) route = 'Easy';

  return {
    route, // "Easy" | "Medium" | "Hard"
    stats: {
      E_correct,
      M_correct,
      H_correct,
      T_correct,
      totalQuestions,
    },
  };
}

/**
 * Handle Routing module timeout (20 minutes expired).
 * - Compute route using normal thresholds (Hard allowed)
 * - Write route + Stage 2 module to the diagnostic doc
 */
export async function handleRoutingTimeout(db, userId) {
  if (!db || !userId) return { route: null, stage2ModuleId: null, stats: null };

  const diagRef = getMathDiagnosticRef(db, userId);
  const snapshot = await getDoc(diagRef);

  if (!snapshot.exists()) {
    throw new Error(`Math diagnostic not initialized for user ${userId}`);
  }

  const data = snapshot.data();
  const responses = Array.isArray(data.responses) ? data.responses : [];

  const { route, stats } = computeRoutingRoute(responses);
  const stage2ModuleId = MATH_STAGE2_MODULES[route];

  await updateDoc(diagRef, {
    status: 'routing_timed_out',
    stage2Route: route,
    stage2ModuleId,
    currentModule: null,
    currentModuleStartedAt: null,
    currentModuleDurationSec: null,
    currentModuleExpiresAt: null,
    summary: {
      ...(data.summary || {}),
      stage1Routing: {
        route,
        stage2ModuleId,
        stats,
        timedOut: true,
      },
    },
  });

  return { route, stage2ModuleId, stats };
}

/**
 * Handle Routing module manual submit (user clicks "Submit Routing").
 * - Compute route using normal thresholds
 * - Write route + Stage 2 module to the diagnostic doc
 */
export async function finalizeRoutingOnSubmit(db, userId) {
  if (!db || !userId) return { route: null, stage2ModuleId: null, stats: null };

  const diagRef = getMathDiagnosticRef(db, userId);
  const snapshot = await getDoc(diagRef);

  if (!snapshot.exists()) {
    throw new Error(`Math diagnostic not initialized for user ${userId}`);
  }

  const data = snapshot.data();
  const responses = Array.isArray(data.responses) ? data.responses : [];

  const { route, stats } = computeRoutingRoute(responses);
  const stage2ModuleId = MATH_STAGE2_MODULES[route];

  await updateDoc(diagRef, {
    status: 'routing_completed',
    stage2Route: route,
    stage2ModuleId,
    currentModule: null,
    currentModuleStartedAt: null,
    currentModuleDurationSec: null,
    currentModuleExpiresAt: null,
    summary: {
      ...(data.summary || {}),
      stage1Routing: {
        route,
        stage2ModuleId,
        stats,
        timedOut: false,
      },
    },
  });

  return { route, stage2ModuleId, stats };
}

// --- Mastery helpers ---
export const MASTERY_LEVELS = {
  MASTERY: 'Mastery',
  PROFICIENT: 'Proficient',
  DEVELOPING: 'Developing',
  NEEDS_HELP: 'Needs Help',
};

function levelFromAccuracy(acc) {
  if (acc >= 0.8) return MASTERY_LEVELS.MASTERY;
  if (acc >= 0.6) return MASTERY_LEVELS.PROFICIENT;
  if (acc >= 0.4) return MASTERY_LEVELS.DEVELOPING;
  return MASTERY_LEVELS.NEEDS_HELP;
}

function computeSkillStats(responses) {
  // responses already filtered to Math + answered questions
  const bySkill = new Map();

  for (const r of responses) {
    const skillId = r.skillId || 'UNKNOWN';
    if (!bySkill.has(skillId)) {
      bySkill.set(skillId, {
        correct: 0,
        total: 0,
        pointsEarned: 0,
        pointsPossible: 0,
      });
    }
    const s = bySkill.get(skillId);
    s.total += 1;
    s.correct += r.isCorrect ? 1 : 0;
    s.pointsEarned += r.pointsEarned ?? 0;
    s.pointsPossible += r.pointsPossible ?? 1;
  }

  const stats = [];
  for (const [skillId, s] of bySkill.entries()) {
    const acc = s.total > 0 ? s.correct / s.total : 0;
    const ptsAcc = s.pointsPossible > 0 ? s.pointsEarned / s.pointsPossible : acc;

    stats.push({
      skillId,
      correct: s.correct,
      total: s.total,
      accuracy: Number(acc.toFixed(3)),
      pointsAccuracy: Number(ptsAcc.toFixed(3)),
      masteryLevel: levelFromAccuracy(ptsAcc),
    });
  }

  // weakest first
  stats.sort((a, b) => a.pointsAccuracy - b.pointsAccuracy);
  return stats;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function difficultyWeight(d) {
  if (d === 'Hard') return 1.8;
  if (d === 'Medium') return 1.4;
  return 1.0; // Easy
}

// returns integer 5–95, capped, never 0 or 100
function seededMasteryPercent(
  skillResponses,
  { priorMean = 0.70, priorStrength = 4 } = {}
) {
  let wTotal = 0;
  let wCorrect = 0;

  for (const r of skillResponses) {
    if (r.selectedChoiceLabel == null) continue; // ignore unanswered here
    const w = difficultyWeight(r.difficulty);
    wTotal += w;
    if (r.isCorrect) wCorrect += w;
  }

  // If no answered items for this skill, start at a reasonable baseline
  if (wTotal === 0) return 50;

  const p = (wCorrect + priorStrength * priorMean) / (wTotal + priorStrength);
  const pct = Math.round(p * 100);

  // don’t start at 0 or 100
  return clamp(pct, 5, 95);
}

/**
 * Finalize Stage 2:
 * - marks diagnostic completed
 * - computes mastery by skill across ALL Math responses
 * - stores a recommended practice list (weakest skills first)
 * - seeds userProfile.skillMastery (0–100) + dailySkillId
 * - marks user as having taken the diagnostic
 */
export async function finalizeStage2AndComputeMastery(db, userId, stage2ModuleName) {
  if (!db || !userId) return null;

  const diagRef = getMathDiagnosticRef(db, userId);
  const snapshot = await getDoc(diagRef);

  if (!snapshot.exists()) {
    throw new Error(`Math diagnostic not initialized for user ${userId}`);
  }

  const data = snapshot.data();
  const responses = Array.isArray(data.responses) ? data.responses : [];

  // answered math only (blanks ignored for mastery seeding)
  const answeredMath = responses
    .filter((r) => r.section === 'Math')
    .filter((r) => r.selectedChoiceLabel != null);

  const skillStats = computeSkillStats(answeredMath);

  // v1 practice plan: take 6 weakest skills (or fewer)
  const recommendedSkills = skillStats
    .filter((s) => s.skillId !== 'UNKNOWN')
    .slice(0, 6)
    .map((s) => s.skillId);

  // diagnostic-level mastery map
  const masteryBySkillId = {};
  for (const s of skillStats) {
    masteryBySkillId[s.skillId] = {
      masteryLevel: s.masteryLevel,
      accuracy: s.pointsAccuracy,
      correct: s.correct,
      total: s.total,
      updatedAt: new Date(),
    };
  }

  // Group ALL math responses by skill (Routing + Stage 2)
  const allAnsweredMath = responses
    .filter((r) => r.section === 'Math')
    .filter((r) => r.selectedChoiceLabel != null);

  const bySkill = new Map();
  for (const r of allAnsweredMath) {
    const sid = r.skillId || 'UNKNOWN';
    if (!bySkill.has(sid)) bySkill.set(sid, []);
    bySkill.get(sid).push(r);
  }

  const skillMastery = {};
  for (const [skillId, skillResponses] of bySkill.entries()) {
    if (skillId === 'UNKNOWN') continue;
    skillMastery[skillId] = seededMasteryPercent(skillResponses, {
      priorMean: 0.70,
      priorStrength: 4,
    });
  }

  // Daily skill = lowest seeded mastery among computed skills
  const dailySkillId =
    Object.entries(skillMastery).sort((a, b) => a[1] - b[1])[0]?.[0] || null;

  // 1) Write diagnostic completion
  await updateDoc(diagRef, {
    status: 'completed',
    currentModule: null,
    currentModuleStartedAt: null,
    currentModuleDurationSec: null,
    currentModuleExpiresAt: null,
    masteryBySkillId,
    recommendedSkills,
    skillStats, // ✅ add this
    summary: {
      ...(data.summary || {}),
      stage2: { moduleName: stage2ModuleName, completedAt: new Date() },
      mastery: { skillCount: skillStats.length, recommendedSkills },
    },
  });
  

  // 2) Write into user profile for Dashboard / OverviewView
  // 2) Write into user profile for Dashboard / OverviewView
const userProfileRef = doc(
  db,
  'artifacts',
  APP_ID,
  'users',
  userId,
  'profile',
  'data'
);

await setDoc(
  userProfileRef,
  {
    skillMastery, // { [skillId]: percent }
    dailySkillId, // first skill for Daily 5
    diagnosticMathCompleted: true,
    diagnosticMathSummarySeen: false,
    lastDiagnosticAt: serverTimestamp(),
  },
  { merge: true }
);

  return {
    skillStats,
    masteryBySkillId,
    recommendedSkills,
    skillMastery,
    dailySkillId,
  };
}
