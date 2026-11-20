<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const config = useRuntimeConfig();
const { siteName } = useSiteSettings();

usePageSeo({
  title: () => t("catalog.methodology.title"),
  description: () => t("catalog.methodology.lead"),
});

useJsonLd(() => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: t("catalog.methodology.title"),
  description: t("catalog.methodology.lead"),
  url: `${config.public.siteUrl}${localePath("/methodology")}`,
  isPartOf: { "@type": "WebSite", name: siteName.value },
}));
</script>

<template>
  <article class="page">
    <h1 class="page-title">{{ t("catalog.methodology.title") }}</h1>
    <p class="lead">{{ t("catalog.methodology.lead") }}</p>

    <section class="card">
      <h2>{{ t("catalog.methodology.weightsTitle") }}</h2>
      <ul>
        <li>{{ t("catalog.methodology.editorialWeight") }}</li>
        <li>{{ t("catalog.methodology.playersWeight") }}</li>
      </ul>
      <h2>{{ t("catalog.methodology.hotTitle") }}</h2>
      <p>{{ t("catalog.methodology.hotBody") }}</p>
      <h2>{{ t("catalog.methodology.checklistTitle") }}</h2>
      <ul>
        <li>{{ t("catalog.methodology.c1") }}</li>
        <li>{{ t("catalog.methodology.c2") }}</li>
        <li>{{ t("catalog.methodology.c3") }}</li>
        <li>{{ t("catalog.methodology.c4") }}</li>
        <li>{{ t("catalog.methodology.c5") }}</li>
      </ul>
      <p class="note">
        <NuxtLink :to="localePath('/')">{{ t("home.title") }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/legal/affiliate-disclosure')">{{ t("legal.affiliate") }}</NuxtLink>
      </p>
    </section>
  </article>
</template>

<style scoped>
.page { max-width: 820px; }
.lead { margin: 0 0 18px; color: var(--text-secondary); font-size: 15px; }
.card {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.card h2 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 17px;
}
.card h2 + ul + h2,
.card h2 + p + h2 { margin-top: 18px; }
ul { margin: 0 0 12px; padding-left: 1.2rem; }
li, p { color: var(--text-secondary); font-size: 14px; line-height: 1.55; }
.note { margin-top: 16px; font-size: 13px; color: var(--text-tertiary); }
</style>
