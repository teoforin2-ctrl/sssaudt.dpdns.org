<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "top" | "hot" | "new" | "partner" | "type" | "license" | "neutral" | "rep" | "wager-good" | "wager-mid" | "wager-high";
  }>(),
  { tone: "neutral" },
);
</script>

<template>
  <span class="badge" :class="`t-${tone}`"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.t-top {
  background: var(--accent-violet-soft);
  color: var(--accent-violet);
}
.t-hot {
  background: var(--accent-amber-soft);
  color: var(--accent-amber);
}
.t-new {
  background: color-mix(in srgb, var(--accent-cyan) 16%, transparent);
  color: var(--accent-cyan);
}
.t-partner,
.t-rep {
  background: color-mix(in srgb, var(--accent-cyan) 14%, transparent);
  color: var(--accent-cyan);
}
.t-type {
  background: var(--bg-elev-3);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.t-license {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.t-neutral {
  background: var(--bg-elev-3);
  color: var(--text-tertiary);
}
.t-wager-good {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.t-wager-mid {
  background: var(--accent-amber-soft);
  color: var(--accent-amber);
}
.t-wager-high {
  background: var(--accent-rose-soft);
  color: var(--accent-rose);
}
</style>
