<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string;
    src?: string | null;
    size?: "sm" | "md" | "lg";
    /** Prefer eager for above-the-fold / hero logos (LCP). */
    eager?: boolean;
  }>(),
  { size: "md", eager: false },
);

const px = computed(() => (props.size === "lg" ? 72 : props.size === "sm" ? 40 : 56));

const initials = computed(() =>
  props.name
    .replace(/^Онлайн-казино\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);

const { el, activeSrc } = useLazySrc(() => props.src, { eager: () => props.eager });
</script>

<template>
  <div ref="el" class="logo-tile" :class="size">
    <img
      v-if="activeSrc"
      :src="activeSrc"
      :alt="name"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'low'"
      decoding="async"
      :width="px"
      :height="px"
    >
    <span v-else-if="!src" aria-hidden="true">{{ initials }}</span>
    <span v-else class="logo-ph" aria-hidden="true" />
  </div>
</template>


<style scoped>
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
.logo-ph {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg-elev-2, #1a2330) 80%, transparent);
}
</style>
