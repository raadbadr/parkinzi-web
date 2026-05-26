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
  // التقنية والأنظمة (1-20)
  'أحدث أنظمة المواقف الذكية في 2026',
  'تقنيات IoT في إدارة مواقف السيارات',
  'كاميرات ANPR والتعرف على لوحات السيارات في المواقف',
  'الذكاء الاصطناعي وتوقع ازدحام المواقف',
  'أنظمة الدفع الذكي للمواقف وآخر التطورات',
  'كيفية تركيب أنظمة المواقف الذكية في المباني',
  'مستشعرات المواقف وأنواعها الحديثة',
  'تطبيقات المواقف الناشئة عالمياً وإقليمياً',
  'تقنية Blockchain في تأجير المواقف',
  'دور 5G في تشغيل المواقف الذكية',
  'أتمتة بوابات المواقف ومواقف الفلل',
  'المواقف متعددة الطوابق الآلية',
  'استخدام Computer Vision في المواقف',
  'الواقع المعزز AR في إرشاد السائق للموقف',
  'أنظمة الإنذار المبكر للمخالفات في المواقف',
  'منصات SaaS لإدارة المواقف للمنشآت',
  'API وتكامل أنظمة المواقف مع تطبيقات الملاحة',
  'تقنية NFC و RFID في دخول المواقف',
  'مواقف ذاتية الركن — كيف تعمل وأمثلة',
  'Edge Computing وتسريع قرارات المواقف',

  // السيارات الكهربائية (21-35)
  'مواقف السيارات الكهربائية وأحدث شواحن 2026',
  'تقنية V2G وتأثيرها على مواقف الشحن',
  'مقارنة بين شواحن Level 2 و DC السريعة',
  'شحن السيارة الكهربائية في المنزل — دليل المبتدئين',
  'شبكات الشحن في الطرق السريعة السعودية',
  'أفضل السيارات الكهربائية المتاحة في السعودية',
  'تكلفة تشغيل سيارة كهربائية vs بنزين في الخليج',
  'صيانة السيارات الكهربائية — ما يختلف',
  'بطاريات الجيل القادم وأثرها على وقت الشحن',
  'الطاقة الشمسية لشحن السيارات الكهربائية',
  'دعم لوسيد السعودية ومستقبل التصنيع المحلي',
  'تجربة قيادة سيارة كهربائية في حر الصيف السعودي',
  'إعادة تدوير بطاريات السيارات الكهربائية',
  'مستقبل محطات Tesla Supercharger في الخليج',
  'كيف تختار شاحن منزلي مناسب لسيارتك',

  // أدلة المدن (36-50)
  'مواقف الرياض — دليل الأحياء الرئيسية',
  'مواقف كورنيش جدة — دليل الزائر',
  'مواقف الدمام والخبر للزائرين والمقيمين',
  'دليل مواقف المدينة المنورة قرب الحرم',
  'مواقف مكة المكرمة في موسم العمرة',
  'مواقف مطار الملك خالد الدولي',
  'مواقف مطار الملك عبدالعزيز جدة',
  'مواقف الرياض بارك ومولات شمال الرياض',
  'مواقف نيوم — كيف تخطط للمستقبل',
  'مواقف موسم الرياض والفعاليات الكبرى',
  'مواقف منطقة الدرعية التاريخية',
  'مواقف العلا — تجربة الزوار',
  'مواقف الطائف وأبها في الصيف',
  'مواقف القدية وأنشطة الترفيه',
  'دليل مواقف منطقة البلد التاريخية في جدة',

  // المالك والاستثمار (51-65)
  'دراسة جدوى تأجير موقف خاص',
  'استثمار العقارات في المواقف المؤجرة',
  'كيف تحدد سعر موقفك المؤجر',
  'الفرق بين المواقف المغطاة والمكشوفة في السعودية',
  'تأمين السيارات داخل المواقف الذكية',
  'حقوق وواجبات مالك الموقف المؤجر',
  'كيف تحول موقف فيلتك إلى مصدر دخل',
  'الضرائب والزكاة على دخل تأجير المواقف',
  'أفضل ممارسات إدارة موقف شركة',
  'عقود تأجير المواقف — نماذج وشروط',
  'كيف تحمي موقفك من الاستخدام غير المصرح به',
  'تركيب كاميرات مراقبة في موقفك',
  'صيانة الموقف المؤجر — قائمة شاملة',
  'تقييم العائد الاستثماري ROI للموقف',
  'الفرق بين تأجير شهري وساعي للمواقف',

  // المستخدم والتجربة (66-80)
  'تجربة المستخدم في تطبيقات المواقف',
  'حماية البيانات الشخصية في تطبيقات المواقف',
  'كيف تتعامل مع مخالفات المواقف في السعودية',
  'نصائح لإيجاد موقف بسرعة في ساعات الذروة',
  'إتيكيت ركن السيارة في الأحياء السكنية',
  'كيف تشكو موقفاً مخالفاً للنظام',
  'موقف ذوي الاحتياجات الخاصة — الحقوق والواجبات',
  'مواقف الحوامل وكبار السن في المنشآت العامة',
  'كيف تتفادى السرقة من سيارتك في المواقف',
  'التحقق من حالة المخالفات عبر أبشر',
  'استرداد رسوم المخالفات الخاطئة',
  'مواقف الدراجات النارية وحلولها الذكية',
  'مواقف الحافلات السياحية في الوجهات الكبرى',
  'المواقف وسلامة الأطفال — إرشادات',
  'كيف تختار التطبيق المناسب لإدارة سيارتك',

  // المستقبل والمدن (81-95)
  'مواقف الطائرات بدون طيار للتوصيل',
  'تجارب مدن عالمية في إدارة المواقف',
  'المواقف في المدن الذكية الخليجية',
  'إدارة المواقف خلال الفعاليات الكبرى',
  'مواقف الشركات والإدارة الجماعية',
  'مواقف السيارات والاستدامة البيئية',
  'رؤية 2030 وقطاع المواقف',
  'كأس العالم 2034 والاستعداد للمواقف',
  'تأثير العمل عن بُعد على الطلب على المواقف',
  'مستقبل المواقف الحضرية في 2030',
  'دمج مواقف السيارات مع وسائل النقل العام',
  'مواقف Park & Ride وتجربة المترو',
  'تأثير السيارات ذاتية القيادة على المواقف',
  'الموبيليتي as a Service وتأثيرها على ملكية السيارة',
  'تخطيط المدن الجديدة ومواقفها',
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
    throw new Error('ANTHROPIC_API_KEY is not set. Add it in GitHub → Settings → Secrets → Actions.');
  }
  // Default to Haiku 4.5 — ~5x cheaper than Sonnet for blog-quality output.
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  // Web search is OFF by default — it's the single biggest cost driver
  // ($10/1000 searches + 5-10x the input tokens). Haiku already knows the
  // topics well enough to write strong evergreen posts. Set
  // WEB_SEARCH_USES=1+ via repo var when you want fresh news on a specific
  // day.
  const searchUses = Number(process.env.WEB_SEARCH_USES || 0);
  // Bumped from 3500 → 5000 because each post now carries a TL;DR, key
  // takeaways block, and an FAQ section in addition to the main body.
  const maxTokens = Number(process.env.MAX_TOKENS || 5000);
  const client = new Anthropic();

  const topic = pickTopic();
  const todayIso = new Date().toISOString().slice(0, 10);
  const publishDate = `${todayIso}T10:00:00+03:00`;
  console.log('[generate-daily-post] topic       =', topic);
  console.log('[generate-daily-post] model       =', model);
  console.log('[generate-daily-post] searchUses  =', searchUses);
  console.log('[generate-daily-post] maxTokens   =', maxTokens);

  const searchInstruction = searchUses > 0
    ? '1) استخدم web_search للبحث عن آخر التطورات والأرقام في 2026.'
    : '1) اكتب من معرفتك العامة عن الموضوع. لا تخترع أرقاماً محددة أو أسماء شركات لست متأكداً منها — اكتفِ بالمعلومات العامة الموثوقة.';

  const userPrompt = `أنت كاتب مدوّنة عربي محترف لموقع PARKINZI — منصة سعودية للمواقف الذكية.

اكتب مقال مدوّنة بالعربية الفصحى (بدون لهجات) عن:
"${topic}"

تعليمات:
${searchInstruction}
2) المقال الرئيسي (body) من 900–1300 كلمة، عناوين فرعية H2 و H3 واضحة، فقرات قصيرة، قوائم نقطية حيث تناسب.
3) أسلوب احترافي، معلوماتي، بدون مبالغة.
4) السوق المستهدف: السعودية والخليج. اربط بالسياق المحلي حيث يصح.
5) لا تضمّن خرافات أو معلومات غير موثّقة. لا تضع أرقام محددة (أسعار أو إحصائيات) إلا إذا كنت متأكداً منها 100%.

أرجع JSON واحد فقط، بدون أي نص قبله أو بعده، وبدون code fences. هذه البنية الكاملة:
{
  "slug": "english-slug-using-dashes",
  "title": "العنوان بالعربية",
  "summary": "ملخص في جملة أو جملتين (للـ meta description)",
  "description": "وصف SEO أطول قليلاً (140–160 حرف)",
  "section": "قسم مثل: تقنية، شحن، دليل، تحليل",
  "breadcrumb": "عنوان قصير 3–5 كلمات للـ breadcrumb",
  "tags": ["وسم1", "وسم2", "وسم3", "وسم4"],
  "readMinutes": 6,
  "tldr": "ملخص سريع (2-3 جمل) يجيب على السؤال الأساسي للمقال — مهم جداً لأدوات الذكاء الاصطناعي.",
  "keyTakeaways": [
    "نقطة جوهرية رقم 1",
    "نقطة جوهرية رقم 2",
    "نقطة جوهرية رقم 3",
    "نقطة جوهرية رقم 4"
  ],
  "body": "<p>مقدمة</p><h2>قسم رئيسي</h2><p>...</p>",
  "faq": [
    {"q": "سؤال شائع 1؟", "a": "إجابة مختصرة 1–2 جمل."},
    {"q": "سؤال شائع 2؟", "a": "إجابة مختصرة 1–2 جمل."},
    {"q": "سؤال شائع 3؟", "a": "إجابة مختصرة 1–2 جمل."},
    {"q": "سؤال شائع 4؟", "a": "إجابة مختصرة 1–2 جمل."}
  ]
}

ملاحظات:
- body: HTML نظيف. ابدأ بـ <p> مقدمة. استخدم <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>.
- بدون <html>, <head>, <body>, <script>, <style>, <img>, <iframe>, روابط خارجية.
- 4 نقاط على الأقل في keyTakeaways، و 4 أسئلة على الأقل في faq.
- tldr قصير وحاسم — هو ما تقرأه أدوات AI أولاً.
- الـ FAQ يجب أن يكون عن الموضوع نفسه، أسئلة حقيقية يطرحها الناس.
- لا تضمّن CTA في النهاية — يضاف تلقائياً.`;

  // Build request params; only attach tools when we actually want search.
  const requestParams = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userPrompt }],
  };
  if (searchUses > 0) {
    requestParams.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: searchUses,
    }];
  }

  let response;
  try {
    response = await client.messages.create(requestParams);
  } catch (err) {
    // Surface Anthropic-API specific errors clearly so GitHub Actions logs
    // show the real cause (auth, rate limit, billing, unknown model, etc.).
    const status = err && err.status;
    const apiType = err && err.error && err.error.error && err.error.error.type;
    const apiMsg  = err && err.error && err.error.error && err.error.error.message;
    console.error('[generate-daily-post] Anthropic call failed:');
    console.error('  status:', status);
    console.error('  type  :', apiType);
    console.error('  msg   :', apiMsg);
    console.error('  raw   :', err && err.message);
    throw err;
  }

  console.log('[generate-daily-post] usage:', JSON.stringify(response.usage));
  console.log('[generate-daily-post] stop_reason:', response.stop_reason);

  // Find the final assistant text block (web_search returns interleaved blocks).
  const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  if (!textBlocks.trim()) {
    throw new Error('Claude returned no text blocks. stop_reason=' + response.stop_reason
      + '\nFull response: ' + JSON.stringify(response.content).slice(0, 600));
  }

  // Strip code fences if Claude wrapped the JSON in ```json … ```.
  const cleaned = textBlocks
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in Claude response.\nFirst 600 chars:\n'
      + textBlocks.slice(0, 600));
  }

  let post;
  try {
    post = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('Failed to parse JSON from Claude:\n' + e.message
      + '\nRaw match (first 600 chars):\n' + jsonMatch[0].slice(0, 600));
  }

  // Sanity-check required fields
  for (const f of ['slug', 'title', 'summary', 'body', 'tags']) {
    if (!post[f]) throw new Error(`Claude output missing field: ${f}`);
  }

  // Quality gates — refuse to publish broken or trivially-short content.
  // A failing run is loud (exit 1, Actions emails you) instead of silently
  // pushing a 50-word stub article.
  if (!Array.isArray(post.tags) || post.tags.length === 0) {
    throw new Error('post.tags must be a non-empty array');
  }
  const bodyText = String(post.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (bodyText.length < 1500) {
    throw new Error(`body too short (${bodyText.length} chars of text); want >= 1500.\nFirst 200 chars:\n${bodyText.slice(0, 200)}`);
  }
  if (!/<h2[\s>]/i.test(post.body)) {
    throw new Error('body missing any <h2> heading — likely malformed HTML');
  }
  if (!post.tldr || String(post.tldr).trim().length < 40) {
    throw new Error('tldr missing or too short — needed for AI surfaces');
  }
  if (!Array.isArray(post.keyTakeaways) || post.keyTakeaways.length < 3) {
    throw new Error('keyTakeaways must be an array of at least 3 items');
  }
  if (!Array.isArray(post.faq) || post.faq.length < 3) {
    throw new Error('faq must be an array of at least 3 {q,a} items');
  }
  for (const item of post.faq) {
    if (!item || !item.q || !item.a) {
      throw new Error('every faq entry must have non-empty q and a');
    }
  }
  // Reject obvious AI hallucination tells (price/year that we know are wrong,
  // claims of "today" inside an article that lives forever, etc.).
  const banned = [/\$\s*\d/, /USD\s*\d/, /https?:\/\//, /<script/i, /<style/i, /<iframe/i];
  for (const re of banned) {
    if (re.test(post.body)) {
      throw new Error(`body contains banned pattern ${re}; not publishing`);
    }
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
