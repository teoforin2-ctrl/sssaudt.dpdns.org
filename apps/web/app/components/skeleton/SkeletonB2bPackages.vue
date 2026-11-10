<template>
  <div class="grid" role="status" aria-busy="true">
    <div v-for="n in 3" :key="n" class="card">
      <div class="head">
        <UiSkeleton height="20px" width="40%" radius="8px" />
        <UiSkeleton height="16px" width="28%" radius="8px" />
      </div>
      <UiSkeleton height="14px" width="80%" radius="8px" />
      <UiSkeleton height="14px" width="70%" radius="8px" />
      <UiSkeleton height="14px" width="65%" radius="8px" />
      <UiSkeleton height="14px" width="55%" radius="8px" />
      <UiSkeleton height="34px" width="45%" radius="10px" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  min-height: 220px;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
