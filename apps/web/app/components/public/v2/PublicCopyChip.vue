<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";

const props = defineProps<{ value: string; label?: string }>();
const { t } = useI18n();
const { push } = useToast();
const done = ref(false);

async function copy() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.value);
    }
    else {
      const ta = document.createElement("textarea");
      ta.value = props.value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    done.value = true;
    push(t("ui.copied"), "success");
    setTimeout(() => {
      done.value = false;
    }, 1400);
  }
  catch {
    push(t("ui.copyFail"), "danger");
  }
}
</script>

<template>
  <button type="button" class="chip" :aria-label="label || t('ui.copy')" @click="copy">
    <code>{{ value }}</code>
    <span class="ico" aria-hidden="true">
      <Check v-if="done" :size="14" :stroke-width="2" />
      <Copy v-else :size="14" :stroke-width="2" />
    </span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent-amber) 55%, var(--border-default));
  background: var(--accent-amber-soft);
  color: var(--accent-amber);
  cursor: pointer;
  font: inherit;
}
.chip:hover {
  border-style: solid;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ico {
  display: grid;
  place-items: center;
  opacity: 0.85;
  flex-shrink: 0;
}
</style>
