<script setup lang="ts">
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
  () => `articles-catalog-${locale.value}`,
  () =>
    $fetch<{ items: ArticleItem[] }>(`${config.public.apiBase}/v1/articles`, {
      query: { locale: locale.value, limit: 48 },
    }),
  { watch: [locale] },
);

const items = computed(() => data.value?.items ?? []);

useHead(() => ({
  title: `${t("catalog.articlesTitle")}`,
  meta: [{ name: "description", content: t("catalog.articlesLead") }],
}));
</script>

<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.articlesTitle") }}</h1>
      <p class="lead">{{ t("catalog.articlesLead") }}</p>
      <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
    </header>

    <SkeletonArticleGrid v-if="pending" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <article v-for="a in items" :key="a.slug" class="card">
        <NuxtLink :to="localePath(`/articles/${a.slug}`)">
          <ArticleCover :title="a.title" :theme="a.coverTheme" :kind="a.kind" :slug="a.slug" :src="a.coverUrl" />
        </NuxtLink>
        <p class="meta">
          <span v-if="a.publishedAt">
            {{ new Date(a.publishedAt).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU") }}
          </span>
          · {{ t("catalog.readMin", { n: a.readingMinutes || 5 }) }}
          <span v-if="a.authorName">
            ·
            <NuxtLink
              v-if="a.authorSlug"
              :to="localePath(`/authors/${a.authorSlug}`)"
              class="author-link"
            >{{ a.authorName }}</NuxtLink>
            <template v-else>{{ a.authorName }}</template>
          </span>
        </p>
        <h2>
          <NuxtLink :to="localePath(`/articles/${a.slug}`)">{{ a.title }}</NuxtLink>
        </h2>
        <p v-if="a.excerpt" class="ex">{{ a.excerpt }}</p>
        <NuxtLink class="read" :to="localePath(`/articles/${a.slug}`)">
          {{ t("home.articles.read") }}
        </NuxtLink>
      </article>
    </div>
  </section>
</template>

<style scoped>
.intro {
  margin-bottom: 18px;
}
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 8px;
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 15px;
}
.count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.card {
  display: grid;
  gap: 8px;
  align-content: start;
}
.meta {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
.author-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
}
h2 a {
  color: inherit;
  text-decoration: none;
}
.ex {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.read {
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
</style>
