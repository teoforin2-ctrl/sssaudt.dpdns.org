<script setup lang="ts">
const PAGE_SIZE = 24;
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type ArticleItem = {
  slug: string;
  title: string;
  excerpt?: string | null;
  kind?: string;
  coverTheme?: string;
  coverUrl?: string | null;
  readingMinutes?: number;
  publishedAt?: string;
  authorName?: string | null;
  authorSlug?: string | null;
};

const { data, pending, error, refresh } = await useAsyncData(
  () => `articles-catalog-page-${locale.value}`,
  () =>
    $fetch<{ items: ArticleItem[] }>(`${config.public.apiBase}/v1/articles`, {
      query: { locale: locale.value, limit: 96 },
    }),
  { watch: [locale] },
);

const items = computed(() => data.value?.items ?? []);

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
  basePath: "/articles",
});

await guardPage();

watch(
  [pending, pageNum, totalPages, items],
  ([isPending, , , list]) => assertInRange(!!isPending, list.length),
  { immediate: true },
);

const visible = computed(() => slice(items.value));

usePageSeo({
  title: () => `${t("catalog.articlesTitle")} — ${t("catalog.pageN", { n: pageNum.value })}`,
  description: () => t("catalog.articlesLead"),
  path: () => `/articles/page/${pageNum.value}`,
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.articlesTitle"), path: "/articles" },
  { name: `Page ${pageNum.value}` },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${t("catalog.articlesTitle")} — ${pageNum.value}`,
    numberOfItems: visible.value.length,
    itemListElement: visible.value.map((a, i) => ({
      "@type": "ListItem",
      position: (pageNum.value - 1) * PAGE_SIZE + i + 1,
      name: a.title,
      url: localePath(`/articles/${a.slug}`),
    })),
  };
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.articlesTitle')"
      :title="`${t('catalog.articlesTitle')} · ${pageNum}`"
      :lead="t('catalog.articlesLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <SkeletonArticleGrid v-if="pending" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <PublicArticleCard
        v-for="a in visible"
        :key="a.slug"
        :slug="a.slug"
        :title="a.title"
        :excerpt="a.excerpt"
        :kind="a.kind"
        :cover-theme="a.coverTheme"
        :cover-url="a.coverUrl"
        :reading-minutes="a.readingMinutes"
        :published-at="a.publishedAt"
        :author-name="a.authorName"
        :author-slug="a.authorSlug"
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
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
