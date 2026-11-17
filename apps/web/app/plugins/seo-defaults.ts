export default defineNuxtPlugin(() => {
  const { siteName, seo } = useSiteSettings();
  const { robotsContent, indexingEnabled } = useIndexing();
  const config = useRuntimeConfig();

  useHead(() => {
    const site = String(siteName.value || config.public.siteName || "SSS Audit").trim();
    const google = String(seo.value?.googleSiteVerification || "").trim();
    const yandex = String(seo.value?.yandexVerification || "").trim();
    return {
      titleTemplate: (title?: string) => {
        const t = String(title || "").trim();
        if (!t || t === site) return site;
        if (t.includes(site)) return t;
        return `${t} — ${site}`;
      },
      meta: [
        { name: "robots", content: robotsContent.value },
        { name: "googlebot", content: robotsContent.value },
        { property: "og:site_name", content: site },
        { name: "application-name", content: site },
        ...(google
          ? [{ name: "google-site-verification", content: google }]
          : []),
        ...(yandex
          ? [{ name: "yandex-verification", content: yandex }]
          : []),
        ...(indexingEnabled.value
          ? []
          : [{ name: "x-ssaudit-indexing", content: "off" }]),
      ],
    };
  });
});
