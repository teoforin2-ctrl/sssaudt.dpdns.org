<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

export type LinkItem = { to: string; label: string; primary?: boolean };

defineProps<{ links: LinkItem[] }>();
</script>

<template>
  <div class="row">
    <NuxtLink
      v-for="link in links"
      :key="link.to + link.label"
      :to="link.to"
      class="chip"
      :class="{ primary: link.primary }"
    >
      {{ link.label }}
      <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
    </NuxtLink>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-secondary);
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 700;
}
.chip:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.chip.primary {
  background: var(--accent-cta-soft);
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--accent-cta);
}
</style>
