import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { VsFocusmateContent } from './content';

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
    <ContentLayout sources={sources} ctaButton="I'm ready" ctaMicrocopy="See how it feels.">
      <ArticleSchema
        title="Sit With You vs Focusmate — quiet presence instead of accountability"
        description="Focusmate uses accountability. Sit With You offers quiet presence. See which feels safer for your brain."
        url="https://sitwithyou.app/vs-focusmate"
      />
      <VsFocusmateContent />
    </ContentLayout>
  );
}
