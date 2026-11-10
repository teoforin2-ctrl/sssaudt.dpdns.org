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
</script>

<template>
  <div class="logo-tile" :class="size">
    <img
      v-if="src"
      :src="src"
      :alt="name"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      :width="px"
      :height="px"
    >
    <span v-else aria-hidden="true">{{ initials }}</span>
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
</style>
