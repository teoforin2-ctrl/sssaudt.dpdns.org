<script setup lang="ts">
import { formatWager } from "~/utils/format";

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();

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
const q = ref(String(route.query.q || ""));
const typeFilter = ref(String(route.query.type || "all"));
const onlyPromo = ref(route.query.promo === "1");
const wagerFilter = ref(String(route.query.wager || "any"));
const PAGE_SIZE = 24;
const visibleCount = ref(PAGE_SIZE);

const { data, pending, error, refresh } = await useAsyncData(
  () => `bonuses-catalog-${locale.value}-${showExpired.value ? "all" : "live"}`,
  () =>
    $fetch<{ items: BonusItem[] }>(`${config.public.apiBase}/v1/bonuses`, {
      query: {
        locale: locale.value,
        limit: 200,
        includeExpired: showExpired.value ? "1" : undefined,
      },
    }),
  { watch: [locale, showExpired] },
);

const all = computed(() => data.value?.items ?? []);

function isExpired(b: BonusItem) {
  if (!b.validUntil) return false;
  const d = new Date(b.validUntil);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function typeKey(type?: string | null) {
  const s = (type || "").toLowerCase();
  if (/welcome|привет|депозит|deposit/.test(s)) return "welcome";
  if (/no.?deposit|бездеп/.test(s)) return "no-deposit";
  if (/free.?spin|фриспин|fs\b/.test(s)) return "free-spins";
  if (/promo|код|code/.test(s)) return "codes";
  return "other";
}

const filtered = computed(() => {
  let list = all.value;
  if (!showExpired.value) list = list.filter((b) => !isExpired(b));
  if (typeFilter.value !== "all") list = list.filter((b) => typeKey(b.type) === typeFilter.value || (typeFilter.value === "codes" && !!b.promoCode));
  if (onlyPromo.value) list = list.filter((b) => !!b.promoCode);
  if (wagerFilter.value === "30") {
    list = list.filter((b) => {
      const w = formatWager(b.wager);
      if (!w) return false;
      return Number(w.replace("×", "")) <= 30;
    });
  }
  else if (wagerFilter.value === "35") {
    list = list.filter((b) => {
      const w = formatWager(b.wager);
      if (!w) return false;
      return Number(w.replace("×", "")) <= 35;
    });
  }
  const query = q.value.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(query)
        || b.casinoName.toLowerCase().includes(query)
        || (b.promoCode || "").toLowerCase().includes(query),
    );
  }
  return list;
});

const visible = computed(() => filtered.value.slice(0, visibleCount.value));

const typeCounts = computed(() => {
  const base = all.value.filter((b) => showExpired.value || !isExpired(b));
  return {
    all: base.length,
    welcome: base.filter((b) => typeKey(b.type) === "welcome").length,
    "no-deposit": base.filter((b) => typeKey(b.type) === "no-deposit").length,
    "free-spins": base.filter((b) => typeKey(b.type) === "free-spins").length,
    codes: base.filter((b) => !!b.promoCode).length,
  };
});

const tabs = computed(() => [
  { key: "all", label: t("catalog.hub.all"), count: typeCounts.value.all, active: typeFilter.value === "all" },
  { key: "welcome", label: t("catalog.hub.welcomeTitle"), count: typeCounts.value.welcome, active: typeFilter.value === "welcome" },
  { key: "no-deposit", label: t("catalog.hub.noDepositTitle"), count: typeCounts.value["no-deposit"], active: typeFilter.value === "no-deposit" },
  { key: "free-spins", label: t("catalog.hub.freeSpinsTitle"), count: typeCounts.value["free-spins"], active: typeFilter.value === "free-spins" },
  { key: "codes", label: t("catalog.hub.codesTitle"), count: typeCounts.value.codes, active: typeFilter.value === "codes" },
]);

const casinoCount = computed(() => new Set(filtered.value.map((b) => b.casinoSlug)).size);

function syncQuery() {
  const query: Record<string, string> = {};
  if (q.value.trim()) query.q = q.value.trim();
  if (typeFilter.value !== "all") query.type = typeFilter.value;
  if (onlyPromo.value) query.promo = "1";
  if (wagerFilter.value !== "any") query.wager = wagerFilter.value;
  router.replace({ query });
}

watch([q, typeFilter, onlyPromo, wagerFilter], () => {
  visibleCount.value = 24;
  syncQuery();
});

function onTab(key: string) {
  typeFilter.value = key;
}

function resetFilters() {
  q.value = "";
  typeFilter.value = "all";
  onlyPromo.value = false;
  wagerFilter.value = "any";
}

const { pick: seoPick } = useSeoTemplate("bonuses");

usePageSeo({
  title: () => seoPick("title", t("catalog.bonusesTitle")),
  description: () => seoPick("description", t("catalog.bonusesLead")),
  path: "/bonuses",
});

const bonusesH1 = computed(() => seoPick("h1", t("catalog.bonusesTitle")));

useBreadcrumbJsonLd(() => [
  { name: t("catalog.bonusesTitle"), path: "/bonuses" },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("catalog.bonusesTitle"),
    numberOfItems: filtered.value.length,
    itemListElement: visible.value.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${b.title} — ${b.casinoName}`,
      url: localePath(`/casino/${b.casinoSlug}`),
    })),
  };
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.bonusesTitle')"
      :title="bonusesH1"
      :lead="t('catalog.bonusesLead')"
      :count="t('catalog.count', { n: filtered.length })"
    >
      <template #actions>
        <button type="button" class="toggle" @click="showExpired = !showExpired">
          {{ showExpired ? t("catalog.hideExpired") : t("catalog.showExpired") }}
        </button>
      </template>
    </PublicPageHero>

    <PublicSegmentedTabs :tabs="tabs" sticky @select="onTab" />

    <PublicStatStrip
      :items="[
        { label: t('catalog.bonusesTitle'), value: filtered.length },
        { label: t('catalog.ratingTitle'), value: casinoCount },
      ]"
    />

    <div class="filters">
      <label class="search">
        <span class="sr-only">{{ t('home.search.placeholder') }}</span>
        <input v-model="q" type="search" :placeholder="t('home.search.placeholder')" >
      </label>
      <label class="sel">
        <span>{{ t("catalog.wagerShort", { x: "" }).trim() || "Wager" }}</span>
        <UiSelect
          v-model="wagerFilter"
          size="sm"
          :block="false"
          :options="[
            { value: 'any', label: t('catalog.hub.all') },
            { value: '30', label: '≤ ×30' },
            { value: '35', label: '≤ ×35' },
          ]"
        />
      </label>
      <UiChip :active="onlyPromo" @click="onlyPromo = !onlyPromo">
        {{ t("catalog.hub.codesTitle") }}
      </UiChip>
      <button
        v-if="q || typeFilter !== 'all' || onlyPromo || wagerFilter !== 'any'"
        type="button"
        class="reset"
        @click="resetFilters"
      >
        {{ t("catalog.resetFilters") }}
      </button>
    </div>

    <SkeletonBonusCards v-if="pending" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!filtered.length" :title="t('catalog.nothingFound')">
      <UiButton size="sm" variant="secondary" @click="resetFilters">{{ t("catalog.resetFilters") }}</UiButton>
    </UiEmptyState>
    <div v-else class="grid">
      <PublicBonusCard
        v-for="b in visible"
        :key="b.id"
        :title="b.title"
        :type="b.type"
        :wager="b.wager"
        :min-deposit="b.minDeposit"
        :valid-until="b.validUntil"
        :promo-code="b.promoCode"
        :checked-at="b.checkedAt"
        :casino-slug="b.casinoSlug"
        :casino-name="b.casinoName"
        :casino-logo-url="b.casinoLogoUrl"
      />
    </div>

    <div v-if="filtered.length > PAGE_SIZE" class="more">
      <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/bonuses/page/2')">
        {{ t("catalog.showMoreN", { n: Math.min(PAGE_SIZE, filtered.length - PAGE_SIZE) }) }}
        · {{ t("catalog.shownOf", { shown: Math.min(PAGE_SIZE, filtered.length), total: filtered.length }) }}
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.toggle {
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
.search {
  flex: 1 1 220px;
}
.search input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
}
.sel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 650;
}
.sel :deep(.sel) {
  min-width: 120px;
}
.reset {
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
@media (max-width: 1200px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
