<script setup lang="ts">
import { hashHue } from "~/utils/format";

const props = withDefaults(
  defineProps<{
    name: string;
    src?: string | null;
    size?: "sm" | "md" | "lg" | "xs";
    /** Prefer eager for above-the-fold / hero logos (LCP). */
    eager?: boolean;
    /** v2: deterministic gradient fallback (does not change default look). */
    variant?: "default" | "v2";
  }>(),
  { size: "md", eager: false, variant: "default" },
);

const px = computed(() =>
  props.size === "lg" ? 72 : props.size === "sm" ? 40 : props.size === "xs" ? 32 : 56,
);

const initials = computed(() =>
  props.name
    .replace(/^Онлайн-казино\s+/i, "")
    .replace(/^Online casino\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);

const gradientStyle = computed(() => {
  if (props.variant !== "v2") return undefined;
  const h = hashHue(props.name);
  return {
    background: `linear-gradient(145deg, hsl(${h} 42% 28%), hsl(${(h + 40) % 360} 48% 18%))`,
  };
});

const broken = ref(false);
watch(
  () => props.src,
  () => {
    broken.value = false;
  },
);

const { el, activeSrc } = useLazySrc(() => props.src, { eager: () => props.eager });
const showImg = computed(() => !!activeSrc.value && !broken.value);
</script>

<template>
  <div
    ref="el"
    class="logo-tile"
    :class="[size, { v2: variant === 'v2' }]"
    :style="!showImg ? gradientStyle : undefined"
  >
    <img
      v-if="showImg"
      :src="activeSrc!"
      :alt="name"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'low'"
      decoding="async"
      :width="px"
      :height="px"
      @error="broken = true"
    >
    <span v-else aria-hidden="true">{{ initials }}</span>
  </div>
</template>


<style scoped>
.logo-tile.xs {
  width: 32px;
  height: 32px;
  border-radius: 9px;
}
.logo-tile.sm {
  width: 40px;
  height: 40px;
  border-radius: 11px;
}
.logo-tile.md {
  width: 56px;
  height: 56px;
}
.logo-tile.lg {
  width: 72px;
  height: 72px;
  border-radius: 18px;
}
.logo-tile.v2 span {
  color: #f3f6fa;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
</style>
