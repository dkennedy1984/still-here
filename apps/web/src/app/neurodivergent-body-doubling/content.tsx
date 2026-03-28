'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function NeurodivergentBodyDoublingContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Body doubling for neurodivergent minds
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        This is designed for people who are tired of tools that assume:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>you can &ldquo;just start&rdquo;</li>
        <li>you can &ldquo;just focus&rdquo;</li>
        <li>you want to be optimised</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">
        If you&apos;ve felt misunderstood by productivity culture — good.<br />
        You&apos;re in the right place.
        Read more about{' '}
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">ADHD body doubling</a> and the research behind it.
      </p>

      <SimplifiedSection
        heading="Designed to be emotionally safe"
        summary="No shame, no guilt, no 'you should'."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be emotionally safe</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No shame language</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          No guilt. No &ldquo;you should&rdquo;. No disappointment.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Designed to be low effort"
        summary="One tap, no decisions."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be low effort</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">One tap, no decisions</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          When you&apos;re overwhelmed, choices are heavy.<br />
          So we keep it simple on purpose. See{' '}
          <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a> for the full picture.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Designed to be flexible"
        summary="Choose quiet, light check-ins, or conversation."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be flexible</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Quiet / light check-ins / talk</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          You choose the mode that works for your brain that day.<br />
          Quiet presence. Light check-ins. Or actual conversation.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          You can also{' '}
          <a href="/call-for-company" className="text-white/70 hover:text-white underline underline-offset-2">call for company</a>{' '}
          with no task in mind at all.
        </p>
      </SimplifiedSection>
    </>
  );
}
