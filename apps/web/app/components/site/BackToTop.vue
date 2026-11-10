<script setup lang="ts">
const { t } = useI18n();
const show = ref(false);

function onScroll() {
  show.value = window.scrollY > 1200;
}

function goTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <button
    type="button"
    class="top-btn"
    :class="{ show }"
    :aria-label="t('home.backToTop')"
    :tabindex="show ? 0 : -1"
    data-track="back_to_top"
    @click="goTop"
  >
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped>
.top-btn {
  position: fixed;
  right: 18px;
  bottom: 22px;
  z-index: 40;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elev-1) 92%, transparent);
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
  backdrop-filter: blur(10px);
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition:
    opacity var(--dur, 0.2s) var(--ease-out),
    transform var(--dur, 0.2s) var(--ease-out),
    border-color 0.15s ease,
    color 0.15s ease;
}
.top-btn.show {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.top-btn:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--accent-cta);
}
@media (prefers-reduced-motion: reduce) {
  .top-btn {
    transition: none;
    transform: none;
  }
}
</style>
