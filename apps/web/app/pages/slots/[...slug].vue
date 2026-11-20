<script setup lang="ts">
import { findNavLink, locTitle } from "~/data/site-nav";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const parts = computed(() => (route.params.slug as string[]) || []);
const leaf = computed(() => parts.value[parts.value.length - 1] || "");
const path = computed(() => `/slots/${parts.value.join("/")}`);
const navLink = computed(() => findNavLink(path.value));

const isProvidersIndex = computed(() => parts.value[0] === "providers" && parts.value.length === 1);
const providerSlug = computed(() =>
  parts.value[0] === "providers" && parts.value.length === 2 ? parts.value[1] : "",
);
const isNewHub = computed(() => leaf.value === "new" && parts.value.length === 1);
const isHub = computed(() => isProvidersIndex.value || isNewHub.value);

type SlotDetail = {
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  volatility?: string | null;
  grid?: string | null;
  mechanics?: string[];
  providerName?: string | null;
  providerSlug?: string | null;
  demoUrl?: string | null;
  description?: string | null;
  releaseDate?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    ogImage?: string | null;
  } | null;
  casinos?: { slug: string; name: string }[];
};

type SlotItem = {
  slug: string;
  title: string;
  rtp?: number | null;
  providerName?: string | null;
  providerSlug?: string | null;
  isNew?: boolean;
  theme?: string;
  demoUrl?: string | null;
};

type ProviderListItem = { slug: string; name: string; slotsCount: number; description?: string | null };
type ProviderDetail = {
  slug: string;
  name: string;
  description?: string | null;
  slots: SlotItem[];
  casinos: { slug: string; name: string; rating: number; hot?: boolean }[];
};

const { data: hubData, pending: hubPending } = await useAsyncData(
  () => `slots-hub-${leaf.value}-${locale.value}`,
  async () => {
    if (!isHub.value) return null;
    return $fetch<{ items: SlotItem[] }>(`${config.public.apiBase}/v1/slots`, {
      query: { locale: locale.value, limit: 96 },
    });
  },
  { watch: [leaf, locale, isHub] },
);

const { data: providersData, pending: providersPending } = await useAsyncData(
  () => `game-providers-${locale.value}`,
  async () => {
    if (!isProvidersIndex.value) return null;
    return $fetch<{ items: ProviderListItem[] }>(`${config.public.apiBase}/v1/game-providers`, {
      query: { locale: locale.value },
    });
  },
  { watch: [isProvidersIndex, locale] },
);

const { data: providerData, pending: providerPending } = await useAsyncData(
  () => `game-provider-${providerSlug.value}-${locale.value}`,
  async () => {
    if (!providerSlug.value) return null;
    try {
      return await $fetch<{ provider: ProviderDetail }>(
        `${config.public.apiBase}/v1/game-providers/${providerSlug.value}`,
        { query: { locale: locale.value } },
      );
    } catch {
      return null;
    }
  },
  { watch: [providerSlug, locale] },
);

const hubSlots = computed(() => {
  let list = hubData.value?.items ?? [];
  if (leaf.value === "new") list = list.filter((s) => s.isNew);
  return list;
});

const provider = computed(() => providerData.value?.provider);

const { data, pending, error: slotError } = await useAsyncData(
  () => `slot-detail-${leaf.value}-${locale.value}`,
  async () => {
    if (isHub.value || providerSlug.value || !leaf.value) return null;
    try {
      return await $fetch<{ slot: SlotDetail }>(
        `${config.public.apiBase}/v1/slots/${leaf.value}`,
        { query: { locale: locale.value } },
      );
    } catch (err: unknown) {
      const status = Number((err as { statusCode?: number }).statusCode || 0);
      if (status === 410) throw createError({ statusCode: 410, statusMessage: "Gone" });
      return null;
    }
  },
  { watch: [leaf, locale, isHub, providerSlug] },
);

const slot = computed(() => data.value?.slot);

if (import.meta.server && slotError.value) {
  const status = Number((slotError.value as { statusCode?: number }).statusCode || 0);
  if (status === 410) throw createError({ statusCode: 410, statusMessage: "Gone" });
}

if (
  !pending.value &&
  !providerPending.value &&
  !isHub.value &&
  !provider.value &&
  !slot.value
) {
  throw createError({ statusCode: 404, statusMessage: "Not found" });
}

const ogImage = useEntityOgImage("slot", () => slot.value?.slug || leaf.value, {
  seoOg: () => slot.value?.seo?.ogImage,
});

const stubTitle = computed(() =>
  navLink.value ? locTitle(navLink.value.title, locale.value) : leaf.value,
);

const hubLead = computed(() =>
  isProvidersIndex.value ? t("catalog.hub.providersLead") : t("catalog.hub.newSlotsLead"),
);

const { pickEntity: seoPickEntity } = useSeoTemplate("slot", () => ({
  slot: slot.value?.title || provider.value?.name || stubTitle.value,
  casino: "",
}));

usePageSeo({
  title: () =>
    seoPickEntity(
      "title",
      () => slot.value?.seo,
      provider.value?.name || slot.value?.title || stubTitle.value,
    ),
  description: () =>
    seoPickEntity(
      "description",
      () => slot.value?.seo,
      provider.value?.description
        || slot.value?.description
        || (isHub.value ? hubLead.value : "")
        || "",
    ),
  ogImage,
});

useBreadcrumbJsonLd(() => {
  if (slot.value) {
    return [
      { name: t("catalog.slotsTitle"), path: "/slots" },
      { name: slot.value.title },
    ];
  }
  if (provider.value) {
    return [
      { name: t("catalog.slotsTitle"), path: "/slots" },
      { name: t("catalog.hub.providersTitle"), path: "/slots/providers" },
      { name: provider.value.name },
    ];
  }
  return [
    { name: t("catalog.slotsTitle"), path: "/slots" },
    { name: stubTitle.value },
  ];
});

useJsonLd(() => {
  if (!slot.value) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: slot.value.title,
    description: slot.value.description || undefined,
    gamePlatform: "Online",
    author: slot.value.providerName
      ? { "@type": "Organization", name: slot.value.providerName }
      : undefined,
  };
});
</script>

<template>
  <section v-if="isHub" class="page">
    <header class="intro">
      <p class="eyebrow">{{ t("catalog.slotsTitle") }}</p>
      <h1 class="page-title">{{ stubTitle }}</h1>
      <p class="lead">{{ hubLead }}</p>
    </header>

    <div class="tabs">
      <NuxtLink :to="localePath('/slots')" class="tab">{{ t("catalog.hub.all") }}</NuxtLink>
      <NuxtLink :to="localePath('/slots/new')" class="tab">{{ t("catalog.hub.newSlotsTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/slots/providers')" class="tab">{{ t("catalog.hub.providersTitle") }}</NuxtLink>
    </div>

    <template v-if="isProvidersIndex">
      <SkeletonSlotGrid v-if="providersPending" :count="6" />
      <ul v-else class="prov">
        <li v-for="p in providersData?.items || []" :key="p.slug">
          <NuxtLink :to="localePath(`/slots/providers/${p.slug}`)">
            <span>{{ p.name }}</span>
            <b>{{ p.slotsCount }}</b>
          </NuxtLink>
        </li>
      </ul>
    </template>
    <template v-else>
      <SkeletonSlotGrid v-if="hubPending" :count="6" />
      <UiEmptyState v-else-if="!hubSlots.length" :title="t('catalog.empty')" />
      <div v-else class="grid">
        <PublicSlotCard
          v-for="s in hubSlots"
          :key="s.slug"
          :slug="s.slug"
          :title="s.title"
          :theme="s.theme"
          :rtp="s.rtp"
          :provider-name="s.providerName"
          :is-new="s.isNew"
          :demo-url="s.demoUrl"
        />
      </div>
    </template>
  </section>

  <article v-else-if="providerPending" class="page">
    <UiSkeleton height="280px" radius="16px" />
  </article>
  <article v-else-if="provider" class="page detail">
    <NuxtLink class="back" :to="localePath('/slots/providers')">{{ t("catalog.back") }}</NuxtLink>
    <p class="eyebrow">{{ t("catalog.hub.providersTitle") }}</p>
    <h1 class="page-title">{{ provider.name }}</h1>
    <p v-if="provider.description" class="lead">{{ provider.description }}</p>

    <section v-if="provider.casinos.length" class="block">
      <h2>{{ t("catalog.hub.whereToPlay") }}</h2>
      <ul class="links">
        <li v-for="c in provider.casinos" :key="c.slug">
          <NuxtLink :to="localePath(`/casino/${c.slug}`)">
            {{ c.name }}
            <span class="meta tabular-nums"> · {{ c.rating.toFixed(1) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="block">
      <h2>{{ t("catalog.hub.providerSlots") }}</h2>
      <div class="grid">
        <PublicSlotCard
          v-for="s in provider.slots"
          :key="s.slug"
          :slug="s.slug"
          :title="s.title"
          :theme="s.theme"
          :rtp="s.rtp"
          :provider-name="s.providerName"
          :is-new="s.isNew"
          :demo-url="s.demoUrl"
        />
      </div>
    </section>
  </article>

  <article v-else-if="pending" class="page">
    <UiSkeleton height="280px" radius="16px" />
  </article>
  <article v-else-if="slot" class="page detail">
    <NuxtLink class="back" :to="localePath('/slots')">{{ t("catalog.back") }}</NuxtLink>
    <div class="hero">
      <SlotCover :title="slot.title" :theme="slot.theme" :slug="slot.slug" set="slots" eager />
      <div>
        <p v-if="slot.providerName" class="eyebrow">
          <NuxtLink
            v-if="slot.providerSlug"
            :to="localePath(`/slots/providers/${slot.providerSlug}`)"
          >{{ slot.providerName }}</NuxtLink>
          <template v-else>{{ slot.providerName }}</template>
        </p>
        <h1 class="page-title">{{ slot.title }}</h1>
        <div class="meta">
          <span v-if="slot.rtp != null">{{ t("catalog.rtp", { n: slot.rtp }) }}</span>
          <span v-if="slot.volatility">{{ slot.volatility }}</span>
          <span v-if="slot.grid">{{ slot.grid }}</span>
        </div>
        <p v-if="slot.description" class="desc">{{ slot.description }}</p>
        <div class="actions">
          <UiButton v-if="slot.demoUrl" variant="primary" :href="slot.demoUrl" external>
            {{ t("catalog.demo") }}
          </UiButton>
        </div>
      </div>
    </div>

    <section v-if="slot.mechanics?.length" class="block">
      <h2>{{ t("home.slots.filters.all") }}</h2>
      <div class="chips">
        <UiBadge v-for="m in slot.mechanics" :key="m" tone="new">{{ m }}</UiBadge>
      </div>
    </section>

    <section v-if="slot.casinos?.length" class="block">
      <h2>{{ t("catalog.openCasino") }}</h2>
      <ul class="links">
        <li v-for="c in slot.casinos" :key="c.slug">
          <NuxtLink :to="localePath(`/casino/${c.slug}`)">{{ c.name }}</NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.page { max-width: 1100px; }
.detail { max-width: 960px; }
.intro { margin-bottom: 14px; }
.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.lead { margin: 0 0 12px; color: var(--text-secondary); max-width: 60ch; }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tab {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  font-size: 13px;
  font-weight: 650;
  color: var(--text-secondary);
}
.tab.router-link-active {
  border-color: var(--accent-cta);
  color: var(--text-primary);
}
.prov { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.prov a {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  text-decoration: none;
  color: inherit;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.card h2 { margin: 8px 0 4px; font-size: 15px; }
.meta { font-size: 12px; color: var(--text-tertiary); }
.back { display: inline-block; margin-bottom: 12px; color: var(--text-secondary); font-size: 14px; }
.hero {
  display: grid;
  grid-template-columns: minmax(160px, 240px) 1fr;
  gap: 20px;
  margin-bottom: 22px;
}
.desc { color: var(--text-secondary); line-height: 1.5; }
.actions { margin-top: 12px; }
.block { margin-top: 22px; }
.block h2 { margin: 0 0 10px; font-size: 18px; font-family: var(--font-display); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.links { margin: 0; padding-left: 1.1rem; }
.links a { color: inherit; }
@media (max-width: 720px) {
  .hero { grid-template-columns: 1fr; }
}
</style>
