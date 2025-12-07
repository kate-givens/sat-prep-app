import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import { generateQuestionsToBank } from '../services/questionBankService';


const AdminPage = ({ setView }) => {
  const { db, SKILLS } = useFirebase();

  // Existing seed form state...
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0].skillId);
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');

  // NEW: generation form state
  const [genSkillId, setGenSkillId] = useState(SKILLS[0].skillId);
  const [genDifficulty, setGenDifficulty] = useState('Medium');
  const [genCount, setGenCount] = useState(5);
  const [genStatus, setGenStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSave = async () => {
    if (!db) return;
    setStatus('Saving...');
    try {
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'seedQuestions'),
        {
          skillId: selectedSkill,
          difficulty,
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

          {/* your existing seed form UI goes here,
              unchanged (Target Skill, Context, Distractor Logic, Save button, status) */}
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
      </div>
    </div>
  );
};

export default AdminPage;