<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    maxLength?: number;
    minLength?: number;
    rows?: number;
    id?: string;
  }>(),
  { modelValue: "", rows: 5 },
);
defineEmits<{ "update:modelValue": [string] }>();
const count = computed(() => (props.modelValue || "").length);
</script>

<template>
  <div class="wrap">
    <textarea
      class="area"
      :id="id"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="maxLength"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div v-if="maxLength || minLength" class="counter">
      <span :class="{ bad: minLength && count < minLength }">{{ count }}</span>
      <template v-if="maxLength"> / {{ maxLength }}</template>
      <template v-else-if="minLength"> / {{ minLength }}+</template>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 6px;
}
.area {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  resize: vertical;
  min-height: 120px;
}
.counter {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}
.bad {
  color: var(--danger);
}
</style>
