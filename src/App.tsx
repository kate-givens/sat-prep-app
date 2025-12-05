import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import katex from 'katex';

// ==========================================
// 1. PASTE YOUR KEYS HERE (From Phase 1)
// ==========================================

const API_KEY = 'AIzaSyAcNLJlQKyTgmcmGpBmfYvI7SZffKKGeq8';

const firebaseConfig = {
  apiKey: 'AIzaSyBlieiF6VCLb5Ka6HNy6ts2hOimfomSlks',
  authDomain: 'sat-prep-app-2c27e.firebaseapp.com',
  projectId: 'sat-prep-app-2c27e',
  storageBucket: 'sat-prep-app-2c27e.firebasestorage.app',
  messagingSenderId: '629999595284',
  appId: '1:629999595284:web:68283bffde357999a49c01',
  measurementId: 'G-B4DXJNT743',
};

// ==========================================
// END OF CONFIGURATION
// ==========================================

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
const appId = 'sat-prep-live'; // Static ID for your app

// --- Brand Colors & Styles ---
const BRAND_BLUE = '#1e82ff';
const FONT_UI = "'Montserrat', sans-serif";
const FONT_SAT = "'Minion Pro', 'Times New Roman', serif";

// --- CONSTANTS: Specific Skills Structure ---
const SAT_STRUCTURE = [
  {
    domainId: 'RW_II',
    domainName: 'Information and Ideas',
    weight: 0.26,
    skills: [
      { skillId: 'RW_II_CID', name: 'Central Ideas and Details' },
      { skillId: 'RW_II_INF', name: 'Inferences' },
      { skillId: 'RW_II_COE', name: 'Command of Evidence' },
    ],
  },
  {
    domainId: 'RW_CS',
    domainName: 'Craft and Structure',
    weight: 0.28,
    skills: [
      { skillId: 'RW_CS_WIC', name: 'Words in Context' },
      { skillId: 'RW_CS_TSP', name: 'Text Structure and Purpose' },
      { skillId: 'RW_CS_CTC', name: 'Cross-Text Connections' },
    ],
  },
  {
    domainId: 'RW_EOI',
    domainName: 'Expression of Ideas',
    weight: 0.2,
    skills: [
      { skillId: 'RW_EOI_RHS', name: 'Rhetorical Synthesis' },
      { skillId: 'RW_EOI_TRN', name: 'Transitions' },
    ],
  },
  {
    domainId: 'RW_SEC',
    domainName: 'Standard English Conventions',
    weight: 0.26,
    skills: [
      { skillId: 'RW_SEC_BND', name: 'Boundaries' },
      { skillId: 'RW_SEC_FSS', name: 'Form, Structure, and Sense' },
    ],
  },
  {
    domainId: 'M_ALG',
    domainName: 'Algebra',
    weight: 0.35,
    skills: [
      { skillId: 'M_ALG_LIN1', name: 'Linear equations in one variable' },
      { skillId: 'M_ALG_FUNC', name: 'Linear functions' },
      { skillId: 'M_ALG_LIN2', name: 'Linear equations in two variables' },
      {
        skillId: 'M_ALG_SYS',
        name: 'Systems of two linear equations in two variables',
      },
      {
        skillId: 'M_ALG_INEQ',
        name: 'Linear inequalities in one or two variables',
      },
    ],
  },
  {
    domainId: 'M_ADV',
    domainName: 'Advanced Math',
    weight: 0.35,
    skills: [
      { skillId: 'M_ADV_NONF', name: 'Nonlinear functions' },
      { skillId: 'M_ADV_NONE', name: 'Nonlinear equations in one variable' },
      { skillId: 'M_ADV_SYS', name: 'Systems of equations in two variables' },
      { skillId: 'M_ADV_EXP', name: 'Equivalent expressions' },
    ],
  },
  {
    domainId: 'M_PSD',
    domainName: 'Problem-Solving and Data Analysis',
    weight: 0.15,
    skills: [
      {
        skillId: 'M_PSD_RAT',
        name: 'Ratios, rates, proportional relationships, and units',
      },
      { skillId: 'M_PSD_PCT', name: 'Percentages' },
      {
        skillId: 'M_PSD_OV',
        name: 'One-variable data: Distributions and measures',
      },
      {
        skillId: 'M_PSD_TV',
        name: 'Two-variable data: Models and scatterplots',
      },
      {
        skillId: 'M_PSD_PROB',
        name: 'Probability and conditional probability',
      },
      {
        skillId: 'M_PSD_INF',
        name: 'Inference from sample statistics and margin of error',
      },
      {
        skillId: 'M_PSD_EVAL',
        name: 'Evaluating statistical claims: Observational studies',
      },
    ],
  },
  {
    domainId: 'M_GEO',
    domainName: 'Geometry and Trigonometry',
    weight: 0.15,
    skills: [
      { skillId: 'M_GEO_AV', name: 'Area and volume' },
      { skillId: 'M_GEO_LAT', name: 'Lines, angles, and triangles' },
      { skillId: 'M_GEO_RTT', name: 'Right triangles and trigonometry' },
      { skillId: 'M_GEO_CIR', name: 'Circles' },
    ],
  },
];

const ALL_SKILLS = SAT_STRUCTURE.flatMap((domain) =>
  domain.skills.map((skill) => ({
    ...skill,
    domainId: domain.domainId,
    domainName: domain.domainName,
    domainWeight: domain.weight,
  }))
);

// --- SEED DATABASE MOCK ---
const SEED_DB = {
  DEFAULT: {
    type: 'general',
    context: 'Standard multiple choice question based on the specific skill.',
    distractorLogic:
      'Plausible but incorrect alternatives based on common student misconceptions for this topic.',
  },
};

// --- UTILITY FUNCTIONS ---
const calculatePriorityScore = (mastery, weight) => (100 - mastery) * weight;
const getFormattedDate = () => new Date().toISOString().split('T')[0];

// --- MATH RENDERER COMPONENT ---
const MathText = ({ text }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Dynamically inject CSS from CDN to avoid build errors with local fonts
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href =
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const parts = text.split(/(\$[^$]+\$)/g);

    const renderedHtml = parts
      .map((part) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          try {
            const math = part.slice(1, -1);
            return katex.renderToString(math, { throwOnError: false });
          } catch (e) {
            return part;
          }
        }
        let processed = part.replace(/\n/g, '<br />');
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return processed;
      })
      .join('');

    containerRef.current.innerHTML = renderedHtml;
  }, [text]);

  return (
    <span
      ref={containerRef}
      className="font-serif text-lg leading-relaxed"
      style={{ fontFamily: FONT_SAT }}
    />
  );
};

// --- AI ENGINE ---
const generateSATQuestion = async (skillId, difficulty, db) => {
  // --- 1. DEFINE CONSTANTS INSIDE THE FUNCTION (BULLETPROOF) ---
  const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';
  const API_KEY_TO_USE = API_KEY; // 👈 use the constant you defined at the top

  const skillName =
    ALL_SKILLS.find((s) => s.skillId === skillId)?.name || skillId;

  // --- 2. FETCH SEED DATA ---
  let seed = {
    context: 'Standard multiple choice question based on the specific skill.',
    distractorLogic:
      'Plausible but incorrect alternatives based on common misconceptions.',
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
      const q = query(seedsRef, where('skillId', '==', skillId), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const seedData = querySnapshot.docs[0].data();
        seed = {
          context: seedData.context,
          distractorLogic: seedData.distractorLogic,
        };
      }
    } catch (e) {
      // Silently fail on DB seed and use default
    }
  }

  // --- 3. CONSTRUCT PROMPT ---
  const systemPrompt = `
      You are an expert SAT Item Writer.
      Create a UNIQUE, ${difficulty}-level question for: "${skillName}".
      
      REQUIREMENTS:
      1. Context: ${seed.context}
      2. Distractor Logic: ${seed.distractorLogic}
      3. Options: 4 options (A, B, C, D).
      4. Answer: Identify the Correct Answer by EXACT TEXT match to one of the options.
      5. Explanation: Full step-by-step.
      
      FORMATTING RULES (CRITICAL):
      - **MATH:** Use LaTeX for mathematical expressions ONLY. Enclose them in single dollar signs (e.g., $3x - 5 = 10$).
      - **TEXT:** Do NOT put English sentences inside dollar signs.
      - **NEWLINES:** Use "\\n" to separate steps in the explanation.
      - **BOLD:** Use double asterisks for bolding (e.g., **Key Concept**).
      
      OUTPUT JSON:
      {
          "passageText": "Optional passage text...",
          "questionText": "The question stem...",
          "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
          "correctOptionText": "Exact text of correct option",
          "explanation": "Explanation here..."
      }
  `;

  // --- 4. FETCH WITH RETRY LOGIC ---
  const fetchWithRetry = async (attempt = 1) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY_TO_USE}`;
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

    // Clean JSON
    generatedText = generatedText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsedData;
    try {
      parsedData = JSON.parse(generatedText);
    } catch (e) {
      // Attempt to fix common JSON escaping errors
      const fixedText = generatedText.replace(/\\(?![/u"bfnrt\\])/g, '\\\\');
      parsedData = JSON.parse(fixedText);
    }

    // --- 5. VALIDATION GUARD ---
    if (!parsedData.options || !Array.isArray(parsedData.options)) {
      throw new Error('Missing options in AI response');
    }

    // --- 6. ANSWER MAPPING ---
    // Ensure options are strings
    parsedData.options = parsedData.options.map(String);

    const normalize = (str) =>
      str ? str.replace(/\$|\s/g, '').toLowerCase() : '';
    const correctText = parsedData.correctOptionText || '';

    let correctIndex = parsedData.options.findIndex(
      (opt) => normalize(opt) === normalize(correctText)
    );

    // Fuzzy match fallback
    if (correctIndex === -1) {
      correctIndex = parsedData.options.findIndex(
        (opt) =>
          normalize(opt).includes(normalize(correctText)) ||
          normalize(correctText).includes(normalize(opt))
      );
    }

    // Ultimate fallback
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

// --- Firebase & State Management ---
const FirebaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isDemoInitializing, setIsDemoInitializing] = useState(false);

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const firebaseAuth = getAuth(app);
    setDb(firestore);
    setAuth(firebaseAuth);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) setUserId(user.uid);
      else {
        setUserId(null);
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !userId) return;
    const userDocRef = doc(
      db,
      'artifacts',
      appId,
      'users',
      userId,
      'profile',
      'data'
    );
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      const profile = docSnap.exists() ? docSnap.data() : null;
      if (profile) setUserProfile(profile);
      else if (!profile && !isDemoInitializing) {
        const initialMastery = ALL_SKILLS.map((skill) => ({
          skillId: skill.skillId,
          masteryLevel: 0,
        }));
        const initialProfile = {
          uid: userId,
          createdAt: new Date(),
          hasTakenDiagnostic: false,
          skillMastery: initialMastery.reduce((acc, cur) => {
            acc[cur.skillId] = cur.masteryLevel;
            return acc;
          }, {}),
          dailyProgress: {
            date: getFormattedDate(),
            completed: false,
            score: 0,
          },
        };
        setDoc(userDocRef, initialProfile).catch((e) =>
          console.error('Error setting initial profile:', e)
        );
      }
    });
    return () => unsubscribe();
  }, [db, userId, isDemoInitializing]);

  const updateMastery = async (skillId, isCorrect, difficulty, timeTaken) => {
    if (!db || !userId || !userProfile) return { delta: 0 };

    const isMath = skillId.startsWith('M_');
    const targetTime = isMath ? 90 : 60;
    const isFluencyCheck = difficulty === 'Medium';
    const isSlow = isFluencyCheck && timeTaken > targetTime;

    let delta = 0;
    if (isCorrect) {
      if (difficulty === 'Hard') delta = 12;
      else if (difficulty === 'Medium') delta = 8;
      else delta = 4;
      if (isSlow) delta = Math.floor(delta * 0.8);
    } else {
      if (difficulty === 'Hard') delta = -3;
      else if (difficulty === 'Medium') delta = -4;
      else delta = -6;
    }

    const currentMastery = userProfile.skillMastery[skillId] || 0;
    let newMastery = Math.max(0, Math.min(100, currentMastery + delta));

    // Optimistic UI update
    setUserProfile((prev) => ({
      ...prev,
      skillMastery: { ...prev.skillMastery, [skillId]: newMastery },
    }));

    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data'),
        {
          [`skillMastery.${skillId}`]: newMastery,
          lastPracticed: new Date(),
        }
      );
      return { delta, isSlow };
    } catch (e) {
      return { delta: 0, isSlow: false };
    }
  };

  const completeDailyGoal = async (scorePercentage) => {
    if (!db || !userId) return;
    if (scorePercentage >= 60) {
      await updateDoc(
        doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data'),
        {
          dailyProgress: {
            date: getFormattedDate(),
            completed: true,
            score: scorePercentage,
          },
        }
      );
    }
  };

  const loginWithEmail = async (email, password) => {
    if (!auth) return;
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email, password) => {
    if (!auth) return;
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginAsDemo = async () => {
    if (!auth || !db) return;
    setIsDemoInitializing(true);
    try {
      const userCred = await signInAnonymously(auth);
      const uid = userCred.user.uid;
      const mockMastery = {};
      ALL_SKILLS.forEach((s) => {
        mockMastery[s.skillId] = Math.floor(Math.random() * 80) + 10;
      });
      mockMastery['M_ALG_LIN1'] = 50;
      const demoProfile = {
        uid,
        createdAt: new Date(),
        hasTakenDiagnostic: true,
        isDemo: true,
        skillMastery: mockMastery,
        dailyProgress: { date: getFormattedDate(), completed: false, score: 0 },
      };
      await setDoc(
        doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data'),
        demoProfile
      );
      setUserProfile(demoProfile);
    } finally {
      setIsDemoInitializing(false);
    }
  };

  const logout = async () => {
    if (auth) await signOut(auth);
    setUserId(null);
    setUserProfile(null);
  };

  const contextValue = useMemo(
    () => ({
      db,
      auth,
      userId,
      isAuthReady,
      userProfile,
      setUserProfile,
      SKILLS: ALL_SKILLS,
      SAT_STRUCTURE,
      loginAsDemo,
      loginWithEmail,
      signupWithEmail,
      logout,
      updateMastery,
      completeDailyGoal,
    }),
    [db, auth, userId, isAuthReady, userProfile, isDemoInitializing]
  );

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

const FirebaseContext = React.createContext();
const useFirebase = () => React.useContext(FirebaseContext);

// --- Sub-Components ---

// ADMIN PORTAL COMPONENT
const AdminPage = ({ setView }) => {
  const { db, SKILLS } = useFirebase();
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0].skillId);
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');

  const handleSave = async () => {
    if (!db) return;
    setStatus('Saving...');
    try {
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', 'seedQuestions'),
        {
          skillId: selectedSkill,
          context,
          distractorLogic,
          createdAt: new Date(),
        }
      );
      setStatus('Seed Saved Successfully!');
      setContext('');
      setDistractorLogic('');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error(e);
      setStatus('Error Saving Seed.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Admin Seed Portal
          </h2>
          <button
            onClick={() => setView('login')}
            className="text-gray-400 hover:text-gray-600"
          >
            Exit
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Skill
            </label>
            <select
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
            >
              {SKILLS.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {s.name} ({s.skillId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context / Question Template
            </label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none h-32"
              placeholder="e.g. A car travels at x mph for y hours..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distractor Logic
            </label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none h-24"
              placeholder="e.g. Students often confuse slope with y-intercept..."
              value={distractorLogic}
              onChange={(e) => setDistractorLogic(e.target.value)}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg transition-all"
          >
            Save Seed
          </button>
          {status && (
            <p className="text-center text-sm font-medium text-green-600">
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ... OverviewView, PracticeView, DashboardPage (unchanged but included below) ...
const OverviewView = ({
  dailySkill,
  currentDomain,
  currentMastery,
  practiceLevel,
  startPractice,
  userProfile,
  SKILLS,
  isDailyComplete,
}) => (
  <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
    <div className="space-y-6">
      <div
        className={`rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative group transition-all ${
          isDailyComplete ? 'bg-green-50 border-green-200' : 'bg-white'
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-16 -mt-16 transition-transform duration-700 ease-out ${
            isDailyComplete
              ? 'bg-green-100'
              : 'bg-gradient-to-br from-[#1e82ff]/10 to-transparent group-hover:scale-110'
          }`}
        ></div>
        <div className="p-10 relative z-10">
          <div className="flex justify-between items-start mb-6">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                isDailyComplete
                  ? 'bg-green-200 text-green-800'
                  : 'bg-blue-50 text-[#1e82ff]'
              }`}
            >
              {isDailyComplete ? 'Daily Goal Complete!' : 'Daily Priority'}
            </span>
            {isDailyComplete && <span className="text-4xl">✅</span>}
          </div>
          <h2 className="text-3xl font-light text-gray-900 mb-2 leading-tight">
            {dailySkill?.name}
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            {currentDomain?.domainName}
          </p>
          <div className="space-y-6 mb-10">
            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-gray-500">Current Mastery</span>
                <span
                  className={
                    isDailyComplete ? 'text-green-600' : 'text-[#1e82ff]'
                  }
                >
                  {currentMastery}%
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isDailyComplete ? 'bg-green-500' : 'bg-[#1e82ff]'
                  }`}
                  style={{ width: `${currentMastery}%` }}
                ></div>
              </div>
            </div>
          </div>
          <button
            onClick={() => startPractice(dailySkill)}
            className={`w-full py-5 text-white text-lg font-medium rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center group ${
              isDailyComplete
                ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30'
                : 'bg-[#1e82ff] hover:shadow-blue-500/50 hover:-translate-y-1 shadow-blue-500/30'
            }`}
          >
            <span>
              {isDailyComplete
                ? 'Practice Again (Extra Credit)'
                : 'Start Daily 5 (Required)'}
            </span>
          </button>
        </div>
      </div>
    </div>
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          Skill Library
        </h3>
        {!isDailyComplete && (
          <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">
            🔒 Locked until Daily 5 done
          </span>
        )}
      </div>
      <div
        className={`space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar ${
          !isDailyComplete
            ? 'opacity-50 pointer-events-none select-none grayscale-[0.5]'
            : ''
        }`}
      >
        {SKILLS.map((skill) => {
          const m = userProfile.skillMastery[skill.skillId] || 0;
          const isFocus = skill.skillId === dailySkill?.skillId;
          return (
            <div
              key={skill.skillId}
              onClick={() => isDailyComplete && startPractice(skill)}
              className={`group flex justify-between items-center p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:shadow-md ${
                isFocus
                  ? 'bg-blue-50/50 border-blue-100 ring-2 ring-blue-100'
                  : 'bg-white border-gray-50 hover:border-[#1e82ff]'
              }`}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    m >= 80
                      ? 'bg-green-400'
                      : m >= 50
                      ? 'bg-yellow-400'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <p className="text-sm font-medium text-gray-600 truncate">
                  {skill.name}
                </p>
              </div>
              {isDailyComplete ? (
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                  {m}%
                </span>
              ) : (
                <span className="text-xs">🔒</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const PracticeView = ({
  activeSkill,
  practiceLevel,
  setView,
  updateMastery,
  completeDailyGoal,
  isDailySession,
  db,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [pointsDelta, setPointsDelta] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const [startTime, setStartTime] = useState(Date.now());
  const [timeTaken, setTimeTaken] = useState(0);
  const [isSlow, setIsSlow] = useState(false);

  const loadQuestion = useCallback(async () => {
    if (!activeSkill) return;
    setIsGenerating(true);
    setCurrentQuestion(null);
    setFeedback(null);
    setUserAnswer(null);
    setPointsDelta(0);
    setIsSlow(false);

    const questionData = await generateSATQuestion(
      activeSkill.skillId,
      practiceLevel,
      db
    );
    setCurrentQuestion({
      skillId: activeSkill.skillId,
      difficulty: practiceLevel,
      ...questionData,
    });
    setStartTime(Date.now());
    setIsGenerating(false);
  }, [activeSkill, practiceLevel, db]);

  useEffect(() => {
    loadQuestion();
  }, []);

  const handleSubmitAnswer = async (answer) => {
    if (isGenerating || userAnswer) return;

    const now = Date.now();
    const duration = (now - startTime) / 1000;
    setTimeTaken(duration);

    setUserAnswer(answer);
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) setCorrectCount((prev) => prev + 1);

    const { delta, isSlow: slowFlag } = await updateMastery(
      activeSkill.skillId,
      isCorrect,
      practiceLevel,
      duration
    );
    setPointsDelta(delta);
    setIsSlow(slowFlag);

    setFeedback({
      result: isCorrect ? 'Correct' : 'Incorrect',
      explanation: currentQuestion.explanation,
      correct: isCorrect,
    });
  };

  const handleNextQuestion = async () => {
    if (questionNumber >= 5) {
      setSessionComplete(true);
      if (isDailySession) {
        const finalScore = (correctCount / 5) * 100;
        await completeDailyGoal(finalScore);
      }
    } else {
      setQuestionNumber((prev) => prev + 1);
      loadQuestion();
    }
  };

  if (sessionComplete) {
    const passed = correctCount >= 3;
    return (
      <div className="flex items-center justify-center min-h-[600px] animate-fade-in-up">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full">
          <div className="text-6xl mb-6">{passed ? '🎉' : '💪'}</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {passed ? 'Session Complete!' : 'Keep Practicing'}
          </h2>
          <p className="text-gray-500 mb-8">
            You got{' '}
            <span
              className={`font-bold ${
                passed ? 'text-green-600' : 'text-orange-500'
              }`}
            >
              {correctCount}/5
            </span>{' '}
            correct.
          </p>
          {isDailySession && !passed && (
            <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm mb-8">
              You need 60% (3/5) to unlock the rest of the skills.
            </div>
          )}
          <div className="space-y-3">
            {(!isDailySession || passed) && (
              <button
                onClick={() => setView('overview')}
                className="w-full py-4 bg-[#1e82ff] text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
              >
                Back to Dashboard
              </button>
            )}
            {isDailySession && !passed && (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-[#1e82ff] text-white rounded-xl font-medium shadow-lg hover:bg-blue-600 transition-all"
              >
                Retry Daily 5
              </button>
            )}
            {isDailySession && !passed && (
              <button
                onClick={() => setView('overview')}
                className="w-full py-4 text-gray-400 hover:text-gray-600 transition-all text-sm"
              >
                Take a Break (Skills Locked)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in-up">
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => setView('overview')}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
        >
          Exit
        </button>
        <div className="text-xs font-bold text-[#1e82ff] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
          {isDailySession ? 'Daily Goal' : 'Practice Set'} • {questionNumber} /
          5
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden min-h-[600px] flex flex-col relative">
        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
            <div className="w-12 h-12 border-2 border-gray-100 border-t-[#1e82ff] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-light tracking-widest text-sm">
              CRAFTING QUESTION...
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="flex-1 flex flex-col lg:flex-row h-full">
            {currentQuestion.passageText && (
              <div className="lg:w-1/2 p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-gray-100 bg-[#f9fafb] overflow-y-auto max-h-[600px] lg:max-h-full mt-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Passage
                </h3>
                <div className="font-serif text-lg leading-loose text-gray-800 relative pl-8">
                  <div className="absolute left-0 top-0 h-full flex flex-col text-[10px] text-gray-400 select-none font-sans pt-1">
                    {[...Array(10)].map((_, i) => (
                      <span key={i} style={{ marginBottom: '3.5rem' }}>
                        {i * 5 + 1}
                      </span>
                    ))}
                  </div>
                  <MathText text={currentQuestion.passageText} />
                </div>
              </div>
            )}

            <div
              className={`${
                currentQuestion.passageText
                  ? 'lg:w-1/2'
                  : 'w-full max-w-3xl mx-auto'
              } p-8 md:p-12 flex flex-col mt-2`}
            >
              <div className="flex-1 space-y-8">
                <div className="prose prose-lg max-w-none">
                  <div className="font-serif text-xl md:text-2xl text-gray-900 leading-relaxed">
                    <MathText text={currentQuestion.questionText} />
                  </div>
                </div>
                <div className="grid gap-4">
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    let style =
                      'bg-white border-gray-200 hover:border-[#1e82ff] hover:shadow-md';
                    if (userAnswer) {
                      if (letter === currentQuestion.correctAnswer)
                        style = 'bg-green-50 border-green-500 shadow-none';
                      else if (letter === userAnswer)
                        style = 'bg-red-50 border-red-500 shadow-none';
                      else
                        style =
                          'bg-gray-50 border-gray-100 opacity-50 shadow-none';
                    }
                    return (
                      <button
                        key={letter}
                        onClick={() => handleSubmitAnswer(letter)}
                        disabled={!!userAnswer}
                        className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-200 group ${style}`}
                      >
                        <div className="flex items-center">
                          <span
                            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-serif mr-4 border ${
                              userAnswer &&
                              letter === currentQuestion.correctAnswer
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 text-gray-400 group-hover:border-[#1e82ff] group-hover:text-[#1e82ff]'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="font-serif text-lg text-gray-800">
                            <MathText text={opt} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {feedback && (
                  <div
                    className={`p-6 rounded-xl border ${
                      feedback.correct
                        ? 'bg-green-50 border-green-100'
                        : 'bg-red-50 border-red-100'
                    } animate-fade-in-up`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            feedback.correct ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        ></div>
                        <h4
                          className={`font-semibold ${
                            feedback.correct ? 'text-green-800' : 'text-red-800'
                          }`}
                        >
                          {feedback.result}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end">
                        {pointsDelta !== 0 && (
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full ${
                              pointsDelta > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {pointsDelta > 0 ? '+' : ''}
                            {pointsDelta}% Mastery
                          </span>
                        )}
                        <span className="text-xs text-gray-400 font-mono mt-1">
                          Time: {Math.floor(timeTaken / 60)}:
                          {String(Math.floor(timeTaken % 60)).padStart(2, '0')}
                        </span>
                        {isSlow &&
                          feedback.correct &&
                          practiceLevel === 'Medium' && (
                            <span className="text-[10px] text-orange-500 font-bold mt-1">
                              Target:{' '}
                              {currentQuestion.skillId.startsWith('M_')
                                ? '90s'
                                : '60s'}{' '}
                              (Fluency Focus)
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="text-gray-700 font-serif leading-relaxed">
                      <MathText text={feedback.explanation} />
                    </div>
                    <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                      <button
                        onClick={handleNextQuestion}
                        className="px-8 py-3 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center"
                      >
                        <span>
                          {questionNumber === 5
                            ? 'Finish Set'
                            : 'Next Question'}
                        </span>
                        <svg
                          className="w-5 h-5 ml-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const {
    userProfile,
    SKILLS,
    SAT_STRUCTURE,
    logout,
    updateMastery,
    completeDailyGoal,
    db,
  } = useFirebase();
  const [view, setView] = useState('overview');
  const [activePracticeSkill, setActivePracticeSkill] = useState(null);
  const [isDailyPracticeMode, setIsDailyPracticeMode] = useState(false);

  const dailySkill = useMemo(() => {
    if (!userProfile?.skillMastery) return null;
    let highest = -1,
      selected = null;
    ALL_SKILLS.forEach((skill) => {
      const mastery = userProfile.skillMastery[skill.skillId] || 0;
      const score = calculatePriorityScore(mastery, skill.domainWeight);
      if (score > highest) {
        highest = score;
        selected = skill;
      }
    });
    return selected;
  }, [userProfile]);

  const isDailyComplete = useMemo(() => {
    const today = getFormattedDate();
    return (
      userProfile?.dailyProgress?.date === today &&
      userProfile?.dailyProgress?.completed
    );
  }, [userProfile]);

  const startPractice = (skill) => {
    setActivePracticeSkill(skill);
    setIsDailyPracticeMode(
      skill.skillId === dailySkill.skillId && !isDailyComplete
    );
    setView('practice');
  };

  const currentMastery = dailySkill
    ? userProfile.skillMastery[dailySkill.skillId] || 0
    : 0;
  const currentDomain = dailySkill
    ? SAT_STRUCTURE.find((d) => d.domainId === dailySkill.domainId)
    : null;
  const practiceLevel =
    currentMastery < 25 ? 'Easy' : currentMastery < 75 ? 'Medium' : 'Hard';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-['Montserrat']">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm/50 backdrop-blur-md bg-white/90">
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => setView('overview')}
        >
          <div className="w-8 h-8 bg-[#1e82ff] rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
            SP
          </div>
          <span className="font-light text-xl tracking-wide text-gray-900">
            SAT<span className="font-semibold">PREP</span>.AI
          </span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="hidden md:block text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
              Student ID
            </p>
            <p className="text-xs font-mono text-gray-600">
              {userProfile.uid.slice(0, 6)}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500 hover:text-[#1e82ff] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>
      <div className="flex-1">
        {view === 'overview' ? (
          <OverviewView
            dailySkill={dailySkill}
            currentDomain={currentDomain}
            currentMastery={currentMastery}
            practiceLevel={practiceLevel}
            startPractice={startPractice}
            userProfile={userProfile}
            SKILLS={SKILLS}
            isDailyComplete={isDailyComplete}
          />
        ) : (
          <PracticeView
            activeSkill={activePracticeSkill}
            practiceLevel={practiceLevel}
            setView={setView}
            updateMastery={updateMastery}
            completeDailyGoal={completeDailyGoal}
            isDailySession={isDailyPracticeMode}
            db={db}
          />
        )}
      </div>
    </div>
  );
};

const LoginScreen = () => {
  const { loginAsStudent, loginAsDemo, loginWithEmail, signupWithEmail } =
    useFirebase();
  const [mode, setMode] = useState('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAuth = async (isSignup) => {
    setIsLoading(true);
    setError(null);
    try {
      if (isSignup) await signupWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  const handleDemo = async () => {
    setIsLoading(true);
    await loginAsDemo();
  };

  if (mode === 'admin') return <AdminPage setView={setMode} />;

  if (mode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div
            className="p-10 text-center"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            <div className="inline-block p-3 rounded-full bg-white/20 mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-white tracking-wide font-['Montserrat']">
              SAT<span className="font-semibold">PREP</span>.AI
            </h1>
            <p className="text-white/80 mt-2 text-sm font-light">
              Adaptive Intelligence for Mastery
            </p>
          </div>
          <div className="p-8 space-y-4 bg-white">
            <button
              onClick={() => setMode('login')}
              className="w-full py-4 px-6 bg-white border border-[#1e82ff] text-[#1e82ff] font-medium rounded-xl hover:bg-[#1e82ff]/5 transition-all flex items-center justify-center"
            >
              Log In
            </button>
            <button
              onClick={() => setMode('signup')}
              className="w-full py-4 px-6 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center"
            >
              Sign Up
            </button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest">
                <span className="px-2 bg-white text-gray-400">Or</span>
              </div>
            </div>
            <button
              onClick={handleDemo}
              disabled={isLoading}
              className="w-full py-4 px-6 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-900 transition-all flex items-center justify-center"
            >
              <span className="mr-2">🚀</span> Try Demo Mode
            </button>
            <div className="text-center pt-2">
              <button
                onClick={() => setMode('admin')}
                className="text-xs text-gray-300 hover:text-gray-500"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-8 bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1e82ff]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1e82ff]"
            />
            <button
              onClick={() => handleAuth(mode === 'signup')}
              disabled={isLoading}
              className="w-full py-4 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg transition-all flex items-center justify-center"
            >
              {isLoading
                ? 'Processing...'
                : mode === 'login'
                ? 'Log In'
                : 'Sign Up'}
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full text-gray-400 text-sm hover:text-gray-600"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppRouter = () => {
  const { userProfile, isAuthReady, userId } = useFirebase();
  if (!isAuthReady)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div
            className="h-12 w-12 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: `${BRAND_BLUE} transparent transparent transparent`,
            }}
          ></div>
          <p className="mt-4 text-gray-400 font-light text-sm tracking-widest">
            LOADING ENVIRONMENT
          </p>
        </div>
      </div>
    );
  if (!userId) return <LoginScreen />;
  if (!userProfile)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 font-light animate-pulse">
          Initializing User Profile...
        </p>
      </div>
    );
  return !userProfile.hasTakenDiagnostic ? (
    <DiagnosticPage />
  ) : (
    <DashboardPage />
  );
};

const DiagnosticPage = () => {
  const { db, userId, userProfile, logout } = useFirebase();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [adaptiveStage, setAdaptiveStage] = useState('probe');
  const [clusterResults, setClusterResults] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const currentDomain = SAT_STRUCTURE[currentDomainIndex];

  const loadQuestion = useCallback(
    async (stage, prevResult = null) => {
      setIsGenerating(true);
      setCurrentQuestion(null);
      setFeedback(null);
      setUserAnswer(null);

      const randomSkill =
        currentDomain.skills[
          Math.floor(Math.random() * currentDomain.skills.length)
        ];
      let difficulty = 'Medium';
      if (stage === 'verify') {
        difficulty = prevResult === 'correct' ? 'Hard' : 'Easy';
      }

      const questionData = await generateSATQuestion(
        randomSkill.skillId,
        difficulty,
        db
      );
      setCurrentQuestion({
        skillId: randomSkill.skillId,
        difficulty,
        ...questionData,
      });
      setIsGenerating(false);
    },
    [currentDomain, db]
  );

  useEffect(() => {
    if (!currentQuestion && currentDomain) loadQuestion('probe');
  }, [currentDomainIndex]);

  const handleAnswer = (answer) => {
    if (isGenerating || userAnswer) return;
    setUserAnswer(answer);
    const isCorrect = answer === currentQuestion.correctAnswer;
    setFeedback({
      result: isCorrect ? 'Correct' : 'Incorrect',
      explanation: currentQuestion.explanation,
      correct: isCorrect,
    });
    setTimeout(() => {
      if (adaptiveStage === 'probe') {
        setAdaptiveStage('verify');
        loadQuestion('verify', isCorrect ? 'correct' : 'incorrect');
      } else {
        let inferredScore = 0;
        if (currentQuestion.difficulty === 'Hard')
          inferredScore = isCorrect ? 90 : 70;
        else inferredScore = isCorrect ? 40 : 10;
        setClusterResults((prev) => ({
          ...prev,
          [currentDomain.domainId]: inferredScore,
        }));
        if (currentDomainIndex < SAT_STRUCTURE.length - 1) {
          setCurrentDomainIndex((prev) => prev + 1);
          setAdaptiveStage('probe');
          setTimeout(() => loadQuestion('probe'), 50);
        } else {
          finalizeDiagnostic({
            ...clusterResults,
            [currentDomain.domainId]: inferredScore,
          });
        }
      }
    }, 1500);
  };

  const handleIDontKnow = () => {
    const inferredScore = 0;
    setClusterResults((prev) => ({
      ...prev,
      [currentDomain.domainId]: inferredScore,
    }));
    if (currentDomainIndex < SAT_STRUCTURE.length - 1) {
      setCurrentDomainIndex((prev) => prev + 1);
      setAdaptiveStage('probe');
      setTimeout(() => loadQuestion('probe'), 50);
    } else {
      finalizeDiagnostic({
        ...clusterResults,
        [currentDomain.domainId]: inferredScore,
      });
    }
  };

  const finalizeDiagnostic = async (finalResults) => {
    if (!db || !userId) return;
    const newMastery = {};
    SAT_STRUCTURE.forEach((domain) => {
      const score = finalResults[domain.domainId] || 0;
      domain.skills.forEach((skill) => {
        newMastery[skill.skillId] = score;
      });
    });
    const updatedProfile = {
      ...userProfile,
      hasTakenDiagnostic: true,
      skillMastery: newMastery,
      diagnosticCompletedAt: new Date(),
      dailyProgress: { date: getFormattedDate(), completed: false, score: 0 },
    };
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data'),
        updatedProfile
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-gray-400 text-xs tracking-widest uppercase font-semibold">
            Diagnostic Assessment
          </h2>
          <p className="text-sm font-medium text-[#1e82ff]">
            Section {currentDomainIndex + 1} of {SAT_STRUCTURE.length}:{' '}
            {currentDomain?.domainName}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-red-500 text-xs uppercase tracking-widest transition-colors"
        >
          Quit
        </button>
      </div>
      <div className="w-full max-w-3xl bg-white shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden border border-gray-100 relative">
        <div className="h-1.5 w-full bg-gray-100">
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${
                ((currentDomainIndex * 2 +
                  (adaptiveStage === 'verify' ? 2 : 1)) /
                  (SAT_STRUCTURE.length * 2)) *
                100
              }%`,
              backgroundColor: BRAND_BLUE,
            }}
          ></div>
        </div>
        <div className="p-8 md:p-12">
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-60">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-[#1e82ff] rounded-full animate-spin"></div>
              <p className="mt-4 text-xs font-medium text-gray-400 uppercase tracking-widest">
                Analysing Difficulty...
              </p>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-8 animate-fade-in">
              <div className="p-6 md:p-8 bg-[#f9fafb] rounded-xl border border-gray-100 relative">
                {currentQuestion.passageText && (
                  <div className="mb-6 pb-6 border-b border-gray-200 font-serif text-gray-800 leading-relaxed">
                    <MathText text={currentQuestion.passageText} />
                  </div>
                )}
                <div className="text-lg md:text-xl text-gray-900 leading-relaxed font-serif">
                  <MathText text={currentQuestion.questionText} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {currentQuestion.options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  let stateStyle =
                    'bg-white border-gray-200 text-gray-600 hover:border-[#1e82ff] hover:text-[#1e82ff] hover:bg-[#1e82ff]/5';
                  if (userAnswer) {
                    if (letter === currentQuestion.correctAnswer)
                      stateStyle =
                        'bg-green-50 border-green-500 text-green-700';
                    else if (letter === userAnswer)
                      stateStyle = 'bg-red-50 border-red-500 text-red-700';
                    else
                      stateStyle =
                        'bg-gray-50 border-gray-100 text-gray-300 opacity-50';
                  }
                  return (
                    <button
                      key={letter}
                      className={`w-full text-left p-4 md:p-5 rounded-xl border transition-all duration-200 group ${stateStyle}`}
                      onClick={() => handleAnswer(letter)}
                      disabled={!!userAnswer}
                    >
                      <div className="flex items-center">
                        <span
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-serif mr-4 ${
                            userAnswer &&
                            letter === currentQuestion.correctAnswer
                              ? 'border-green-500 bg-green-100'
                              : 'border-current opacity-60'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="font-serif text-lg leading-snug">
                          <MathText text={option} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!userAnswer && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleIDontKnow}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    I haven't learned this yet (Skip Domain)
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <div className="antialiased text-gray-900 bg-gray-50 min-h-screen">
    <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
            @import url('https://use.typekit.net/zra3tav.css');
            body { font-family: 'Montserrat', sans-serif; }
            .animate-fade-in { animation: fadeIn 0.5s ease-out; }
            .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f1f1; border-radius: 4px; }
            .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #e0e0e0; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    {firebaseConfig ? (
      <FirebaseProvider>
        <AppRouter />
      </FirebaseProvider>
    ) : (
      <div className="text-center p-20 text-red-400 font-light">
        Config Error
      </div>
    )}
  </div>
);

export default App;
