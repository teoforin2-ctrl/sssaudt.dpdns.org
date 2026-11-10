<script setup lang="ts">
defineProps<{
  editorial: number;
  players: number | null;
  fewLabel: string;
  editorialLabel: string;
  playersLabel: string;
}>();
</script>

<template>
  <div class="metric-grid">
    <div class="metric">
      <span>{{ editorialLabel }}</span>
      <b>{{ Number(editorial).toFixed(1) }}</b>
    </div>
    <div class="metric">
      <span>{{ playersLabel }}</span>
      <b>{{ players != null ? Number(players).toFixed(1) : fewLabel }}</b>
    </div>
  </div>
</template>
