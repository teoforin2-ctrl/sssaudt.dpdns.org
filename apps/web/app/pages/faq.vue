<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

const items = computed(() =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`pages.faq.q${n}`),
    a: t(`pages.faq.a${n}`),
  })),
);

useHead(() => ({
  title: `${t("pages.faq.title")}`,
  meta: [{ name: "description", content: t("pages.faq.lead") }],
}));
</script>

<template>
  <article class="page">
    <p class="eyebrow">{{ t("pages.faq.eyebrow") }}</p>
    <h1 class="page-title">{{ t("pages.faq.title") }}</h1>
    <p class="lead">{{ t("pages.faq.lead") }}</p>

    <div class="list">
      <details v-for="(item, i) in items" :key="i" class="panel item">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </div>

    <p class="more">
      <NuxtLink :to="localePath('/contacts')">{{ t("pages.faq.contact") }}</NuxtLink>
      ·
      <NuxtLink :to="localePath('/legal/responsible-gambling')">{{ t("nav.responsible") }}</NuxtLink>
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
  margin: 0 0 22px;
  color: var(--text-secondary);
  font-size: 15px;
}
.list {
  display: grid;
  gap: 10px;
}
.item {
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
summary {
  cursor: pointer;
  padding: 14px 16px;
  font-weight: 750;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.item p {
  margin: 0;
  padding: 0 16px 16px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.more {
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
