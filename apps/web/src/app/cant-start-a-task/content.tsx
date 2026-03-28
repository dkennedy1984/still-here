'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function CantStartATaskContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Can&apos;t start a task? You&apos;re not broken
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        That &ldquo;stuck&rdquo; feeling is real.<br />
        And it can happen even when you care deeply about the thing.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        If you&apos;ve been telling yourself you&apos;re lazy, failing, or &ldquo;just need discipline&rdquo; — pause.<br />
        This isn&apos;t a character flaw. It&apos;s a start barrier.
      </p>

      <SimplifiedSection
        heading="The start barrier is real"
        summary="Not being able to start isn't laziness — it's an executive function difficulty."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">The start barrier is real</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s not laziness</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          ADHD and executive function differences can make task initiation genuinely difficult — even for simple tasks.
          This is something many people experience with{' '}
          <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">ADHD body doubling</a> — the presence of another person can ease that barrier.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          A lot of people describe it as:
        </p>
        <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
          <li>knowing what to do</li>
          <li>wanting to do it</li>
          <li>but not being able to start</li>
        </ul>
      </SimplifiedSection>

      <SimplifiedSection
        heading="A gentle way in"
        summary="Call, settle, start with the smallest possible action."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">A gentle way in</h2>
        <ol className="list-decimal list-inside text-slate-300 space-y-1 mb-6">
          <li>Call</li>
          <li>Let yourself settle for a moment</li>
          <li>Start with the smallest possible action</li>
        </ol>
        <p className="text-slate-300 leading-relaxed mb-6">
          You don&apos;t need a perfect plan.<br />
          You just need one tiny move. The momentum comes after.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you&apos;re feeling overwhelmed as well as stuck, read about{' '}
          <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a>.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="If you want help starting"
        summary="Ask for one tiny next step. Then quiet."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">If you want help starting</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          You can ask: &ldquo;What&apos;s one tiny next step?&rdquo;
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          You&apos;ll get a single small action — not a strategy session.<br />
          Then it goes quiet again. Because you probably just needed a way in.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          See{' '}
          <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a>{' '}
          for more detail.
        </p>
      </SimplifiedSection>
    </>
  );
}
