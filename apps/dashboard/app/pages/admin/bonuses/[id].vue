<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const id = computed(() => String(route.params.id))

interface Bonus {
  id: string
  casino_id: string
  title: string
  title_ru: string | null
  title_en: string | null
  promo_code: string | null
  type: string | null
  amount_or_percent: string | null
  wager: string | null
  min_deposit: string | null
  valid_until: string | null
  description_ru: string | null
  description_en: string | null
  status: string
  published: boolean
  casino_name: string
  casino_slug: string
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-bonus-${id.value}`,
  () => api<{ item: Bonus }>(`/v1/admin/bonuses/${id.value}`),
)

function emptySeo() {
  return { ru: {} as Record<string, string>, en: {} as Record<string, string>, ogImage: null as string | null }
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
  return base
}

const fields = reactive({
  title: '',
  title_ru: '',
  title_en: '',
  promo_code: '',
  type: '',
  amount_or_percent: '',
  wager: '',
  min_deposit: '',
  valid_until: '',
  description_ru: '',
  description_en: '',
  status: 'active',
  published: false,
  seo: emptySeo(),
})

function toLocalInput(iso: string | null | undefined) {
  if (!iso)
    return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(
  () => data.value?.item,
  (item) => {
    if (!item)
      return
    fields.title = item.title || ''
    fields.title_ru = item.title_ru || ''
    fields.title_en = item.title_en || ''
    fields.promo_code = item.promo_code || ''
    fields.type = item.type || ''
    fields.amount_or_percent = item.amount_or_percent || ''
    fields.wager = item.wager || ''
    fields.min_deposit = item.min_deposit || ''
    fields.valid_until = toLocalInput(item.valid_until)
    fields.description_ru = item.description_ru || ''
    fields.description_en = item.description_en || ''
    fields.status = item.status || 'active'
    fields.published = Boolean(item.published)
    fields.seo = normalizeSeo((item as Bonus & { seo?: unknown }).seo)
  },
  { immediate: true },
)

const saving = ref(false)
const saveMsg = ref<string | null>(null)
const saveErr = ref<string | null>(null)
const deleting = ref(false)

async function save() {
  saving.value = true
  saveMsg.value = null
  saveErr.value = null
  try {
    await api(`/v1/admin/bonuses/${id.value}`, {
      method: 'PATCH',
      body: {
        title: fields.title,
        title_ru: fields.title_ru || null,
        title_en: fields.title_en || null,
        promo_code: fields.promo_code || null,
        type: fields.type || null,
        amount_or_percent: fields.amount_or_percent || null,
        wager: fields.wager || null,
        min_deposit: fields.min_deposit || null,
        valid_until: fields.valid_until ? new Date(fields.valid_until).toISOString() : null,
        description_ru: fields.description_ru || null,
        description_en: fields.description_en || null,
        status: fields.status,
        published: fields.published,
        checked_by_editor: true,
        seo: fields.seo,
      },
    })
    saveMsg.value = 'Сохранено'
    await refresh()
  }
  catch {
    saveErr.value = 'Ошибка сохранения'
  }
  finally {
    saving.value = false
  }
}

async function removeBonus() {
  deleting.value = true
  try {
    await api(`/v1/admin/bonuses/${id.value}`, { method: 'DELETE' })
    await navigateTo('/admin/bonuses')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-3xl">
    <div class="flex flex-wrap items-center gap-3">
      <Button as-child variant="ghost" size="sm">
        <NuxtLink to="/admin/bonuses">
          ← Бонусы
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ fields.title_ru || fields.title || 'Бонус' }}
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="bonuses-edit" />
      </div>
    </div>

    <AdminFormSkeleton v-if="pending && !data" :fields="4" />
    <p v-else-if="error" class="text-sm text-destructive">
      Не найдено
    </p>

    <form v-else class="grid gap-4" @submit.prevent="save">
      <p class="text-sm text-muted-foreground">
        Казино:
        <NuxtLink
          class="underline underline-offset-2"
          :to="`/admin/casinos/${data?.item.casino_id}`"
        >
          {{ data?.item.casino_name }}
        </NuxtLink>
        ({{ data?.item.casino_slug }})
      </p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2 sm:col-span-2">
          <Label>Title</Label>
          <Input v-model="fields.title" />
        </div>
        <div class="grid gap-2">
          <Label>Title RU</Label>
          <Input v-model="fields.title_ru" />
        </div>
        <div class="grid gap-2">
          <Label>Title EN</Label>
          <Input v-model="fields.title_en" />
        </div>
        <div class="grid gap-2">
          <Label>Promo code</Label>
          <Input v-model="fields.promo_code" />
        </div>
        <div class="grid gap-2">
          <Label>Type</Label>
          <Input v-model="fields.type" />
        </div>
        <div class="grid gap-2">
          <Label>Amount / %</Label>
          <Input v-model="fields.amount_or_percent" />
        </div>
        <div class="grid gap-2">
          <Label>Wager</Label>
          <Input v-model="fields.wager" />
        </div>
        <div class="grid gap-2">
          <Label>Min deposit</Label>
          <Input v-model="fields.min_deposit" />
        </div>
        <div class="grid gap-2">
          <Label>Действует до</Label>
          <Input v-model="fields.valid_until" type="datetime-local" />
        </div>
        <div class="grid gap-2">
          <Label>Status</Label>
          <AdminSelect
            v-model="fields.status"
            :options="[
              { value: 'active', label: 'active' },
              { value: 'hidden', label: 'hidden' },
            ]"
          />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание RU</Label>
          <Textarea v-model="fields.description_ru" rows="3" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание EN</Label>
          <Textarea v-model="fields.description_en" rows="3" />
        </div>
      </div>

      <AdminCheckbox v-model:checked="fields.published">
        Показывать на сайте
      </AdminCheckbox>

      <AdminEntitySeoFields v-model="fields.seo" />

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <AdminConfirmDelete
          mode="button"
          entity="бонус"
          :label="fields.title_ru || fields.title"
          :busy="deleting"
          @confirm="removeBonus"
        />
        <span v-if="saveMsg" class="text-sm text-emerald-600">{{ saveMsg }}</span>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
