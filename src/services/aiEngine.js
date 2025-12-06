import { collection, query, where, getDocs } from 'firebase/firestore';
import { ALL_SKILLS } from '../data/satData';
import { APP_ID } from '../config/constants';

// Main export: generate one SAT question using Gemini + Firestore seed
export const generateSATQuestion = async (skillId, difficulty, db) => {
  const MODEL_NAME = 'gemini-2.5-flash'; // name is mostly for reference
  const skillName =
    ALL_SKILLS.find((s) => s.skillId === skillId)?.name || skillId;

  // -----------------------------
  // 1. Fetch a seed from Firestore
  // -----------------------------
  let seed = null;

  if (db) {
    try {
      const seedsRef = collection(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'seedQuestions'
      );

      // Prefer exact skill + difficulty match
      let seedQuery = query(
        seedsRef,
        where('skillId', '==', skillId),
        where('difficulty', '==', difficulty)
      );

      let snap = await getDocs(seedQuery);

      // If nothing for that difficulty, fall back to any seed for this skill
      if (snap.empty) {
        seedQuery = query(seedsRef, where('skillId', '==', skillId));
        snap = await getDocs(seedQuery);
      }

      if (!snap.empty) {
        const docs = snap.docs;
        const randomDoc = docs[Math.floor(Math.random() * docs.length)];
        seed = randomDoc.data(); // whatever you stored (seedId, subtype, etc.)
      }
    } catch (e) {
      console.error('Error fetching seed:', e);
    }
  }

  // -----------------------------
  // 2. Build an effective seed (fallback if none)
  // -----------------------------
  const effectiveSeed = seed || {
    seedId: 'default',
    subtype: 'generic_wic',
    skillId,
    itemStructureType: 'Words in Context',
    difficulty,
    contextTemplate:
      'A short SAT-style passage where a target word has a context-dependent abstract meaning.',
    correctAnswerLogic:
      'Student selects the meaning that best matches how the word is used in this particular context.',
    distractorLogic: [
      'Literal meaning that ignores context',
      'Tone-consistent but incorrect meaning',
      'Meaning that is too broad or vague',
    ],
    aiGenerationConstraints: [
      'Do not reuse any wording from previous examples.',
      'Keep difficulty aligned with the specified level.',
      'Use neutral, SAT-appropriate academic tone.',
    ],
  };

  // Make sure the array fields exist so the .map calls don’t explode
  const effectiveDistractors = Array.isArray(effectiveSeed.distractorLogic)
    ? effectiveSeed.distractorLogic
    : [];
  const effectiveConstraints = Array.isArray(
    effectiveSeed.aiGenerationConstraints
  )
    ? effectiveSeed.aiGenerationConstraints
    : [];

  // -----------------------------
  // 3. Construct the system prompt
  // -----------------------------
  const systemPrompt = `
You are an expert SAT item writer.

SKILL:
- ID: ${effectiveSeed.skillId}
- Name: ${skillName}

ITEM STRUCTURE TYPE:
${effectiveSeed.itemStructureType}

STRUCTURAL SUBTYPE:
${effectiveSeed.subtype || 'unspecified_subtype'}

TARGET DIFFICULTY: ${difficulty}

You are given a SEED PATTERN. Use it ONLY as a blueprint for structure and
cognitive demand. Do NOT copy wording, names, or specific details.

1) CONTEXT TEMPLATE (STRUCTURE ONLY)
${effectiveSeed.contextTemplate}

2) CORRECT ANSWER LOGIC (ABSTRACT)
${effectiveSeed.correctAnswerLogic}

3) DISTRACTOR LOGIC (CATEGORIES)
${effectiveDistractors
  .map((d, i) => `- D${i + 1}: ${d}`)
  .join('\n')}

4) GENERATION CONSTRAINTS
${effectiveConstraints
  .map((c, i) => `- C${i + 1}: ${c}`)
  .join('\n')}

TASK:
Using ONLY the abstract pattern above, write ONE brand-new Digital SAT
"${effectiveSeed.itemStructureType}" question at ${difficulty} difficulty.

REQUIREMENTS:
- Create a NEW passage and scenario that fit the pattern.
- Do NOT reuse any proper nouns, specific events, sentences, or phrasings from the seed.
- Use SAT-appropriate style: neutral, concise, and clear.
- Test ONLY this skill and this item structure subtype.
- The question must be solvable purely from the passage context.

OUTPUT FORMAT (CRITICAL):
Return a single JSON object with the following shape:

{
  "passageText": "Full passage text here (optional but recommended).",
  "questionText": "The question stem here...",
  "options": ["Choice A text", "Choice B text", "Choice C text", "Choice D text"],
  "correctOptionText": "Exact text of the correct option (matching one of the options strings)",
  "explanation": "Step-by-step explanation for why this option is correct and why others are not."
}

RULES:
- MATH: If any math appears, use LaTeX in $...$ only for expressions.
- TEXT: Do NOT wrap normal English sentences in $...$.
- EXPLANATION: Use "\\n" to separate steps.
`;

  // -----------------------------
  // 4. Call your Vercel Gemini proxy with retry
  // -----------------------------
  const fetchWithRetry = async (attempt = 1) => {
    try {
      const response = await fetch('/api/gemini-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_NAME,
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            topP: 0.9,
          },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return fetchWithRetry(attempt + 1);
      }
      throw err;
    }
  };

  // -----------------------------
  // 5. Parse response + map correct answer
  // -----------------------------
  try {
    const data = await fetchWithRetry();

    let generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedText) {
      throw new Error('No text generated from API');
    }

    // Strip code fences like ```json ... ```
    generatedText = generatedText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    };

    let parsedData = tryParse(generatedText);

    // Attempt a basic repair if the first parse fails
    if (!parsedData) {
      const repaired = generatedText
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
      parsedData = tryParse(repaired);
    }

    if (!parsedData) {
      throw new Error('Failed to parse AI JSON from model');
    }

    if (!parsedData.options || !Array.isArray(parsedData.options)) {
      throw new Error('Missing options in AI response');
    }

    // Normalize options to strings
    parsedData.options = parsedData.options.map(String);

    const normalize = (str) =>
      str ? str.replace(/\$|\s/g, '').toLowerCase() : '';

    const correctText = parsedData.correctOptionText || '';

    let correctIndex = parsedData.options.findIndex(
      (opt) => normalize(opt) === normalize(correctText)
    );

    // Fuzzy fallback
    if (correctIndex === -1) {
      correctIndex = parsedData.options.findIndex(
        (opt) =>
          normalize(opt).includes(normalize(correctText)) ||
          normalize(correctText).includes(normalize(opt))
      );
    }

    // Ultimate fallback if still -1
    if (correctIndex === -1) correctIndex = 0;

    return {
      ...parsedData,
      correctAnswer: String.fromCharCode(65 + correctIndex),
    };
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
