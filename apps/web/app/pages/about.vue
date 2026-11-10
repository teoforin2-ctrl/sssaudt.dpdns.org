<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const { data } = await useAsyncData(
  () => `stats-about-${locale.value}`,
  () => $fetch<Record<string, number>>(`${config.public.apiBase}/v1/stats`),
  { watch: [locale] },
);

const stats = computed(() => data.value || {});

useHead(() => ({
  title: `${t("pages.about.title")}`,
  meta: [{ name: "description", content: t("pages.about.lead") }],
}));
</script>

<template>
  <article class="page">
    <p class="eyebrow">{{ t("pages.about.eyebrow") }}</p>
    <h1 class="page-title">{{ t("pages.about.title") }}</h1>
    <p class="lead">{{ t("pages.about.lead") }}</p>

    <div class="facts panel">
      <div v-if="stats.casinos" class="fact">
        <b>{{ stats.casinos }}</b>
        <span>{{ t("home.facts.casinos") }}</span>
      </div>
      <div v-if="stats.reviews" class="fact">
        <b>{{ stats.reviews }}</b>
        <span>{{ t("home.facts.reviews") }}</span>
      </div>
      <div v-if="stats.bonuses" class="fact">
        <b>{{ stats.bonuses }}</b>
        <span>{{ t("home.facts.bonuses") }}</span>
      </div>
      <div v-if="stats.slots" class="fact">
        <b>{{ stats.slots }}</b>
        <span>{{ t("home.facts.slots") }}</span>
      </div>
    </div>

    <div class="prose panel">
      <p>{{ t("pages.about.p1") }}</p>
      <p>{{ t("pages.about.p2") }}</p>
      <h2>{{ t("pages.about.whatTitle") }}</h2>
      <ul>
        <li>{{ t("pages.about.li1") }}</li>
        <li>{{ t("pages.about.li2") }}</li>
        <li>{{ t("pages.about.li3") }}</li>
        <li>{{ t("pages.about.li4") }}</li>
      </ul>
      <p class="muted">
        {{ t("pages.about.earn") }}
        <NuxtLink :to="localePath('/how-we-earn')">{{ t("pages.about.earnLink") }}</NuxtLink>
        · 18+ ·
        <NuxtLink :to="localePath('/legal/responsible-gambling')">{{ t("nav.responsible") }}</NuxtLink>
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
.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-bottom: 20px;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.fact {
  padding: 16px;
  border-right: 1px solid var(--border-subtle);
}
.fact:last-child {
  border-right: 0;
}
.fact b {
  display: block;
  font-family: var(--font-display);
  font-size: 22px;
  margin-bottom: 4px;
}
.fact span {
  font-size: 12px;
  color: var(--text-tertiary);
}
.prose {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.prose p,
.prose li {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 15px;
}
.prose h2 {
  margin: 22px 0 10px;
  font-family: var(--font-display);
  font-size: 18px;
}
.prose ul {
  margin: 0;
  padding-left: 1.2rem;
}
.muted {
  margin-top: 20px !important;
  font-size: 13px !important;
  color: var(--text-tertiary) !important;
}
@media (max-width: 700px) {
  .facts {
    grid-template-columns: 1fr 1fr;
  }
  .fact:nth-child(2n) {
    border-right: 0;
  }
  .fact:nth-child(n + 3) {
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
