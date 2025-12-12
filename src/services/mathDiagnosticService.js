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
 * Finalize Stage 2 (either on submit or timeout).
 * Marks the diagnostic as completed and computes a simple summary.
 */
export async function finalizeStage2Diagnostic(db, userId, { timedOut = false } = {}) {
  if (!db || !userId) return;

  const diagRef = getMathDiagnosticRef(db, userId);
  const snapshot = await getDoc(diagRef);

  if (!snapshot.exists()) {
    throw new Error(`Math diagnostic not initialized for user ${userId}`);
  }

  const data = snapshot.data();
  const responses = Array.isArray(data.responses) ? data.responses : [];

  // Only look at Math / Stage2_* responses
  const stage2Responses = responses.filter(
    (r) => r.section === 'Math' && String(r.module || '').startsWith('Stage2_')
  );

  const totalQuestions = stage2Responses.length || 0;
  const totalCorrect = stage2Responses.filter((r) => r.isCorrect).length;
  const totalPointsEarned = stage2Responses.reduce((sum, r) => sum + (r.pointsEarned || 0), 0);
  const totalPointsPossible = stage2Responses.reduce(
    (sum, r) => sum + (r.pointsPossible || 0),
    0
  );

  const percentCorrect = totalQuestions
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  // Super simple “mastery” buckets for now; you can refine later
  let overallBand = 'Developing';
  if (percentCorrect >= 80) overallBand = 'Strong';
  else if (percentCorrect >= 60) overallBand = 'Proficient';

  await updateDoc(diagRef, {
    status: 'completed',
    currentModule: null,
    currentModuleStartedAt: null,
    currentModuleDurationSec: null,
    currentModuleExpiresAt: null,
    summary: {
      ...(data.summary || {}),
      stage2: {
        timedOut,
        completedAt: serverTimestamp(),
        totalQuestions,
        totalCorrect,
        totalPointsEarned,
        totalPointsPossible,
        percentCorrect,
        overallBand,
      },
    },
  });
}

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

  const status = moduleName === 'Routing' ? 'routing_in_progress' : 'stage2_in_progress';

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
  const moduleResponses = (responses || []).filter((r) => r.module === moduleName);
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
