<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  description?: string
  icon?: Component
  to?: string
  cta?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
    <div
      v-if="icon"
      class="mb-1 grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground"
    >
      <component :is="icon" class="size-5" />
    </div>
    <p class="text-sm font-medium text-foreground/80">
      {{ title }}
    </p>
    <p v-if="description" class="max-w-sm text-xs text-muted-foreground">
      {{ description }}
    </p>
    <Button
      v-if="to && cta"
      as-child
      size="sm"
      variant="outline"
      class="mt-2"
    >
      <NuxtLink :to="to">
        {{ cta }}
      </NuxtLink>
    </Button>
    <slot />
  </div>
</template>
