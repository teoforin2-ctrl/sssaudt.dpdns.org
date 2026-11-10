<script setup lang="ts">
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

const kpis = computed(() => {
  const s = stats.value
  if (!s)
    return []
  return [
    {
      key: 'clicks',
      label: 'Клики /go/',
      value: s.trends.clicks7d,
      delta: s.trends.clicksDeltaPct,
      hint: 'за 7 дней',
      to: '/admin/clicks',
      icon: MousePointerClick,
      tone: 'cyan',
    },
    {
      key: 'reviews',
      label: 'Новые отзывы',
      value: s.trends.reviews7d,
      delta: s.trends.reviewsDeltaPct,
      hint: `${s.reviewsPending} на модерации`,
      to: '/admin/reviews?status=pending',
      icon: Star,
      tone: 'amber',
    },
    {
      key: 'casinos',
      label: 'Казино на сайте',
      value: s.casinosPublished,
      delta: null as number | null,
      hint: `${s.casinos} всего`,
      to: '/admin/casinos',
      icon: Building2,
      tone: 'violet',
    },
    {
      key: 'bonuses',
      label: 'Активные бонусы',
      value: s.bonusesPublished,
      delta: null as number | null,
      hint: `${s.bonuses} в базе`,
      to: '/admin/bonuses',
      icon: Gift,
      tone: 'emerald',
    },
  ]
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

function deltaLabel(n: number | null) {
  if (n == null)
    return null
  const capped = Math.max(-999, Math.min(999, n))
  const sign = capped > 0 ? '+' : ''
  const suffix = Math.abs(n) > 999 ? '+' : ''
  return `${sign}${capped}${suffix}%`
}

const metaStrip = computed(() => {
  const s = stats.value
  if (!s)
    return []
  return [
    { label: 'Баннеры', value: s.bannersActive, total: s.banners, to: '/admin/banners', icon: ImageIcon },
    { label: 'Пользователи', value: s.users, total: null as number | null, to: '/admin/users', icon: Users },
    { label: 'Отзывы ok', value: s.reviewsApproved, total: s.reviewsDisplayTotal ?? null, to: '/admin/reviews?status=approved', icon: Star },
  ]
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
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span class="relative flex size-2">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span class="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live · {{ user?.role }}
        </div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
          {{ greeting }}, {{ user?.displayName || 'команда' }}
        </h1>
        <p class="text-sm text-muted-foreground">
          Сводка по контенту, кликам и очередям модерации
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model.number="rangeDays"
          class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option :value="7">
            7 дней
          </option>
          <option :value="30">
            30 дней
          </option>
          <option :value="90">
            90 дней
          </option>
        </select>
        <AdminSectionHelp section="dashboard" />
        <Button variant="outline" size="sm" :disabled="pending || refreshing" @click="onRefresh">
          <RefreshCw class="size-4" :class="refreshing || pending ? 'animate-spin' : ''" />
          Обновить
        </Button>
      </div>
    </div>

    <p v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      Не удалось загрузить статистику. Проверьте API.
    </p>

    <AdminCardsSkeleton v-if="pending && !stats" />

    <template v-else-if="stats">
      <NumberFlowGroup>
        <!-- KPI -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <NuxtLink
            v-for="(card, i) in kpis"
            :key="card.key"
            :to="card.to"
            class="group relative overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            :class="ready ? 'animate-in fade-in slide-in-from-bottom-2' : 'opacity-0'"
            :style="{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }"
          >
            <div
              class="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
              :class="{
                'bg-cyan-400': card.tone === 'cyan',
                'bg-amber-400': card.tone === 'amber',
                'bg-violet-400': card.tone === 'violet',
                'bg-emerald-400': card.tone === 'emerald',
              }"
            />
            <div class="flex items-start justify-between gap-3">
              <div
                class="grid size-10 place-items-center rounded-xl border bg-background/80 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
              >
                <component
                  :is="card.icon"
                  class="size-5 transition-colors"
                  :class="{
                    'text-cyan-600': card.tone === 'cyan',
                    'text-amber-600': card.tone === 'amber',
                    'text-violet-600': card.tone === 'violet',
                    'text-emerald-600': card.tone === 'emerald',
                  }"
                />
              </div>
              <Badge
                v-if="deltaLabel(card.delta)"
                variant="outline"
                class="tabular-nums"
                :class="(card.delta || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ deltaLabel(card.delta) }}
              </Badge>
            </div>
            <p class="mt-4 text-sm text-muted-foreground">
              {{ card.label }}
            </p>
            <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              <NumberFlow :value="ready ? card.value : 0" locales="ru-RU" />
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ card.hint }}
            </p>
          </NuxtLink>
        </div>

        <!-- Charts row -->
        <div class="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card class="overflow-hidden">
            <CardHeader class="pb-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle class="flex items-center gap-2 text-base">
                    <Sparkles class="size-4 text-amber-500 animate-pulse" />
                    Активность
                  </CardTitle>
                  <CardDescription>
                    Клики /go/ и отзывы · последние {{ stats.days }} дн.
                  </CardDescription>
                </div>
                <div class="flex gap-3 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full bg-[oklch(0.65_0.15_220)]" /> клики
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2 rounded-full bg-[oklch(0.7_0.16_70)]" /> отзывы
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
                :colors="['oklch(0.65 0.15 220)', 'oklch(0.7 0.16 70)']"
                :show-legend="false"
                :x-formatter="(_t, i) => xFmt(i)"
              />
              <p v-else class="py-16 text-center text-sm text-muted-foreground">
                Пока нет точек за период
              </p>
            </CardContent>
          </Card>

          <Card>
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
                :colors="[
                  'oklch(0.62 0.18 290)',
                  'oklch(0.65 0.15 220)',
                  'oklch(0.7 0.14 150)',
                  'oklch(0.72 0.16 50)',
                ]"
                :value-formatter="(n) => Number(n).toLocaleString('ru-RU')"
              />
              <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div
                  v-for="item in mixData"
                  :key="item.name"
                  class="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
                >
                  <span class="text-muted-foreground">{{ item.name }}</span>
                  <span class="font-semibold tabular-nums">
                    <NumberFlow :value="ready ? item.value : 0" locales="ru-RU" />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Queues + top -->
        <div class="grid gap-4 lg:grid-cols-2">
          <Card>
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
                  :class="q.urgent ? 'border-amber-500/40 text-amber-600' : 'text-muted-foreground'"
                >
                  <component :is="q.icon" class="size-4" :class="q.urgent ? 'animate-pulse' : ''" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ q.label }}
                  </p>
                </div>
                <span class="text-lg font-semibold tabular-nums">
                  <NumberFlow :value="ready ? q.value : 0" locales="ru-RU" />
                </span>
                <ArrowUpRight class="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </NuxtLink>
            </CardContent>
          </Card>

          <Card>
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
                    <span class="mr-2 text-muted-foreground tabular-nums">{{ idx + 1 }}.</span>
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
              <p v-if="!stats.topCasinos.length" class="py-8 text-center text-sm text-muted-foreground">
                Кликов за период ещё нет
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Meta strip -->
        <div class="grid gap-3 sm:grid-cols-3">
          <NuxtLink
            v-for="(m, i) in metaStrip"
            :key="m.label"
            :to="m.to"
            class="group flex items-center gap-3 rounded-2xl border bg-card/60 px-4 py-3 transition-all hover:bg-card hover:shadow-md"
            :class="ready ? 'animate-in fade-in slide-in-from-bottom-1' : 'opacity-0'"
            :style="{ animationDelay: `${320 + i * 50}ms`, animationFillMode: 'both' }"
          >
            <div class="grid size-9 place-items-center rounded-lg border bg-background text-muted-foreground transition-transform group-hover:scale-110">
              <component :is="m.icon" class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-muted-foreground">
                {{ m.label }}
              </p>
              <p class="text-lg font-semibold tabular-nums">
                <NumberFlow :value="ready ? m.value : 0" locales="ru-RU" />
                <span v-if="m.total != null" class="ml-1 text-xs font-normal text-muted-foreground">
                  / {{ m.total }}
                </span>
              </p>
            </div>
            <ArrowUpRight class="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </NuxtLink>
        </div>

        <p class="text-center text-[11px] text-muted-foreground">
          Обновлено {{ generatedLabel }}
        </p>
      </NumberFlowGroup>
    </template>
  </div>
</template>
