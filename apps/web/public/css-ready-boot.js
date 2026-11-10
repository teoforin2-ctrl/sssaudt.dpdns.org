(function () {
  // Reveal #__nuxt only after stylesheet *files* have loaded — not when <link> tags appear.
  var done = false;
  function mark() {
    if (done) return;
    done = true;
    document.documentElement.classList.add("css-ready");
  }

  function isAppStylesheet(link) {
    var href = link.getAttribute("href") || "";
    return href.indexOf("/_nuxt/") !== -1 || href.indexOf("assets/css") !== -1;
  }

  function linkLoaded(link) {
    if (link.disabled) return true;
    // sheet is null while still loading; cross-origin may throw
    try {
      if (link.sheet) return true;
    } catch (e) {
      // CORS — if load already fired, treat as done via listeners below
    }
    return false;
  }

  function appLinks() {
    return Array.prototype.slice.call(
      document.querySelectorAll("link[rel='stylesheet']")
    ).filter(isAppStylesheet);
  }

  function waitLinksThenMark() {
    var links = appLinks();
    if (!links.length) return false;

    var pending = links.filter(function (l) {
      return !linkLoaded(l);
    });

    if (!pending.length) {
      // One frame so computed styles apply before reveal
      requestAnimationFrame(function () {
        requestAnimationFrame(mark);
      });
      return true;
    }

    var left = pending.length;
    function one() {
      left -= 1;
      if (left <= 0) {
        requestAnimationFrame(function () {
          requestAnimationFrame(mark);
        });
      }
    }
    pending.forEach(function (l) {
      l.addEventListener("load", one, { once: true });
      l.addEventListener("error", one, { once: true });
      // Race: may have finished between filter and listener
      if (linkLoaded(l)) one();
    });
    return true;
  }

  if (waitLinksThenMark()) {
    // Last resort if load events never fire
    setTimeout(mark, 4000);
    return;
  }

  // Links not in SSR yet — wait for them, then for load
  var obs = new MutationObserver(function () {
    if (waitLinksThenMark()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(function () {
    obs.disconnect();
    mark();
  }, 4000);
})();
