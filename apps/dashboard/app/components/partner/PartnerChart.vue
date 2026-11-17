<script setup lang="ts">
const props = defineProps<{
  points: Array<{ x: number, y: number, label?: string }>
  color?: string
  invertY?: boolean
  yMin?: number
  yMax?: number
  emptyText?: string
}>()

const w = 640
const h = 180
const pad = 16

const path = computed(() => {
  if (props.points.length < 1)
    return ''
  const ys = props.points.map(p => p.y)
  const minY = props.yMin ?? Math.min(...ys)
  const maxY = props.yMax ?? Math.max(...ys)
  const span = maxY - minY || 1
  const n = props.points.length
  const coords = props.points.map((p, i) => {
    const x = pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2))
    const t = (p.y - minY) / span
    const y = props.invertY
      ? pad + t * (h - pad * 2)
      : h - pad - t * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M ${coords.join(' L ')}`
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-muted/20 p-3">
    <p
      v-if="!points.length"
      class="py-10 text-center text-sm text-muted-foreground"
    >
      {{ emptyText || 'Пока нет истории оценок' }}
    </p>
    <svg
      v-else
      viewBox="0 0 640 180"
      class="h-44 w-full"
      role="img"
    >
      <path
        :d="path"
        fill="none"
        :stroke="color || '#3dd6c6'"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>
