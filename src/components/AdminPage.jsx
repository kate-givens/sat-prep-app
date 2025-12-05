import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';

const AdminPage = ({ setView }) => {
  const { db, SKILLS, resetAccount } = useFirebase();
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0].skillId);
  const [difficulty, setDifficulty] = useState('Medium');
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Admin Seed Portal</h2>
          <button onClick={() => setView('login')} className="text-gray-400 hover:text-gray-600">Exit</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Skill</label>
            <select
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
            >
              {SKILLS.map((s) => (
                <option key={s.skillId} value={s.skillId}>{s.name} ({s.skillId})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
            <select
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Context / Question Template</label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none h-32"
              placeholder="e.g. A car travels at x mph for y hours..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Distractor Logic</label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#1e82ff] outline-none h-24"
              placeholder="e.g. Students often confuse slope with y-intercept..."
              value={distractorLogic}
              onChange={(e) => setDistractorLogic(e.target.value)}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg transition-all"
          >
            Save Seed
          </button>
          
          <div className="pt-6 border-t border-gray-100">
            <button 
                onClick={resetAccount}
                className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-all border border-red-100"
            >
                ⚠ Hard Reset (Start from Zero)
            </button>
          </div>
          
          {status && <p className="text-center text-sm font-medium text-green-600">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;