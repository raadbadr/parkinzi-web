/**
 * post-runtime.js — runtime behaviors for blog post pages:
 *   - reading progress bar
 *   - copy-link button
 *   - related posts loader (by tag overlap, falling back to recency)
 */
(function () {
  // ---------- Reading progress ----------
  var progressEl = document.querySelector('.post-progress span');
  if (progressEl) {
    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progressEl.style.transform = 'scaleX(' + pct + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  // ---------- Copy link button ----------
  document.querySelectorAll('.post-share-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.dataset.shareUrl || window.location.href;
      var label = btn.querySelector('.post-share-copy-label');
      var original = label ? label.textContent : 'نسخ الرابط';
      var ok = function () {
        btn.classList.add('is-copied');
        if (label) label.textContent = 'تم النسخ ✓';
        setTimeout(function () {
          btn.classList.remove('is-copied');
          if (label) label.textContent = original;
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok).catch(function () {
          window.prompt('انسخ الرابط:', url);
        });
      } else {
        window.prompt('انسخ الرابط:', url);
      }
    });
  });

  // ---------- Related posts ----------
  var relatedContainer = document.getElementById('relatedPosts');
  if (relatedContainer) {
    var here = location.pathname.split('/').pop();
    fetch('/blog/posts.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) {
        var now = new Date();
        var thisPost = posts.find(function (p) { return p.slug + '.html' === here; });
        var thisTags = (thisPost && thisPost.tags) || [];
        var pool = posts.filter(function (p) {
          return new Date(p.publishDate) <= now && p.slug + '.html' !== here;
        });
        // Score by tag overlap, tie-break by recency.
        pool.forEach(function (p) {
          var overlap = 0;
          (p.tags || []).forEach(function (t) { if (thisTags.indexOf(t) !== -1) overlap++; });
          p._score = overlap;
        });
        pool.sort(function (a, b) {
          if (b._score !== a._score) return b._score - a._score;
          return new Date(b.publishDate) - new Date(a.publishDate);
        });
        var list = pool.slice(0, 3);
        if (!list.length) return;
        var fmt = new Intl.DateTimeFormat('ar', {
          year: 'numeric', month: 'long', day: 'numeric',
          calendar: 'gregory', numberingSystem: 'latn',
        });
        var html = '<h2 class="related-posts-title">اقرأ أيضاً</h2><div class="related-grid">';
        list.forEach(function (p) {
          html += '<a href="/blog/' + p.slug + '.html" class="related-card">'
                + '<span class="related-card-date">' + fmt.format(new Date(p.publishDate)) + '</span>'
                + '<div class="related-card-title">' + p.title + '</div>'
                + '</a>';
        });
        html += '</div>';
        relatedContainer.innerHTML = html;
      })
      .catch(function () {});
  }
})();
