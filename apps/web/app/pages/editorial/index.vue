<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const config = useRuntimeConfig();
const { siteName } = useSiteSettings();

usePageSeo({
  title: () => t("catalog.editorial.title"),
  description: () => t("catalog.editorial.lead"),
});

useJsonLd(() => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: t("catalog.editorial.title"),
  description: t("catalog.editorial.lead"),
  url: `${config.public.siteUrl}${localePath("/editorial")}`,
  isPartOf: { "@type": "WebSite", name: siteName.value },
}));
</script>

<template>
  <article class="page">
    <h1 class="page-title">{{ t("catalog.editorial.title") }}</h1>
    <p class="lead">{{ t("catalog.editorial.lead") }}</p>

    <section class="card">
      <h2>{{ t("catalog.editorial.policyTitle") }}</h2>
      <p>{{ t("catalog.editorial.policyBody") }}</p>
      <ul>
        <li>{{ t("catalog.editorial.p1") }}</li>
        <li>{{ t("catalog.editorial.p2") }}</li>
        <li>{{ t("catalog.editorial.p3") }}</li>
        <li>{{ t("catalog.editorial.p4") }}</li>
      </ul>
    </section>

    <section class="card">
      <h2>{{ t("catalog.editorial.tzTitle") }}</h2>
      <p>{{ t("catalog.editorial.tzBody") }}</p>
      <ul>
        <li>{{ t("catalog.editorial.t1") }}</li>
        <li>{{ t("catalog.editorial.t2") }}</li>
        <li>{{ t("catalog.editorial.t3") }}</li>
      </ul>
    </section>

    <section class="card">
      <h2>{{ t("catalog.editorial.semanticTitle") }}</h2>
      <p>{{ t("catalog.editorial.semanticBody") }}</p>
      <p class="links">
        <NuxtLink :to="localePath('/sitemap')">{{ t("nav.sitemap") }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/methodology')">{{ t("catalog.methodology.title") }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/rating')">{{ t("catalog.ratingTitle") }}</NuxtLink>
      </p>
    </section>
  </article>
</template>

<style scoped>
.page { max-width: 820px; display: grid; gap: 14px; }
.lead { margin: 0; color: var(--text-secondary); }
.card {
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.card h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 18px;
}
.card p, .card li {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.card ul { margin: 8px 0 0; padding-left: 1.2rem; }
.links { margin-top: 10px !important; font-size: 13px !important; }
</style>
