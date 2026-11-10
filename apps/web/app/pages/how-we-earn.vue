<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

useHead(() => ({
  title: `${t("pages.earn.title")}`,
  meta: [{ name: "description", content: t("pages.earn.lead") }],
}));
</script>

<template>
  <article class="page">
    <p class="eyebrow">{{ t("pages.earn.eyebrow") }}</p>
    <h1 class="page-title">{{ t("pages.earn.title") }}</h1>
    <p class="lead">{{ t("pages.earn.lead") }}</p>

    <div class="prose panel">
      <p>{{ t("pages.earn.p1") }}</p>
      <p>{{ t("pages.earn.p2") }}</p>
      <p>{{ t("pages.earn.p3") }}</p>
      <p class="muted">
        <NuxtLink :to="localePath('/legal/affiliate-disclosure')">{{ t("legal.affiliate") }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/about')">{{ t("pages.about.title") }}</NuxtLink>
      </p>
    </div>
  </article>
</template>

<style scoped>
.page {
  max-width: 820px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 22px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 60ch;
}
.prose {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.prose p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 15px;
}
.muted {
  margin-top: 20px !important;
  font-size: 13px !important;
  color: var(--text-tertiary) !important;
}
</style>
