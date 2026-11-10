<script setup lang="ts">
defineProps<{
  modelValue?: string;
  name: string;
  options: { value: string; label: string }[];
}>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <div class="group" role="radiogroup">
    <label v-for="opt in options" :key="opt.value" class="opt" :class="{ on: modelValue === opt.value }">
      <input
        type="radio"
        :name="name"
        :value="opt.value"
        :checked="modelValue === opt.value"
        @change="$emit('update:modelValue', opt.value)"
      />
      {{ opt.label }}
    </label>
  </div>
</template>

<style scoped>
.group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.opt {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.opt input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.opt.on {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  border-color: color-mix(in srgb, var(--accent-cta) 28%, transparent);
}
</style>
