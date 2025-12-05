import React from 'react';
import { BRAND_BLUE } from '../config/constants';

const OverviewView = ({
  dailySkill,
  currentDomain,
  currentMastery,
  startPractice,
  userProfile,
  SKILLS,
  isDailyComplete,
}) => (
  <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
    <div className="space-y-6">
      <div
        className={`rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative group transition-all ${
          isDailyComplete ? 'bg-green-50 border-green-200' : 'bg-white'
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-16 -mt-16 transition-transform duration-700 ease-out ${
            isDailyComplete
              ? 'bg-green-100'
              : 'bg-gradient-to-br from-[#1e82ff]/10 to-transparent group-hover:scale-110'
          }`}
        ></div>
        <div className="p-10 relative z-10">
          <div className="flex justify-between items-start mb-6">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                isDailyComplete
                  ? 'bg-green-200 text-green-800'
                  : 'bg-blue-50 text-[#1e82ff]'
              }`}
            >
              {isDailyComplete ? 'Daily Goal Complete!' : 'Daily Priority'}
            </span>
            {isDailyComplete && <span className="text-4xl">✅</span>}
          </div>
          <h2 className="text-3xl font-light text-gray-900 mb-2 leading-tight">
            {dailySkill?.name}
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            {currentDomain?.domainName}
          </p>
          <div className="space-y-6 mb-10">
            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-gray-500">Current Mastery</span>
                <span
                  className={
                    isDailyComplete ? 'text-green-600' : 'text-[#1e82ff]'
                  }
                >
                  {currentMastery}%
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isDailyComplete ? 'bg-green-500' : 'bg-[#1e82ff]'
                  }`}
                  style={{ width: `${currentMastery}%` }}
                ></div>
              </div>
            </div>
          </div>
          <button
            onClick={() => startPractice(dailySkill)}
            className={`w-full py-5 text-white text-lg font-medium rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center group ${
              isDailyComplete
                ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30'
                : 'bg-[#1e82ff] hover:shadow-blue-500/50 hover:-translate-y-1 shadow-blue-500/30'
            }`}
          >
            <span>
              {isDailyComplete
                ? 'Practice Again (Extra Credit)'
                : 'Start Daily 5 (Required)'}
            </span>
          </button>
        </div>
      </div>
    </div>
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          Skill Library
        </h3>
        {!isDailyComplete && (
          <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">
            🔒 Locked until Daily 5 done
          </span>
        )}
      </div>
      <div
        className={`space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar ${
          !isDailyComplete
            ? 'opacity-50 pointer-events-none select-none grayscale-[0.5]'
            : ''
        }`}
      >
        {SKILLS.map((skill) => {
          const m = userProfile.skillMastery[skill.skillId] || 0;
          const isFocus = skill.skillId === dailySkill?.skillId;
          return (
            <div
              key={skill.skillId}
              onClick={() => isDailyComplete && startPractice(skill)}
              className={`group flex justify-between items-center p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:shadow-md ${
                isFocus
                  ? 'bg-blue-50/50 border-blue-100 ring-2 ring-blue-100'
                  : 'bg-white border-gray-50 hover:border-[#1e82ff]'
              }`}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    m >= 80
                      ? 'bg-green-400'
                      : m >= 50
                      ? 'bg-yellow-400'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <p className="text-sm font-medium text-gray-600 truncate">
                  {skill.name}
                </p>
              </div>
              {isDailyComplete ? (
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                  {m}%
                </span>
              ) : (
                <span className="text-xs">🔒</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default OverviewView;