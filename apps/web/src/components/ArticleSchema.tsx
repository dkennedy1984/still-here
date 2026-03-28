interface ArticleSchemaProps {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
}

export function ArticleSchema({ title, description, url, datePublished = '2026-03-28' }: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished,
    publisher: {
      '@type': 'Organization',
      name: 'Sit With You',
      url: 'https://sitwithyou.app',
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}
