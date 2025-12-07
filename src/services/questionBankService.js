import { collection, addDoc } from 'firebase/firestore';
import { APP_ID } from '../config/constants';
import { generateSATQuestion } from './aiEngine';

// Generate N questions for a given skill + difficulty and store them in questionBank
export const generateQuestionsToBank = async (
  db,
  skill,           // SKILLS entry or at least { skillId, domainId?, name? }
  difficulty,      // 'Easy' | 'Medium' | 'Hard'
  count = 5
) => {
  if (!db || !skill?.skillId) {
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

  for (let i = 0; i < count; i++) {
    // 1) Generate one question via AI
    const q = await generateSATQuestion(skill.skillId, difficulty, db);

    // 2) Build the document we want to store
    const seedMeta = q.seedMeta || {};

    const docData = {
      skillId: skill.skillId,
      domainId: skill.domainId || null,
      difficulty,

      // basic structural tags (you can refine later)
      subtype: seedMeta.subtype || 'generic',
      representation: 'verbal', // for WIC or most RW; adjust for math later
      itemStructureType:
        seedMeta.itemStructureType || `${skill.name} (${skill.skillId})`,

      passageText: q.passageText || '',
      questionText: q.questionText || '',
      options: q.options || [],
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',

      status: 'draft',       // start as draft, you’ll review/approve later
      source: 'ai_v1',
      seedId: seedMeta.seedId || null,
      createdAt: new Date(),
    };

    // 3) Save to Firestore
    const docRef = await addDoc(questionsRef, docData);

    results.push({ id: docRef.id, ...docData });
  }

  return results; // for logging / debugging in Admin
};
