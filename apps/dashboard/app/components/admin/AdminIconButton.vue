<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    tooltip: string
    icon: Component
    to?: string
    variant?: 'ghost' | 'outline' | 'secondary' | 'default' | 'destructive'
    size?: 'icon-sm' | 'icon'
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'ghost',
    size: 'icon-sm',
    disabled: false,
  },
)

const emit = defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          v-if="to"
          as-child
          :variant="variant"
          :size="size"
          :disabled="disabled"
          :class="cn('text-muted-foreground', $props.class)"
        >
          <NuxtLink :to="to" :aria-label="tooltip">
            <component :is="icon" class="size-4" />
          </NuxtLink>
        </Button>
        <Button
          v-else
          type="button"
          :variant="variant"
          :size="size"
          :disabled="disabled"
          :aria-label="tooltip"
          :class="cn('text-muted-foreground', $props.class)"
          @click="emit('click', $event)"
        >
          <component :is="icon" class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ tooltip }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
