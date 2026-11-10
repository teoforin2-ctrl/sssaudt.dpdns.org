<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

type SlotItem = {
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  mechanics?: string[];
  providerName?: string | null;
  isNew?: boolean;
  hasBonus?: boolean;
  demoUrl?: string | null;
  description?: string | null;
};

const filter = ref("all");
const filters = [
  { id: "all", label: "home.slots.filters.all" },
  { id: "new", label: "home.slots.filters.new" },
  { id: "highRtp", label: "home.slots.filters.highRtp" },
  { id: "bonusBuy", label: "home.slots.filters.bonusBuy" },
  { id: "megaways", label: "home.slots.filters.megaways" },
];

const { data, pending, error, refresh } = await useAsyncData(
  () => `slots-catalog-${locale.value}`,
  () =>
    $fetch<{ items: SlotItem[] }>(`${config.public.apiBase}/v1/slots`, {
      query: { locale: locale.value, limit: 96 },
    }),
  { watch: [locale] },
);

const items = computed(() => {
  let list = data.value?.items ?? [];
  if (filter.value === "new") list = list.filter((s) => s.isNew);
  else if (filter.value === "highRtp") list = list.filter((s) => (s.rtp || 0) >= 96.5);
  else if (filter.value === "bonusBuy") list = list.filter((s) => s.mechanics?.includes("bonus-buy"));
  else if (filter.value === "megaways") list = list.filter((s) => s.mechanics?.includes("megaways"));
  return list;
});

useHead(() => ({
  title: `${t("catalog.slotsTitle")}`,
  meta: [{ name: "description", content: t("catalog.slotsLead") }],
}));
</script>

<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.slotsTitle") }}</h1>
      <p class="lead">{{ t("catalog.slotsLead") }}</p>
    </header>

    <div class="toolbar">
      <div class="chips">
        <UiChip
          v-for="f in filters"
          :key="f.id"
          :active="filter === f.id"
          @click="filter = f.id"
        >
          {{ t(f.label) }}
        </UiChip>
      </div>
      <p class="count">{{ t("catalog.count", { n: items.length }) }}</p>
    </div>

    <SkeletonSlotGrid v-if="pending" :count="8" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
    <div v-else class="grid">
      <article v-for="s in items" :key="s.slug" class="card">
        <NuxtLink :to="localePath(`/slots/${s.slug}`)" class="cover">
          <SlotCover :title="s.title" :theme="s.theme" :slug="s.slug" />
        </NuxtLink>
        <div class="meta">
          <UiBadge v-if="s.isNew" tone="new">{{ t("home.new") }}</UiBadge>
          <span v-if="s.rtp != null">{{ t("catalog.rtp", { n: s.rtp }) }}</span>
          <span v-if="s.providerName">{{ s.providerName }}</span>
        </div>
        <h2>
          <NuxtLink :to="localePath(`/slots/${s.slug}`)">{{ s.title }}</NuxtLink>
        </h2>
        <p v-if="s.description" class="desc">{{ s.description }}</p>
        <div class="actions">
          <UiButton
            v-if="s.demoUrl"
            size="sm"
            variant="secondary"
            :href="s.demoUrl"
            external
          >
            {{ t("catalog.demo") }}
          </UiButton>
          <NuxtLink class="more" :to="localePath(`/slots/${s.slug}`)">→</NuxtLink>
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.cover {
  display: block;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4 / 5;
}
.cover :deep(.cover) {
  height: 100%;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}
h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
}
h2 a {
  color: inherit;
  text-decoration: none;
}
.desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.more {
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
</style>
