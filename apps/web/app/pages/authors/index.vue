<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type Author = {
  slug: string;
  name: string;
  role?: string | null;
  bio?: string | null;
  hue: number;
  articlesCount: number;
};

const { data, pending } = await useAsyncData(
  () => `authors-${locale.value}`,
  () =>
    $fetch<{ items: Author[] }>(`${config.public.apiBase}/v1/authors`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

usePageSeo({
  title: () => t("catalog.authorsTitle"),
  description: () => t("catalog.authorsLead"),
});
</script>

<template>
  <section class="page">
    <h1 class="page-title">{{ t("catalog.authorsTitle") }}</h1>
    <p class="lead">{{ t("catalog.authorsLead") }}</p>
    <UiSkeleton v-if="pending" height="160px" radius="12px" />
    <ul v-else class="list">
      <li v-for="a in data?.items || []" :key="a.slug">
        <NuxtLink :to="localePath(`/authors/${a.slug}`)" class="card">
          <span class="avatar" :style="{ background: `oklch(0.55 0.12 ${a.hue})` }">
            {{ a.name.slice(0, 1) }}
          </span>
          <div>
            <strong>{{ a.name }}</strong>
            <p v-if="a.role">{{ a.role }}</p>
            <p class="meta">{{ t("catalog.articlesCount", { n: a.articlesCount }) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.page { max-width: 820px; }
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
}
.lead { margin: 0 0 18px; color: var(--text-secondary); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.card {
  display: flex; gap: 14px; align-items: center;
  padding: 14px 16px; border-radius: 14px;
  border: 1px solid var(--border-default); background: var(--bg-elev-1);
  text-decoration: none; color: inherit;
}
.avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: grid; place-items: center; font-weight: 800; color: #fff;
}
.card p { margin: 2px 0 0; font-size: 13px; color: var(--text-secondary); }
.meta { color: var(--text-tertiary) !important; }
</style>
