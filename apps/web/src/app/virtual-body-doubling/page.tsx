import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Virtual body doubling — quiet company, no pressure',
  description: 'A softer alternative to virtual coworking. Sit with quiet company — camera optional, conversation optional.',
  alternates: { canonical: 'https://sitwithyou.app/virtual-body-doubling' },
};

const sources = [
  { title: 'Focusmate — What body doubling is (platform definition)', url: 'https://www.focusmate.com/' },
  { title: 'Smithsonian Magazine — Virtual coworking platforms and body doubling', url: 'https://www.smithsonianmag.com/innovation/can-virtual-coworking-platforms-make-us-more-productive-180984439/' },
  { title: 'Cleveland Clinic — Why presence can help ADHD focus', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function VirtualBodyDoublingPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Call for quiet company.">
      <ArticleSchema
        title="Virtual body doubling — quiet company, no pressure"
        description="A softer alternative to virtual coworking. Sit with quiet company — camera optional, conversation optional."
        url="https://sitwithyou.app/virtual-body-doubling"
      />

      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Virtual body doubling — quiet company, no pressure
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Virtual coworking works for a lot of people.<br />
        But sometimes it comes with things that don&apos;t feel good:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>being on camera</li>
        <li>feeling watched</li>
        <li>feeling like you have to perform</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">
        If that&apos;s you, you&apos;re not being difficult. You&apos;re protecting your nervous system.
        This is one of the key differences between Sit With You and other platforms — read the{' '}
        <a href="/vs-focusmate" className="text-white/70 hover:text-white underline underline-offset-2">comparison with Focusmate</a> if you&apos;re curious.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">If video accountability stresses you out</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">You&apos;re not alone</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        Many people prefer body doubling that feels like presence, not observation.
        Learn more about{' '}
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">what body doubling means for ADHD</a>.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">What you get here instead</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Calm presence</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        Designed to feel like someone quietly sitting beside you — nothing more.
      </p>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Silence-first design</h3>
      <p className="text-slate-300 leading-relaxed mb-6">
        No small talk required. No goals you have to announce. No pressure to prove you&apos;re working.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">When it&apos;s most useful</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        Admin, emails, chores, &ldquo;one small thing&rdquo;.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        Sometimes the hardest stuff isn&apos;t the big projects — it&apos;s replying to a message, booking an appointment, starting a form, clearing one corner, opening the laptop.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        A calm call can be enough to get you moving. You can also just{' '}
        <a href="/call-for-company" className="text-white/70 hover:text-white underline underline-offset-2">call for company</a> with no agenda at all.
      </p>
    </ContentLayout>
  );
}
