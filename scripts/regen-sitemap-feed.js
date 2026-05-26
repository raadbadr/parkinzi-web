#!/usr/bin/env node
// Regenerate /sitemap.xml and /blog/feed.xml from blog/posts.json.
// Safe to run repeatedly — output is deterministic.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog/posts.json'), 'utf8'));

// ---------- sitemap.xml ----------
const today = new Date().toISOString().slice(0, 10);
const STATIC_URLS = [
  { loc: 'https://parkinzi.com/', lastmod: today, changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://parkinzi.com/blog/', lastmod: today, changefreq: 'daily', priority: '0.9' },
  { loc: 'https://parkinzi.com/mcp-server.html', lastmod: today, changefreq: 'monthly', priority: '0.7' },
  { loc: 'https://parkinzi.com/llms.txt', lastmod: today, changefreq: 'monthly', priority: '0.5' },
  { loc: 'https://parkinzi.com/about.html', lastmod: '2026-04-09', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://parkinzi.com/pricing.html', lastmod: '2026-04-09', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://parkinzi.com/privacy.html', lastmod: '2026-04-09', changefreq: 'yearly', priority: '0.4' },
  { loc: 'https://parkinzi.com/terms.html', lastmod: '2026-04-09', changefreq: 'yearly', priority: '0.4' },
  { loc: 'https://parkinzi.com/refund.html', lastmod: '2026-04-09', changefreq: 'yearly', priority: '0.4' },
  { loc: 'https://parkinzi.com/delete-account', lastmod: '2026-05-05', changefreq: 'yearly', priority: '0.4' },
];

const postUrls = posts.map(p => ({
  loc: `https://parkinzi.com/blog/${p.slug}.html`,
  lastmod: p.publishDate.slice(0, 10),
  changefreq: 'monthly',
  priority: '0.7',
}));

const sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...STATIC_URLS, ...postUrls].map(u =>
    `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n') +
  '\n</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml);
console.log('wrote sitemap.xml with', STATIC_URLS.length + postUrls.length, 'urls');

// ---------- blog/feed.xml ----------
function rfc822(iso) {
  return new Date(iso).toUTCString().replace('GMT', '+0000');
}
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const sortedPosts = [...posts].sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
const newest = sortedPosts[0];

const items = sortedPosts.map(p => {
  const categories = p.tags.map(t => `      <category>${escapeXml(t)}</category>`).join('\n');
  return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>https://parkinzi.com/blog/${p.slug}.html</link>
      <guid isPermaLink="true">https://parkinzi.com/blog/${p.slug}.html</guid>
      <pubDate>${rfc822(p.publishDate)}</pubDate>
      <dc:creator>فريق PARKINZI</dc:creator>
${categories}
      <description>${escapeXml(p.summary)}</description>
    </item>`;
}).join('\n\n');

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>مدونة PARKINZI</title>
    <link>https://parkinzi.com/blog/</link>
    <atom:link href="https://parkinzi.com/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>مقالات يومية عن المواقف الذكية وتأجير المواقف وشحن السيارات الكهربائية في المدن السعودية.</description>
    <language>ar-SA</language>
    <copyright>© 2026 PARKINZI</copyright>
    <managingEditor>support@parkinzi.com (فريق PARKINZI)</managingEditor>
    <webMaster>support@parkinzi.com (فريق PARKINZI)</webMaster>
    <lastBuildDate>${rfc822(newest.publishDate)}</lastBuildDate>
    <generator>PARKINZI</generator>
    <image>
      <url>https://parkinzi.com/parkinzi-logo-full-dark.png</url>
      <title>مدونة PARKINZI</title>
      <link>https://parkinzi.com/blog/</link>
    </image>

${items}

  </channel>
</rss>
`;

fs.writeFileSync(path.join(ROOT, 'blog/feed.xml'), feedXml);
console.log('wrote blog/feed.xml with', sortedPosts.length, 'items');
