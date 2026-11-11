<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { useDebounceFn } from '@vueuse/core'
import {
  Building2,
  Check,
  Copy,
  Gift,
  Pencil,
  Plus,
  Search,
  Ticket,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()

const q = ref('')
const page = ref(1)
const limit = ref(20)
const publishedFilter = ref('all')
const promoOnly = ref(false)

interface Row {
  id: string
  title: string
  title_ru: string | null
  promo_code: string | null
  type: string | null
  status: string
  published: boolean
  casino_slug: string
  casino_name: string
  wager: string | null
  amount_or_percent: string | null
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    total: number
    active: number
    withPromo: number
    topCasino: string | null
    topCasinoCount: number
    wagerBuckets: Array<{ label: string, value: number }>
  }
}

const listKey = computed(() =>
  `admin-bonuses-${page.value}-${limit.value}-${publishedFilter.value}-${promoOnly.value}-${q.value}`,
)

const { data, pending, refresh } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/bonuses', {
    query: {
      q: q.value || undefined,
      page: page.value,
      limit: limit.value,
      published: publishedFilter.value === 'active' ? '1' : publishedFilter.value === 'off' ? '0' : undefined,
      has_promo: promoOnly.value ? '1' : undefined,
    },
  }),
  { watch: [page, limit, publishedFilter, promoOnly] },
)

const debouncedSearch = useDebounceFn(async () => {
  page.value = 1
  await refresh()
}, 300)

watch(q, () => {
  debouncedSearch()
})

watch([publishedFilter, promoOnly, limit], () => {
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

const maxWager = computed(() =>
  Math.max(1, ...(summary.value?.wagerBuckets.map(b => b.value) || [1])),
)

const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Всего', value: s?.total ?? data.value?.total ?? 0, hint: 'в базе', tone: 'violet' as AdminTone, icon: Gift },
    { label: 'Активные', value: s?.active ?? 0, hint: 'на сайте', tone: 'emerald' as AdminTone, icon: Gift },
    { label: 'С промокодом', value: s?.withPromo ?? 0, hint: 'есть код', tone: 'cyan' as AdminTone, icon: Ticket },
    {
      label: 'Топ-казино',
      value: s?.topCasinoCount ?? 0,
      hint: s?.topCasino || '—',
      tone: 'amber' as AdminTone,
      icon: Building2,
    },
  ]
})

function typeBadge(type: string | null, title: string) {
  const t = (type || title || '').toLowerCase()
  if (/\bfs\b|free.?spin|фриспин/.test(t))
    return { label: 'FS', class: 'border-violet-500/40 text-violet-700 dark:text-violet-400' }
  if (/no.?deposit|без депозит/.test(t))
    return { label: 'No deposit', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' }
  if (/%|percent|депозит|deposit/.test(t))
    return { label: '%', class: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400' }
  if (type)
    return { label: type.slice(0, 16), class: 'border-border text-muted-foreground' }
  return null
}

function wagerNum(w: string | null) {
  if (!w)
    return null
  const n = Number(String(w).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function wagerClass(w: string | null) {
  const n = wagerNum(w)
  if (n == null)
    return 'text-muted-foreground'
  if (n <= 30)
    return 'text-emerald-600 dark:text-emerald-400'
  if (n <= 40)
    return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

const copied = ref<string | null>(null)
async function copyPromo(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = code
    window.setTimeout(() => {
      if (copied.value === code)
        copied.value = null
    }, 1200)
  }
  catch {
    // ignore
  }
}

const busyPub = ref<Set<string>>(new Set())
const busyId = ref<string | null>(null)

async function toggleActive(row: Row, on: boolean) {
  const prevStatus = row.status
  const prevPub = row.published
  row.status = on ? 'active' : 'hidden'
  row.published = on
  busyPub.value.add(row.id)
  try {
    await api(`/v1/admin/bonuses/${row.id}`, {
      method: 'PATCH',
      body: { status: row.status, published: on },
    })
  }
  catch {
    row.status = prevStatus
    row.published = prevPub
  }
  finally {
    busyPub.value.delete(row.id)
  }
}

async function removeBonus(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/bonuses/${id}`, { method: 'DELETE' })
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
      title="Бонусы"
      :description="`${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')} записей · промокоды и вейджер`"
      help="bonuses"
    >
      <template #actions>
        <Button as-child size="sm">
          <NuxtLink to="/admin/bonuses/new">
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

    <div
      v-if="summary?.wagerBuckets?.length"
      class="rounded-2xl border bg-card/40 p-4"
    >
      <p class="mb-3 text-sm font-medium">
        Вейджер
      </p>
      <div class="grid gap-2 sm:grid-cols-4">
        <div v-for="b in summary.wagerBuckets" :key="b.label" class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">{{ b.label }}</span>
            <span class="tabular-nums font-medium">{{ b.value.toLocaleString('ru-RU') }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
              :style="{ width: ready ? `${(b.value / maxWager) * 100}%` : '0%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="relative min-w-[220px] flex-1">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" class="pl-8" placeholder="Название / промо / казино" />
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'Активные' },
            { id: 'off', label: 'Выкл.' },
          ]"
          :key="chip.id"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="publishedFilter === chip.id
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="publishedFilter = chip.id"
        >
          {{ chip.label }}
        </button>
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="promoOnly
            ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="promoOnly = !promoOnly"
        >
          С промокодом
        </button>
      </div>

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

    <AdminTableSkeleton v-if="pending && !data" :cols="6" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Бонус
            </th>
            <th class="px-3 py-2.5 font-medium">
              Казино
            </th>
            <th class="px-3 py-2.5 font-medium">
              Тип
            </th>
            <th class="px-3 py-2.5 font-medium">
              Вейджер
            </th>
            <th class="px-3 py-2.5 font-medium">
              Промо
            </th>
            <th class="px-3 py-2.5 font-medium">
              Active
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
              <div class="max-w-[280px] truncate font-medium">
                {{ row.title_ru || row.title }}
              </div>
              <div v-if="row.amount_or_percent" class="text-xs text-muted-foreground">
                {{ row.amount_or_percent }}
              </div>
            </td>
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.casino_name }}
              </div>
              <div class="font-mono text-xs text-muted-foreground">
                {{ row.casino_slug }}
              </div>
            </td>
            <td class="px-3 py-2">
              <Badge
                v-if="typeBadge(row.type, row.title_ru || row.title)"
                variant="outline"
                class="font-normal"
                :class="typeBadge(row.type, row.title_ru || row.title)!.class"
              >
                {{ typeBadge(row.type, row.title_ru || row.title)!.label }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2 tabular-nums font-medium" :class="wagerClass(row.wager)">
              {{ row.wager || '—' }}
            </td>
            <td class="px-3 py-2">
              <button
                v-if="row.promo_code"
                type="button"
                class="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-xs hover:bg-muted"
                @click="copyPromo(row.promo_code!)"
              >
                {{ row.promo_code }}
                <Check v-if="copied === row.promo_code" class="size-3 text-emerald-500" />
                <Copy v-else class="size-3 opacity-50" />
              </button>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2">
              <Switch
                :model-value="row.published && row.status === 'active'"
                :disabled="busyPub.has(row.id)"
                aria-label="Активность бонуса"
                @update:model-value="(v: boolean) => toggleActive(row, v)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  :to="`/admin/bonuses/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="бонус"
                  :label="row.title_ru || row.title"
                  :busy="busyId === row.id"
                  @confirm="removeBonus(row.id)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!pending && !(data?.items?.length)">
            <td colspan="7" class="px-3 py-2">
              <AdminUiAdminEmptyState
                title="Ничего не найдено"
                description="Измените фильтры или добавьте бонус"
                :icon="Gift"
                to="/admin/bonuses/new"
                cta="Добавить бонус"
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
