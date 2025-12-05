import React, { useState, useMemo } from 'react';
import { BRAND_BLUE } from '../config/constants';

const OverviewView = ({
  dailySkill,
  currentDomain,
  currentMastery,
  startPractice,
  userProfile,
  SKILLS,
  isDailyComplete,
}) => {
  const [openDomainId, setOpenDomainId] = useState(null); // all collapsed by default

  const skillMastery = userProfile?.skillMastery || {};

  // Group skills by domain
  const domainsWithSkills = useMemo(() => {
    const map = {};
    SKILLS.forEach((skill) => {
      const domainId = skill.domainId || 'OTHER';
      if (!map[domainId]) {
        map[domainId] = {
          domainId,
          domainName: skill.domainName || 'Other Skills',
          skills: [],
        };
      }
      map[domainId].skills.push(skill);
    });
    return Object.values(map);
  }, [SKILLS]);

  // Sort domains by lowest average mastery → highest
  const sortedDomains = useMemo(() => {
    return [...domainsWithSkills].sort((a, b) => {
      const masteryA = a.skills.map((s) => skillMastery[s.skillId] || 0);
      const masteryB = b.skills.map((s) => skillMastery[s.skillId] || 0);

      const avgA =
        masteryA.length > 0
          ? masteryA.reduce((sum, v) => sum + v, 0) / masteryA.length
          : 0;
      const avgB =
        masteryB.length > 0
          ? masteryB.reduce((sum, v) => sum + v, 0) / masteryB.length
          : 0;

      return avgA - avgB; // ascending = lowest mastery first
    });
  }, [domainsWithSkills, skillMastery]);

  const toggleDomain = (domainId) => {
    setOpenDomainId((prev) => (prev === domainId ? null : domainId));
  };

  return (
    <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
      {/* LEFT: Daily Priority card */}
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

      {/* RIGHT: Skill Library with accordion by domain */}
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
          {sortedDomains.map((domain) => {
            const masteryValues = domain.skills.map(
              (s) => skillMastery[s.skillId] || 0
            );
            const avgMastery =
              masteryValues.length > 0
                ? Math.round(
                    masteryValues.reduce((a, b) => a + b, 0) /
                      masteryValues.length
                  )
                : 0;

            const isOpen = openDomainId === domain.domainId;

            // Sort skills inside each domain by mastery (low → high)
            const sortedSkills = [...domain.skills].sort((a, b) => {
              const ma = skillMastery[a.skillId] || 0;
              const mb = skillMastery[b.skillId] || 0;
              return ma - mb;
            });

            return (
              <div key={domain.domainId} className="mb-2">
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => toggleDomain(domain.domainId)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">
                      {domain.domainName}
                    </p>
                    <p className="text-xs text-gray-400">
                      Avg mastery: {avgMastery}%
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${avgMastery}%`,
                          backgroundColor: BRAND_BLUE,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {isOpen ? '−' : '+'}
                    </span>
                  </div>
                </button>

                {/* Skills inside this domain */}
                {isOpen && (
                  <div className="space-y-2 mt-2">
                    {sortedSkills.map((skill) => {
                      const m = skillMastery[skill.skillId] || 0;
                      const isFocus =
                        skill.skillId === dailySkill?.skillId;
                      return (
                        <div
                          key={skill.skillId}
                          onClick={() =>
                            isDailyComplete && startPractice(skill)
                          }
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
