'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function HowItWorksContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        How Sit With You works
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Sit With You is designed to be simple enough to use on your hardest days.
      </p>

      <SimplifiedSection
        heading="Step 1 — Tap Call"
        summary="No setup, no goals, no onboarding."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Step 1 — Tap Call</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No setup required</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No goals. No onboarding quiz. No &ldquo;choose your productivity style&rdquo;.<br />
          Just: Call.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Step 2 — Quiet presence"
        summary="A short hello, then quiet. Work, tidy, or just sit."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Step 2 — Quiet presence</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Silence is the default</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          You&apos;ll hear a short hello, then quiet.<br />
          You can work, tidy, stare at the wall for a minute — it&apos;s okay.
          This is what{' '}
          <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">body doubling</a> feels like here.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Step 3 — Help only when invited"
        summary="Ask and get one small step. Then silence."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Step 3 — Help only when invited</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Micro-steps, then quiet</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you ask for help starting, you&apos;ll get one small step, then silence again.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          This isn&apos;t coaching.<br />
          It&apos;s company — with optional gentle support.
        </p>

        <p className="text-slate-400 text-sm mt-8">
          Want to understand the thinking behind it? Read{' '}
          <a href="/why" className="text-white/70 hover:text-white underline underline-offset-2">why Sit With You exists</a>.
        </p>
      </SimplifiedSection>
    </>
  );
}
