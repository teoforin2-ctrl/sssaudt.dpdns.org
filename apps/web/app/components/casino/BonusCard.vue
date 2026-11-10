<script setup lang="ts">
defineProps<{
  title: string;
  type?: string | null;
  amountOrPercent?: string | null;
  wager?: string | null;
  promoCode?: string | null;
  href?: string;
}>();
const { t } = useI18n();
</script>

<template>
  <div class="bonus-card">
    <div v-if="type" class="casino-meta" style="margin-bottom: 8px">
      <UiBadge tone="top">{{ type }}</UiBadge>
    </div>
    <h4>{{ title }}</h4>
    <p class="meta">
      <span v-if="amountOrPercent">{{ amountOrPercent }}</span>
      <span v-if="wager"> · Wager {{ wager }}</span>
      <span v-if="promoCode"> · {{ promoCode }}</span>
    </p>
    <UiButton v-if="href" variant="primary" size="sm" :href="href" external>
      {{ t("home.play") }}
    </UiButton>
  </div>
</template>

<style scoped>
.meta {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
