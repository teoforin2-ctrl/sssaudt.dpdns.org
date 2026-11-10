<script setup lang="ts">
import { Eye, EyeOff, Pencil } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const q = ref('')
const page = ref(1)
const creating = ref(false)
const createErr = ref<string | null>(null)

interface Row {
  id: string
  slug: string
  kind: string
  title_ru: string
  title_en: string
  status: string
  published_at: string
}

interface ListRes { items: Row[], total: number }

const { data, pending, refresh } = await useAsyncData(
  'admin-articles',
  () => api<ListRes>('/v1/admin/articles', { query: { q: q.value || undefined, page: page.value, limit: 20 } }),
  { watch: [page] },
)

async function search() {
  page.value = 1
  await refresh()
}

async function createArticle() {
  creating.value = true
  createErr.value = null
  try {
    const stamp = Date.now().toString(36)
    const res = await api<{ item: { id: string } }>('/v1/admin/articles', {
      method: 'POST',
      body: {
        slug: `article-${stamp}`,
        title_ru: 'Новая статья',
        title_en: 'New article',
        kind: 'guide',
        status: 'draft',
        excerpt_ru: '',
        excerpt_en: '',
        body_md_ru: '',
        body_md_en: '',
        reading_minutes: 5,
      },
    })
    await navigateTo(`/admin/articles/${res.item.id}`)
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    createErr.value = e?.data?.error ? `Ошибка: ${e.data.error}` : (e?.message || 'Не удалось создать')
  }
  finally {
    creating.value = false
  }
}

const busyId = ref<string | null>(null)

async function togglePublish(row: Row) {
  await api(`/v1/admin/articles/${row.id}`, {
    method: 'PATCH',
    body: { status: row.status === 'published' ? 'draft' : 'published' },
  })
  await refresh()
}

async function removeArticle(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/articles/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Статьи
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} записей · RU / EN
        </p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <div class="flex flex-wrap items-center justify-end gap-2">
          <AdminSectionHelp section="articles" />
          <Button :disabled="creating" @click="createArticle">
            {{ creating ? 'Создание…' : 'Создать статью' }}
          </Button>
        </div>
        <span v-if="createErr" class="text-xs text-destructive">{{ createErr }}</span>
      </div>
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Заголовок / slug" />
      <Button type="submit" variant="secondary" :disabled="pending">
        Найти
      </Button>
    </form>

    <AdminTableSkeleton v-if="pending && !data" :cols="4" />
    <div v-else class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="px-3 py-2 font-medium">
              Заголовок
            </th>
            <th class="px-3 py-2 font-medium">
              Kind
            </th>
            <th class="px-3 py-2 font-medium">
              Показ
            </th>
            <th class="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items || []" :key="row.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.title_ru }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ row.slug }}
              </div>
            </td>
            <td class="px-3 py-2">
              {{ row.kind }}
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.status === 'published' ? 'default' : 'secondary'">
                {{ row.status === 'published' ? 'на сайте' : row.status }}
              </Badge>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  :tooltip="row.status === 'published' ? 'Скрыть с сайта' : 'Показать на сайте'"
                  :icon="row.status === 'published' ? EyeOff : Eye"
                  @click="togglePublish(row)"
                />
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  :to="`/admin/articles/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="статью"
                  :label="row.title_ru"
                  :busy="busyId === row.id"
                  @confirm="removeArticle(row.id)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
