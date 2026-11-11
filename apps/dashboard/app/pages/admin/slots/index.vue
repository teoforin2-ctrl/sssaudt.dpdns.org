<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Gamepad2,
  Pencil,
  Percent,
  Plus,
  Search,
  Server,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()

const q = ref('')
const page = ref(1)
const limit = ref(20)
const statusFilter = ref('all')
const volatility = ref('all')
const provider = ref('all')

interface Row {
  id: string
  slug: string
  title: string
  theme: string
  volatility: string
  rtp: string | null
  status: string
  provider_name: string | null
  provider_slug: string | null
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    total: number
    published: number
    providers: number
    avgRtp: number | null
    topProviders: Array<{ slug: string, name: string, count: number }>
  }
}

const listKey = computed(() =>
  `admin-slots-${page.value}-${limit.value}-${statusFilter.value}-${volatility.value}-${provider.value}-${q.value}`,
)

const { data, pending, refresh } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/slots', {
    query: {
      q: q.value || undefined,
      page: page.value,
      limit: limit.value,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      volatility: volatility.value !== 'all' ? volatility.value : undefined,
      provider: provider.value !== 'all' ? provider.value : undefined,
    },
  }),
  { watch: [page, limit, statusFilter, volatility, provider] },
)

async function search() {
  page.value = 1
  await refresh()
}

watch([statusFilter, volatility, provider, limit], () => {
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

const maxProviderCount = computed(() =>
  Math.max(1, ...(summary.value?.topProviders.map(p => p.count) || [1])),
)

const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Всего', value: s?.total ?? data.value?.total ?? 0, hint: 'в каталоге', tone: 'violet' as AdminTone, icon: Gamepad2 },
    { label: 'На сайте', value: s?.published ?? 0, hint: 'published', tone: 'emerald' as AdminTone, icon: Gamepad2 },
    { label: 'Провайдеров', value: s?.providers ?? 0, hint: 'уникальных', tone: 'cyan' as AdminTone, icon: Server },
    { label: 'Средний RTP', value: s?.avgRtp ?? 0, hint: s?.avgRtp != null ? '%' : 'нет данных', tone: 'amber' as AdminTone, icon: Percent },
  ]
})

const providerOptions = computed(() => {
  const opts = [{ value: 'all', label: 'Все провайдеры' }]
  for (const p of summary.value?.topProviders || [])
    opts.push({ value: p.slug, label: `${p.name} (${p.count})` })
  return opts
})

function rtpClass(raw: string | null) {
  const n = Number(raw)
  if (!Number.isFinite(n))
    return 'text-muted-foreground'
  if (n >= 96.5)
    return 'text-emerald-600 dark:text-emerald-400'
  if (n >= 95)
    return 'text-cyan-600 dark:text-cyan-400'
  return 'text-muted-foreground'
}

function volBadge(v: string) {
  if (v === 'high')
    return 'border-rose-500/40 text-rose-700 dark:text-rose-400'
  if (v === 'low')
    return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
  return 'border-amber-500/40 text-amber-700 dark:text-amber-400'
}

const busyPub = ref<Set<string>>(new Set())
const busyId = ref<string | null>(null)

async function togglePublish(row: Row, on: boolean) {
  const prev = row.status
  row.status = on ? 'published' : 'draft'
  busyPub.value.add(row.id)
  try {
    await api(`/v1/admin/slots/${row.id}`, {
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

async function removeSlot(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/slots/${id}`, { method: 'DELETE' })
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
      title="Слоты"
      :description="`${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')} записей · демо, RTP и провайдеры`"
      help="slots"
    >
      <template #actions>
        <Button as-child size="sm">
          <NuxtLink to="/admin/slots/new">
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
      v-if="summary?.topProviders?.length"
      class="grid gap-3 rounded-2xl border bg-card/40 p-4 lg:grid-cols-[1fr_1.2fr]"
    >
      <div>
        <p class="text-sm font-medium">
          Топ провайдеров
        </p>
        <p class="text-xs text-muted-foreground">
          Распределение слотов в каталоге
        </p>
      </div>
      <div class="space-y-2">
        <button
          v-for="p in summary.topProviders"
          :key="p.slug"
          type="button"
          class="block w-full space-y-1 rounded-lg p-1 text-left transition-colors hover:bg-muted/40"
          @click="provider = p.slug"
        >
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="truncate font-medium">{{ p.name }}</span>
            <span class="tabular-nums text-muted-foreground">{{ p.count }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
              :style="{ width: ready ? `${(p.count / maxProviderCount) * 100}%` : '0%' }"
            />
          </div>
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <form class="flex min-w-[220px] flex-1 gap-2" @submit.prevent="search">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="q" class="pl-8" placeholder="Название / slug" />
        </div>
        <Button type="submit" variant="secondary" :disabled="pending">
          Найти
        </Button>
      </form>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: 'all', label: 'Все' },
            { id: 'published', label: 'На сайте' },
            { id: 'draft', label: 'Черновик' },
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
        v-model="volatility"
        class="w-[150px]"
        size="sm"
        :options="[
          { value: 'all', label: 'Волатильность' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]"
      />
      <AdminSelect
        v-model="provider"
        class="w-[180px]"
        size="sm"
        :options="providerOptions"
      />
      <AdminSelect
        v-model="limit"
        number
        class="w-[120px]"
        size="sm"
        :options="[
          { value: '20', label: '20 / стр.' },
          { value: '50', label: '50 / стр.' },
        ]"
      />
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="6" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Слот
            </th>
            <th class="px-3 py-2.5 font-medium">
              Провайдер
            </th>
            <th class="px-3 py-2.5 font-medium">
              RTP
            </th>
            <th class="px-3 py-2.5 font-medium">
              Волат.
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
              <div class="font-medium">
                {{ row.title }}
              </div>
              <div class="text-xs text-muted-foreground">
                <span class="font-mono">{{ row.slug }}</span>
                <span v-if="row.theme"> · {{ row.theme }}</span>
              </div>
            </td>
            <td class="px-3 py-2">
              <Badge v-if="row.provider_name" variant="outline" class="font-normal">
                {{ row.provider_name }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2 tabular-nums font-medium" :class="rtpClass(row.rtp)">
              {{ row.rtp || '—' }}
            </td>
            <td class="px-3 py-2">
              <Badge variant="outline" class="font-normal capitalize" :class="volBadge(row.volatility)">
                {{ row.volatility || '—' }}
              </Badge>
            </td>
            <td class="px-3 py-2">
              <Switch
                :model-value="row.status === 'published'"
                :disabled="busyPub.has(row.id)"
                :aria-label="row.status === 'published' ? 'Скрыть' : 'Опубликовать'"
                @update:model-value="(v: boolean) => togglePublish(row, v)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  :to="`/admin/slots/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="слот"
                  :label="row.title"
                  :busy="busyId === row.id"
                  @confirm="removeSlot(row.id)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!pending && !(data?.items?.length)">
            <td colspan="6" class="px-3 py-2">
              <AdminUiAdminEmptyState
                title="Ничего не найдено"
                description="Измените фильтры или добавьте слот"
                :icon="Gamepad2"
                to="/admin/slots/new"
                cta="Добавить слот"
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
