<script setup lang="ts">
const props = defineProps<{ value: string; label?: string; copiedLabel?: string }>();
const { t } = useI18n();
const { push } = useToast();
const done = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    done.value = true;
    push(props.copiedLabel || t("ui.copied"), "success");
    setTimeout(() => {
      done.value = false;
    }, 1400);
  } catch {
    push(t("ui.copyFail"), "danger");
  }
}
</script>

<template>
  <UiButton variant="secondary" size="sm" type="button" @click="copy">
    {{ done ? copiedLabel || t("ui.copied") : label || t("ui.copy") }}
  </UiButton>
</template>
