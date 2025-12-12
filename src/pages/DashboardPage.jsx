import React, { useState, useMemo } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import OverviewView from '../components/OverviewView.jsx';
import PracticeView from '../components/PracticeView.jsx';


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
  const [practiceQuestions, setPracticeQuestions] = useState(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState('');

  const dailySkill = useMemo(() => {
    if (!userProfile?.skillMastery) return null;

    let highestScore = -1;
    let selected = null;

    SKILLS.forEach((skill) => {
      const mastery = userProfile.skillMastery[skill.skillId] || 0;
      const domain = SAT_STRUCTURE.find(
        (d) => d.domainId === skill.domainId
      );
      const weight = domain ? domain.weight : 0.25;
      const priorityScore = (100 - mastery) * weight;

      if (priorityScore > highestScore) {
        highestScore = priorityScore;
        selected = skill;
      }

      const pickDifficultyForMastery = (mastery) => {
        if (mastery < 25) return 'Easy';
        if (mastery < 75) return 'Medium';
        return 'Hard';
      };
      
    });

    return selected;
  }, [userProfile, SKILLS, SAT_STRUCTURE]);

  const isDailyComplete = useMemo(() => {
    if (!userProfile?.dailyProgress) return false;
    const today = new Date().toISOString().split('T')[0];

    return (
      userProfile.dailyProgress.date === today &&
      userProfile.dailyProgress.completed
    );
  }, [userProfile]);

  const currentMastery = dailySkill
    ? userProfile.skillMastery[dailySkill.skillId] || 0
    : 0;

  const currentDomain = dailySkill
    ? SAT_STRUCTURE.find((d) => d.domainId === dailySkill.domainId)
    : null;

  const practiceLevel =
    currentMastery < 25 ? 'Easy' : currentMastery < 75 ? 'Medium' : 'Hard';

  const pickDifficultyForMastery = (mastery) => {
    if (mastery < 25) return 'Easy';
    if (mastery < 75) return 'Medium';
    return 'Hard';
  };

  const startPractice = async (skill) => {
    if (!skill || !db) return;
  
    setActivePracticeSkill(skill);
    setDailyError('');
    setIsLoadingDaily(true);
  
    const isDaily =
      dailySkill &&
      skill.skillId === dailySkill.skillId &&
      !isDailyComplete;
  
    setIsDailyPracticeMode(isDaily);
  
    try {
      const mastery = userProfile.skillMastery[skill.skillId] ?? 0;
      const targetDifficulty = pickDifficultyForMastery(mastery);
  
      const bankRef = collection(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'questionBank'
      );
  
      // 1) Ideal: same skill + difficulty + approved
      const qExact = query(
        bankRef,
        where('skillId', '==', skill.skillId),
        where('difficulty', '==', targetDifficulty),
        where('status', '==', 'approved'),
        limit(5)
      );
  
      let snapshot = await getDocs(qExact);
      let questions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      // 2) Fallback: same skill, any difficulty, but still approved
      if (!questions.length) {
        const qAnyDiff = query(
          bankRef,
          where('skillId', '==', skill.skillId),
          where('status', '==', 'approved'),
          limit(5)
        );
        snapshot = await getDocs(qAnyDiff);
        questions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }
  
      if (!questions.length) {
        // Nothing approved yet for this skill
        setPracticeQuestions(null);
        setDailyError(
          `No approved question bank items found for skill ${skill.skillId}.`
        );
      } else {
        // Optional: shuffle for variety
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        setPracticeQuestions(shuffled);
      }
    } catch (err) {
      console.error('Error loading bank questions:', err);
      setPracticeQuestions(null);
      setDailyError('Error loading bank questions.');
    } finally {
      setIsLoadingDaily(false);
      setView('practice');
    }
  };
  
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-['Montserrat']">
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
            initialQuestions={practiceQuestions}
            loadingLabel={isLoadingDaily ? 'Loading questions…' : ''}
            errorLabel={dailyError}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
