<script setup lang="ts">
defineProps<{ href?: string }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="review-cta">
    <div>
      <h3>{{ t("card.reviewCtaTitle") }}</h3>
      <p>{{ t("card.reviewCtaBody") }}</p>
    </div>
    <UiButton v-if="href" variant="primary" :href="href">{{ t("card.reviewCta") }}</UiButton>
    <UiButton v-else variant="primary" type="button" @click="emit('open')">
      {{ t("card.reviewCta") }}
    </UiButton>
  </div>
</template>
