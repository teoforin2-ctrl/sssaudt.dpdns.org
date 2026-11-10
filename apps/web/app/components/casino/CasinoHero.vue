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

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

function scorePct(score: number) {
  return Math.max(0, Math.min(100, (Number(score) / 5) * 100));
}
</script>

<template>
  <article class="card-hero">
    <div>
      <div class="card-hero-top">
        <CasinoLogo :name="casino.name" :src="casino.logoUrl" size="lg" eager />

        <div style="flex: 1; min-width: 0">
          <div class="casino-meta" style="margin-bottom: 8px">
            <UiBadge tone="top">{{ t("card.rank", { n: casino.rank }) }}</UiBadge>
            <UiBadge v-if="casino.hot" tone="hot">{{ t("home.hot") }}</UiBadge>
            <UiBadge v-if="casino.hasRepresentative" tone="rep">{{ t("card.rep") }}</UiBadge>
          </div>
          <h1 class="title">{{ displayName(casino.name) }}</h1>
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
            background: `conic-gradient(var(--accent-cta) 0 ${scorePct(casino.rating)}%, color-mix(in srgb, var(--text-primary) 12%, transparent) 0)`,
          }"
        >
          <div>{{ Number(casino.rating).toFixed(1) }}</div>
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
      <UiBadge tone="hot">CTA</UiBadge>
      <h3 class="title" style="margin-top: 10px">{{ t("home.offerFallback") }}</h3>
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
.title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 28px);
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.desc {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 48ch;
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
