<script setup lang="ts">
withDefaults(defineProps<{
  tip: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}>(), {
  side: 'top',
})
</script>

<template>
  <TooltipProvider :delay-duration="280">
    <Tooltip>
      <TooltipTrigger as-child>
        <span class="inline-flex max-w-full">
          <slot />
        </span>
      </TooltipTrigger>
      <TooltipContent
        :side="side"
        class="max-w-[260px] text-left text-xs leading-snug"
      >
        <p>{{ tip }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
