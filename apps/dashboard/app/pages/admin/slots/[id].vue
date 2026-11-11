<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const id = computed(() => String(route.params.id))

interface Slot {
  id: string
  slug: string
  title: string
  status: string
  theme: string
  volatility: string
  rtp: string | number | null
  provider_id: string | null
  provider_name: string | null
  demo_url: string | null
  grid: string | null
  release_date: string | null
  description_ru: string | null
  description_en: string | null
}

interface Provider {
  id: string
  slug: string
  name: string
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-slot-${id.value}`,
  () => api<{ item: Slot }>(`/v1/admin/slots/${id.value}`),
)

const { data: providersData } = await useAsyncData(
  'admin-game-providers',
  () => api<{ items: Provider[] }>('/v1/admin/game-providers'),
)

const form = reactive({
  title: '',
  slug: '',
  status: 'draft',
  theme: 'fruits',
  volatility: 'medium',
  rtp: '' as string,
  provider_id: '' as string,
  demo_url: '',
  grid: '',
  release_date: '',
  description_ru: '',
  description_en: '',
})

watch(
  () => data.value?.item,
  (item) => {
    if (!item)
      return
    form.title = item.title || ''
    form.slug = item.slug || ''
    form.status = item.status || 'draft'
    form.theme = item.theme || 'fruits'
    form.volatility = item.volatility || 'medium'
    form.rtp = item.rtp != null ? String(item.rtp) : ''
    form.provider_id = item.provider_id || ''
    form.demo_url = item.demo_url || ''
    form.grid = item.grid || ''
    form.release_date = item.release_date ? String(item.release_date).slice(0, 10) : ''
    form.description_ru = item.description_ru || ''
    form.description_en = item.description_en || ''
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
    await api(`/v1/admin/slots/${id.value}`, {
      method: 'PATCH',
      body: {
        title: form.title,
        slug: form.slug,
        status: form.status,
        theme: form.theme,
        volatility: form.volatility,
        rtp: form.rtp === '' ? null : Number(form.rtp),
        provider_id: form.provider_id || null,
        demo_url: form.demo_url || null,
        grid: form.grid || null,
        release_date: form.release_date || null,
        description_ru: form.description_ru || null,
        description_en: form.description_en || null,
      },
    })
    saveMsg.value = 'Сохранено'
    await refresh()
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number, data?: { error?: string } }).statusCode
    const err = (e as { data?: { error?: string } }).data?.error
    saveErr.value = status === 409 || err === 'slug_taken' ? 'Slug уже занят' : 'Ошибка сохранения'
  }
  finally {
    saving.value = false
  }
}

async function removeSlot() {
  deleting.value = true
  try {
    await api(`/v1/admin/slots/${id.value}`, { method: 'DELETE' })
    await navigateTo('/admin/slots')
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
        <NuxtLink to="/admin/slots">
          ← Слоты
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ form.title || 'Слот' }}
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="slots-edit" />
      </div>
    </div>

    <AdminFormSkeleton v-if="pending && !data" />
    <p v-else-if="error" class="text-sm text-destructive">
      Не найдено
    </p>

    <form v-else class="grid gap-4" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Название</Label>
          <Input v-model="form.title" required />
        </div>
        <div class="grid gap-2">
          <Label>Slug</Label>
          <Input v-model="form.slug" required />
        </div>
        <div class="grid gap-2">
          <Label>Статус (показ на сайте)</Label>
          <AdminSelect
            v-model="form.status"
            :options="[
              { value: 'draft', label: 'draft — скрыт' },
              { value: 'published', label: 'published — на сайте' },
              { value: 'hidden', label: 'hidden — скрыт' },
            ]"
          />
        </div>
        <div class="grid gap-2">
          <Label>Провайдер</Label>
          <AdminSelect
            v-model="form.provider_id"
            :options="[
              { value: '', label: '— без провайдера —' },
              ...(providersData?.items || []).map(p => ({ value: p.id, label: p.name })),
            ]"
          />
        </div>
        <div class="grid gap-2">
          <Label>Тема</Label>
          <Input v-model="form.theme" />
        </div>
        <div class="grid gap-2">
          <Label>Волатильность</Label>
          <AdminSelect
            v-model="form.volatility"
            :options="[
              { value: 'low', label: 'low' },
              { value: 'medium', label: 'medium' },
              { value: 'high', label: 'high' },
            ]"
          />
        </div>
        <div class="grid gap-2">
          <Label>RTP %</Label>
          <Input v-model="form.rtp" type="number" step="0.1" min="0" max="100" />
        </div>
        <div class="grid gap-2">
          <Label>Сетка</Label>
          <Input v-model="form.grid" placeholder="5x3" />
        </div>
        <div class="grid gap-2">
          <Label>Дата релиза</Label>
          <Input v-model="form.release_date" type="date" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Demo URL</Label>
          <Input v-model="form.demo_url" placeholder="https://…" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание RU</Label>
          <Textarea v-model="form.description_ru" rows="4" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание EN</Label>
          <Textarea v-model="form.description_en" rows="4" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <span v-if="saveMsg" class="text-sm text-emerald-600">{{ saveMsg }}</span>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
        <div class="ml-auto">
          <AdminConfirmDelete
            mode="button"
            entity="слот"
            :label="form.title"
            :busy="deleting"
            @confirm="removeSlot"
          />
        </div>
      </div>
    </form>
  </div>
</template>
