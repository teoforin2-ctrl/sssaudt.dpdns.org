<script setup lang="ts">
import type { AdminHelpKey } from '~/constants/admin-help'

withDefaults(defineProps<{
  title: string
  description?: string
  eyebrow?: string
  live?: boolean
  help?: AdminHelpKey
}>(), {
  live: false,
})
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="space-y-1">
      <div
        v-if="eyebrow || live"
        class="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <span v-if="live" class="relative flex size-2">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span class="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        {{ eyebrow }}
      </div>
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ title }}
      </h1>
      <p v-if="description" class="max-w-2xl text-sm text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
      <AdminSectionHelp v-if="help" :section="help" />
      <slot />
    </div>
  </div>
</template>
