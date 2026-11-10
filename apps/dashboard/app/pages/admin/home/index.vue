<script setup lang="ts">
import { Eye, EyeOff, GripVertical, Pencil } from 'lucide-vue-next'
import draggable from 'vuedraggable'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

type HomeSections = Record<string, boolean>

interface Settings {
  homeSections: HomeSections
}

interface BannerRow {
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

const sectionMeta: { key: string, label: string }[] = [
  { key: 'heroStats', label: 'Статистика в герое' },
  { key: 'heroBanners', label: 'Слайдер баннеров' },
  { key: 'listing', label: 'Рейтинг / список казино' },
  { key: 'aside', label: 'Правая колонка (отзывы / новинки)' },
  { key: 'slots', label: 'Карусель слотов' },
  { key: 'promoBanner', label: 'Промо-баннер' },
  { key: 'newSlots', label: 'Новые слоты' },
  { key: 'articles', label: 'Статьи' },
  { key: 'guides', label: 'Хабы для новичков' },
  { key: 'partnerBrands', label: 'Партнёрские бренды (выкл. пока нет detail)' },
  { key: 'homeBonuses', label: 'Лучшие бонусы на главной' },
  { key: 'homeForum', label: 'Тизер форума на главной' },
  { key: 'homeB2b', label: 'Баннер B2B / казино под ключ' },
  { key: 'expert', label: 'Эксперт' },
  { key: 'trust', label: 'Блок доверия' },
  { key: 'communityStats', label: 'Лента фактов / community stats' },
  { key: 'method', label: 'Методика и disclosure' },
]

const { data: settingsData, pending: settingsPending, refresh: refreshSettings } = await useAsyncData(
  'admin-home-settings',
  () => api<{ settings: Settings }>('/v1/admin/site-settings'),
)

const { data: bannersData, pending: bannersPending, refresh: refreshBanners } = await useAsyncData(
  'admin-home-banners',
  () => api<{ items: BannerRow[] }>('/v1/admin/banners', { query: { placement: 'home_hero' } }),
)

const sections = reactive<HomeSections>({})
watch(
  () => settingsData.value?.settings?.homeSections,
  (s) => {
    for (const key of Object.keys(sections)) delete sections[key]
    Object.assign(sections, s || {})
  },
  { immediate: true },
)

const sectionSaving = ref(false)
const sectionMsg = ref<string | null>(null)
const sectionErr = ref<string | null>(null)

async function saveSections() {
  sectionSaving.value = true
  sectionMsg.value = null
  sectionErr.value = null
  try {
    await api('/v1/admin/site-settings', {
      method: 'PATCH',
      body: { home_sections: { ...sections } },
    })
    sectionMsg.value = 'Разделы сохранены'
    await refreshSettings()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    sectionErr.value = e?.data?.error || e?.message || 'Ошибка'
  }
  finally {
    sectionSaving.value = false
  }
}

const banners = ref<BannerRow[]>([])
watch(
  () => bannersData.value?.items,
  (items) => {
    banners.value = [...(items || [])].sort((a, b) => a.sort_order - b.sort_order)
  },
  { immediate: true },
)
const reorderBusy = ref(false)

const editing = ref<BannerRow | null>(null)
const creating = ref(false)
const form = reactive({
  title_ru: '',
  title_en: '',
  href_ru: '',
  href_en: '',
  sort_order: 10,
  active: true,
  image_ru: '',
  image_en: '',
})
const imageRuData = ref<string | null>(null)
const imageEnData = ref<string | null>(null)
const imageRuPreview = ref<string | null>(null)
const imageEnPreview = ref<string | null>(null)
const bannerMsg = ref<string | null>(null)
const bannerErr = ref<string | null>(null)
const bannerSaving = ref(false)

function assetUrl(path: string | null | undefined) {
  if (!path)
    return ''
  if (path.startsWith('data:') || path.startsWith('http'))
    return path
  return `${webOrigin}${path}`
}

function openEdit(row: BannerRow) {
  creating.value = false
  editing.value = row
  form.title_ru = row.title_ru || ''
  form.title_en = row.title_en || ''
  form.href_ru = row.href_ru || ''
  form.href_en = row.href_en || ''
  form.sort_order = row.sort_order
  form.active = row.active
  form.image_ru = row.image_ru
  form.image_en = row.image_en
  imageRuData.value = null
  imageEnData.value = null
  imageRuPreview.value = row.image_ru
  imageEnPreview.value = row.image_en
  bannerMsg.value = null
  bannerErr.value = null
}

function openCreate() {
  creating.value = true
  editing.value = null
  form.title_ru = ''
  form.title_en = ''
  form.href_ru = '/'
  form.href_en = '/'
  form.sort_order = (banners.value.at(-1)?.sort_order || 0) + 10

  form.active = true
  form.image_ru = ''
  form.image_en = ''
  imageRuData.value = null
  imageEnData.value = null
  imageRuPreview.value = null
  imageEnPreview.value = null
  bannerMsg.value = null
  bannerErr.value = null
}

function closeEditor() {
  editing.value = null
  creating.value = false
}

async function saveBanner() {
  bannerSaving.value = true
  bannerMsg.value = null
  bannerErr.value = null
  try {
    const body: Record<string, unknown> = {
      title_ru: form.title_ru || null,
      title_en: form.title_en || null,
      href_ru: form.href_ru || null,
      href_en: form.href_en || null,
      sort_order: Number(form.sort_order) || 0,
      active: form.active,
      placement: 'home_hero',
    }
    if (imageRuData.value)
      body.image_ru_data_url = imageRuData.value
    else if (form.image_ru)
      body.image_ru = form.image_ru
    if (imageEnData.value)
      body.image_en_data_url = imageEnData.value
    else if (form.image_en)
      body.image_en = form.image_en

    if (creating.value) {
      await api('/v1/admin/banners', { method: 'POST', body })
      bannerMsg.value = 'Баннер создан'
    }
    else if (editing.value) {
      await api(`/v1/admin/banners/${editing.value.id}`, { method: 'PATCH', body })
      bannerMsg.value = 'Баннер сохранён'
    }
    closeEditor()
    await refreshBanners()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    bannerErr.value = e?.data?.error || e?.message || 'Ошибка сохранения'
  }
  finally {
    bannerSaving.value = false
  }
}

async function onBannerReorder() {
  if (reorderBusy.value)
    return
  reorderBusy.value = true
  try {
    await Promise.all(banners.value.map((row, idx) =>
      api(`/v1/admin/banners/${row.id}`, {
        method: 'PATCH',
        body: { sort_order: (idx + 1) * 10 },
      }),
    ))
    await refreshBanners()
  }
  finally {
    reorderBusy.value = false
  }
}

async function toggleBanner(row: BannerRow) {
  await api(`/v1/admin/banners/${row.id}`, {
    method: 'PATCH',
    body: { active: !row.active },
  })
  await refreshBanners()
}

const deletingBannerId = ref<string | null>(null)

async function removeBanner(row: BannerRow) {
  deletingBannerId.value = row.id
  try {
    await api(`/v1/admin/banners/${row.id}`, { method: 'DELETE' })
    await refreshBanners()
  }
  finally {
    deletingBannerId.value = null
  }
}
</script>

<template>
  <div class="max-w-5xl space-y-8">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Главная страница
        </h1>
        <p class="text-sm text-muted-foreground">
          Видимость блоков и баннеры hero (RU / EN)
        </p>
      </div>
      <AdminSectionHelp section="home" />
    </div>

    <section class="space-y-4 rounded-xl border p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Разделы
        </h2>
        <Button size="sm" :disabled="sectionSaving" @click="saveSections">
          {{ sectionSaving ? 'Сохранение…' : 'Сохранить разделы' }}
        </Button>
      </div>
      <AdminFormSkeleton v-if="settingsPending && !settingsData" :fields="4" />
      <div v-else class="grid gap-2 sm:grid-cols-2">
        <label
          v-for="s in sectionMeta"
          :key="s.key"
          class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <input v-model="sections[s.key]" type="checkbox" class="size-4 rounded border">
          {{ s.label }}
        </label>
      </div>
      <p v-if="sectionMsg" class="text-sm text-emerald-600">
        {{ sectionMsg }}
      </p>
      <p v-if="sectionErr" class="text-sm text-destructive">
        {{ sectionErr }}
      </p>
    </section>

    <section class="space-y-4 rounded-xl border p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Баннеры hero
        </h2>
        <Button size="sm" @click="openCreate">
          + Баннер
        </Button>
      </div>

      <AdminTableSkeleton v-if="bannersPending && !bannersData" :cols="5" />
      <div v-else class="overflow-hidden rounded-lg border">
        <div class="grid grid-cols-[28px_96px_1fr_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span />
          <span>Превью</span>
          <span>Баннер</span>
          <span class="text-right">{{ reorderBusy ? 'Сохраняю…' : 'Действия' }}</span>
        </div>
        <draggable
          v-model="banners"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-40"
          class="divide-y"
          @end="onBannerReorder"
        >
          <template #item="{ element: row }">
            <div class="grid grid-cols-[28px_96px_1fr_auto] items-center gap-3 px-3 py-2.5">
              <button type="button" class="drag-handle cursor-grab text-muted-foreground" aria-label="Перетащить">
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
                  {{ row.slug }} · #{{ row.sort_order }}
                </div>
              </div>
              <div class="inline-flex items-center justify-end gap-0.5">
                <Badge :variant="row.active ? 'default' : 'secondary'" class="mr-1">
                  {{ row.active ? 'on' : 'off' }}
                </Badge>
                <AdminIconButton
                  :tooltip="row.active ? 'Выключить показ' : 'Включить показ'"
                  :icon="row.active ? EyeOff : Eye"
                  @click="toggleBanner(row)"
                />
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  @click="openEdit(row)"
                />
                <AdminConfirmDelete
                  entity="баннер"
                  :label="row.title_ru || row.slug"
                  :busy="deletingBannerId === row.id"
                  @confirm="removeBanner(row)"
                />
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </section>

    <Dialog :open="!!editing || creating" @update:open="(v) => { if (!v) closeEditor() }">
      <DialogContent class="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {{ creating ? 'Новый баннер' : `Баннер ${editing?.slug}` }}
          </DialogTitle>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-2 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label>Title RU</Label>
              <Input v-model="form.title_ru" />
            </div>
            <div class="grid gap-2">
              <Label>Title EN</Label>
              <Input v-model="form.title_en" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <AdminImageUpload
              label="Изображение RU"
              :src="form.image_ru"
              :data-url="imageRuData"
              @pick="(v) => { imageRuData = v; imageRuPreview = v }"
              @clear="() => { imageRuData = null; imageRuPreview = null; form.image_ru = '' }"
            />
            <AdminImageUpload
              label="Изображение EN"
              :src="form.image_en"
              :data-url="imageEnData"
              @pick="(v) => { imageEnData = v; imageEnPreview = v }"
              @clear="() => { imageEnData = null; imageEnPreview = null; form.image_en = '' }"
            />
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label>Href RU</Label>
              <Input v-model="form.href_ru" />
            </div>
            <div class="grid gap-2">
              <Label>Href EN</Label>
              <Input v-model="form.href_en" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label>Sort order</Label>
            <Input v-model.number="form.sort_order" type="number" />
          </div>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.active" type="checkbox" class="size-4">
            Active
          </label>
          <div class="flex flex-wrap items-center gap-3">
            <Button :disabled="bannerSaving" @click="saveBanner">
              {{ bannerSaving ? 'Сохранение…' : 'Сохранить' }}
            </Button>
            <span v-if="bannerMsg" class="text-sm text-emerald-600">{{ bannerMsg }}</span>
            <span v-if="bannerErr" class="text-sm text-destructive">{{ bannerErr }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
