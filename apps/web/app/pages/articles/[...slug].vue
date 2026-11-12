<script setup lang="ts">
import { findNavLink, locTitle } from "~/data/site-nav";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const parts = computed(() => (route.params.slug as string[]) || []);
const leaf = computed(() => parts.value[parts.value.length - 1] || "");
const path = computed(() => `/articles/${parts.value.join("/")}`);

if (leaf.value === "faq") {
  await navigateTo(localePath("/faq"), { redirectCode: 301 });
}

const hubKinds: Record<string, { kind?: string; topic?: string; titleKey: string; leadKey: string }> = {
  news: { kind: "news", titleKey: "catalog.hub.newsTitle", leadKey: "catalog.hub.newsLead" },
  guides: { kind: "guide", titleKey: "catalog.hub.guidesTitle", leadKey: "catalog.hub.guidesLead" },
  academy: { topic: "Для новичков", titleKey: "catalog.hub.academyTitle", leadKey: "catalog.hub.academyLead" },
  analytics: { kind: "analytics", titleKey: "catalog.hub.analyticsTitle", leadKey: "catalog.hub.analyticsLead" },
};

const hub = computed(() => hubKinds[leaf.value] || null);
const navLink = computed(() => findNavLink(path.value));
const isHub = computed(() => !!hub.value || !!navLink.value);

type ArticleItem = {
  slug: string;
  title: string;
  excerpt?: string | null;
  kind?: string;
  topic?: string | null;
  coverTheme?: string;
  coverUrl?: string | null;
  readingMinutes?: number;
  publishedAt?: string;
  authorName?: string | null;
  authorSlug?: string | null;
};

type ArticleDetail = ArticleItem & {
  bodyMd?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    ogImage?: string | null;
  } | null;
};

const { data: listData, pending: listPending } = await useAsyncData(
  () => `articles-hub-${leaf.value}-${locale.value}`,
  async () => {
    if (!isHub.value) return null;
    return $fetch<{ items: ArticleItem[] }>(`${config.public.apiBase}/v1/articles`, {
      query: {
        locale: locale.value,
        limit: 48,
        ...(hub.value?.kind ? { kind: hub.value.kind } : {}),
      },
    });
  },
  { watch: [leaf, locale, isHub] },
);

const hubItems = computed(() => {
  let items = listData.value?.items ?? [];
  const topic = hub.value?.topic;
  if (topic) {
    items = items.filter(
      (a) =>
        (a.topic || "").toLowerCase().includes(topic.toLowerCase()) ||
        (a.kind === "guide" && leaf.value === "academy"),
    );
  }
  if (leaf.value === "guides") {
    items = items.filter((a) => a.kind === "guide" || (a.topic || "").toLowerCase().includes("обзор"));
  }
  return items;
});

const { data, pending, error: articleError } = await useAsyncData(
  () => `article-detail-${leaf.value}-${locale.value}`,
  async () => {
    if (isHub.value || !leaf.value) return null;
    try {
      return await $fetch<{ article: ArticleDetail }>(
        `${config.public.apiBase}/v1/articles/${leaf.value}`,
        { query: { locale: locale.value } },
      );
    } catch (err: unknown) {
      const status = Number((err as { statusCode?: number }).statusCode || 0);
      if (status === 410) throw createError({ statusCode: 410, statusMessage: "Gone" });
      return null;
    }
  },
  { watch: [leaf, locale, isHub] },
);

const article = computed(() => data.value?.article);

if (import.meta.server && articleError.value) {
  const status = Number((articleError.value as { statusCode?: number }).statusCode || 0);
  if (status === 410) throw createError({ statusCode: 410, statusMessage: "Gone" });
}

if (!pending.value && !isHub.value && !article.value) {
  throw createError({ statusCode: 404, statusMessage: "Article not found" });
}

const ogImage = useEntityOgImage("article", () => article.value?.slug || leaf.value, {
  seoOg: () => article.value?.seo?.ogImage,
  fallbackImage: () => article.value?.coverUrl,
});

const stubTitle = computed(() => {
  if (hub.value) return t(hub.value.titleKey);
  return navLink.value ? locTitle(navLink.value.title, locale.value) : leaf.value;
});

const stubLead = computed(() => (hub.value ? t(hub.value.leadKey) : t("catalog.articlesLead")));

const bodyHtml = computed(() =>
  renderMarkdown(article.value?.bodyMd || article.value?.excerpt || ""),
);


const { pickEntity: seoPickEntity } = useSeoTemplate("article", () => ({
  article: article.value?.title || stubTitle.value,
  title: article.value?.title || stubTitle.value,
}));

usePageSeo({
  title: () =>
    seoPickEntity(
      "title",
      () => article.value?.seo,
      article.value ? article.value.title : stubTitle.value,
    ),
  description: () =>
    seoPickEntity(
      "description",
      () => article.value?.seo,
      article.value?.excerpt || stubLead.value,
    ),
  ogType: () => (article.value ? "article" : "website"),
  ogImage,
});

useBreadcrumbJsonLd(() => {
  if (article.value) {
    return [
      { name: t("catalog.articlesTitle"), path: "/articles" },
      { name: article.value.title },
    ];
  }
  return [
    { name: t("catalog.articlesTitle"), path: "/articles" },
    { name: stubTitle.value },
  ];
});

useJsonLd(() => {
  if (!article.value) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.value.title,
    description: article.value.excerpt || undefined,
    datePublished: article.value.publishedAt || undefined,
    author: article.value.authorName
      ? { "@type": "Person", name: article.value.authorName }
      : undefined,
    image: article.value.coverUrl || undefined,
  };
});
</script>

<template>
  <section v-if="isHub" class="page">
    <header class="intro">
      <p class="eyebrow">{{ t("catalog.articlesTitle") }}</p>
      <h1 class="page-title">{{ stubTitle }}</h1>
      <p class="lead">{{ stubLead }}</p>
      <p class="count">{{ t("catalog.count", { n: hubItems.length }) }}</p>
    </header>

    <div class="tabs">
      <NuxtLink :to="localePath('/articles')" class="tab">{{ t("catalog.hub.all") }}</NuxtLink>
      <NuxtLink :to="localePath('/articles/news')" class="tab">{{ t("catalog.hub.newsTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/articles/guides')" class="tab">{{ t("catalog.hub.guidesTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/articles/academy')" class="tab">{{ t("catalog.hub.academyTitle") }}</NuxtLink>
    </div>

    <SkeletonArticleGrid v-if="listPending" :count="6" />
    <UiEmptyState v-else-if="!hubItems.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <article v-for="a in hubItems" :key="a.slug" class="card">
        <NuxtLink :to="localePath(`/articles/${a.slug}`)">
          <ArticleCover
            :title="a.title"
            :theme="a.coverTheme"
            :kind="a.kind"
            :slug="a.slug"
            :src="a.coverUrl"
          />
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

  <article v-else-if="pending" class="page">
    <UiSkeleton height="320px" radius="16px" />
  </article>
  <article v-else-if="article" class="page detail">
    <NuxtLink class="back" :to="localePath('/articles')">{{ t("catalog.back") }}</NuxtLink>
    <ArticleCover
      :title="article.title"
      :theme="article.coverTheme"
      :kind="article.kind"
      :slug="article.slug"
      :src="article.coverUrl"
    />
    <p class="meta">
      <span v-if="article.publishedAt">
        {{ new Date(article.publishedAt).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU") }}
      </span>
      · {{ t("catalog.readMin", { n: article.readingMinutes || 5 }) }}
      <span v-if="article.authorName">
        ·
        <NuxtLink
          v-if="article.authorSlug"
          :to="localePath(`/authors/${article.authorSlug}`)"
          class="author-link"
        >{{ article.authorName }}</NuxtLink>
        <template v-else>{{ article.authorName }}</template>
      </span>
    </p>
    <h1 class="page-title">{{ article.title }}</h1>
    <p v-if="article.excerpt" class="lead">{{ article.excerpt }}</p>
    <div class="prose md-body" v-html="bodyHtml" />
  </article>
</template>


<style scoped>
.page {
  max-width: 1100px;
}
.detail {
  max-width: 760px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.intro {
  margin-bottom: 16px;
}
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 62ch;
}
.count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.tab {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  color: var(--text-secondary);
}
.tab.router-link-active {
  border-color: color-mix(in srgb, var(--accent-cta) 45%, var(--border-default));
  background: var(--accent-cta-soft);
  color: var(--text-primary);
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
  margin: 14px 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.author-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.card .meta {
  margin: 0;
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
.back {
  display: inline-block;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 750;
}
.prose {
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 15px;
}
.md-body :deep(h2),
.md-body :deep(h3) {
  color: var(--text-primary);
  font-family: var(--font-display);
  margin: 1.4em 0 0.5em;
}
.md-body :deep(p),
.md-body :deep(li) {
  margin: 0.55em 0;
}
.md-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 12px 0;
  border: 1px solid var(--border-default);
}
.md-body :deep(a) {
  color: var(--accent-cta);
}
.md-body :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 3px solid var(--accent-cta);
  color: var(--text-tertiary);
  background: var(--bg-elev-1);
  border-radius: 0 10px 10px 0;
}
.md-body :deep(pre) {
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  font-size: 13px;
}
</style>

