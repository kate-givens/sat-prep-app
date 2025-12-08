// src/services/questionBankService.js
import {
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { APP_ID } from '../config/constants';
import { generateSATQuestion } from './aiEngine';

// --- simple helper ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Free-tier safety: stay UNDER 5 requests per minute.
// We'll aim for 4 calls per minute.
const MAX_CALLS_PER_MINUTE = 4;
const WINDOW_MS = 60_000;

// Generate N questions for a given skill + difficulty and store them in questionBank
export const generateQuestionsToBank = async (
  db,
  skill,      // expects at least { skillId, name?, domainId? }
  difficulty, // 'Easy' | 'Medium' | 'Hard'
  count = 5
) => {
  if (!db || !skill || !skill.skillId) {
    throw new Error('DB or skill not provided');
  }

  const questionsRef = collection(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank'
  );

  const results = [];

  // --- rate-limiter state ---
  let windowStart = Date.now();
  let callsInWindow = 0;

  for (let i = 0; i < count; i++) {
    // Check if we're still in the same 60s window
    const now = Date.now();
    const elapsed = now - windowStart;

    if (elapsed >= WINDOW_MS) {
      // new window
      windowStart = now;
      callsInWindow = 0;
    }

    if (callsInWindow >= MAX_CALLS_PER_MINUTE) {
      // We've hit our safe max for this minute; wait until the window resets
      const waitMs = WINDOW_MS - elapsed;
      console.log(
        `Rate limit guard: waiting ${Math.ceil(waitMs / 1000)}s before next AI call`
      );
      await sleep(waitMs);
      windowStart = Date.now();
      callsInWindow = 0;
    }

    // === ONE AI CALL (likely Gemini) ===
    const q = await generateSATQuestion(skill.skillId, difficulty, db);
    callsInWindow += 1;

    const seedMeta = q.seedMeta || {};

    const docData = {
      skillId: skill.skillId,
      domainId: skill.domainId || null,
      difficulty,

      // basic structural tags (refine later if you want)
      subtype: seedMeta.subtype || 'generic',
      representation: 'verbal',
      itemStructureType:
        seedMeta.itemStructureType || `${skill.name} (${skill.skillId})`,

      passageText: q.passageText || '',
      questionText: q.questionText || '',
      options: q.options || [],
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',

      status: 'draft',
      source: 'ai_v1',
      seedId: seedMeta.seedId || null,
      createdAt: new Date(),
    };

    const docRef = await addDoc(questionsRef, docData);
    results.push({ id: docRef.id, ...docData });
  }

  return results;
};
