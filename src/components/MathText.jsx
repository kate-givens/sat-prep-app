import React, { useRef, useEffect } from 'react';
import katex from 'katex';
import { FONT_SAT } from '../config/constants';

const MathText = ({ text }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Dynamically inject CSS from CDN
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const parts = text.split(/(\$[^$]+\$)/g);

    const renderedHtml = parts
      .map((part) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          try {
            const math = part.slice(1, -1);
            return katex.renderToString(math, { throwOnError: false });
          } catch (e) {
            return part;
          }
        }
        let processed = part.replace(/\n/g, '<br />');
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return processed;
      })
      .join('');

    containerRef.current.innerHTML = renderedHtml;
  }, [text]);

  return (
    <span
      ref={containerRef}
      className="font-serif text-lg leading-relaxed"
      style={{ fontFamily: FONT_SAT }}
    />
  );
};

export default MathText;