<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()

interface CasinoOpt {
  id: string
  name: string
  slug: string
}

const casinoQ = ref('')
const { data: casinosData, pending: casinosPending, refresh: refreshCasinos } = await useAsyncData(
  () => `bonus-casino-pick-${casinoQ.value}`,
  () => api<{ items: CasinoOpt[] }>('/v1/admin/casinos', {
    query: { q: casinoQ.value || undefined, limit: 30, page: 1 },
  }),
  { watch: [casinoQ] },
)

const fields = reactive({
  casino_id: '',
  title: '',
  title_ru: '',
  title_en: '',
  promo_code: '',
  type: 'welcome',
  amount_or_percent: '',
  wager: '',
  min_deposit: '',
  valid_until: '',
  description_ru: '',
  description_en: '',
  status: 'active',
  published: true,
})

watch(() => fields.title, (v) => {
  if (!fields.title_ru)
    fields.title_ru = v
})

const saving = ref(false)
const saveErr = ref<string | null>(null)

async function create() {
  saving.value = true
  saveErr.value = null
  try {
    const res = await api<{ item: { id: string } }>('/v1/admin/bonuses', {
      method: 'POST',
      body: {
        casino_id: fields.casino_id,
        title: fields.title.trim(),
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
      },
    })
    await navigateTo(`/admin/bonuses/${res.item.id}`)
  }
  catch (e: unknown) {
    const err = (e as { data?: { error?: string } }).data?.error
    saveErr.value = err === 'casino_not_found' ? 'Казино не найдено' : 'Не удалось создать'
  }
  finally {
    saving.value = false
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
        Новый бонус
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="bonuses-edit" />
      </div>
    </div>

    <form class="grid gap-4" @submit.prevent="create">
      <div class="rounded-xl border p-4 space-y-3">
        <Label>Казино</Label>
        <Input
          v-model="casinoQ"
          placeholder="Поиск казино по имени / slug"
          @keyup.enter="refreshCasinos()"
        />
        <AdminSelect
          v-model="fields.casino_id"
          :placeholder="casinosPending ? 'Загрузка…' : 'Выберите казино'"
          :options="[
            { value: '', label: casinosPending ? 'Загрузка…' : 'Выберите казино', disabled: true },
            ...(casinosData?.items || []).map(c => ({ value: c.id, label: `${c.name} (${c.slug})` })),
          ]"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2 sm:col-span-2">
          <Label>Title</Label>
          <Input v-model="fields.title" required />
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
          <Input v-model="fields.type" placeholder="welcome / reload / freespins" />
        </div>
        <div class="grid gap-2">
          <Label>Amount / %</Label>
          <Input v-model="fields.amount_or_percent" placeholder="100% до 200$" />
        </div>
        <div class="grid gap-2">
          <Label>Wager</Label>
          <Input v-model="fields.wager" placeholder="x35" />
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

      <div class="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          :disabled="saving || !fields.casino_id || !fields.title.trim()"
        >
          {{ saving ? 'Создание…' : 'Создать' }}
        </Button>
        <Button as-child type="button" variant="outline">
          <NuxtLink to="/admin/bonuses">
            Отмена
          </NuxtLink>
        </Button>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
