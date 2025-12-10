// src/services/questionBankService.js
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  orderBy,
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
export const setQuestionStatus = async (db, id, status) => {
  const ref = doc(
    db,
    'artifacts',
    APP_ID,
    'public',
    'data',
    'questionBank',
    id
  );

  await updateDoc(ref, {
    status,
    // Clear flag unless we’re explicitly setting to 'flagged'
    flagged: status === 'flagged',
    updatedAt: new Date(),
  });
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
export const fetchQuestionCountsBySkill = async (db, skills = []) => {
  const snap = await getDocs(
    collection(db, 'artifacts', APP_ID, 'public', 'data', 'questionBank')
  );

  const countsBySkill = new Map();

  const initSkillEntry = (skillId) => ({
    skillId,
    totalCount: 0,
    difficultyStatusBreakdown: {
      Easy:   { total: 0, approved: 0, draft: 0, other: 0 },
      Medium: { total: 0, approved: 0, draft: 0, other: 0 },
      Hard:   { total: 0, approved: 0, draft: 0, other: 0 },
    },
  });

  const ensureSkillEntry = (skillId) => {
    if (!countsBySkill.has(skillId)) {
      countsBySkill.set(skillId, initSkillEntry(skillId));
    }
    return countsBySkill.get(skillId);
  };

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const skillId = data.skillId || 'UNKNOWN';
    const difficulty = data.difficulty || 'Medium';
    const status = data.status || 'draft';

    const entry = ensureSkillEntry(skillId);
    entry.totalCount += 1;

    // Normalize difficulty to one of the three buckets
    const diffKey =
      difficulty === 'Easy' || difficulty === 'Hard' ? difficulty : 'Medium';

    const bucket = entry.difficultyStatusBreakdown[diffKey];

    bucket.total += 1;
    if (status === 'approved') bucket.approved += 1;
    else if (status === 'draft') bucket.draft += 1;
    else bucket.other += 1; // rejected, archived, etc.
  });

  // Make sure every SKILL shows up even if count is 0
  skills.forEach((s) => {
    if (!countsBySkill.has(s.skillId)) {
      countsBySkill.set(s.skillId, initSkillEntry(s.skillId));
    }
  });

  return Array.from(countsBySkill.values());
}; 
  export const fetchFlaggedQuestions = async (db, limitCount = 20) => {
    const colRef = collection(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      'questionBank'
    );
  
    const q = query(
      colRef,
      where('flagged', '==', true),
      orderBy('flaggedAt', 'desc'),
      limit(limitCount)
    );
  
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  };
  export const updateQuestionFields = async (db, id, updates) => {
    const ref = doc(
      db,
      'artifacts',
      APP_ID,
      'public',
      'data',
      'questionBank',
      id
    );
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date(),
    });
  };