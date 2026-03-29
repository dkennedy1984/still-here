'use client';
import { useState } from 'react';

type PresenceStyle = 'quiet' | 'check-ins' | 'talk';

interface FirstCallSheetProps {
  onSelect: (style: PresenceStyle) => void;
}

export function FirstCallSheet({ onSelect }: FirstCallSheetProps) {
  const [selected, setSelected] = useState<PresenceStyle>('quiet');

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-end justify-center z-[100] backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 rounded-t-2xl px-6 pt-6 pb-10 border-t border-white/5">
        <h2 className="text-base font-medium text-white text-center mb-2">How would you like me to be?</h2>
        <p className="text-xs text-slate-500 text-center mb-6">You can change this anytime during the call.</p>
        
        <div className="flex flex-col gap-3 mb-8">
          {([
            { key: 'quiet' as PresenceStyle, label: 'Just sit quietly', desc: "I won't speak unless you do." },
            { key: 'check-ins' as PresenceStyle, label: 'Light check-ins', desc: 'A gentle nudge now and then.' },
            { key: 'talk' as PresenceStyle, label: 'Happy to talk', desc: 'You can think out loud.' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className={`text-left px-4 py-3 rounded-xl transition-all ${
                selected === s.key
                  ? 'bg-white/10 ring-1 ring-white/20'
                  : 'bg-white/5 hover:bg-white/8'
              }`}
            >
              <span className="text-sm text-white">{s.label}</span>
              <span className="block text-xs text-slate-400 mt-0.5">{s.desc}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onSelect(selected)}
          className="w-full py-4 rounded-full bg-white text-slate-900 text-base font-semibold hover:bg-white/90 active:scale-95 transition-all"
        >
          Start
        </button>
      </div>
    </div>
  );
}
