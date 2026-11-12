<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();

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
  coverUrl?: string | null;
};

const filter = ref(String(route.query.filter || "all"));
const q = ref(String(route.query.q || ""));
const sort = ref(String(route.query.sort || "popular"));
const PAGE_SIZE = 24;
const visibleCount = ref(PAGE_SIZE);

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
      query: { locale: locale.value, limit: 200 },
    }),
  { watch: [locale] },
);

const items = computed(() => {
  let list = [...(data.value?.items ?? [])];
  if (filter.value === "new") list = list.filter((s) => s.isNew);
  else if (filter.value === "highRtp") list = list.filter((s) => (s.rtp || 0) >= 96.5);
  else if (filter.value === "bonusBuy") list = list.filter((s) => s.mechanics?.includes("bonus-buy"));
  else if (filter.value === "megaways") list = list.filter((s) => s.mechanics?.includes("megaways"));
  const query = q.value.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(query)
        || (s.providerName || "").toLowerCase().includes(query),
    );
  }
  if (sort.value === "rtp") list.sort((a, b) => (b.rtp || 0) - (a.rtp || 0));
  else if (sort.value === "az") list.sort((a, b) => a.title.localeCompare(b.title, locale.value));
  else if (sort.value === "new") list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return list;
});

const visible = computed(() => items.value.slice(0, visibleCount.value));

const providers = computed(() => {
  const map = new Map<string, number>();
  for (const s of data.value?.items ?? []) {
    if (!s.providerName) continue;
    map.set(s.providerName, (map.get(s.providerName) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
});

watch([filter, q, sort], () => {
  visibleCount.value = 24;
  const query: Record<string, string> = {};
  if (filter.value !== "all") query.filter = filter.value;
  if (q.value.trim()) query.q = q.value.trim();
  if (sort.value !== "popular") query.sort = sort.value;
  router.replace({ query });
});

usePageSeo({
  title: () => t("catalog.slotsTitle"),
  description: () => t("catalog.slotsLead"),
  path: "/slots",
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.slotsTitle"), path: "/slots" },
]);

useJsonLd(() => {
  if (!visible.value.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("catalog.slotsTitle"),
    numberOfItems: items.value.length,
    itemListElement: visible.value.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      url: localePath(`/slots/${s.slug}`),
    })),
  };
});
</script>

<template>
  <section class="container-wide page">
    <PublicPageHero
      :eyebrow="t('catalog.slotsTitle')"
      :title="t('catalog.slotsTitle')"
      :lead="t('catalog.slotsLead')"
      :count="t('catalog.count', { n: items.length })"
    />

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
      <div class="right">
        <label class="search">
          <input v-model="q" type="search" :placeholder="t('home.search.placeholder')" >
        </label>
        <UiSelect
          v-model="sort"
          class="sort"
          size="sm"
          :block="false"
          :options="[
            { value: 'popular', label: t('home.sort.rating') },
            { value: 'rtp', label: 'RTP ↓' },
            { value: 'new', label: t('home.sort.new') },
            { value: 'az', label: 'A–Я' },
          ]"
        />
      </div>
    </div>

    <div v-if="providers.length" class="providers" aria-label="Providers">
      <button
        v-for="p in providers"
        :key="p.name"
        type="button"
        class="prov"
        @click="q = p.name"
      >
        {{ p.name }}
        <span class="tabular-nums">{{ p.count }}</span>
      </button>
    </div>

    <SkeletonSlotGrid v-if="pending" :count="8" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>
    <UiEmptyState v-else-if="!items.length" :title="t('catalog.nothingFound')" />
    <div v-else class="grid">
      <PublicSlotCard
        v-for="s in visible"
        :key="s.slug"
        :slug="s.slug"
        :title="s.title"
        :theme="s.theme"
        :rtp="s.rtp"
        :provider-name="s.providerName"
        :is-new="s.isNew"
        :mechanics="s.mechanics"
        :demo-url="s.demoUrl"
        :cover-src="s.coverUrl"
      />
    </div>

    <div v-if="items.length > PAGE_SIZE" class="more">
      <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/slots/page/2')">
        {{ t("catalog.showMoreN", { n: Math.min(PAGE_SIZE, items.length - PAGE_SIZE) }) }}
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.chips,
.right {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search input {
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  width: min(220px, 100%);
}
.sort {
  min-width: 140px;
}
.providers {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
  padding-bottom: 2px;
  scroll-snap-type: x mandatory;
}
.prov {
  scroll-snap-align: start;
  flex: 0 0 auto;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.prov span {
  color: var(--text-tertiary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
@media (max-width: 1200px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
