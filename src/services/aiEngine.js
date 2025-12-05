import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { ALL_SKILLS } from '../data/satData';
import { API_KEY, APP_ID } from '../config/constants';

export const generateSATQuestion = async (skillId, difficulty, db) => {
  const MODEL_NAME = 'gemini-2.5-flash';; // <--- Use a valid public model  
  const skillName = ALL_SKILLS.find((s) => s.skillId === skillId)?.name || skillId;

  // --- FETCH SEED DATA ---
  let seed = {
    context: 'Standard multiple choice question based on the specific skill.',
    distractorLogic:
      'Plausible but incorrect alternatives based on common misconceptions.',
    difficulty,
  };
  
  if (db) {
    try {
      const seedsRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'seedQuestions'
      );
  
      // Try skill + difficulty first
      let seedSnapshot = await getDocs(
        query(
          seedsRef,
          where('skillId', '==', skillId),
          where('difficulty', '==', difficulty)
        )
      );
  
      // If none, fall back to any seed for this skill
      if (seedSnapshot.empty) {
        seedSnapshot = await getDocs(
          query(seedsRef, where('skillId', '==', skillId))
        );
      }
  
      if (!seedSnapshot.empty) {
        const docs = seedSnapshot.docs;
        const randomDoc = docs[Math.floor(Math.random() * docs.length)];
        const seedData = randomDoc.data();
  
        seed = {
          context: seedData.context,
          distractorLogic: seedData.distractorLogic,
          difficulty: seedData.difficulty || difficulty,
        };
      }
    } catch (e) {
      console.error('Seed fetch error', e);
    }
  }
  

  const systemPrompt = `
  You are an expert SAT Item Writer.
  
  Create a UNIQUE, ${difficulty}-level question for: "${skillName}".
  
  You are given an instructor SEED PATTERN for this skill:
  
  - Seed difficulty: ${seed.difficulty || difficulty}
  - Seed context (scenario template):
    ${seed.context}
  - Seed distractor logic (types of errors to target):
    ${seed.distractorLogic}
  
  Use the seed ONLY as a guide for:
  - the type of situation,
  - the mathematical / reading skill being tested,
  - the kinds of mistakes that wrong answers should represent.
  
  IMPORTANT CONSTRAINTS:
  - DO NOT reuse sentences, phrases, or names from the seed.
  - DO NOT reuse the same numbers from the seed.
  - Create a completely NEW scenario (new names, new surface details),
    while testing the SAME underlying skill and misconception patterns.
  - The question must feel like a real Digital SAT item in difficulty and style
    (not AP, not GRE, not trivial).
  
  REQUIREMENTS:
  1. Options: 4 options (A, B, C, D).
  2. Answer: Identify the Correct Answer by EXACT TEXT match to one of the options.
  3. Explanation: Full, step-by-step, understandable to a typical SAT student.
  
  FORMATTING RULES:
  - MATH: Use LaTeX for mathematical expressions ONLY, inside single dollar signs (e.g., $3x - 5 = 10$).
  - TEXT: Do NOT put English sentences inside dollar signs.
  - NEWLINES: Use "\\n" to separate steps in the explanation.
  - BOLD: Use **double asterisks** for bolding.
  
  OUTPUT JSON:
  {
    "passageText": "Optional passage text...",
    "questionText": "The question stem...",
    "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
    "correctOptionText": "Exact text of correct option",
    "explanation": "Explanation here..."
  }
  `;
  

  const fetchWithRetry = async (attempt = 1) => {
    try {
      const url = '/api/gemini-generate';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt <= 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return fetchWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  try {
    const data = await fetchWithRetry();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('No text generated from API');

    generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();

    const tryParse = (text) => {
      try { return JSON.parse(text); } catch { return null; }
    };

    let parsedData = tryParse(generatedText);
    if (!parsedData) {
      const repaired = generatedText
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
      parsedData = tryParse(repaired);
    }

    if (!parsedData) throw new Error('Failed to parse AI JSON from model');

    if (!parsedData.options || !Array.isArray(parsedData.options)) {
      throw new Error('Missing options in AI response');
    }

    parsedData.options = parsedData.options.map(String);
    const normalize = (str) => str ? str.replace(/\$|\s/g, '').toLowerCase() : '';
    const correctText = parsedData.correctOptionText || '';

    let correctIndex = parsedData.options.findIndex(
      (opt) => normalize(opt) === normalize(correctText)
    );

    if (correctIndex === -1) {
      correctIndex = parsedData.options.findIndex(
        (opt) =>
          normalize(opt).includes(normalize(correctText)) ||
          normalize(correctText).includes(normalize(opt))
      );
    }

    if (correctIndex === -1) correctIndex = 0;

    return { ...parsedData, correctAnswer: String.fromCharCode(65 + correctIndex) };
  } catch (error) {
    console.error('AI Generation Error:', error);
    return {
      questionText: `(Offline Mode) Error: ${error.message}`,
      options: ['Retry', 'Skip', 'Error', 'Contact Support'],
      correctAnswer: 'A',
      explanation: 'Please try again.',
    };
  }
};