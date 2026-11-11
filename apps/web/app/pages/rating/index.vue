<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type CasinoListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
  editorialScore?: number;
  playerScore?: number | null;
  reviewCount?: number;
  hot: boolean;
  top: boolean;
  rank: number;
  isNew?: boolean;
  hasRepresentative?: boolean;
  bonusLabel?: string | null;
  bonusWager?: string | null;
  bonusPromo?: string | null;
  bonusCheckedAt?: string | null;
  license?: string | null;
};

type FilterKey = "all" | "top" | "hot" | "new";
const filter = ref<FilterKey>("all");
const viewMode = ref<"list" | "grid">("list");
const visibleCount = ref(20);

const { data, error, pending, refresh } = await useAsyncData(
  () => `rating-casinos-${locale.value}`,
  () =>
    $fetch<{ items: CasinoListItem[] }>(`${config.public.apiBase}/v1/casinos`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

const all = computed(() => data.value?.items ?? []);
const items = computed(() => {
  let list = [...all.value];
  if (filter.value === "top") list = list.filter((c) => c.top);
  else if (filter.value === "hot") list = list.filter((c) => c.hot);
  else if (filter.value === "new") list = list.filter((c) => c.isNew);
  return list;
});
const visible = computed(() =>
  items.value.slice(0, visibleCount.value).map((c, i) => ({
    ...c,
    displayRank: i + 1,
  })),
);

const licensedCount = computed(() => all.value.filter((c) => !!c.license).length);
const avgScore = computed(() => {
  if (!all.value.length) return null;
  const sum = all.value.reduce((a, c) => a + (c.rating || 0), 0);
  return (sum / all.value.length).toFixed(1);
});

watch(filter, () => {
  visibleCount.value = 20;
});

const hubTabs = computed(() => [
  { key: "all", label: t("catalog.hub.all"), to: localePath("/rating"), active: true },
  { key: "new", label: t("catalog.hub.newCasinosTitle"), to: localePath("/rating/new") },
  { key: "licensed", label: t("catalog.hub.licensedTitle"), to: localePath("/rating/licensed") },
  { key: "crypto", label: t("catalog.hub.cryptoTitle"), to: localePath("/rating/crypto") },
  { key: "payments", label: t("catalog.hub.paymentsTitle"), to: localePath("/rating/payments") },
  { key: "blacklist", label: t("catalog.hub.blacklistTitle"), to: localePath("/rating/blacklist") },
]);

const filterChips: { key: FilterKey; label: string }[] = [
  { key: "all", label: t("home.filters.all") },
  { key: "top", label: t("home.filters.top") },
  { key: "hot", label: t("home.filters.hot") },
  { key: "new", label: t("home.filters.new") },
];

const stats = computed(() => {
  const out: { label: string; value: string | number; href?: string }[] = [
    { label: t("catalog.ratingTitle"), value: all.value.length },
  ];
  if (avgScore.value) out.push({ label: t("catalog.compare.rating"), value: avgScore.value });
  if (licensedCount.value) out.push({ label: t("catalog.hub.licensedTitle"), value: licensedCount.value });
  out.push({ label: t("catalog.methodology.title"), value: "→", href: localePath("/methodology") });
  return out;
});

usePageSeo({
  title: () => t("catalog.ratingTitle"),
  description: () => t("catalog.ratingLead"),
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.ratingTitle')"
      :title="t('catalog.ratingTitle')"
      :lead="t('catalog.ratingLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <PublicSegmentedTabs :tabs="hubTabs" sticky />

    <PublicStatStrip :items="stats" />

    <div class="toolbar">
      <div class="chips">
        <UiChip
          v-for="chip in filterChips"
          :key="chip.key"
          :active="filter === chip.key"
          @click="filter = chip.key"
        >
          {{ chip.label }}
        </UiChip>
      </div>
      <div class="right">
        <p class="shown tabular-nums">
          {{ t("catalog.shownOf", { shown: visible.length, total: items.length }) }}
        </p>
        <HomeViewToggle v-model="viewMode" />
      </div>
    </div>

    <SkeletonCasinoList v-if="pending" mode="list" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else :class="viewMode === 'grid' ? 'grid' : 'list'">
      <CasinoTile v-if="viewMode === 'grid'" v-for="c in visible" :key="c.id" :casino="c" />
      <PublicCasinoRow v-else v-for="c in visible" :key="c.id" :casino="c" />
    </div>

    <div v-if="visibleCount < items.length" class="more">
      <UiButton variant="secondary" size="sm" @click="visibleCount += 20">
        {{ t("catalog.showMoreN", { n: Math.min(20, items.length - visibleCount) }) }}
      </UiButton>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.chips,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.shown {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.list {
  display: grid;
  gap: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
</style>
