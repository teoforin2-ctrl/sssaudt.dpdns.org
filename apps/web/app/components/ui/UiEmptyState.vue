<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="empty panel">
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding: 32px 22px;
  text-align: center;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-default);
  background: color-mix(in srgb, var(--bg-elev-1) 88%, transparent);
}
h3 {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: -0.02em;
}
p {
  margin: 0 auto;
  max-width: 42ch;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
}
.actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
