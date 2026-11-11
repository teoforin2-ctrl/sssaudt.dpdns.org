<script setup lang="ts">
withDefaults(
  defineProps<{
    items: string[];
    variant?: "check" | "number" | "dot";
  }>(),
  { variant: "check" },
);
</script>

<template>
  <ul class="list" :class="variant">
    <li v-for="(item, i) in items" :key="i">
      <span class="mark" aria-hidden="true">
        <template v-if="variant === 'number'">{{ i + 1 }}</template>
        <template v-else-if="variant === 'check'">✓</template>
        <template v-else>•</template>
      </span>
      <span>{{ item }}</span>
    </li>
  </ul>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.list li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
}
.mark {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  flex-shrink: 0;
}
.number .mark {
  border-radius: 10px;
  background: var(--bg-elev-3);
  color: var(--text-primary);
}
.dot .mark {
  background: transparent;
  color: var(--accent-cta);
  font-size: 18px;
  line-height: 1;
}
</style>
