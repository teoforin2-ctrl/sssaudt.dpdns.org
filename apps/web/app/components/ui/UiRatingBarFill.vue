<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 0–100 */
    pct: number
    tone?: "ed" | "pl"
    /** Stagger index for sibling bars */
    index?: number
  }>(),
  { tone: "ed", index: 0 },
)

const root = ref<HTMLElement | null>(null)
const inView = ref(false)
let io: IntersectionObserver | null = null

onMounted(() => {
  if (!import.meta.client || !root.value) {
    inView.value = true
    return
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduced) {
    inView.value = true
    return
  }
  const node = root.value as unknown as Element
  io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting) return
      inView.value = true
      io?.disconnect()
    },
    { threshold: 0.35, rootMargin: "0px 0px -6% 0px" },
  )
  io.observe(node)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

const safePct = computed(() => Math.min(100, Math.max(0, Number(props.pct) || 0)))
</script>

<template>
  <div
    ref="root"
    class="fill"
    :class="[tone, { in: inView }]"
    :style="{
      width: `${safePct}%`,
      '--bar-i': String(index),
    }"
  />
</template>

<style scoped>
.fill {
  height: 100%;
  border-radius: 999px;
  max-width: 100%;
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}
.fill.ed {
  background: var(--accent-gold);
}
.fill.pl {
  background: var(--accent-amber);
}
.fill.in {
  transform: scaleX(1);
}
@media (prefers-reduced-motion: no-preference) {
  .fill {
    transition: transform 0.7s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
    transition-delay: calc(var(--bar-i, 0) * 90ms);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fill {
    transform: none;
  }
}
</style>
