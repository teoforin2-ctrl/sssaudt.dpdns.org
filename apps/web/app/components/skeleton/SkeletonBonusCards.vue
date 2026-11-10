<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 });
</script>

<template>
  <div class="grid" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="card">
      <div class="head">
        <UiSkeleton height="48px" width="48px" radius="12px" />
        <div class="meta">
          <UiSkeleton height="14px" width="50%" radius="8px" />
          <UiSkeleton height="12px" width="35%" radius="8px" />
        </div>
      </div>
      <UiSkeleton height="40px" width="92%" radius="8px" />
      <UiSkeleton height="14px" width="60%" radius="8px" />
      <div class="actions">
        <UiSkeleton height="34px" width="30%" radius="10px" />
        <UiSkeleton height="34px" width="28%" radius="10px" />
        <UiSkeleton height="14px" width="28%" radius="8px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  min-height: 160px;
}
.head {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
}
.meta,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.meta {
  flex-direction: column;
  align-items: stretch;
}
</style>
