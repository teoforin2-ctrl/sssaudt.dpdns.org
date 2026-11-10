<script setup lang="ts">
const { t } = useI18n();
usePageSeo({
  title: () => t("legal.age"),
  description: () => t("legal.ageBody"),
});
</script>

<template>
  <article class="legal">
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.age") }}</h1>
    <p class="lead">{{ t("legal.ageBody") }}</p>

    <section class="panel card">
      <h2>{{ t("legal.ageGeoTitle") }}</h2>
      <p>{{ t("legal.ageGeoBody") }}</p>
      <p class="note">{{ t("legal.draftNote") }}</p>
    </section>
  </article>
</template>

<style scoped>
.legal { max-width: 820px; }
.meta { margin: 0 0 8px; font-size: 12px; color: var(--text-tertiary); }
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead { margin: 0 0 18px; color: var(--text-secondary); font-size: 15px; }
.card {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.card h2 { margin: 0 0 10px; font-family: var(--font-display); font-size: 17px; }
p { color: var(--text-secondary); font-size: 14px; line-height: 1.55; }
.note { margin-top: 14px; font-size: 13px; color: var(--text-tertiary); }
</style>
