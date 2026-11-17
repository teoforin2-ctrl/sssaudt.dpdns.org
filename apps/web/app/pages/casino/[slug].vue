<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { siteName } = useSiteSettings();
const slug = computed(() => String(route.params.slug));

type Review = {
  id: string;
  rating: number;
  body: string;
  authorName?: string | null;
  authorRank?: string | null;
  dateText?: string | null;
  reply?: { body: string; updatedAt?: string } | null;
};


type ReviewsPage = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  items: Review[];
};

type Casino = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  license?: string | null;
  platforms?: string[] | null;
  editorialScore: number;
  playerScore: number | null;
  rating: number;
  hot: boolean;
  top: boolean;
  rank: number;
  hasRepresentative: boolean;
  shortDesc?: string | null;
  description?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    ogImage?: string | null;
  } | null;
  payments: { code: string; name: string }[];
  providers: { code: string; name: string }[];
  bonuses: {
    id: string;
    title: string;
    promoCode?: string | null;
    type?: string | null;
    amountOrPercent?: string | null;
    wager?: string | null;
    description?: string | null;
    terms?: string | null;
    imageUrl?: string | null;
  }[];
  promo: { code: string; percent: number | null; title: string } | null;
  reviewCount?: number;
  reviews: ReviewsPage | Review[];
};

const reviewPage = ref(Math.max(1, Number(route.query.reviewPage || 1) || 1));

watch(
  () => route.query.reviewPage,
  (v) => {
    reviewPage.value = Math.max(1, Number(v || 1) || 1);
  },
);

const { data, error, pending } = await useAsyncData(
  () => `casino-${slug.value}-${locale.value}`,
  () =>
    $fetch<{ casino: Casino }>(`${config.public.apiBase}/v1/casinos/${slug.value}`, {
      query: { locale: locale.value },
    }),
  { watch: [slug, locale] },
);

if (import.meta.server && error.value) {
  const status = Number((error.value as { statusCode?: number }).statusCode || 0);
  if (status === 410) {
    throw createError({ statusCode: 410, statusMessage: "Gone" });
  }
  if (status === 404) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
}

const c = computed(() => data.value?.casino);
const ogImage = useEntityOgImage("casino", slug, {
  seoOg: () => c.value?.seo?.ogImage,
  fallbackImage: () => c.value?.logoUrl,
});
const reviewModal = ref(false);
const { ensureGroup } = useRewardGroup();

function openReviewFlow() {
  ensureGroup();
  reviewModal.value = true;
}

async function onReviewPublished() {
  await refreshReviews();
  await refreshNuxtData(`casino-${slug.value}-${locale.value}`);
}

const {
  data: reviewsData,
  pending: reviewsPending,
  refresh: refreshReviews,
} = await useAsyncData(
  () => `casino-reviews-${slug.value}-${reviewPage.value}`,
  () =>
    $fetch<ReviewsPage>(`${config.public.apiBase}/v1/casinos/${slug.value}/reviews`, {
      query: { page: reviewPage.value, limit: 20 },
    }),
  { watch: [slug, reviewPage] },
);

const reviews = computed<ReviewsPage>(() => {
  if (reviewsData.value) return reviewsData.value;
  const raw = c.value?.reviews;
  if (raw && !Array.isArray(raw)) return raw;
  const items = Array.isArray(raw) ? raw : [];
  return {
    page: 1,
    pageSize: 20,
    total: c.value?.reviewCount ?? items.length,
    pages: 1,
    items,
  };
});

async function goReviewPage(page: number) {
  const next = Math.min(Math.max(1, page), reviews.value.pages || 1);
  if (next === reviewPage.value) return;
  reviewPage.value = next;
  await navigateTo({
    path: route.path,
    query: { ...route.query, reviewPage: next > 1 ? String(next) : undefined },
    hash: "#reviews",
  });
  await refreshReviews();
  if (import.meta.client) {
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const { pickEntity: seoPickEntity } = useSeoTemplate("casino", () => ({
  casino: c.value?.name || "",
  name: c.value?.name || "",
}));

usePageSeo({
  title: () =>
    seoPickEntity(
      "title",
      () => c.value?.seo,
      c.value ? t("seo.cardTitle", { name: c.value.name }) : t("seo.listingTitle"),
    ),
  description: () => {
    if (!c.value) return seoPickEntity("description", () => null, t("seo.listingDesc"));
    const desc = (c.value.shortDesc || "").trim();
    const fallback = desc
      ? t("seo.cardDesc", { desc })
      : t("seo.cardDescFallback", { name: c.value.name });
    return seoPickEntity("description", () => c.value?.seo, fallback);
  },
  ogImage,
  // Paginated review deep-links are thin/duplicate — keep out of the index.
  noindex: () => reviewPage.value > 1,
});

const reviewHtml = computed(() => renderMarkdown(c.value?.description || ""));

function displayCasinoName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

useJsonLd(() => {
  if (!c.value) return null;
  const visibleName = displayCasinoName(c.value.name);
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Organization",
      name: visibleName,
      image: c.value.logoUrl || undefined,
    },
    author: { "@type": "Organization", name: siteName.value },
    reviewRating: {
      "@type": "Rating",
      ratingValue: c.value.editorialScore,
      bestRating: 5,
    },
    description: c.value.shortDesc || undefined,
  };
});

useBreadcrumbJsonLd(() => [
  { name: t("catalog.ratingTitle"), path: "/rating" },
  { name: c.value?.name || "…" },
]);
</script>



<template>
  <div class="container-wide">
    <nav class="crumbs" aria-label="Breadcrumb">
      <NuxtLink :to="localePath('/rating')">{{ t("catalog.ratingTitle") }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <span>{{ c?.name || "…" }}</span>
    </nav>
    <NuxtLink class="back-link mobile-only" :to="localePath('/rating')">← {{ t("card.back") }}</NuxtLink>

    <div v-if="pending" class="stack">
      <UiSkeleton height="220px" radius="20px" />
      <UiSkeleton height="120px" radius="14px" />
    </div>
    <UiEmptyState
      v-else-if="error || !c"
      :title="t('error.notFoundTitle')"
      :description="t('error.notFoundBody')"
    >
      <UiButton size="sm" variant="primary" :href="localePath('/')">{{ t("error.home") }}</UiButton>
    </UiEmptyState>

    <template v-else>
      <CasinoHero :casino="c" @review="openReviewFlow" />

      <section v-if="reviewHtml" class="section-block editorial">
        <h2>{{ t("card.editorialReview") }}</h2>
        <div class="md-body" v-html="reviewHtml" />
      </section>

      <section v-if="c.payments.length || c.providers.length" class="section-block">
        <div class="grid-2">
          <div v-if="c.payments.length">
            <h2>{{ t("card.payments") }}</h2>
            <div class="chip-row">
              <NuxtLink
                v-for="p in c.payments"
                :key="p.code"
                class="tag link"
                :to="localePath(`/rating/payments/${p.code}`)"
              >{{ p.name }}</NuxtLink>
            </div>
          </div>
          <div v-if="c.providers.length">
            <h2>{{ t("card.providers") }}</h2>
            <div class="chip-row">
              <span v-for="p in c.providers.slice(0, 12)" :key="p.code" class="tag">{{ p.name }}</span>
            </div>
          </div>
        </div>
        <p class="compare-line">
          <NuxtLink :to="{ path: localePath('/compare'), query: { slugs: c.slug } }">
            {{ t("catalog.compare.cta") }}
          </NuxtLink>
        </p>

      </section>


      <section class="section-block">
        <h2>{{ t("card.bonuses") }}</h2>
        <div v-if="!c.bonuses.length" class="empty">{{ t("home.offerFallback") }}</div>
        <div v-else class="grid-2">
          <PublicBonusCard
            v-for="b in c.bonuses.slice(0, 6)"
            :key="b.id"
            compact
            :title="b.title"
            :type="b.type"
            :wager="b.wager"
            :promo-code="b.promoCode"
            :description="b.description"
            :terms="b.terms"
            :image-url="b.imageUrl"
            :casino-slug="c.slug"
            :casino-name="c.name"
            :casino-logo-url="c.logoUrl"
          />
        </div>
        <p v-if="c.bonuses.length" class="all-bonuses">
          <NuxtLink :to="localePath('/bonuses')">
            {{ t("card.bonuses") }} ({{ c.bonuses.length }}) →
          </NuxtLink>
        </p>
      </section>

      <section id="reviews" class="section-block">
        <div class="reviews-head">
          <h2>{{ t("card.reviews") }}</h2>
          <p v-if="reviews.total" class="reviews-count">
            <NuxtLink :to="localePath(`/casino/${c.slug}/reviews`)">
              {{ t("card.reviewsCount", { n: reviews.total }) }}
            </NuxtLink>
          </p>
        </div>

        <ReviewCtaBanner @open="openReviewFlow" />

        <SkeletonReviewList v-if="reviewsPending && !reviews.items.length" :count="4" />
        <div v-else-if="!reviews.items.length" class="empty" style="margin-top: 12px">
          {{ t("card.reviewsEmpty") }}
        </div>
        <template v-else>
          <div class="reviews-list" :class="{ dim: reviewsPending }">
            <ReviewCard
              v-for="r in reviews.items"
              :key="r.id"
              :author-name="r.authorName"
              :author-rank="r.authorRank"
              :date-text="r.dateText"
              :rating="r.rating"
              :body="r.body"
              :reply-body="r.reply?.body"

            />

          </div>

          <nav v-if="reviews.pages > 1" class="pager" aria-label="reviews pagination">
            <UiButton
              variant="secondary"
              size="sm"
              type="button"
              :disabled="reviews.page <= 1 || reviewsPending"
              @click="goReviewPage(reviews.page - 1)"
            >
              {{ t("card.reviewsPrev") }}
            </UiButton>
            <span class="page-label">
              {{ t("card.reviewsPage", { page: reviews.page, pages: reviews.pages }) }}
            </span>
            <UiButton
              variant="secondary"
              size="sm"
              type="button"
              :disabled="reviews.page >= reviews.pages || reviewsPending"
              @click="goReviewPage(reviews.page + 1)"
            >
              {{ t("card.reviewsNext") }}
            </UiButton>
          </nav>
        </template>
      </section>
    </template>

    <ReviewFlowModal
      v-if="c"
      :open="reviewModal"
      :casino-slug="c.slug"
      :casino-name="c.name"
      @close="reviewModal = false"
      @published="onReviewPublished"
    />
  </div>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.crumbs a {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 650;
}
.crumbs a:hover {
  color: var(--accent-cta);
}
.mobile-only {
  display: none;
}
@media (max-width: 900px) {
  .mobile-only {
    display: inline-flex;
  }
  .crumbs {
    display: none;
  }
}
.all-bonuses {
  margin: 12px 0 0;
  font-size: 13px;
  font-weight: 750;
}
.stack {
  display: grid;
  gap: 12px;
}
.compare-line {
  margin: 12px 0 0;
  font-size: 13px;
  font-weight: 650;
}
.tag.link {
  text-decoration: none;
  color: inherit;
}
.tag.link:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
}

.reviews-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 4px;
}
.reviews-head h2 {
  margin: 0;
}
.reviews-count {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.reviews-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.reviews-list.dim {
  opacity: 0.55;
  pointer-events: none;
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.page-label {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 10ch;
  text-align: center;
}
.editorial .md-body {
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 15px;
}
.editorial .md-body :deep(h2),
.editorial .md-body :deep(h3) {
  color: var(--text-primary);
  font-family: var(--font-display);
  margin: 1.2em 0 0.45em;
}
.editorial .md-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 12px 0;
  border: 1px solid var(--border-default);
}
.editorial .md-body :deep(a) {
  color: var(--accent-cta);
}
</style>

