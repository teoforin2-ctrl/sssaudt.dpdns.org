<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 });
</script>

<template>
  <div class="wrap" role="status" aria-busy="true">
    <div class="head">
      <UiSkeleton height="22px" width="220px" radius="8px" />
      <UiSkeleton height="14px" width="90px" radius="8px" />
    </div>
    <div class="grid">
      <div v-for="n in count" :key="n" class="card">
        <div class="row">
          <UiSkeleton height="40px" width="40px" radius="10px" />
          <div class="meta">
            <UiSkeleton height="14px" width="55%" radius="8px" />
            <UiSkeleton height="12px" width="35%" radius="8px" />
          </div>
        </div>
        <UiSkeleton height="34px" width="90%" radius="8px" />
        <UiSkeleton height="14px" width="40%" radius="8px" />
        <div class="actions">
          <UiSkeleton height="34px" width="44%" radius="10px" />
          <UiSkeleton height="34px" width="36%" radius="10px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  margin-top: 56px;
  padding: 20px 18px;
  border-radius: 20px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-2);
}
.row {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 10px;
}
.meta,
.actions {
  display: grid;
  gap: 8px;
}
.actions {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 960px) {
  .grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
