export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const { siteName } = useSiteSettings();
  const allow =
    String(config.public.allowIndexing ?? "").toLowerCase() === "true";
  const robots = allow
    ? "index, follow"
    : "noindex, nofollow, noarchive, nosnippet";

  useHead(() => {
    const site = String(siteName.value || config.public.siteName || "SS Audit").trim();
    return {
      titleTemplate: (title?: string) => {
        const t = String(title || "").trim();
        if (!t || t === site) return site;
        if (t.includes(site)) return t;
        return `${t} — ${site}`;
      },
      meta: [
        { name: "robots", content: robots },
        { name: "googlebot", content: robots },
        { property: "og:site_name", content: site },
        { name: "application-name", content: site },
      ],
    };
  });
});
