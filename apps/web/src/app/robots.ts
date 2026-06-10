import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/account',
        '/alerts',
        '/unsubscribe',
        '/auth/',
        '/cdn-cgi/',
      ],
    },
    sitemap: 'https://jobs.aquilalab.com/sitemap.xml',
  };
}
