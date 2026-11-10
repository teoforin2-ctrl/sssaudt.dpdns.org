<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    casinos: number;
    reviews: number;
    updatedLabel: string;
    /** Hide counters below this threshold (shared minToShow) */
    minToShow?: number;
    /** Vertical stack beside banner on desktop */
    stacked?: boolean;
  }>(),
  { stacked: false, minToShow: 1 },
);

const { t, locale } = useI18n();
const localePath = useLocalePath();

function fmt(n: number) {
  return new Intl.NumberFormat(locale.value === "en" ? "en-GB" : "ru-RU").format(n);
}

const showCasinos = computed(() => props.casinos >= (props.minToShow ?? 1));
const showReviews = computed(() => props.reviews >= (props.minToShow ?? 1));
</script>

<template>
  <div class="stats panel" :class="{ stacked }">
    <div v-if="showCasinos" class="stat" style="--i: 0">
      <p class="value">
        <span class="num">{{ fmt(casinos) }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{{ t("home.stats.casinos") }}</span>
      </p>
    </div>
    <div v-if="showReviews" class="stat" style="--i: 1">
      <p class="value">
        <span class="num">{{ fmt(reviews) }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{{ t("home.stats.reviews") }}</span>
      </p>
    </div>
    <div class="stat" style="--i: 2">
      <p class="value date">
        <span class="num">{{ updatedLabel }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{{ t("home.stats.updated") }}</span>
      </p>
    </div>
    <div class="stat" style="--i: 3">
      <p class="value">
        <NuxtLink class="num link" :to="localePath('/about')" data-track="hero_stat_author">
          {{ t("home.stats.authorValue") }}
        </NuxtLink>
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{{ t("home.stats.author") }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 40%),
    var(--bg-elev-1);
  box-shadow: var(--shadow-1);
}
.stats.stacked {
  grid-template-columns: 1fr;
  grid-template-rows: repeat(4, minmax(0, 1fr));
  height: 100%;
}
.stat {
  --glow: var(--accent-cta);
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 12px 14px;
  overflow: hidden;
}
.stat:nth-child(2) {
  --glow: var(--accent-amber);
}
.stat:nth-child(3) {
  --glow: var(--accent-cyan);
}
.stat:nth-child(4) {
  --glow: var(--accent-violet);
}
.stats:not(.stacked) .stat + .stat {
  border-left: 1px solid var(--border-subtle);
}
.stats.stacked .stat + .stat {
  border-top: 1px solid var(--border-subtle);
}
.stat::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: -20% -10% auto auto;
  width: 70%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--glow) 28%, transparent) 0%,
    color-mix(in srgb, var(--glow) 10%, transparent) 42%,
    transparent 72%
  );
  filter: blur(14px);
  pointer-events: none;
  opacity: 0.7;
}
html[data-theme="light"] .stat::before {
  opacity: 0.28;
  filter: blur(20px);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--glow) 18%, transparent) 0%,
    color-mix(in srgb, var(--glow) 6%, transparent) 45%,
    transparent 72%
  );
}
.value {
  position: relative;
  z-index: 1;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  color: var(--text-primary);
  line-height: 1.2;
}
.num {
  font-family: var(--font-display);
  font-size: clamp(16px, 1.4vw, 22px);
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.label {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.sep {
  color: var(--text-tertiary);
  opacity: 0.55;
  font-weight: 700;
}
.value.date .num {
  font-size: clamp(13px, 1.1vw, 16px);
  white-space: nowrap;
}
.link {
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent-cta) 45%, transparent);
  transition:
    color 0.15s var(--ease-out, ease),
    border-color 0.15s var(--ease-out, ease);
}
.link:hover {
  color: var(--accent-cta);
  border-bottom-color: var(--accent-cta);
  text-decoration: none;
}
@media (prefers-reduced-motion: no-preference) {
  .stats.stacked .stat {
    animation: statsIn 0.24s var(--ease-out, ease) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }
}
@keyframes statsIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 1024px) {
  .stats.stacked {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    height: auto;
  }
  .stats.stacked .stat {
    border-top: 0;
    animation: none;
  }
  .stats.stacked .stat:nth-child(odd) {
    border-right: 1px solid var(--border-subtle);
  }
  .stats.stacked .stat:nth-child(n + 3) {
    border-top: 1px solid var(--border-subtle);
  }
}
@media (max-width: 820px) {
  .stats,
  .stats.stacked {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    height: auto;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .stats.stacked .stat,
  .stats .stat {
    padding: 8px 0;
    border: 0 !important;
    animation: none;
  }
  .stats.stacked .stat + .stat,
  .stats .stat + .stat {
    border-top: 1px solid var(--border-subtle) !important;
  }
  .stat::before {
    display: none;
  }
  .value {
    flex-wrap: nowrap;
    align-items: baseline;
    gap: 8px;
  }
  .num {
    order: 0;
    font-size: clamp(18px, 5vw, 22px);
    min-width: 0;
  }
  .sep {
    order: 1;
  }
  .label {
    order: 2;
  }
  .value.date .num {
    font-size: clamp(15px, 4vw, 18px);
    white-space: nowrap;
  }
}
</style>
