export type SiteContacts = {
  email: string;
  email_partners: string;
  telegram: string;
  vk: string;
  youtube: string;
  x: string;
  instagram: string;
  facebook: string;
  discord: string;
};

export type HomeSections = {
  heroStats: boolean;
  heroBanners: boolean;
  listing: boolean;
  aside: boolean;
  slots: boolean;
  promoBanner: boolean;
  newSlots: boolean;
  articles: boolean;
  guides: boolean;
  partnerBrands: boolean;
  expert: boolean;
  trust: boolean;
  communityStats: boolean;
  method: boolean;
  homeBonuses: boolean;
  homeForum: boolean;
  homeB2b: boolean;
  [key: string]: boolean;
};

export type SiteSettings = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  favicon32Url: string | null;
  appleTouchIconUrl: string | null;
  contacts: SiteContacts;
  homeSections: HomeSections;
  updatedAt: string | null;
};

const defaultHomeSections: HomeSections = {
  heroStats: true,
  heroBanners: true,
  listing: true,
  aside: true,
  slots: true,
  promoBanner: true,
  newSlots: true,
  articles: true,
  guides: true,
  partnerBrands: false,
  expert: true,
  trust: true,
  communityStats: true,
  method: true,
  homeBonuses: true,
  homeForum: true,
  homeB2b: true,
};

const defaults: SiteSettings = {
  siteName: "SS Audit",
  logoUrl: "/img/brand/logo.webp",
  faviconUrl: "/favicon.png",
  favicon32Url: "/favicon-32.png",
  appleTouchIconUrl: "/apple-touch-icon.png",
  contacts: {
    email: "editorial@ss-audit.local",
    email_partners: "partners@ss-audit.local",
    telegram: "",
    vk: "",
    youtube: "",
    x: "",
    instagram: "",
    facebook: "",
    discord: "",
  },
  homeSections: { ...defaultHomeSections },
  updatedAt: null,
};

function normalize(raw?: Partial<SiteSettings> | null): SiteSettings {
  return {
    ...defaults,
    ...raw,
    contacts: { ...defaults.contacts, ...(raw?.contacts || {}) },
    homeSections: { ...defaultHomeSections, ...(raw?.homeSections || {}) },
  };
}

export function useSiteSettings() {
  const config = useRuntimeConfig();
  const state = useState<SiteSettings | null>("site-settings", () => null);

  const { data, pending, error, refresh } = useAsyncData(
    "site-settings-fetch",
    () =>
      $fetch<{ settings: SiteSettings }>(`${config.public.apiBase}/v1/site-settings`),
    { server: true, lazy: false },
  );

  watch(
    data,
    (v) => {
      if (v?.settings) state.value = normalize(v.settings);
    },
    { immediate: true },
  );

  const resolved = computed(() => normalize(state.value));
  const siteName = computed(() => resolved.value.siteName);
  const logoUrl = computed(() => resolved.value.logoUrl || defaults.logoUrl!);
  const faviconUrl = computed(() => resolved.value.faviconUrl || defaults.faviconUrl!);
  const favicon32Url = computed(() => resolved.value.favicon32Url || defaults.favicon32Url!);
  const appleTouchIconUrl = computed(
    () => resolved.value.appleTouchIconUrl || defaults.appleTouchIconUrl!,
  );
  const contacts = computed(() => resolved.value.contacts);
  const homeSections = computed(() => resolved.value.homeSections);

  return {
    settings: resolved,
    siteName,
    logoUrl,
    faviconUrl,
    favicon32Url,
    appleTouchIconUrl,
    contacts,
    homeSections,
    pending,
    error,
    refresh,
  };
}
