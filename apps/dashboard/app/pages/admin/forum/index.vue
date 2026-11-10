<script setup lang="ts">
import { Eye, EyeOff, Lock, LockOpen, MessagesSquare } from 'lucide-vue-next'

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

interface ListRes { items: Row[], total: number }

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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Модерация форума
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} тем · скрытие / закрытие / удаление
        </p>
      </div>
      <AdminSectionHelp section="forum" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="status"
        class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
        @change="page = 1"
      >
        <option value="">
          Все статусы
        </option>
        <option value="published">
          published
        </option>
        <option value="hidden">
          hidden
        </option>
        <option value="deleted">
          deleted
        </option>
      </select>
      <Input v-model="q" class="max-w-sm" placeholder="Тема / автор / slug" @keyup.enter="search" />
      <Button variant="secondary" :disabled="pending" @click="search">
        Найти
      </Button>
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="px-3 py-2 font-medium">
              Тема
            </th>
            <th class="px-3 py-2 font-medium">
              Автор
            </th>
            <th class="px-3 py-2 font-medium">
              Посты
            </th>
            <th class="px-3 py-2 font-medium">
              Статус
            </th>
            <th class="px-3 py-2 font-medium text-right">
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
                  {{ row.category_title }} · {{ row.slug }}
                  <span v-if="row.is_locked"> · 🔒</span>
                  <span v-if="row.is_pinned"> · 📌</span>
                </div>
              </td>
              <td class="px-3 py-2">
                {{ row.author_name }}
              </td>
              <td class="px-3 py-2">
                {{ row.posts_count }}
              </td>
              <td class="px-3 py-2">
                <Badge :variant="row.status === 'published' ? 'default' : 'secondary'">
                  {{ row.status }}
                </Badge>
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
