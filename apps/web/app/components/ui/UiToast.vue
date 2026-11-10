<script setup lang="ts">
const { toasts } = useToast();
</script>

<template>
  <div class="stack" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="item.tone">
      {{ item.message }}
    </div>
  </div>
</template>

<style scoped>
.stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 80;
  display: grid;
  gap: 8px;
  width: min(320px, calc(100vw - 32px));
}
.toast {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-2);
  font-size: 13px;
  font-weight: 650;
}
.toast.success {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, transparent);
  color: var(--accent-cta);
}
.toast.danger {
  border-color: rgba(255, 77, 109, 0.35);
  color: var(--danger);
}
</style>
