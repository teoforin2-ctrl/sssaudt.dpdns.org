<script setup lang="ts">
withDefaults(defineProps<{
  count?: number
}>(), {
  count: 6,
})
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true">
    <div
      v-for="n in count"
      :key="n"
      class="rounded-xl border p-4 space-y-3"
    >
      <Skeleton class="h-4 w-1/2" />
      <Skeleton class="h-8 w-1/3" />
      <Skeleton class="h-3 w-2/3" />
    </div>
  </div>
</template>
