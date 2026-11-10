<script setup lang="ts">
const model = defineModel<"list" | "grid">({ required: true });
const { t } = useI18n();
</script>

<template>
  <div class="tog" role="group" :aria-label="t('home.view.label')">
    <button
      type="button"
      class="btn"
      :class="{ on: model === 'list' }"
      :aria-pressed="model === 'list'"
      @click="model = 'list'"
    >
      {{ t("home.view.list") }}
    </button>
    <button
      type="button"
      class="btn"
      :class="{ on: model === 'grid' }"
      :aria-pressed="model === 'grid'"
      @click="model = 'grid'"
    >
      {{ t("home.view.grid") }}
    </button>
  </div>
</template>

<style scoped>
.tog {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.btn {
  position: relative;
  z-index: 1;
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
  transition: color var(--dur-fast, 0.16s) ease;
}
.btn.on {
  color: var(--accent-cta);
}
.btn.on::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: var(--accent-cta-soft);
  z-index: -1;
  transition: inset var(--dur, 0.22s) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn.on::before {
    transition: none;
  }
}
</style>
