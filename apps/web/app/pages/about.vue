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

const listItems = computed(() => [
  t("pages.about.li1"),
  t("pages.about.li2"),
  t("pages.about.li3"),
  t("pages.about.li4"),
]);

const links = computed(() => [
  { to: localePath("/how-we-earn"), label: t("pages.about.earnLink") },
  { to: localePath("/legal/responsible-gambling"), label: t("nav.responsible") },
  { to: localePath("/legal/18-plus"), label: "18+" },
]);

usePageSeo({
  title: () => t("pages.about.title"),
  description: () => t("pages.about.lead"),
});
</script>

<template>
  <PublicContentPage
    :eyebrow="t('pages.about.eyebrow')"
    :title="t('pages.about.title')"
    :lead="t('pages.about.lead')"
  >
    <div class="facts">
      <div v-if="stats.casinos" class="fact">
        <b class="tabular-nums">{{ stats.casinos }}</b>
        <span>{{ t("home.facts.casinos") }}</span>
      </div>
      <div v-if="stats.reviews" class="fact">
        <b class="tabular-nums">{{ stats.reviews }}</b>
        <span>{{ t("home.facts.reviews") }}</span>
      </div>
      <div v-if="stats.bonuses" class="fact">
        <b class="tabular-nums">{{ stats.bonuses }}</b>
        <span>{{ t("home.facts.bonuses") }}</span>
      </div>
      <div v-if="stats.slots" class="fact">
        <b class="tabular-nums">{{ stats.slots }}</b>
        <span>{{ t("home.facts.slots") }}</span>
      </div>
    </div>

    <p>{{ t("pages.about.p1") }}</p>
    <PublicCallout tone="important">
      {{ t("pages.about.p2") }}
    </PublicCallout>

    <h2>{{ t("pages.about.whatTitle") }}</h2>
    <PublicContentList :items="listItems" />

    <template #links>
      <PublicLinkRow :links="links" />
    </template>
  </PublicContentPage>
</template>

<style scoped>
.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.fact {
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  display: grid;
  gap: 4px;
}
.fact b {
  font-family: var(--font-display);
  font-size: 22px;
}
.fact span {
  font-size: 12px;
  color: var(--text-tertiary);
}
h2 {
  margin: 22px 0 12px;
  font-family: var(--font-display);
  font-size: 20px;
}
@media (max-width: 800px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
