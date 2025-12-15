import React, { useState, useEffect } from 'react';

const DESMOS_EMBED_URL = 'https://www.desmos.com/calculator?embed';

const DesmosCalculator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleEsc = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const toggleCalculator = () => setIsOpen((prev) => !prev);
  const resetCalculator = () => setIframeKey((prev) => prev + 1);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end space-y-3 pointer-events-none">
      {isOpen && (
        <div className="w-[360px] h-[520px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-fade-in-up">
          <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-800">Desmos Calculator</p>
              <p className="text-[11px] text-gray-400">
                Same calculator you&apos;ll see on the SAT
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={resetCalculator}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition"
                aria-label="Close Desmos calculator"
              >
                ✕
              </button>
            </div>
          </div>
          <iframe
            key={iframeKey}
            src={DESMOS_EMBED_URL}
            title="Desmos Calculator"
            className="w-full h-full border-0"
            allow="fullscreen"
            loading="lazy"
          ></iframe>
        </div>
      )}
      <button
        type="button"
        onClick={toggleCalculator}
        aria-expanded={isOpen}
        className={`pointer-events-auto flex items-center px-5 py-3 rounded-full text-sm font-semibold shadow-lg shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e82ff] transition-all ${
          isOpen ? 'bg-gray-900 hover:bg-black text-white' : 'bg-[#1e82ff] hover:bg-[#1669cc] text-white'
        }`}
      >
        {isOpen ? 'Hide Calculator' : 'Open Calculator'}
      </button>
    </div>
  );
};

export default DesmosCalculator;
