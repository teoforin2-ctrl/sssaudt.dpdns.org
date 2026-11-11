<script setup lang="ts">
export type StatItem = { label: string; value: string | number; href?: string };

defineProps<{ items: StatItem[] }>();
</script>

<template>
  <div v-if="items.length" class="strip" role="list">
    <NuxtLink
      v-for="(item, i) in items.filter((x) => x.href)"
      :key="`l-${i}`"
      class="chip"
      role="listitem"
      :to="item.href!"
    >
      <strong class="tabular-nums">{{ item.value }}</strong>
      <span>{{ item.label }}</span>
    </NuxtLink>
    <div
      v-for="(item, i) in items.filter((x) => !x.href)"
      :key="`d-${i}`"
      class="chip"
      role="listitem"
    >
      <strong class="tabular-nums">{{ item.value }}</strong>
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  text-decoration: none !important;
  color: inherit;
  font-size: 12px;
}
.chip strong {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
}
.chip span {
  color: var(--text-tertiary);
}
</style>
