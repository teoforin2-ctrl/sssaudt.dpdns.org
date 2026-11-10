<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const { t } = useI18n();
const localePath = useLocalePath();

const status = computed(() => Number(props.error?.statusCode) || 500);
const is404 = computed(() => status.value === 404);

const title = computed(() =>
  is404.value ? t("error.notFoundTitle") : t("error.serverTitle"),
);
const body = computed(() =>
  is404.value ? t("error.notFoundBody") : t("error.serverBody"),
);

useSeoMeta({
  title: () => title.value,
  robots: "noindex",
});

function goHome() {
  clearError({ redirect: localePath("/") });
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    clearError();
    window.history.back();
    return;
  }
  goHome();
}
</script>

<template>
  <div class="err-page">
    <div class="panel card">
      <p class="code">{{ t("error.code", { code: status }) }}</p>
      <h1>{{ title }}</h1>
      <p class="lead">{{ body }}</p>
      <div class="actions">
        <UiButton variant="primary" type="button" @click="goHome">
          {{ t("error.home") }}
        </UiButton>
        <UiButton variant="secondary" type="button" @click="goBack">
          {{ t("error.back") }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.err-page {
  min-height: 70vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.card {
  width: min(480px, 100%);
  padding: 28px 24px;
  text-align: center;
}
.code {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
h1 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 28px);
  letter-spacing: -0.02em;
}
.lead {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
.actions {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
</style>
