<script setup lang="ts">
const SCORE_MAX = 5;

const props = defineProps<{
  editorial: number;
  players: number | null;
  fewLabel: string;
  editorialLabel: string;
  playersLabel: string;
}>();

const editorialPct = computed(() =>
  Math.min(100, Math.max(0, (Number(props.editorial) / SCORE_MAX) * 100)),
);
const playersPct = computed(() =>
  props.players == null
    ? 0
    : Math.min(100, Math.max(0, (Number(props.players) / SCORE_MAX) * 100)),
);
</script>

<template>
  <div class="bars" aria-label="ratings">
    <div class="rbar">
      <div class="lbl">
        <span>{{ editorialLabel }}</span>
        <span class="val ed tabular-nums">{{ Number(editorial).toFixed(1) }}<small>/5</small></span>
      </div>
      <div class="track">
        <UiRatingBarFill tone="ed" :pct="editorialPct" :index="0" />
      </div>
    </div>
    <div class="rbar">
      <div class="lbl">
        <span>{{ playersLabel }}</span>
        <span v-if="players != null" class="val pl tabular-nums">
          {{ Number(players).toFixed(1) }}<small>/5</small>
        </span>
        <span v-else class="val muted">{{ fewLabel }}</span>
      </div>
      <div class="track">
        <UiRatingBarFill v-if="players != null" tone="pl" :pct="playersPct" :index="1" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bars {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}
.rbar .lbl {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.rbar .val {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
}
.rbar .val small {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-left: 1px;
}
.rbar .val.ed { color: var(--accent-gold); }
.rbar .val.pl { color: var(--accent-amber); }
.rbar .val.muted { color: var(--text-tertiary); font-weight: 650; font-size: 12px; }
.track {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-elev-3);
  overflow: hidden;
}
</style>
