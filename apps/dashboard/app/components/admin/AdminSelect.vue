<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

export interface AdminSelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  options: AdminSelectOption[]
  placeholder?: string
  disabled?: boolean
  /** Coerce model to number on update (e.g. days filter). */
  number?: boolean
  class?: HTMLAttributes['class']
  triggerClass?: HTMLAttributes['class']
  size?: 'sm' | 'default'
}>(), {
  placeholder: 'Выбрать…',
  size: 'default',
})

const model = defineModel<string | number | null>({ default: '' })

const emptyValue = '__empty__'

const internal = computed({
  get() {
    const v = model.value
    if (v === '' || v === null || v === undefined)
      return emptyValue
    return String(v)
  },
  set(v: string) {
    if (v === emptyValue) {
      model.value = props.number ? null : ''
      return
    }
    model.value = props.number ? Number(v) : v
  },
})

const items = computed(() =>
  props.options.map(opt => ({
    ...opt,
    value: opt.value === '' ? emptyValue : opt.value,
  })),
)
</script>

<template>
  <Select v-model="internal" :disabled="disabled">
    <SelectTrigger
      :size="size"
      :class="cn('w-full min-w-[8rem]', props.class, props.triggerClass)"
    >
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="opt in items"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
