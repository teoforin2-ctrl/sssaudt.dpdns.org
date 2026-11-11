<script setup lang="ts">
import type { AdminStatCardProps } from './types'
import NumberFlow from '@number-flow/vue'

const props = withDefaults(defineProps<AdminStatCardProps>(), {
  tone: 'cyan',
  ready: true,
  index: 0,
  delta: null,
})

const deltaText = computed(() => {
  if (props.isNew)
    return 'новое'
  if (props.delta == null)
    return null
  const capped = Math.max(-999, Math.min(999, props.delta))
  const sign = capped > 0 ? '+' : ''
  const suffix = Math.abs(props.delta) > 999 ? '+' : ''
  return `${sign}${capped}${suffix}%`
})

const toneGlow: Record<string, string> = {
  cyan: 'bg-cyan-400',
  amber: 'bg-amber-400',
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  rose: 'bg-rose-400',
  neutral: 'bg-zinc-400',
}

const toneIcon: Record<string, string> = {
  cyan: 'text-cyan-600 dark:text-cyan-400',
  amber: 'text-amber-600 dark:text-amber-400',
  violet: 'text-violet-600 dark:text-violet-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-muted-foreground',
}

const cardClass = computed(() => [
  'group relative block overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300',
  props.to ? 'hover:-translate-y-0.5 hover:shadow-lg' : '',
  props.ready ? 'animate-in fade-in slide-in-from-bottom-2' : 'opacity-0',
])
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="cardClass"
    :style="{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }"
  >
    <div
      class="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
      :class="toneGlow[tone]"
    />
    <div class="flex items-start justify-between gap-3">
      <div class="grid size-10 place-items-center rounded-xl border bg-background/80 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        <component :is="icon" v-if="icon" class="size-5 transition-colors" :class="toneIcon[tone]" />
      </div>
      <Badge
        v-if="deltaText"
        variant="outline"
        class="tabular-nums"
        :class="isNew || (delta || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
        :title="isNew ? 'Появились данные относительно прошлого периода' : undefined"
      >
        {{ deltaText }}
      </Badge>
    </div>
    <p class="mt-4 text-sm font-medium text-foreground/70">
      {{ label }}
    </p>
    <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
      <NumberFlow :value="ready ? value : 0" locales="ru-RU" />
    </p>
    <p v-if="hint" class="mt-1 text-xs text-foreground/60">
      {{ hint }}
    </p>
    <slot />
  </NuxtLink>
  <div
    v-else
    :class="cardClass"
    :style="{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }"
  >
    <div
      class="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
      :class="toneGlow[tone]"
    />
    <div class="flex items-start justify-between gap-3">
      <div class="grid size-10 place-items-center rounded-xl border bg-background/80">
        <component :is="icon" v-if="icon" class="size-5" :class="toneIcon[tone]" />
      </div>
      <Badge
        v-if="deltaText"
        variant="outline"
        class="tabular-nums"
        :class="isNew || (delta || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
      >
        {{ deltaText }}
      </Badge>
    </div>
    <p class="mt-4 text-sm font-medium text-foreground/70">
      {{ label }}
    </p>
    <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
      <NumberFlow :value="ready ? value : 0" locales="ru-RU" />
    </p>
    <p v-if="hint" class="mt-1 text-xs text-foreground/60">
      {{ hint }}
    </p>
    <slot />
  </div>
</template>
