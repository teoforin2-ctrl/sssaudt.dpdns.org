export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const allow =
    String(config.public.allowIndexing ?? "").toLowerCase() === "true";
  const robots = allow
    ? "index, follow"
    : "noindex, nofollow, noarchive, nosnippet";

  useHead({
    titleTemplate: (title?: string) => {
      const site = String(config.public.siteName || "SS Audit");
      const t = String(title || "").trim();
      if (!t || t === site) return site;
      if (t.includes(site)) return t;
      return `${t} — ${site}`;
    },
    meta: [
      { name: "robots", content: robots },
      { name: "googlebot", content: robots },
    ],
  });
});
