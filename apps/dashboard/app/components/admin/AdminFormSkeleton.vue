<script setup lang="ts">
withDefaults(defineProps<{
  fields?: number
}>(), {
  fields: 6,
})
</script>

<template>
  <div class="grid max-w-3xl gap-4" role="status" aria-busy="true">
    <div v-for="n in fields" :key="n" class="grid gap-2 sm:grid-cols-2">
      <div class="grid gap-2">
        <Skeleton class="h-3 w-20" />
        <Skeleton class="h-9 w-full" />
      </div>
      <div class="grid gap-2">
        <Skeleton class="h-3 w-24" />
        <Skeleton class="h-9 w-full" />
      </div>
    </div>
    <Skeleton class="h-9 w-28" />
  </div>
</template>
