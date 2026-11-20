<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const id = computed(() => String(route.params.id))

type Casino = Record<string, unknown> & {
  id: string
  name: string
  slug: string
  status: string
  hot: boolean
  has_representative: boolean
  published: boolean
  revshare_rate?: number | string | null
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-casino-${id.value}`,
  () => api<{ item: Casino }>(`/v1/admin/casinos/${id.value}`),
)

function emptySeo() {
  return { ru: {}, en: {}, ogImage: null as string | null }
}

function normalizeSeo(raw: unknown) {
  const base = emptySeo()
  if (!raw || typeof raw !== 'object')
    return base
  const o = raw as Record<string, unknown>
  if ('ru' in o || 'en' in o || 'ogImage' in o) {
    return {
      ru: { ...((o.ru as Record<string, string>) || {}) },
      en: { ...((o.en as Record<string, string>) || {}) },
      ogImage: typeof o.ogImage === 'string' ? o.ogImage : null,
    }
  }
  return {
    ru: {
      title: typeof o.title === 'string' ? o.title : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      h1: typeof o.h1 === 'string' ? o.h1 : undefined,
    },
    en: {},
    ogImage: null as string | null,
  }
}

const form = reactive({
  name: '',
  name_ru: '',
  name_en: '',
  slug: '',
  status: 'draft',
  hot: false,
  has_representative: false,
  logo_url: '',
  partner_url: '',
  revshare_rate: '' as string,
  license: '',
  short_desc_ru: '',
  short_desc_en: '',
  description_ru: '',
  description_en: '',
  editorial_score: '' as string,
  final_rating: '' as string,
  seo: emptySeo(),
})
const reviewLang = ref<'ru' | 'en'>('ru')

watch(
  () => data.value?.item,
  (item) => {
    if (!item)
      return
    form.name = String(item.name || '')
    form.name_ru = String(item.name_ru || '')
    form.name_en = String(item.name_en || '')
    form.slug = String(item.slug || '')
    form.status = String(item.status || 'draft')
    form.hot = Boolean(item.hot)
    form.has_representative = Boolean(item.has_representative)
    form.logo_url = String(item.logo_url || '')
    form.partner_url = String(item.partner_url || '')
    form.revshare_rate = item.revshare_rate != null && item.revshare_rate !== '' ? String(item.revshare_rate) : ''
    form.license = String(item.license || '')
    form.short_desc_ru = String(item.short_desc_ru || '')
    form.short_desc_en = String(item.short_desc_en || '')
    form.description_ru = String(item.description_ru || '')
    form.description_en = String(item.description_en || '')
    form.editorial_score = item.editorial_score != null ? String(item.editorial_score) : ''
    form.final_rating = item.final_rating != null ? String(item.final_rating) : ''
    form.seo = normalizeSeo(item.seo)
  },
  { immediate: true },
)

const saving = ref(false)
const saveMsg = ref<string | null>(null)
const saveErr = ref<string | null>(null)
const seoValidation = ref<{
  ok: boolean
  blockers: Array<{ level: 'error' | 'warning', code: string, locale?: 'ru' | 'en', message: string }>
  warnings: Array<{ level: 'error' | 'warning', code: string, locale?: 'ru' | 'en', message: string }>
} | null>(null)

async function confirmRep() {
  await api(`/v1/admin/casinos/${id.value}/confirm-representative`, {
    method: 'POST',
    body: { confirmed: true },
  })
  form.has_representative = true
  await refresh()
}

async function save() {
  saving.value = true
  saveMsg.value = null
  saveErr.value = null
  seoValidation.value = null
  try {
    await api(`/v1/admin/casinos/${id.value}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        name_ru: form.name_ru || null,
        name_en: form.name_en || null,
        slug: form.slug,
        status: form.status,
        hot: form.hot,
        has_representative: form.has_representative,
        logo_url: form.logo_url || null,
        partner_url: form.partner_url || null,
        revshare_rate: form.revshare_rate === '' ? null : Number(form.revshare_rate),
        license: form.license || null,
        short_desc_ru: form.short_desc_ru || null,
        short_desc_en: form.short_desc_en || null,
        description_ru: form.description_ru || null,
        description_en: form.description_en || null,
        editorial_score: form.editorial_score === '' ? null : Number(form.editorial_score),
        final_rating: form.final_rating === '' ? null : Number(form.final_rating),
        seo: form.seo,
      },
    })
    saveMsg.value = 'Сохранено'
    await refresh()
  }
  catch (err: unknown) {
    const e = err as { statusCode?: number, data?: { error?: string, validation?: typeof seoValidation.value } }
    if (e.statusCode === 422 && e.data?.validation) {
      seoValidation.value = e.data.validation
      saveErr.value = 'SEO: исправьте блокеры перед публикацией'
    }
    else {
      saveErr.value = 'Ошибка сохранения'
    }
  }
  finally {
    saving.value = false
  }
}

const deleting = ref(false)
const aiBusy = ref(false)
const aiMsg = ref<string | null>(null)

async function queueAiProcess() {
  aiBusy.value = true
  aiMsg.value = null
  try {
    const res = await api<{ item: { status: string } }>('/v1/admin/ai/jobs', {
      method: 'POST',
      body: { contentType: 'casino', contentId: id.value, action: 'process' },
    })
    aiMsg.value = `Задача ИИ создана (${res.item.status})`
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    aiMsg.value = e?.data?.error || e?.message || 'Не удалось поставить в очередь'
  }
  finally {
    aiBusy.value = false
  }
}

async function removeCasino() {
  deleting.value = true
  try {
    await api(`/v1/admin/casinos/${id.value}`, { method: 'DELETE' })
    await navigateTo('/admin/casinos')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-5xl">
    <div class="flex flex-wrap items-center gap-3">
      <Button as-child variant="ghost" size="sm">
        <NuxtLink to="/admin/casinos">
          ← Казино
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ form.name || 'Казино' }}
      </h1>
      <Badge
        v-if="data?.item?.ai_processed_at"
        variant="outline"
        class="border-violet-500/40 bg-violet-500/10 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"
      >
        ИИ
      </Badge>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" :disabled="aiBusy || pending" @click="queueAiProcess">
          {{ aiBusy ? 'В очередь…' : 'Обработать ИИ' }}
        </Button>
        <AdminSectionHelp section="casinos-edit" />
      </div>
    </div>
    <p v-if="aiMsg" class="text-sm text-muted-foreground">
      {{ aiMsg }}
      <NuxtLink to="/admin/ai" class="ml-2 underline underline-offset-2">
        очередь ИИ
      </NuxtLink>
    </p>

    <AdminFormSkeleton v-if="pending && !data" />
    <p v-else-if="error" class="text-sm text-destructive">
      Не найдено
    </p>

    <form v-else class="grid gap-4" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Name</Label>
          <Input v-model="form.name" required />
        </div>
        <div class="grid gap-2">
          <Label>Slug</Label>
          <Input v-model="form.slug" required />
        </div>
        <div class="grid gap-2">
          <Label>Name RU</Label>
          <Input v-model="form.name_ru" />
        </div>
        <div class="grid gap-2">
          <Label>Name EN</Label>
          <Input v-model="form.name_en" />
        </div>
        <div class="grid gap-2">
          <Label>Статус</Label>
          <AdminSelect
            v-model="form.status"
            :options="[
              { value: 'draft', label: 'draft' },
              { value: 'review', label: 'review' },
              { value: 'published', label: 'published' },
            ]"
          />
        </div>
        <div class="grid gap-2">
          <Label>License</Label>
          <Input v-model="form.license" />
        </div>
        <div class="grid gap-2">
          <Label>Editorial score</Label>
          <Input v-model="form.editorial_score" type="number" step="0.1" min="0" max="10" />
        </div>
        <div class="grid gap-2">
          <Label>Final rating</Label>
          <Input v-model="form.final_rating" type="number" step="0.1" min="0" max="10" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Logo URL</Label>
          <Input v-model="form.logo_url" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Partner URL (/go)</Label>
          <Input v-model="form.partner_url" />
        </div>
        <div class="grid gap-2">
          <Label>RevShare ставка %</Label>
          <Input v-model="form.revshare_rate" type="number" step="0.1" min="0" max="100" placeholder="скрыто у партнёра, если пусто" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Short desc RU</Label>
          <Textarea v-model="form.short_desc_ru" rows="3" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Short desc EN</Label>
          <Textarea v-model="form.short_desc_en" rows="3" />
        </div>
      </div>

      <AdminEntitySeoFields v-model="form.seo" />
      <AdminSeoValidation :result="seoValidation" />

      <div class="space-y-3 rounded-xl border p-4">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-base font-semibold">
            Редакционный обзор (Markdown)
          </h2>
          <div class="ml-auto flex gap-2">
            <Button type="button" size="sm" :variant="reviewLang === 'ru' ? 'default' : 'outline'" @click="reviewLang = 'ru'">
              RU
            </Button>
            <Button type="button" size="sm" :variant="reviewLang === 'en' ? 'default' : 'outline'" @click="reviewLang = 'en'">
              EN
            </Button>
          </div>
        </div>
        <p class="text-sm text-muted-foreground">
          Полный текст обзора на карточке казино. Картинки — через кнопку image в toolbar.
        </p>
        <AdminMarkdownEditor
          v-if="reviewLang === 'ru'"
          v-model="form.description_ru"
          folder="casinos"
          placeholder="Обзор казино… лицензия, платежи, плюсы/минусы"
          height="480px"
        />
        <AdminMarkdownEditor
          v-else
          v-model="form.description_en"
          folder="casinos"
          placeholder="Casino review… license, payments, pros/cons"
          height="480px"
        />
      </div>

      <div class="flex flex-wrap gap-4 text-sm items-center">
        <AdminCheckbox v-model:checked="form.hot">
          HOT
        </AdminCheckbox>
        <AdminCheckbox v-model:checked="form.has_representative">
          Есть представитель
        </AdminCheckbox>
        <span
          v-if="data?.item?.representative_requested_at && !form.has_representative"
          class="text-xs text-amber-600"
        >
          Заявка на бейдж: {{ data.item.representative_requested_at }}
        </span>
        <Button
          v-if="data?.item?.representative_requested_at && !form.has_representative"
          type="button"
          size="sm"
          variant="secondary"
          @click="confirmRep"
        >
          Подтвердить бейдж
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <AdminConfirmDelete
          mode="button"
          entity="казино"
          :label="form.name"
          :busy="deleting"
          @confirm="removeCasino"
        />
        <span v-if="saveMsg" class="text-sm text-emerald-600">{{ saveMsg }}</span>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
