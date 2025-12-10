import React, { useState, useRef, useEffect } from 'react';

const DesmosDraggable = ({ show = false }) => {
  const [isOpen, setIsOpen] = useState(false); // whether the calculator is visible
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // top/left in px
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Set an initial position (e.g., bottom-right-ish) after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Start near bottom-right, but not fully in the corner
    setPosition({
      x: vw - 420, // adjust to taste
      y: vh - 420,
    });
  }, []);

  // Close entirely when show becomes false
  useEffect(() => {
    if (!show) {
      setIsOpen(false);
    }
  }, [show]);

  // Handle drag start
  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    // Calculate offset between mouse and top-left corner of the panel
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  };

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setPosition((prev) => ({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // If we aren't even supposed to show the calculator for this question, render nothing
  if (!show) return null;

  return (
    <>
      {/* Floating calculator toggle button (like SAT icon) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed z-40 bottom-6 right-6 w-12 h-12 rounded-full shadow-lg bg-[#1e82ff] text-white flex items-center justify-center hover:bg-blue-600 transition-colors text-xl"
      >
        🧮
      </button>

      {/* Draggable window */}
      {isOpen && (
        <div
          ref={containerRef}
          className="fixed z-40 w-[360px] h-[420px] shadow-2xl bg-white border border-gray-200 rounded-xl overflow-hidden"
          style={{
            top: `${position.y}px`,
            left: `${position.x}px`,
          }}
        >
          {/* Header / drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className="cursor-move flex items-center justify-between px-3 py-2 bg-gray-800 text-white text-xs font-semibold uppercase tracking-widest"
          >
            <span>Calculator</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-gray-300 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          {/* Body: Desmos iframe */}
          <div className="w-full h-full bg-white">
            <iframe
              title="Desmos Calculator"
              src="https://www.desmos.com/calculator"
              style={{ width: '100%', height: '100%', border: '0' }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default DesmosDraggable;
