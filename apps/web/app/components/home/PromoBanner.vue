<script setup lang="ts">
import { formatCountdown, getPromoCountdown } from "@x-reviewer/shared";

const props = defineProps<{
  promo: {
    id: string;
    title: string;
    validUntil?: string | null;
    casinoSlug?: string | null;
    casinoName?: string | null;
    logoUrl?: string | null;
  };
}>();

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const now = ref(Date.now());
const root = ref<HTMLElement | null>(null);
const artShift = ref({ x: 0, y: 0 });
const pulsing = ref(false);
const ctaHover = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let pulseTimer: ReturnType<typeof setInterval> | null = null;

const state = computed(() => getPromoCountdown(props.promo.validUntil || null, new Date(now.value)));

const label = computed(() => {
  const s = state.value;
  if (!s) return null;
  if (s.kind === "countdown") return t("home.promo.timeLeft", { t: formatCountdown(s.ms) });
  return t("home.promo.until", {
    d: s.date.toLocaleDateString(locale.value === "en" ? "en-GB" : "ru-RU"),
  });
});

function onMove(e: MouseEvent) {
  if (!import.meta.client) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = root.value;
  if (!el) return;
  const box = el.getBoundingClientRect();
  const nx = ((e.clientX - box.left) / box.width - 0.5) * 2;
  const ny = ((e.clientY - box.top) / box.height - 0.5) * 2;
  artShift.value = { x: nx * 6, y: ny * 6 };
}

function onLeave() {
  artShift.value = { x: 0, y: 0 };
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    pulseTimer = setInterval(() => {
      if (ctaHover.value) return;
      pulsing.value = true;
      window.setTimeout(() => {
        pulsing.value = false;
      }, 900);
    }, 8000);
  }
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (pulseTimer) clearInterval(pulseTimer);
});
</script>

<template>
  <section
    v-if="promo.casinoSlug"
    ref="root"
    class="promo"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <NuxtLink
      class="art"
      :to="localePath(`/casino/${promo.casinoSlug}`)"
      :style="{ transform: `translate(${artShift.x}px, ${artShift.y}px)` }"
      :aria-label="promo.casinoName || promo.title"
    >
      <CasinoLogo
        :name="promo.casinoName || promo.title"
        :src="promo.logoUrl"
        size="md"
      />
    </NuxtLink>
    <div class="copy">
      <p class="tag">{{ t("home.promo.partner") }}</p>
      <h2>
        <NuxtLink class="title-link" :to="localePath(`/casino/${promo.casinoSlug}`)">
          {{ promo.title }}
        </NuxtLink>
      </h2>
      <p v-if="label" class="time">{{ label }}</p>
    </div>
    <a
      class="btn btn-primary cta"
      :class="{ pulse: pulsing }"
      :href="`${config.public.apiBase}/go/${promo.casinoSlug}?locale=${locale}`"
      rel="sponsored nofollow noopener"
      target="_blank"
      data-track="promo_click"
      @mouseenter="ctaHover = true"
      @mouseleave="ctaHover = false"
      @focus="ctaHover = true"
      @blur="ctaHover = false"
    >
      {{ t("home.promo.go") }}
    </a>
  </section>
</template>

<style scoped>
.promo {
  margin: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px 14px;
  align-items: center;
  padding: 8px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.art {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-subtle);
  text-decoration: none;
  transition: transform var(--dur-fast, 0.16s) var(--ease-out);
  will-change: transform;
}
.art :deep(.logo-tile),
.art :deep(img) {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  object-fit: cover;
}
.tag {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 800;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(16px, 2vw, 22px);
}
.title-link {
  color: inherit;
  text-decoration: none;
}
.title-link:hover {
  color: var(--accent-cta);
}
.time {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cta {
  transition: box-shadow var(--dur, 0.22s) var(--ease-out);
}
.cta.pulse {
  animation: pulseOnce 0.9s var(--ease-out) 1;
}
@keyframes pulseOnce {
  0%,
  100% {
    box-shadow: var(--glow-cta);
  }
  50% {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-cta) 35%, transparent),
      0 0 36px color-mix(in srgb, var(--accent-cta) 28%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .art {
    transition: none;
  }
  .cta.pulse {
    animation: none;
  }
}
@media (max-width: 700px) {
  .promo {
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 10px 12px;
    padding: 4px 0;
  }
  .art {
    width: 56px;
    height: 56px;
  }
  .cta {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: center;
  }
}
</style>
