<script setup lang="ts">
const props = defineProps<{
  stats: { casinos: number; slots: number; reviews: number; bonuses: number };
}>();
const { t } = useI18n();
const root = ref<HTMLElement | null>(null);
const shown = ref(false);
const vals = ref({ casinos: 0, slots: 0, reviews: 0, bonuses: 0 });

onMounted(() => {
  if (!root.value) return;
  const io = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting || shown.value) return;
    shown.value = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keys = ["casinos", "slots", "reviews", "bonuses"] as const;
    for (const k of keys) {
      const end = props.stats[k];
      if (reduced) {
        vals.value[k] = end;
        continue;
      }
      const start = performance.now();
      const tick = (t0: number) => {
        const p = Math.min(1, (t0 - start) / 900);
        vals.value[k] = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    io.disconnect();
  });
  io.observe(root.value as unknown as Element);
});
</script>

<template>
  <section ref="root" class="facts">
    <h2>{{ t("home.facts.title") }}</h2>
    <div class="grid">
      <div>
        <strong>{{ vals.casinos }}</strong>
        <span>{{ t("home.facts.casinos") }}</span>
      </div>
      <div>
        <strong>{{ vals.slots }}</strong>
        <span>{{ t("home.facts.slots") }}</span>
      </div>
      <div>
        <strong>{{ vals.reviews }}</strong>
        <span>{{ t("home.facts.reviews") }}</span>
      </div>
      <div>
        <strong>{{ vals.bonuses }}</strong>
        <span>{{ t("home.facts.bonuses") }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.facts {
  margin-top: 56px;
  padding: 22px;
  border-radius: 18px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
h2 {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 22px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
strong {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
span {
  color: var(--text-secondary);
  font-size: 13px;
}
@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
