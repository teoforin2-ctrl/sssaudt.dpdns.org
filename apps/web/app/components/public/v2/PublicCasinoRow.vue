<script setup lang="ts">
import { formatDate, formatWager, wagerTone } from "~/utils/format";

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
    displayRank?: number;
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

const place = computed(() => props.casino.displayRank ?? props.casino.rank);

const badges = computed(() => {
  const out: { tone: "top" | "hot" | "new" | "rep"; label: string }[] = [];
  if (props.casino.top) out.push({ tone: "top", label: t("home.top") });
  if (props.casino.hot) out.push({ tone: "hot", label: t("home.hot") });
  if (props.casino.hasRepresentative) out.push({ tone: "rep", label: t("card.rep") });
  if (props.casino.isNew) out.push({ tone: "new", label: t("home.new") });
  return out.slice(0, 2);
});

const editorial = computed(() =>
  (props.casino.editorialScore ?? props.casino.rating).toFixed(1),
);

const playersLabel = computed(() => {
  const n = props.casino.reviewCount ?? 0;
  if (n < 5 || props.casino.playerScore == null) return null;
  return t("home.row.players", { n, score: props.casino.playerScore.toFixed(1) });
});

const wager = computed(() => formatWager(props.casino.bonusWager));
const wagerToneVal = computed(() => wagerTone(props.casino.bonusWager));
const checkedLabel = computed(() => formatDate(props.casino.bonusCheckedAt, locale.value));
</script>

<template>
  <article
    class="row"
    :class="{ 'is-top': casino.top || place <= 3 }"
    data-track="row"
  >
    <div class="badge-rank" :class="rankClass(place)">{{ place }}</div>
    <NuxtLink class="logo-link" :to="localePath(`/casino/${casino.slug}`)">
      <CasinoLogo :name="casino.name" :src="casino.logoUrl" variant="v2" />
    </NuxtLink>
    <div class="main">
      <NuxtLink class="name" :to="localePath(`/casino/${casino.slug}`)">
        {{ displayName(casino.name) }}
      </NuxtLink>
      <div class="meta">
        <PublicBadge v-for="b in badges" :key="b.tone + b.label" :tone="b.tone">{{ b.label }}</PublicBadge>
        <UiRatingStars :value="casino.rating" size="sm" animate />
        <span class="score-pill tabular-nums">{{ casino.rating.toFixed(1) }}</span>
        <span class="rating-line">
          <span>{{ t("home.row.editorial", { score: editorial }) }}</span>
          <span v-if="playersLabel"> · {{ playersLabel }}</span>
        </span>
      </div>
    </div>
    <div class="offer">
      <strong v-if="casino.bonusLabel" class="bonus-title">{{ casino.bonusLabel }}</strong>
      <template v-else>{{ t("home.offerFallback") }}</template>
      <div v-if="wager || casino.bonusPromo" class="chips">
        <PublicBadge v-if="wager" :tone="`wager-${wagerToneVal || 'mid'}`">
          {{ t("catalog.wagerShort", { x: wager }) }}
        </PublicBadge>
        <PublicCopyChip v-if="casino.bonusPromo" :value="casino.bonusPromo" />
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
            <p class="note">{{ t("home.row.termsNote") }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="actions">
      <NuxtLink
        class="btn btn-ghost btn-sm"
        data-track="cta_review"
        :to="localePath(`/casino/${casino.slug}`)"
      >
        {{ t("home.review") }} →
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
.row {
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
    transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}
.row.is-top {
  border-color: color-mix(in srgb, var(--accent-amber) 35%, var(--border-default));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-amber) 18%, transparent);
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .row:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  }
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
.main {
  min-width: 0;
}
.name {
  display: inline-block;
  margin: 0 0 4px;
  font-weight: 750;
  font-size: 15px;
  color: var(--text-primary);
  text-decoration: none;
}
.name:hover {
  color: var(--accent-cta);
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}
.score-pill {
  font-weight: 800;
  font-size: 12px;
  color: var(--accent-gold);
}
.rating-line {
  font-size: 12px;
  color: var(--text-tertiary);
}
.offer {
  font-size: 13.5px;
  color: var(--text-secondary);
  min-width: 0;
}
.bonus-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 700;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  align-items: center;
}
.terms-btn {
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-cyan);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.terms-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease;
}
.terms-wrap.open {
  grid-template-rows: 1fr;
}
.terms-inner {
  overflow: hidden;
}
.terms {
  margin-top: 8px;
  padding: 10px;
  border-radius: 10px;
  background: var(--bg-elev-2);
  font-size: 12px;
  color: var(--text-secondary);
}
.terms p {
  margin: 0 0 6px;
}
.note {
  color: var(--text-tertiary) !important;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}
.actions .btn,
.actions :deep(.btn) {
  width: 100%;
  justify-content: center;
}
@media (max-width: 900px) {
  .row {
    grid-template-columns: 36px 48px minmax(0, 1fr);
  }
  .offer,
  .actions {
    grid-column: 1 / -1;
  }
  .actions {
    flex-direction: row;
    min-width: 0;
  }
}
</style>
