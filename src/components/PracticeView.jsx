import React, { useState, useEffect } from 'react';
import MathText from './MathText';
import { addDoc, collection, doc, updateDoc} from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import DesmosPanel from './DesmosPanel';



const PracticeView = ({
  activeSkill,
  practiceLevel,
  setView,
  updateMastery,
  completeDailyGoal,
  isDailySession,
  initialQuestions,
  loadingLabel = '',
  errorLabel = '',
}) => {
  const { db, userId } = useFirebase(); // 🔹 pull db + userId from context

  const [flagStatus, setFlagStatus] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [pointsDelta, setPointsDelta] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const [startTime, setStartTime] = useState(Date.now());
  const [timeTaken, setTimeTaken] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const [questionList, setQuestionList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const logQuestionResult = async ({
    questionId,
    skillId,
    difficulty,
    subtype,
    isCorrect,
    timeTakenSeconds,
  }) => {
    if (!db || !userId) return;

    try {
      await addDoc(
        collection(
          db,
          'artifacts',
          APP_ID,
          'users',
          userId,
          'questionResults'
        ),
        {
          userId,
          questionId,
          skillId,
          difficulty,
          subtype: subtype || null,
          isCorrect,
          timeTakenSeconds,
          answeredAt: new Date(),
        }
      );
    } catch (err) {
      console.error('Error logging question result:', err);
    }
  };
  const handleFlagQuestion = async () => {
    if (!db || !currentQuestion?.id) {
      setFlagStatus('Cannot flag: missing question id.');
      setTimeout(() => setFlagStatus(''), 2500);
      return;
    }
  
    setIsFlagging(true);
    try {
      await updateDoc(
        doc(
          db,
          'artifacts',
          APP_ID,
          'public',
          'data',
          'questionBank',
          currentQuestion.id
        ),
        {
          flagged: true,
          flaggedAt: new Date(),
          flaggedBy: userId || null,
        }
      );
      setFlagStatus('Question flagged for review.');
    } catch (err) {
      console.error('Error flagging question:', err);
      setFlagStatus('Error flagging question.');
    } finally {
      setIsFlagging(false);
      setTimeout(() => setFlagStatus(''), 3000);
    }
  };
  
  // Initialize from bank questions
  useEffect(() => {
    if (activeSkill && initialQuestions && initialQuestions.length > 0) {
      setQuestionList(initialQuestions);
      setCurrentIndex(0);
      setCurrentQuestion({
        skillId: activeSkill.skillId,
        difficulty: practiceLevel,
        ...initialQuestions[0],
      });
      setQuestionNumber(1);
      setUserAnswer(null);
      setFeedback(null);
      setPointsDelta(0);
      setIsSlow(false);
      setSessionComplete(false);
      setCorrectCount(0);
      setStartTime(Date.now());
    }
  }, [initialQuestions, activeSkill, practiceLevel]);

  const totalQuestions = questionList.length || 5;

  const handleSubmitAnswer = async (answer) => {
    if (!currentQuestion || userAnswer) return;

    const now = Date.now();
    const duration = (now - startTime) / 1000;
    setTimeTaken(duration);

    setUserAnswer(answer);
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) setCorrectCount((prev) => prev + 1);

    const { delta, isSlow: slowFlag } = await updateMastery(
      currentQuestion.skillId || activeSkill.skillId,
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

    // Log result to Firestore
    await logQuestionResult({
      questionId: currentQuestion.id || null,
      skillId: currentQuestion.skillId || activeSkill.skillId,
      difficulty: practiceLevel,
      subtype: currentQuestion.subtype || null,
      isCorrect,
      timeTakenSeconds: duration,
    });
  };

  const handleNextQuestion = async () => {
    if (questionNumber >= totalQuestions) {
      setSessionComplete(true);
      if (isDailySession && totalQuestions > 0) {
        const finalScore = (correctCount / totalQuestions) * 100;
        await completeDailyGoal(finalScore);
      }
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < questionList.length) {
      setCurrentIndex(nextIndex);
      setCurrentQuestion({
        skillId: activeSkill.skillId,
        difficulty: practiceLevel,
        ...questionList[nextIndex],
      });
      setQuestionNumber((prev) => prev + 1);
      setUserAnswer(null);
      setFeedback(null);
      setPointsDelta(0);
      setIsSlow(false);
      setStartTime(Date.now());
    } else {
      // If somehow we run out early, just finish
      setSessionComplete(true);
      if (isDailySession && questionList.length > 0) {
        const finalScore = (correctCount / questionList.length) * 100;
        await completeDailyGoal(finalScore);
      }
    }
  };

  // Session complete screen
  if (sessionComplete) {
    const passed = correctCount >= Math.ceil(totalQuestions * 0.6);

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
              {correctCount}/{totalQuestions}
            </span>{' '}
            correct.
          </p>
          {isDailySession && !passed && (
            <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm mb-8">
              You need at least 60% correct to unlock the rest of the skills.
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

  // No questions available
  if (
    !loadingLabel &&
    (!initialQuestions || !initialQuestions.length || !currentQuestion)
  ) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="bg-white p-8 rounded-2xl shadow border border-gray-100 max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2 text-gray-900">
            No questions available
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            There are no banked questions for this skill yet. Please add some in
            the Admin Portal.
          </p>
          {errorLabel && (
            <p className="text-xs text-red-500 mb-2">{errorLabel}</p>
          )}
          <button
            onClick={() => setView('overview')}
            className="px-6 py-3 bg-[#1e82ff] text-white rounded-xl text-sm font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading state from Dashboard
  if (loadingLabel && (!currentQuestion || !questionList.length)) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-[#1e82ff] rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400 text-sm">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  // Normal question view
  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in-up">
      <div className="mb-6 flex justify-between items-center">
  <button
    onClick={() => setView('overview')}
    className="text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
  >
    Exit
  </button>

  <div className="flex items-center gap-3">
    {flagStatus && (
      <span className="text-[11px] text-gray-400">
        {flagStatus}
      </span>
    )}

    {currentQuestion?.id && (
      <button
        type="button"
        onClick={handleFlagQuestion}
        disabled={isFlagging}
        className="text-[11px] px-3 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isFlagging ? 'Flagging…' : 'Flag Question'}
      </button>
    )}

    <div className="text-xs font-bold text-[#1e82ff] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
      {isDailySession ? 'Daily Goal' : 'Practice Set'} • {questionNumber} /
      {totalQuestions}
    </div>
  </div>
</div>


      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden min-h-[600px] flex flex-col relative">
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
              {/* DESMOS: only show for math skills (skillId starts with "M_") */}

              {currentQuestion?.skillId?.startsWith('M_') && <DesmosPanel />}

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
                        {questionNumber === totalQuestions
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
      </div>

      {/* 🧮 Draggable Desmos calculator – only for math skills */}
      <DesmosDraggable
        show={
          !!(
            currentQuestion?.skillId?.startsWith('M_') ||
            activeSkill?.skillId?.startsWith('M_')
          )
        }
      />
    </div>
  );
};

export default PracticeView;
