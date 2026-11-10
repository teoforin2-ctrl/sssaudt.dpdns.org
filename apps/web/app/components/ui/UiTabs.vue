<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  items: { id: string; label: string }[];
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <div class="tabs" role="tablist">
    <button
      v-for="item in props.items"
      :key="item.id"
      type="button"
      role="tab"
      class="tab"
      :class="{ on: modelValue === item.id }"
      :aria-selected="modelValue === item.id"
      @click="emit('update:modelValue', item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-default);
  width: fit-content;
  flex-wrap: wrap;
}
.tab {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 650;
  font-size: 13px;
  cursor: pointer;
}
.tab.on {
  background: var(--bg-elev-1);
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
}
</style>
