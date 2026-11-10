<script setup lang="ts">
withDefaults(defineProps<{ height?: string; width?: string; radius?: string }>(), {
  height: "16px",
  width: "100%",
  radius: "10px",
});
</script>

<template>
  <div class="sk" :style="{ height, width, borderRadius: radius }" aria-hidden="true" />
</template>

<style scoped>
.sk {
  background: linear-gradient(
    90deg,
    var(--bg-elev-2),
    var(--bg-elev-3),
    var(--bg-elev-2)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
