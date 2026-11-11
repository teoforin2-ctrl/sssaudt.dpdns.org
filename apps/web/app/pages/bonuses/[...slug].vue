<script setup lang="ts">
import { findNavLink, locTitle } from "~/data/site-nav";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const parts = computed(() => (route.params.slug as string[]) || []);
const leaf = computed(() => parts.value[parts.value.length - 1] || "");
const path = computed(() => `/bonuses/${parts.value.join("/")}`);
const navLink = computed(() => findNavLink(path.value));

const filters: Record<string, { test: (b: BonusItem) => boolean; titleKey: string; leadKey: string }> = {
  welcome: {
    titleKey: "catalog.hub.welcomeTitle",
    leadKey: "catalog.hub.welcomeLead",
    test: (b) => /привет|welcome|first|депозит/i.test(`${b.type || ""} ${b.title}`),
  },
  "no-deposit": {
    titleKey: "catalog.hub.noDepositTitle",
    leadKey: "catalog.hub.noDepositLead",
    test: (b) => /бездеп|no[\s-]?deposit|без депозит/i.test(`${b.type || ""} ${b.title}`),
  },
  "free-spins": {
    titleKey: "catalog.hub.freeSpinsTitle",
    leadKey: "catalog.hub.freeSpinsLead",
    test: (b) => /фриспин|free[\s-]?spin|\bfs\b|спин/i.test(`${b.type || ""} ${b.title}`),
  },
  codes: {
    titleKey: "catalog.hub.codesTitle",
    leadKey: "catalog.hub.codesLead",
    test: (b) => !!b.promoCode,
  },
};

type BonusItem = {
  id: string;
  title: string;
  type?: string | null;
  amountOrPercent?: string | null;
  wager?: string | null;
  promoCode?: string | null;
  minDeposit?: string | null;
  checkedAt?: string | null;
  casinoSlug: string;
  casinoName: string;
  casinoLogoUrl?: string | null;
};

const filter = computed(() => filters[leaf.value] || null);
const title = computed(() =>
  filter.value
    ? t(filter.value.titleKey)
    : navLink.value
      ? locTitle(navLink.value.title, locale.value)
      : leaf.value,
);

const { data, pending, error, refresh } = await useAsyncData(
  () => `bonuses-hub-${leaf.value}-${locale.value}`,
  () =>
    $fetch<{ items: BonusItem[] }>(`${config.public.apiBase}/v1/bonuses`, {
      query: { locale: locale.value, limit: 120 },
    }),
  { watch: [leaf, locale] },
);

const items = computed(() => {
  const all = data.value?.items ?? [];
  if (!filter.value) return all;
  return all.filter(filter.value.test);
});

const hubTabs = computed(() =>
  [
    { key: "all", label: t("catalog.hub.all"), to: localePath("/bonuses") },
    { key: "welcome", label: t("catalog.hub.welcomeTitle"), to: localePath("/bonuses/welcome") },
    { key: "no-deposit", label: t("catalog.hub.noDepositTitle"), to: localePath("/bonuses/no-deposit") },
    { key: "free-spins", label: t("catalog.hub.freeSpinsTitle"), to: localePath("/bonuses/free-spins") },
    { key: "codes", label: t("catalog.hub.codesTitle"), to: localePath("/bonuses/codes") },
  ].map((tab) => ({ ...tab, active: tab.key === (leaf.value || "all") })),
);

usePageSeo({
  title: () => title.value,
  description: () => (filter.value ? t(filter.value.leadKey) : t("catalog.bonusesLead")),
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.bonusesTitle')"
      :title="title"
      :lead="filter ? t(filter.leadKey) : t('catalog.bonusesLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <PublicSegmentedTabs :tabs="hubTabs" sticky />

    <SkeletonBonusCards v-if="pending" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <PublicBonusCard
        v-for="b in items"
        :key="b.id"
        :title="b.title"
        :type="b.type"
        :wager="b.wager"
        :min-deposit="b.minDeposit"
        :promo-code="b.promoCode"
        :checked-at="b.checkedAt"
        :casino-slug="b.casinoSlug"
        :casino-name="b.casinoName"
        :casino-logo-url="b.casinoLogoUrl"
      />
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 1200px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
