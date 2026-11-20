<script setup lang="ts">
const { t } = useI18n();
usePageSeo({
  title: () => t("legal.affiliate"),
  description: () => t("legal.affiliateBody"),
});
</script>

<template>
  <article class="legal">
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.affiliate") }}</h1>
    <p class="lead">{{ t("legal.affiliateBody") }}</p>
    <section class="panel card">
      <p class="note">{{ t("legal.draftNote") }}</p>
    </section>
  </article>
</template>

<style scoped>
.legal { max-width: 820px; }
.meta { margin: 0 0 8px; font-size: 12px; color: var(--text-tertiary); }
.lead { margin: 0 0 18px; color: var(--text-secondary); font-size: 15px; }
.card {
  padding: 18px 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.note { margin: 0; font-size: 13px; color: var(--text-tertiary); }
</style>
