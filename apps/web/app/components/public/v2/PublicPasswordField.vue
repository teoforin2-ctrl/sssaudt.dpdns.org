<script setup lang="ts">
const model = defineModel<string>({ required: true });

const props = withDefaults(
  defineProps<{
    label: string;
    autocomplete?: string;
    minlength?: number;
    required?: boolean;
    hint?: string | null;
  }>(),
  { autocomplete: "current-password", required: true },
);

const { t } = useI18n();
const show = ref(false);
const caps = ref(false);

function onKey(e: KeyboardEvent) {
  caps.value = e.getModifierState?.("CapsLock") || false;
}
</script>

<template>
  <label class="field">
    <span>{{ label }}</span>
    <div class="wrap">
      <input
        v-model="model"
        :type="show ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :required="required"
        spellcheck="false"
        @keydown="onKey"
        @keyup="onKey"
      >
      <button type="button" class="tog" :aria-label="show ? 'Hide' : 'Show'" @click="show = !show">
        {{ show ? "🙈" : "👁" }}
      </button>
    </div>
    <small v-if="hint" class="hint">{{ hint }}</small>
    <small v-if="caps" class="caps">{{ t("auth.capsLock") || "Caps Lock on" }}</small>
  </label>
</template>

<style scoped>
.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.wrap {
  position: relative;
}
input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-canvas);
  color: var(--text-primary);
  padding: 0 44px 0 12px;
  font: inherit;
  font-size: 16px;
}
.tog {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}
.hint,
.caps {
  font-size: 12px;
  color: var(--text-tertiary);
}
.caps {
  color: var(--accent-amber);
}
</style>
