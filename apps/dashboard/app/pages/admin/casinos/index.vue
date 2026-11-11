<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Building2,
  Check,
  Copy,
  Flame,
  Pencil,
  Plus,
  Search,
  Star,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const router = useRouter()

const q = ref(String(route.query.q || ''))
const page = ref(Number(route.query.page) || 1)
const limit = ref(Number(route.query.limit) || 20)
const statusFilter = ref<string>(String(route.query.status || 'all'))
const hotOnly = ref(route.query.hot === '1')
const sort = ref(String(route.query.sort || 'default'))

interface CasinoRow {
  id: string
  slug: string
  name: string
  status: string
  hot: boolean
  has_representative: boolean
  final_rating: string | null
  editorial_score: string | null
  logo_url: string | null
  bonus_count: number
  review_count: number
  clicks_7d: number
}

interface ListRes {
  items: CasinoRow[]
  total: number
  page: number
  limit: number
  summary?: {
    total: number
    published: number
    hot: number
    avgRating: number | null
  }
}

const listKey = computed(() =>
  `admin-casinos-${page.value}-${limit.value}-${statusFilter.value}-${hotOnly.value}-${sort.value}-${q.value}`,
)

const { data, pending, refresh } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/casinos', {
    query: {
      q: q.value || undefined,
      page: page.value,
      limit: limit.value,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      hot: hotOnly.value ? '1' : undefined,
      sort: sort.value !== 'default' ? sort.value : undefined,
    },
  }),
  { watch: [page, limit, statusFilter, hotOnly, sort] },
)

async function syncQuery() {
  await router.replace({
    query: {
      q: q.value || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
      limit: limit.value !== 20 ? String(limit.value) : undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      hot: hotOnly.value ? '1' : undefined,
      sort: sort.value !== 'default' ? sort.value : undefined,
    },
  })
}

async function search() {
  page.value = 1
  await syncQuery()
  await refresh()
}

watch([statusFilter, hotOnly, sort, limit], async () => {
  page.value = 1
  await syncQuery()
})

watch(page, async () => {
  await syncQuery()
})

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const summary = computed(() => data.value?.summary)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / limit.value)))
const rangeLabel = computed(() => {
  const total = data.value?.total || 0
  if (!total)
    return '0 из 0'
  const from = (page.value - 1) * limit.value + 1
  const to = Math.min(page.value * limit.value, total)
  return `${from}–${to} из ${total.toLocaleString('ru-RU')}`
})

const kpiCards = computed(() => {
  const s = summary.value
  return [
    {
      label: 'Всего',
      value: s?.total ?? data.value?.total ?? 0,
      hint: 'в базе',
      tone: 'violet' as AdminTone,
      icon: Building2,
      to: undefined as string | undefined,
    },
    {
      label: 'На сайте',
      value: s?.published ?? 0,
      hint: 'published',
      tone: 'emerald' as AdminTone,
      icon: Building2,
      to: undefined,
    },
    {
      label: 'HOT',
      value: s?.hot ?? 0,
      hint: 'в подборке',
      tone: 'amber' as AdminTone,
      icon: Flame,
      to: undefined,
    },
    {
      label: 'Средний рейтинг',
      value: s?.avgRating != null ? Number(s.avgRating) : 0,
      hint: s?.avgRating != null ? 'по final/editorial' : 'нет оценок',
      tone: 'cyan' as AdminTone,
      icon: Star,
      to: undefined,
    },
  ]
})

const filterChips = [
  { id: 'all', label: 'Все' },
  { id: 'published', label: 'На сайте' },
  { id: 'draft', label: 'Скрыто / черновик' },
] as const

function ratingTone(raw: string | null | undefined) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0)
    return 'text-muted-foreground'
  if (n >= 5.5)
    return 'text-emerald-600 dark:text-emerald-400'
  if (n >= 4.5)
    return 'text-cyan-600 dark:text-cyan-400'
  return 'text-muted-foreground'
}

function ratingBadge(raw: string | null | undefined) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0)
    return null
  if (n >= 5.5)
    return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
  if (n >= 4.5)
    return 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400'
  return 'border-border text-muted-foreground'
}

const busyHot = ref<Set<string>>(new Set())
const busyPub = ref<Set<string>>(new Set())
const busyId = ref<string | null>(null)
const copiedSlug = ref<string | null>(null)

async function toggleHot(row: CasinoRow) {
  const next = !row.hot
  row.hot = next
  busyHot.value.add(row.id)
  try {
    await api(`/v1/admin/casinos/${row.id}`, {
      method: 'PATCH',
      body: { hot: next },
    })
  }
  catch {
    row.hot = !next
  }
  finally {
    busyHot.value.delete(row.id)
  }
}

async function togglePublish(row: CasinoRow, on: boolean) {
  const prev = row.status
  row.status = on ? 'published' : 'draft'
  busyPub.value.add(row.id)
  try {
    await api(`/v1/admin/casinos/${row.id}`, {
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

async function copySlug(slug: string) {
  try {
    await navigator.clipboard.writeText(slug)
    copiedSlug.value = slug
    window.setTimeout(() => {
      if (copiedSlug.value === slug)
        copiedSlug.value = null
    }, 1200)
  }
  catch {
    // ignore
  }
}

function logoSrc(url: string | null) {
  if (!url)
    return null
  if (url.startsWith('http') || url.startsWith('/'))
    return url
  return `/uploads/casinos/${url}`
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Казино"
      :description="`${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')} записей · управление карточками и видимостью`"
      help="casinos"
    >
      <template #actions>
        <Button as-child size="sm">
          <NuxtLink to="/admin/casinos/new">
            <Plus class="size-4" />
            Добавить
          </NuxtLink>
        </Button>
      </template>
    </AdminPageHeader>

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
          <Input v-model="q" class="pl-8" placeholder="Поиск по имени / slug" />
        </div>
        <Button type="submit" variant="secondary" :disabled="pending">
          Найти
        </Button>
      </form>

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="chip in filterChips"
          :key="chip.id"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="statusFilter === chip.id && !hotOnly
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="statusFilter = chip.id; hotOnly = false"
        >
          {{ chip.label }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="hotOnly
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="hotOnly = !hotOnly"
        >
          <Flame class="size-3" />
          HOT
        </button>
      </div>

      <AdminSelect
        v-model="sort"
        class="w-[160px]"
        size="sm"
        :options="[
          { value: 'default', label: 'По порядку' },
          { value: 'rating', label: 'По рейтингу' },
          { value: 'name', label: 'По названию' },
          { value: 'clicks', label: 'По кликам 7д' },
        ]"
      />

      <AdminSelect
        v-model="limit"
        number
        class="w-[120px]"
        size="sm"
        :options="[
          { value: '20', label: '20 / стр.' },
          { value: '50', label: '50 / стр.' },
          { value: '100', label: '100 / стр.' },
        ]"
      />
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="7" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Казино
            </th>
            <th class="px-3 py-2.5 font-medium">
              На сайте
            </th>
            <th class="px-3 py-2.5 font-medium">
              Рейтинг
            </th>
            <th class="px-3 py-2.5 font-medium">
              Бонусы
            </th>
            <th class="px-3 py-2.5 font-medium">
              Отзывы
            </th>
            <th class="px-3 py-2.5 font-medium">
              Клики 7д
            </th>
            <th class="px-3 py-2.5 font-medium">
              HOT
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
                <div class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background">
                  <img
                    v-if="logoSrc(row.logo_url)"
                    :src="logoSrc(row.logo_url)!"
                    :alt="row.name"
                    class="size-8 object-contain"
                    loading="lazy"
                  >
                  <Building2 v-else class="size-4 text-muted-foreground" />
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium">
                    {{ row.name }}
                  </div>
                  <button
                    type="button"
                    class="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Копировать slug"
                    @click="copySlug(row.slug)"
                  >
                    <span class="truncate font-mono">{{ row.slug }}</span>
                    <Check v-if="copiedSlug === row.slug" class="size-3 text-emerald-500" />
                    <Copy v-else class="size-3 opacity-60" />
                  </button>
                </div>
              </div>
            </td>
            <td class="px-3 py-2">
              <Switch
                :model-value="row.status === 'published'"
                :disabled="busyPub.has(row.id)"
                :aria-label="row.status === 'published' ? 'Скрыть с сайта' : 'Показать на сайте'"
                @update:model-value="(v: boolean) => togglePublish(row, v)"
              />
            </td>
            <td class="px-3 py-2">
              <Badge
                v-if="ratingBadge(row.final_rating || row.editorial_score)"
                variant="outline"
                class="tabular-nums"
                :class="ratingBadge(row.final_rating || row.editorial_score)!"
              >
                {{ row.final_rating || row.editorial_score }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2 tabular-nums text-muted-foreground">
              {{ row.bonus_count ?? 0 }}
            </td>
            <td class="px-3 py-2 tabular-nums text-muted-foreground">
              {{ row.review_count ?? 0 }}
            </td>
            <td class="px-3 py-2 tabular-nums" :class="ratingTone(String(row.clicks_7d || 0))">
              {{ (row.clicks_7d ?? 0).toLocaleString('ru-RU') }}
            </td>
            <td class="px-3 py-2">
              <button
                type="button"
                class="rounded-lg p-1.5 transition-colors hover:bg-muted"
                :disabled="busyHot.has(row.id)"
                :aria-label="row.hot ? 'Убрать HOT' : 'Сделать HOT'"
                @click="toggleHot(row)"
              >
                <Star
                  class="size-4 transition-transform"
                  :class="row.hot ? 'fill-amber-400 text-amber-500 scale-110' : 'text-muted-foreground'"
                />
              </button>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
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
            <td colspan="8" class="px-3 py-2">
              <AdminUiAdminEmptyState
                title="Ничего не найдено"
                description="Измените фильтры или добавьте новое казино"
                :icon="Building2"
                to="/admin/casinos/new"
                cta="Добавить казино"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-muted-foreground">
        {{ rangeLabel }}
      </p>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" :disabled="page <= 1 || pending" @click="page--">
          Назад
        </Button>
        <span class="text-sm tabular-nums text-muted-foreground">
          {{ page }} / {{ totalPages }}
        </span>
        <Button
          size="sm"
          variant="outline"
          :disabled="page >= totalPages || pending"
          @click="page++"
        >
          Далее
        </Button>
      </div>
    </div>
  </div>
</template>
