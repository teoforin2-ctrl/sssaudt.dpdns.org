<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { Eye, EyeOff, Lock, LockOpen, MessageSquare, MessagesSquare } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const q = ref('')
const status = ref('')
const page = ref(1)
const expanded = ref<string | null>(null)
const posts = ref<Array<{
  id: string
  author_name: string
  body_md: string
  status: string
  created_at: string
}>>([])
const postsLoading = ref(false)
const busyId = ref<string | null>(null)

interface Row {
  id: string
  slug: string
  title: string
  author_name: string
  posts_count: number
  views_count: number
  is_locked: boolean
  is_pinned: boolean
  status: string
  category_title: string
  last_post_at: string
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    topics: number
    posts: number
    hidden: number
    locked: number
  }
}

const { data, pending, refresh } = await useAsyncData(
  'admin-forum-topics',
  () => api<ListRes>('/v1/admin/forum/topics', {
    query: {
      q: q.value || undefined,
      status: status.value || undefined,
      page: page.value,
      limit: 20,
    },
  }),
  { watch: [page, status] },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const summary = computed(() => data.value?.summary)
const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Тем', value: s?.topics ?? data.value?.total ?? 0, hint: 'всего', tone: 'violet' as AdminTone, icon: MessagesSquare },
    { label: 'Постов', value: s?.posts ?? 0, hint: 'сообщений', tone: 'cyan' as AdminTone, icon: MessageSquare },
    { label: 'Скрытых', value: s?.hidden ?? 0, hint: 'тем', tone: 'amber' as AdminTone, icon: EyeOff },
    { label: 'Закрытых', value: s?.locked ?? 0, hint: 'locked', tone: 'rose' as AdminTone, icon: Lock },
  ]
})

function relativeTime(iso: string) {
  if (!iso)
    return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 48)
    return `${hours} ч`
  return new Date(iso).toLocaleDateString('ru-RU')
}

async function search() {
  page.value = 1
  await refresh()
}

async function patchTopic(id: string, body: Record<string, unknown>) {
  busyId.value = id
  try {
    await api(`/v1/admin/forum/topics/${id}`, { method: 'PATCH', body })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function removeTopic(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/forum/topics/${id}`, { method: 'DELETE' })
    if (expanded.value === id)
      expanded.value = null
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function togglePosts(row: Row) {
  if (expanded.value === row.id) {
    expanded.value = null
    posts.value = []
    return
  }
  postsLoading.value = true
  expanded.value = row.id
  try {
    const res = await api<{ items: typeof posts.value }>(`/v1/admin/forum/topics/${row.id}/posts`)
    posts.value = res.items
  }
  finally {
    postsLoading.value = false
  }
}

async function setPostStatus(id: string, next: 'published' | 'hidden' | 'deleted') {
  await api(`/v1/admin/forum/posts/${id}`, { method: 'PATCH', body: { status: next } })
  if (expanded.value) {
    const res = await api<{ items: typeof posts.value }>(`/v1/admin/forum/topics/${expanded.value}/posts`)
    posts.value = res.items
  }
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Модерация форума"
      :description="`${data?.total ?? 0} тем · скрытие / закрытие / удаление`"
      help="forum"
    />

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
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: '', label: 'Все' },
            { id: 'published', label: 'Published' },
            { id: 'hidden', label: 'Hidden' },
            { id: 'deleted', label: 'Deleted' },
          ]"
          :key="chip.id || 'all'"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="status === chip.id
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="status = chip.id; page = 1"
        >
          {{ chip.label }}
        </button>
      </div>
      <Input v-model="q" class="max-w-sm flex-1" placeholder="Тема / автор / slug" @keyup.enter="search" />
      <Button variant="secondary" :disabled="pending" @click="search">
        Найти
      </Button>
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Тема
            </th>
            <th class="px-3 py-2.5 font-medium">
              Автор
            </th>
            <th class="px-3 py-2.5 font-medium">
              Посты
            </th>
            <th class="px-3 py-2.5 font-medium">
              Статус
            </th>
            <th class="px-3 py-2.5 font-medium text-right">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in data?.items || []" :key="row.id">
            <tr class="border-t align-top">
              <td class="px-3 py-2">
                <div class="font-medium max-w-md">
                  {{ row.title }}
                </div>
                <div class="text-xs text-muted-foreground">
                  <Badge variant="outline" class="mr-1 font-normal">
                    {{ row.category_title }}
                  </Badge>
                  {{ row.slug }}
                  <span v-if="row.is_locked"> · locked</span>
                  <span v-if="row.is_pinned"> · pinned</span>
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="font-medium">
                  {{ row.author_name }}
                </div>
                <div class="text-xs text-muted-foreground" :title="row.last_post_at ? new Date(row.last_post_at).toLocaleString('ru-RU') : ''">
                  {{ relativeTime(row.last_post_at) }}
                </div>
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ row.posts_count }}
              </td>
              <td class="px-3 py-2">
                <AdminUiAdminStatusBadge :status="row.status" />
              </td>
              <td class="px-3 py-2">
                <div class="inline-flex items-center justify-end gap-0.5">
                  <AdminIconButton
                    tooltip="Посты"
                    :icon="MessagesSquare"
                    :disabled="busyId === row.id"
                    @click="togglePosts(row)"
                  />
                  <AdminIconButton
                    :tooltip="row.is_locked ? 'Открыть тему' : 'Закрыть тему'"
                    :icon="row.is_locked ? LockOpen : Lock"
                    :disabled="busyId === row.id"
                    @click="patchTopic(row.id, { is_locked: !row.is_locked })"
                  />
                  <AdminIconButton
                    :tooltip="row.status === 'published' ? 'Скрыть тему' : 'Показать тему'"
                    :icon="row.status === 'published' ? EyeOff : Eye"
                    :disabled="busyId === row.id"
                    @click="patchTopic(row.id, { status: row.status === 'published' ? 'hidden' : 'published' })"
                  />
                  <AdminConfirmDelete
                    entity="тему"
                    :label="row.title"
                    :busy="busyId === row.id"
                    @confirm="removeTopic(row.id)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="expanded === row.id" class="border-t bg-muted/20">
              <td colspan="5" class="px-3 py-3">
                <p v-if="postsLoading" class="text-sm text-muted-foreground">
                  Загрузка постов…
                </p>
                <div v-else class="space-y-2">
                  <div
                    v-for="p in posts"
                    :key="p.id"
                    class="rounded-lg border bg-background p-3 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium">
                        {{ p.author_name }}
                        <Badge class="ml-2" variant="secondary">
                          {{ p.status }}
                        </Badge>
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {{ p.body_md }}
                      </p>
                    </div>
                    <div class="inline-flex items-center gap-0.5">
                      <AdminIconButton
                        :tooltip="p.status === 'published' ? 'Скрыть пост' : 'Показать пост'"
                        :icon="p.status === 'published' ? EyeOff : Eye"
                        @click="setPostStatus(p.id, p.status === 'published' ? 'hidden' : 'published')"
                      />
                      <AdminConfirmDelete
                        entity="пост"
                        :label="p.author_name"
                        @confirm="setPostStatus(p.id, 'deleted')"
                      />
                    </div>
                  </div>
                  <p v-if="!posts.length" class="text-sm text-muted-foreground">
                    Нет сообщений
                  </p>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
