// src/services/questionBankService.js
import { collection, addDoc } from 'firebase/firestore';
import { APP_ID } from '../config/constants';
import { generateSATQuestion } from './aiEngine';

export const generateQuestionsToBank = async (
  db,
  skill,           // { skillId, domainId?, name? }
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
  }

  return results;
};
