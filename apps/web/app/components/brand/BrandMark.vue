<script setup lang="ts">
withDefaults(
  defineProps<{
    /** header | footer | drawer */
    size?: "sm" | "md" | "lg"
  }>(),
  { size: "md" },
)

const { logoUrl, siteName } = useSiteSettings()
</script>

<template>
  <img
    class="mark"
    :class="size"
    :src="logoUrl"
    :alt="siteName"
    width="300"
    height="100"
    decoding="async"
  >
</template>

<style scoped>
.mark {
  display: block;
  width: auto;
  height: 40px;
  object-fit: contain;
  object-position: left center;
}
.mark.sm {
  height: 32px;
}
.mark.md {
  height: 44px;
}
.mark.lg {
  height: 56px;
}

@media (max-width: 900px) {
  .mark.md {
    height: 36px;
  }
}
</style>
