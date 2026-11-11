<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()

const fields = reactive({
  name: '',
  name_ru: '',
  name_en: '',
  slug: '',
  status: 'draft',
  hot: false,
  has_representative: false,
  logo_url: '',
  partner_url: '',
  license: '',
  short_desc_ru: '',
  short_desc_en: '',
  description_ru: '',
  description_en: '',
  editorial_score: '' as string,
  final_rating: '' as string,
})
const reviewLang = ref<'ru' | 'en'>('ru')
const slugTouched = ref(false)

watch(() => fields.name, (v) => {
  if (slugTouched.value)
    return
  fields.slug = v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
})

const saving = ref(false)
const saveErr = ref<string | null>(null)

async function create() {
  saving.value = true
  saveErr.value = null
  try {
    const res = await api<{ item: { id: string } }>('/v1/admin/casinos', {
      method: 'POST',
      body: {
        name: fields.name.trim(),
        slug: fields.slug.trim(),
        status: fields.status,
        name_ru: fields.name_ru || null,
        name_en: fields.name_en || null,
        hot: fields.hot,
        has_representative: fields.has_representative,
        logo_url: fields.logo_url || null,
        partner_url: fields.partner_url || null,
        license: fields.license || null,
        short_desc_ru: fields.short_desc_ru || null,
        short_desc_en: fields.short_desc_en || null,
        description_ru: fields.description_ru || null,
        description_en: fields.description_en || null,
        editorial_score: fields.editorial_score === '' ? null : Number(fields.editorial_score),
        final_rating: fields.final_rating === '' ? null : Number(fields.final_rating),
      },
    })
    await navigateTo(`/admin/casinos/${res.item.id}`)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    saveErr.value = status === 409 ? 'Slug уже занят' : 'Не удалось создать'
  }
  finally {
    saving.value = false
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
        Новое казино
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="casinos-edit" />
      </div>
    </div>

    <form class="grid gap-4" @submit.prevent="create">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Name</Label>
          <Input v-model="fields.name" required />
        </div>
        <div class="grid gap-2">
          <Label>Slug</Label>
          <Input
            v-model="fields.slug"
            required
            @input="slugTouched = true"
          />
        </div>
        <div class="grid gap-2">
          <Label>Name RU</Label>
          <Input v-model="fields.name_ru" />
        </div>
        <div class="grid gap-2">
          <Label>Name EN</Label>
          <Input v-model="fields.name_en" />
        </div>
        <div class="grid gap-2">
          <Label>Статус</Label>
          <AdminSelect
            v-model="fields.status"
            :options="[
              { value: 'draft', label: 'draft' },
              { value: 'review', label: 'review' },
              { value: 'published', label: 'published' },
            ]"
          />
        </div>
        <div class="grid gap-2">
          <Label>License</Label>
          <Input v-model="fields.license" />
        </div>
        <div class="grid gap-2">
          <Label>Editorial score</Label>
          <Input v-model="fields.editorial_score" type="number" step="0.1" min="0" max="10" />
        </div>
        <div class="grid gap-2">
          <Label>Final rating</Label>
          <Input v-model="fields.final_rating" type="number" step="0.1" min="0" max="10" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Logo URL</Label>
          <Input v-model="fields.logo_url" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Partner URL (/go)</Label>
          <Input v-model="fields.partner_url" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Short desc RU</Label>
          <Textarea v-model="fields.short_desc_ru" rows="3" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Short desc EN</Label>
          <Textarea v-model="fields.short_desc_en" rows="3" />
        </div>
      </div>

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
          v-model="fields.description_ru"
          folder="casinos"
          placeholder="Обзор казино… лицензия, платежи, плюсы/минусы"
          height="480px"
        />
        <AdminMarkdownEditor
          v-else
          v-model="fields.description_en"
          folder="casinos"
          placeholder="Casino review… license, payments, pros/cons"
          height="480px"
        />
      </div>

      <div class="flex flex-wrap gap-4 text-sm items-center">
        <AdminCheckbox v-model:checked="fields.hot">
          HOT
        </AdminCheckbox>
        <AdminCheckbox v-model:checked="fields.has_representative">
          Есть представитель
        </AdminCheckbox>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving || !fields.name.trim() || !fields.slug.trim()">
          {{ saving ? 'Создание…' : 'Создать' }}
        </Button>
        <Button as-child type="button" variant="outline">
          <NuxtLink to="/admin/casinos">
            Отмена
          </NuxtLink>
        </Button>
        <span v-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
