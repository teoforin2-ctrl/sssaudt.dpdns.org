<script setup lang="ts">
import type { Component } from 'vue'
import NumberFlow from '@number-flow/vue'
import { ArrowUpRight } from 'lucide-vue-next'

export interface KpiStripItem {
  label: string
  value: number
  total?: number | null
  to?: string
  icon?: Component
}

defineProps<{
  items: KpiStripItem[]
  ready?: boolean
}>()
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <NuxtLink
      v-for="(m, i) in items"
      :key="m.label"
      :to="m.to || '/admin'"
      class="group flex items-center gap-3 rounded-2xl border bg-card/60 px-4 py-3 transition-all"
      :class="[
        m.to ? 'hover:bg-card hover:shadow-md' : 'pointer-events-none',
        ready !== false ? 'animate-in fade-in slide-in-from-bottom-1' : 'opacity-0',
      ]"
      :style="{ animationDelay: `${320 + i * 50}ms`, animationFillMode: 'both' }"
    >
      <div class="grid size-9 place-items-center rounded-lg border bg-background text-muted-foreground transition-transform group-hover:scale-110">
        <component :is="m.icon" v-if="m.icon" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-muted-foreground">
          {{ m.label }}
        </p>
        <p class="text-lg font-semibold tabular-nums">
          <NumberFlow :value="ready !== false ? m.value : 0" locales="ru-RU" />
          <span v-if="m.total != null" class="ml-1 text-xs font-normal text-muted-foreground">
            / {{ m.total }}
          </span>
        </p>
      </div>
      <ArrowUpRight
        v-if="m.to"
        class="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      />
    </NuxtLink>
  </div>
</template>
