<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 4 });
</script>

<template>
  <div class="list" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="card">
      <div class="head">
        <UiSkeleton height="36px" width="36px" radius="999px" />
        <div class="meta">
          <UiSkeleton height="14px" width="35%" radius="8px" />
          <UiSkeleton height="12px" width="25%" radius="8px" />
        </div>
        <UiSkeleton height="16px" width="80px" radius="8px" />
      </div>
      <UiSkeleton height="48px" width="100%" radius="8px" />
    </div>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  min-height: 96px;
}
.head {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: center;
}
.meta {
  display: grid;
  gap: 6px;
}
</style>
