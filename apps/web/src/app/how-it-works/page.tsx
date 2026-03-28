import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { HowItWorksContent } from './content';

export const metadata: Metadata = {
  title: 'How Sit With You works — calm, quiet support on demand',
  description: "Tap call, settle in, and start when you're ready. Sit With You is designed for calm support, not productivity pressure.",
  alternates: { canonical: 'https://sitwithyou.app/how-it-works' },
};

const sources = [
  { title: 'ADDitude — Body doubling can be quiet presence', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'Cleveland Clinic — Body doubling explanation', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
  { title: 'CHADD — Adults: Body doubling overview', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
];

export default function HowItWorksPage() {
  return (
    <ContentLayout sources={sources} ctaButton="I'm ready" ctaMicrocopy="Give it a try.">
      <ArticleSchema
        title="How Sit With You works — calm, quiet support on demand"
        description="Tap call, settle in, and start when you're ready. Sit With You is designed for calm support, not productivity pressure."
        url="https://sitwithyou.app/how-it-works"
      />
      <HowItWorksContent />
    </ContentLayout>
  );
}
