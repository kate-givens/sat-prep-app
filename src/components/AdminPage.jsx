import React, { useState, useEffect } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import {
  generateQuestionsToBank,
  fetchDraftQuestions,
  setQuestionStatus,
  fetchQuestionCountsBySkill,
} from '../services/questionBankService';

const AdminPage = ({ setView }) => {
  const { db, SKILLS } = useFirebase();
  const [activeTab, setActiveTab] = useState('overview');

  // --- 1. DATA PROCESSING: Group Skills by Domain ---
  const groupSkillsByDomain = (skillsList) => {
    if (!skillsList) return {};
    return skillsList.reduce((acc, skill) => {
      // If your skill object doesn't have a 'domain' property, 
      // it will group under "General"
      const domain = skill.domain || 'General'; 
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(skill);
      return acc;
    }, {});
  };

  const groupedSkills = groupSkillsByDomain(SKILLS);
  const domains = Object.keys(groupedSkills).sort();

  // --- STATE ---
  
  // Seed State
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0]?.skillId || '');
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');
  const [seedDifficulty, setSeedDifficulty] = useState('Medium');

  // Generation State
  const [genSkillId, setGenSkillId] = useState(SKILLS[0]?.skillId || '');
  const [genDifficulty, setGenDifficulty] = useState('Medium');
  const [genCount, setGenCount] = useState(5);
  const [genStatus, setGenStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Review State
  const [reviewSkillId, setReviewSkillId] = useState(SKILLS[0]?.skillId || '');
  const [reviewDifficulty, setReviewDifficulty] = useState('Medium');
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewStatus, setReviewStatus] = useState('');
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Stats State
  const [skillCounts, setSkillCounts] = useState([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [countsStatus, setCountsStatus] = useState('');

  // --- HANDLERS ---

  const loadSkillCounts = async () => {
    if (!db) return;
    setIsLoadingCounts(true);
    setCountsStatus('Refreshing...');
    try {
      const counts = await fetchQuestionCountsBySkill(db, SKILLS);
      // Ensure your service returns structure like: 
      // { skillId, totalCount, difficultyBreakdown: { Easy: 5, Medium: 2, Hard: 1 } }
      setSkillCounts(counts);
      setCountsStatus('');
    } catch (e) {
      console.error(e);
      setCountsStatus('Error loading counts.');
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    if (db) loadSkillCounts();
  }, [db]);

  const handleSaveSeed = async () => {
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
      setStatus('Success');
      setContext('');
      setDistractorLogic('');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      console.error(e);
      setStatus('Error');
    }
  };

  const loadDraftQuestions = async () => {
    if (!db) return;
    setIsLoadingReview(true);
    setReviewStatus('Loading...');
    try {
      const qs = await fetchDraftQuestions(db, reviewSkillId, reviewDifficulty, 5);
      setReviewQuestions(qs);
      setReviewStatus(qs.length ? '' : 'No drafts found.');
    } catch (e) {
      console.error(e);
      setReviewStatus('Error loading.');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleSetQuestionStatus = async (id, status) => {
    if (!db) return;
    try {
      await setQuestionStatus(db, id, status);
      setReviewQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!db) return;
    const skill = SKILLS.find((s) => s.skillId === genSkillId);
    if (!skill) return;

    setIsGenerating(true);
    setGenStatus('Generating...');
    try {
      const created = await generateQuestionsToBank(db, skill, genDifficulty, Number(genCount) || 5);
      setGenStatus(`Generated ${created.length} drafts.`);
    } catch (e) {
      console.error(e);
      setGenStatus('Error generating.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenStatus(''), 4000);
    }
  };

  // --- REUSABLE UI COMPONENTS ---

  const SidebarItem = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
        activeTab === id
          ? 'bg-gray-900 text-white shadow-md'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );

  const SkillSelect = ({ value, onChange }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Skill Target</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 outline-none"
        >
          {domains.map((domain) => (
            <optgroup key={domain} label={domain} className="font-semibold text-gray-900 not-italic">
              {groupedSkills[domain].map((s) => (
                <option key={s.skillId} value={s.skillId} className="font-normal text-gray-600">
                   {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );

  const SimpleSelect = ({ label, value, onChange, options }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
            ADMIN<span className="text-blue-600">PORTAL</span>
          </h2>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem id="overview" label="Overview" />
          <SidebarItem id="review" label="Review Queue" />
          <SidebarItem id="seed" label="Seed Patterns" />
          <SidebarItem id="generate" label="AI Generator" />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setView('login')}
            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-400 hover:text-red-600 transition-colors uppercase tracking-wider"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 max-w-7xl mx-auto">
        
        {/* VIEW: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
                <p className="text-sm text-gray-500">Inventory breakdown by difficulty and status.</p>
              </div>
              <button
                onClick={loadSkillCounts}
                disabled={isLoadingCounts}
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
              >
                {isLoadingCounts ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Skill / Domain</th>
                    {/* NEW: Difficulty Columns */}
                    <th className="text-right px-4 py-4 text-xs font-bold text-green-600 uppercase tracking-wider">Easy</th>
                    <th className="text-right px-4 py-4 text-xs font-bold text-amber-600 uppercase tracking-wider">Med</th>
                    <th className="text-right px-4 py-4 text-xs font-bold text-red-600 uppercase tracking-wider">Hard</th>
                    <th className="text-right px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {skillCounts.map((s) => {
                    // NOTE: This assumes your service returns `difficultyBreakdown` or similar keys.
                    // If your service only returns flat counts, these will default to 0.
                    const easy = s.difficultyBreakdown?.Easy || s.easyCount || '-';
                    const medium = s.difficultyBreakdown?.Medium || s.mediumCount || '-';
                    const hard = s.difficultyBreakdown?.Hard || s.hardCount || '-';
                    
                    return (
                      <tr key={s.skillId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.domain || 'General'} • <span className="font-mono">{s.skillId}</span>
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-600 font-medium">{easy}</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-600 font-medium">{medium}</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-600 font-medium">{hard}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{s.totalCount}</td>
                      </tr>
                    );
                  })}
                  {!skillCounts.length && !isLoadingCounts && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW: SEED PATTERNS */}
        {activeTab === 'seed' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Seed Pattern</h1>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <SkillSelect value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)} />
                <SimpleSelect 
                  label="Difficulty" 
                  value={seedDifficulty} 
                  onChange={(e) => setSeedDifficulty(e.target.value)} 
                  options={['Easy', 'Medium', 'Hard']}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Context Template</label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Enter the base context or question structure..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Distractor Logic</label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Explain how incorrect answers should be generated..."
                  value={distractorLogic}
                  onChange={(e) => setDistractorLogic(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSeed}
                  className="w-full py-3.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-sm transition-all shadow-lg active:scale-[0.99]"
                >
                   {status === 'Saving...' ? 'Saving...' : 'Save Seed Pattern'}
                </button>
                {status && <p className="text-center text-xs mt-3 text-gray-500">{status}</p>}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: GENERATOR */}
        {activeTab === 'generate' && (
          <div className="max-w-3xl mx-auto space-y-6">
             <h1 className="text-2xl font-bold text-gray-900">AI Generator</h1>
             
             <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SkillSelect value={genSkillId} onChange={(e) => setGenSkillId(e.target.value)} />
                  <SimpleSelect 
                    label="Difficulty" 
                    value={genDifficulty} 
                    onChange={(e) => setGenDifficulty(e.target.value)} 
                    options={['Easy', 'Medium', 'Hard']}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-lg text-sm font-bold text-white transition-all shadow-md ${
                      isGenerating
                        ? 'bg-blue-300 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
                    }`}
                  >
                    {isGenerating ? 'Generating Content...' : 'Generate Questions'}
                  </button>
                  {genStatus && (
                    <p className="mt-4 text-center text-xs text-gray-500">{genStatus}</p>
                  )}
                </div>
             </div>
          </div>
        )}

        {/* VIEW: REVIEW QUEUE */}
        {activeTab === 'review' && (
          <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <div className="flex gap-4 flex-1">
                 <div className="w-1/2">
                   <SkillSelect value={reviewSkillId} onChange={(e) => setReviewSkillId(e.target.value)} />
                 </div>
                 <div className="w-40">
                   <SimpleSelect 
                      label="Difficulty" 
                      value={reviewDifficulty} 
                      onChange={(e) => setReviewDifficulty(e.target.value)} 
                      options={['Easy', 'Medium', 'Hard']}
                    />
                 </div>
               </div>
               <button
                  onClick={loadDraftQuestions}
                  disabled={isLoadingReview}
                  className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-md h-fit"
                >
                  {isLoadingReview ? 'Loading...' : 'Load Batch'}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {reviewStatus && !reviewQuestions.length && (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
                  {reviewStatus}
                </div>
              )}

              {reviewQuestions.map((q) => (
                <div key={q.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                        {q.skillId}
                      </span>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        q.difficulty === 'Hard' ? 'bg-red-50 text-red-700' : 
                        q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700' : 
                        'bg-green-50 text-green-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSetQuestionStatus(q.id, 'rejected')}
                        className="text-xs font-bold text-red-600 hover:text-red-800"
                      >
                        REJECT
                      </button>
                      <button
                        onClick={() => handleSetQuestionStatus(q.id, 'approved')}
                        className="text-xs font-bold text-green-600 hover:text-green-800"
                      >
                        APPROVE
                      </button>
                    </div>
                  </div>

                  {q.passageText && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 italic border-l-4 border-gray-200">
                      {q.passageText}
                    </div>
                  )}

                  <h3 className="text-base font-medium text-gray-900 mb-4 leading-relaxed">
                    {q.questionText}
                  </h3>

                  <div className="space-y-2 mb-6">
                    {q.options?.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = letter === q.correctAnswer;
                      return (
                        <div 
                          key={letter} 
                          className={`flex p-3 rounded-lg text-sm transition-colors ${
                            isCorrect 
                              ? 'bg-green-50 border border-green-200 text-green-900 font-medium' 
                              : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          <span className={`font-mono font-bold mr-3 ${isCorrect ? 'text-green-700' : 'text-gray-400'}`}>
                            {letter}.
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                      <span className="font-bold text-gray-900 uppercase tracking-wide mr-2">Explanation:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminPage;