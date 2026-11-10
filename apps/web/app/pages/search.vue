<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

type Hit = {
  type: "casino" | "slot" | "bonus" | "article";
  slug: string;
  title: string;
  description?: string | null;
  href: string;
};

const q = ref(String(route.query.q || ""));

watch(
  () => route.query.q,
  (v) => {
    q.value = String(v || "");
  },
);

const { data, pending, refresh } = await useAsyncData(
  () => `search-page-${locale.value}-${q.value}`,
  () =>
    $fetch<{ q: string; items: Hit[]; groups: Record<string, Hit[]> }>(
      `${config.public.apiBase}/v1/search`,
      { query: { q: q.value, locale: locale.value } },
    ),
  { watch: [locale, q] },
);

function submit() {
  navigateTo({ path: localePath("/search"), query: { q: q.value.trim() || undefined } });
  refresh();
}

const groups = computed(() => ({
  casinos: data.value?.groups?.casinos || [],
  slots: data.value?.groups?.slots || [],
  bonuses: data.value?.groups?.bonuses || [],
  articles: data.value?.groups?.articles || [],
}));

const empty =
  computed(
    () =>
      !!q.value.trim() &&
      !groups.value.casinos.length &&
      !groups.value.slots.length &&
      !groups.value.bonuses.length &&
      !groups.value.articles.length,
  );

usePageSeo({
  title: () => t("pages.search.title"),
  description: () => t("home.search.placeholder"),
  noindex: true,
});
</script>

<template>
  <article class="page">
    <h1 class="page-title">{{ t("pages.search.title") }}</h1>
    <form class="bar" @submit.prevent="submit">
      <label class="sr-only" for="site-search-q">{{ t("nav.search") }}</label>
      <input
        id="site-search-q"
        v-model="q"
        type="search"
        :placeholder="t('home.search.placeholder')"
        autocomplete="off"
      >
      <UiButton type="submit" variant="primary">{{ t("nav.search") }}</UiButton>
    </form>


    <SkeletonSearchResults v-if="pending" :count="4" />
    <template v-else>
      <section v-if="groups.casinos.length" class="group">
        <h2>{{ t("home.search.groups.casino") }}</h2>
        <ul>
          <li v-for="item in groups.casinos" :key="item.slug">
            <NuxtLink :to="localePath(item.href || `/casino/${item.slug}`)">
              <strong>{{ item.title }}</strong>
              <span v-if="item.description">{{ item.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
      <section v-if="groups.slots.length" class="group">
        <h2>{{ t("home.search.groups.slot") }}</h2>
        <ul>
          <li v-for="item in groups.slots" :key="item.slug">
            <NuxtLink :to="localePath(item.href || `/slots/${item.slug}`)">
              <strong>{{ item.title }}</strong>
              <span v-if="item.description">{{ item.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
      <section v-if="groups.bonuses.length" class="group">
        <h2>{{ t("home.search.groups.bonus") }}</h2>
        <ul>
          <li v-for="item in groups.bonuses" :key="item.slug + item.title">
            <NuxtLink :to="localePath(item.href || `/bonuses`)">
              <strong>{{ item.title }}</strong>
              <span v-if="item.description">{{ item.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
      <section v-if="groups.articles.length" class="group">
        <h2>{{ t("home.search.groups.article") }}</h2>
        <ul>
          <li v-for="item in groups.articles" :key="item.slug">
            <NuxtLink :to="localePath(item.href || `/articles/${item.slug}`)">
              <strong>{{ item.title }}</strong>
              <span v-if="item.description">{{ item.description }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
      <UiEmptyState v-if="empty" :title="t('home.search.empty')" />
    </template>
  </article>
</template>

<style scoped>
.page {
  max-width: 860px;
}
.page-title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 36px);
}
.bar {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
}
.bar input {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  padding: 0 14px;
  font: inherit;
}
.group {
  margin-bottom: 22px;
}
.group h2 {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.group a {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  text-decoration: none;
  color: inherit;
}
.group a:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  text-decoration: none;
}
.group span {
  font-size: 13px;
  color: var(--text-tertiary);
}
.muted {
  color: var(--text-tertiary);
}
</style>
