"use client";

import clsx from "clsx";

type PresenceStyle = "silent" | "check-ins" | "talk";

interface PresenceStyleSheetProps {
  selected: PresenceStyle;
  onSelect: (style: PresenceStyle) => void;
  onClose: () => void;
}

const options: { value: PresenceStyle; title: string; subtitle: string }[] = [
  {
    value: "silent",
    title: "Just sit quietly",
    subtitle: "I won't speak unless you do.",
  },
  {
    value: "check-ins",
    title: "Light check-ins",
    subtitle: "Only if you want a nudge later.",
  },
  {
    value: "talk",
    title: "Happy to talk",
    subtitle: "You can think out loud.",
  },
];

export default function PresenceStyleSheet({
  selected,
  onSelect,
  onClose,
}: PresenceStyleSheetProps) {
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
          How would you like me to be?
        </h2>

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={clsx(
                "w-full rounded-xl border p-4 text-left transition-all",
                selected === option.value
                  ? "border-white bg-white/5"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
              )}
            >
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-1 text-sm text-slate-400">{option.subtitle}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
