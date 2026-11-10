<script setup lang="ts">
defineProps<{
  code: string;
  title?: string;
  percent?: number | null;
  note?: string;
}>();
const { t } = useI18n();
</script>

<template>
  <div class="promo-box">
    <UiBadge tone="hot">PROMO</UiBadge>
    <h3 v-if="title" class="title">{{ title }}</h3>
    <p v-if="percent != null || note" class="sub">
      <template v-if="percent != null">{{ percent }}% · {{ t("card.promo") }}</template>
      <template v-else>{{ note || t("card.promo") }}</template>
    </p>
    <div class="promo-code">
      <code>{{ code }}</code>
      <UiCopyButton :value="code" />
    </div>
  </div>
</template>

<style scoped>
.title {
  margin: 10px 0 4px;
  font-size: 18px;
  font-family: var(--font-display);
  letter-spacing: -0.02em;
}
.sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
