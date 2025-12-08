import React, { useState, useMemo } from 'react';
import OverviewView from '../components/OverviewView.jsx'; // Ensure .jsx extension
import PracticeView from '../components/PracticeView.jsx'; // Ensure .jsx extension
import { useFirebase } from '../context/FirebaseContext.jsx'; // Ensure .jsx extension
import { fetchPracticeQuestions } from '../services/questionBankService.js';


// Helper
const calculatePriorityScore = (mastery, weight) => (100 - mastery) * weight;
const getFormattedDate = () => new Date().toISOString().split('T')[0];

const DashboardPage = () => {
  // 1. Get SKILLS and SAT_STRUCTURE from the Context ("The Brain")
  // instead of importing the file directly.
  const {
    userProfile,
    logout,
    updateMastery,
    completeDailyGoal,
    db,
    SKILLS,         // <--- Added this
    SAT_STRUCTURE   // <--- Added this
  } = useFirebase();

  const [view, setView] = useState('overview');
  const [activePracticeSkill, setActivePracticeSkill] = useState(null);
  const [isDailyPracticeMode, setIsDailyPracticeMode] = useState(false);

  const dailySkill = useMemo(() => {
    if (!userProfile?.skillMastery || !SKILLS) return null; // Added !SKILLS check
    let highest = -1,
      selected = null;

  const [dailyQuestions, setDailyQuestions] = useState(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState('');
      
    
    // 2. Changed ALL_SKILLS to SKILLS
    SKILLS.forEach((skill) => {
      const mastery = calculatePriorityScore(
        userProfile.skillMastery[skill.skillId] || 0,
        skill.domainWeight
      );
      if (mastery > highest) {
        highest = mastery;
        selected = skill;
      }
    });
    return selected;
  }, [userProfile, SKILLS]);

  const isDailyComplete = useMemo(() => {
    const today = getFormattedDate();
    return (
      userProfile?.dailyProgress?.date === today &&
      userProfile?.dailyProgress?.completed
    );
  }, [userProfile]);

  const startPractice = async (skill) => {
    // Is this the Daily Priority skill, and is the day not yet complete?
    const isDailySkill = dailySkill && skill.skillId === dailySkill.skillId && !isDailyComplete;
  
    if (isDailySkill) {
      if (!db) return;
      setIsLoadingDaily(true);
      setDailyError('');
  
      try {
        const qs = await fetchPracticeQuestions(db, skill.skillId, practiceLevel, 5);
  
        if (!qs.length) {
          setDailyError(
            'No approved questions available yet for this skill/difficulty. Please add more to the bank.'
          );
          setIsLoadingDaily(false);
          return;
        }
  
        setActivePracticeSkill(skill);
        setDailyQuestions(qs);
        setIsDailyPracticeMode(true);
        setView('practice');
      } catch (err) {
        console.error(err);
        setDailyError('Error loading Daily 5 questions. Check console.');
        setIsLoadingDaily(false);
      }
    } else {
      // Non-daily practice: keep old AI-based behavior for now
      setActivePracticeSkill(skill);
      setDailyQuestions(null);
      setIsDailyPracticeMode(false);
      setView('practice');
    }
  };
  
  const currentMastery = dailySkill
    ? userProfile.skillMastery[dailySkill.skillId] || 0
    : 0;
  
  // 3. Ensure SAT_STRUCTURE is available
  const currentDomain = dailySkill && SAT_STRUCTURE
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
            SKILLS={SKILLS} // Use SKILLS here
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

export default DashboardPage;