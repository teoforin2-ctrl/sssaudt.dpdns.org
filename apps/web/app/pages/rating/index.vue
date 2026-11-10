<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type CasinoListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
  editorialScore?: number;
  playerScore?: number | null;
  reviewCount?: number;
  hot: boolean;
  top: boolean;
  rank: number;
  isNew?: boolean;
  hasRepresentative?: boolean;
  bonusLabel?: string | null;
  bonusWager?: string | null;
  bonusPromo?: string | null;
  bonusCheckedAt?: string | null;
};

type FilterKey = "all" | "top" | "hot" | "new";
const filter = ref<FilterKey>("all");
const viewMode = ref<"list" | "grid">("list");
const visibleCount = ref(20);

const { data, error, pending, refresh } = await useAsyncData(
  () => `rating-casinos-${locale.value}`,
  () =>
    $fetch<{ items: CasinoListItem[] }>(`${config.public.apiBase}/v1/casinos`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

const all = computed(() => data.value?.items ?? []);
const items = computed(() => {
  let list = [...all.value];
  if (filter.value === "top") list = list.filter((c) => c.top);
  else if (filter.value === "hot") list = list.filter((c) => c.hot);
  else if (filter.value === "new") list = list.filter((c) => c.isNew);
  return list;
});
const visible = computed(() => items.value.slice(0, visibleCount.value));

watch(filter, () => {
  visibleCount.value = 20;
});

usePageSeo({
  title: () => t("catalog.ratingTitle"),
  description: () => t("catalog.ratingLead"),
});
</script>


<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.ratingTitle") }}</h1>
      <p class="lead">{{ t("catalog.ratingLead") }}</p>
    </header>

    <div class="toolbar">
      <div class="chips">
        <UiChip :active="filter === 'all'" @click="filter = 'all'">{{ t("home.filters.all") }}</UiChip>
        <UiChip :active="filter === 'top'" @click="filter = 'top'">{{ t("home.filters.top") }}</UiChip>
        <UiChip :active="filter === 'hot'" @click="filter = 'hot'">{{ t("home.filters.hot") }}</UiChip>
        <UiChip :active="filter === 'new'" @click="filter = 'new'">{{ t("home.filters.new") }}</UiChip>
      </div>
      <div class="right">
        <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
        <HomeViewToggle v-model="viewMode" />
      </div>
    </div>

    <SkeletonCasinoList v-if="pending" mode="list" :count="6" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else :class="viewMode === 'grid' ? 'grid' : 'list'">
      <CasinoTile v-if="viewMode === 'grid'" v-for="c in visible" :key="c.id" :casino="c" />
      <CasinoRow v-else v-for="c in visible" :key="c.id" :casino="c" />
    </div>

    <div v-if="visibleCount < items.length" class="more">
      <UiButton variant="secondary" size="sm" @click="visibleCount += 20">
        {{ t("home.showMore") }}
      </UiButton>
    </div>

    <p class="home-link">
      <NuxtLink :to="localePath('/')">{{ t("stub.toLiveRating") }}</NuxtLink>
    </p>
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
  margin: 0;
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 15px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.chips,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.stack,
.list {
  display: grid;
  gap: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
.home-link {
  margin-top: 18px;
}
.home-link a {
  font-weight: 750;
  font-size: 14px;
}
</style>
