<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()

interface Provider {
  id: string
  slug: string
  name: string
}

interface SlotDraft {
  title: string
  slug: string
  status: string
  theme: string
  volatility: string
  rtp: string
  provider_id: string
  demo_url: string
  grid: string
  release_date: string
  description_ru: string
  description_en: string
}

const { data: providersData } = await useAsyncData(
  'admin-game-providers',
  () => api<{ items: Provider[] }>('/v1/admin/game-providers'),
)

const slot = ref<SlotDraft>({
  title: '',
  slug: '',
  status: 'draft',
  theme: 'fruits',
  volatility: 'medium',
  rtp: '',
  provider_id: '',
  demo_url: '',
  grid: '',
  release_date: '',
  description_ru: '',
  description_en: '',
})

const slugTouched = ref(false)
const saving = ref(false)
const saveErr = ref<string | null>(null)

watch(() => slot.value.title, (v) => {
  if (slugTouched.value)
    return
  slot.value.slug = v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
})

const canSubmit = computed(() =>
  Boolean(slot.value.title.trim() && slot.value.slug.trim() && !saving.value),
)

function setField<K extends keyof SlotDraft>(key: K, value: string | number) {
  slot.value[key] = String(value) as SlotDraft[K]
}

async function create() {
  saving.value = true
  saveErr.value = null
  try {
    const s = slot.value
    const res = await api<{ item: { id: string } }>('/v1/admin/slots', {
      method: 'POST',
      body: {
        title: s.title.trim(),
        slug: s.slug.trim(),
        status: s.status,
        theme: s.theme || 'fruits',
        volatility: s.volatility || 'medium',
        rtp: s.rtp === '' ? null : Number(s.rtp),
        provider_id: s.provider_id || null,
        demo_url: s.demo_url || null,
        grid: s.grid || null,
        release_date: s.release_date || null,
        description_ru: s.description_ru || null,
        description_en: s.description_en || null,
      },
    })
    await navigateTo(`/admin/slots/${res.item.id}`)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number, data?: { error?: string } }).statusCode
    const err = (e as { data?: { error?: string } }).data?.error
    saveErr.value = status === 409 || err === 'slug_taken' ? 'Slug уже занят' : 'Не удалось создать'
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
        <NuxtLink to="/admin/slots">
          ← Слоты
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">
        Новый слот
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="slots-edit" />
      </div>
    </div>

    <form class="grid gap-4" @submit.prevent="create">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Название</Label>
          <Input
            :model-value="slot.title"
            required
            @update:model-value="setField('title', $event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>Slug</Label>
          <Input
            :model-value="slot.slug"
            required
            @update:model-value="(v) => { slugTouched = true; setField('slug', v) }"
          />
        </div>
        <div class="grid gap-2">
          <Label>Статус (показ на сайте)</Label>
          <select v-model="slot.status" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
            <option value="draft">
              draft — скрыт
            </option>
            <option value="published">
              published — на сайте
            </option>
            <option value="hidden">
              hidden — скрыт
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <Label>Провайдер</Label>
          <select v-model="slot.provider_id" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
            <option value="">
              — без провайдера —
            </option>
            <option v-for="p in providersData?.items || []" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <Label>Тема</Label>
          <Input
            :model-value="slot.theme"
            @update:model-value="setField('theme', $event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>Волатильность</Label>
          <select v-model="slot.volatility" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
            <option value="low">
              low
            </option>
            <option value="medium">
              medium
            </option>
            <option value="high">
              high
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <Label>RTP %</Label>
          <Input
            :model-value="slot.rtp"
            type="number"
            step="0.1"
            min="0"
            max="100"
            @update:model-value="setField('rtp', $event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>Сетка</Label>
          <Input
            :model-value="slot.grid"
            placeholder="5x3"
            @update:model-value="setField('grid', $event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>Дата релиза</Label>
          <Input
            :model-value="slot.release_date"
            type="date"
            @update:model-value="setField('release_date', $event)"
          />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Demo URL</Label>
          <Input
            :model-value="slot.demo_url"
            placeholder="https://..."
            @update:model-value="setField('demo_url', $event)"
          />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание RU</Label>
          <Textarea
            :model-value="slot.description_ru"
            :rows="4"
            @update:model-value="setField('description_ru', $event)"
          />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Описание EN</Label>
          <Textarea
            :model-value="slot.description_en"
            :rows="4"
            @update:model-value="setField('description_en', $event)"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="!canSubmit">
          {{ saving ? 'Создание...' : 'Создать' }}
        </Button>
        <Button as-child type="button" variant="outline">
          <NuxtLink to="/admin/slots">
            Отмена
          </NuxtLink>
        </Button>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
