<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const id = computed(() => String(route.params.id))

interface Article {
  id: string
  slug: string
  kind: string
  topic: string | null
  title_ru: string
  title_en: string
  excerpt_ru: string | null
  excerpt_en: string | null
  body_md_ru: string | null
  body_md_en: string | null
  status: string
  reading_minutes: number
  cover_theme: string
  cover_url: string | null
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-article-${id.value}`,
  () => api<{ item: Article }>(`/v1/admin/articles/${id.value}`),
)

const form = reactive({
  slug: '',
  title_ru: '',
  title_en: '',
  excerpt_ru: '',
  excerpt_en: '',
  body_md_ru: '',
  body_md_en: '',
  status: 'published',
  kind: 'guide',
  topic: '',
  cover_theme: 'guide',
  cover_url: '',
  reading_minutes: 5,
})

const coverPreview = ref<string | null>(null)
const coverDataUrl = ref<string | null>(null)
const langTab = ref<'ru' | 'en'>('ru')

watch(
  () => data.value?.item,
  (item) => {
    if (!item)
      return
    form.slug = item.slug || ''
    form.title_ru = item.title_ru || ''
    form.title_en = item.title_en || ''
    form.excerpt_ru = item.excerpt_ru || ''
    form.excerpt_en = item.excerpt_en || ''
    form.body_md_ru = item.body_md_ru || ''
    form.body_md_en = item.body_md_en || ''
    form.status = item.status || 'published'
    form.kind = item.kind || 'guide'
    form.topic = item.topic || ''
    form.cover_theme = item.cover_theme || item.kind || 'guide'
    form.cover_url = item.cover_url || ''
    form.reading_minutes = item.reading_minutes || 5
    coverPreview.value = item.cover_url || null
    coverDataUrl.value = null
  },
  { immediate: true },
)

const saving = ref(false)
const saveMsg = ref<string | null>(null)
const saveErr = ref<string | null>(null)

function onCoverPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (!file.type.startsWith('image/'))
    return
  if (file.size > 4_500_000) {
    saveErr.value = 'Обложка слишком большая (макс. ~4.5 МБ)'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    coverDataUrl.value = result
    coverPreview.value = result
  }
  reader.readAsDataURL(file)
}

async function save() {
  saving.value = true
  saveMsg.value = null
  saveErr.value = null
  try {
    const body: Record<string, unknown> = {
      title_ru: form.title_ru.trim() || 'Без названия',
      title_en: form.title_en.trim() || 'Untitled',
      excerpt_ru: form.excerpt_ru || null,
      excerpt_en: form.excerpt_en || null,
      body_md_ru: form.body_md_ru || null,
      body_md_en: form.body_md_en || null,
      status: form.status,
      kind: form.kind,
      topic: form.topic || null,
      cover_theme: form.cover_theme || form.kind || 'guide',
      reading_minutes: Number(form.reading_minutes) || 5,
    }
    if (coverDataUrl.value)
      body.cover_data_url = coverDataUrl.value
    else if (form.cover_url !== undefined)
      body.cover_url = form.cover_url || null

    const res = await api<{ item: Article }>(`/v1/admin/articles/${id.value}`, {
      method: 'PATCH',
      body,
    })
    saveMsg.value = 'Сохранено'
    coverDataUrl.value = null
    if (res?.item?.cover_url) {
      form.cover_url = res.item.cover_url
      coverPreview.value = res.item.cover_url
    }
    await refresh()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, statusCode?: number, message?: string }
    saveErr.value = e?.data?.error
      ? `Ошибка: ${e.data.error}`
      : e?.message || 'Ошибка сохранения'
  }
  finally {
    saving.value = false
  }
}

const deleting = ref(false)

async function removeArticle() {
  deleting.value = true
  try {
    await api(`/v1/admin/articles/${id.value}`, { method: 'DELETE' })
    await navigateTo('/admin/articles')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-5xl">
    <div class="flex items-center gap-3">
      <Button as-child variant="ghost" size="sm">
        <NuxtLink to="/admin/articles">
          ← Статьи
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold">
        {{ form.title_ru || 'Статья' }}
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="articles-edit" />
      </div>
    </div>

    <AdminFormSkeleton v-if="pending && !data" :fields="5" />
    <p v-else-if="error" class="text-sm text-destructive">
      Не найдено
    </p>

    <form v-else class="grid gap-4" @submit.prevent="save">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Slug</Label>
          <Input :model-value="form.slug" disabled />
        </div>
        <div class="grid gap-2">
          <Label>Статус</Label>
          <select v-model="form.status" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
            <option value="draft">
              draft
            </option>
            <option value="published">
              published
            </option>
            <option value="hidden">
              hidden
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <Label>Kind</Label>
          <select v-model="form.kind" class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm">
            <option value="guide">
              guide
            </option>
            <option value="news">
              news
            </option>
            <option value="analytics">
              analytics
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <Label>Topic</Label>
          <Input v-model="form.topic" placeholder="Для новичков / Новости…" />
        </div>
        <div class="grid gap-2">
          <Label>Cover theme</Label>
          <Input v-model="form.cover_theme" />
        </div>
        <div class="grid gap-2">
          <Label>Reading minutes</Label>
          <Input v-model.number="form.reading_minutes" type="number" min="1" max="120" />
        </div>
      </div>

      <div class="grid gap-2">
        <Label>Обложка</Label>
        <div class="flex flex-wrap items-start gap-4">
          <div class="h-28 w-44 overflow-hidden rounded-lg border bg-muted">
            <img
              v-if="coverPreview"
              :src="coverPreview.startsWith('data:') || coverPreview.startsWith('http')
                ? coverPreview
                : `http://127.0.0.1:3710${coverPreview}`"
              alt="cover"
              class="h-full w-full object-cover"
            >
            <div v-else class="flex h-full items-center justify-center text-xs text-muted-foreground">
              нет обложки
            </div>
          </div>
          <div class="grid gap-2">
            <Input type="file" accept="image/png,image/jpeg,image/webp" @change="onCoverPick" />
            <Input v-model="form.cover_url" placeholder="/uploads/articles/… или URL" />
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <Button type="button" size="sm" :variant="langTab === 'ru' ? 'default' : 'outline'" @click="langTab = 'ru'">
          Русский
        </Button>
        <Button type="button" size="sm" :variant="langTab === 'en' ? 'default' : 'outline'" @click="langTab = 'en'">
          English
        </Button>
      </div>

      <template v-if="langTab === 'ru'">
        <div class="grid gap-2">
          <Label>Title RU</Label>
          <Input v-model="form.title_ru" />
        </div>
        <div class="grid gap-2">
          <Label>Excerpt RU</Label>
          <Textarea v-model="form.excerpt_ru" rows="2" />
        </div>
        <div class="grid gap-2">
          <Label>Текст статьи (RU)</Label>
          <AdminMarkdownEditor
            v-model="form.body_md_ru"
            folder="articles"
            placeholder="Обзор, гайд, новость… Можно вставить картинки через toolbar → image"
            height="520px"
          />
        </div>
      </template>
      <template v-else>
        <div class="grid gap-2">
          <Label>Title EN</Label>
          <Input v-model="form.title_en" />
        </div>
        <div class="grid gap-2">
          <Label>Excerpt EN</Label>
          <Textarea v-model="form.excerpt_en" rows="2" />
        </div>
        <div class="grid gap-2">
          <Label>Article body (EN)</Label>
          <AdminMarkdownEditor
            v-model="form.body_md_en"
            folder="articles"
            placeholder="Write the article… Upload images via the toolbar"
            height="520px"
          />
        </div>
      </template>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <AdminConfirmDelete
          mode="button"
          entity="статью"
          :label="form.title_ru"
          :busy="deleting"
          @confirm="removeArticle"
        />
        <span v-if="saving" class="text-sm text-muted-foreground" role="status">
          Отправка…
        </span>
        <span v-else-if="saveMsg" class="text-sm text-emerald-600">{{ saveMsg }}</span>
        <span v-else-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
