<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import NumberFlow, { NumberFlowGroup } from '@number-flow/vue'
import {
  ArrowUpRight,
  Building2,
  FileText,
  Gamepad2,
  Gift,
  ImageIcon,
  MessageSquareWarning,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Users,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface SeriesPoint {
  date: string
  clicks: number
  reviews: number
}

interface TopCasino {
  id: string
  name: string
  slug: string
  clicks: number
}

interface MixItem {
  name: string
  value: number
}

interface Stats {
  casinos: number
  casinosPublished: number
  bonuses: number
  bonusesPublished: number
  reviewsPending: number
  reviewsApproved: number
  reviewsDisplayTotal?: number
  articles: number
  articlesPublished: number
  slots: number
  slotsPublished: number
  banners: number
  bannersActive: number
  users: number
  complaintsOpen: number
  days: number
  trends: {
    clicks7d: number
    clicksPrev7d: number
    clicksDeltaPct: number
    reviews7d: number
    reviewsPrev7d: number
    reviewsDeltaPct: number
  }
  series: SeriesPoint[]
  topCasinos: TopCasino[]
  mix: MixItem[]
  generatedAt: string
}

const rangeDays = ref(30)
const { data: stats, pending, error, refresh } = await useAsyncData(
  () => `admin-stats-${rangeDays.value}`,
  () => api<Stats>('/v1/admin/stats', { query: { days: rangeDays.value } }),
  { watch: [rangeDays] },
)

const refreshing = ref(false)
async function onRefresh() {
  refreshing.value = true
  try {
    await refresh()
  }
  finally {
    window.setTimeout(() => {
      refreshing.value = false
    }, 450)
  }
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12)
    return 'Доброе утро'
  if (h < 18)
    return 'Добрый день'
  return 'Добрый вечер'
})

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const isEditor = computed(() => user.value?.role === 'editor')

const kpis = computed(() => {
  const s = stats.value
  if (!s)
    return []
  const items: Array<{
    key: string
    label: string
    value: number
    delta: number | null
    isNew?: boolean
    hint: string
    to: string
    icon: typeof Star
    tone: AdminTone
  }> = [
    {
      key: 'clicks',
      label: 'Клики /go/',
      value: s.trends.clicks7d,
      delta: s.trends.clicksPrev7d === 0 && s.trends.clicks7d > 0 ? null : s.trends.clicksDeltaPct,
      isNew: s.trends.clicksPrev7d === 0 && s.trends.clicks7d > 0,
      hint: 'за 7 дней',
      to: '/admin/clicks',
      icon: MousePointerClick,
      tone: 'cyan',
    },
    {
      key: 'reviews',
      label: 'Новые отзывы',
      value: s.trends.reviews7d,
      delta: s.trends.reviewsPrev7d === 0 && s.trends.reviews7d > 0 ? null : s.trends.reviewsDeltaPct,
      isNew: s.trends.reviewsPrev7d === 0 && s.trends.reviews7d > 0,
      hint: `${s.reviewsPending} на модерации`,
      to: '/admin/reviews?status=pending',
      icon: Star,
      tone: 'amber',
    },
    {
      key: 'casinos',
      label: 'Казино на сайте',
      value: s.casinosPublished,
      delta: null,
      hint: `${s.casinos} всего`,
      to: '/admin/casinos',
      icon: Building2,
      tone: 'violet',
    },
    {
      key: 'bonuses',
      label: 'Активные бонусы',
      value: s.bonusesPublished,
      delta: null,
      hint: `${s.bonuses} в базе`,
      to: '/admin/bonuses',
      icon: Gift,
      tone: 'emerald',
    },
  ]
  return isEditor.value ? items.filter(i => i.key !== 'clicks') : items
})

const queues = computed(() => {
  const s = stats.value
  if (!s)
    return []
  return [
    {
      label: 'Отзывы pending',
      value: s.reviewsPending,
      to: '/admin/reviews?status=pending',
      icon: MessageSquareWarning,
      urgent: s.reviewsPending > 0,
    },
    {
      label: 'Жалобы open',
      value: s.complaintsOpen,
      to: '/admin/complaints',
      icon: ShieldAlert,
      urgent: s.complaintsOpen > 0,
    },
    {
      label: 'Статьи published',
      value: s.articlesPublished,
      to: '/admin/articles',
      icon: FileText,
      urgent: false,
    },
    {
      label: 'Слоты published',
      value: s.slotsPublished,
      to: '/admin/slots',
      icon: Gamepad2,
      urgent: false,
    },
  ]
})

const chartData = computed(() => stats.value?.series || [])
const mixData = computed(() => (stats.value?.mix || []).filter(i => i.value > 0))
const maxTopClicks = computed(() => Math.max(1, ...(stats.value?.topCasinos.map(c => c.clicks) || [1])))

const colorMode = useColorMode()
const isDarkUi = computed(() => colorMode.value === 'dark')
const activityColors = computed(() =>
  isDarkUi.value
    ? ['oklch(0.72 0.14 220)', 'oklch(0.78 0.15 70)']
    : ['oklch(0.48 0.14 240)', 'oklch(0.55 0.16 55)'],
)
const mixColors = computed(() =>
  isDarkUi.value
    ? [
        'oklch(0.68 0.16 290)',
        'oklch(0.72 0.14 220)',
        'oklch(0.75 0.13 150)',
        'oklch(0.78 0.14 50)',
      ]
    : [
        'oklch(0.48 0.16 290)',
        'oklch(0.45 0.13 240)',
        'oklch(0.48 0.12 150)',
        'oklch(0.55 0.15 50)',
      ],
)

const metaStrip = computed(() => {
  const s = stats.value
  if (!s)
    return []
  const items = [
    { label: 'Баннеры', value: s.bannersActive, total: s.banners, to: '/admin/banners', icon: ImageIcon },
    { label: 'Пользователи', value: s.users, total: null as number | null, to: '/admin/users', icon: Users },
    { label: 'Отзывы ok', value: s.reviewsApproved, total: s.reviewsDisplayTotal ?? null, to: '/admin/reviews?status=approved', icon: Star },
  ]
  return isEditor.value ? items.filter(i => i.to !== '/admin/users') : items
})

const generatedLabel = computed(() => {
  const iso = stats.value?.generatedAt
  if (!iso)
    return ''
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function xFmt(i: number) {
  const row = chartData.value[i]
  if (!row)
    return ''
  const d = new Date(row.date)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      live
      :eyebrow="`Live · ${user?.role}`"
      :title="`${greeting}, ${user?.displayName || 'команда'}`"
      description="Сводка по контенту, кликам и очередям модерации"
      help="dashboard"
    >
      <template #actions>
        <AdminSelect
          v-model="rangeDays"
          number
          class="w-[140px]"
          :options="[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
            { value: '90', label: '90 дней' },
          ]"
        />
      </template>
      <Button variant="outline" size="sm" :disabled="pending || refreshing" @click="onRefresh">
        <RefreshCw class="size-4" :class="refreshing || pending ? 'animate-spin' : ''" />
        Обновить
      </Button>
    </AdminPageHeader>

    <p v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      Не удалось загрузить статистику. Проверьте API.
    </p>

    <AdminCardsSkeleton v-if="pending && !stats" />

    <template v-else-if="stats">
      <NumberFlowGroup>
        <AdminUiAdminStatGrid>
          <AdminUiAdminStatCard
            v-for="(card, i) in kpis"
            :key="card.key"
            :label="card.label"
            :value="card.value"
            :delta="card.delta"
            :is-new="card.isNew"
            :hint="card.hint"
            :to="card.to"
            :icon="card.icon"
            :tone="card.tone"
            :ready="ready"
            :index="i"
          />
        </AdminUiAdminStatGrid>

        <div class="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card class="overflow-hidden rounded-2xl">
            <CardHeader class="pb-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle class="flex items-center gap-2 text-base">
                    <Sparkles class="size-4 animate-pulse text-amber-500" />
                    Активность
                  </CardTitle>
                  <CardDescription>
                    Клики /go/ и отзывы · последние {{ stats.days }} дн.
                  </CardDescription>
                </div>
                <div class="flex gap-3 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full" :style="{ background: activityColors[0] }" /> клики
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full" :style="{ background: activityColors[1] }" /> отзывы
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AreaChart
                v-if="chartData.length"
                class="h-[280px]"
                :data="chartData"
                index="date"
                :categories="['clicks', 'reviews']"
                :colors="activityColors"
                :show-legend="false"
                :x-formatter="(_t, i) => xFmt(i)"
              />
              <AdminUiAdminEmptyState
                v-else
                title="Пока нет точек за период"
                description="Данные появятся после кликов /go/ и новых отзывов"
              />
            </CardContent>
          </Card>

          <Card class="rounded-2xl">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">
                Контент на сайте
              </CardTitle>
              <CardDescription>
                Published / active сущности
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                v-if="mixData.length"
                class="mx-auto h-[220px]"
                :data="mixData"
                index="name"
                category="value"
                :show-legend="false"
                :colors="mixColors"
                :value-formatter="(n) => Number(n).toLocaleString('ru-RU')"
              />
              <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div
                  v-for="item in mixData"
                  :key="item.name"
                  class="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
                >
                  <span class="font-medium text-foreground/70">{{ item.name }}</span>
                  <span class="font-semibold tabular-nums text-foreground">
                    <NumberFlow :value="ready ? item.value : 0" locales="ru-RU" />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <Card class="rounded-2xl">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">
                Очереди и разделы
              </CardTitle>
              <CardDescription>
                Куда смотреть прямо сейчас
              </CardDescription>
            </CardHeader>
            <CardContent class="grid gap-2">
              <NuxtLink
                v-for="q in queues"
                :key="q.label"
                :to="q.to"
                class="group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div
                  class="grid size-9 place-items-center rounded-lg border bg-background transition-transform group-hover:scale-105"
                  :class="q.urgent ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : 'text-muted-foreground'"
                >
                  <component :is="q.icon" class="size-4" :class="q.urgent ? 'animate-pulse' : ''" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ q.label }}
                  </p>
                </div>
                <span
                  class="text-lg font-semibold tabular-nums"
                  :class="q.urgent ? 'text-amber-600 dark:text-amber-400' : ''"
                >
                  <NumberFlow :value="ready ? q.value : 0" locales="ru-RU" />
                </span>
                <ArrowUpRight class="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </NuxtLink>
            </CardContent>
          </Card>

          <Card class="rounded-2xl">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">
                Топ казино по кликам
              </CardTitle>
              <CardDescription>
                За выбранный период
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <NuxtLink
                v-for="(c, idx) in stats.topCasinos"
                :key="c.id"
                :to="`/admin/casinos/${c.id}`"
                class="block space-y-1.5 rounded-lg p-1 transition-colors hover:bg-muted/40"
              >
                <div class="flex items-center justify-between gap-2 text-sm">
                  <span class="truncate font-medium">
                    <span class="mr-2 tabular-nums text-muted-foreground">{{ idx + 1 }}.</span>
                    {{ c.name }}
                  </span>
                  <span class="shrink-0 tabular-nums text-muted-foreground">
                    <NumberFlow :value="ready ? c.clicks : 0" locales="ru-RU" />
                  </span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700"
                    :style="{ width: ready ? `${(c.clicks / maxTopClicks) * 100}%` : '0%' }"
                  />
                </div>
              </NuxtLink>
              <AdminUiAdminEmptyState
                v-if="!stats.topCasinos.length"
                title="Кликов за период ещё нет"
                description="Клики появятся после трафика на /go/"
                :icon="MousePointerClick"
                to="/admin/clicks"
                cta="Открыть клики"
              />
            </CardContent>
          </Card>
        </div>

        <AdminUiAdminKpiStrip :items="metaStrip" :ready="ready" />

        <p class="text-center text-[11px] text-muted-foreground">
          Обновлено {{ generatedLabel }}
        </p>
      </NumberFlowGroup>
    </template>
  </div>
</template>
