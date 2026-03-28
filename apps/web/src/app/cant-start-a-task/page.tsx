import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { CantStartATaskContent } from './content';

export const metadata: Metadata = {
  title: "Can't start a task? Sit with someone until it feels easier",
  description: "Stuck and unable to begin? Sit with someone quietly until starting feels possible. No explaining, no judgement.",
  alternates: { canonical: 'https://sitwithyou.app/cant-start-a-task' },
};

const sources = [
  { title: 'CHADD — Executive Function Skills', url: 'https://chadd.org/about-adhd/executive-function-skills/' },
  { title: 'CHADD — Adults: Body doubling overview', url: 'https://chadd.org/adhd-news/adhd-news-adults/adhd-weekly-could-a-body-double-help-you-increase-your-productivity/' },
  { title: 'Cleveland Clinic — Body doubling benefits', url: 'https://health.clevelandclinic.org/body-doubling-for-adhd' },
];

export default function CantStartATaskPage() {
  return (
    <ContentLayout sources={sources} ctaButton="Call" ctaMicrocopy="Try a call. No explaining required.">
      <ArticleSchema
        title="Can't start a task? Sit with someone until it feels easier"
        description="Stuck and unable to begin? Sit with someone quietly until starting feels possible. No explaining, no judgement."
        url="https://sitwithyou.app/cant-start-a-task"
      />
      <CantStartATaskContent />
    </ContentLayout>
  );
}
