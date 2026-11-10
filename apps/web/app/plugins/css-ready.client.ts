export default defineNuxtPlugin(() => {
  const html = document.documentElement;
  if (html.classList.contains("css-ready")) return;

  const mark = () => html.classList.add("css-ready");

  const appLinks = () =>
    Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")).filter(
      (l) => {
        const href = l.getAttribute("href") || "";
        return href.includes("/_nuxt/") || href.includes("assets/css");
      },
    );

  const linkLoaded = (link: HTMLLinkElement) => {
    try {
      return Boolean(link.sheet);
    } catch {
      return false;
    }
  };

  const wait = () => {
    const links = appLinks();
    const pending = links.filter((l) => !linkLoaded(l));
    if (!links.length || pending.length) {
      return false;
    }
    requestAnimationFrame(() => requestAnimationFrame(mark));
    return true;
  };

  if (wait()) return;

  const onLoad = () => {
    if (wait()) {
      document.removeEventListener("load", onLoad, true);
    }
  };
  document.addEventListener("load", onLoad, true);

  // Vite may inject <style data-vite-dev-id> after links settle
  const obs = new MutationObserver(() => {
    if (wait()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Never blank forever
  window.setTimeout(() => {
    obs.disconnect();
    document.removeEventListener("load", onLoad, true);
    mark();
  }, 4000);
});
