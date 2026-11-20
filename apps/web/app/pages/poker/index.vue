<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type Brand = {
  slug: string;
  name: string;
  tagline?: string | null;
  bonusText?: string | null;
  rating?: number;
  partnerUrl?: string | null;
  hot?: boolean;
  hasRepresentative?: boolean;
};

const { data, pending, error, refresh } = await useAsyncData(
  () => `poker-rooms-${locale.value}`,
  () =>
    $fetch<{ brands: Record<string, Brand[]> }>(`${config.public.apiBase}/v1/home`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

const items = computed(() => data.value?.brands?.["poker-room"] || []);

useHead(() => ({
  title: `${t("nav.poker")}`,
}));
</script>

<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("nav.poker") }}</h1>
      <p class="lead">{{ t("home.brands.poker") }}</p>
      <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
    </header>

    <SkeletonPokerGrid v-if="pending" :count="3" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <article v-for="b in items" :key="b.slug" class="card">
        <div class="head">
          <h2>
            <NuxtLink class="name-link" :to="localePath(`/poker-rooms/${b.slug}`)">
              {{ b.name }}
            </NuxtLink>
          </h2>
          <UiBadge v-if="b.hot" tone="hot">{{ t("home.hot") }}</UiBadge>
          <UiBadge v-if="b.hasRepresentative" tone="rep">{{ t("card.rep") }}</UiBadge>
        </div>
        <p v-if="b.tagline" class="tagline">{{ b.tagline }}</p>
        <p v-if="b.bonusText" class="bonus">{{ b.bonusText }}</p>
        <p v-if="b.rating != null" class="rating">{{ b.rating.toFixed(1) }}</p>
        <div class="actions">
          <NuxtLink class="review" :to="localePath(`/poker-rooms/${b.slug}`)">
            {{ t("home.review") }}
          </NuxtLink>
          <UiButton
            v-if="b.partnerUrl"
            size="sm"
            variant="primary"
            :href="b.partnerUrl"
            external
          >
            {{ t("home.play") }}
          </UiButton>
        </div>
      </article>
    </div>

    <p class="more">
      <NuxtLink :to="localePath('/')">{{ t("home.aside.toListing") }}</NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.intro {
  margin-bottom: 18px;
}
.lead,
.tagline,
.bonus {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}
.count {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
h2 {
  margin: 0;
  font-size: 16px;
  font-family: var(--font-display);
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.review {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-decoration: none;
}
.review:hover {
  color: var(--text-primary);
}
.rating {
  margin: 0;
  font-weight: 750;
  font-family: var(--font-display);
}
.more {
  margin-top: 20px;
}
.more a {
  font-weight: 750;
  font-size: 14px;
}
</style>
