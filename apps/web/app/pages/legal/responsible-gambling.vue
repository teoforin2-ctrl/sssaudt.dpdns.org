<script setup lang="ts">
const { t } = useI18n();
usePageSeo({
  title: () => t("legal.responsible"),
  description: () => t("legal.responsibleBody"),
});
</script>

<template>
  <article class="legal">
    <p class="eyebrow">18+</p>
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.responsible") }}</h1>
    <p class="lead">{{ t("legal.responsibleBody") }}</p>

    <section class="panel card">
      <h2>{{ t("legal.responsibleSignsTitle") }}</h2>
      <ul>
        <li>{{ t("legal.responsibleSigns1") }}</li>
        <li>{{ t("legal.responsibleSigns2") }}</li>
        <li>{{ t("legal.responsibleSigns3") }}</li>
        <li>{{ t("legal.responsibleSigns4") }}</li>
      </ul>
      <h2>{{ t("legal.responsibleHelpTitle") }}</h2>
      <ul>
        <li>{{ t("legal.responsibleHelp1") }}</li>
        <li>{{ t("legal.responsibleHelp2") }}</li>
        <li>{{ t("legal.responsibleHelp3") }}</li>
        <li>{{ t("legal.responsibleHelp4") }}</li>
      </ul>
      <p class="note">{{ t("legal.ageBody") }}</p>
    </section>
  </article>
</template>

<style scoped>
.legal { max-width: 820px; }
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
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
.card h2 + ul + h2 { margin-top: 18px; }
ul { margin: 0 0 8px; padding-left: 1.2rem; }
li { color: var(--text-secondary); font-size: 14px; line-height: 1.55; margin-bottom: 6px; }
.note { margin: 16px 0 0; font-size: 13px; color: var(--text-tertiary); }
</style>
