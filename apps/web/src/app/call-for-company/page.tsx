import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Call for company — body doubling without video or pressure',
  description: 'Sometimes you don\'t want video or talking. Sit With You works as quiet company you can call anytime.',
  alternates: { canonical: 'https://sitwithyou.app/call-for-company' },
};

const sources = [
  { title: 'ADDitude — Body doubling examples (quiet presence)', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'Cleveland Clinic — Body doubling for ADHD', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function CallForCompanyPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Call now. Start whenever you're ready.">
      <ArticleSchema
        title="Call for company — body doubling without video or pressure"
        description="Sometimes you don't want video or talking. Sit With You works as quiet company you can call anytime."
        url="https://sitwithyou.app/call-for-company"
      />

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

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Audio-first (video optional later)</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Low stimulation, low friction</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>less self-consciousness</li>
        <li>easier on messy days</li>
        <li>fewer decisions</li>
      </ul>

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
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">ADHD body doubling</a>.
        If everything feels too much, read about{' '}
        <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a>.
      </p>
    </ContentLayout>
  );
}
