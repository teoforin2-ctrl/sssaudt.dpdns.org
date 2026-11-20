<script setup lang="ts">
type TickerItem = {
  casino: string;
  code: string;
  offer?: string | null;
  slug: string;
};

const { locale, t } = useI18n();
const localePath = useLocalePath();
const config = useRuntimeConfig();

const { data } = await useAsyncData(
  () => `promo-ticker-${locale.value}`,
  () =>
    $fetch<{ items: TickerItem[] }>(`${config.public.apiBase}/v1/promo-ticker`, {
      query: { locale: locale.value, limit: 24 },
    }),
  { watch: [locale] },
);

const items = computed(() => data.value?.items ?? []);
const loop = computed(() => {
  const list = items.value;
  if (!list.length) return [];
  // Duplicate enough for a seamless marquee on wide screens.
  const times = list.length < 8 ? 4 : 2;
  return Array.from({ length: times }, () => list).flat();
});
</script>

<template>
  <div v-if="items.length" class="ticker" role="region" :aria-label="t('nav.promoCodes')">
    <div class="inner container">
      <NuxtLink class="chip" :to="localePath('/bonuses/codes')">
        {{ t("nav.promoCodes") }}
      </NuxtLink>
      <div class="track-wrap">
        <div class="track">
          <NuxtLink
            v-for="(it, i) in loop"
            :key="`${it.slug}-${i}`"
            class="item"
            :to="localePath(`/casino/${it.slug}`)"
          >
            <span class="name">{{ it.casino }}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span class="code">{{ it.code }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker {
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-elev-1) 70%, transparent);
  backdrop-filter: blur(8px);
}
.inner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding-block: 4px;
  overflow: hidden;
}
.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-decoration: none;
  white-space: nowrap;
}
.chip:hover {
  text-decoration: none;
  background: color-mix(in srgb, var(--accent-cta) 22%, transparent);
}
.track-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
}
.track {
  display: flex;
  width: max-content;
  gap: 22px;
  animation: ticker 55s linear infinite;
}
.track:hover {
  animation-play-state: paused;
}
.item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  white-space: nowrap;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 11px;
  font-weight: 650;
}
.item:hover {
  text-decoration: none;
  color: var(--text-primary);
}
.name {
  color: var(--text-primary);
  font-weight: 750;
}
.dot {
  color: var(--accent-cta);
  opacity: 0.85;
}
.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--accent-gold);
  font-weight: 700;
  letter-spacing: 0.02em;
}

@keyframes ticker {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .track {
    animation: none;
  }
}
</style>
