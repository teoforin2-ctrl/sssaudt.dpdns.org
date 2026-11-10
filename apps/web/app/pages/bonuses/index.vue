<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type BonusItem = {
  id: string;
  title: string;
  type?: string | null;
  amountOrPercent?: string | null;
  wager?: string | null;
  promoCode?: string | null;
  minDeposit?: string | null;
  validUntil?: string | null;
  checkedAt?: string | null;
  casinoSlug: string;
  casinoName: string;
  casinoLogoUrl?: string | null;
};

const showExpired = ref(false);

const { data, pending, error, refresh } = await useAsyncData(
  () => `bonuses-catalog-${locale.value}-${showExpired.value ? "all" : "live"}`,
  () =>
    $fetch<{ items: BonusItem[] }>(`${config.public.apiBase}/v1/bonuses`, {
      query: {
        locale: locale.value,
        limit: 96,
        includeExpired: showExpired.value ? "1" : undefined,
      },
    }),
  { watch: [locale, showExpired] },
);

const items = computed(() => data.value?.items ?? []);

function isExpired(b: BonusItem) {
  if (!b.validUntil) return false;
  const d = new Date(b.validUntil);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}


function checkedLabel(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale.value === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

useHead(() => ({
  title: `${t("catalog.bonusesTitle")}`,
  meta: [{ name: "description", content: t("catalog.bonusesLead") }],
}));
</script>

<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.bonusesTitle") }}</h1>
      <p class="lead">{{ t("catalog.bonusesLead") }}</p>
      <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
      <button type="button" class="toggle" @click="showExpired = !showExpired">
        {{ showExpired ? t("catalog.hideExpired") : t("catalog.showExpired") }}
      </button>
    </header>

    <SkeletonBonusCards v-if="pending" :count="6" />

    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <article v-for="b in items" :key="b.id" class="card">
        <div class="head">
          <NuxtLink class="logo-link" :to="localePath(`/casino/${b.casinoSlug}`)">
            <CasinoLogo :name="b.casinoName" :src="b.casinoLogoUrl" />
          </NuxtLink>
          <div>
            <p class="casino">
              <NuxtLink class="name-link" :to="localePath(`/casino/${b.casinoSlug}`)">
                {{ b.casinoName }}
              </NuxtLink>
            </p>
            <div class="chips">
              <UiBadge v-if="b.type" tone="top">{{ b.type }}</UiBadge>
              <UiBadge v-if="isExpired(b)" tone="hot">{{ t("catalog.expired") }}</UiBadge>
              <span v-if="b.wager">{{ t("catalog.wager", { x: b.wager }) }}</span>
            </div>

          </div>
        </div>
        <h2>
          <NuxtLink class="name-link" :to="localePath(`/casino/${b.casinoSlug}`)">
            {{ b.title }}
          </NuxtLink>
        </h2>
        <p class="meta">
          <span v-if="b.amountOrPercent">{{ b.amountOrPercent }}</span>
          <span v-if="b.minDeposit"> · min {{ b.minDeposit }}</span>
          <span v-if="checkedLabel(b.checkedAt)">
            · {{ t("catalog.checked", { d: checkedLabel(b.checkedAt) }) }}
          </span>
        </p>
        <div class="actions">
          <UiCopyButton v-if="b.promoCode" :value="b.promoCode" />
          <UiButton
            size="sm"
            variant="primary"
            :href="`${config.public.apiBase}/go/${b.casinoSlug}?locale=${locale}`"
            external
          >
            {{ t("home.play") }}
          </UiButton>
          <NuxtLink :to="localePath(`/casino/${b.casinoSlug}`)">
            {{ t("catalog.openCasino") }}
          </NuxtLink>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.intro {
  margin-bottom: 18px;
}
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 8px;
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 15px;
}
.count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.toggle {
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-cyan);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
.casino {
  margin: 0 0 4px;
  font-weight: 750;
  font-size: 13px;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}
h2 {
  margin: 0;
  font-size: clamp(14px, 3.6vw, 16px);
  font-family: var(--font-display);
  line-height: 1.3;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.actions a {
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
</style>
