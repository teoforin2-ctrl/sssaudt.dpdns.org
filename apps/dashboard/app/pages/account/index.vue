<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { NumberFlowGroup } from '@number-flow/vue'
import {
  Bell,
  Gift,
  Star,
  Trophy,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()
const route = useRoute()
const { lang, t, dateLocale, siteUrl, fmtDate } = useCabinetLocale()

type Tab = 'home' | 'reviews' | 'rewards' | 'progress' | 'complaints' | 'notes'
const tab = computed({
  get: () => {
    const v = String(route.query.tab || 'home')
    if (['reviews', 'rewards', 'progress', 'complaints', 'notes'].includes(v))
      return v as Tab
    return 'home'
  },
  set: (v: string) => {
    navigateTo({ path: '/account', query: v === 'home' ? {} : { tab: v } })
  },
})

const displayName = ref('')
const password = ref('')
const saving = ref(false)

const notes = ref<Array<{ id: string, title: string, body: string | null, created_at: string, read_at: string | null }>>([])
const reviews = ref<Array<{
  id: string
  rating: number
  body: string
  status: string
  createdAt: string
  casinoSlug: string
  casinoName: string
  reply: { body: string } | null
}>>([])
const rewards = ref<Array<{
  id: string
  status: string
  amountUsd: number | null
  casinoName: string
  casinoSlug: string
}>>([])
const complaints = ref<Array<{
  id: string
  subject: string
  status: string
  casinoName: string | null
  createdAt: string
  staffNote: string | null
}>>([])
const progress = ref<{
  playerId: string
  xp: number
  level: number
  reviewsApproved: number
  intoLevel: number
  nextLevelXp: number
  achievements: Array<{ id: string, title: string, description: string, unlockedAt: string | null }>
} | null>(null)
const promos = ref<Array<{ id: string, title: string, minLevel: number, claimed: boolean, code: string | null }>>([])
const claiming = ref<string | null>(null)
const loadErr = ref(false)

watch(
  () => user.value?.displayName,
  (n) => {
    if (n)
      displayName.value = n
  },
  { immediate: true },
)

async function loadCabinet() {
  loadErr.value = false
  try {
    const [n, r, w, c, p] = await Promise.all([
      api<{ items: typeof notes.value }>('/v1/me/notifications'),
      api<{ items: typeof reviews.value }>('/v1/me/reviews'),
      api<{ items: typeof rewards.value }>('/v1/me/rewards'),
      api<{ items: typeof complaints.value }>('/v1/me/complaints'),
      api<NonNullable<typeof progress.value>>('/v1/me/progress', { query: { locale: lang.value } }),
    ])
    notes.value = n.items || []
    reviews.value = r.items || []
    rewards.value = w.items || []
    complaints.value = c.items || []
    progress.value = p
    if (p?.playerId) {
      const promo = await api<{ items: typeof promos.value }>('/v1/exclusive-promos', {
        query: { locale: lang.value, playerId: p.playerId, level: 99 },
      })
      promos.value = promo.items || []
    }
  }
  catch {
    loadErr.value = true
  }
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
  loadCabinet()
})

watch(lang, () => {
  loadCabinet()
})

async function saveProfile() {
  saving.value = true
  try {
    const body: Record<string, string> = { displayName: displayName.value.trim() }
    if (password.value.trim())
      body.password = password.value.trim()
    await api('/v1/me', { method: 'PATCH', body })
    password.value = ''
    toast.success(t('toast.saved'))
  }
  catch {
    toast.error(t('toast.saveFail'))
  }
  finally {
    saving.value = false
  }
}

async function markRead(id: string) {
  await api(`/v1/me/notifications/${id}/read`, { method: 'POST' })
  const row = notes.value.find(n => n.id === id)
  if (row)
    row.read_at = new Date().toISOString()
}

async function claim(id: string) {
  if (!progress.value?.playerId)
    return
  claiming.value = id
  try {
    await api(`/v1/exclusive-promos/${id}/claim`, {
      method: 'POST',
      body: { playerId: progress.value.playerId },
    })
    toast.success(t('toast.promoOk'))
    await loadCabinet()
  }
  catch {
    toast.error(t('toast.promoFail'))
  }
  finally {
    claiming.value = null
  }
}

function reviewStatus(s: string) {
  if (s === 'approved')
    return t('status.reviewApproved')
  if (s === 'rejected')
    return t('status.reviewRejected')
  return t('status.reviewPending')
}

function rewardStatus(s: string) {
  if (s === 'paid')
    return t('status.rewardPaid')
  if (s === 'failed')
    return t('status.rewardFailed')
  if (s === 'pending')
    return t('status.rewardPending')
  return s
}

function complaintStatus(s: string) {
  const map: Record<string, string> = {
    new: t('status.complaintNew'),
    in_review: t('status.complaintInReview'),
    need_info: t('status.complaintNeedInfo'),
    resolved: t('status.complaintResolved'),
    rejected: t('status.complaintRejected'),
  }
  return map[s] || s
}

const unread = computed(() => notes.value.filter(n => !n.read_at).length)

const approvedReviews = computed(() => reviews.value.filter(r => r.status === 'approved').length)
const pendingReviews = computed(() => reviews.value.filter(r => r.status !== 'approved' && r.status !== 'rejected').length)
const paidRewards = computed(() => rewards.value.filter(r => r.status === 'paid').length)

const kpis = computed(() => {
  const items: Array<{
    key: string
    label: string
    value: number
    hint: string
    to: string
    icon: typeof Star
    tone: AdminTone
  }> = [
    {
      key: 'reviews',
      label: t('kpi.reviews'),
      value: reviews.value.length,
      hint: pendingReviews.value
        ? t('kpi.pendingModeration', { n: pendingReviews.value })
        : t('kpi.published', { n: approvedReviews.value }),
      to: '/account?tab=reviews',
      icon: Star,
      tone: 'amber',
    },
    {
      key: 'level',
      label: t('kpi.level'),
      value: progress.value?.level ?? 1,
      hint: t('kpi.xp', { n: (progress.value?.xp ?? 0).toLocaleString(dateLocale.value) }),
      to: '/account?tab=progress',
      icon: Trophy,
      tone: 'violet',
    },
    {
      key: 'rewards',
      label: t('kpi.rewards'),
      value: rewards.value.length,
      hint: paidRewards.value ? t('kpi.paid', { n: paidRewards.value }) : t('kpi.forPublished'),
      to: '/account?tab=rewards',
      icon: Gift,
      tone: 'emerald',
    },
    {
      key: 'notes',
      label: t('kpi.notes'),
      value: unread.value,
      hint: unread.value ? t('kpi.unread') : t('kpi.allRead'),
      to: '/account?tab=notes',
      icon: Bell,
      tone: unread.value ? 'rose' : 'cyan',
    },
  ]
  return items
})

const progressKpis = computed(() => [
  {
    label: t('kpi.level'),
    value: progress.value?.level ?? 1,
    hint: t('kpi.currentRank'),
    icon: Trophy,
    tone: 'violet' as AdminTone,
  },
  {
    label: 'XP',
    value: progress.value?.xp ?? 0,
    hint: t('kpi.untilNext', { a: progress.value?.intoLevel ?? 0, b: progress.value?.nextLevelXp ?? 100 }),
    icon: Star,
    tone: 'amber' as AdminTone,
  },
  {
    label: t('kpi.reviews'),
    value: progress.value?.reviewsApproved ?? approvedReviews.value,
    hint: t('kpi.giveXp'),
    icon: Gift,
    tone: 'emerald' as AdminTone,
  },
])

const xpPct = computed(() => {
  const into = progress.value?.intoLevel ?? 0
  const next = Math.max(1, progress.value?.nextLevelXp ?? 100)
  return Math.min(100, (into / next) * 100)
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <AdminPageHeader
      :title="user?.displayName ? t('player.hello', { name: user.displayName }) : t('player.title')"
      :description="user?.email || ''"
      :eyebrow="t('player.eyebrow')"
    />

    <p v-if="loadErr" class="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {{ t('player.loadErr') }}
    </p>

    <Tabs
      :model-value="tab"
      class="w-full"
      @update:model-value="(v: string | number) => { tab = String(v) }"
    >
      <TabsList>
        <TabsTrigger value="home">
          {{ t('tabs.home') }}
        </TabsTrigger>
        <TabsTrigger value="reviews">
          {{ t('tabs.reviews') }}
        </TabsTrigger>
        <TabsTrigger value="rewards">
          {{ t('tabs.rewards') }}
        </TabsTrigger>
        <TabsTrigger value="progress">
          {{ t('tabs.progress') }}
        </TabsTrigger>
        <TabsTrigger value="complaints">
          {{ t('tabs.complaints') }}
        </TabsTrigger>
        <TabsTrigger value="notes">
          {{ t('tabs.notes') }}
          <span v-if="unread" class="ml-1 tabular-nums text-muted-foreground">{{ unread }}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="home" class="mt-4 space-y-4">
        <NumberFlowGroup>
          <AdminUiAdminStatGrid>
            <AdminUiAdminStatCard
              v-for="(card, i) in kpis"
              :key="card.key"
              :label="card.label"
              :value="card.value"
              :hint="card.hint"
              :to="card.to"
              :icon="card.icon"
              :tone="card.tone"
              :ready="ready"
              :index="i"
              :locales="dateLocale"
            />
          </AdminUiAdminStatGrid>
        </NumberFlowGroup>

        <section class="rounded-xl border p-4 space-y-3">
          <h3 class="font-medium">
            {{ t('player.profile') }}
          </h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label>{{ t('player.name') }}</Label>
              <Input v-model="displayName" />
            </div>
            <div class="grid gap-2">
              <Label>{{ t('player.email') }}</Label>
              <Input :model-value="user?.email" disabled />
            </div>
            <div class="grid gap-2 sm:col-span-2">
              <Label>{{ t('player.newPassword') }}</Label>
              <Input v-model="password" type="password" autocomplete="new-password" />
            </div>
          </div>
          <Button :disabled="saving" @click="saveProfile">
            {{ saving ? t('player.saving') : t('player.save') }}
          </Button>
        </section>
      </TabsContent>

      <TabsContent value="reviews" class="mt-4 space-y-3">
        <p v-if="!reviews.length" class="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          {{ t('player.reviewsEmpty') }}
          <a :href="siteUrl('/rating')" class="underline">{{ t('player.writeReview') }}</a>
        </p>
        <article v-for="r in reviews" :key="r.id" class="rounded-xl border p-4 space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <a :href="siteUrl(`/casino/${r.casinoSlug}`)" class="font-medium underline-offset-2 hover:underline">
              {{ r.casinoName }}
            </a>
            <span class="text-muted-foreground">
              {{ reviewStatus(r.status) }} · ★{{ r.rating }} · {{ fmtDate(r.createdAt) }}
            </span>
          </div>
          <p class="text-sm">
            {{ r.body }}
          </p>
          <p v-if="r.reply" class="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {{ t('player.casinoReply', { body: r.reply.body }) }}
          </p>
        </article>
      </TabsContent>

      <TabsContent value="rewards" class="mt-4 space-y-3">
        <p v-if="!rewards.length" class="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          {{ t('player.rewardsEmpty') }}
        </p>
        <article v-for="r in rewards" :key="r.id" class="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-2">
          <a :href="siteUrl(`/casino/${r.casinoSlug}`)" class="font-medium hover:underline">
            {{ r.casinoName }}
          </a>
          <span class="text-sm text-muted-foreground">
            <span v-if="r.amountUsd != null" class="mr-2 tabular-nums text-foreground">${{ r.amountUsd }}</span>
            {{ rewardStatus(r.status) }}
          </span>
        </article>
      </TabsContent>

      <TabsContent value="progress" class="mt-4 space-y-4">
        <NumberFlowGroup>
          <AdminUiAdminStatGrid :cols="3">
            <AdminUiAdminStatCard
              v-for="(card, i) in progressKpis"
              :key="card.label"
              :label="card.label"
              :value="card.value"
              :hint="card.hint"
              :icon="card.icon"
              :tone="card.tone"
              :ready="ready"
              :index="i"
              :locales="dateLocale"
            />
          </AdminUiAdminStatGrid>
        </NumberFlowGroup>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400 transition-all duration-700"
            :style="{ width: ready ? `${xpPct}%` : '0%' }"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          {{ t('player.xpUntil', { a: progress?.intoLevel ?? 0, b: progress?.nextLevelXp ?? 100 }) }}
        </p>

        <section>
          <h3 class="mb-2 text-sm font-medium">
            {{ t('player.achievements') }}
          </h3>
          <ul class="grid gap-2">
            <li
              v-for="a in progress?.achievements || []"
              :key="a.id"
              class="rounded-xl border p-3 text-sm"
              :class="a.unlockedAt ? '' : 'opacity-50'"
            >
              <p class="font-medium">
                {{ a.title }}
              </p>
              <p class="text-muted-foreground">
                {{ a.description }}
              </p>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="mb-2 text-sm font-medium">
            {{ t('player.promos') }}
          </h3>
          <ul class="grid gap-2">
            <li
              v-for="p in promos"
              :key="p.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
            >
              <div>
                <p class="font-medium">
                  {{ p.title }}
                </p>
                <p class="text-muted-foreground">
                  {{ t('player.fromLevel', { n: p.minLevel }) }}
                </p>
              </div>
              <code v-if="p.claimed && p.code" class="rounded-md bg-muted px-2 py-1 text-xs">{{ p.code }}</code>
              <Button
                v-else
                size="sm"
                :disabled="claiming === p.id || (progress?.level ?? 1) < p.minLevel"
                @click="claim(p.id)"
              >
                {{ t('player.claim') }}
              </Button>
            </li>
          </ul>
        </section>
      </TabsContent>

      <TabsContent value="complaints" class="mt-4 space-y-3">
        <a :href="siteUrl('/complaints')" class="text-sm underline">
          {{ t('player.fileComplaint') }}
        </a>
        <p v-if="!complaints.length" class="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          {{ t('player.complaintsEmpty') }}
        </p>
        <article v-for="c in complaints" :key="c.id" class="rounded-xl border p-4 space-y-1">
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p class="font-medium">
              {{ c.subject }}
            </p>
            <span class="text-muted-foreground">
              {{ complaintStatus(c.status) }} · {{ fmtDate(c.createdAt) }}
            </span>
          </div>
          <p v-if="c.casinoName" class="text-sm text-muted-foreground">
            {{ c.casinoName }}
          </p>
          <p v-if="c.staffNote" class="text-sm">
            {{ c.staffNote }}
          </p>
        </article>
      </TabsContent>

      <TabsContent value="notes" class="mt-4 space-y-3">
        <p v-if="!notes.length" class="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          {{ t('player.notesEmpty') }}
        </p>
        <article
          v-for="n in notes"
          :key="n.id"
          class="rounded-xl border p-4 space-y-2"
          :class="n.read_at ? '' : 'border-primary/40'"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p class="font-medium">
              {{ n.title }}
            </p>
            <span class="text-muted-foreground">
              {{ n.read_at ? fmtDate(n.created_at) : t('player.noteNew') }}
            </span>
          </div>
          <p v-if="n.body" class="text-sm text-muted-foreground">
            {{ n.body }}
          </p>
          <Button v-if="!n.read_at" size="sm" variant="outline" @click="markRead(n.id)">
            {{ t('player.markRead') }}
          </Button>
        </article>
      </TabsContent>
    </Tabs>
  </div>
</template>
