<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();

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

const kindFilter = ref("all");

const { data, pending, error, refresh } = await useAsyncData(
  () => `articles-catalog-${locale.value}`,
  () =>
    $fetch<{ items: ArticleItem[] }>(`${config.public.apiBase}/v1/articles`, {
      query: { locale: locale.value, limit: 48 },
    }),
  { watch: [locale] },
);

const all = computed(() => data.value?.items ?? []);

function kindBucket(kind?: string | null) {
  const k = (kind || "").toLowerCase();
  if (k.includes("news") || k.includes("новост")) return "news";
  if (k.includes("guide") || k.includes("гайд") || k.includes("обзор")) return "guides";
  if (k.includes("analyt") || k.includes("аналит")) return "analytics";
  return "other";
}

const items = computed(() => {
  if (kindFilter.value === "all") return all.value;
  return all.value.filter((a) => kindBucket(a.kind) === kindFilter.value);
});

const featured = computed(() => items.value[0] || null);
const rest = computed(() => items.value.slice(1));

const tabs = computed(() => {
  const counts = {
    all: all.value.length,
    news: all.value.filter((a) => kindBucket(a.kind) === "news").length,
    guides: all.value.filter((a) => kindBucket(a.kind) === "guides").length,
    analytics: all.value.filter((a) => kindBucket(a.kind) === "analytics").length,
  };
  return [
    { key: "all", label: t("catalog.hub.all"), count: counts.all, active: kindFilter.value === "all" },
    { key: "news", label: t("catalog.hub.newsTitle"), count: counts.news, active: kindFilter.value === "news" },
    { key: "guides", label: t("catalog.hub.guidesTitle"), count: counts.guides, active: kindFilter.value === "guides" },
    { key: "analytics", label: t("catalog.hub.analyticsTitle"), count: counts.analytics, active: kindFilter.value === "analytics" },
  ].filter((tab) => tab.key === "all" || (tab.count as number) > 0);
});

usePageSeo({
  title: () => t("catalog.articlesTitle"),
  description: () => t("catalog.articlesLead"),
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.articlesTitle')"
      :title="t('catalog.articlesTitle')"
      :lead="t('catalog.articlesLead')"
      :count="t('catalog.count', { n: items.length })"
    />

    <PublicSegmentedTabs :tabs="tabs" @select="kindFilter = $event" />

    <SkeletonArticleGrid v-if="pending" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <template v-else>
      <PublicArticleCard
        v-if="featured"
        class="featured-wrap"
        featured
        :slug="featured.slug"
        :title="featured.title"
        :excerpt="featured.excerpt"
        :kind="featured.kind"
        :cover-theme="featured.coverTheme"
        :cover-url="featured.coverUrl"
        :reading-minutes="featured.readingMinutes"
        :published-at="featured.publishedAt"
        :author-name="featured.authorName"
        :author-slug="featured.authorSlug"
      />
      <div class="grid">
        <PublicArticleCard
          v-for="a in rest"
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
    </template>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.featured-wrap {
  margin-bottom: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1024px) {
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
