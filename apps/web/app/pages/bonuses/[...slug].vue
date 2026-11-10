<script setup lang="ts">
import { findNavLink, locTitle } from "~/data/site-nav";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const parts = computed(() => (route.params.slug as string[]) || []);
const leaf = computed(() => parts.value[parts.value.length - 1] || "");
const path = computed(() => `/bonuses/${parts.value.join("/")}`);
const navLink = computed(() => findNavLink(path.value));

const filters: Record<string, { test: (b: BonusItem) => boolean; titleKey: string; leadKey: string }> = {
  welcome: {
    titleKey: "catalog.hub.welcomeTitle",
    leadKey: "catalog.hub.welcomeLead",
    test: (b) => /привет|welcome|first|депозит/i.test(`${b.type || ""} ${b.title}`),
  },
  "no-deposit": {
    titleKey: "catalog.hub.noDepositTitle",
    leadKey: "catalog.hub.noDepositLead",
    test: (b) => /бездеп|no[\s-]?deposit|без депозит/i.test(`${b.type || ""} ${b.title}`),
  },
  "free-spins": {
    titleKey: "catalog.hub.freeSpinsTitle",
    leadKey: "catalog.hub.freeSpinsLead",
    test: (b) => /фриспин|free[\s-]?spin|\bfs\b|спин/i.test(`${b.type || ""} ${b.title}`),
  },
  codes: {
    titleKey: "catalog.hub.codesTitle",
    leadKey: "catalog.hub.codesLead",
    test: (b) => !!b.promoCode,
  },
};

type BonusItem = {
  id: string;
  title: string;
  type?: string | null;
  amountOrPercent?: string | null;
  wager?: string | null;
  promoCode?: string | null;
  minDeposit?: string | null;
  checkedAt?: string | null;
  casinoSlug: string;
  casinoName: string;
  casinoLogoUrl?: string | null;
};

const filter = computed(() => filters[leaf.value] || null);
const title = computed(() =>
  filter.value
    ? t(filter.value.titleKey)
    : navLink.value
      ? locTitle(navLink.value.title, locale.value)
      : leaf.value,
);

const { data, pending, error, refresh } = await useAsyncData(
  () => `bonuses-hub-${leaf.value}-${locale.value}`,
  () =>
    $fetch<{ items: BonusItem[] }>(`${config.public.apiBase}/v1/bonuses`, {
      query: { locale: locale.value, limit: 120 },
    }),
  { watch: [leaf, locale] },
);

const items = computed(() => {
  const all = data.value?.items ?? [];
  if (!filter.value) return all;
  return all.filter(filter.value.test);
});

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
  title: `${title.value}`,
  meta: [
    {
      name: "description",
      content: filter.value ? t(filter.value.leadKey) : t("catalog.bonusesLead"),
    },
  ],
}));
</script>

<template>
  <section class="page">
    <header class="intro">
      <p class="eyebrow">{{ t("catalog.bonusesTitle") }}</p>
      <h1 class="page-title">{{ title }}</h1>
      <p class="lead">{{ filter ? t(filter.leadKey) : t("catalog.bonusesLead") }}</p>
      <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
    </header>

    <div class="tabs">
      <NuxtLink :to="localePath('/bonuses')" class="tab">{{ t("catalog.hub.all") }}</NuxtLink>
      <NuxtLink :to="localePath('/bonuses/welcome')" class="tab">{{ t("catalog.hub.welcomeTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/bonuses/no-deposit')" class="tab">{{ t("catalog.hub.noDepositTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/bonuses/free-spins')" class="tab">{{ t("catalog.hub.freeSpinsTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/bonuses/codes')" class="tab">{{ t("catalog.hub.codesTitle") }}</NuxtLink>
    </div>

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
.page {
  max-width: 1100px;
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
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 62ch;
}
.count {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.tab {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  color: var(--text-secondary);
}
.tab.router-link-active {
  border-color: color-mix(in srgb, var(--accent-cta) 45%, var(--border-default));
  background: var(--accent-cta-soft);
  color: var(--text-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
.casino {
  margin: 0;
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
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.actions a {
  font-size: 13px;
  font-weight: 700;
}
</style>
