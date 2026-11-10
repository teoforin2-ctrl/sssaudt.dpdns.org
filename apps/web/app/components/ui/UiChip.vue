<script setup lang="ts">
withDefaults(defineProps<{ active?: boolean; disabled?: boolean }>(), {
  active: false,
  disabled: false,
});
</script>

<template>
  <button type="button" class="filter-chip" :class="{ on: active }" :disabled="disabled">
    <slot />
  </button>
</template>
