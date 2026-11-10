<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  cols?: number
}>(), {
  rows: 8,
  cols: 4,
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border" role="status" aria-busy="true">
    <div class="space-y-0">
      <div
        v-for="r in rows"
        :key="r"
        class="flex items-center gap-3 border-b px-3 py-3 last:border-0"
      >
        <Skeleton
          v-for="c in cols"
          :key="c"
          class="h-4 flex-1"
          :class="c === 1 ? 'max-w-[40%]' : c === cols ? 'max-w-[96px] ml-auto' : 'max-w-[20%]'"
        />
      </div>
    </div>
  </div>
</template>
