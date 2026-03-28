import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { NeurodivergentBodyDoublingContent } from './content';

export const metadata: Metadata = {
  title: 'Body doubling for neurodivergent minds — no goals, no judgement',
  description: 'Designed for ADHD and neurodivergent users who need support without judgement, goals, or forced focus.',
  alternates: { canonical: 'https://sitwithyou.app/neurodivergent-body-doubling' },
};

const sources = [
  { title: 'CHADD — Executive Function Issues and ADHD', url: 'https://chadd.org/attention-article/executive-function-issues-and-adhd/' },
  { title: 'NHS Dorset — Understanding ADHD (Neurodiversity)', url: 'https://nhsdorset.nhs.uk/neurodiversity/explore/adhd/' },
  { title: 'Cleveland Clinic — Body doubling for ADHD', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function NeurodivergentBodyDoublingPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Try it gently.">
      <ArticleSchema
        title="Body doubling for neurodivergent minds — no goals, no judgement"
        description="Designed for ADHD and neurodivergent users who need support without judgement, goals, or forced focus."
        url="https://sitwithyou.app/neurodivergent-body-doubling"
      />
      <NeurodivergentBodyDoublingContent />
    </ContentLayout>
  );
}
