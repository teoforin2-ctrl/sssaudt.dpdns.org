<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "top" | "hot" | "new" | "rep" | "neutral";
  }>(),
  { tone: "neutral" },
);
</script>

<template>
  <span class="badge" :class="`badge-${tone}`">
    <svg
      v-if="tone === 'hot'"
      class="ico"
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.ico {
  flex-shrink: 0;
  display: block;
}
.badge-top {
  background: var(--accent-violet-soft);
  color: var(--accent-violet);
}
.badge-hot {
  background: var(--accent-gold-soft, var(--accent-amber-soft));
  color: var(--accent-gold);
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
