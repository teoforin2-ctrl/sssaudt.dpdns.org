<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 5 });
</script>

<template>
  <div class="wrap" role="status" aria-busy="true">
    <div class="head">
      <div>
        <UiSkeleton height="12px" width="90px" radius="6px" />
        <UiSkeleton height="22px" width="180px" radius="8px" style="margin-top: 8px" />
      </div>
      <UiSkeleton height="14px" width="120px" radius="8px" />
    </div>
    <div class="list">
      <div v-for="n in count" :key="n" class="row">
        <div class="body">
          <UiSkeleton height="16px" width="78%" radius="8px" />
          <UiSkeleton height="12px" width="48%" radius="8px" />
        </div>
        <UiSkeleton height="16px" width="16px" radius="6px" />
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
  gap: 12px;
  margin-bottom: 14px;
}
.list {
  display: grid;
  gap: 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-2);
}
.body {
  flex: 1;
  display: grid;
  gap: 8px;
}
</style>
