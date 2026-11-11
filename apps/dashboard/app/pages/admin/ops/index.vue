<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Activity,
  Building2,
  Database,
  FileText,
  Gift,
  MessageSquare,
  RefreshCw,
  Server,
  ShieldAlert,
  Users,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()

interface OpsRes {
  ok: boolean
  dbMs: number
  redisOk: boolean
  role?: string
  canAdmin?: boolean
  counts: {
    casinosPublished: number
    reviewsPending: number
    reviewsApproved: number
    complaintsOpen: number
    blacklistPublished: number
    bonusesActive: number
    articlesPublished: number
    playersWithProgress: number
  }
}

const live = ref(false)
const lastAt = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

const { data, pending, refresh, error } = await useAsyncData(
  'admin-ops',
  async () => {
    const res = await api<OpsRes>('/v1/admin/ops')
    lastAt.value = Date.now()
    return res
  },
)

const ago = ref(0)
onMounted(() => {
  setInterval(() => {
    ago.value = lastAt.value ? Math.round((Date.now() - lastAt.value) / 1000) : 0
  }, 1000)
})

watch(live, (on) => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (on) {
    timer = setInterval(() => {
      void refresh()
    }, 5000)
  }
})
onBeforeUnmount(() => {
  if (timer)
    clearInterval(timer)
})

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const cards = computed(() => {
  const c = data.value?.counts
  if (!c)
    return []
  return [
    { label: 'Казино published', value: c.casinosPublished, to: '/admin/casinos', icon: Building2, tone: 'violet' as AdminTone, warn: false },
    { label: 'Отзывы pending', value: c.reviewsPending, to: '/admin/reviews?status=pending', icon: MessageSquare, tone: 'amber' as AdminTone, warn: c.reviewsPending > 0 },
    { label: 'Отзывы approved', value: c.reviewsApproved, to: '/admin/reviews?status=approved', icon: MessageSquare, tone: 'emerald' as AdminTone, warn: false },
    { label: 'Жалобы open', value: c.complaintsOpen, to: '/admin/complaints', icon: ShieldAlert, tone: 'rose' as AdminTone, warn: c.complaintsOpen > 0 },
    { label: 'ЧС published', value: c.blacklistPublished, to: '/admin/blacklist', icon: ShieldAlert, tone: 'neutral' as AdminTone, warn: false },
    { label: 'Бонусы active', value: c.bonusesActive, to: '/admin/bonuses', icon: Gift, tone: 'cyan' as AdminTone, warn: false },
    { label: 'Статьи published', value: c.articlesPublished, to: '/admin/articles', icon: FileText, tone: 'violet' as AdminTone, warn: false },
    { label: 'Игроки с прогрессом', value: c.playersWithProgress, to: '/admin', icon: Users, tone: 'amber' as AdminTone, warn: false },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      :live="live"
      :eyebrow="live ? 'Live · каждые 5 сек' : `Обновлено ${ago} сек назад`"
      title="Ops lite"
      description="Health-check API / Redis / очередей без полного APM"
      help="ops"
    >
      <template #actions>
        <Button
          :variant="live ? 'default' : 'outline'"
          size="sm"
          @click="live = !live"
        >
          {{ live ? 'Live on' : 'Live off' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="pending" @click="refresh()">
          <RefreshCw class="size-4" :class="pending ? 'animate-spin' : ''" />
          Обновить
        </Button>
      </template>
    </AdminPageHeader>

    <div
      v-if="error"
      class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      Не удалось загрузить /v1/admin/ops
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-3">
          <div
            class="grid size-10 place-items-center rounded-xl border"
            :class="data?.ok ? 'border-emerald-500/40 text-emerald-600' : 'border-rose-500/40 text-rose-600'"
          >
            <Database class="size-5" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              API / DB
            </p>
            <p class="text-lg font-semibold">
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="size-2 rounded-full"
                  :class="data?.ok ? 'bg-emerald-500' : 'bg-rose-500'"
                />
                {{ data?.ok ? 'OK' : '…' }}
              </span>
              <span class="ml-1 text-sm font-normal text-muted-foreground">
                · {{ data?.dbMs ?? '—' }} ms
              </span>
            </p>
          </div>
        </div>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-3">
          <div
            class="grid size-10 place-items-center rounded-xl border"
            :class="data?.redisOk ? 'border-emerald-500/40 text-emerald-600' : 'border-rose-500/40 text-rose-600'"
          >
            <Server class="size-5" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Redis
            </p>
            <p
              class="text-lg font-semibold"
              :class="data?.redisOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="size-2 rounded-full"
                  :class="data?.redisOk ? 'bg-emerald-500' : 'bg-rose-500'"
                />
                {{ pending ? '…' : (data?.redisOk ? 'PONG' : 'DOWN') }}
              </span>
            </p>
          </div>
        </div>
      </div>
      <div class="rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-3">
          <div class="grid size-10 place-items-center rounded-xl border text-muted-foreground">
            <Activity class="size-5" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Роль
            </p>
            <p class="text-lg font-semibold">
              {{ data?.role || '—' }}
              <Badge v-if="data?.canAdmin" variant="outline" class="ml-2 text-xs font-normal">
                admin rights
              </Badge>
            </p>
          </div>
        </div>
      </div>
    </div>

    <AdminCardsSkeleton v-if="pending && !data" />
    <AdminUiAdminStatGrid v-else>
      <AdminUiAdminStatCard
        v-for="(card, i) in cards"
        :key="card.label"
        :label="card.label"
        :value="card.value < 0 ? 0 : card.value"
        :to="card.to"
        :icon="card.icon"
        :tone="card.warn ? 'amber' : card.tone"
        :ready="ready"
        :index="i"
        :hint="card.warn ? 'требует внимания' : undefined"
      />
    </AdminUiAdminStatGrid>
  </div>
</template>
