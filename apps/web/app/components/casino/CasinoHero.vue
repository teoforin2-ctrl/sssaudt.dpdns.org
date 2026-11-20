<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();

const props = defineProps<{
  casino: {
    slug: string;
    name: string;
    logoUrl?: string | null;
    shortDesc?: string | null;
    rating: number;
    editorialScore: number;
    playerScore: number | null;
    rank: number;
    hot?: boolean;
    top?: boolean;
    hasRepresentative?: boolean;
    promo?: { code: string; percent: number | null; title: string } | null;
  };
}>();

const emit = defineEmits<{ review: [] }>();

/** Final rating can exceed 5 slightly; ring uses 10 for headroom (admin max). */
const RING_MAX = 10;

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

function scorePct(score: number) {
  return Math.max(0, Math.min(100, (Number(score) / RING_MAX) * 100));
}

/** Cap visual badges at 2: rank always, then HOT (else skip rep badge — use check). */
const badges = computed(() => {
  const out: { tone: "top" | "hot"; label: string }[] = [
    { tone: "top", label: t("card.rank", { n: props.casino.rank }) },
  ];
  if (props.casino.hot) out.push({ tone: "hot", label: t("home.hot") });
  return out.slice(0, 2);
});
</script>

<template>
  <article class="card-hero">
    <div>
      <div class="card-hero-top">
        <CasinoLogo :name="casino.name" :src="casino.logoUrl" size="lg" eager />

        <div class="hero-main">
          <div class="casino-meta">
            <UiBadge v-for="b in badges" :key="b.tone + b.label" :tone="b.tone">{{ b.label }}</UiBadge>
            <span v-if="casino.hasRepresentative" class="rep-inline" :title="t('card.rep')">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {{ t("card.rep") }}
            </span>
          </div>
          <h1 class="page-title hero-title">{{ displayName(casino.name) }}</h1>
          <p v-if="casino.shortDesc" class="desc">{{ casino.shortDesc }}</p>
          <div class="btn-row">
            <UiButton
              variant="primary"
              :href="`${config.public.apiBase}/go/${casino.slug}?locale=${locale}`"
              external
            >
              {{ t("card.officialSite") }}
            </UiButton>
            <UiButton variant="secondary" type="button" @click="emit('review')">
              {{ t("card.reviewCta") }}
            </UiButton>
          </div>
        </div>
        <div
          class="score-ring"
          :style="{
            background: `conic-gradient(var(--accent-gold) 0 ${scorePct(casino.rating)}%, color-mix(in srgb, var(--text-primary) 12%, transparent) 0)`,
          }"
        >
          <div class="tabular-nums">{{ Number(casino.rating).toFixed(1) }}</div>
        </div>
      </div>
      <RatingBreakdown
        :editorial="casino.editorialScore"
        :players="casino.playerScore"
        :few-label="t('card.fewReviews')"
        :editorial-label="t('card.editorial')"
        :players-label="t('card.players')"
      />
    </div>
    <PromoCodeBlock
      v-if="casino.promo?.code"
      :code="casino.promo.code"
      :title="casino.promo.title"
      :percent="casino.promo.percent"
    />
    <div v-else class="promo-box">
      <UiBadge tone="hot">{{ t("home.hot") }}</UiBadge>
      <h3 class="promo-title">{{ t("home.offerFallback") }}</h3>
      <UiButton
        variant="primary"
        style="width: 100%; margin-top: 14px"
        :href="`${config.public.apiBase}/go/${casino.slug}?locale=${locale}`"
        external
      >
        {{ t("home.play") }}
      </UiButton>
    </div>
  </article>
</template>

<style scoped>
.hero-main {
  flex: 1;
  min-width: 0;
}
.casino-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rep-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 650;
  color: var(--accent-cta);
}
.hero-title {
  margin: 0 0 6px;
  font-size: clamp(28px, 4vw, 44px);
  max-width: 18ch;
}
.desc {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 48ch;
}
.promo-title {
  margin: 10px 0 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
}
.score-ring > div {
  color: var(--accent-gold);
}
@media (max-width: 560px) {
  .btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .btn-row :deep(.btn) {
    flex: 1 1 140px;
  }
}
</style>
