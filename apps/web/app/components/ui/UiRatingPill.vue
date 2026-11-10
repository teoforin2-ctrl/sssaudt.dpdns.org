<script setup lang="ts">
defineProps<{ value: number | string }>();
</script>

<template>
  <span class="pill">{{ typeof value === "number" ? value.toFixed(1) : value }}</span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-elev-3);
  border: 1px solid var(--border-default);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
}
</style>
