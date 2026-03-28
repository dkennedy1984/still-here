'use client';
import { SimplifiedSection } from '../../components/SimplifiedSection';
import { useSimplified } from '../../components/ContentLayout';

export function ADHDBodyDoublingContent() {
  const simplified = useSimplified();

  return (
    <>
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

      <SimplifiedSection
        heading="What &ldquo;body doubling&rdquo; means"
        summary="Having someone present while you do a task — not helping, just there."
        simplified={simplified}
      >
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
      </SimplifiedSection>

      <SimplifiedSection
        heading="Why it helps ADHD"
        summary="Presence makes starting feel less heavy when executive function struggles."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Why it helps ADHD</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          ADHD often involves difficulties with executive function — the mental systems that help us initiate tasks,
          regulate attention, and manage time. These aren&apos;t willpower failures. They&apos;re neurological.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Body doubling seems to work by providing gentle external structure. Another person&apos;s presence can
          help regulate the nervous system and reduce the friction of starting.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          If you&apos;ve ever found it easier to work in a café, library, or with a friend nearby — that&apos;s body doubling.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="Common ways people use body doubling"
        summary="Admin, housework, studying, daily routines."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">Common ways people use body doubling</h2>
        <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
          <li>paying bills and admin tasks</li>
          <li>cleaning and housework</li>
          <li>studying or reading</li>
          <li>difficult emails</li>
          <li>starting a work task</li>
          <li>bedtime or morning routines</li>
        </ul>
        <p className="text-slate-300 leading-relaxed mb-6">
          You don&apos;t need a &ldquo;good enough&rdquo; reason. If presence helps, that&apos;s reason enough.
          Learn more about what to expect in{' '}
          <a href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</a>.
        </p>
      </SimplifiedSection>

      <SimplifiedSection
        heading="How Sit With You is different"
        summary="No judgement, no performance pressure. Just quiet company."
        simplified={simplified}
      >
        <h2 className="text-xl font-medium text-white mt-12 mb-4">How Sit With You is different</h2>
        <p className="text-slate-300 leading-relaxed mb-6">
          Some body doubling services use accountability: check-ins, camera-on, reporting what you did.
          That works for some people. For others, it adds pressure.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Sit With You is quieter. No camera required. No reporting. No judgement.
          Just presence — with the option to ask for one small step if you want it.
        </p>
        <p className="text-slate-300 leading-relaxed mb-6">
          Read about the{' '}
          <a href="/neurodivergent-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">neurodivergent-first design</a>{' '}
          or see the{' '}
          <a href="/vs-focusmate" className="text-white/70 hover:text-white underline underline-offset-2">comparison with Focusmate</a>.
        </p>
      </SimplifiedSection>
    </>
  );
}
