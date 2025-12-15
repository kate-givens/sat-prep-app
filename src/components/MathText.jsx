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

    const escapeCurrency = (input) =>
      input.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, (match, amount, offset, full) => {
        const nextChar = full[offset + match.length] || '';
        if (nextChar === '$') return match; // part of $...$ block
        if (/[A-Za-z]/.test(nextChar)) return match; // likely math, e.g. $2x
        return `&dollar;${amount}`;
      });

    const sanitized = escapeCurrency(text);
    const parts = sanitized.split(/(\$[^$]+\$)/g);

    const renderedHtml = parts
      .map((part) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const inner = part.slice(1, -1).trim();
          const looksLikeCurrency = /^[\d\s.,]+$/.test(inner);
          if (looksLikeCurrency) {
            return part; // treat as literal currency, not LaTeX
          }
          try {
            const math = inner;
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
