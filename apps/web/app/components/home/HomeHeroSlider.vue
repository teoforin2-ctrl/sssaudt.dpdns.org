<script setup lang="ts">
const { locale, t } = useI18n();
const localePath = useLocalePath();

type HeroBanner = {
  id: string;
  slug: string;
  title?: string | null;
  imageUrl: string;
  href?: string | null;
};

const props = defineProps<{ banners: HeroBanner[] }>();

const active = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
const INTERVAL_MS = 4000;

const current = computed(() => props.banners[active.value] || props.banners[0]);

function go(i: number) {
  if (!props.banners.length) return;
  active.value = ((i % props.banners.length) + props.banners.length) % props.banners.length;
  restart();
}

function start() {
  stop();
  if (props.banners.length < 2) return;
  timer = setInterval(() => {
    active.value = (active.value + 1) % props.banners.length;
  }, INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function restart() {
  start();
}

function bannerTo(href?: string | null) {
  if (!href || href === "#") return localePath("/");
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return localePath(href);
}

watch(
  () => props.banners.length,
  () => {
    active.value = 0;
    start();
  },
);

watch(locale, () => {
  active.value = 0;
  start();
});

// Preload only the active slide image (LCP) — not every banner in the set.
useHead(() => {
  const url = current.value?.imageUrl;
  if (!url) return {};
  return {
    link: [{ rel: "preload", as: "image", href: url, fetchpriority: "high" }],
  };
});

onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <section
    v-if="current"
    class="slider"
    aria-roledescription="carousel"
    :aria-label="t('home.slider.label')"
    @mouseenter="stop"
    @mouseleave="start"
    @focusin="stop"
    @focusout="start"
  >
    <NuxtLink
      class="slide"
      :to="bannerTo(current.href)"
      :aria-label="current.title || t('home.hero.bannerAlt')"
    >
      <img
        :key="`${current.id}-${locale}-${current.imageUrl}`"
        class="banner-img"
        :src="current.imageUrl"
        :alt="current.title || t('home.hero.bannerAlt')"
        width="1672"
        height="941"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
    </NuxtLink>

    <div v-if="banners.length > 1" class="controls">
      <div class="dots" role="tablist" :aria-label="t('home.slider.dots')">
        <button
          v-for="(b, i) in banners"
          :key="b.id"
          type="button"
          class="dot"
          role="tab"
          :class="{ on: i === active }"
          :aria-selected="i === active"
          :aria-label="b.title || b.slug"
          @click.prevent="go(i)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.slider {
  position: relative;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
  background: var(--bg-elev-2);
  box-shadow: var(--shadow-1);
}
.slide {
  display: block;
  line-height: 0;
  text-decoration: none;
}
.banner-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  aspect-ratio: 1672 / 941;
  object-fit: contain;
  object-position: center;
  display: block;
  /* no fade/transform — keep LCP clean */
}
.controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.dots {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elev-1) 72%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: auto;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 0;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0;
  transition:
    width 0.2s var(--ease, ease),
    background 0.2s var(--ease, ease);
}
.dot.on {
  width: 22px;
  background: var(--accent-cta);
  box-shadow: var(--glow-cta);
}
.dot:focus-visible {
  outline: 2px solid var(--accent-cta);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    transition: none;
  }
}
</style>
