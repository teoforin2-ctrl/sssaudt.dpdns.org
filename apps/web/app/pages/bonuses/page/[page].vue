<script setup lang="ts">
const PAGE_SIZE = 24;
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type BonusItem = {
  id: string;
  title: string;
  type?: string | null;
  amountOrPercent?: string | null;
  wager?: string | null;
  promoCode?: string | null;
  minDeposit?: string | null;
  validUntil?: string | null;
  checkedAt?: string | null;
  casinoSlug: string;
  casinoName: string;
  casinoLogoUrl?: string | null;
};

const { data, pending, error, refresh } = await useAsyncData(
  () => `bonuses-catalog-page-${locale.value}`,
  () =>
    $fetch<{ items: BonusItem[] }>(`${config.public.apiBase}/v1/bonuses`, {
      query: { locale: locale.value, limit: 200 },
    }),
  { watch: [locale] },
);

function isExpired(b: BonusItem) {
  if (!b.validUntil) return false;
  const d = new Date(b.validUntil);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

const items = computed(() => (data.value?.items ?? []).filter((b) => !isExpired(b)));

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
  basePath: "/bonuses",
});

await guardPage();

watch(
  [pending, pageNum, totalPages, items],
  ([isPending, , , list]) => assertInRange(!!isPending, list.length),
  { immediate: true },
);

const visible = computed(() => slice(items.value));
const { pick: seoPick } = useSeoTemplate("bonuses");

usePageSeo({
  title: () =>
    `${seoPick("title", t("catalog.bonusesTitle"))} — ${t("catalog.pageN", { n: pageNum.value })}`,
  description: () => seoPick("description", t("catalog.bonusesLead")),
  path: () => `/bonuses/page/${pageNum.value}`,
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.bonusesTitle"), path: "/bonuses" },
  { name: `Page ${pageNum.value}` },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${t("catalog.bonusesTitle")} — ${pageNum.value}`,
    numberOfItems: visible.value.length,
    itemListElement: visible.value.map((b, i) => ({
      "@type": "ListItem",
      position: (pageNum.value - 1) * PAGE_SIZE + i + 1,
      name: `${b.title} — ${b.casinoName}`,
      url: localePath(`/casino/${b.casinoSlug}`),
    })),
  };
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.bonusesTitle')"
      :title="`${t('catalog.bonusesTitle')} · ${pageNum}`"
      :lead="t('catalog.bonusesLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <SkeletonCasinoList v-if="pending" mode="list" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="list">
      <PublicBonusCard
        v-for="b in visible"
        :key="b.id"
        :title="b.title"
        :type="b.type"
        :wager="b.wager"
        :promo-code="b.promoCode"
        :min-deposit="b.minDeposit"
        :valid-until="b.validUntil"
        :checked-at="b.checkedAt"
        :casino-name="b.casinoName"
        :casino-slug="b.casinoSlug"
        :casino-logo-url="b.casinoLogoUrl"
      />
    </div>

    <nav v-if="totalPages > 1" class="pager" :aria-label="locale === 'en' ? 'Pagination' : 'Пагинация'">
      <NuxtLink class="pager-link" :to="prevPage">← {{ locale === "en" ? "Prev" : "Назад" }}</NuxtLink>
      <span class="pager-status tabular-nums">{{ pageNum }} / {{ totalPages }}</span>
      <NuxtLink v-if="nextPage" class="pager-link" :to="nextPage">
        {{ locale === "en" ? "Next" : "Дальше" }} →
      </NuxtLink>
      <span v-else class="pager-link is-disabled">{{ locale === "en" ? "Next" : "Дальше" }} →</span>
    </nav>
  </section>
</template>

<style scoped>
.page { padding-bottom: 8px; }
.list { display: grid; gap: 10px; }
.pager {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}
.pager-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-cta);
  text-decoration: none;
}
.pager-link.is-disabled { opacity: 0.35; pointer-events: none; }
.pager-status { font-size: 13px; color: var(--text-tertiary); }
</style>
