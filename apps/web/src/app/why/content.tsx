'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function WhyContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Why Sit With You exists — starting doesn&apos;t have to be lonely
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        A lot of people don&apos;t struggle with ability.<br />
        They struggle with activation.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        Starting can be heavy — especially with ADHD, stress, burnout, or just… life.
      </p>

      <SimplifiedSection
        heading="Starting is often the hardest part"
        summary="When you're tired, even small tasks can feel enormous."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Starting is often the hardest part</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Especially when you&apos;re tired or overwhelmed</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          When you&apos;re tired, everything costs more.<br />
          Even opening a laptop can feel like climbing.
          This is the challenge that{' '}
          <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">body doubling</a> was made for.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="We&apos;re building something softer"
        summary="Not a coach, tracker, or fix. Just calm presence."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">We&apos;re building something softer</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Support without pressure</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          Not a coach. Not a tracker. Not a &ldquo;fix&rdquo;.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Just a calm presence you can reach for. See{' '}
          <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a> in practice.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Our promise"
        summary="Simple, gentle, quiet. Begin slowly."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Our promise</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Calm, consent, and respect</h3>
        <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
          <li>keep it simple</li>
          <li>keep it gentle</li>
          <li>keep it quiet unless you ask otherwise</li>
        </ul>
        <p className="text-slate-300 leading-relaxed mb-6">
          You can begin slowly. You don&apos;t have to be ready.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you&apos;re wondering how it feels in practice, read about{' '}
          <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a>{' '}
          or{' '}
          <a href="/cant-start-a-task" className="text-white/70 hover:text-white underline underline-offset-2">can&apos;t start a task</a>.
        </p>
      </SimplifiedSection>
    </>
  );
}
