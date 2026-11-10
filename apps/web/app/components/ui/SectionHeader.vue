<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
}>();
const localePath = useLocalePath();
</script>

<template>
  <div class="head">
    <div>
      <h2>{{ title }}</h2>
      <p v-if="subtitle" class="sub">{{ subtitle }}</p>
    </div>
    <div class="right">
      <slot name="actions" />
      <NuxtLink v-if="to" class="all" :to="localePath(to)">{{ linkLabel }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.head > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 2vw, 26px);
  letter-spacing: -0.02em;
}
.sub {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}
.all {
  font-size: 13px;
  font-weight: 750;
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
}
.all:hover {
  color: var(--accent-cta);
}
@media (max-width: 820px) {
  .head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .right {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
