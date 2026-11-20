<script setup lang="ts">
import { ARTICLE_KINDS } from "@x-reviewer/shared";

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

const kindFilter = ref("all");

const kindTabMeta: Record<string, string> = {
  "slot-cards": "catalog.hub.slotCardsTitle",
  providers: "catalog.hub.providersTitle",
  glossary: "catalog.hub.glossaryTitle",
  "mechanics-guides": "catalog.hub.mechanicsGuidesTitle",
  news: "catalog.hub.newsTitle",
  collections: "catalog.hub.collectionsTitle",
  guide: "catalog.hub.guidesTitle",
  analytics: "catalog.hub.analyticsTitle",
};

const { data, pending, error, refresh } = await useAsyncData(
  () => `articles-catalog-${locale.value}`,
  () =>
    $fetch<{ items: ArticleItem[] }>(`${config.public.apiBase}/v1/articles`, {
      query: { locale: locale.value, limit: 48 },
    }),
  { watch: [locale] },
);

const all = computed(() => data.value?.items ?? []);

function normalizeKind(kind?: string | null) {
  return (kind || "").toLowerCase().trim();
}

const items = computed(() => {
  if (kindFilter.value === "all") return all.value;
  return all.value.filter((a) => normalizeKind(a.kind) === kindFilter.value);
});

const PAGE_SIZE = 24;
const featured = computed(() => items.value[0] || null);
const rest = computed(() => items.value.slice(1, PAGE_SIZE));
const hasMorePages = computed(() => items.value.length > PAGE_SIZE);

const tabs = computed(() => {
  const primary = ARTICLE_KINDS.map((k) => ({
    key: k.id,
    label: t(kindTabMeta[k.id]!),
    count: all.value.filter((a) => normalizeKind(a.kind) === k.id).length,
    active: kindFilter.value === k.id,
  }));
  const legacy = (["guide", "analytics"] as const)
    .map((id) => ({
      key: id,
      label: t(kindTabMeta[id]!),
      count: all.value.filter((a) => normalizeKind(a.kind) === id).length,
      active: kindFilter.value === id,
    }))
    .filter((tab) => tab.count > 0);
  return [
    { key: "all", label: t("catalog.hub.all"), count: all.value.length, active: kindFilter.value === "all" },
    ...primary,
    ...legacy,
  ];
});

usePageSeo({
  title: () => t("catalog.articlesTitle"),
  description: () => t("catalog.articlesLead"),
  path: "/articles",
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.articlesTitle"), path: "/articles" },
]);

useJsonLd(() => {
  if (!items.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("catalog.articlesTitle"),
    numberOfItems: items.value.length,
    itemListElement: items.value.slice(0, 24).map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
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
      <div v-if="hasMorePages" class="more">
        <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/articles/page/2')">
          {{ t("catalog.showMoreN", { n: Math.min(PAGE_SIZE, items.length - PAGE_SIZE) }) }}
        </NuxtLink>
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
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
</style>
