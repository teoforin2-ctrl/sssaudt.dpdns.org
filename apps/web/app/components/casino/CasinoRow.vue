<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const props = defineProps<{
  casino: {
    slug: string;
    name: string;
    logoUrl?: string | null;
    rating: number;
    editorialScore?: number;
    playerScore?: number | null;
    reviewCount?: number;
    hot?: boolean;
    top?: boolean;
    rank: number;
    hasRepresentative?: boolean;
    isNew?: boolean;
    bonusLabel?: string | null;
    bonusWager?: string | null;
    bonusPromo?: string | null;
    bonusCheckedAt?: string | null;
  };
}>();

const open = ref(false);

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

function rankClass(rank: number) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "";
}

const playersLabel = computed(() => {
  const n = props.casino.reviewCount ?? 0;
  if (n < 5 || props.casino.playerScore == null) return t("home.row.fewReviews");
  return t("home.row.players", { n, score: props.casino.playerScore.toFixed(1) });
});

const editorial = computed(() =>
  (props.casino.editorialScore ?? props.casino.rating).toFixed(1),
);

const checkedLabel = computed(() => {
  if (!props.casino.bonusCheckedAt) return null;
  const d = new Date(props.casino.bonusCheckedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale.value === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
});
</script>

<template>
  <article
    class="listing-row"
    :class="{ 'is-top': casino.top || casino.rank <= 5 }"
    data-track="row"
  >
    <div class="badge-rank" :class="rankClass(casino.rank)">{{ casino.rank }}</div>
    <NuxtLink class="logo-link" :to="localePath(`/casino/${casino.slug}`)">
      <CasinoLogo :name="casino.name" :src="casino.logoUrl" />
    </NuxtLink>
    <div class="main">
      <NuxtLink class="casino-name" :to="localePath(`/casino/${casino.slug}`)">
        {{ displayName(casino.name) }}
      </NuxtLink>
      <div class="casino-meta">
        <UiBadge v-if="casino.top" tone="top">{{ t("home.top") }}</UiBadge>
        <UiBadge v-if="casino.hot" tone="hot">{{ t("home.hot") }}</UiBadge>
        <UiBadge v-if="casino.isNew" tone="new">{{ t("home.new") }}</UiBadge>
        <UiBadge v-if="casino.hasRepresentative" tone="rep">{{ t("card.rep") }}</UiBadge>
        <UiRatingStars :value="casino.rating" size="sm" animate />
        <span class="rating-line">
          {{ t("home.row.editorial", { score: editorial }) }}
          ·
          {{ playersLabel }}
        </span>
      </div>
    </div>
    <div class="offer">
      <strong v-if="casino.bonusLabel">{{ casino.bonusLabel }}</strong>
      <template v-else>{{ t("home.offerFallback") }}</template>
      <div v-if="casino.bonusWager || casino.bonusPromo" class="chips">
        <span v-if="casino.bonusWager" class="chip">{{ t("home.row.wager", { x: casino.bonusWager }) }}</span>
        <span v-if="casino.bonusPromo" class="chip mono">{{ casino.bonusPromo }}</span>
      </div>
      <button
        v-if="casino.bonusLabel"
        type="button"
        class="terms-btn"
        data-track="row_expand"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ t("home.row.terms") }}
      </button>
      <div class="terms-wrap" :class="{ open }">
        <div class="terms-inner">
          <div class="terms">
            <p v-if="checkedLabel">{{ t("home.row.checked", { d: checkedLabel }) }}</p>
            <p v-if="casino.bonusPromo" class="promo-row">
              <code>{{ casino.bonusPromo }}</code>
              <UiCopyButton :value="casino.bonusPromo" />
            </p>
            <p class="note">{{ t("home.row.termsNote") }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="row-actions">
      <NuxtLink
        class="btn btn-ghost btn-sm review-link"
        data-track="cta_review"
        :to="localePath(`/casino/${casino.slug}`)"
      >
        {{ t("home.review") }}
        <span class="review-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <UiButton
        variant="primary"
        size="sm"
        data-track="cta_play"
        :href="`${config.public.apiBase}/go/${casino.slug}?locale=${locale}`"
        external
      >
        {{ t("home.play") }}
      </UiButton>
    </div>
  </article>
</template>

<style scoped>
.listing-row {
  display: grid;
  grid-template-columns: 40px 56px minmax(0, 1.2fr) minmax(0, 1fr) auto;
  gap: 12px 14px;
  align-items: center;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  position: relative;
  transition:
    transform var(--dur-fast, 0.16s) var(--ease-out),
    border-color var(--dur-fast, 0.16s) ease,
    box-shadow var(--dur-fast, 0.16s) ease;
}
.listing-row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 999px;
  background: var(--accent-cta);
  transform: scaleY(0);
  transform-origin: center;
  transition: transform var(--dur-fast, 0.16s) var(--ease-out);
}
.listing-row.is-top {
  border-color: color-mix(in srgb, var(--accent-amber) 35%, var(--border-default));
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .listing-row:hover {
    transform: translateY(-2px);
  }
  .listing-row:hover::before {
    transform: scaleY(1);
  }
  .listing-row:hover .review-arrow {
    transform: translateX(3px);
  }
}
.listing-row :deep(.btn:active),
.listing-row .review-link:active {
  transform: scale(0.98);
}
.main {
  min-width: 0;
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
.casino-name {
  display: inline-block;
  margin: 0 0 4px;
  font-weight: 750;
  font-size: 15px;
  color: var(--text-primary);
  text-decoration: none;
}
.casino-name:hover {
  color: var(--accent-cta);
}
.casino-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}
.rating-line {
  font-size: 12px;
  color: var(--text-tertiary);
}
.offer {
  min-width: 0;
}
.offer strong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.35;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.chip {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg-elev-3);
  color: var(--text-secondary);
}
.chip.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent-amber);
}
.terms-btn {
  margin-top: 8px;
  border: 0;
  background: none;
  padding: 0;
  color: var(--accent-cta);
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}
.terms-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dur, 0.22s) var(--ease-out);
}
.terms-wrap.open {
  grid-template-rows: 1fr;
}
.terms-inner {
  overflow: hidden;
  min-height: 0;
}
.terms {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
}
.terms p {
  margin: 0 0 6px;
}
.review-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.review-arrow {
  display: inline-block;
  transition: transform var(--dur-fast, 0.16s) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .listing-row,
  .listing-row::before,
  .terms-wrap,
  .review-arrow {
    transition: none;
  }
  .listing-row.glow::after {
    animation: none;
  }
}
.promo-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.promo-row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent-amber);
}
.note {
  color: var(--text-tertiary) !important;
}
.row-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 110px;
}
.glow .badge-rank.gold {
  box-shadow: var(--glow-cta);
}
@media (max-width: 900px) {
  .listing-row {
    grid-template-columns: 36px 48px minmax(0, 1fr);
    align-items: start;
  }
  .badge-rank {
    margin-top: 4px;
  }
  .logo-link {
    margin-top: 2px;
  }
  .casino-name {
    display: block;
    text-align: left;
  }
  .casino-meta {
    width: 100%;
  }
  .rating-line {
    flex: 1 1 100%;
  }
  .offer,
  .row-actions {
    grid-column: 1 / -1;
  }
  .row-actions {
    flex-direction: row;
  }
  .row-actions :deep(.btn),
  .row-actions a {
    flex: 1;
    justify-content: center;
  }
}
@media (max-width: 560px) {
  .listing-row {
    grid-template-columns: 32px 44px minmax(0, 1fr);
    gap: 10px;
    padding: 12px;
  }
}
</style>
