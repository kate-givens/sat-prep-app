import React, { useCallback, useMemo, useState } from 'react';
import OverviewView from '../components/OverviewView.jsx';
import PracticeView from '../components/PracticeView.jsx';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { fetchPracticeQuestions } from '../services/questionBankService.js';

const getToday = () => new Date().toISOString().split('T')[0];

const DashboardPage = () => {
  const {
    db,
    SKILLS,
    userProfile,
    updateMastery,
    completeDailyGoal,
    logout,
  } = useFirebase();

  const [view, setView] = useState('overview');
  const [activeSkill, setActiveSkill] = useState(null);
  const [practiceLevel, setPracticeLevel] = useState('Medium');
  const [initialQuestions, setInitialQuestions] = useState([]);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [errorLabel, setErrorLabel] = useState('');

  const today = getToday();
  const isDailyComplete =
    userProfile?.dailyProgress?.completed &&
    userProfile?.dailyProgress?.date === today;

  const dailySkill = useMemo(() => {
    if (!SKILLS?.length) return null;

    if (userProfile?.dailySkillId) {
      const skill = SKILLS.find(
        (s) => s.skillId === userProfile.dailySkillId
      );
      if (skill) return skill;
    }

    if (userProfile?.skillMastery) {
      let lowestSkill = null;
      let lowestValue = Infinity;

      SKILLS.forEach((skill) => {
        const mastery = userProfile.skillMastery?.[skill.skillId] ?? 0;
        if (mastery < lowestValue) {
          lowestValue = mastery;
          lowestSkill = skill;
        }
      });

      if (lowestSkill) return lowestSkill;
    }

    return SKILLS[0] || null;
  }, [SKILLS, userProfile]);

  const currentDomain = dailySkill
    ? {
        domainId: dailySkill.domainId,
        domainName: dailySkill.domainName,
      }
    : null;
  const currentMastery = dailySkill
    ? Math.round(userProfile?.skillMastery?.[dailySkill.skillId] ?? 0)
    : 0;

  const determinePracticeLevel = useCallback(
    (skillId) => {
      const mastery = userProfile?.skillMastery?.[skillId] ?? 0;
      if (mastery >= 80) return 'Hard';
      if (mastery >= 50) return 'Medium';
      return 'Easy';
    },
    [userProfile]
  );

  const startPractice = useCallback(
    async (skill) => {
      if (!skill || !db) return;

      const level = determinePracticeLevel(skill.skillId);

      setView('practice');
      setActiveSkill(skill);
      setPracticeLevel(level);
      setLoadingLabel('Fetching questions…');
      setErrorLabel('');

      try {
        const questions = await fetchPracticeQuestions(
          db,
          skill.skillId,
          level,
          5
        );
        setInitialQuestions(questions);
        if (!questions.length) {
          setErrorLabel(
            'No approved questions available for this skill. Add them in the Admin portal.'
          );
        }
      } catch (err) {
        console.error('Error fetching practice questions', err);
        setInitialQuestions([]);
        setErrorLabel('Unable to load practice questions. Please try again.');
      } finally {
        setLoadingLabel('');
      }
    },
    [db, determinePracticeLevel]
  );

  const isDailySession =
    activeSkill?.skillId === dailySkill?.skillId && !isDailyComplete;

  if (view === 'practice' && activeSkill) {
    return (
      <PracticeView
        activeSkill={activeSkill}
        practiceLevel={practiceLevel}
        setView={setView}
        updateMastery={updateMastery}
        completeDailyGoal={completeDailyGoal}
        isDailySession={isDailySession}
        initialQuestions={initialQuestions}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
      />
    );
  }

  return (
    <OverviewView
      dailySkill={dailySkill}
      currentDomain={currentDomain}
      currentMastery={currentMastery}
      startPractice={startPractice}
      userProfile={userProfile}
      SKILLS={SKILLS}
      isDailyComplete={!!isDailyComplete}
      logout={logout}
    />
  );
};

export default DashboardPage;
