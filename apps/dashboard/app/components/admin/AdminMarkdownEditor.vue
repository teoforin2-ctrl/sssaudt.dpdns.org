<script setup lang="ts">
import type { ToolbarNames, UploadImgCallBack } from 'md-editor-v3'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  folder?: 'content' | 'articles' | 'casinos'
  height?: string
}>(), {
  placeholder: 'Markdown…',
  folder: 'content',
  height: '460px',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { api } = useApi()
const config = useRuntimeConfig()
const colorMode = useColorMode()
const siteUrl = computed(() => String(config.public.siteUrl || 'http://127.0.0.1:3710').replace(/\/$/, ''))

const theme = computed<'light' | 'dark'>(() => (colorMode.value === 'dark' ? 'dark' : 'light'))

const toolbars = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  '-',
  'revoke',
  'next',
  'save',
  '=',
  'pageFullscreen',
  'fullscreen',
  'preview',
  'previewOnly',
  'catalog',
] as ToolbarNames[]

const text = computed({
  get: () => props.modelValue || '',
  set: (v: string) => emit('update:modelValue', v),
})

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

async function onUploadImg(files: File[], callback: UploadImgCallBack) {
  const uploaded: { url: string, alt: string, title: string }[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/'))
      continue
    if (file.size > 4_500_000)
      continue
    const dataUrl = await fileToDataUrl(file)
    const res = await api<{ url: string, alt: string | null }>('/v1/admin/uploads/images', {
      method: 'POST',
      body: {
        data_url: dataUrl,
        folder: props.folder,
        alt: file.name.replace(/\.[^.]+$/, ''),
      },
    })
    // Store relative /uploads/… — preview uses transformImgUrl
    uploaded.push({
      url: res.url,
      alt: res.alt || file.name,
      title: res.alt || file.name,
    })
  }
  callback(uploaded)
}

function transformImgUrl(url: string) {
  if (!url)
    return url
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
    return url
  if (url.startsWith('/'))
    return `${siteUrl.value}${url}`
  return url
}
</script>

<template>
  <div class="admin-md-editor overflow-hidden rounded-xl border">
    <MdEditor
      v-model="text"
      language="en-US"
      :theme="theme"
      preview-theme="default"
      code-theme="atom"
      :placeholder="placeholder"
      :toolbars="toolbars"
      :style="{ height }"
      :auto-detect-code="true"
      :on-upload-img="onUploadImg"
      :transform-img-url="transformImgUrl"
    />
  </div>
</template>

<style scoped>
.admin-md-editor :deep(.md-editor) {
  border: none;
  /* Theme tokens are already full colors (oklch), not HSL channels */
  --md-bk-color: var(--popover);
  --md-bk-color-outstand: var(--card);
  --md-bk-hover-color: var(--accent);
  --md-border-color: var(--border);
  --md-color: var(--popover-foreground);
  background-color: var(--background);
}
</style>

<!-- Teleported dropdowns/modals leave .admin-md-editor; style globally -->
<style>
.md-editor-dropdown,
.md-editor-modal {
  background-color: var(--popover) !important;
  color: var(--popover-foreground) !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35) !important;
}

.md-editor-menu-item:hover,
.md-editor-dropdown .md-editor-menu-item:hover {
  background-color: var(--accent) !important;
}
</style>
