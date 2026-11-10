<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 });
</script>

<template>
  <div class="card" role="status" aria-busy="true">
    <div v-for="n in count" :key="n" class="row">
      <UiSkeleton height="28px" width="28px" radius="8px" />
      <div class="body">
        <UiSkeleton height="16px" width="70%" radius="8px" />
        <UiSkeleton height="12px" width="45%" radius="8px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: grid;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  overflow: hidden;
}
.row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-top: 1px solid var(--border-subtle);
  min-height: 64px;
}
.row:first-child {
  border-top: 0;
}
.body {
  display: grid;
  gap: 8px;
}
</style>
