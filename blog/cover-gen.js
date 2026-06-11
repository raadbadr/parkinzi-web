/**
 * cover-gen.js
 * Deterministic gradient + SVG icon cover for blog posts.
 * Same slug → same gradient/icon every time.
 * Exposes window.parkinziBuildCover(slug, tags) → HTML string.
 */
(function () {
  // 5 brand-aligned gradients (60° hue window around #0068b8).
  var GRADIENTS = [
    'linear-gradient(135deg, #0a2540 0%, #0068b8 60%, #0099d6 100%)', // navy → primary → sky
    'linear-gradient(135deg, #0068b8 0%, #19bcf6 60%, #67e8f9 100%)', // primary → cyan
    'linear-gradient(135deg, #312e81 0%, #2052a0 50%, #0068b8 100%)', // indigo → primary
    'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #38bdf8 100%)', // royal → primary → sky
    'linear-gradient(135deg, #1f2a3c 0%, #364356 60%, #5a6a83 100%)', // graphite — for evergreen
  ];

  // Custom product-aligned SVG icons.
  var ICONS = {
    parking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3.5"/><path d="M9 17V7h4.5a3 3 0 0 1 0 6H9"/></svg>',
    ev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="14" rx="2.5"/><path d="M16 10h1.8a2.2 2.2 0 0 1 2.2 2.2v3.6a2.2 2.2 0 0 1-2.2 2.2"/><path d="M11 9.5l-3 5h4l-3 5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16.5h14l-1.5-5.5h-11Z"/><path d="M6.5 11l1-3a2 2 0 0 1 1.9-1.4h5.2a2 2 0 0 1 1.9 1.4l1 3"/><circle cx="8.5" cy="16.5" r="1.4"/><circle cx="15.5" cy="16.5" r="1.4"/></svg>',
    city: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l5-3 5 3v12"/><path d="M13 21V13l4-2 4 2v8"/><path d="M6 12h2M6 16h2M16 16h2"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8"/><path d="M10 20V4"/><path d="M16 20v-9"/><path d="M22 20H2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-4h4v4"/></svg>',
  };

  var KEYWORD_TO_ICON = [
    [/شحن|كهربائ|ev|charger/i, 'ev'],
    [/سيار|car|قياد/i, 'car'],
    [/مدينة|مدن|city|الرياض|جدة|دمام|مكة|المدينة|الطائف|تبوك|أبها|كورنيش|الخبر/i, 'city'],
    [/خريطة|موقع|map|دليل|مطار|location|airport/i, 'map'],
    [/إحصائ|تحليل|chart|بيانات|أرقام/i, 'chart'],
    [/قانون|مخالفات|حقوق|تأمين|أمان|sec/i, 'shield'],
    [/استثمار|دخل|سعر|تأجير|ربح|money|اقتصاد/i, 'money'],
    [/شركة|مول|منشآت|business|تجار|عقار/i, 'building'],
  ];

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function pickGradient(slug) { return GRADIENTS[hashCode(slug || '') % GRADIENTS.length]; }

  function pickIcon(slug, tags) {
    var hay = (slug + ' ' + (tags || []).join(' ')).toLowerCase();
    for (var i = 0; i < KEYWORD_TO_ICON.length; i++) {
      if (KEYWORD_TO_ICON[i][0].test(hay)) return ICONS[KEYWORD_TO_ICON[i][1]];
    }
    return ICONS.parking;
  }

  function buildCover(slug, tags, opts) {
    opts = opts || {};
    var gradient = pickGradient(slug);
    var icon = pickIcon(slug, tags);
    var cls = opts.large ? 'blog-card-cover post-hero-inner' : 'blog-card-cover';
    return '<div class="' + cls + '" aria-hidden="true" style="background:' + gradient + ';">' + icon + '</div>';
  }

  window.parkinziBuildCover = buildCover;

  function mount() {
    var nodes = document.querySelectorAll('[data-blog-cover]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.coverRendered === '1') continue;
      var slug = el.dataset.coverSlug || '';
      var tags = (el.dataset.coverTags || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var large = el.dataset.coverSize === 'large';
      if (large) {
        // For post-hero we use the gradient on the wrapper itself.
        var gradient = pickGradient(slug);
        var icon = pickIcon(slug, tags);
        el.style.background = gradient;
        el.insertAdjacentHTML('beforeend', icon);
      } else {
        el.insertAdjacentHTML('beforeend', buildCover(slug, tags));
      }
      el.dataset.coverRendered = '1';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
