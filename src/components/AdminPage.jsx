import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '../context/FirebaseContext.jsx';
import { APP_ID } from '../config/constants.js';
import {
  fetchDraftQuestions,
  setQuestionStatus,
  fetchFlaggedQuestions,
  updateQuestionFields,
  fetchQuestionCountsBySkill,
  deleteQuestionsBySkill,
} from '../services/questionBankService.js';

const AdminPage = ({ setView }) => {
  const { db, SKILLS } = useFirebase();
  const firstSkillId = SKILLS?.[0]?.skillId ?? '';

  const [activeTab, setActiveTab] = useState('overview');

  // ---------- Utility helpers ----------

  const getOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (!opt || typeof opt !== 'object') return String(opt ?? '');
    if (opt.text) return opt.text;
    return String(opt.label ?? '');
  };

  const groupSkillsByDomain = (skillsList) => {
    if (!skillsList) return {};
    return skillsList.reduce((acc, skill) => {
      const domain = skill.domain || 'General';
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(skill);
      return acc;
    }, {});
  };

  const groupedSkills = groupSkillsByDomain(SKILLS || []);
  const domains = Object.keys(groupedSkills).sort();

  // ---------- State ----------

  // Seed patterns
  const [selectedSkill, setSelectedSkill] = useState(firstSkillId);
  const [context, setContext] = useState('');
  const [distractorLogic, setDistractorLogic] = useState('');
  const [status, setStatus] = useState('');
  const [seedDifficulty, setSeedDifficulty] = useState('Medium');

  // Review queue
  const [reviewSkillId, setReviewSkillId] = useState(firstSkillId);
  const [reviewDifficulty, setReviewDifficulty] = useState('Medium');
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewStatus, setReviewStatus] = useState('');
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Stats overview
  const [skillCounts, setSkillCounts] = useState([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [countsStatus, setCountsStatus] = useState('');
  const [deleteSkillId, setDeleteSkillId] = useState(firstSkillId);
  const [deleteStatus, setDeleteStatus] = useState('');
  const [isDeletingSkill, setIsDeletingSkill] = useState(false);

  // Manual import
  const [importSkillId, setImportSkillId] = useState(firstSkillId);
  const [importDifficulty, setImportDifficulty] = useState('Medium');
  const [importPassage, setImportPassage] = useState('');
  const [importQuestion, setImportQuestion] = useState('');
  const [importOptions, setImportOptions] = useState(['', '', '', '']);
  const [importCorrect, setImportCorrect] = useState('A');
  const [importExplanation, setImportExplanation] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // Edit-in-place for review queue
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editForm, setEditForm] = useState({
    passageText: '',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 'A',
    explanation: '',
  });
  const [editStatus, setEditStatus] = useState('');

  // Flagged questions tab
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);
  const [isLoadingFlagged, setIsLoadingFlagged] = useState(false);
  const [flaggedStatus, setFlaggedStatus] = useState('');

  // Keep initial skill-based state in sync once SKILLS loads
  useEffect(() => {
    if (!SKILLS?.length) return;
    const firstId = SKILLS[0].skillId;
    setSelectedSkill((prev) => prev || firstId);
    setReviewSkillId((prev) => prev || firstId);
    setImportSkillId((prev) => prev || firstId);
    setDeleteSkillId((prev) => prev || firstId);
  }, [SKILLS]);

  // ---------- Overview / counts ----------

  const loadSkillCounts = async () => {
    if (!db || !SKILLS?.length) return;
    setIsLoadingCounts(true);
    setCountsStatus('Refreshing...');
    try {
      const rawCounts = await fetchQuestionCountsBySkill(db, SKILLS);
      const countsWithMeta = rawCounts.map((c) => {
        const meta = SKILLS.find((s) => s.skillId === c.skillId) || {};
        return {
          ...c,
          name: meta.name || c.skillId,
          domain: meta.domain || 'General',
        };
      });
      setSkillCounts(countsWithMeta);
      setCountsStatus('');
    } catch (e) {
      console.error(e);
      setCountsStatus('Error loading counts.');
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    if (db && SKILLS?.length) {
      loadSkillCounts();
    }
  }, [db, SKILLS]);

  const handleClearSkillQuestions = async () => {
    if (!db || !deleteSkillId) return;
    const skillMeta =
      SKILLS.find((skill) => skill.skillId === deleteSkillId) || {};
    const skillLabel = skillMeta.name
      ? `${skillMeta.name} (${skillMeta.skillId})`
      : deleteSkillId;

    const confirmed = window.confirm(
      `Delete ALL question bank entries for ${skillLabel}? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingSkill(true);
    setDeleteStatus('Deleting…');
    try {
      const removedCount = await deleteQuestionsBySkill(db, deleteSkillId);
      setDeleteStatus(
        removedCount
          ? `Deleted ${removedCount} question${removedCount === 1 ? '' : 's'}.`
          : 'No questions found for that skill.'
      );
      await loadSkillCounts();
    } catch (err) {
      console.error(err);
      setDeleteStatus('Error deleting questions. Check console.');
    } finally {
      setIsDeletingSkill(false);
      setTimeout(() => setDeleteStatus(''), 5000);
    }
  };

  // ---------- Seed patterns ----------

  const handleSaveSeed = async () => {
    if (!db) return;
    if (!context.trim() || !distractorLogic.trim()) {
      setStatus('Please fill in both fields.');
      return;
    }
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

  // ---------- Review queue (draft questions) ----------

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

  // ---------- Manual import ----------

  const handleManualImport = async () => {
    if (!db) return;

    if (!importQuestion.trim() || importOptions.some((o) => !o.trim())) {
      setImportStatus('Please fill in the question and all four answer choices.');
      return;
    }

    setImportStatus('Saving...');
    try {
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'questionBank'),
        {
          skillId: importSkillId,
          difficulty: importDifficulty,
          passageText: importPassage.trim() || null,
          questionText: importQuestion.trim(),
          options: importOptions.map((o) => o.trim()),
          correctAnswer: importCorrect,
          explanation: importExplanation.trim() || null,
          status: 'approved', // manual imports count as vetted
          createdAt: new Date(),
        }
      );
      setImportStatus('Saved!');
      setImportPassage('');
      setImportQuestion('');
      setImportOptions(['', '', '', '']);
      setImportCorrect('A');
      setImportExplanation('');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (e) {
      console.error(e);
      setImportStatus('Error saving.');
    }
  };

  // ---------- Edit-in-place for review queue ----------

  const startEditing = (q) => {
    setEditingQuestionId(q.id);
    setEditForm({
      passageText: q.passageText || '',
      questionText: q.questionText || '',
      options: (q.options || []).map(getOptionText),
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',
    });
    setEditStatus('');
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setEditForm({
      passageText: '',
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: 'A',
      explanation: '',
    });
    setEditStatus('');
  };

  const handleSaveEdit = async () => {
    if (!db || !editingQuestionId) return;
    if (!editForm.questionText.trim() || editForm.options.some((o) => !o.trim())) {
      setEditStatus('Please fill in the question and all four choices.');
      return;
    }

    setEditStatus('Saving...');
    try {
      const ref = doc(
        db,
        'artifacts',
        APP_ID,
        'public',
        'data',
        'questionBank',
        editingQuestionId
      );

      await updateDoc(ref, {
        passageText: editForm.passageText.trim() || null,
        questionText: editForm.questionText.trim(),
        options: editForm.options.map((o) => o.trim()),
        correctAnswer: editForm.correctAnswer,
        explanation: editForm.explanation.trim() || null,
        updatedAt: new Date(),
      });

      setReviewQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestionId ? { ...q, ...editForm } : q
        )
      );
      setEditStatus('Saved!');
      setTimeout(() => setEditStatus(''), 2000);
      setEditingQuestionId(null);
    } catch (e) {
      console.error(e);
      setEditStatus('Error saving.');
    }
  };

  // ---------- Flagged questions tab ----------

  const loadFlaggedQuestions = async () => {
    if (!db) return;
    setIsLoadingFlagged(true);
    setFlaggedStatus('Loading flagged questions...');
    try {
      const qs = await fetchFlaggedQuestions(db, 20);
      setFlaggedQuestions(qs);
      setFlaggedStatus(
        qs.length
          ? `Loaded ${qs.length} flagged question(s).`
          : 'No flagged questions at the moment.'
      );
    } catch (e) {
      console.error(e);
      setFlaggedStatus('Error loading flagged questions. Check console.');
    } finally {
      setIsLoadingFlagged(false);
      setTimeout(() => setFlaggedStatus(''), 4000);
    }
  };

  const updateFlaggedLocal = (id, changes) => {
    setFlaggedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...changes } : q))
    );
  };

  const handleSaveEditedFlagged = async (q) => {
    if (!db) return;
    try {
      await updateQuestionFields(db, q.id, {
        passageText: q.passageText || '',
        questionText: q.questionText || '',
        options: q.options || [],
        correctAnswer: q.correctAnswer || 'A',
        explanation: q.explanation || '',
        flagged: false,
        status: 'approved',
      });

      setFlaggedStatus('Saved & approved question.');
      setFlaggedQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch (e) {
      console.error(e);
      setFlaggedStatus('Error saving question. Check console.');
    } finally {
      setTimeout(() => setFlaggedStatus(''), 4000);
    }
  };

  const handleRejectFlaggedQuestion = async (id) => {
    if (!db) return;
    try {
      await updateQuestionFields(db, id, {
        status: 'rejected',
        flagged: false,
      });
      setFlaggedQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- Reusable UI bits ----------

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

  const SkillSelect = ({ value, onChange, label = 'Skill Target' }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 outline-none"
        >
          {domains.length === 0 && (
            <option disabled>No skills available</option>
          )}
          {domains.map((domain) => (
            <optgroup
              key={domain}
              label={domain}
              className="font-semibold text-gray-900 not-italic"
            >
              {groupedSkills[domain].map((s) => (
                <option
                  key={s.skillId}
                  value={s.skillId}
                  className="font-normal text-gray-600"
                >
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
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-white border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  // ---------- Loading gate ----------

  if (!SKILLS || !SKILLS.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <p className="text-gray-400 text-sm tracking-wider">
          Loading admin tools…
        </p>
      </div>
    );
  }

  // ---------- MAIN RENDER ----------

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
          <SidebarItem id="flagged" label="Flagged Questions" />
          <SidebarItem id="seed" label="Seed Patterns" />
          <SidebarItem id="import" label="Add Question" />
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
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Question Bank
                </h1>
                <p className="text-sm text-gray-500">
                  Inventory breakdown by difficulty and status.
                </p>
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
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Skill / Domain
                    </th>
                    <th className="text-right px-4 py-4 text-xs font-bold text-green-600 uppercase tracking-wider">
                      Easy
                    </th>
                    <th className="text-right px-4 py-4 text-xs font-bold text-amber-600 uppercase tracking-wider">
                      Med
                    </th>
                    <th className="text-right px-4 py-4 text-xs font-bold text-red-600 uppercase tracking-wider">
                      Hard
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {skillCounts.map((s) => {
                    const easy = s.difficultyStatusBreakdown?.Easy;
                    const medium = s.difficultyStatusBreakdown?.Medium;
                    const hard = s.difficultyStatusBreakdown?.Hard;

                    const formatBucket = (bucket) => {
                      if (!bucket) return '-';
                      if (bucket.total === 0) return '-';
                      return `${bucket.total} (${bucket.approved}✓ / ${bucket.draft}•)`;
                    };

                    return (
                      <tr
                        key={s.skillId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-800">
                            {s.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.domain || 'General'} •{' '}
                            <span className="font-mono">{s.skillId}</span>
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right text-xs md:text-sm text-gray-600 font-medium">
                          {formatBucket(easy)}
                        </td>
                        <td className="px-4 py-4 text-right text-xs md:text-sm text-gray-600 font-medium">
                          {formatBucket(medium)}
                        </td>
                        <td className="px-4 py-4 text-right text-xs md:text-sm text-gray-600 font-medium">
                          {formatBucket(hard)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          {s.totalCount}
                        </td>
                      </tr>
                    );
                  })}
                  {!skillCounts.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-6 text-center text-sm text-gray-400"
                      >
                        {countsStatus || 'No question data yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-gray-400 px-6 pb-4">
                Difficulty columns show:{' '}
                <span className="font-mono">
                  total (approved✓ / draft•)
                </span>
                .
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <div className="flex flex-col gap-1 mb-4">
                <h2 className="text-lg font-bold text-red-600">Danger Zone</h2>
                <p className="text-sm text-gray-500">
                  Permanently delete every question tied to a skill. This cannot be undone.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-4 items-end">
                <SkillSelect
                  label="Skill to Wipe"
                  value={deleteSkillId}
                  onChange={(e) => setDeleteSkillId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleClearSkillQuestions}
                  disabled={isDeletingSkill}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeletingSkill ? 'Deleting…' : 'Delete All Questions'}
                </button>
              </div>
              {deleteStatus && (
                <p className="text-xs text-gray-500 mt-3">{deleteStatus}</p>
              )}
            </div>
          </div>
        )}

        {/* SEED PATTERNS */}
        {activeTab === 'seed' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Create Seed Pattern
            </h1>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <SkillSelect
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                />
                <SimpleSelect
                  label="Difficulty"
                  value={seedDifficulty}
                  onChange={(e) => setSeedDifficulty(e.target.value)}
                  options={['Easy', 'Medium', 'Hard']}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Context Template
                </label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Describe the generalized scenario, passage type, tone, and clue structure..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Distractor Logic
                </label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Explain how incorrect answers should be structured and why students might choose them..."
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
                {status && (
                  <p className="text-center text-xs mt-3 text-gray-500">
                    {status}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MANUAL IMPORT */}
        {activeTab === 'import' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Add Question</h1>
            <p className="text-sm text-gray-500">
              Manually add a fully specified question directly into the bank.
            </p>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SkillSelect
                  value={importSkillId}
                  onChange={(e) => setImportSkillId(e.target.value)}
                />
                <SimpleSelect
                  label="Difficulty"
                  value={importDifficulty}
                  onChange={(e) => setImportDifficulty(e.target.value)}
                  options={['Easy', 'Medium', 'Hard']}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Passage (optional)
                </label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-28 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Any stimulus or passage text that goes before the question..."
                  value={importPassage}
                  onChange={(e) => setImportPassage(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Question Text
                </label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Full question as the student will see it..."
                  value={importQuestion}
                  onChange={(e) => setImportQuestion(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map((letter, idx) => (
                  <div key={letter} className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Choice {letter}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={importOptions[idx]}
                      onChange={(e) => {
                        const next = [...importOptions];
                        next[idx] = e.target.value;
                        setImportOptions(next);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SimpleSelect
                  label="Correct Answer"
                  value={importCorrect}
                  onChange={(e) => setImportCorrect(e.target.value)}
                  options={['A', 'B', 'C', 'D']}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Explanation (optional)
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    value={importExplanation}
                    onChange={(e) => setImportExplanation(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleManualImport}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg active:scale-[0.99]"
                >
                  Save Question
                </button>
                {importStatus && (
                  <p className="text-center text-xs mt-3 text-gray-500">
                    {importStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEW QUEUE (drafts) */}
        {activeTab === 'review' && (
          <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex gap-4 flex-1">
                <div className="w-1/2">
                  <SkillSelect
                    value={reviewSkillId}
                    onChange={(e) => setReviewSkillId(e.target.value)}
                  />
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

              {reviewQuestions.map((q) => {
                const isEditing = editingQuestionId === q.id;

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                          {q.skillId}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            q.difficulty === 'Hard'
                              ? 'bg-red-50 text-red-700'
                              : q.difficulty === 'Medium'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <button
                          onClick={() => startEditing(q)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() =>
                            handleSetQuestionStatus(q.id, 'rejected')
                          }
                          className="text-xs font-bold text-red-600 hover:text-red-800"
                        >
                          REJECT
                        </button>
                        <button
                          onClick={() =>
                            handleSetQuestionStatus(q.id, 'approved')
                          }
                          className="text-xs font-bold text-green-600 hover:text-green-800"
                        >
                          APPROVE
                        </button>
                      </div>
                    </div>

                    {/* Passage */}
                    {q.passageText && !isEditing && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 italic border-l-4 border-gray-200">
                        {q.passageText}
                      </div>
                    )}

                    {/* Question text */}
                    {!isEditing ? (
                      <h3 className="text-base font-medium text-gray-900 mb-4 leading-relaxed">
                        {q.questionText}
                      </h3>
                    ) : (
                      <div className="space-y-1.5 mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Question Text
                        </label>
                        <textarea
                          className="w-full p-3 border border-gray-200 rounded-lg text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                          value={editForm.questionText}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              questionText: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}

                    {/* Options */}
                    {!isEditing ? (
                      <div className="space-y-2 mb-6">
                        {q.options?.map((opt, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const isCorrect = letter === q.correctAnswer;
                          const optionText = getOptionText(opt);

                          return (
                            <div
                              key={letter}
                              className={`flex p-3 rounded-lg text-sm transition-colors ${
                                isCorrect
                                  ? 'bg-green-50 border border-green-200 text-green-900 font-medium'
                                  : 'bg-white border border-gray-200 text-gray-600'
                              }`}
                            >
                              <span
                                className={`font-mono font-bold mr-3 ${
                                  isCorrect ? 'text-green-700' : 'text-gray-400'
                                }`}
                              >
                                {letter}.
                              </span>
                              <span>{optionText}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {['A', 'B', 'C', 'D'].map((letter, idx) => (
                          <div key={letter} className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Choice {letter}
                            </label>
                            <input
                              type="text"
                              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={editForm.options[idx] || ''}
                              onChange={(e) => {
                                const next = [...editForm.options];
                                next[idx] = e.target.value;
                                setEditForm((prev) => ({
                                  ...prev,
                                  options: next,
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Explanation */}
                    {!isEditing ? (
                      q.explanation && (
                        <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                          <span className="font-bold text-gray-900 uppercase tracking-wide mr-2">
                            Explanation:
                          </span>
                          {q.explanation}
                        </div>
                      )
                    ) : (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Passage (optional)
                          </label>
                          <textarea
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={editForm.passageText}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                passageText: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Explanation (optional)
                          </label>
                          <textarea
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={editForm.explanation}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                explanation: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <SimpleSelect
                            label="Correct Answer"
                            value={editForm.correctAnswer}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                correctAnswer: e.target.value,
                              }))
                            }
                            options={['A', 'B', 'C', 'D']}
                          />
                          <div className="flex gap-3 ml-4 mt-4 md:mt-7">
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>

                        {editStatus && (
                          <p className="text-xs text-gray-500 mt-2">
                            {editStatus}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FLAGGED QUESTIONS */}
        {activeTab === 'flagged' && (
          <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Flagged Questions
                </h1>
                <p className="text-sm text-gray-500">
                  Questions students flagged as confusing, buggy, or unfair.
                </p>
              </div>
              <button
                onClick={loadFlaggedQuestions}
                disabled={isLoadingFlagged}
                className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-md h-fit"
              >
                {isLoadingFlagged ? 'Loading…' : 'Load Flagged'}
              </button>
            </div>

            {flaggedStatus && (
              <p className="text-xs text-gray-500">{flaggedStatus}</p>
            )}

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {!flaggedQuestions.length && !isLoadingFlagged && (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                  No flagged questions.
                </div>
              )}

              {flaggedQuestions.map((q) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                          {q.skillId}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            q.difficulty === 'Hard'
                              ? 'bg-red-50 text-red-700'
                              : q.difficulty === 'Medium'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>
                      {q.flagReason && (
                        <p className="text-[11px] text-red-500">
                          Student note: {q.flagReason}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectFlaggedQuestion(q.id)}
                        className="px-3 py-1 text-[11px] font-bold text-red-600 border border-red-100 rounded-lg hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleSaveEditedFlagged(q)}
                        className="px-3 py-1 text-[11px] font-bold text-green-600 border border-green-100 rounded-lg hover:bg-green-50"
                      >
                        Approve
                      </button>
                    </div>
                  </div>

                  {/* Editable fields for flagged question */}
                  {q.passageText !== undefined && (
                    <div className="space-y-1.5 mb-3">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Passage (optional)
                      </label>
                      <textarea
                        className="w-full p-3 border border-gray-200 rounded-lg text-xs h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={q.passageText || ''}
                        onChange={(e) =>
                          updateFlaggedLocal(q.id, {
                            passageText: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 mb-3">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Question Text
                    </label>
                    <textarea
                      className="w-full p-3 border border-gray-200 rounded-lg text-xs h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      value={q.questionText || ''}
                      onChange={(e) =>
                        updateFlaggedLocal(q.id, {
                          questionText: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    {['A', 'B', 'C', 'D'].map((letter, idx) => (
                      <div key={letter} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          Choice {letter}
                        </label>
                        <input
                          type="text"
                          className="w-full p-3 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                          value={(q.options && q.options[idx]) || ''}
                          onChange={(e) => {
                            const next = [...(q.options || ['', '', '', ''])];
                            next[idx] = e.target.value;
                            updateFlaggedLocal(q.id, { options: next });
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <SimpleSelect
                      label="Correct Answer"
                      value={q.correctAnswer || 'A'}
                      onChange={(e) =>
                        updateFlaggedLocal(q.id, {
                          correctAnswer: e.target.value,
                        })
                      }
                      options={['A', 'B', 'C', 'D']}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Explanation (optional)
                    </label>
                    <textarea
                      className="w-full p-3 border border-gray-200 rounded-lg text-xs h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      value={q.explanation || ''}
                      onChange={(e) =>
                        updateFlaggedLocal(q.id, {
                          explanation: e.target.value,
                        })
                      }
                    />
                  </div>
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
