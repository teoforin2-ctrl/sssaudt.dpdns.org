<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "lucide-vue-next";
const PAGE_SIZE = 24;
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

type SlotItem = {
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  mechanics?: string[];
  providerName?: string | null;
  isNew?: boolean;
  demoUrl?: string | null;
  coverUrl?: string | null;
};

const filter = ref(String(route.query.filter || "all"));
const q = ref(String(route.query.q || ""));
const sort = ref(String(route.query.sort || "popular"));

const { data, pending, error, refresh } = await useAsyncData(
  () => `slots-catalog-page-${locale.value}`,
  () =>
    $fetch<{ items: SlotItem[] }>(`${config.public.apiBase}/v1/slots`, {
      query: { locale: locale.value, limit: 200 },
    }),
  { watch: [locale] },
);

const items = computed(() => {
  let list = [...(data.value?.items ?? [])];
  if (filter.value === "new") list = list.filter((s) => s.isNew);
  else if (filter.value === "highRtp") list = list.filter((s) => (s.rtp || 0) >= 96.5);
  else if (filter.value === "bonusBuy") list = list.filter((s) => s.mechanics?.includes("bonus-buy"));
  else if (filter.value === "megaways") list = list.filter((s) => s.mechanics?.includes("megaways"));
  const query = q.value.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(query)
        || (s.providerName || "").toLowerCase().includes(query),
    );
  }
  if (sort.value === "rtp") list.sort((a, b) => (b.rtp || 0) - (a.rtp || 0));
  else if (sort.value === "az") list.sort((a, b) => a.title.localeCompare(b.title, locale.value));
  else if (sort.value === "new") list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return list;
});

const {
  pageNum,
  totalPages,
  slice,
  prevPage,
  nextPage,
  guardPage,
  assertInRange,
} = useCatalogPage({
  total: () => items.value.length,
  pageSize: PAGE_SIZE,
  basePath: "/slots",
});

await guardPage();

watch(
  [pending, pageNum, totalPages, items],
  ([isPending, , , list]) => assertInRange(!!isPending, list.length),
  { immediate: true },
);

const visible = computed(() => slice(items.value));

usePageSeo({
  title: () => `${t("catalog.slotsTitle")} — ${t("catalog.pageN", { n: pageNum.value })}`,
  description: () => t("catalog.slotsLead"),
  path: () => `/slots/page/${pageNum.value}`,
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.slotsTitle"), path: "/slots" },
  { name: `Page ${pageNum.value}` },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${t("catalog.slotsTitle")} — ${pageNum.value}`,
    numberOfItems: visible.value.length,
    itemListElement: visible.value.map((s, i) => ({
      "@type": "ListItem",
      position: (pageNum.value - 1) * PAGE_SIZE + i + 1,
      name: s.title,
      url: localePath(`/slots/${s.slug}`),
    })),
  };
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.slotsTitle')"
      :title="`${t('catalog.slotsTitle')} · ${pageNum}`"
      :lead="t('catalog.slotsLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <SkeletonSlotGrid v-if="pending" :count="8" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.nothingFound')" />
    <div v-else class="grid">
      <PublicSlotCard
        v-for="s in visible"
        :key="s.slug"
        :slug="s.slug"
        :title="s.title"
        :theme="s.theme"
        :rtp="s.rtp"
        :provider-name="s.providerName"
        :is-new="s.isNew"
        :mechanics="s.mechanics"
        :demo-url="s.demoUrl"
        :cover-src="s.coverUrl"
      />
    </div>

    <nav v-if="totalPages > 1" class="pager" :aria-label="locale === 'en' ? 'Pagination' : 'Пагинация'">
      <NuxtLink class="pager-link" :to="prevPage"><ArrowLeft :size="14" :stroke-width="2" aria-hidden="true" /> {{ locale === "en" ? "Prev" : "Назад" }}</NuxtLink>
      <span class="pager-status tabular-nums">{{ pageNum }} / {{ totalPages }}</span>
      <NuxtLink v-if="nextPage" class="pager-link" :to="nextPage">
        {{ locale === "en" ? "Next" : "Дальше" }} <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
      </NuxtLink>
      <span v-else class="pager-link is-disabled">{{ locale === "en" ? "Next" : "Дальше" }} <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" /></span>
    </nav>
  </section>
</template>

<style scoped>
.page { padding-bottom: 8px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
.pager-link.is-disabled { opacity: 0.35; pointer-events: none; }
.pager-status { font-size: 13px; color: var(--text-tertiary); }
</style>
