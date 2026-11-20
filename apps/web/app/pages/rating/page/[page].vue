<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "lucide-vue-next";
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

const filter = ref<"all" | "top" | "hot" | "new">("all");
const viewMode = ref<"list" | "grid">("list");

const pageNum = computed(() => {
  const n = Number(route.params.page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
});

const { items, totalPages, pageSlice, pending, error, refresh, pageSize } =
  useCasinoListing({ filter });

if (pageNum.value === 1) {
  await navigateTo(localePath("/rating"), { redirectCode: 301 });
}

watch(
  [pending, pageNum, totalPages, items],
  ([isPending, p, total, list]) => {
    if (isPending) return;
    if (p === 1) return;
    if (list.length === 0) return;
    if (p > total) {
      throw createError({ statusCode: 404, statusMessage: "Page not found" });
    }
  },
  { immediate: true },
);

const visible = computed(() => pageSlice(pageNum.value));

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

const { pick: seoPick } = useSeoTemplate("catalog");

usePageSeo({
  title: () =>
    `${seoPick("title", t("catalog.ratingTitle"))} — ${t("catalog.pageN", { n: pageNum.value })}`,
  description: () => seoPick("description", t("catalog.ratingLead")),
  path: () => `/rating/page/${pageNum.value}`,
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.ratingTitle"), path: "/rating" },
  { name: `Page ${pageNum.value}` },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${t("catalog.ratingTitle")} — ${pageNum.value}`,
    numberOfItems: visible.value.length,
    itemListElement: visible.value.map((c, i) => ({
      "@type": "ListItem",
      position: (pageNum.value - 1) * pageSize + i + 1,
      name: c.name,
      url: localePath(`/casino/${c.slug}`),
    })),
  };
});

const prevPage = computed(() =>
  pageNum.value <= 2 ? localePath("/rating") : localePath(`/rating/page/${pageNum.value - 1}`),
);
const nextPage = computed(() =>
  pageNum.value < totalPages.value
    ? localePath(`/rating/page/${pageNum.value + 1}`)
    : null,
);
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.ratingTitle')"
      :title="`${t('catalog.ratingTitle')} · ${pageNum}`"
      :lead="t('catalog.ratingLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <PublicSegmentedTabs :tabs="hubTabs" sticky />

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

    <nav v-if="totalPages > 1" class="pager" :aria-label="locale === 'en' ? 'Pagination' : 'Пагинация'">
      <NuxtLink class="pager-link" :to="prevPage">
        <ArrowLeft :size="14" :stroke-width="2" aria-hidden="true" /> {{ locale === "en" ? "Prev" : "Назад" }}
      </NuxtLink>
      <span class="pager-status tabular-nums">{{ pageNum }} / {{ totalPages }}</span>
      <NuxtLink
        v-if="nextPage"
        class="pager-link"
        :to="nextPage"
      >
        {{ locale === "en" ? "Next" : "Дальше" }} <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
      </NuxtLink>
      <span v-else class="pager-link is-disabled">{{ locale === "en" ? "Next" : "Дальше" }} <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" /></span>
    </nav>
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
.pager {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}
.pager-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-cta);
  text-decoration: none;
}
.pager-link.is-disabled {
  opacity: 0.35;
  pointer-events: none;
}
.pager-status {
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
