<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { Building2, MousePointerClick, RefreshCw } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const colorMode = useColorMode()

const days = ref(30)
const q = ref('')
const limit = ref(50)

interface ClickRow {
  casino_slug: string
  casino_name: string
  casino_id: string | null
  clicks: number
  last_click: string
}

interface ClicksRes {
  days: number
  summary: { total: number, uniqueCasinos: number, lastClick: string | null }
  byDay: { day: string, clicks: number }[]
  items: ClickRow[]
}

const { data, pending, refresh, error } = await useAsyncData(
  'admin-clicks',
  () =>
    api<ClicksRes>('/v1/admin/clicks', {
      query: {
        days: days.value,
        limit: limit.value,
        q: q.value || undefined,
      },
    }),
  { watch: [days, limit] },
)

async function search() {
  await refresh()
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const maxClicks = computed(() => Math.max(1, ...(data.value?.items.map(i => i.clicks) || [1])))
const chartData = computed(() =>
  (data.value?.byDay || []).map(d => ({ date: d.day, clicks: d.clicks })),
)
const isDarkUi = computed(() => colorMode.value === 'dark')
const activityColors = computed(() =>
  isDarkUi.value ? ['oklch(0.72 0.14 220)'] : ['oklch(0.48 0.14 240)'],
)

const kpiCards = computed(() => {
  const s = data.value?.summary
  return [
    { label: 'Кликов', value: s?.total ?? 0, hint: `за ${days.value} дн.`, tone: 'cyan' as AdminTone, icon: MousePointerClick },
    { label: 'Казино', value: s?.uniqueCasinos ?? 0, hint: 'уникальных', tone: 'violet' as AdminTone, icon: Building2 },
    { label: 'Топ-1', value: data.value?.items?.[0]?.clicks ?? 0, hint: data.value?.items?.[0]?.casino_name || '—', tone: 'amber' as AdminTone, icon: MousePointerClick },
  ]
})

function xFmt(i: number) {
  const row = chartData.value[i]
  if (!row)
    return ''
  return new Date(row.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function fmtDate(v?: string | null) {
  if (!v)
    return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime()))
    return v
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Клики /go/"
      description="Редиректы на партнёрские URL · таблица go_clicks"
      help="clicks"
    >
      <template #actions>
        <AdminSelect
          v-model="days"
          number
          class="w-[140px]"
          :options="[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
            { value: '90', label: '90 дней' },
          ]"
        />
        <Button variant="outline" size="sm" :disabled="pending" @click="refresh()">
          <RefreshCw class="size-4" :class="pending ? 'animate-spin' : ''" />
          Обновить
        </Button>
      </template>
    </AdminPageHeader>

    <div v-if="error" class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Не удалось загрузить отчёт
    </div>

    <template v-else>
      <AdminUiAdminStatGrid :cols="3">
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

      <Card class="overflow-hidden rounded-2xl">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">
            Клики по дням
          </CardTitle>
          <CardDescription>
            Период {{ days }} дн. · {{ fmtDate(data?.summary.lastClick) }} последний
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            v-if="chartData.length"
            class="h-[240px]"
            :data="chartData"
            index="date"
            :categories="['clicks']"
            :colors="activityColors"
            :show-legend="false"
            :x-formatter="(_t, i) => xFmt(i)"
          />
          <AdminUiAdminEmptyState
            v-else
            title="Пока нет кликов"
            description="Данные появятся после трафика на /go/"
            :icon="MousePointerClick"
          />
        </CardContent>
      </Card>

      <form class="flex flex-wrap gap-2 rounded-2xl border bg-card/40 p-3" @submit.prevent="search">
        <Input
          v-model="q"
          class="max-w-sm flex-1"
          placeholder="Слаг / название казино"
        />
        <Button type="submit" variant="secondary" :disabled="pending">
          Найти
        </Button>
      </form>

      <div v-if="pending && !data" class="space-y-2">
        <Skeleton v-for="n in 6" :key="n" class="h-12 w-full rounded-xl" />
      </div>

      <div v-else class="overflow-hidden rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
            <tr class="text-xs uppercase tracking-wide text-muted-foreground">
              <th class="px-3 py-2.5 font-medium">
                #
              </th>
              <th class="px-3 py-2.5 font-medium">
                Казино
              </th>
              <th class="px-3 py-2.5 font-medium">
                Клики
              </th>
              <th class="px-3 py-2.5 font-medium">
                Доля
              </th>
              <th class="px-3 py-2.5 font-medium">
                Последний
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!(data?.items?.length)">
              <td colspan="5" class="px-3 py-2">
                <AdminUiAdminEmptyState
                  title="Нет кликов за период"
                  description="Измените период или дождитесь трафика"
                  :icon="MousePointerClick"
                />
              </td>
            </tr>
            <tr
              v-for="(row, i) in data?.items || []"
              :key="row.casino_slug"
              class="border-t transition-colors hover:bg-muted/40"
            >
              <td class="px-3 py-2.5 text-muted-foreground tabular-nums">
                {{ i + 1 }}
              </td>
              <td class="px-3 py-2.5">
                <div class="font-medium">
                  {{ row.casino_name }}
                </div>
                <div class="font-mono text-xs text-muted-foreground">
                  <NuxtLink
                    v-if="row.casino_id"
                    class="hover:underline"
                    :to="`/admin/casinos/${row.casino_id}`"
                  >
                    {{ row.casino_slug }}
                  </NuxtLink>
                  <span v-else>{{ row.casino_slug }}</span>
                </div>
              </td>
              <td class="px-3 py-2.5 font-semibold tabular-nums">
                {{ row.clicks.toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2.5 w-40">
                <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
                    :style="{ width: ready ? `${(row.clicks / maxClicks) * 100}%` : '0%' }"
                  />
                </div>
              </td>
              <td class="px-3 py-2.5 text-muted-foreground">
                {{ fmtDate(row.last_click) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
