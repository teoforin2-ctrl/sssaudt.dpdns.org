<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const { choice, read, accept } = useCookieConsent();
const ready = ref(false);

onMounted(() => {
  read();
  ready.value = true;
});
</script>

<template>
  <div v-if="ready && !choice" class="banner" role="dialog" :aria-label="t('cookies.title')">
    <div class="container inner">
      <div>
        <strong>{{ t("cookies.title") }}</strong>
        <p>
          {{ t("cookies.body") }}
          <NuxtLink class="policy" :to="localePath('/legal/cookies')">
            {{ t("cookies.policyLink") }}
          </NuxtLink>.
        </p>
      </div>
      <div class="actions">
        <UiButton variant="ghost" size="sm" type="button" @click="accept('necessary')">
          {{ t("cookies.necessary") }}
        </UiButton>
        <UiButton variant="primary" size="sm" type="button" @click="accept('all')">
          {{ t("cookies.accept") }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  padding: 14px 0 calc(14px + env(safe-area-inset-bottom, 0px));
  background: var(--bg-elev-1);
  border-top: 1px solid var(--border-default);
  box-shadow: var(--shadow-2);
}
.inner {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
strong {
  display: block;
  margin-bottom: 4px;
}
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 62ch;
}
.policy {
  font-weight: 650;
  text-underline-offset: 2px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 560px) {
  .inner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .actions {
    width: 100%;
  }
  .actions :deep(.btn) {
    flex: 1;
    min-height: 44px;
    justify-content: center;
  }
}
</style>
