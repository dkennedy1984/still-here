'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function VirtualBodyDoublingContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Virtual body doubling — quiet company, no pressure
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Virtual coworking works for a lot of people.<br />
        But sometimes it comes with things that don&apos;t feel good:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>being on camera</li>
        <li>feeling watched</li>
        <li>feeling like you have to perform</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">
        If that&apos;s you, you&apos;re not being difficult. You&apos;re protecting your nervous system.
        This is one of the key differences between Sit With You and other platforms — read the{' '}
        <a href="/vs-focusmate" className="text-white/70 hover:text-white underline underline-offset-2">comparison with Focusmate</a> if you&apos;re curious.
      </p>

      <SimplifiedSection
        heading="If video accountability stresses you out"
        summary="Some people prefer presence without being watched."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">If video accountability stresses you out</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You&apos;re not alone</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          Many people prefer body doubling that feels like presence, not observation.
          Learn more about{' '}
          <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">what body doubling means for ADHD</a>.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="What you get here instead"
        summary="Calm, silent presence. No camera. No small talk."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">What you get here instead</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Calm presence</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          Designed to feel like someone quietly sitting beside you — nothing more.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Silence-first design</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No camera required. No check-ins. No reporting what you accomplished.
        </p>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Optional gentle support</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you want one small step suggested, you can ask. Otherwise, it stays quiet.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="When it&apos;s most useful"
        summary="Admin, emails, chores — the small stuff that feels heavy."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">When it&apos;s most useful</h2>
        <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
          <li>admin tasks that feel heavy</li>
          <li>difficult emails</li>
          <li>cleaning or tidying</li>
          <li>starting anything that keeps getting postponed</li>
        </ul>
        <p className="text-slate-300 leading-relaxed mb-6">
          You can also simply{' '}
          <a href="/call-for-company" className="text-white/70 hover:text-white underline underline-offset-2">call for company</a>{' '}
          with no specific goal at all.
        </p>
      </SimplifiedSection>
    </>
  );
}
