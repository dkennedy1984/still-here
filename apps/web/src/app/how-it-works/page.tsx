import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'How Sit With You works — calm, quiet support on demand',
  description: 'Tap call, settle in, and start when you\'re ready. Sit With You is designed for calm support, not productivity pressure.',
  alternates: { canonical: 'https://sitwithyou.app/how-it-works' },
};

const sources = [
  { title: 'ADDitude — Body doubling can be quiet presence', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'Cleveland Clinic — Body doubling explanation', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
  { title: 'CHADD — Adults: Body doubling overview', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
];

export default function HowItWorksPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Ready to try it?">
      <ArticleSchema
        title="How Sit With You works — calm, quiet support on demand"
        description="Tap call, settle in, and start when you're ready. Sit With You is designed for calm support, not productivity pressure."
        url="https://sitwithyou.app/how-it-works"
      />

      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        How Sit With You works
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Sit With You is designed to be simple enough to use on your hardest days.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Step 1 — Tap Call</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No setup required</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        No goals. No onboarding quiz. No &ldquo;choose your productivity style&rdquo;.<br />
        Just: Call.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Step 2 — Quiet presence</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Silence is the default</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        You&apos;ll hear a short hello, then quiet.<br />
        You can work, tidy, stare at the wall for a minute — it&apos;s okay.
        This is what{' '}
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">body doubling</a> feels like here.
      </p>

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
        If you&apos;re{' '}
        <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a>, that&apos;s okay too — just call.
      </p>
    </ContentLayout>
  );
}
