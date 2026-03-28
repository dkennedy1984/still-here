import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Feeling overwhelmed? Quiet company can help you begin',
  description: 'When everything feels too much to start, a calm presence can help. Sit With You stays quietly with you.',
  alternates: { canonical: 'https://sitwithyou.app/feeling-overwhelmed' },
};

const sources = [
  { title: 'CHADD — Executive function skills and emotional regulation', url: 'https://chadd.org/about-adhd/executive-function-skills/' },
  { title: 'Cleveland Clinic — Body doubling and motivation/focus', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
  { title: 'Psych Central — Body doubling overview', url: 'https://psychcentral.com/adhd/adhd-body-doubling' },
];

export default function FeelingOverwhelmedPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Try a quiet call.">
      <ArticleSchema
        title="Feeling overwhelmed? Quiet company can help you begin"
        description="When everything feels too much to start, a calm presence can help. Sit With You stays quietly with you."
        url="https://sitwithyou.app/feeling-overwhelmed"
      />

      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Feeling overwhelmed? Let&apos;s make it smaller
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        When you&apos;re overwhelmed, advice can feel like noise.<br />
        What helps first is often something simpler: company.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Overwhelm often needs company, not advice</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You don&apos;t have to perform</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        You don&apos;t have to be coherent. You don&apos;t have to &ldquo;use the tool correctly&rdquo;.<br />
        You can just arrive. If the overwhelm is connected to a specific task you can&apos;t begin, read about{' '}
        <a href="/cant-start-a-task" className="text-white/70 hover:text-white underline underline-offset-2">the start barrier</a>.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">A quiet reset</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>Call</li>
        <li>Let your shoulders drop</li>
        <li>Do one tiny thing</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">
        That&apos;s enough.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">If you want one tiny next step</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        You can say: &ldquo;One step, please.&rdquo;
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        You&apos;ll get a single small action — not a plan for your whole life.<br />
        Then it goes quiet again. Because overwhelm often needs space, not more inputs.
      </p>

      <p className="text-slate-400 text-sm mt-8">
        You might also find it helpful to simply{' '}
        <a href="/call-for-company" className="text-white/70 hover:text-white underline underline-offset-2">call for company</a>, or learn{' '}
        <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how Sit With You works</a>.
      </p>
    </ContentLayout>
  );
}
