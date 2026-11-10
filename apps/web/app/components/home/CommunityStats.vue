<script setup lang="ts">
const props = defineProps<{
  stats: {
    casinos: number;
    slots: number;
    providers: number;
    bonuses: number;
    reviews: number;
    articles: number;
  };
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const root = ref<HTMLElement | null>(null);
const shown = ref(false);

const items = computed(() => [
  { key: "casinos", n: props.stats.casinos, to: "/", icon: "/img/cats/cat-casinos.png" },
  { key: "slots", n: props.stats.slots, to: "/slots", icon: "/img/cats/cat-slots.png" },
  { key: "providers", n: props.stats.providers, to: "/slots/providers", icon: "/img/cats/cat-providers.png" },
  { key: "bonuses", n: props.stats.bonuses, to: "/bonuses", icon: "/img/cats/cat-bonus.png" },
  { key: "reviews", n: props.stats.reviews, to: "/", icon: "/img/cats/cat-reviews.png" },
  { key: "articles", n: props.stats.articles, to: "/articles", icon: "/img/cats/cat-articles.png" },
]);

const display = ref<Record<string, number>>({});

onMounted(() => {
  if (!root.value) return;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting || shown.value) return;
      shown.value = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (const it of items.value) {
        if (reduced) {
          display.value[it.key] = it.n;
          continue;
        }
        const start = performance.now();
        const end = it.n;
        const tick = (t0: number) => {
          const p = Math.min(1, (t0 - start) / 900);
          display.value[it.key] = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      io.disconnect();
    },
    { threshold: 0.25 },
  );
  io.observe(root.value as unknown as Element);
});
</script>

<template>
  <section ref="root" class="panel community">
    <div class="copy">
      <h2>{{ t("home.community.title") }}</h2>
      <p>{{ t("home.community.lead") }}</p>
      <QuickSearch />
      <slot />
    </div>
    <div class="grid">
      <NuxtLink v-for="it in items" :key="it.key" :to="localePath(it.to)" class="cell">
        <img :src="it.icon" alt="" width="36" height="36" loading="lazy" />
        <strong>{{ display[it.key] ?? 0 }}</strong>
        <span>{{ t(`home.community.${it.key}`) }}</span>
        <em>{{ t("home.community.open") }}</em>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.community {
  display: grid;
  grid-template-columns: 1.1fr 1.2fr;
  gap: 24px;
  padding: 22px;
  margin: 40px 0 0;
}
.copy h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: clamp(20px, 2vw, 26px);
}
.copy p {
  margin: 0 0 14px;
  color: var(--text-secondary);
  font-size: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.cell {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  text-decoration: none;
  color: var(--text-secondary);
}
.cell:hover {
  border-color: var(--border-strong);
  text-decoration: none;
}
.cell img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.cell strong {
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--text-primary);
}
.cell span {
  font-size: 12px;
  font-weight: 700;
}
.cell em {
  font-style: normal;
  font-size: 11px;
  color: var(--accent-cta);
  font-weight: 750;
}
@media (max-width: 900px) {
  .community {
    grid-template-columns: 1fr;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
