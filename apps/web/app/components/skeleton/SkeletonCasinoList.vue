<script setup lang="ts">
withDefaults(
  defineProps<{
    mode?: "list" | "grid";
    count?: number;
  }>(),
  { mode: "list", count: 6 },
);
</script>

<template>
  <div
    class="sk-root"
    :class="mode === 'grid' ? 'grid' : 'list'"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <div v-for="n in count" :key="n" class="item" :class="mode">
      <template v-if="mode === 'grid'">
        <UiSkeleton height="72px" width="72px" radius="14px" />
        <UiSkeleton height="18px" width="70%" radius="8px" />
        <UiSkeleton height="14px" width="40%" radius="8px" />
        <UiSkeleton height="36px" width="100%" radius="10px" />
        <div class="actions">
          <UiSkeleton height="34px" width="48%" radius="10px" />
          <UiSkeleton height="34px" width="40%" radius="10px" />
        </div>
      </template>
      <template v-else>
        <UiSkeleton class="rank" height="28px" width="28px" radius="8px" />
        <UiSkeleton height="56px" width="56px" radius="12px" />
        <div class="main">
          <UiSkeleton height="18px" width="42%" radius="8px" />
          <UiSkeleton height="14px" width="58%" radius="8px" />
          <UiSkeleton height="12px" width="36%" radius="8px" />
        </div>
        <div class="side">
          <UiSkeleton height="36px" width="88px" radius="10px" />
          <UiSkeleton height="36px" width="72px" radius="10px" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sk-root.list {
  display: grid;
  gap: 12px;
}
.sk-root.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.item.list {
  display: grid;
  grid-template-columns: 28px 56px 1fr auto;
  gap: 12px;
  align-items: center;
  min-height: 84px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
}
.item.grid {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
}
.main,
.side,
.actions {
  display: grid;
  gap: 8px;
}
.side {
  justify-items: end;
}
.actions {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 700px) {
  .item.list {
    grid-template-columns: 28px 48px 1fr;
  }
  .side {
    grid-column: 2 / -1;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
  }
}
</style>
