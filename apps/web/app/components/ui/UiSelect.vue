<script setup lang="ts">
export type UiSelectOption = { value: string; label: string };

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: UiSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    size?: "sm" | "md";
    block?: boolean;
  }>(),
  { size: "md", block: true },
);

const emit = defineEmits<{ "update:modelValue": [string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const listId = useId();

const selected = computed(
  () => props.options.find((o) => o.value === props.modelValue) ?? null,
);

const label = computed(() => selected.value?.label || props.placeholder || "—");

function pick(value: string) {
  emit("update:modelValue", value);
  open.value = false;
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function onKey(e: KeyboardEvent) {
  if (props.disabled) return;
  if (e.key === "Escape") {
    open.value = false;
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggle();
  }
  if (!open.value) return;
  const idx = props.options.findIndex((o) => o.value === props.modelValue);
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = props.options[Math.min(idx + 1, props.options.length - 1)];
    if (next) emit("update:modelValue", next.value);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = props.options[Math.max(idx - 1, 0)];
    if (prev) emit("update:modelValue", prev.value);
  }
}

function onDoc(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener("click", onDoc));
onBeforeUnmount(() => document.removeEventListener("click", onDoc));
</script>

<template>
  <div
    ref="root"
    class="sel"
    :class="[`size-${size}`, { open, block, disabled }]"
  >
    <button
      :id="id"
      type="button"
      class="trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-required="required || undefined"
      @click="toggle"
      @keydown="onKey"
    >
      <span class="value" :class="{ placeholder: !selected }">{{ label }}</span>
      <svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>
    <ul v-if="open" :id="listId" class="menu" role="listbox">
      <li v-for="opt in options" :key="opt.value || '__empty'">
        <button
          type="button"
          class="opt"
          role="option"
          :aria-selected="opt.value === modelValue"
          :class="{ on: opt.value === modelValue }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sel {
  position: relative;
  display: inline-block;
  min-width: 0;
}
.sel.block {
  display: block;
  width: 100%;
}
.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 0 12px 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.size-sm .trigger {
  height: 36px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 13px;
}
.trigger:hover:not(:disabled) {
  border-color: var(--border-strong);
}
.sel.open .trigger {
  border-color: color-mix(in srgb, var(--accent-cta) 45%, var(--border-default));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-cta) 14%, transparent);
}
.trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.value.placeholder {
  color: var(--text-tertiary);
  font-weight: 600;
}
.chev {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}
.sel.open .chev {
  transform: rotate(180deg);
  color: var(--accent-cta);
}
.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  box-shadow: var(--shadow-2);
  max-height: min(280px, 50vh);
  overflow: auto;
  min-width: 100%;
  width: max-content;
  max-width: min(360px, 90vw);
}
.opt {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}
.opt:hover {
  background: var(--bg-elev-2);
}
.opt.on {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
</style>
