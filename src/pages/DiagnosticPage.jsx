// src/pages/DiagnosticPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import MathText from '../components/MathText.jsx';
import { useFirebase } from '../context/FirebaseContext.jsx';

import {
  startMathModule,
  scoreMathResponse,
  saveMathResponse,
  finalizeRoutingOnSubmit,
  getUnansweredQuestions,
  handleRoutingTimeout,
  finalizeStage2AndComputeMastery,
} from '../services/mathDiagnosticService.js';

import { BRAND_BLUE, APP_ID } from '../config/constants.js';
import {
  mathRoutingModuleQuestions,
  mathStage2Modules,
} from '../data/mathDiagnosticQuestions.js';
import DesmosDraggable from '../components/DesmosDraggable.jsx';

const MODULE_DUR_SEC = 20 * 60; // 20 minutes per module

const DiagnosticPage = () => {
  const { db, userId, userProfile, logout } = useFirebase();

  const [moduleName, setModuleName] = useState('Routing'); // "Routing" | "Stage2_Easy" | "Stage2_Medium" | "Stage2_Hard"
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(MODULE_DUR_SEC);
  const [diagDoc, setDiagDoc] = useState(null);
  const [isSubmittingModule, setIsSubmittingModule] = useState(false);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null); // { skillStats, masteryBySkillId, recommendedSkills, skillMastery, dailySkillId }

  // 1) Load questions when moduleName changes
  useEffect(() => {
    if (moduleName === 'Routing') {
      setQuestions(mathRoutingModuleQuestions);
    } else if (moduleName.startsWith('Stage2_')) {
      setQuestions(mathStage2Modules[moduleName] || []);
    } else {
      setQuestions([]);
    }
    setCurrentIndex(0);
    setSelectedChoices({});
  }, [moduleName]);

  // 2) Subscribe to diagnostic doc (timer + responses)
  useEffect(() => {
    if (!db || !userId) return;

    const diagRef = doc(
      db,
      'artifacts',
      APP_ID,
      'users',
      userId,
      'diagnostics',
      'math'
    );

    const unsub = onSnapshot(diagRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDiagDoc(data);

        if (data.currentModule === moduleName && data.currentModuleExpiresAt) {
          const expires = data.currentModuleExpiresAt.toDate
            ? data.currentModuleExpiresAt.toDate()
            : new Date(data.currentModuleExpiresAt);
          const now = new Date();
          const diffSec = Math.max(0, Math.floor((expires - now) / 1000));
          setRemainingSeconds(diffSec);
        }
      }
    });

    return () => unsub();
  }, [db, userId, moduleName]);

  // 3) Prefill selected choices from saved responses
  useEffect(() => {
    if (!diagDoc || !questions.length) return;

    const moduleResponses = (diagDoc.responses || []).filter(
      (r) => r.module === moduleName
    );

    const initialSelected = {};
    for (const r of moduleResponses) {
      if (r.selectedChoiceLabel != null) {
        initialSelected[r.questionId] = r.selectedChoiceLabel;
      }
    }
    setSelectedChoices(initialSelected);
  }, [diagDoc, questions, moduleName]);

  // 4) Start Routing module timer on first load
  useEffect(() => {
    if (!db || !userId) return;
    if (moduleName === 'Routing') {
      startMathModule(db, userId, 'Routing', MODULE_DUR_SEC).catch(
        console.error
      );
    }
  }, [db, userId, moduleName]);

  // 5) Handle timeout logic
  const handleModuleTimeout = useCallback(async () => {
    if (!db || !userId) return;
    try {
      if (moduleName === 'Routing') {
        const { stage2ModuleId } = await handleRoutingTimeout(db, userId);
        if (stage2ModuleId) {
          setModuleName(stage2ModuleId);
          await startMathModule(db, userId, stage2ModuleId, MODULE_DUR_SEC);
          setRemainingSeconds(MODULE_DUR_SEC);
        }
      } else if (moduleName.startsWith('Stage2_')) {
        const result = await finalizeStage2AndComputeMastery(
          db,
          userId,
          moduleName
        );
        setSummaryData(result);
        setShowSummary(true);
      }
    } catch (err) {
      console.error('Error handling module timeout:', err);
    }
  }, [db, userId, moduleName]);

  // 6) Local countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const intervalId = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          handleModuleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [remainingSeconds, handleModuleTimeout]);

  // 7) Handle answer select
  const handleSelectChoice = async (choiceLabel) => {
    const question = questions[currentIndex];
    if (!question || !db || !userId) return;

    setSelectedChoices((prev) => ({
      ...prev,
      [question.questionId]: choiceLabel,
    }));

    const scored = scoreMathResponse(question, {
      questionId: question.questionId,
      selectedChoiceLabel: choiceLabel,
      timeTakenMs: null,
    });

    try {
      await saveMathResponse(db, userId, scored);
    } catch (err) {
      console.error('Error saving response:', err);
    }
  };

  // 8) Navigation
  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  // 9) Submit module
  const handleSubmitModule = async () => {
    if (!db || !userId || !questions.length) return;

    setIsSubmittingModule(true);
    const questionIds = questions.map((q) => q.questionId);
    const responses = diagDoc?.responses || [];

    const unanswered = getUnansweredQuestions(
      questionIds,
      responses,
      moduleName
    );

    if (unanswered.length > 0) {
      const ok = window.confirm(
        `You have ${unanswered.length} unanswered question(s). These will count as incorrect. Submit anyway?`
      );
      if (!ok) {
        setIsSubmittingModule(false);
        return;
      }
    }

    try {
      if (moduleName === 'Routing') {
        const { stage2ModuleId } = await finalizeRoutingOnSubmit(db, userId);
        if (stage2ModuleId) {
          setModuleName(stage2ModuleId);
          await startMathModule(db, userId, stage2ModuleId, MODULE_DUR_SEC);
          setRemainingSeconds(MODULE_DUR_SEC);
        }
      } else if (moduleName.startsWith('Stage2_')) {
        const result = await finalizeStage2AndComputeMastery(
          db,
          userId,
          moduleName
        );
        setSummaryData(result);
        setShowSummary(true);
      }
    } catch (err) {
      console.error('Error submitting module:', err);
    } finally {
      setIsSubmittingModule(false);
    }
  };

  // 10) Derived UI data
  const currentQuestion = questions[currentIndex] || null;
  const selected =
    currentQuestion && selectedChoices[currentQuestion.questionId] != null
      ? selectedChoices[currentQuestion.questionId]
      : null;

  const totalQuestions = questions.length || 1;
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const showDesmosCalculator = !!(currentQuestion?.skillId?.startsWith('M_'));

  // If the diagnostic is already completed in Firestore and the user hasn't
// acknowledged the summary yet, show the summary (survives refresh/remount).
useEffect(() => {
  if (!diagDoc) return;

  const summarySeen =
    !!userProfile?.diagnosticMathSummarySeen || !!userProfile?.hasTakenDiagnostic;

  if (diagDoc.status === 'completed' && !summarySeen) {
    if (diagDoc.recommendedSkills && diagDoc.skillStats) {
      setSummaryData({
        recommendedSkills: diagDoc.recommendedSkills,
        skillStats: diagDoc.skillStats,
        masteryBySkillId: diagDoc.masteryBySkillId || {},
      });
      setShowSummary(true);
    }
  }
}, [diagDoc, userProfile]);

  // 11) SUMMARY RENDER (after all hooks)
  if (showSummary && summaryData) {
    const { recommendedSkills, skillStats } = summaryData;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-white shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100 p-10">
          <h2 className="text-gray-900 font-serif text-2xl mb-2">
            Diagnostic Summary
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Temporary summary. Your mastery has been saved, and your Daily 5
            skill is ready on the dashboard.
          </p>

          <div className="mb-8">
            <h3 className="text-gray-700 text-xs tracking-widest uppercase font-semibold mb-3">
              Recommended Practice Skills
            </h3>
            {recommendedSkills?.length ? (
              <div className="flex flex-wrap gap-2">
                {recommendedSkills.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                No specific recommendations found.
              </p>
            )}
          </div>

          <div className="mb-10">
            <h3 className="text-gray-700 text-xs tracking-widest uppercase font-semibold mb-3">
              Mastery by Skill (preview)
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-2">
              {skillStats.slice(0, 12).map((row) => (
                <div
                  key={row.skillId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="text-sm text-gray-700">{row.skillId}</div>
                  <div className="text-xs text-gray-500">
                    {row.masteryLevel} ·{' '}
                    {Math.round(row.pointsAccuracy * 100)}% ({row.correct}/
                    {row.total})
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={async () => {
                try {
                  const profileRef = doc(
                    db,
                    'artifacts',
                    APP_ID,
                    'users',
                    userId,
                    'profile',
                    'data'
                  );
                  await updateDoc(profileRef, {
                    diagnosticMathSummarySeen: true,
                  });
                } catch (e) {
                  console.error('Error marking diagnostic summary seen:', e);
                }
              }}
              
              className="px-6 py-3 rounded-full bg-[#1e82ff] text-white text-sm font-semibold tracking-widest uppercase hover:bg-[#1663c3] transition-colors"
            >
              Go to Practice Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 12) MAIN DIAGNOSTIC RENDER
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="w-full max-w-3xl flex justify-between itemscenter mb-6">
        <div className="flex flex-col">
          <h2 className="text-gray-400 text-xs tracking-widest uppercase font-semibold">
            Math Diagnostic
          </h2>
          <p className="text-sm font-medium text-[#1e82ff]">
            {moduleName === 'Routing' ? 'Routing Module' : 'Stage 2 Module'} ·{' '}
            Question {currentIndex + 1} of {totalQuestions}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-gray-500">
            Time left: <span className="font-semibold">{timeLabel}</span>
          </span>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-red-500 text-xs uppercase tracking-widest transition-colors"
          >
            Quit
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-3xl bg-white shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden border border-gray-100 relative">
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-100">
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: BRAND_BLUE,
            }}
          ></div>
        </div>

        <div className="p-8 md:p-12">
          {!currentQuestion ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-60">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-[#1e82ff] rounded-full animate-spin"></div>
              <p className="mt-4 text-xs font-medium text-gray-400 uppercase tracking-widest">
                Loading questions...
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stimulus card */}
              <div className="p-6 md:p-8 bg-[#f9fafb] rounded-xl border border-gray-100 relative">
                {currentQuestion.stimulus && (
                  <div className="text-lg md:text-xl text-gray-900 leading-relaxed font-serif">
                    <MathText text={currentQuestion.stimulus} />
                  </div>
                )}
              </div>

              {/* Choices */}
              <div className="grid grid-cols-1 gap-4">
                {currentQuestion.choices.map((choice) => {
                  const letter = choice.label;
                  const isSelected = selected === letter;

                  const stateStyle = isSelected
                    ? 'bg-[#1e82ff]/5 border-[#1e82ff] text-[#1e82ff]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#1e82ff] hover:text-[#1e82ff] hover:bg-[#1e82ff]/5';

                  return (
                    <button
                      key={letter}
                      className={`w-full text-left p-4 md:p-5 rounded-xl border transition-all duration-200 group ${stateStyle}`}
                      onClick={() => handleSelectChoice(letter)}
                    >
                      <div className="flex items-center">
                        <span className="flex-shrink-0 w-8 h-8 flex itemscenter justify-center rounded-full border text-sm font-serif mr-4 border-current opacity-60">
                          {letter}
                        </span>
                        <span className="font-serif text-lg leading-snug">
                          <MathText text={String(choice.value)} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Navigation / Submit */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <button
                  onClick={goNext}
                  disabled={currentIndex === totalQuestions - 1}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>

              <div className="flex justify-center mt-8">
                <button
                  onClick={handleSubmitModule}
                  disabled={isSubmittingModule}
                  className="px-6 py-3 text-sm font-semibold uppercase tracking-widest rounded-full bg-[#1e82ff] text-white hover:bg-[#1663c3] disabled:opacity-50 shadow-md"
                >
                  {moduleName === 'Routing'
                    ? 'Submit Routing'
                    : 'Submit Stage 2'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <DesmosDraggable show={showDesmosCalculator} />
    </div>
  );
};

export default DiagnosticPage;
