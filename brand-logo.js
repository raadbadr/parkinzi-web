/**
 * brand-logo.js
 * Replaces every visible occurrence of the literal text "PARKINZI"
 * with the full brand wordmark (never the P-only mark — the bare P
 * reads as a generic parking sign, not the brand).
 */
(function () {
  var LOGO_DARK = '/parkinzi-logo-full-dark.png';
  var LOGO_LIGHT = '/parkinzi-logo-full-light.png';
  var SKIP_SELECTOR = 'script, style, noscript, code, pre, title, .brand-logo-mark, .brand-logo-inline, [data-brand-logo-footer]';
  var TARGET = 'PARKINZI';

  function logoSrc() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? LOGO_LIGHT : LOGO_DARK;
  }

  function makeLogo() {
    var img = document.createElement('img');
    img.src = logoSrc();
    img.alt = TARGET;
    img.className = 'brand-logo-mark';
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  /* الثيم يتبدّل بضغطة واحدة — لازم كل العلامات تتبدّل معه وإلا اختفى النص الأبيض على خلفية فاتحة */
  function syncTheme() {
    var src = logoSrc();
    var marks = document.getElementsByClassName('brand-logo-mark');
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].getAttribute('src') !== src) marks[i].setAttribute('src', src);
    }
  }

  function replaceInBody() {
    if (!document.body) return 0;
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue.indexOf(TARGET) === -1) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    var queue = [];
    var n;
    while ((n = walker.nextNode())) queue.push(n);

    for (var i = 0; i < queue.length; i++) {
      var textNode = queue[i];
      var parent = textNode.parentNode;
      if (!parent) continue;
      var parts = textNode.nodeValue.split(TARGET);
      var frag = document.createDocumentFragment();
      for (var j = 0; j < parts.length; j++) {
        if (parts[j]) frag.appendChild(document.createTextNode(parts[j]));
        if (j < parts.length - 1) frag.appendChild(makeLogo());
      }
      parent.replaceChild(frag, textNode);
    }
    return queue.length;
  }

  // Expose for debugging.
  window.__brandLogoReplace = replaceInBody;

  function start() {
    replaceInBody();
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    // Watch the DOM for later changes (setLang() rewrites translated
    // strings, related-posts loader injects cards, etc.).
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        replaceInBody();
      }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // data-theme يتغيّر على <html> عند تبديل الثيم
    new MutationObserver(syncTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
