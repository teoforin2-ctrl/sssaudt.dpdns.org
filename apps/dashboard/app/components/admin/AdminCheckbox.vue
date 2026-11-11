<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  checked?: boolean
  disabled?: boolean
  id?: string
  class?: HTMLAttributes['class']
  labelClass?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()

const inputId = computed(() => props.id || `admin-cb-${useId()}`)

function onModelUpdate(v: boolean | 'indeterminate') {
  emit('update:checked', v === true)
}
</script>

<template>
  <div
    :class="cn(
      'inline-flex items-center gap-2 text-sm leading-none',
      disabled && 'cursor-not-allowed opacity-50',
      props.labelClass,
    )"
  >
    <!-- reka-ui Checkbox uses modelValue (not checked) -->
    <Checkbox
      :id="inputId"
      :model-value="checked === true"
      :disabled="disabled"
      :class="props.class"
      @update:model-value="onModelUpdate"
    />
    <Label
      v-if="$slots.default"
      :for="inputId"
      class="cursor-pointer font-normal text-foreground"
      :class="disabled ? 'pointer-events-none' : undefined"
    >
      <slot />
    </Label>
  </div>
</template>
