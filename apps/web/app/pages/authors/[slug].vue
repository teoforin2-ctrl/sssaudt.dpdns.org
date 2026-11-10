<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug));

const { data, pending, error } = await useAsyncData(
  () => `author-${slug.value}-${locale.value}`,
  () =>
    $fetch<{
      author: {
        slug: string;
        name: string;
        role?: string | null;
        bio?: string | null;
        quote?: string | null;
        hue: number;
      };
      articles: {
        slug: string;
        title: string;
        excerpt?: string | null;
        readingMinutes?: number;
        publishedAt?: string | null;
      }[];
    }>(`${config.public.apiBase}/v1/authors/${slug.value}`, {
      query: { locale: locale.value },
    }),
  { watch: [slug, locale] },
);

if (!pending.value && (error.value || !data.value?.author)) {
  throw createError({ statusCode: 404, statusMessage: "Author not found" });
}

const author = computed(() => data.value?.author);

usePageSeo({
  title: () => author.value?.name || t("catalog.authorsTitle"),
  description: () => author.value?.bio || t("catalog.authorsLead"),
});
</script>

<template>
  <article v-if="author" class="page">
    <NuxtLink class="back" :to="localePath('/authors')">← {{ t("catalog.authorsTitle") }}</NuxtLink>
    <header class="head">
      <span class="avatar" :style="{ background: `oklch(0.55 0.12 ${author.hue})` }">
        {{ author.name.slice(0, 1) }}
      </span>
      <div>
        <h1 class="page-title">{{ author.name }}</h1>
        <p v-if="author.role" class="role">{{ author.role }}</p>
      </div>
    </header>
    <p v-if="author.bio" class="bio">{{ author.bio }}</p>
    <blockquote v-if="author.quote" class="quote">{{ author.quote }}</blockquote>

    <h2>{{ t("catalog.authorsArticles") }}</h2>
    <ul v-if="data?.articles?.length" class="arts">
      <li v-for="a in data.articles" :key="a.slug">
        <NuxtLink :to="localePath(`/articles/${a.slug}`)">{{ a.title }}</NuxtLink>
        <span v-if="a.readingMinutes" class="meta">
          · {{ t("catalog.readMin", { n: a.readingMinutes }) }}
        </span>
      </li>
    </ul>
    <p v-else class="meta">{{ t("catalog.empty") }}</p>
  </article>
</template>

<style scoped>
.page { max-width: 760px; }
.back { display: inline-block; margin-bottom: 14px; font-size: 13px; font-weight: 700; }
.head { display: flex; gap: 14px; align-items: center; margin-bottom: 12px; }
.avatar {
  width: 56px; height: 56px; border-radius: 14px;
  display: grid; place-items: center; font-weight: 800; color: #fff; font-size: 22px;
}
.page-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
}
.role, .bio, .meta { color: var(--text-secondary); font-size: 14px; }
.quote {
  margin: 16px 0;
  padding: 12px 14px;
  border-left: 3px solid var(--accent-cta);
  background: var(--bg-elev-1);
  border-radius: 0 12px 12px 0;
  color: var(--text-secondary);
}
h2 { font-family: var(--font-display); font-size: 18px; margin: 22px 0 10px; }
.arts { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.arts a { font-weight: 700; color: inherit; text-decoration: none; }
.arts a:hover { color: var(--accent-cta); }
</style>
