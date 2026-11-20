<script setup lang="ts">
defineProps<{
  eyebrow?: string | null;
  title: string;
  lead?: string | null;
  count?: string | null;
}>();
</script>

<template>
  <header class="hero">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="lead" class="lead">{{ lead }}</p>
    <p v-if="count" class="count tabular-nums">{{ count }}</p>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
    <div v-if="$slots.default" class="extra">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.hero {
  margin-bottom: 18px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--accent-cta);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.page-title {
  margin: 0 0 10px;
  text-wrap: balance;
  max-width: 22ch;
}
.lead {
  margin: 0;
  max-width: 62ch;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.55;
}
.count {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.extra {
  margin-top: 12px;
}
</style>
