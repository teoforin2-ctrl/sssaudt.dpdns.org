<script setup lang="ts">
import type { AdminHelpKey } from '~/constants/admin-help'

defineProps<{
  title: string
  description?: string
  help?: AdminHelpKey
}>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ title }}
      </h1>
      <p v-if="description" class="max-w-2xl text-sm text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <AdminSectionHelp v-if="help" :section="help" />
      <slot />
    </div>
  </div>
</template>
