<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "ghost" | "secondary" | "danger";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
    type?: "button" | "submit" | "reset";
    href?: string;
    external?: boolean;
  }>(),
  {
    variant: "primary",
    size: "md",
    loading: false,
    disabled: false,
    block: false,
    type: "button",
    external: false,
  },
);
</script>

<template>
  <a
    v-if="href"
    :href="href"
    class="btn"
    :class="[`btn-${variant}`, `btn-${size}`, { 'btn-block': block, 'is-loading': loading }]"
    :aria-disabled="disabled || loading || undefined"
    :rel="external ? 'sponsored nofollow noopener' : undefined"
    :target="external ? '_blank' : undefined"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </a>
  <button
    v-else
    class="btn"
    :class="[`btn-${variant}`, `btn-${size}`, { 'btn-block': block, 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none !important;
  transition:
    transform 0.15s var(--ease-out),
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  white-space: nowrap;
  user-select: none;
}
.btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}
.btn:disabled,
.btn[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
.btn-md {
  height: 44px;
  padding: 0 18px;
  font-size: 14px;
}
.btn-sm {
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  border-radius: 10px;
}
.btn-lg {
  height: 52px;
  padding: 0 22px;
  font-size: 15px;
}
.btn-block {
  width: 100%;
}
.btn-primary,
a.btn-primary {
  background: var(--accent-cta);
  color: var(--text-inverse) !important;
  box-shadow: var(--glow-cta);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-cta-hover);
}
.btn-secondary,
a.btn-secondary {
  background: var(--bg-elev-3);
  color: var(--text-primary) !important;
  border-color: var(--border-default);
}
.btn-ghost,
a.btn-ghost {
  background: transparent;
  color: var(--text-secondary) !important;
  border-color: var(--border-default);
}
.btn-ghost:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.btn-danger {
  background: var(--accent-rose-soft);
  color: var(--danger);
  border-color: rgba(255, 77, 109, 0.35);
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.is-loading {
  gap: 10px;
}
</style>
