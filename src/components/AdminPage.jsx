import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import {
  generateQuestionsToBank,
  fetchDraftQuestions,
  setQuestionStatus,
} from '../services/questionBankService';


const AdminPage = ({ setView }) => {
  const { db, SKILLS } = useFirebase();

  // Existing seed form state...
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0].skillId);
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');
  const [seedDifficulty, setSeedDifficulty] = useState('Medium'); //

  // NEW: generation form state
  const [genSkillId, setGenSkillId] = useState(SKILLS[0].skillId);
  const [genDifficulty, setGenDifficulty] = useState('Medium');
  const [genCount, setGenCount] = useState(5);
  const [genStatus, setGenStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [reviewSkillId, setReviewSkillId] = useState(SKILLS[0].skillId);
  const [reviewDifficulty, setReviewDifficulty] = useState('Medium');
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewStatus, setReviewStatus] = useState('');
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const handleSave = async () => {
    if (!db) return;
    setStatus('Saving...');
    try {
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'seedQuestions'),
        {
          skillId: selectedSkill,
          difficulty: seedDifficulty,
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

  const loadDraftQuestions = async () => {
    if (!db) return;
    setIsLoadingReview(true);
    setReviewStatus('Loading draft questions...');

    try {
      const qs = await fetchDraftQuestions(
        db,
        reviewSkillId,
        reviewDifficulty,
        5
      );
      setReviewQuestions(qs);
      setReviewStatus(
        qs.length
          ? `Loaded ${qs.length} draft question(s).`
          : 'No draft questions for this skill/difficulty.'
      );
    } catch (e) {
      console.error(e);
      setReviewStatus('Error loading questions. Check console.');
    } finally {
      setIsLoadingReview(false);
      setTimeout(() => setReviewStatus(''), 4000);
    }
  };

  const handleSetQuestionStatus = async (id, status) => {
    if (!db) return;
    try {
      await setQuestionStatus(db, id, status);
      setReviewQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      console.error(e);
      // optional: surface an error
    }
  };


  const handleGenerateQuestions = async () => {
    if (!db) return;

    const skill = SKILLS.find((s) => s.skillId === genSkillId);
    if (!skill) {
      setGenStatus('Unknown skill.');
      return;
    }

    setIsGenerating(true);
    setGenStatus('Generating questions...');

    try {
      const created = await generateQuestionsToBank(
        db,
        skill,
        genDifficulty,
        Number(genCount) || 5
      );
      setGenStatus(`Generated ${created.length} questions (saved as draft).`);
    } catch (e) {
      console.error(e);
      setGenStatus('Error generating questions. Check console.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenStatus(''), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Admin Portal
          </h2>
          <button
            onClick={() => setView('login')}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Exit
          </button>
        </div>

        {/* === Existing Seed Builder Panel === */}
        <section className="space-y-4 border-b border-gray-100 pb-8">
  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
    Seed Patterns
  </h3>

  <div className="space-y-4">
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Target Skill
      </label>
      <select
        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
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
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Seed Difficulty
      </label>
      <select
        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
        value={seedDifficulty}
        onChange={(e) => setSeedDifficulty(e.target.value)}
      >
        <option>Easy</option>
        <option>Medium</option>
        <option>Hard</option>
      </select>
    </div>

    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Context / Question Template
      </label>
      <textarea
        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm h-24"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
    </div>

    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Distractor Logic
      </label>
      <textarea
        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm h-24"
        value={distractorLogic}
        onChange={(e) => setDistractorLogic(e.target.value)}
      />
    </div>

    <button
      onClick={handleSave}
      className="w-full py-3 rounded-xl text-sm font-medium text-white bg-gray-800 hover:bg-black transition-all"
    >
      Save Seed
    </button>

    {status && (
      <p className="text-xs text-center text-gray-600">{status}</p>
    )}
  </div>
</section>


        {/* === NEW Question Generator Panel === */}
        <section className="space-y-4 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
            Generate Questions to Bank
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Skill
              </label>
              <select
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                value={genSkillId}
                onChange={(e) => setGenSkillId(e.target.value)}
              >
                {SKILLS.map((s) => (
                  <option key={s.skillId} value={s.skillId}>
                    {s.name} ({s.skillId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Difficulty
              </label>
              <select
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                value={genDifficulty}
                onChange={(e) => setGenDifficulty(e.target.value)}
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Number of Questions
              </label>
              <input
                type="number"
                min="1"
                max="100"
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleGenerateQuestions}
            disabled={isGenerating}
            className={`w-full py-3 rounded-xl text-sm font-medium text-white transition-all ${
              isGenerating
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-[#1e82ff] hover:bg-blue-600 shadow-md shadow-blue-500/30'
            }`}
          >
            {isGenerating ? 'Generating…' : 'Generate Questions'}
          </button>

          {genStatus && (
            <p className="text-xs text-center text-gray-600">{genStatus}</p>
          )}
        </section>

                {/* === NEW Question Review Panel === */}
                <section className="space-y-4 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
            Review Draft Questions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Skill
              </label>
              <select
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                value={reviewSkillId}
                onChange={(e) => setReviewSkillId(e.target.value)}
              >
                {SKILLS.map((s) => (
                  <option key={s.skillId} value={s.skillId}>
                    {s.name} ({s.skillId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Difficulty
              </label>
              <select
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
                value={reviewDifficulty}
                onChange={(e) => setReviewDifficulty(e.target.value)}
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadDraftQuestions}
                disabled={isLoadingReview}
                className={`w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all ${
                  isLoadingReview
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-black'
                }`}
              >
                {isLoadingReview ? 'Loading…' : 'Load Drafts'}
              </button>
            </div>
          </div>

          {reviewStatus && (
            <p className="text-xs text-center text-gray-600">{reviewStatus}</p>
          )}

          <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {reviewQuestions.map((q) => (
              <div
                key={q.id}
                className="border border-gray-100 rounded-xl p-4 bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-mono text-gray-400">
                      {q.skillId} • {q.difficulty}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {q.itemStructureType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSetQuestionStatus(q.id, 'approved')}
                      className="px-3 py-1 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleSetQuestionStatus(q.id, 'rejected')}
                      className="px-3 py-1 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {q.passageText && (
                  <p className="text-xs text-gray-600 mb-2 whitespace-pre-line">
                    {q.passageText}
                  </p>
                )}

                <p className="text-sm font-medium text-gray-900 mb-2">
                  {q.questionText}
                </p>

                <ul className="text-xs text-gray-700 mb-2 space-y-1">
                  {q.options?.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = letter === q.correctAnswer;
                    return (
                      <li key={letter}>
                        <span className="font-mono mr-1">{letter}.</span>
                        <span className={isCorrect ? 'font-semibold' : ''}>
                          {opt}
                        </span>
                        {isCorrect && (
                          <span className="ml-1 text-[10px] text-green-600">
                            (correct)
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {q.explanation && (
                  <p className="text-[11px] text-gray-500 whitespace-pre-line">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}

            {!reviewQuestions.length && !isLoadingReview && (
              <p className="text-xs text-gray-400 text-center">
                No draft questions loaded yet.
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default AdminPage;