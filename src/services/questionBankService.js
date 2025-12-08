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
  getCountFromServer,
} from 'firebase/firestore';
import { APP_ID } from '../config/constants';
import { generateSATQuestion } from './aiEngine';

// --- simple helper ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate N questions for a given skill + difficulty and store them in questionBank
 * Uses a fixed delay between AI calls to avoid 429 rate-limit errors.
 */
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

  // ONE AI CALL every 20 seconds → ~3 calls/minute (under 5 RPM free limit)
  const PER_CALL_DELAY_MS = 20_000;

  for (let i = 0; i < count; i++) {
    // === ONE AI CALL (Gemini via generateSATQuestion) ===
    const q = await generateSATQuestion(skill.skillId, difficulty, db);

    const seedMeta = q.seedMeta || {};

    const docData = {
      skillId: skill.skillId,
      domainId: skill.domainId || null,
      difficulty,
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

    // 👇 wait before the next AI call so we don't trigger 429
    if (i < count - 1) {
      await sleep(PER_CALL_DELAY_MS);
    }
  }

  return results;
};

/**
 * Fetch some draft questions for admin review
 */
export const fetchDraftQuestions = async (
  db,
  skillId,
  difficulty,
  count = 5
) => {
  if (!db) return [];

  const questionsRef = collection(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank'
  );

  const q = query(
    questionsRef,
    where('skillId', '==', skillId),
    where('difficulty', '==', difficulty),
    where('status', '==', 'draft'),
    limit(count)
  );

  const snap = await getDocs(q);
  if (snap.empty) return [];

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Approve or reject a question
 */
export const setQuestionStatus = async (db, questionId, status) => {
  if (!db) return;

  const questionRef = doc(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank',
    questionId
  );

  await updateDoc(questionRef, { status });
};

/**
 * Fetch questions for practice (approved only), with difficulty fallback logic
 */
export const fetchPracticeQuestions = async (
  db,
  skillId,
  targetDifficulty,
  count = 5
) => {
  if (!db || !skillId) return [];

  const questionsRef = collection(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank'
  );

  // Difficulty preference order: lean on Medium
  let difficultyOrder;
  if (targetDifficulty === 'Medium') {
    difficultyOrder = ['Medium', 'Hard', 'Easy'];
  } else if (targetDifficulty === 'Easy') {
    difficultyOrder = ['Easy', 'Medium', 'Hard'];
  } else {
    // Hard
    difficultyOrder = ['Hard', 'Medium', 'Easy'];
  }

  const byId = new Map();

  for (const diff of difficultyOrder) {
    if (byId.size >= count) break;

    const q = query(
      questionsRef,
      where('skillId', '==', skillId),
      where('difficulty', '==', diff),
      where('status', '==', 'approved'),
      // grab a bit more than we need so we can shuffle
      limit(count * 2)
    );

    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      if (byId.size < count && !byId.has(docSnap.id)) {
        byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      }
    });
  }

  const results = Array.from(byId.values());

  // Simple shuffle for variety
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }

  // Return at most `count` questions
  return results.slice(0, count);
};

/**
 * Get counts of approved + draft questions per skill
 */
export const fetchQuestionCountsBySkill = async (db, skills) => {
  if (!db || !skills || !skills.length) return [];

  const questionsRef = collection(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank'
  );

  const results = [];

  for (const skill of skills) {
    const base = { skillId: skill.skillId, name: skill.name || skill.skillId };

    // draft
    const draftQuery = query(
      questionsRef,
      where('skillId', '==', skill.skillId),
      where('status', '==', 'draft')
    );
    const draftSnap = await getCountFromServer(draftQuery);
    const draftCount = draftSnap.data().count || 0;

    // approved
    const approvedQuery = query(
      questionsRef,
      where('skillId', '==', skill.skillId),
      where('status', '==', 'approved')
    );
    const approvedSnap = await getCountFromServer(approvedQuery);
    const approvedCount = approvedSnap.data().count || 0;

    results.push({
      ...base,
      draftCount,
      approvedCount,
      totalCount: draftCount + approvedCount,
    });
  }

  return results;
};
