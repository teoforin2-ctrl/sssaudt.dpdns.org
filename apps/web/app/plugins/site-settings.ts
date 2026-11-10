import type { SiteSettings } from "~/composables/useSiteSettings";

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig();
  const state = useState<SiteSettings | null>("site-settings", () => null);

  if (!state.value?.siteName) {
    try {
      const res = await $fetch<{ settings: SiteSettings }>(
        `${config.public.apiBase}/v1/site-settings`,
      );
      if (res?.settings) state.value = res.settings;
    } catch {
      // composable defaults apply
    }
  }

  const { siteName, faviconUrl, favicon32Url, appleTouchIconUrl } = useSiteSettings();
  const i18n = nuxtApp.$i18n as {
    mergeLocaleMessage: (locale: string, message: Record<string, unknown>) => void;
  };

  function syncBrandMessages(name: string) {
    const patch = { brand: name, footer: { rights: name } };
    i18n.mergeLocaleMessage("ru", patch);
    i18n.mergeLocaleMessage("en", patch);
  }

  syncBrandMessages(siteName.value);
  watch(siteName, (name) => syncBrandMessages(name));

  useHead(() => {
    const name = siteName.value || "SS Audit";
    return {
      titleTemplate: (title?: string) => {
        if (!title || title === name || title === "SS Audit") return name;
        if (title.includes(` — ${name}`)) return title;
        if (title.includes("SS Audit")) return title.replaceAll("SS Audit", name);
        return `${title} — ${name}`;
      },
      meta: [{ name: "description", content: `Online casino reviews — ${name}` }],
      link: [
        { key: "icon-32", rel: "icon", type: "image/png", sizes: "32x32", href: favicon32Url.value },
        { key: "icon-512", rel: "icon", type: "image/png", sizes: "512x512", href: faviconUrl.value },
        {
          key: "apple-touch",
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: appleTouchIconUrl.value,
        },
      ],
    };
  });
});
