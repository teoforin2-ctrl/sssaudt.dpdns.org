<script setup lang="ts">
import { catIcon } from "~/data/nav-icons";

const { t } = useI18n();
const cards = [
  { key: "content", icon: catIcon("guides", 48) },
  { key: "reviews", icon: catIcon("reviews", 48) },
  { key: "team", icon: catIcon("academy", 48) },
  { key: "verify", icon: catIcon("verified", 48) },
];
</script>

<template>
  <div class="grid">
    <article v-for="c in cards" :key="c.key" class="card">
      <div class="head">
        <img :src="c.icon" alt="" width="36" height="36" loading="lazy" />
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
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
}
.head {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}
.card img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
}
h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
}
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
}
</style>
