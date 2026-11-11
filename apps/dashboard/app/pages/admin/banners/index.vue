<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { GripVertical, ImageIcon, Pencil, Plus } from 'lucide-vue-next'
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

interface ListRes {
  items: Row[]
  summary?: {
    total: number
    active: number
    inactive: number
    byPlacement: Array<{ placement: string, count: number }>
  }
}

const placement = ref('')
const { data, pending, refresh } = await useAsyncData(
  () => `admin-banners-${placement.value || 'all'}`,
  () => api<ListRes>('/v1/admin/banners', {
    query: { placement: placement.value || undefined },
  }),
  { watch: [placement] },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const rows = ref<Row[]>([])
watch(
  () => data.value?.items,
  (items) => {
    rows.value = [...(items || [])]
  },
  { immediate: true },
)

const summary = computed(() => data.value?.summary)
const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Всего', value: s?.total ?? rows.value.length, hint: 'баннеров', tone: 'violet' as AdminTone },
    { label: 'Активные', value: s?.active ?? 0, hint: 'on', tone: 'emerald' as AdminTone },
    { label: 'Выключенные', value: s?.inactive ?? 0, hint: 'off', tone: 'amber' as AdminTone },
    { label: 'Placements', value: s?.byPlacement?.length ?? 0, hint: (s?.byPlacement || []).map(p => p.placement).join(' · ') || '—', tone: 'cyan' as AdminTone },
  ]
})

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
  <div class="space-y-6">
    <AdminPageHeader
      title="Баннеры"
      description="Создание, загрузка картинок, порядок drag-and-drop"
      help="banners"
    >
      <template #actions>
        <Button size="sm" @click="openCreate">
          <Plus class="size-4" />
          Добавить
        </Button>
      </template>
    </AdminPageHeader>

    <AdminUiAdminStatGrid :cols="4">
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="ImageIcon"
        :tone="card.tone"
        :ready="ready && !pending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card/40 p-3">
      <button
        type="button"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="!placement
          ? 'border-foreground/20 bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'"
        @click="placement = ''"
      >
        Все
      </button>
      <button
        v-for="p in placements"
        :key="p.value"
        type="button"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="placement === p.value
          ? 'border-foreground/20 bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'"
        @click="placement = p.value"
      >
        {{ p.value }}
        <span
          v-if="summary?.byPlacement?.find(x => x.placement === p.value)"
          class="ml-1 tabular-nums opacity-70"
        >
          {{ summary.byPlacement.find(x => x.placement === p.value)!.count }}
        </span>
      </button>
      <span v-if="reorderBusy" class="ml-auto text-xs text-muted-foreground">Сохраняю порядок…</span>
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="4" />
    <div v-else class="overflow-hidden rounded-2xl border">
      <div class="grid grid-cols-[28px_120px_1fr_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          <div class="grid grid-cols-[28px_120px_1fr_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30">
            <button
              type="button"
              class="drag-handle cursor-grab text-muted-foreground hover:text-foreground"
              aria-label="Перетащить"
            >
              <GripVertical class="size-4" />
            </button>
            <div class="flex gap-1.5">
              <div class="relative">
                <Badge class="absolute -left-1 -top-1 z-10 px-1 py-0 text-[9px]" variant="secondary">
                  RU
                </Badge>
                <img :src="assetUrl(row.image_ru)" alt="" class="h-12 w-12 rounded-lg border object-cover transition-transform hover:scale-105">
              </div>
              <div class="relative">
                <Badge class="absolute -left-1 -top-1 z-10 px-1 py-0 text-[9px]" variant="secondary">
                  EN
                </Badge>
                <img :src="assetUrl(row.image_en)" alt="" class="h-12 w-12 rounded-lg border object-cover opacity-90 transition-transform hover:scale-105">
              </div>
            </div>
            <div class="min-w-0">
              <div class="truncate font-medium">
                {{ row.title_ru || row.slug }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ row.placement }} · #{{ row.sort_order }} · {{ row.slug }}
              </div>
            </div>
            <div class="inline-flex items-center justify-end gap-2">
              <Switch
                :model-value="row.active"
                @update:model-value="toggleActive(row)"
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
      <AdminUiAdminEmptyState
        v-if="!rows.length"
        title="Баннеров нет"
        description="Нажмите «Добавить», чтобы создать первый"
        :icon="ImageIcon"
      >
        <Button size="sm" class="mt-2" @click="openCreate">
          Добавить
        </Button>
      </AdminUiAdminEmptyState>
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
              <AdminSelect
                v-model="fields.placement"
                :options="placements.map(p => ({ value: p.value, label: p.label }))"
              />
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

          <AdminCheckbox v-model:checked="fields.active">
            Показывать на сайте
          </AdminCheckbox>

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
