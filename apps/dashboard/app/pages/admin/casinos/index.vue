<script setup lang="ts">
import { Eye, EyeOff, Pencil, Star } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const router = useRouter()

const q = ref(String(route.query.q || ''))
const page = ref(Number(route.query.page) || 1)

interface CasinoRow {
  id: string
  slug: string
  name: string
  status: string
  hot: boolean
  has_representative: boolean
  final_rating: string | null
  editorial_score: string | null
}

interface ListRes { items: CasinoRow[], total: number, page: number, limit: number }

const { data, pending, refresh } = await useAsyncData(
  'admin-casinos',
  () => api<ListRes>('/v1/admin/casinos', { query: { q: q.value || undefined, page: page.value, limit: 20 } }),
  { watch: [page] },
)

async function search() {
  page.value = 1
  await router.replace({ query: { q: q.value || undefined, page: undefined } })
  await refresh()
}

async function toggleHot(row: CasinoRow) {
  await api(`/v1/admin/casinos/${row.id}`, {
    method: 'PATCH',
    body: { hot: !row.hot },
  })
  await refresh()
}

async function togglePublish(row: CasinoRow) {
  const next = row.status === 'published' ? 'draft' : 'published'
  await api(`/v1/admin/casinos/${row.id}`, {
    method: 'PATCH',
    body: { status: next },
  })
  await refresh()
}

const busyId = ref<string | null>(null)

async function removeCasino(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/casinos/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Казино
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} записей
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AdminSectionHelp section="casinos" />
        <Button as-child size="sm">
          <NuxtLink to="/admin/casinos/new">
            Добавить
          </NuxtLink>
        </Button>
      </div>
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Поиск по имени / slug" />
      <Button type="submit" variant="secondary" :disabled="pending">
        Найти
      </Button>
    </form>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="px-3 py-2 font-medium">
              Название
            </th>
            <th class="px-3 py-2 font-medium">
              Показ
            </th>
            <th class="px-3 py-2 font-medium">
              Рейтинг
            </th>
            <th class="px-3 py-2 font-medium">
              HOT
            </th>
            <th class="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items || []" :key="row.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.name }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ row.slug }}
              </div>
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.status === 'published' ? 'default' : 'secondary'">
                {{ row.status === 'published' ? 'на сайте' : row.status }}
              </Badge>
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ row.final_rating || row.editorial_score || '—' }}
            </td>
            <td class="px-3 py-2">
              <AdminIconButton
                :tooltip="row.hot ? 'Убрать HOT' : 'Сделать HOT'"
                :icon="Star"
                :class="row.hot ? 'text-amber-500' : undefined"
                @click="toggleHot(row)"
              />
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
                  :to="`/admin/casinos/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="казино"
                  :label="row.name"
                  :busy="busyId === row.id"
                  @confirm="removeCasino(row.id)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!pending && !(data?.items?.length)">
            <td colspan="5" class="px-3 py-8 text-center text-muted-foreground">
              Ничего не найдено
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="(data?.total || 0) > 20" class="flex gap-2">
      <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">
        Назад
      </Button>
      <span class="text-sm self-center text-muted-foreground">стр. {{ page }}</span>
      <Button
        size="sm"
        variant="outline"
        :disabled="page * 20 >= (data?.total || 0)"
        @click="page++"
      >
        Далее
      </Button>
    </div>

  </div>
</template>
