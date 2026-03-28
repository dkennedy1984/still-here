import { Metadata } from 'next';
import { ContentLayout } from '../../components/ContentLayout';
import { ArticleSchema } from '../../components/ArticleSchema';
import { VirtualBodyDoublingContent } from './content';

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
    <ContentLayout sources={sources} ctaButton="I'm ready" ctaMicrocopy="Quiet company, no camera.">
      <ArticleSchema
        title="Virtual body doubling — quiet company, no pressure"
        description="A softer alternative to virtual coworking. Sit with quiet company — camera optional, conversation optional."
        url="https://sitwithyou.app/virtual-body-doubling"
      />
      <VirtualBodyDoublingContent />
    </ContentLayout>
  );
}
