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
  };
}>();

const SCORE_MAX = 5;

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

/** Max 2 badges — HOT preferred, then NEW; Representative → check by name. */
const badges = computed(() => {
  const out: { tone: "top" | "hot" | "new"; label: string }[] = [];
  if (props.casino.hot) out.push({ tone: "hot", label: t("home.hot") });
  else if (props.casino.top) out.push({ tone: "top", label: t("home.top") });
  if (props.casino.isNew && out.length < 2) out.push({ tone: "new", label: t("home.new") });
  return out.slice(0, 2);
});

const editorialScore = computed(() => props.casino.editorialScore ?? props.casino.rating);
const editorialPct = computed(() =>
  Math.min(100, Math.max(0, (editorialScore.value / SCORE_MAX) * 100)),
);
const playerScore = computed(() => props.casino.playerScore);
const playerPct = computed(() =>
  playerScore.value == null
    ? 0
    : Math.min(100, Math.max(0, (playerScore.value / SCORE_MAX) * 100)),
);
const showPlayers = computed(() => (props.casino.reviewCount ?? 0) >= 5 && playerScore.value != null);
</script>

<template>
  <article class="tile">
    <div class="head">
      <NuxtLink class="logo-link" :to="localePath(`/casino/${casino.slug}`)">
        <CasinoLogo :name="casino.name" :src="casino.logoUrl" />
      </NuxtLink>
      <div class="badges">
        <PublicBadge v-for="b in badges" :key="b.tone" :tone="b.tone">{{ b.label }}</PublicBadge>
      </div>
    </div>
    <h3>
      <NuxtLink class="name-link" :to="localePath(`/casino/${casino.slug}`)">
        {{ displayName(casino.name) }}
        <svg
          v-if="casino.hasRepresentative"
          class="verified"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :aria-label="t('card.rep')"
        >
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </NuxtLink>
    </h3>
    <div class="bars" aria-label="ratings">
      <div class="rbar">
        <div class="lbl">
          <span>{{ t("home.row.editorialShort") }}</span>
          <span class="val ed tabular-nums">{{ editorialScore.toFixed(1) }}<small>/5</small></span>
        </div>
        <div class="track">
          <UiRatingBarFill tone="ed" :pct="editorialPct" :index="0" />
        </div>
      </div>
      <div v-if="showPlayers" class="rbar">
        <div class="lbl">
          <span>{{ t("home.row.playersShort", { n: casino.reviewCount, score: playerScore!.toFixed(1) }) }}</span>
          <span class="val pl tabular-nums">{{ playerScore!.toFixed(1) }}<small>/5</small></span>
        </div>
        <div class="track">
          <UiRatingBarFill tone="pl" :pct="playerPct" :index="1" />
        </div>
      </div>
    </div>
    <p class="offer">{{ casino.bonusLabel || t("home.offerFallback") }}</p>
    <div class="actions">
      <a
        class="btn btn-primary btn-sm"
        :href="`${config.public.apiBase}/go/${casino.slug}?locale=${locale}`"
        rel="sponsored nofollow noopener"
        target="_blank"
      >
        {{ t("home.play") }}
      </a>
      <NuxtLink class="btn btn-ghost btn-sm review" :to="localePath(`/casino/${casino.slug}`)">
        {{ t("home.review") }}
      </NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.tile {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  transition:
    transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .tile:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  }
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
}
.name-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.verified {
  color: var(--accent-cta);
  flex-shrink: 0;
}
.bars {
  display: grid;
  gap: 6px;
}
.rbar .lbl {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 3px;
}
.rbar .val {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 12px;
}
.rbar .val small {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-left: 1px;
}
.rbar .val.ed { color: var(--accent-gold); }
.rbar .val.pl { color: var(--accent-amber); }
.track {
  height: 5px;
  border-radius: 999px;
  background: var(--bg-elev-3);
  overflow: hidden;
}
.offer {
  margin: 0;
  min-height: 2.6em;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.actions .btn {
  width: 100%;
  justify-content: center;
}
.review {
  color: var(--text-secondary) !important;
}
</style>
