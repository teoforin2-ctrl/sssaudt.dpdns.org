<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    size?: "md" | "lg";
  }>(),
  { size: "md" },
);
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);

watch(
  () => props.open,
  (v) => {
    if (!import.meta.client) return;
    document.body.style.overflow = v ? "hidden" : "";
    if (v) nextTick(() => panel.value?.focus());
  },
);

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = "";
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown="onKey"
      @click.self="emit('close')"
    >
      <div ref="panel" class="modal" :class="size" tabindex="-1">
        <header v-if="title || $slots.header" class="head">
          <slot name="header">
            <h2>{{ title }}</h2>
          </slot>
          <button type="button" class="x" aria-label="Close" @click="emit('close')">×</button>
        </header>
        <div class="body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--bg-overlay);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: fade 0.18s var(--ease-out);
}
.modal {
  width: min(440px, 100%);
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  border-radius: 20px;
  box-shadow: var(--shadow-2);
  outline: none;
  animation: pop 0.2s var(--ease-out);
}
.modal.lg {
  width: min(640px, 100%);
}
.head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 0;
}
.head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: -0.02em;
}
.x {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}
.body {
  padding: 14px 18px 18px;
}
.foot {
  padding: 0 18px 18px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .overlay,
  .modal {
    animation: none;
  }
}
</style>
