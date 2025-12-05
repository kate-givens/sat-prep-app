import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import MathText from '../components/MathText.jsx';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { generateSATQuestion } from '../services/aiEngine.js';
import { BRAND_BLUE, APP_ID } from '../config/constants.js';

const DiagnosticPage = () => {
  const { db, userId, userProfile, logout, SAT_STRUCTURE } = useFirebase();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [adaptiveStage, setAdaptiveStage] = useState('probe');
  const [clusterResults, setClusterResults] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const currentDomain = SAT_STRUCTURE[currentDomainIndex];

  // Helper for formatted date
  const getFormattedDate = () => new Date().toISOString().split('T')[0];

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
        doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'data'),
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

export default DiagnosticPage;