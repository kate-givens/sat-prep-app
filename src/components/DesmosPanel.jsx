import React, { useState } from 'react';

const DesmosPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-700 uppercase tracking-widest"
      >
        <span>Graphing Calculator</span>
        <span
          className={`transform transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        >
          ▶
        </span>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="w-full h-96 bg-white border-t border-gray-200">
          <iframe
            title="Desmos Calculator"
            src="https://www.desmos.com/calculator"
            style={{ width: '100%', height: '100%', border: '0' }}
          />
        </div>
      )}
    </div>
  );
};

export default DesmosPanel;
