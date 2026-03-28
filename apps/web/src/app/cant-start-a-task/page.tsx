import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: "Can't start a task? Sit with someone until it feels easier",
  description: "Stuck and unable to begin? Sit with someone quietly until starting feels possible. No explaining, no judgement.",
  alternates: { canonical: 'https://sitwithyou.app/cant-start-a-task' },
};

const sources = [
  { title: 'CHADD — Executive Function Skills', url: 'https://chadd.org/about-adhd/executive-function-skills/' },
  { title: 'CHADD — Adults: Body doubling overview', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
  { title: 'Cleveland Clinic — Body doubling benefits', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function CantStartATaskPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Try a call. No explaining required.">
      <ArticleSchema
        title="Can't start a task? Sit with someone until it feels easier"
        description="Stuck and unable to begin? Sit with someone quietly until starting feels possible. No explaining, no judgement."
        url="https://sitwithyou.app/cant-start-a-task"
      />

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

      <h2 className="text-xl font-medium text-white mt-12 mb-4">A gentle way in</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-1 mb-6">
        <li>Call</li>
        <li>Let yourself settle for a moment</li>
        <li>Start with the smallest possible action</li>
      </ol>
      <p className="text-slate-300 leading-relaxed mb-6">
        You don&apos;t need a perfect plan.<br />
        You just need a beginning. See{' '}
        <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a> for more detail.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">If you want help starting (optional)</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Micro-steps (one at a time)</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        If you ask for help, Sit With You can offer one tiny next step.<br />
        Not a big list. Not a lecture.
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>&ldquo;Open the laptop.&rdquo;</li>
        <li>&ldquo;Find the document.&rdquo;</li>
        <li>&ldquo;Do just the first click.&rdquo;</li>
      </ul>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Then back to quiet</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        After one or two steps, it goes quiet again — so you keep momentum.
        If the problem is bigger than starting — if everything feels like too much — read about{' '}
        <a href="/feeling-overwhelmed" className="text-white/70 hover:text-white underline underline-offset-2">feeling overwhelmed</a>.
      </p>
    </ContentLayout>
  );
}
