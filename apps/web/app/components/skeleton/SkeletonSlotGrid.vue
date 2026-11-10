<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 8 });
</script>

<template>
  <div class="grid" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="card">
      <UiSkeleton height="160px" width="100%" radius="14px" />
      <div class="meta">
        <UiSkeleton height="18px" width="18%" radius="999px" />
        <UiSkeleton height="14px" width="28%" radius="8px" />
      </div>
      <UiSkeleton height="18px" width="70%" radius="8px" />
      <UiSkeleton height="36px" width="100%" radius="8px" />
      <div class="actions">
        <UiSkeleton height="34px" width="40%" radius="10px" />
        <UiSkeleton height="34px" width="28px" radius="10px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
.meta,
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
