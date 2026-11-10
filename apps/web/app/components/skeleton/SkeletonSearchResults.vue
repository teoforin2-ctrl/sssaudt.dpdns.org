<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 4 });
</script>

<template>
  <div class="list" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="row">
      <UiSkeleton height="16px" width="42%" radius="8px" />
      <UiSkeleton height="12px" width="72%" radius="8px" />
    </div>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: 10px;
}
.row {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  min-height: 64px;
}
</style>
