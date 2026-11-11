<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Check,
  Info,
  MessageSquare,
  RotateCcw,
  Star,
  X,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const colorMode = useColorMode()

const status = ref(String(route.query.status || ''))
const q = ref('')
const page = ref(1)
const limit = ref(20)

const tipDismissed = useLocalStorage('admin-reviews-display-tip-dismissed', false)

interface Row {
  id: string
  rating: number
  body: string
  status: string
  author_name: string | null
  casino_name: string
  casino_slug: string
  casino_id: string
  created_at: string
  duplicate_count: number
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    total: number
    pending: number
    approved: number
    rejected: number
    avgRating: number | null
    ratingBars: Array<{ star: number, value: number }>
    series: Array<{ date: string, reviews: number }>
  }
}

const listKey = computed(() =>
  `admin-reviews-${page.value}-${limit.value}-${status.value}-${q.value}`,
)

const { data, pending, refresh } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/reviews', {
    query: {
      status: status.value || undefined,
      q: q.value || undefined,
      page: page.value,
      limit: limit.value,
    },
  }),
  { watch: [page, status, limit] },
)

async function search() {
  page.value = 1
  await refresh()
}

watch([status, limit], () => {
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
    { label: 'Всего', value: s?.total ?? data.value?.total ?? 0, hint: 'в таблице reviews', tone: 'violet' as AdminTone, icon: MessageSquare },
    { label: 'Pending', value: s?.pending ?? 0, hint: 'ждут модерации', tone: 'amber' as AdminTone, icon: MessageSquare },
    { label: 'Approved', value: s?.approved ?? 0, hint: 'на сайте', tone: 'emerald' as AdminTone, icon: Check },
    { label: 'Средняя ★', value: s?.avgRating ?? 0, hint: s?.avgRating != null ? 'по всем' : 'нет оценок', tone: 'cyan' as AdminTone, icon: Star },
  ]
})

const maxRatingBar = computed(() =>
  Math.max(1, ...(summary.value?.ratingBars.map(b => b.value) || [1])),
)

const chartData = computed(() => summary.value?.series || [])
const isDarkUi = computed(() => colorMode.value === 'dark')
const activityColors = computed(() =>
  isDarkUi.value ? ['oklch(0.78 0.15 70)'] : ['oklch(0.55 0.16 55)'],
)

function xFmt(i: number) {
  const row = chartData.value[i]
  if (!row)
    return ''
  return new Date(row.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function initials(name: string | null) {
  const s = (name || 'А').trim()
  return s.slice(0, 2).toUpperCase()
}

function stars(n: number) {
  return Array.from({ length: 5 }, (_, i) => i < n)
}

function relativeTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)
    return `${mins} мин`
  const hours = Math.floor(mins / 60)
  if (hours < 48)
    return `${hours} ч`
  return d.toLocaleDateString('ru-RU')
}

const selected = ref<Set<string>>(new Set())
const busyId = ref<string | null>(null)

function toggleSelect(id: string) {
  const next = new Set(selected.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  selected.value = next
}

async function setStatus(id: string, next: 'approved' | 'rejected' | 'pending') {
  busyId.value = id
  try {
    await api(`/v1/admin/reviews/${id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function bulkStatus(next: 'approved' | 'rejected') {
  const ids = [...selected.value]
  if (!ids.length)
    return
  await Promise.all(ids.map(id => api(`/v1/admin/reviews/${id}`, { method: 'PATCH', body: { status: next } })))
  selected.value = new Set()
  await refresh()
}

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

// Hotkeys: A approve, R reject focused card — use first selected or first pending
onKeyStroke(['a', 'A'], (e) => {
  if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable]'))
    return
  const id = [...selected.value][0] || data.value?.items.find(i => i.status === 'pending')?.id
  if (id)
    setStatus(id, 'approved')
})
onKeyStroke(['r', 'R'], (e) => {
  if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable]'))
    return
  const id = [...selected.value][0] || data.value?.items.find(i => i.status === 'pending')?.id
  if (id)
    setStatus(id, 'rejected')
})
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Отзывы"
      :description="`Модерация · ${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')} записей`"
      help="reviews"
    />

    <div
      v-if="!tipDismissed"
      class="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <Info class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div class="min-w-0 flex-1">
        <p>
          Числа вроде «2888 отзывов» у Pokerdom — поле <strong>reviewsDisplay</strong> в карточке казино
          (импорт / маркетинг), а не строки в БД. Здесь только реальные отзывы.
        </p>
      </div>
      <Button size="sm" variant="ghost" class="shrink-0" @click="tipDismissed = true">
        Скрыть
      </Button>
    </div>

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

    <div class="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card class="rounded-2xl overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">
            Новые отзывы · 30 дней
          </CardTitle>
          <CardDescription>
            Динамика поступления
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            v-if="chartData.length"
            class="h-[200px]"
            :data="chartData"
            index="date"
            :categories="['reviews']"
            :colors="activityColors"
            :show-legend="false"
            :x-formatter="(_t, i) => xFmt(i)"
          />
          <AdminUiAdminEmptyState
            v-else
            title="Пока нет данных"
            description="График появится после новых отзывов"
          />
        </CardContent>
      </Card>

      <Card class="rounded-2xl">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">
            Распределение ★
          </CardTitle>
          <CardDescription>
            По всем отзывам
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <div
            v-for="b in [...(summary?.ratingBars || [])].reverse()"
            :key="b.star"
            class="flex items-center gap-2"
          >
            <span class="w-6 text-xs tabular-nums text-muted-foreground">{{ b.star }}★</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-amber-500 transition-all duration-500"
                :style="{ width: ready ? `${(b.value / maxRatingBar) * 100}%` : '0%' }"
              />
            </div>
            <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {{ b.value.toLocaleString('ru-RU') }}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: '', label: 'Все' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ]"
          :key="chip.id || 'all'"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="status === chip.id
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="status = chip.id"
        >
          {{ chip.label }}
          <span v-if="chip.id === 'pending' && summary?.pending" class="ml-1 tabular-nums opacity-70">
            {{ summary.pending }}
          </span>
        </button>
      </div>
      <Input
        v-model="q"
        class="max-w-sm flex-1"
        placeholder="Текст / автор / казино"
        @keyup.enter="search"
      />
      <Button variant="secondary" :disabled="pending" @click="search">
        Найти
      </Button>
      <div v-if="selected.size" class="ml-auto flex gap-2">
        <Button size="sm" variant="outline" class="text-emerald-600" @click="bulkStatus('approved')">
          Approve {{ selected.size }}
        </Button>
        <Button size="sm" variant="outline" class="text-rose-600" @click="bulkStatus('rejected')">
          Reject {{ selected.size }}
        </Button>
      </div>
    </div>

    <p class="text-[11px] text-muted-foreground">
      Горячие клавиши: <kbd class="rounded border px-1">A</kbd> approve · <kbd class="rounded border px-1">R</kbd> reject
    </p>

    <div v-if="pending && !data" class="space-y-3" role="status" aria-busy="true">
      <div v-for="n in 4" :key="n" class="rounded-2xl border p-4 space-y-3">
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-16 w-full" />
      </div>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="row in data?.items || []"
        :key="row.id"
        class="rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card"
        :class="selected.has(row.id) ? 'ring-2 ring-cyan-500/40' : ''"
      >
        <div class="flex flex-wrap items-start gap-3">
          <AdminCheckbox
            :checked="selected.has(row.id)"
            class="mt-1"
            @update:checked="toggleSelect(row.id)"
          />
          <div class="grid size-9 shrink-0 place-items-center rounded-full border bg-muted text-xs font-semibold">
            {{ initials(row.author_name) }}
          </div>
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink
                to="/admin/casinos"
                class="rounded-full border px-2 py-0.5 text-xs font-medium hover:bg-muted"
              >
                {{ row.casino_name }}
              </NuxtLink>
              <span class="text-sm font-medium">{{ row.author_name || 'аноним' }}</span>
              <span class="inline-flex gap-0.5" :title="`${row.rating}/5`">
                <Star
                  v-for="(on, i) in stars(row.rating)"
                  :key="i"
                  class="size-3.5"
                  :class="on ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30'"
                />
              </span>
              <AdminUiAdminStatusBadge :status="row.status" />
              <Badge
                v-if="row.duplicate_count > 0"
                variant="outline"
                class="border-rose-500/40 text-rose-700 dark:text-rose-400"
              >
                Возможный дубль ×{{ row.duplicate_count }}
              </Badge>
              <span class="ml-auto text-xs text-muted-foreground" :title="new Date(row.created_at).toLocaleString('ru-RU')">
                {{ relativeTime(row.created_at) }}
              </span>
            </div>
            <p class="text-sm whitespace-pre-wrap leading-relaxed">
              {{ row.body }}
            </p>
            <div class="inline-flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                class="h-8 text-emerald-600"
                :disabled="row.status === 'approved' || busyId === row.id"
                @click="setStatus(row.id, 'approved')"
              >
                <Check class="size-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-8 text-rose-600"
                :disabled="row.status === 'rejected' || busyId === row.id"
                @click="setStatus(row.id, 'rejected')"
              >
                <X class="size-3.5" />
                Reject
              </Button>
              <AdminIconButton
                tooltip="Вернуть в pending"
                :icon="RotateCcw"
                :disabled="row.status === 'pending' || busyId === row.id"
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
        </div>
      </div>

      <AdminUiAdminEmptyState
        v-if="!pending && !(data?.items?.length)"
        title="Пусто"
        description="Нет отзывов по текущим фильтрам"
        :icon="MessageSquare"
      />
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
