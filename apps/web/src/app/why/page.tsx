import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { WhyContent } from './content';

export const metadata: Metadata = {
  title: "Why Sit With You exists — starting doesn't have to be lonely",
  description: "Sit With You exists because starting is often the hardest part. You don't have to do that alone.",
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
      <WhyContent />
    </ContentLayout>
  );
}
