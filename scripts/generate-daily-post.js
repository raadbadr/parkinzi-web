#!/usr/bin/env node
// Daily blog generator — runs in GitHub Actions on a schedule.
// Calls Claude (with web search) to research the latest in smart-parking
// systems and produces an Arabic post that ships through the same
// posts.json pipeline as our hand-written articles.
//
// Required env vars:
//   ANTHROPIC_API_KEY  — Anthropic API key (Workbench → API keys)
//   ANTHROPIC_MODEL    — optional, default 'claude-sonnet-4-5'

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { buildPostHtml } = require('./build-post-html');

const ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const POSTS_JSON = path.join(BLOG_DIR, 'posts.json');

const TOPIC_POOL = [
  'أحدث أنظمة المواقف الذكية في 2026',
  'تقنيات IoT في إدارة مواقف السيارات',
  'كاميرات ANPR والتعرف على لوحات السيارات في المواقف',
  'الذكاء الاصطناعي وتوقع ازدحام المواقف',
  'أنظمة الدفع الذكي للمواقف وآخر التطورات',
  'كيفية تركيب أنظمة المواقف الذكية في المباني',
  'مستشعرات المواقف وأنواعها الحديثة',
  'تطبيقات المواقف الناشئة عالمياً وإقليمياً',
  'مواقف السيارات الكهربائية وأحدث شواحن 2026',
  'حلول المواقف للمولات والمراكز التجارية',
  'مواقف الطائرات بدون طيار للتوصيل',
  'تأمين السيارات داخل المواقف الذكية',
  'تجارب مدن عالمية في إدارة المواقف',
  'تقنية V2G وتأثيرها على مواقف الشحن',
  'استثمار العقارات في المواقف المؤجرة',
  'أتمتة بوابات المواقف ومواقف الفلل',
  'المواقف متعددة الطوابق الآلية',
  'تقنية Blockchain في تأجير المواقف',
  'المواقف في المدن الذكية الخليجية',
  'إدارة المواقف خلال الفعاليات الكبرى',
  'مواقف الشركات والإدارة الجماعية',
  'الفرق بين المواقف المغطاة والمكشوفة في السعودية',
  'مواقف الدراجات النارية وحلولها الذكية',
  'مواقف السيارات والاستدامة البيئية',
  'تجربة المستخدم في تطبيقات المواقف',
  'دور 5G في تشغيل المواقف الذكية',
  'حماية البيانات الشخصية في تطبيقات المواقف',
  'مواقف الحافلات السياحية في الوجهات الكبرى',
  'دراسة جدوى تأجير موقف خاص',
  'مواقف المطارات السعودية — أحدث التطويرات',
];

function pickTopic() {
  // Use day-of-year so subsequent runs in the same day stay on-topic if
  // the workflow is manually re-triggered.
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return TOPIC_POOL[dayOfYear % TOPIC_POOL.length];
}

function slugify(str) {
  // Build a stable english-ish slug from the date so we never collide.
  const date = new Date().toISOString().slice(0, 10);
  const seed = str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return seed ? `daily-${date}-${seed}` : `daily-${date}`;
}

function gregorianLabel(iso) {
  return new Intl.DateTimeFormat('ar', {
    year: 'numeric', month: 'long', day: 'numeric',
    calendar: 'gregory', numberingSystem: 'latn',
  }).format(new Date(iso));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  const client = new Anthropic();

  const topic = pickTopic();
  const todayIso = new Date().toISOString().slice(0, 10);
  const publishDate = `${todayIso}T10:00:00+03:00`;
  console.log('[generate-daily-post] topic =', topic);
  console.log('[generate-daily-post] model =', model);

  const userPrompt = `أنت كاتب مدوّنة عربي محترف لموقع PARKINZI — منصة سعودية للمواقف الذكية.

اكتب مقال مدوّنة بالعربية الفصحى (بدون لهجات) عن:
"${topic}"

تعليمات:
1) استخدم web_search للبحث عن آخر التطورات والأرقام والمنتجات والشركات في 2026.
2) المقال 600–900 كلمة، عناوين فرعية H2 و H3، فقرات قصيرة، قوائم نقطية حيث تناسب.
3) أسلوب احترافي، معلوماتي، بدون مبالغة. أرقام حقيقية لما أمكن.
4) السوق المستهدف: السعودية والخليج. اربط بالسياق المحلي حيث يصح.
5) لا تضمّن خرافات أو معلومات غير موثّقة.

اعد ردك كـ JSON واحد فقط، بدون أي نص قبله أو بعده، بهذه البنية:
{
  "slug": "english-slug-using-dashes",
  "title": "العنوان بالعربية",
  "summary": "ملخص في جملة أو جملتين (للـ meta description)",
  "description": "وصف SEO أطول قليلاً (140–160 حرف)",
  "section": "قسم مثل: تقنية، شحن، دليل، تحليل",
  "breadcrumb": "عنوان قصير 3–5 كلمات للـ breadcrumb",
  "tags": ["وسم1", "وسم2", "وسم3"],
  "readMinutes": 5,
  "body": "<p>...</p><h2>...</h2><p>...</p>"
}

ملاحظات للـ body:
- محتوى HTML نظيف. ابدأ بـ <p> مقدمة.
- استخدم <h2> للأقسام الرئيسية، <h3> للفرعية، <p>، <ul>، <ol>، <li>، <blockquote>.
- بدون <html>، <head>، <body>، <script>، <style>، <img>.
- اقتباسات: <blockquote>...</blockquote>.
- لا تضمّن CTA في النهاية — يضاف تلقائياً.`;

  const response = await client.messages.create({
    model,
    max_tokens: 6000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Find the final assistant text block (web_search returns interleaved blocks).
  const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in Claude response.\n' + textBlocks.slice(0, 500));
  }

  let post;
  try {
    post = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('Failed to parse JSON from Claude:\n' + e.message + '\nRaw:\n' + jsonMatch[0].slice(0, 500));
  }

  // Sanity-check required fields
  for (const f of ['slug', 'title', 'summary', 'body', 'tags']) {
    if (!post[f]) throw new Error(`Claude output missing field: ${f}`);
  }

  // Force a date-prefixed slug so we never overwrite an existing post.
  post.slug = slugify(post.slug);
  post.publishDate = publishDate;
  post.publishLabel = gregorianLabel(publishDate);
  post.description = post.description || post.summary;
  post.section = post.section || 'تقنية';
  post.breadcrumb = post.breadcrumb || post.title.slice(0, 30);
  post.readMinutes = post.readMinutes || 5;
  post.aiDisclosure = true;
  post.cta = {
    heading: 'جرّب PARKINZI',
    body: 'حمّل التطبيق واعرف أحدث حلول المواقف في السعودية.',
    btn: 'تحميل من App Store',
    url: 'https://apps.apple.com/sa/app/parkinzi/id6751274124',
  };

  // Write the HTML file
  const htmlPath = path.join(BLOG_DIR, `${post.slug}.html`);
  if (fs.existsSync(htmlPath)) {
    throw new Error(`Post already exists at ${htmlPath}; aborting to avoid overwrite.`);
  }
  fs.writeFileSync(htmlPath, buildPostHtml(post), 'utf8');
  console.log('[generate-daily-post] wrote', path.relative(ROOT, htmlPath));

  // Merge into posts.json
  const existing = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
  if (existing.some(p => p.slug === post.slug)) {
    throw new Error(`posts.json already has slug ${post.slug}`);
  }
  existing.push({
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    publishDate: post.publishDate,
    tags: post.tags,
  });
  existing.sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));
  fs.writeFileSync(POSTS_JSON, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log('[generate-daily-post] updated posts.json, total =', existing.length);

  // Stamp the model + topic into an output for the workflow log
  const commitNote = `Generated by ${model} — topic: ${topic}`;
  console.log('[generate-daily-post]', commitNote);
}

main().catch(err => {
  console.error('[generate-daily-post] FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
