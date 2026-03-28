import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Why Sit With You exists — starting doesn\'t have to be lonely',
  description: 'Sit With You exists because starting is often the hardest part. You don\'t have to do that alone.',
  alternates: { canonical: 'https://sitwithyou.app/why' },
};

const sources = [
  { title: 'CHADD — Adults: Body doubling and task initiation', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
  { title: 'ADDitude — Body doubling as quiet support', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'Cleveland Clinic — Body doubling and external executive functioning', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function WhyPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="If you want, you can try a call now.">
      <ArticleSchema
        title="Why Sit With You exists — starting doesn't have to be lonely"
        description="Sit With You exists because starting is often the hardest part. You don't have to do that alone."
        url="https://sitwithyou.app/why"
      />

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

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Starting is often the hardest part</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Especially when you&apos;re tired or overwhelmed</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        When you&apos;re tired, everything costs more.<br />
        Even opening a laptop can feel like climbing.
        This is the challenge that{' '}
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">body doubling</a> was made for.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">We&apos;re building something softer</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Support without pressure</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        Not a coach. Not a tracker. Not a &ldquo;fix&rdquo;.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        Just a calm presence you can reach for. See{' '}
        <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a> in practice.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Our promise</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Calm, consent, and respect</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>keep it simple</li>
        <li>keep it gentle</li>
        <li>let you be quiet</li>
        <li>let you begin slowly</li>
      </ul>

      <p className="text-slate-400 text-sm mt-8">
        This applies to everyone, but especially{' '}
        <a href="/neurodivergent-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">neurodivergent minds</a>.
      </p>
    </ContentLayout>
  );
}
