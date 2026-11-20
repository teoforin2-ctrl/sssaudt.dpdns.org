<script setup lang="ts">
const props = withDefaults(
  defineProps<{ name: string; hue?: number; size?: number }>(),
  { hue: 168, size: 72 },
);
const initials = computed(() =>
  props.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);
</script>

<template>
  <div
    class="av"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      '--av-size': `${size}px`,
      background: `linear-gradient(145deg, hsl(${hue} 70% 48%), hsl(${hue} 55% 28%))`,
    }"
    role="img"
    :aria-label="name"
  >
    {{ initials }}
  </div>
</template>

<style scoped>
.av {
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: calc(var(--av-size, 72px) * 0.26);
  color: #fff;
  flex-shrink: 0;
}
</style>
