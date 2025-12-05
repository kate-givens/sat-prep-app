import React, { useState, useEffect, useCallback } from 'react';
import MathText from './MathText';
import { generateSATQuestion } from '../services/aiEngine';

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

export default PracticeView;