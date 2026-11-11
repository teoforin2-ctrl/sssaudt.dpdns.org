import type { SiteSettings } from "~/composables/useSiteSettings";

export default defineNuxtPlugin({
  name: "site-settings",
  // Must run after @nuxtjs/i18n — enforce:pre made $i18n undefined and 500'd SSR
  dependsOn: ["i18n:plugin"],
  async setup(nuxtApp) {
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
    const i18n = nuxtApp.$i18n as
      | { mergeLocaleMessage?: (locale: string, message: Record<string, unknown>) => void }
      | undefined;

    function syncBrandMessages(name: string) {
      if (typeof i18n?.mergeLocaleMessage !== "function") return;
      const n = String(name || "").trim() || "SS Audit";
      const patch = { brand: n, footer: { rights: n } };
      i18n.mergeLocaleMessage("ru", patch);
      i18n.mergeLocaleMessage("en", patch);
    }

    syncBrandMessages(siteName.value);
    watch(siteName, (name) => syncBrandMessages(name), { immediate: true });

    useHead(() => {
      const name = String(siteName.value || "SS Audit").trim();
      return {
        titleTemplate: (title?: string) => {
          const t = String(title || "").trim();
          if (!t || t === name) return name;
          if (t.includes(name)) return t;
          if (t.includes("SS Audit") && name !== "SS Audit") {
            return t.replaceAll("SS Audit", name);
          }
          return `${t} — ${name}`;
        },
        meta: [
          { property: "og:site_name", content: name },
          { name: "application-name", content: name },
        ],
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
  },
});
