'use client';

interface VoiceSheetProps {
  selected: 'her' | 'him';
  onSelect: (voice: 'her' | 'him') => void;
  onClose: () => void;
}

export function VoiceSheet({ selected, onSelect, onClose }: VoiceSheetProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-end justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-t-2xl px-6 pt-6 pb-10 border-t border-white/5" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-medium text-white text-center mb-6">Choose a voice</h2>
        
        <div className="flex flex-col gap-3 mb-8">
          <button
            onClick={() => { onSelect('her'); onClose(); }}
            className={`text-left px-4 py-3 rounded-xl transition-all ${
              selected === 'her'
                ? 'bg-white/10 ring-1 ring-white/20'
                : 'bg-white/5 hover:bg-white/8'
            }`}
          >
            <span className="text-sm text-white">Her</span>
            <span className="block text-xs text-slate-400 mt-0.5">A calm, warm voice.</span>
          </button>
          <button
            onClick={() => { onSelect('him'); onClose(); }}
            className={`text-left px-4 py-3 rounded-xl transition-all ${
              selected === 'him'
                ? 'bg-white/10 ring-1 ring-white/20'
                : 'bg-white/5 hover:bg-white/8'
            }`}
          >
            <span className="text-sm text-white">Him</span>
            <span className="block text-xs text-slate-400 mt-0.5">A steady, gentle voice.</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-full bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
