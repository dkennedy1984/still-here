import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'ADHD Body Doubling — Sit with someone while you work',
  description: 'Body doubling for ADHD without accountability or awkward calls. Just quiet presence while you work at your own pace.',
  alternates: { canonical: 'https://sitwithyou.app/adhd-body-doubling' },
};

const sources = [
  { title: 'Cleveland Clinic — Body doubling definition and mechanisms', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
  { title: 'ADDitude — Body doubling practical definition and examples', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'CHADD — Executive Function Skills (Barkley/Brown frameworks)', url: 'https://chadd.org/about-adhd/executive-function-skills/' },
  { title: 'CHADD — Adults: Could a body double help you increase productivity?', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
];

export default function ADHDBodyDoublingPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="If you want, you can try a call now.">
      <ArticleSchema
        title="ADHD Body Doubling — Sit with someone while you work"
        description="Body doubling for ADHD without accountability or awkward calls. Just quiet presence while you work at your own pace."
        url="https://sitwithyou.app/adhd-body-doubling"
      />

      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        ADHD body doubling — sit with someone while you work
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Body doubling is a simple idea:<br />
        doing a task while someone else is present.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        They&apos;re not supervising you.<br />
        They&apos;re not doing the task for you.<br />
        They&apos;re just… there.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        For many people with ADHD, that presence can make starting and continuing feel easier.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">What &ldquo;body doubling&rdquo; means</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">It&apos;s presence, not help</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        A body double doesn&apos;t &ldquo;fix&rdquo; you or manage your life.<br />
        They simply make the moment feel less lonely — and a little more anchored.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        Body doubling can be in person (someone in the same room) or virtual (a call, video, or shared session).
        If you&apos;re curious about the virtual side, read about{' '}
        <a href="/virtual-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">virtual body doubling</a>.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Why it helps ADHD</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        ADHD often involves difficulties with executive function — the mental skills that help you start, plan, sustain focus, switch tasks, and finish. If those systems are overloaded, starting can feel like pushing through a wall.
      </p>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Starting becomes less lonely</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        When you&apos;re alone with a task, the task can feel enormous.<br />
        When someone is &ldquo;with you&rdquo;, the first step can feel smaller.
        If starting is the hard part for you, you&apos;re not alone — read more about{' '}
        <a href="/cant-start-a-task" className="text-white/70 hover:text-white underline underline-offset-2">why starting a task can feel impossible</a>.
      </p>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Your brain gets a gentle &ldquo;working moment&rdquo;</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        The presence of another person can act like external scaffolding — not pressure, just a cue that this is a moment to try.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Common ways people use body doubling</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>admin, emails, and forms</li>
        <li>housework (dishes, laundry, decluttering)</li>
        <li>studying or writing</li>
        <li>routines (morning, bedtime, meds)</li>
      </ul>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">How Sit With You is different</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        Some body doubling platforms lean on accountability and reporting. This is designed to be softer.
        Curious about the details? See{' '}
        <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a>.
      </p>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No judgement</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        You can show up overwhelmed, distracted, tired — it&apos;s fine.
      </p>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">No performance pressure</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        No one is scoring you. Silence is normal.
      </p>
    </ContentLayout>
  );
}
