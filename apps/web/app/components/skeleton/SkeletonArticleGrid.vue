<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 });
</script>

<template>
  <div class="grid" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="card">
      <UiSkeleton height="160px" width="100%" radius="14px" />
      <UiSkeleton height="12px" width="45%" radius="8px" />
      <UiSkeleton height="40px" width="90%" radius="8px" />
      <UiSkeleton height="48px" width="100%" radius="8px" />
      <UiSkeleton height="14px" width="30%" radius="8px" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
}
</style>
