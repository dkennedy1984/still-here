import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';

export const metadata: Metadata = {
  title: 'Sit With You vs Focusmate — quiet presence instead of accountability',
  description: 'Focusmate uses accountability. Sit With You offers quiet presence. See which feels safer for your brain.',
  alternates: { canonical: 'https://sitwithyou.app/vs-focusmate' },
};

const sources = [
  { title: 'Focusmate — How sessions work and what body doubling is', url: 'https://www.focusmate.com/' },
  { title: 'CHADD — Adults: Body doubling overview (in person or virtual)', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
];

export default function VsFocusmatePage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="If you want, try one calm call.">
      <ArticleSchema
        title="Sit With You vs Focusmate — quiet presence instead of accountability"
        description="Focusmate uses accountability. Sit With You offers quiet presence. See which feels safer for your brain."
        url="https://sitwithyou.app/vs-focusmate"
      />

      <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight mb-8">
        Sit With You vs Focusmate — what&apos;s the difference?
      </h1>

      <p className="text-slate-300 leading-relaxed mb-6">
        Both are based on a helpful idea: you work better when you&apos;re not alone.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        But the feeling is different.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">The core difference</h2>

      <h3 className="text-base font-medium text-white/80 mt-6 mb-3">Accountability vs presence</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-6">
        <li>Focusmate: a real person + a social contract (check-in, camera, accountability)</li>
        <li>Sit With You: quiet presence that expects nothing</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-6">
        If accountability helps you start, Focusmate can be brilliant.<br />
        If accountability makes you freeze, Sit With You may feel safer.
        Read more about{' '}
        <a href="/virtual-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">virtual body doubling</a> to understand this approach.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">If you feel anxious on camera</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        Some people get energised by being seen. Others feel tense or avoidant.
      </p>
      <p className="text-slate-300 leading-relaxed mb-6">
        Sit With You is built for the second group — people who want support without being watched.
        You can simply{' '}
        <a href="/call-for-company" className="text-white/70 hover:text-white underline underline-offset-2">call for company</a> with no camera at all.
      </p>

      <h2 className="text-xl font-medium text-white mt-12 mb-4">Choose what your brain responds to</h2>
      <p className="text-slate-300 leading-relaxed mb-6">
        Try Focusmate if you like structure and reporting.<br />
        Try Sit With You if you want quiet company and no pressure.
      </p>

      <p className="text-slate-400 text-sm mt-8">
        Learn more about{' '}
        <a href="/adhd-body-doubling" className="text-white/70 hover:text-white underline underline-offset-2">ADHD body doubling</a> and the research behind it.
      </p>
    </ContentLayout>
  );
}
