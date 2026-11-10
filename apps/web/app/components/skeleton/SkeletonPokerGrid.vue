<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 });
</script>

<template>
  <div class="grid" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="card">
      <div class="head">
        <UiSkeleton height="22px" width="50%" radius="8px" />
        <UiSkeleton height="20px" width="48px" radius="999px" />
      </div>
      <UiSkeleton height="36px" width="90%" radius="8px" />
      <UiSkeleton height="14px" width="40%" radius="8px" />
      <div class="actions">
        <UiSkeleton height="34px" width="35%" radius="10px" />
        <UiSkeleton height="34px" width="30%" radius="10px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  min-height: 120px;
}
.head,
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
