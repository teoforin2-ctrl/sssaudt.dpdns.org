<script setup lang="ts">
import { REWARD_WHEEL_SECTORS, formatRewardUsd } from "@x-reviewer/shared";

const props = defineProps<{
  amountUsd: number;
  spinning: boolean;
  done: boolean;
}>();

const emit = defineEmits<{ done: [] }>();

const sectors = REWARD_WHEEL_SECTORS;
const rotation = ref(0);
const reduced = ref(false);

onMounted(() => {
  if (!import.meta.client) return;
  reduced.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});

watch(
  () => props.spinning,
  (v) => {
    if (!v || props.done) return;
    const idx = sectors.findIndex((a) => a === props.amountUsd);
    const target = idx >= 0 ? idx : 0;
    const sectorAngle = 360 / sectors.length;
    // Center of target sector + full spins
    const turns = reduced.value ? 1 : 15;
    const final = turns * 360 + (360 - (target * sectorAngle + sectorAngle / 2));
    rotation.value = final;
    const ms = reduced.value ? 200 : 4200;
    window.setTimeout(() => emit("done"), ms);
  },
);
</script>

<template>
  <div class="wheel-wrap">
    <div class="pointer" aria-hidden="true" />
    <div
      class="wheel"
      :style="{ transform: `rotate(${rotation}deg)` }"
      :class="{ spinning }"
    >
      <div
        v-for="(amt, i) in sectors"
        :key="i"
        class="seg"
        :style="{
          transform: `rotate(${(360 / sectors.length) * i}deg)`,
          background: i % 2 === 0
            ? 'color-mix(in srgb, var(--accent-cta) 22%, var(--bg-elev-2))'
            : 'color-mix(in srgb, var(--accent-amber) 18%, var(--bg-elev-2))',
        }"
      >
        <span>{{ formatRewardUsd(amt) }}</span>
      </div>
    </div>
    <p v-if="done" class="result">{{ formatRewardUsd(amountUsd) }}</p>
  </div>
</template>

<style scoped>
.wheel-wrap {
  position: relative;
  width: min(260px, 100%);
  margin: 0 auto;
  aspect-ratio: 1;
}
.pointer {
  position: absolute;
  top: -6px;
  left: 50%;
  z-index: 2;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 16px solid var(--accent-cta);
  transform: translateX(-50%);
}
.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid var(--border-default);
  position: relative;
  overflow: hidden;
  transition: transform 4.2s cubic-bezier(0.12, 0.75, 0.12, 1);
  background: var(--bg-elev-2);
}
.wheel.spinning {
  /* transition set inline via rotation change */
}
.seg {
  position: absolute;
  inset: 0;
  clip-path: polygon(50% 50%, 50% 0%, 85% 6%);
  display: grid;
  place-items: start center;
  padding-top: 10%;
  font-size: 11px;
  font-weight: 700;
}
.result {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .wheel {
    transition-duration: 0.2s;
  }
}
</style>
