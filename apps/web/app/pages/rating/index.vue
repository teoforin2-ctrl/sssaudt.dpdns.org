<script setup lang="ts">
const { locale, t } = useI18n();
const localePath = useLocalePath();

const filter = ref<"all" | "top" | "hot" | "new">("all");
const viewMode = ref<"list" | "grid">("list");

const { all, items, pageSlice, totalPages, pending, error, refresh, pageSize } =
  useCasinoListing({ filter });

const visible = computed(() => pageSlice(1));

const licensedCount = computed(() => all.value.filter((c) => !!c.license).length);
const avgScore = computed(() => {
  if (!all.value.length) return null;
  const sum = all.value.reduce((a, c) => a + (c.rating || 0), 0);
  return (sum / all.value.length).toFixed(1);
});

const hubTabs = computed(() => [
  { key: "all", label: t("catalog.hub.all"), to: localePath("/rating"), active: true },
  { key: "new", label: t("catalog.hub.newCasinosTitle"), to: localePath("/rating/new") },
  { key: "licensed", label: t("catalog.hub.licensedTitle"), to: localePath("/rating/licensed") },
  { key: "crypto", label: t("catalog.hub.cryptoTitle"), to: localePath("/rating/crypto") },
  { key: "payments", label: t("catalog.hub.paymentsTitle"), to: localePath("/rating/payments") },
  { key: "blacklist", label: t("catalog.hub.blacklistTitle"), to: localePath("/rating/blacklist") },
]);

const filterChips: { key: typeof filter.value; label: string }[] = [
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
  out.push({ label: t("catalog.methodology.title"), value: "", href: localePath("/methodology") });
  return out;
});

const { pick: seoPick } = useSeoTemplate("catalog");

usePageSeo({
  title: () => seoPick("title", t("catalog.ratingTitle")),
  description: () => seoPick("description", t("catalog.ratingLead")),
  path: "/rating",
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.ratingTitle"), path: "/rating" },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("catalog.ratingTitle"),
    numberOfItems: items.value.length,
    itemListElement: visible.value.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: localePath(`/casino/${c.slug}`),
    })),
  };
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

    <div v-if="totalPages > 1" class="more">
      <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/rating/page/2')">
        {{ t("catalog.showMoreN", { n: Math.min(pageSize, items.length - pageSize) }) }}
      </NuxtLink>
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
