<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="strip">
    <div class="container inner">
      <span class="age">18+</span>
      <p>
        {{ t("age.strip") }}
        <NuxtLink :to="localePath('/legal/responsible-gambling')">{{ t("nav.responsible") }}</NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.strip {
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.18);
}
[data-theme="light"] .strip {
  background: rgba(15, 23, 42, 0.03);
}
.inner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding-block: 6px;
}
.age {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 22px;
  border-radius: 7px;
  border: 1px solid var(--border-default);
  font-size: 11px;
  font-weight: 800;
  color: var(--text-secondary);
}
p {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
a {
  color: var(--text-secondary);
  font-weight: 650;
}
</style>
