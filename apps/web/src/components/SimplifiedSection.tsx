'use client';
import { useState } from 'react';

interface SimplifiedSectionProps {
  heading: string;
  summary: string;
  children: React.ReactNode;
  simplified: boolean;
}

export function SimplifiedSection({ heading, summary, children, simplified }: SimplifiedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!simplified) {
    return <>{children}</>;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-white mb-2">{heading}</h2>
      <p className="text-slate-400 text-sm">{summary}</p>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Read more →
        </button>
      ) : (
        <div className="mt-4 text-slate-300 leading-relaxed text-sm">
          {children}
          <button
            onClick={() => setExpanded(false)}
            className="mt-2 block text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Show less ↑
          </button>
        </div>
      )}
    </div>
  );
}
