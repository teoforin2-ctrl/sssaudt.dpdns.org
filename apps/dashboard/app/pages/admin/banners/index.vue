<script setup lang="ts">
import { Eye, EyeOff, GripVertical, Pencil, Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

interface Row {
  id: string
  slug: string
  placement: string
  title_ru: string | null
  title_en: string | null
  image_ru: string
  image_en: string
  href_ru: string | null
  href_en: string | null
  sort_order: number
  active: boolean
}

const placement = ref('')
const { data, pending, refresh } = await useAsyncData(
  () => `admin-banners-${placement.value || 'all'}`,
  () => api<{ items: Row[] }>('/v1/admin/banners', {
    query: { placement: placement.value || undefined },
  }),
  { watch: [placement] },
)

const rows = ref<Row[]>([])
watch(
  () => data.value?.items,
  (items) => {
    rows.value = [...(items || [])]
  },
  { immediate: true },
)

function assetUrl(path: string | null | undefined) {
  if (!path)
    return ''
  if (path.startsWith('data:') || path.startsWith('http'))
    return path
  return `${webOrigin}${path}`
}

const editing = ref<Row | null>(null)
const creating = ref(false)
const saving = ref(false)
const saveErr = ref<string | null>(null)
const busyId = ref<string | null>(null)
const reorderBusy = ref(false)

const fields = reactive({
  slug: '',
  placement: 'home_hero',
  title_ru: '',
  title_en: '',
  href_ru: '/',
  href_en: '/',
  sort_order: 10,
  active: true,
  image_ru: '',
  image_en: '',
})
const imageRuData = ref<string | null>(null)
const imageEnData = ref<string | null>(null)

const placements = [
  { value: 'home_hero', label: 'home_hero — главная' },
  { value: 'sidebar', label: 'sidebar' },
  { value: 'listing', label: 'listing' },
  { value: 'article', label: 'article' },
]

function resetEditor() {
  fields.slug = ''
  fields.placement = placement.value || 'home_hero'
  fields.title_ru = ''
  fields.title_en = ''
  fields.href_ru = '/'
  fields.href_en = '/'
  fields.sort_order = (rows.value.at(-1)?.sort_order || 0) + 10
  fields.active = true
  fields.image_ru = ''
  fields.image_en = ''
  imageRuData.value = null
  imageEnData.value = null
  saveErr.value = null
}

function openCreate() {
  creating.value = true
  editing.value = null
  resetEditor()
}

function openEdit(row: Row) {
  creating.value = false
  editing.value = row
  fields.slug = row.slug
  fields.placement = row.placement
  fields.title_ru = row.title_ru || ''
  fields.title_en = row.title_en || ''
  fields.href_ru = row.href_ru || ''
  fields.href_en = row.href_en || ''
  fields.sort_order = row.sort_order
  fields.active = row.active
  fields.image_ru = row.image_ru
  fields.image_en = row.image_en
  imageRuData.value = null
  imageEnData.value = null
  saveErr.value = null
}

function closeEditor() {
  creating.value = false
  editing.value = null
}

async function save() {
  saving.value = true
  saveErr.value = null
  try {
    const body: Record<string, unknown> = {
      title_ru: fields.title_ru || null,
      title_en: fields.title_en || null,
      href_ru: fields.href_ru || null,
      href_en: fields.href_en || null,
      sort_order: Number(fields.sort_order) || 0,
      active: fields.active,
      placement: fields.placement,
    }
    if (imageRuData.value)
      body.image_ru_data_url = imageRuData.value
    else if (fields.image_ru)
      body.image_ru = fields.image_ru
    if (imageEnData.value)
      body.image_en_data_url = imageEnData.value
    else if (fields.image_en)
      body.image_en = fields.image_en

    if (creating.value) {
      if (fields.slug.trim())
        body.slug = fields.slug.trim()
      await api('/v1/admin/banners', { method: 'POST', body })
    }
    else if (editing.value) {
      await api(`/v1/admin/banners/${editing.value.id}`, { method: 'PATCH', body })
    }
    closeEditor()
    await refresh()
  }
  catch (e: unknown) {
    const err = (e as { data?: { error?: string } }).data?.error
    saveErr.value = err === 'images_required'
      ? 'Нужны изображения RU и EN'
      : err === 'slug_taken'
        ? 'Slug занят'
        : 'Не удалось сохранить'
  }
  finally {
    saving.value = false
  }
}

async function toggleActive(row: Row) {
  await api(`/v1/admin/banners/${row.id}`, {
    method: 'PATCH',
    body: { active: !row.active },
  })
  await refresh()
}

async function removeBanner(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/banners/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function onReorder() {
  if (reorderBusy.value)
    return
  reorderBusy.value = true
  try {
    await Promise.all(rows.value.map((row, idx) =>
      api(`/v1/admin/banners/${row.id}`, {
        method: 'PATCH',
        body: { sort_order: (idx + 1) * 10 },
      }),
    ))
    await refresh()
  }
  finally {
    reorderBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Баннеры
        </h1>
        <p class="text-sm text-muted-foreground">
          Создание, загрузка картинок, порядок drag-and-drop
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminSectionHelp section="banners" />
        <Button size="sm" @click="openCreate">
          <Plus class="size-4" />
          Добавить
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 items-center">
      <select
        v-model="placement"
        class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">
          Все placements
        </option>
        <option v-for="p in placements" :key="p.value" :value="p.value">
          {{ p.label }}
        </option>
      </select>
      <span v-if="reorderBusy" class="text-xs text-muted-foreground">Сохраняю порядок…</span>
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="4" />
    <div v-else class="rounded-xl border overflow-hidden">
      <div class="grid grid-cols-[28px_88px_1fr_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span />
        <span>Превью</span>
        <span>Баннер</span>
        <span class="text-right">Действия</span>
      </div>
      <draggable
        v-model="rows"
        item-key="id"
        handle=".drag-handle"
        ghost-class="opacity-40"
        class="divide-y"
        @end="onReorder"
      >
        <template #item="{ element: row }">
          <div class="grid grid-cols-[28px_88px_1fr_auto] items-center gap-3 px-3 py-2.5 bg-background">
            <button
              type="button"
              class="drag-handle cursor-grab text-muted-foreground hover:text-foreground"
              aria-label="Перетащить"
            >
              <GripVertical class="size-4" />
            </button>
            <div class="flex gap-1">
              <img :src="assetUrl(row.image_ru)" alt="" class="h-12 w-10 rounded object-cover border">
              <img :src="assetUrl(row.image_en)" alt="" class="h-12 w-10 rounded object-cover border opacity-80">
            </div>
            <div class="min-w-0">
              <div class="truncate font-medium">
                {{ row.title_ru || row.slug }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ row.placement }} · #{{ row.sort_order }} · {{ row.slug }}
              </div>
            </div>
            <div class="inline-flex items-center justify-end gap-0.5">
              <Badge :variant="row.active ? 'default' : 'secondary'" class="mr-1">
                {{ row.active ? 'on' : 'off' }}
              </Badge>
              <AdminIconButton
                :tooltip="row.active ? 'Выключить' : 'Включить'"
                :icon="row.active ? EyeOff : Eye"
                @click="toggleActive(row)"
              />
              <AdminIconButton
                tooltip="Редактировать"
                :icon="Pencil"
                @click="openEdit(row)"
              />
              <AdminConfirmDelete
                entity="баннер"
                :label="row.title_ru || row.slug"
                :busy="busyId === row.id"
                @confirm="removeBanner(row.id)"
              />
            </div>
          </div>
        </template>
      </draggable>
      <p v-if="!rows.length" class="px-3 py-10 text-center text-sm text-muted-foreground">
        Баннеров нет — нажмите «Добавить»
      </p>
    </div>

    <Dialog :open="creating || !!editing" @update:open="(v) => { if (!v) closeEditor() }">
      <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {{ creating ? 'Новый баннер' : `Баннер ${editing?.slug}` }}
          </DialogTitle>
        </DialogHeader>
        <div class="grid gap-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label>Placement</Label>
              <select v-model="fields.placement" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                <option v-for="p in placements" :key="p.value" :value="p.value">
                  {{ p.label }}
                </option>
              </select>
            </div>
            <div v-if="creating" class="grid gap-2">
              <Label>Slug (опционально)</Label>
              <Input v-model="fields.slug" placeholder="auto" />
            </div>
            <div class="grid gap-2">
              <Label>Title RU</Label>
              <Input v-model="fields.title_ru" />
            </div>
            <div class="grid gap-2">
              <Label>Title EN</Label>
              <Input v-model="fields.title_en" />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <AdminImageUpload
              label="Изображение RU"
              :src="fields.image_ru"
              :data-url="imageRuData"
              @pick="(v) => { imageRuData = v }"
              @clear="() => { imageRuData = null; fields.image_ru = '' }"
            />
            <AdminImageUpload
              label="Изображение EN"
              :src="fields.image_en"
              :data-url="imageEnData"
              @pick="(v) => { imageEnData = v }"
              @clear="() => { imageEnData = null; fields.image_en = '' }"
            />
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label>Href RU</Label>
              <Input v-model="fields.href_ru" />
            </div>
            <div class="grid gap-2">
              <Label>Href EN</Label>
              <Input v-model="fields.href_en" />
            </div>
          </div>

          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="fields.active" type="checkbox" class="size-4">
            Показывать на сайте
          </label>

          <p v-if="saveErr" class="text-sm text-destructive">
            {{ saveErr }}
          </p>
          <div class="flex gap-2">
            <Button :disabled="saving" @click="save">
              {{ saving ? 'Сохранение…' : (creating ? 'Создать' : 'Сохранить') }}
            </Button>
            <Button variant="outline" @click="closeEditor">
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
