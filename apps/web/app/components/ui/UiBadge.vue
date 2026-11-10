<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "top" | "hot" | "new" | "rep" | "neutral";
  }>(),
  { tone: "neutral" },
);
</script>

<template>
  <span class="badge" :class="`badge-${tone}`"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.badge-top {
  background: var(--accent-violet-soft);
  color: var(--accent-violet);
}
.badge-hot {
  background: var(--accent-amber-soft);
  color: var(--accent-amber);
}
.badge-new {
  background: color-mix(in srgb, var(--accent-cyan) 14%, transparent);
  color: var(--accent-cyan);
}
.badge-rep {
  background: color-mix(in srgb, var(--accent-cyan) 14%, transparent);
  color: var(--accent-cyan);
}
.badge-neutral {
  background: var(--bg-elev-3);
  color: var(--text-secondary);
}
</style>
