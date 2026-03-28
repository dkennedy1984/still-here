import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Body doubling for neurodivergent minds — no goals, no judgement',
  description: 'Designed for ADHD and neurodivergent users who need support without judgement, goals, or forced focus.',
  alternates: { canonical: 'https://sitwithyou.app/neurodivergent-body-doubling' },
};

const sources = [
  { title: 'CHADD — Executive Function Issues and ADHD', url: 'https://chadd.org/attention-article/executive-function-issues-and-adhd/' },
  { title: 'NHS Dorset — Understanding ADHD (Neurodiversity)', url: 'https://nhsdorset.nhs.uk/neurodiversity/explore/adhd/' },
  { title: 'Cleveland Clinic — Body doubling for ADHD', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function NeurodivergentBodyDoublingPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Try it gently.">
      <ArticleSchema
        title="Body doubling for neurodivergent minds — no goals, no judgement"
        description="Designed for ADHD and neurodivergent users who need support without judgement, goals, or forced focus."
        url="https://sitwithyou.app/neurodivergent-body-doubling"
      />

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

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be emotionally safe</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No shame language</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        No guilt. No &ldquo;you should&rdquo;. No disappointment.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be low effort</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">One tap, no decisions</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        When you&apos;re overwhelmed, choices are heavy.<br />
        So we keep it simple on purpose. See{' '}
        <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a> for the full picture.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Designed to be flexible</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Quiet / light check-ins / talk</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        You choose how present you want it to be:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>Just sit quietly (default)</li>
        <li>Light check-ins (only if you opt in)</li>
        <li>Happy to talk (when you want words)</li>
      </ul>

      <p className="text-slate-400 text-sm mt-8">
        If you&apos;re{' '}
        <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a> right now, that&apos;s okay. You can just call.
      </p>
    </ContentLayout>
  );
}
