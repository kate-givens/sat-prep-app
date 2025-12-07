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
  
  // Generate N questions for a given skill + difficulty and store them in questionBank
  export const generateQuestionsToBank = async (
    db,
    skill,          // expects at least { skillId, name?, domainId? }
    difficulty,     // 'Easy' | 'Medium' | 'Hard'
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
  
    for (let i = 0; i < count; i++) {
      const q = await generateSATQuestion(skill.skillId, difficulty, db);
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
  
  // Fetch some draft questions for admin review
  export const fetchDraftQuestions = async (db, skillId, difficulty, count = 5) => {
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
  
  // Approve or reject a question
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
  