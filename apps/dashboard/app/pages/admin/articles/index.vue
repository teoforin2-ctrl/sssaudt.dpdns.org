<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  FileText,
  Pencil,
  Plus,
  Search,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'
const q = ref('')
const page = ref(1)
const limit = ref(20)
const statusFilter = ref('all')
const kindFilter = ref('all')
const creating = ref(false)
const createErr = ref<string | null>(null)

const brokenCovers = ref(new Set<string>())

function coverSrc(url: string | null | undefined) {
  if (!url || brokenCovers.value.has(url))
    return null
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'))
    return url
  if (url.startsWith('/'))
    return `${webOrigin}${url}`
  return `${webOrigin}/uploads/articles/${url}`
}

function onCoverError(url: string | null) {
  if (!url)
    return
  const next = new Set(brokenCovers.value)
  next.add(url)
  brokenCovers.value = next
}

interface Row {
  id: string
  slug: string
  kind: string
  title_ru: string
  title_en: string
  status: string
  published_at: string
  updated_at: string
  cover_url: string | null
  reading_minutes: number | null
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    total: number
    published: number
    draft: number
    byKind: Array<{ name: string, value: number }>
  }
}

const listKey = computed(() =>
  `admin-articles-${page.value}-${limit.value}-${statusFilter.value}-${kindFilter.value}-${q.value}`,
)

const { data, pending, refresh } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/articles', {
    query: {
      q: q.value || undefined,
      page: page.value,
      limit: limit.value,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      kind: kindFilter.value !== 'all' ? kindFilter.value : undefined,
    },
  }),
  { watch: [page, limit, statusFilter, kindFilter] },
)

async function search() {
  page.value = 1
  await refresh()
}

watch([statusFilter, kindFilter, limit], () => {
  page.value = 1
})

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const summary = computed(() => data.value?.summary)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / limit.value)))

const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Всего', value: s?.total ?? data.value?.total ?? 0, hint: 'статей', tone: 'violet' as AdminTone, icon: FileText },
    { label: 'Опубликовано', value: s?.published ?? 0, hint: 'на сайте', tone: 'emerald' as AdminTone, icon: FileText },
    { label: 'Черновики', value: s?.draft ?? 0, hint: 'draft', tone: 'amber' as AdminTone, icon: FileText },
    {
      label: 'Типы',
      value: s?.byKind?.length ?? 0,
      hint: (s?.byKind || []).map(k => `${k.name}:${k.value}`).join(' · ') || '—',
      tone: 'cyan' as AdminTone,
      icon: FileText,
    },
  ]
})

function kindClass(kind: string) {
  if (kind === 'news')
    return 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400'
  if (kind === 'analytics')
    return 'border-violet-500/40 text-violet-700 dark:text-violet-400'
  return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
}

const busyId = ref<string | null>(null)
const busyPub = ref<Set<string>>(new Set())

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

async function togglePublish(row: Row, on: boolean) {
  const prev = row.status
  row.status = on ? 'published' : 'draft'
  busyPub.value.add(row.id)
  try {
    await api(`/v1/admin/articles/${row.id}`, {
      method: 'PATCH',
      body: { status: row.status },
    })
  }
  catch {
    row.status = prev
  }
  finally {
    busyPub.value.delete(row.id)
  }
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
  <div class="space-y-6">
    <AdminPageHeader
      title="Статьи"
      :description="`${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')} записей · RU / EN`"
      help="articles"
    >
      <template #actions>
        <Button size="sm" :disabled="creating" @click="createArticle">
          <Plus class="size-4" />
          {{ creating ? 'Создание…' : 'Создать статью' }}
        </Button>
      </template>
    </AdminPageHeader>
    <p v-if="createErr" class="text-sm text-destructive">
      {{ createErr }}
    </p>

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="card.icon"
        :tone="card.tone"
        :ready="ready && !pending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <form class="flex min-w-[220px] flex-1 gap-2" @submit.prevent="search">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="q" class="pl-8" placeholder="Заголовок / slug" />
        </div>
        <Button type="submit" variant="secondary" :disabled="pending">
          Найти
        </Button>
      </form>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: 'all', label: 'Все' },
            { id: 'published', label: 'Опубликовано' },
            { id: 'draft', label: 'Черновики' },
          ]"
          :key="chip.id"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="statusFilter === chip.id
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="statusFilter = chip.id"
        >
          {{ chip.label }}
        </button>
      </div>
      <AdminSelect
        v-model="kindFilter"
        class="w-[150px]"
        size="sm"
        :options="[
          { value: 'all', label: 'Все типы' },
          { value: 'guide', label: 'guide' },
          { value: 'news', label: 'news' },
          { value: 'analytics', label: 'analytics' },
        ]"
      />
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Статья
            </th>
            <th class="px-3 py-2.5 font-medium">
              Kind
            </th>
            <th class="px-3 py-2.5 font-medium">
              Языки
            </th>
            <th class="px-3 py-2.5 font-medium">
              Обновлено
            </th>
            <th class="px-3 py-2.5 font-medium">
              На сайте
            </th>
            <th class="px-3 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data?.items || []"
            :key="row.id"
            class="border-t transition-colors hover:bg-muted/40"
            style="height: 52px"
          >
            <td class="px-3 py-2">
              <div class="flex items-center gap-3">
                <div class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
                  <img
                    v-if="coverSrc(row.cover_url)"
                    :src="coverSrc(row.cover_url)!"
                    alt=""
                    class="size-10 object-cover"
                    loading="lazy"
                    @error="onCoverError(row.cover_url)"
                  >
                  <FileText v-else class="size-4 text-muted-foreground" />
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium">
                    {{ row.title_ru }}
                  </div>
                  <div class="font-mono text-xs text-muted-foreground">
                    {{ row.slug }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-3 py-2">
              <Badge variant="outline" class="font-normal capitalize" :class="kindClass(row.kind)">
                {{ row.kind }}
              </Badge>
            </td>
            <td class="px-3 py-2">
              <div class="flex gap-1">
                <Badge variant="outline" class="px-1.5 font-normal">
                  RU
                </Badge>
                <Badge
                  variant="outline"
                  class="px-1.5 font-normal"
                  :class="row.title_en ? '' : 'opacity-40'"
                >
                  EN
                </Badge>
              </div>
            </td>
            <td class="px-3 py-2 text-xs tabular-nums text-muted-foreground">
              {{ row.updated_at ? new Date(row.updated_at).toLocaleDateString('ru-RU') : '—' }}
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-2">
                <Switch
                  :model-value="row.status === 'published'"
                  :disabled="busyPub.has(row.id)"
                  @update:model-value="(v: boolean) => togglePublish(row, v)"
                />
                <Button
                  v-if="row.status === 'draft'"
                  size="sm"
                  variant="outline"
                  class="h-7 text-xs text-emerald-600"
                  :disabled="busyPub.has(row.id)"
                  @click="togglePublish(row, true)"
                >
                  Опубликовать
                </Button>
              </div>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
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
          <tr v-if="!pending && !(data?.items?.length)">
            <td colspan="6" class="px-3 py-2">
              <AdminUiAdminEmptyState
                title="Нет статей"
                description="Создайте первую статью"
                :icon="FileText"
                cta="Создать статью"
                @click="createArticle"
              >
                <Button size="sm" class="mt-2" :disabled="creating" @click="createArticle">
                  Создать статью
                </Button>
              </AdminUiAdminEmptyState>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-muted-foreground">
        стр. {{ page }} / {{ totalPages }}
      </p>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="page <= 1 || pending" @click="page--">
          Назад
        </Button>
        <Button size="sm" variant="outline" :disabled="page >= totalPages || pending" @click="page++">
          Далее
        </Button>
      </div>
    </div>
  </div>
</template>
