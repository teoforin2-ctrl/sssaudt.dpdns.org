<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number
    height?: string
    radius?: string
    gap?: string
  }>(),
  {
    count: 5,
    height: "84px",
    radius: "14px",
    gap: "12px",
  },
)
</script>

<template>
  <div class="stack" :style="{ gap }" role="status" aria-busy="true" aria-live="polite">
    <UiSkeleton v-for="n in count" :key="n" :height="height" :radius="radius" />
  </div>
</template>

<style scoped>
.stack {
  display: grid;
}
</style>
