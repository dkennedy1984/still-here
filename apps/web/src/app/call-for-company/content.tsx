'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function CallForCompanyContent() {
  const simplified = useSimplified();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Call for company — body doubling without pressure
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Sometimes you don&apos;t need motivation.<br />
        You just need someone there while you begin.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        That&apos;s what this is.
      </p>

      <SimplifiedSection
        heading="You can be quiet"
        summary="Call and say nothing. Start slowly. No conversation to manage."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">You can be quiet</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No conversation required</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          You can call and say nothing.<br />
          You can put the phone down.<br />
          You can start slowly.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          This isn&apos;t a conversation you have to manage.<br />
          It&apos;s a presence you can lean on. Learn more about{' '}
          <a href="/virtual-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">virtual body doubling</a> and why it works.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Audio-first"
        summary="Less self-consciousness, easier on messy days, fewer decisions."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Audio-first (video optional later)</h2>

        <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Low stimulation, low friction</h3>
        <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
          <li>less self-consciousness</li>
          <li>easier on messy days</li>
          <li>fewer decisions</li>
        </ul>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Common ways people use it"
        summary="Emails, cleaning, admin, bedtime routines."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Common ways people use it</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          Emails, cleaning, admin, bedtime routines, &ldquo;I just need to begin&rdquo;.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          You don&apos;t need a perfect use-case.<br />
          You just need the call.
        </p>

        <p className="text-slate-400 text-sm mt-8">
          If you have ADHD, read about{' '}
          <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">ADHD body doubling</a>{' '}
          and the research behind why this works.
        </p>
      </SimplifiedSection>
    </>
  );
}
