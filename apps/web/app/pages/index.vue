<script setup lang="ts">
import { isFeatureEnabled } from "@x-reviewer/shared";

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { homeSections } = useSiteSettings();

/** Admin home_sections override shared feature flags when present. */
function sectionOn(key: string, featureFallback?: boolean) {
  const fromAdmin = homeSections.value?.[key];
  if (typeof fromAdmin === "boolean") return fromAdmin;
  return featureFallback !== false;
}

const flags = computed(() => ({
  heroStats: sectionOn("heroStats"),
  heroBanners: sectionOn("heroBanners"),
  listing: sectionOn("listing"),
  aside: sectionOn("aside"),
  communityStats: sectionOn("communityStats", isFeatureEnabled("communityStats")),
  slots: sectionOn("slots", isFeatureEnabled("slots")),
  promoBanner: sectionOn("promoBanner", isFeatureEnabled("promoBanner")),
  newSlots: sectionOn("newSlots", isFeatureEnabled("slots")),
  articles: sectionOn("articles", isFeatureEnabled("articles")),
  guides: sectionOn("guides", isFeatureEnabled("guides")),
  partnerBrands: sectionOn("partnerBrands", isFeatureEnabled("partnerBrands")),
  homeBonuses: sectionOn("homeBonuses"),
  homeForum: sectionOn("homeForum"),
  homeB2b: sectionOn("homeB2b"),
  expert: sectionOn("expert", isFeatureEnabled("expert")),
  trust: sectionOn("trust"),
  method: sectionOn("method"),
}));

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

type FilterKey = "all" | "top" | "hot" | "crypto" | "new";
type SortKey = "rating" | "new" | "reviews";
type ViewMode = "list" | "grid";
const filter = ref<FilterKey>("all");
const sort = ref<SortKey>("rating");
const viewMode = ref<ViewMode>("list");
const isMobileView = ref(false);
const visibleCount = ref(12);
const listQuery = ref("");
const pickOpen = ref(false);
const reviewOpen = ref(false);
const reviewTarget = ref<{ slug: string; name: string } | null>(null);
const { ensureGroup } = useRewardGroup();

function openReviewFor(c: { slug: string; name: string }) {
  ensureGroup();
  reviewTarget.value = { slug: c.slug, name: c.name };
  pickOpen.value = false;
  reviewOpen.value = true;
}
const filterStuck = ref(false);
const filterBar = ref<HTMLElement | null>(null);
const chipRow = ref<HTMLElement | null>(null);
const chipPill = ref({ left: 0, width: 0, ready: false });
const countDisplay = ref(0);

/** On mobile always list; desktop keeps user preference. */
const displayMode = computed<ViewMode>(() => (isMobileView.value ? "list" : viewMode.value));

function syncChipPill() {
  const row = chipRow.value;
  if (!row) return;
  const active = row.querySelector<HTMLElement>(".filter-chip.on");
  if (!active) return;
  const rowBox = row.getBoundingClientRect();
  const box = active.getBoundingClientRect();
  chipPill.value = {
    left: box.left - rowBox.left + row.scrollLeft,
    width: box.width,
    ready: true,
  };
}

function tweenCount(to: number) {
  if (!import.meta.client) {
    countDisplay.value = to;
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    countDisplay.value = to;
    return;
  }
  const from = countDisplay.value;
  const start = performance.now();
  const ms = 220;
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / ms);
    countDisplay.value = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

onMounted(() => {
  const mq = window.matchMedia("(max-width: 820px)");
  const syncMobile = () => {
    isMobileView.value = mq.matches;
    nextTick(syncChipPill);
  };
  syncMobile();
  mq.addEventListener("change", syncMobile);

  try {
    if (!mq.matches) {
      const saved = localStorage.getItem("casino-view-mode");
      if (saved === "list" || saved === "grid") viewMode.value = saved;
    }
  } catch {
    /* ignore */
  }
  const onScroll = () => {
    const el = filterBar.value;
    if (!el) return;
    filterStuck.value = el.getBoundingClientRect().top <= 64;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncChipPill, { passive: true });
  onScroll();
  nextTick(syncChipPill);

  const revealIo = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        revealIo.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
  );
  nextTick(() => {
    document.querySelectorAll(".home .home-band").forEach((n) => revealIo.observe(n));
  });

  onBeforeUnmount(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", syncChipPill);
    mq.removeEventListener("change", syncMobile);
    revealIo.disconnect();
  });
});

watch(filter, () => nextTick(syncChipPill));

watch(viewMode, (v) => {
  if (isMobileView.value) return;
  try {
    localStorage.setItem("casino-view-mode", v);
  } catch {
    /* ignore */
  }
});

watch([filter, sort, listQuery], () => {
  visibleCount.value = 12;
});

type HeroBanner = {
  id: string;
  slug: string;
  title?: string | null;
  imageUrl: string;
  href?: string | null;
};

// Parallel SSR fetches — sequential awaits previously inflated TTFB.
const [
  { data, error, pending, refresh },
  { data: bannersData, pending: bannersPending },
  { data: homeData, pending: homePending },
  { data: homeBonusesData, pending: homeBonusesPending },
  { data: homeForumData, pending: homeForumPending },
] = await Promise.all([
  // SSR: first page only — full catalog loads client-side for filters (T14 HTML weight).
  useAsyncData(
    () => `casinos-home-ssr-${locale.value}`,
    () =>
      $fetch<{ items: CasinoListItem[]; total?: number }>(`${config.public.apiBase}/v1/casinos`, {
        query: { locale: locale.value, limit: 36 },
      }),
    { watch: [locale] },
  ),
  useAsyncData(
    () => `banners-home-${locale.value}`,
    () =>
      $fetch<{ items: HeroBanner[] }>(`${config.public.apiBase}/v1/banners`, {
        query: { locale: locale.value, placement: "home_hero" },
      }),
    { watch: [locale] },
  ),
  useAsyncData(
    () => `home-${locale.value}`,
    () =>
      $fetch<Record<string, unknown>>(`${config.public.apiBase}/v1/home`, {
        query: { locale: locale.value },
      }),
    { watch: [locale] },
  ),
  // Below-fold: client-only to keep SSR HTML lean
  useAsyncData(
    () => `home-bonuses-${locale.value}`,
    () =>
      $fetch<{ items: any[] }>(`${config.public.apiBase}/v1/bonuses`, {
        query: { locale: locale.value, limit: 6 },
      }),
    { watch: [locale], server: false, lazy: true },
  ),
  useAsyncData(
    () => `home-forum-${locale.value}`,
    () =>
      $fetch<{ recent: any[] }>(`${config.public.apiBase}/v1/forum`, {
        query: { locale: locale.value },
      }),
    { watch: [locale], server: false, lazy: true },
  ),
]);

const { data: casinosFull } = await useAsyncData(
  () => `casinos-home-full-${locale.value}`,
  () =>
    $fetch<{ items: CasinoListItem[]; total?: number }>(`${config.public.apiBase}/v1/casinos`, {
      query: { locale: locale.value },
    }),
  { watch: [locale], server: false, lazy: true },
);

watch(locale, () => refresh());

const all = computed(() => casinosFull.value?.items ?? data.value?.items ?? []);
const banners = computed(() => bannersData.value?.items ?? []);

const items = computed(() => {
  let list = [...all.value];
  if (filter.value === "top") list = list.filter((c) => c.top);
  else if (filter.value === "hot") list = list.filter((c) => c.hot);
  else if (filter.value === "new") list = list.filter((c) => c.isNew || c.rank > Math.max(5, list.length - 8));
  else if (filter.value === "crypto") {
    list = list.filter((c) => /crypto|btc|usdt|bitcoin|крипто/i.test(c.bonusLabel || c.name));
  }
  const q = listQuery.value.trim().toLowerCase();
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.bonusLabel || "").toLowerCase().includes(q));

  if (sort.value === "new") list.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.rank - b.rank);
  else if (sort.value === "reviews") list.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
  else list.sort((a, b) => a.rank - b.rank);
  return list;
});

const visibleItems = computed(() => items.value.slice(0, visibleCount.value));

watch(
  () => items.value.length,
  (n) => tweenCount(n),
  { immediate: true },
);

/** Freeze "updated" label at SSR time — avoids hydration mismatch from `new Date()` on client. */
const updatedAtMs = useState<number>("home-updated-at", () => Date.now());
const updatedLabel = computed(() => {
  const d = new Date(updatedAtMs.value);
  return d.toLocaleDateString(locale.value === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
});

type HomeStatsShape = {
  casinos: number;
  slots: number;
  providers: number;
  bonuses: number;
  reviews: number;
  articles: number;
};

const home = computed(() => homeData.value || {});
const homeStats = computed<HomeStatsShape>(() => {
  const s = home.value.stats as Partial<HomeStatsShape> | undefined;
  return {
    casinos: s?.casinos ?? all.value.length,
    slots: s?.slots ?? 0,
    providers: s?.providers ?? 0,
    bonuses: s?.bonuses ?? 0,
    reviews: s?.reviews ?? 0,
    articles: s?.articles ?? 0,
  };
});
const homeSlots = computed(() => (home.value.slots as unknown[]) || []);
const homeNewSlots = computed(() => (home.value.newSlots as unknown[]) || []);
const homeArticles = computed(() => (home.value.articles as unknown[]) || []);
const homeNewbie = computed(() => (home.value.newbieTopics as unknown[]) || []);
const homeBrands = computed(() => (home.value.brands as Record<string, unknown[]>) || {});
const homeExpert = computed(() => home.value.expert as Record<string, unknown> | null);
const homePromo = computed(() => home.value.promo as Record<string, unknown> | null);
const recentReviews = computed(() => (home.value.recentReviews as any[]) || []);
const newCasinos = computed(() => (home.value.newCasinos as any[]) || []);
const homeBonusItems = computed(() => homeBonusesData.value?.items || []);
const homeForumTopics = computed(() => homeForumData.value?.recent || []);

const { pick: seoPick } = useSeoTemplate("home");

usePageSeo({
  title: () => seoPick("title", t("seo.listingTitle")),
  description: () => seoPick("description", t("seo.listingDesc")),
});

const homeH1 = computed(() => seoPick("h1", t("home.title")));
</script>



<template>
  <section class="home">
    <a class="skip" href="#listing">{{ t("home.skipToRanking") }}</a>

    <header class="intro">
      <div>
        <div class="intro-pills">
          <span class="pill pill-green">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            {{ t("home.eyebrow") }}
          </span>
          <span class="pill pill-plain">{{ t("home.stats.updated") }} · {{ updatedLabel }}</span>
        </div>
        <h1 class="page-title">{{ homeH1 }}</h1>
        <p class="lead">{{ t("home.lead") }}</p>
        <div class="intro-cta">
          <a class="btn btn-primary" href="#listing" data-track="hero_cta_top">
            {{ t("home.cta.top") }}
          </a>
          <NuxtLink
            class="btn btn-ghost"
            :to="localePath('/methodology')"
            data-track="hero_cta_method"
          >
            {{ t("home.cta.method") }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <div v-if="flags.heroStats || flags.heroBanners" class="hero-strip">
      <HomeStats
        v-if="flags.heroStats"
        class="hero-stats"
        stacked
        :casinos="homeStats.casinos || all.length"
        :reviews="homeStats.reviews"
        :updated-label="updatedLabel"
        :min-to-show="1"
      />
      <div v-if="flags.heroBanners" class="hero-banner">
        <HomeHeroSlider v-if="!bannersPending && banners.length" :banners="banners" />
        <UiSkeleton v-else-if="bannersPending" height="100%" radius="16px" class="banner-skel" />
      </div>
    </div>

    <div v-if="flags.listing || flags.aside" id="listing" class="listing-scope">
      <div v-if="flags.listing" class="listing-help">
        <p class="geo-hint" aria-live="polite">
          {{ t("home.geo.hint", { lang: t(`lang.${locale}`), currency: t("home.geo.currency") }) }}
        </p>
        <details class="rating-help">
          <summary>{{ t("home.method.help") }}</summary>
          <div class="rating-help-body">
            <p class="rating-help-lead">{{ t("home.method.helpLead") }}</p>
            <ul>
              <li>{{ t("home.method.helpEditorial") }}</li>
              <li>{{ t("home.method.helpPlayers") }}</li>
              <li>{{ t("home.method.helpHot") }}</li>
            </ul>
            <NuxtLink class="rating-help-link" :to="localePath('/methodology')">
              {{ t("home.method.helpLink") }}
            </NuxtLink>

          </div>
        </details>
      </div>
      <div
        v-if="flags.listing"
        ref="filterBar"
        class="filter-bar"
        :class="{ stuck: filterStuck }"
        data-track="filter_bar"
      >
        <div ref="chipRow" class="chip-row" role="group" :aria-label="t('home.filters.all')">
          <span
            class="chip-pill"
            :class="{ ready: chipPill.ready }"
            :style="{ transform: `translateX(${chipPill.left}px)`, width: `${chipPill.width}px` }"
            aria-hidden="true"
          />
          <UiChip
            :active="filter === 'all'"
            data-track="filter_chip"
            @click="filter = 'all'"
          >{{ t("home.filters.all") }}</UiChip>
          <UiChip :active="filter === 'top'" data-track="filter_chip" @click="filter = 'top'">{{ t("home.filters.top") }}</UiChip>
          <UiChip :active="filter === 'hot'" data-track="filter_chip" @click="filter = 'hot'">{{ t("home.filters.hot") }}</UiChip>
          <UiChip :active="filter === 'crypto'" data-track="filter_chip" @click="filter = 'crypto'">{{ t("home.filters.crypto") }}</UiChip>
          <UiChip :active="filter === 'new'" data-track="filter_chip" @click="filter = 'new'">{{ t("home.filters.new") }}</UiChip>
        </div>
        <div class="toolbar-right">
          <label class="sort">
            <span class="sr">{{ t("home.sort.label") }}</span>
            <UiSelect
              v-model="sort"
              size="sm"
              :block="false"
              data-track="sort_change"
              :options="[
                { value: 'rating', label: t('home.sort.rating') },
                { value: 'new', label: t('home.sort.new') },
                { value: 'reviews', label: t('home.sort.reviews') },
              ]"
            />
          </label>
          <label class="sr" for="home-list-q">{{ t("home.search.listPlaceholder") }}</label>
          <input
            id="home-list-q"
            v-model="listQuery"
            class="list-search"
            type="search"
            :placeholder="t('home.search.listPlaceholder')"
            data-track="search_open"
          >

          <p v-if="!pending && !error" class="count" aria-live="polite">{{ t("home.count", { n: countDisplay }) }}</p>
          <HomeViewToggle v-model="viewMode" class="view-toggle" data-track="view_toggle" />
        </div>
      </div>

      <div class="layout">
        <div v-if="flags.listing" class="center">
          <SkeletonCasinoList v-if="pending" :mode="displayMode" :count="6" />
          <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
            <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
          </UiEmptyState>
          <UiEmptyState v-else-if="!items.length" :title="t('nav.searchEmpty')" />
          <div v-else-if="displayMode === 'grid'" class="listing-grid">
            <CasinoTile v-for="c in visibleItems" :key="c.id" :casino="c" />
          </div>
          <div v-else class="listing">
            <PublicCasinoRow v-for="c in visibleItems" :key="c.id" :casino="c" />
          </div>
          <div v-if="!pending && !error && items.length" class="more-wrap">
            <UiButton
              v-if="visibleCount < items.length"
              variant="secondary"
              size="sm"
              type="button"
              @click="visibleCount += 12"
            >
              {{ t("home.showMore") }}
            </UiButton>
            <NuxtLink
              v-if="all.length > visibleCount"
              class="see-all"
              :to="localePath('/rating')"
            >
              {{ t("home.seeAllCasinos", { n: all.length }) }}
            </NuxtLink>
          </div>
        </div>

        <HomeAsideRight
          v-if="flags.aside"
          class="right"
          :reviews="recentReviews"
          :newcomers="newCasinos"
          @pick-casino="pickOpen = true"
        />
      </div>
    </div>

    <UiModal :open="pickOpen" :title="t('home.aside.pickCasino')" @close="pickOpen = false">
      <p class="pick-lead">{{ t("home.aside.pickHint") }}</p>
      <ul class="pick-list">
        <li v-for="c in all.slice(0, 12)" :key="c.id">
          <button type="button" class="pick-btn" @click="openReviewFor(c)">
            {{ c.name }}
          </button>
        </li>
      </ul>
      <NuxtLink class="see-all" :to="localePath('/rating')" @click="pickOpen = false">
        {{ t("home.seeAllCasinos", { n: all.length }) }}
      </NuxtLink>
    </UiModal>

    <ReviewFlowModal
      v-if="reviewTarget"
      :open="reviewOpen"
      :casino-slug="reviewTarget.slug"
      :casino-name="reviewTarget.name"
      @close="reviewOpen = false"
      @published="refresh"
    />

    <div class="home-stack cv-auto">
      <div v-if="flags.slots && (homePending || homeSlots.length)" class="home-band">
        <SkeletonSlotGrid v-if="homePending" :count="5" />
        <SlotsCarousel v-else :slots="homeSlots as any" />
      </div>

      <div v-if="flags.promoBanner && (homePending || homePromo)" class="home-band promo-band">
        <UiSkeleton v-if="homePending" height="72px" radius="12px" />
        <PromoBanner v-else-if="homePromo" :promo="homePromo as any" />
      </div>

      <div v-if="flags.newSlots && (homePending || homeNewSlots.length)" class="home-band">
        <SkeletonSlotGrid v-if="homePending" :count="5" />
        <NewSlotsRow v-else :slots="homeNewSlots as any" />
      </div>

      <div v-if="flags.homeBonuses && (homeBonusesPending || homeBonusItems.length)" class="home-band wash">
        <SkeletonBonusGrid v-if="homeBonusesPending" :count="6" />
        <HomeBonusesRow v-else :items="homeBonusItems as any" />
      </div>

      <div v-if="flags.articles && (homePending || homeArticles.length)" class="home-band">
        <SkeletonArticleGrid v-if="homePending" :count="4" />
        <ArticlesRow v-else :articles="homeArticles as any" />
      </div>
      <!-- <NewbieHub v-if="flags.guides && homeNewbie.length" :topics="homeNewbie as any" /> -->

      <div v-if="flags.homeForum && (homeForumPending || homeForumTopics.length)" class="home-band wash">
        <SkeletonForumList v-if="homeForumPending" :count="5" />
        <HomeForumTeaser v-else :topics="homeForumTopics as any" />
      </div>

      <div v-if="flags.homeB2b" class="home-band">
        <HomeB2bBanner />
      </div>

      <div v-if="flags.partnerBrands" class="home-band wash">
        <div class="brands-grid">
          <BrandListBlock
            :title="t('home.brands.poker')"
            :all-label="t('home.brands.allPoker')"
            all-to="/poker-rooms"
            kind="poker-room"
            :items="(homeBrands['poker-room'] || []) as any"
          />
          <BrandListBlock
            :title="t('home.brands.bookmakers')"
            :all-label="t('home.brands.allBookmakers')"
            all-to="/bookmakers"
            kind="bookmaker"
            :items="(homeBrands.bookmaker || []) as any"
          />
          <BrandListBlock
            :title="t('home.brands.land')"
            :all-label="t('home.brands.allLand')"
            all-to="/land-casinos"
            kind="land-casino"
            :items="(homeBrands['land-casino'] || []) as any"
          />
          <BrandListBlock
            :title="t('home.brands.affiliates')"
            :all-label="t('home.brands.allAffiliates')"
            all-to="/affiliate-programs"
            kind="affiliate-program"
            :items="(homeBrands['affiliate-program'] || []) as any"
          />
        </div>
      </div>

      <section v-if="flags.trust || flags.expert" class="home-band trust-sec">
        <div class="panel trust-band">
          <h2 class="trust-title">{{ t("home.trust.title") }}</h2>
          <div class="expert-row">
            <ExpertBlock v-if="flags.expert && homeExpert" :expert="homeExpert as any" />
            <TrustGrid v-if="flags.trust" />
          </div>
        </div>
      </section>

      <div v-if="flags.communityStats" class="home-band wash">
        <FactsStrip
          :stats="{
            casinos: homeStats.casinos || 0,
            slots: homeStats.slots || 0,
            reviews: homeStats.reviews || 0,
            bonuses: homeStats.bonuses || 0,
          }"
        />
      </div>

      <section v-if="flags.method" id="method" class="home-band bottom grid-2">
        <div class="panel block">
          <h2>{{ t("home.method.title") }}</h2>
          <p>{{ t("home.method.body") }}</p>
        </div>

        <div class="panel block">
          <h2>{{ t("home.disclosure.title") }}</h2>
          <p>
            {{ t("home.disclosure.body") }}
            <NuxtLink :to="localePath('/legal/affiliate-disclosure')">{{ t("legal.affiliate") }}</NuxtLink>
            ·
            <NuxtLink :to="localePath('/legal/responsible-gambling')">{{ t("nav.responsible") }}</NuxtLink>
          </p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.skip {
  position: absolute;
  left: -9999px;
}
.skip:focus {
  left: 16px;
  top: 16px;
  z-index: 80;
  padding: 8px 12px;
  background: var(--bg-elev-2);
  border-radius: 8px;
}
.intro {
  margin-bottom: 20px;
}
.intro-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.pill-green {
  border: 1px solid color-mix(in srgb, var(--accent-cta) 35%, transparent);
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  text-transform: uppercase;
}
.pill-plain {
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-secondary);
}
.lead {
  margin: 0;
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.6;
}
.intro-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.intro :deep(.page-title) {
  margin-top: 0;
}
.intro :deep(.eyebrow) {
  display: none;
}
.listing-scope {
  position: relative;
}
.listing-help {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 8px;
}
.geo-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}
.rating-help {
  position: relative;
  font-size: 13px;
}
.rating-help > summary {
  cursor: pointer;
  list-style: none;
  color: var(--text-secondary);
  font-weight: 650;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
}
.rating-help > summary::-webkit-details-marker {
  display: none;
}
.rating-help > summary:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.rating-help[open] > summary {
  border-color: var(--border-strong);
  color: var(--text-primary);
}
.rating-help-body {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: min(320px, 86vw);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  box-shadow: var(--shadow-1);
}
.rating-help-lead {
  margin: 0 0 8px;
  font-weight: 700;
  color: var(--text-primary);
}
.rating-help-body ul {
  margin: 0 0 10px;
  padding-left: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.45;
}
.rating-help-link {
  font-size: 12px;
  font-weight: 650;
  color: var(--accent-cta);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}
.filter-bar {
  position: sticky;
  top: var(--header-h, 64px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 16px;
  padding: 10px 0;
  background: transparent;
  transition:
    box-shadow 0.16s var(--ease-out, ease),
    background 0.16s ease,
    border-color 0.16s ease;
}
.filter-bar.stuck {
  background: color-mix(in srgb, var(--bg-canvas) 94%, var(--bg-elev-1));
  box-shadow: var(--shadow-1);
  border-bottom: 1px solid var(--border-subtle);
  backdrop-filter: blur(12px);
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sort {
  position: relative;
  min-width: 140px;
}
.list-search {
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  padding: 0 10px;
  width: min(200px, 40vw);
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.hero-strip {
  display: grid;
  grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  margin-bottom: 24px;
}
.hero-banner {
  min-width: 0;
}
.banner-skel {
  min-height: 200px;
}
.count {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}
.stack {
  display: grid;
  gap: 10px;
}
.listing {
  display: grid;
  gap: 10px;
}
.listing-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.more-wrap {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
}
.see-all {
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
.see-all:hover {
  text-decoration: underline;
}
.pick-lead {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
}
.pick-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: grid;
  gap: 6px;
}
.pick-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font: inherit;
  font-weight: 650;
  font-size: 13px;
  cursor: pointer;
}
.pick-btn:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
}
.chip-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.chip-pill {
  position: absolute;
  top: 0;
  left: 0;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--accent-cta-soft);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  pointer-events: none;
  opacity: 0;
  z-index: 0;
  transition:
    transform var(--dur, 0.22s) var(--ease-out),
    width var(--dur, 0.22s) var(--ease-out),
    opacity var(--dur-fast, 0.16s) ease;
}
.chip-pill.ready {
  opacity: 1;
}
.chip-row :deep(.filter-chip) {
  position: relative;
  z-index: 1;
  background: transparent;
}
.chip-row :deep(.filter-chip.on) {
  background: transparent;
  border-color: transparent;
  color: var(--accent-cta);
}
@media (prefers-reduced-motion: reduce) {
  .chip-pill {
    transition: none;
  }
}
.cv-auto {
  /* Avoid huge empty reserved height for crawlers/print (audit w2-cvis). */
  content-visibility: auto;
  contain-intrinsic-size: auto 320px;
}
.home-stack {

  display: flex;
  flex-direction: column;
}
.home-band {
  margin-top: 56px;
  content-visibility: auto;
  contain-intrinsic-size: auto 280px;
}
@media (prefers-reduced-motion: no-preference) {
  .home-band {
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity var(--dur-slow, 0.28s) var(--ease-out),
      transform var(--dur-slow, 0.28s) var(--ease-out);
  }
  .home-band.is-in {
    opacity: 1;
    transform: none;
  }
  .home-band.is-in :deep([data-reveal-child]) {
    opacity: 0;
    transform: translateY(10px);
    animation: homeChildIn var(--dur-slow, 0.28s) var(--ease-out) both;
    animation-delay: calc(var(--reveal-i, 0) * 40ms);
  }
}
@keyframes homeChildIn {
  to {
    opacity: 1;
    transform: none;
  }
}
.home-band:empty {
  display: none;
  margin: 0;
}
.home-band.promo-band {
  margin-top: 28px;
  contain-intrinsic-size: 120px;
}
.home-band.wash {
  position: relative;
  margin-top: 40px;
  padding-block: 40px;
}
.home-band.wash::before {
  content: "";
  position: absolute;
  inset: 0 -50vw;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--bg-base) 88%, var(--bg-canvas));
  border-top: 1px solid color-mix(in srgb, var(--border-subtle) 80%, transparent);
  pointer-events: none;
  z-index: 0;
}
.home-band.wash > * {
  position: relative;
  z-index: 1;
}
.home-band :deep(.sec),
.home-band :deep(.promo),
.home-band :deep(.brands-grid),
.home-band :deep(.facts),
.home-band :deep(.banner) {
  margin-top: 0;
}
.brands-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px 20px;
}
.trust-band {
  padding: 22px;
  display: grid;
  gap: 18px;
}
.trust-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 2.8vw, 28px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.expert-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 16px;
  align-items: stretch;
}
.expert-row > :deep(.expert),
.expert-row > :deep(.grid) {
  height: 100%;
  min-height: 0;
}
.block {
  padding: 18px;
}
.block h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 16px;
}
.block p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .right {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}
@media (max-width: 900px) {
  .brands-grid,
  .expert-row,
  .right {
    grid-template-columns: 1fr;
  }
  .listing-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 820px) {
  .home-band {
    margin-top: 36px;
    contain-intrinsic-size: 640px;
  }
  .home-band.wash {
    margin-top: 24px;
    padding-block: 28px;
  }
  .hero-strip {
    grid-template-columns: 1fr;
  }
  .hero-stats {
    display: block;
    max-width: 100%;
  }
  .right {
    display: none;
  }
  .filter-bar {
    position: static;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 0 0 8px;
    background: transparent;
    box-shadow: none;
    border: 0;
    backdrop-filter: none;
  }
  .chip-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    margin: 0 -4px;
    padding-inline: 4px;
    scrollbar-width: none;
  }
  .chip-row::-webkit-scrollbar {
    display: none;
  }
  .toolbar-right {
    width: 100%;
  }
  .toolbar-right .sort {
    flex: 1 1 140px;
    min-width: 0;
  }
  .list-search {
    flex: 1 1 140px;
    width: auto;
    min-width: 0;
  }
  .count {
    width: 100%;
    order: 5;
  }
  .view-toggle {
    display: none;
  }
  .listing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
