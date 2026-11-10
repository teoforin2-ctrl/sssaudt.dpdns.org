<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    label: string
    /** Existing public URL or absolute path */
    src?: string | null
    /** Local data URL after pick (takes preview priority) */
    dataUrl?: string | null
    hint?: string
  }>(),
  {
    src: null,
    dataUrl: null,
    hint: 'PNG / JPG / WebP · до 6 МБ',
  },
)

const emit = defineEmits<{
  pick: [dataUrl: string]
  clear: []
}>()

const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'
const err = ref<string | null>(null)
const inputKey = ref(0)

const preview = computed(() => {
  const raw = props.dataUrl || props.src
  if (!raw)
    return null
  if (raw.startsWith('data:') || raw.startsWith('http'))
    return raw
  return `${webOrigin}${raw}`
})

async function onChange(ev: Event) {
  err.value = null
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!file.type.startsWith('image/')) {
    err.value = 'Нужно изображение'
    return
  }
  if (file.size > 6_000_000) {
    err.value = 'Макс. ~6 МБ'
    return
  }
  const reader = new FileReader()
  reader.onload = () => emit('pick', String(reader.result || ''))
  reader.onerror = () => {
    err.value = 'Не удалось прочитать файл'
  }
  reader.readAsDataURL(file)
}

function clear() {
  err.value = null
  inputKey.value += 1
  emit('clear')
}
</script>

<template>
  <div class="grid gap-2">
    <Label>{{ label }}</Label>
    <div class="relative overflow-hidden rounded-xl border bg-muted/40">
      <div class="flex h-36 items-center justify-center">
        <img
          v-if="preview"
          :src="preview"
          alt=""
          class="h-full w-full object-cover"
        >
        <span v-else class="text-xs text-muted-foreground">Нет изображения</span>
      </div>
      <Button
        v-if="preview"
        type="button"
        size="icon-sm"
        variant="secondary"
        class="absolute right-2 top-2"
        @click="clear"
      >
        <X class="size-3.5" />
      </Button>
    </div>
    <Input
      :key="inputKey"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="cursor-pointer"
      @change="onChange"
    />
    <p class="text-xs text-muted-foreground">
      {{ hint }}
    </p>
    <p v-if="err" class="text-xs text-destructive">
      {{ err }}
    </p>
  </div>
</template>
