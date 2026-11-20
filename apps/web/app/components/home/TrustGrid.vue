<script setup lang="ts">
import { BadgeCheck, BookOpenCheck, ShieldCheck, Users } from "lucide-vue-next";

const { t } = useI18n();

/** Lucide icons on green bubbles — redesign mock (Макет 3). */
const cards = [
  { key: "content", icon: BookOpenCheck },
  { key: "reviews", icon: Users },
  { key: "team", icon: BadgeCheck },
  { key: "verify", icon: ShieldCheck },
] as const;
</script>

<template>
  <div class="grid">
    <article v-for="c in cards" :key="c.key" class="card">
      <div class="head">
        <span class="icon-bubble" aria-hidden="true">
          <component :is="c.icon" :size="18" :stroke-width="2" />
        </span>
        <h3>{{ t(`home.trust.${c.key}`) }}</h3>
      </div>
      <p>{{ t(`home.trust.${c.key}Body`) }}</p>
    </article>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  height: 100%;
  min-height: 0;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  transition: border-color 0.2s ease;
}
.card:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 25%, transparent);
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-bubble {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--accent-cta);
  background: color-mix(in srgb, var(--accent-cta) 10%, transparent);
  transition: background 0.2s ease;
}
.card:hover .icon-bubble {
  background: color-mix(in srgb, var(--accent-cta) 16%, transparent);
}
h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
}
</style>
