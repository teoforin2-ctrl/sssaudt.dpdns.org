<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();

const selected = ref<string[]>(
  String(route.query.slugs || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3),
);

watch(
  () => route.query.slugs,
  (v) => {
    selected.value = String(v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  },
);

type CasinoOpt = { slug: string; name: string };
type CompareItem = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
  editorialScore: number;
  playerScore: number | null;
  reviewCount: number;
  bonusLabel?: string | null;
  license?: string | null;
  platforms: string[];
  payments: { code: string; name: string }[];
  providers: { code: string; name: string }[];
};

const { data: listData } = await useAsyncData(
  () => `compare-opts-${locale.value}`,
  () =>
    $fetch<{ items: CasinoOpt[] }>(`${config.public.apiBase}/v1/casinos`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

const options = computed(() => (listData.value?.items || []).slice(0, 80));

const { data, pending, error, refresh } = await useAsyncData(
  () => `compare-${selected.value.join(",")}-${locale.value}`,
  async () => {
    if (selected.value.length < 2) return null;
    return $fetch<{ items: CompareItem[] }>(`${config.public.apiBase}/v1/compare`, {
      query: { locale: locale.value, slugs: selected.value.join(",") },
    });
  },
  { watch: [selected, locale] },
);

const pick = ref("");

async function syncQuery(next: string[]) {
  selected.value = next;
  await router.replace({
    path: localePath("/compare"),
    query: { slugs: next.length ? next.join(",") : undefined },
  });
  await refresh();
}

function addCasino() {
  const slug = pick.value;
  if (!slug || selected.value.includes(slug) || selected.value.length >= 3) return;
  pick.value = "";
  syncQuery([...selected.value, slug]);
}

function removeCasino(slug: string) {
  syncQuery(selected.value.filter((s) => s !== slug));
}

usePageSeo({
  title: () => t("catalog.compare.title"),
  description: () => t("catalog.compare.lead"),
  noindex: true,
});
</script>

<template>
  <section class="page">
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.compare.title") }}</h1>
      <p class="lead">{{ t("catalog.compare.lead") }}</p>
    </header>

    <form class="picker" @submit.prevent="addCasino">
      <select v-model="pick" class="select">
        <option value="">
          {{ t("catalog.compare.pick") }}
        </option>
        <option
          v-for="o in options.filter((x) => !selected.includes(x.slug))"
          :key="o.slug"
          :value="o.slug"
        >
          {{ o.name }}
        </option>
      </select>
      <UiButton type="submit" variant="secondary" size="sm" :disabled="!pick || selected.length >= 3">
        {{ t("catalog.compare.cta") }}
      </UiButton>
    </form>

    <div v-if="selected.length" class="chips">
      <button
        v-for="s in selected"
        :key="s"
        type="button"
        class="chip"
        @click="removeCasino(s)"
      >
        {{ options.find((o) => o.slug === s)?.name || s }} ×
      </button>
    </div>

    <p v-if="selected.length < 2" class="empty">
      {{ t("catalog.compare.empty") }}
    </p>
    <UiSkeleton v-else-if="pending" height="220px" radius="16px" />
    <p v-else-if="error" class="empty">
      {{ t("home.apiDown") }}
    </p>
    <div v-else-if="data?.items?.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th />
            <th v-for="c in data.items" :key="c.slug">
              <NuxtLink :to="localePath(`/casino/${c.slug}`)">{{ c.name }}</NuxtLink>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{{ t("catalog.compare.rating") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'r'">{{ c.rating.toFixed(1) }}</td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.editorial") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'e'">{{ c.editorialScore.toFixed(1) }}</td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.players") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'p'">
              {{ c.playerScore != null ? c.playerScore.toFixed(1) : '—' }}
            </td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.reviews") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'rv'">{{ c.reviewCount }}</td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.bonus") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'b'">{{ c.bonusLabel || '—' }}</td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.license") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'l'">{{ c.license || '—' }}</td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.payments") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'pay'">
              {{ c.payments.map((p) => p.name).join(", ") || '—' }}
            </td>
          </tr>
          <tr>
            <th>{{ t("catalog.compare.providers") }}</th>
            <td v-for="c in data.items" :key="c.slug + 'pr'">
              {{ c.providers.map((p) => p.name).join(", ") || '—' }}
            </td>
          </tr>
          <tr>
            <th />
            <td v-for="c in data.items" :key="c.slug + 'o'">
              <NuxtLink :to="localePath(`/casino/${c.slug}`)">{{ t("catalog.compare.open") }}</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.page { max-width: 1100px; }
.intro { margin-bottom: 16px; }
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead { margin: 0; color: var(--text-secondary); font-size: 15px; max-width: 60ch; }
.picker { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.select {
  min-width: min(280px, 100%);
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  padding: 0 10px;
  font: inherit;
}
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.chip {
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  border-radius: 999px;
  padding: 6px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.empty { color: var(--text-tertiary); font-size: 14px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border-default); border-radius: 14px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-default);
  text-align: left;
  vertical-align: top;
}
.table thead th { background: var(--bg-elev-2); font-weight: 700; }
.table tbody th {
  width: 140px;
  color: var(--text-secondary);
  font-weight: 650;
  background: var(--bg-elev-1);
}
</style>
