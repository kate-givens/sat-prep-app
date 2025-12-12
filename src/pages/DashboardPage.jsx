import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import OverviewView from '../components/OverviewView.jsx';
import PracticeView from '../components/PracticeView.jsx';


const pickDifficultyForMastery = (mastery) => {
  if (mastery < 25) return 'Easy';
  if (mastery < 75) return 'Medium';
  return 'Hard';
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
  const [practiceQuestions, setPracticeQuestions] = useState(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState('');

  const skillMastery = userProfile?.skillMastery || {};

  // 1) If diagnostic set a dailySkillId, use it.
  // 2) Otherwise compute by (100 - mastery) * SAT domain weight
  const dailySkill = useMemo(() => {
    if (!userProfile || !SKILLS?.length) return null;

    const forcedId = userProfile.dailySkillId;
    if (forcedId) {
      const forced = SKILLS.find((s) => s.skillId === forcedId);
      if (forced) return forced;
    }

    let best = null;
    let bestScore = -Infinity;

    for (const skill of SKILLS) {
      const mastery = skillMastery[skill.skillId] ?? 0;

      const domain = SAT_STRUCTURE?.find((d) => d.domainId === skill.domainId);
      const weight = domain?.weight ?? 0.25;

      // Higher score = higher priority for Daily 5
      const priorityScore = (100 - mastery) * weight;

      if (priorityScore > bestScore) {
        bestScore = priorityScore;
        best = skill;
      }
    }

    return best;
  }, [userProfile, SKILLS, SAT_STRUCTURE, skillMastery]);

  const isDailyComplete = useMemo(() => {
    if (!userProfile?.dailyProgress) return false;
    const today = new Date().toISOString().split('T')[0];
    return (
      userProfile.dailyProgress.date === today &&
      userProfile.dailyProgress.completed
    );
  }, [userProfile]);

  const currentMastery = dailySkill
    ? (skillMastery[dailySkill.skillId] ?? 0)
    : 0;

  const currentDomain = dailySkill
    ? SAT_STRUCTURE.find((d) => d.domainId === dailySkill.domainId)
    : null;

  const practiceLevel = pickDifficultyForMastery(currentMastery);

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
      const mastery = skillMastery[skill.skillId] ?? 0;
      const targetDifficulty = pickDifficultyForMastery(mastery);

      const bankRef = collection(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'questionBank'
      );

      // 1) same skill + difficulty + approved
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

      // 2) fallback: same skill, any difficulty, approved
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
        setPracticeQuestions(null);
        setDailyError(`No approved question bank items found for skill ${skill.skillId}.`);
      } else {
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
      {/* header unchanged... */}

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
            logout={logout} 
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
