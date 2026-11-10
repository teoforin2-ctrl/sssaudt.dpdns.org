<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: number;
    value?: number;
    interactive?: boolean;
    size?: "sm" | "md";
    /** Fill left→right once when entering viewport. */
    animate?: boolean;
  }>(),
  { modelValue: 0, value: undefined, interactive: false, size: "md", animate: false },
);

const emit = defineEmits<{ "update:modelValue": [number] }>();
const root = ref<HTMLElement | null>(null);
const lit = ref(!props.animate);

const display = computed(() =>
  props.interactive ? props.modelValue : (props.value ?? props.modelValue),
);

const full = computed(() => Math.max(0, Math.min(5, Math.round(Number(display.value) || 0))));

function pick(n: number) {
  if (!props.interactive) return;
  emit("update:modelValue", n);
}

let starsIo: IntersectionObserver | null = null;

onMounted(() => {
  if (!props.animate || !root.value || !import.meta.client) {
    lit.value = true;
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    lit.value = true;
    return;
  }
  const node = root.value as unknown as Element;
  starsIo = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting) return;
      lit.value = true;
      starsIo?.disconnect();
    },
    { threshold: 0.4 },
  );
  starsIo.observe(node);
});

onBeforeUnmount(() => {
  starsIo?.disconnect();
  starsIo = null;
});
</script>

<template>
  <div
    ref="root"
    class="stars"
    :class="[size, { interactive, lit: lit && animate, static: !animate }]"
    role="img"
    :aria-label="`${display} / 5`"
  >
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      class="star"
      :class="{ on: n <= full }"
      :style="animate ? { '--si': String(n - 1) } : undefined"
      :tabindex="interactive ? 0 : -1"
      :disabled="!interactive"
      @click="pick(n)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 2px;
  color: var(--accent-gold);
}
.star {
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  opacity: 0.22;
  line-height: 1;
  cursor: default;
}
.stars.static .star.on,
.stars.lit .star.on {
  opacity: 1;
}
.stars:not(.static):not(.lit) .star.on {
  opacity: 0.22;
}
@media (prefers-reduced-motion: no-preference) {
  .stars.lit .star.on {
    animation: starFill 0.4s var(--ease-out) both;
    animation-delay: calc(var(--si, 0) * 45ms);
  }
}
@keyframes starFill {
  from {
    opacity: 0.22;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.sm .star {
  font-size: 13px;
}
.md .star {
  font-size: 16px;
}
.interactive .star {
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  opacity: 1;
  color: var(--text-tertiary);
}
.interactive .star.on {
  background: rgba(240, 180, 41, 0.16);
  border-color: rgba(240, 180, 41, 0.4);
  color: var(--accent-gold);
}
</style>
