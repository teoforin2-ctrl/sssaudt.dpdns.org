<script setup lang="ts">
const props = defineProps<{ name: string; kind?: string }>();
const letter = computed(() => props.name.trim().slice(0, 1).toUpperCase());
</script>

<template>
  <div class="logo" role="img" :aria-label="name" :data-kind="kind || 'brand'">
    <span>{{ letter }}</span>
  </div>
</template>

<style scoped>
.logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--bg-elev-3), var(--bg-elev-2));
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  flex-shrink: 0;
}
.logo span {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
}
.logo[data-kind="affiliate-program"] {
  border-radius: 50%;
}
.logo[data-kind="land-casino"] {
  border-radius: 12px;
}
</style>
