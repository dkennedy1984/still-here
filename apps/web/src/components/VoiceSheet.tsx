'use client';

import clsx from 'clsx';

interface VoiceSheetProps {
  selected: 'her' | 'him';
  onSelect: (voice: 'her' | 'him') => void;
  onClose: () => void;
}

const options: { value: 'her' | 'him'; title: string; subtitle: string }[] = [
  {
    value: 'her',
    title: 'Her',
    subtitle: 'A calm, warm voice.',
  },
  {
    value: 'him',
    title: 'Him',
    subtitle: 'A steady, gentle voice.',
  },
];

export function VoiceSheet({ selected, onSelect, onClose }: VoiceSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md animate-slide-up rounded-t-2xl bg-slate-900 px-6 pb-8 pt-6">
        <h2 className="mb-6 text-center text-lg font-semibold text-white">
          Choose a voice
        </h2>

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => { onSelect(option.value); onClose(); }}
              className={clsx(
                'w-full rounded-xl border p-4 text-left transition-all',
                selected === option.value
                  ? 'border-white bg-white/5'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
              )}
            >
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-1 text-sm text-slate-400">{option.subtitle}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-slate-800 py-3 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
