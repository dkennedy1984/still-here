import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { FeelingOverwhelmedContent } from './content';

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
    <ContentLayout sources={sources} ctaButton="I'm ready" ctaMicrocopy="No pressure at all.">
      <ArticleSchema
        title="Feeling overwhelmed? Quiet company can help you begin"
        description="When everything feels too much to start, a calm presence can help. Sit With You stays quietly with you."
        url="https://sitwithyou.app/feeling-overwhelmed"
      />
      <FeelingOverwhelmedContent />
    </ContentLayout>
  );
}
