<script setup lang="ts">
defineProps<{
  modelValue?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <input
    class="field"
    :id="id"
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.field {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
}
.field::placeholder {
  color: var(--text-tertiary);
}
.field:disabled {
  opacity: 0.55;
}
</style>
