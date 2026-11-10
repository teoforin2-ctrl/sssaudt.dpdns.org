<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

const rules = computed(() => [1, 2, 3, 4, 5, 6].map((n) => t(`pages.forum.r${n}`)));

useHead(() => ({
  title: `${t("pages.forum.rulesTitle")}`,
  meta: [{ name: "description", content: t("pages.forum.rulesLead") }],
}));
</script>

<template>
  <article class="page">
    <p class="eyebrow">{{ t("pages.forum.eyebrow") }}</p>
    <h1 class="page-title">{{ t("pages.forum.rulesTitle") }}</h1>
    <p class="lead">{{ t("pages.forum.rulesLead") }}</p>

    <ol class="panel list">
      <li v-for="(rule, i) in rules" :key="i">{{ rule }}</li>
    </ol>

    <p class="more">
      <NuxtLink :to="localePath('/forum')">{{ t("pages.forum.back") }}</NuxtLink>
      · 18+
    </p>
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
  margin: 0 0 18px;
  color: var(--text-secondary);
  font-size: 15px;
}
.list {
  padding: 18px 18px 18px 36px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  display: grid;
  gap: 10px;
}
.list li {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.more {
  margin-top: 18px;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
