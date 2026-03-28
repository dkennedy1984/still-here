import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { ADHDBodyDoublingContent } from './content';

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
      <ADHDBodyDoublingContent />
    </ContentLayout>
  );
}
