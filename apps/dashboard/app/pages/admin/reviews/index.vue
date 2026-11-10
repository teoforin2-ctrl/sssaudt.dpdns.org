<script setup lang="ts">
import { Check, RotateCcw, X } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()

const status = ref(String(route.query.status || ''))
const q = ref('')
const page = ref(1)

interface Row {
  id: string
  rating: number
  body: string
  status: string
  author_name: string | null
  casino_name: string
  casino_slug: string
  created_at: string
}

interface ListRes { items: Row[], total: number }

const { data, pending, refresh } = await useAsyncData(
  'admin-reviews',
  () => api<ListRes>('/v1/admin/reviews', {
    query: {
      status: status.value || undefined,
      q: q.value || undefined,
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

async function setStatus(id: string, next: 'approved' | 'rejected' | 'pending') {
  await api(`/v1/admin/reviews/${id}`, { method: 'PATCH', body: { status: next } })
  await refresh()
}

const busyId = ref<string | null>(null)

async function removeReview(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/reviews/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

function reviewLabel(row: Row) {
  const snippet = row.body.replace(/\s+/g, ' ').trim().slice(0, 60)
  return `${row.casino_name} · ${snippet}${row.body.length > 60 ? '…' : ''}`
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">
            Отзывы
          </h1>
          <p class="text-sm text-muted-foreground">
            Модерация · {{ data?.total ?? 0 }} записей в таблице <code>reviews</code>
          </p>
        </div>
        <AdminSectionHelp section="reviews" />
      </div>

      <p class="mt-2 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        Числа вроде «2888 отзывов» у Pokerdom — это поле <strong>reviewsDisplay</strong> в карточке казино
        (импорт / маркетинг), а не реальные строки в БД. В админке и модерации видны только настоящие отзывы.
      </p>
    </div>

    <div class="flex flex-wrap gap-2 items-center">
      <select
        v-model="status"
        class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
        @change="page = 1"
      >
        <option value="">
          Все статусы
        </option>
        <option value="pending">
          pending
        </option>
        <option value="approved">
          approved
        </option>
        <option value="rejected">
          rejected
        </option>
      </select>
      <Input v-model="q" class="max-w-sm" placeholder="Текст / автор / казино" @keyup.enter="search" />
      <Button variant="secondary" :disabled="pending" @click="search">
        Найти
      </Button>
    </div>

    <div v-if="pending && !data" class="space-y-3" role="status" aria-busy="true">
      <div v-for="n in 4" :key="n" class="rounded-xl border p-4 space-y-3">
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-16 w-full" />
        <div class="flex gap-2">
          <Skeleton class="h-8 w-20" />
          <Skeleton class="h-8 w-20" />
        </div>
      </div>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="row in data?.items || []"
        :key="row.id"
        class="rounded-xl border p-4 space-y-2"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm">
            <span class="font-medium">{{ row.casino_name }}</span>
            <span class="text-muted-foreground"> · {{ row.author_name || 'аноним' }} · ★{{ row.rating }}</span>
          </div>
          <Badge :variant="row.status === 'approved' ? 'default' : row.status === 'pending' ? 'secondary' : 'outline'">
            {{ row.status }}
          </Badge>
        </div>
        <p class="text-sm whitespace-pre-wrap">
          {{ row.body }}
        </p>
        <div class="inline-flex flex-wrap items-center gap-0.5">
          <AdminIconButton
            tooltip="Одобрить"
            :icon="Check"
            :disabled="row.status === 'approved'"
            class="text-emerald-600"
            @click="setStatus(row.id, 'approved')"
          />
          <AdminIconButton
            tooltip="Отклонить"
            :icon="X"
            :disabled="row.status === 'rejected'"
            @click="setStatus(row.id, 'rejected')"
          />
          <AdminIconButton
            tooltip="Вернуть в pending"
            :icon="RotateCcw"
            :disabled="row.status === 'pending'"
            @click="setStatus(row.id, 'pending')"
          />
          <AdminConfirmDelete
            entity="отзыв"
            :label="reviewLabel(row)"
            :busy="busyId === row.id"
            @confirm="removeReview(row.id)"
          />
        </div>
      </div>
      <p v-if="!pending && !(data?.items?.length)" class="text-sm text-muted-foreground py-8 text-center">
        Пусто
      </p>
    </div>

    <div v-if="(data?.total || 0) > 20" class="flex gap-2">
      <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">
        Назад
      </Button>
      <span class="text-sm self-center text-muted-foreground">стр. {{ page }}</span>
      <Button size="sm" variant="outline" :disabled="page * 20 >= (data?.total || 0)" @click="page++">
        Далее
      </Button>
    </div>
  </div>
</template>
