import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { CallForCompanyContent } from './content';

export const metadata: Metadata = {
  title: 'Call for company — body doubling without video or pressure',
  description: "Sometimes you don't want video or talking. Sit With You works as quiet company you can call anytime.",
  alternates: { canonical: 'https://sitwithyou.app/call-for-company' },
};

const sources = [
  { title: 'ADDitude — Body doubling examples (quiet presence)', url: 'https://www.additudemag.com/getting-stuff-done-easier-with-a-friend-body-double/' },
  { title: 'Cleveland Clinic — Body doubling for ADHD', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function CallForCompanyPage() {
  return (
    <ContentLayout sources={sources} ctaButton="I'm ready" ctaMicrocopy="Start whenever you like.">
      <ArticleSchema
        title="Call for company — body doubling without video or pressure"
        description="Sometimes you don't want video or talking. Sit With You works as quiet company you can call anytime."
        url="https://sitwithyou.app/call-for-company"
      />
      <CallForCompanyContent />
    </ContentLayout>
  );
}
