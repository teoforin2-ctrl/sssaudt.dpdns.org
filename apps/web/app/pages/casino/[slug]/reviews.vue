<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug));
const page = ref(Math.max(1, Number(route.query.page || 1) || 1));

watch(
  () => route.query.page,
  (v) => {
    page.value = Math.max(1, Number(v || 1) || 1);
  },
);

type Review = {
  id: string;
  rating: number;
  body: string;
  authorName?: string | null;
  authorRank?: string | null;
  dateText?: string | null;
  reply?: { body: string; updatedAt?: string } | null;
};


const { data: casinoData } = await useAsyncData(
  () => `reviews-casino-${slug.value}-${locale.value}`,
  () =>
    $fetch<{ casino: { name: string; slug: string } }>(
      `${config.public.apiBase}/v1/casinos/${slug.value}`,
      { query: { locale: locale.value } },
    ),
  { watch: [slug, locale] },
);

const casinoName = computed(() => casinoData.value?.casino?.name || slug.value);

const { data, pending, refresh } = await useAsyncData(
  () => `reviews-page-${slug.value}-${page.value}-${locale.value}`,
  () =>
    $fetch<{
      page: number;
      pages: number;
      total: number;
      items: Review[];
    }>(`${config.public.apiBase}/v1/casinos/${slug.value}/reviews`, {
      query: { page: page.value, limit: 20 },
    }),
  { watch: [slug, page, locale] },
);

async function go(next: number) {
  page.value = next;
  await navigateTo({
    path: localePath(`/casino/${slug.value}/reviews`),
    query: { page: next > 1 ? String(next) : undefined },
  });
  await refresh();
}

usePageSeo({
  title: () => t("catalog.reviewsPage.title", { name: casinoName.value }),
  description: () => t("catalog.reviewsPage.lead"),
  noindex: () => page.value > 1,
});

useJsonLd(() => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: t("catalog.reviewsPage.title", { name: casinoName.value }),
  about: { "@type": "Organization", name: casinoName.value },
}));
</script>

<template>
  <section class="page">
    <NuxtLink class="back" :to="localePath(`/casino/${slug}`)">
      ← {{ t("catalog.reviewsPage.back") }}
    </NuxtLink>
    <header class="intro">
      <h1 class="page-title">{{ t("catalog.reviewsPage.title", { name: casinoName }) }}</h1>
      <p class="lead">{{ t("catalog.reviewsPage.lead") }}</p>
      <p v-if="data?.total" class="count">{{ t("card.reviewsCount", { n: data.total }) }}</p>
    </header>

    <SkeletonReviewList v-if="pending && !data" :count="5" />
    <UiEmptyState v-else-if="!data?.items?.length" :title="t('catalog.reviewsPage.empty')" />
    <div v-else class="list">
      <ReviewCard
        v-for="r in data.items"
        :key="r.id"
        :author-name="r.authorName"
        :author-rank="r.authorRank"
        :date-text="r.dateText"
        :rating="r.rating"
        :body="r.body"
        :reply-body="r.reply?.body"
      />

    </div>

    <nav v-if="(data?.pages || 0) > 1" class="pager">
      <UiButton
        variant="secondary"
        size="sm"
        type="button"
        :disabled="page <= 1 || pending"
        @click="go(page - 1)"
      >
        {{ t("card.reviewsPrev") }}
      </UiButton>
      <span>{{ t("card.reviewsPage", { page, pages: data?.pages || 1 }) }}</span>
      <UiButton
        variant="secondary"
        size="sm"
        type="button"
        :disabled="page >= (data?.pages || 1) || pending"
        @click="go(page + 1)"
      >
        {{ t("card.reviewsNext") }}
      </UiButton>
    </nav>
  </section>
</template>

<style scoped>
.page { max-width: 820px; }
.back {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}
.intro { margin-bottom: 18px; }
.page-title {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 36px);
  letter-spacing: -0.03em;
}
.lead { margin: 0; color: var(--text-secondary); font-size: 15px; }
.count { margin: 8px 0 0; font-size: 13px; color: var(--text-tertiary); }
.list { display: grid; gap: 12px; }
.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
