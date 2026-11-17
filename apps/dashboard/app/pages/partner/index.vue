<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { NumberFlowGroup } from '@number-flow/vue'
import { ExternalLink, Flame, Medal, MousePointerClick, Plus, Star } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()
const route = useRoute()
const { t, dateLocale, siteUrl, fmtDate, webOrigin } = useCabinetLocale()

const tab = computed({
  get: () => {
    const t = String(route.query.tab || 'home')
    return t === 'reviews' || t === 'bonuses' ? t : 'home'
  },
  set: (v: string) => {
    navigateTo({ path: '/partner', query: v === 'home' ? {} : { tab: v } })
  },
})

interface PartnerMe {
  cabinetOpen: boolean
  revshareUrl: string | null
  user: { email: string, role: string, casinoId: string | null }
  casino: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    rating: number | null
    editorialScore: number | null
    playerScore: number | null
    baseRating: number | null
    rank: number | null
    hot: boolean
    hotUntil: string | null
    hotPlan: string | null
    revshareRate: number | null
    partnerUrl: string | null
    hasRepresentative: boolean
    representativeRequestedAt: string | null
  } | null
  counts: { bonuses: number, reviews: number, pendingReviews: number }
}

const { data, pending, error, refresh } = await useAsyncData('partner-me', () => api<PartnerMe>('/v1/partner/me'))
const me = computed(() => data.value ?? null)

const revshareInput = ref('')
const savingLink = ref(false)
const editingLink = ref(false)

watch(() => data.value?.revshareUrl, (u) => {
  if (u)
    revshareInput.value = u
}, { immediate: true })

async function saveRevshare() {
  savingLink.value = true
  try {
    await api('/v1/partner/revshare', { method: 'PATCH', body: { url: revshareInput.value.trim() } })
    editingLink.value = false
    toast.success(t('toast.revshareOk'))
    await refresh()
  }
  catch {
    toast.error(t('toast.revshareFail'))
  }
  finally {
    savingLink.value = false
  }
}

const clickDays = ref(30)
const { data: dash, refresh: refreshDash } = await useAsyncData(
  'partner-dash',
  () => api<{
    clickDays: number
    clicks: number | null
    trackingOn: boolean
    history: Array<{
      day: string
      editorial: number | null
      player: number | null
      base: number | null
      final: number | null
      rank: number | null
    }>
  }>('/v1/partner/dashboard', { query: { clickDays: clickDays.value } }),
  { watch: [clickDays], server: false, lazy: true },
)

watch(
  () => data.value?.cabinetOpen,
  async (open) => {
    if (open)
      await refreshDash()
  },
  { immediate: true },
)

const scoreSeries = computed(() => {
  const h = dash.value?.history || []
  return {
    editorial: h.filter(p => p.editorial != null).map((p, i) => ({ x: i, y: p.editorial as number })),
    player: h.filter(p => p.player != null).map((p, i) => ({ x: i, y: p.player as number })),
    base: h.filter(p => p.base != null).map((p, i) => ({ x: i, y: p.base as number })),
    final: h.filter(p => p.final != null).map((p, i) => ({ x: i, y: p.final as number })),
    rank: h.filter(p => p.rank != null).map((p, i) => ({ x: i, y: p.rank as number })),
  }
})

const connectingHot = ref(false)
async function connectHot(plan: 'month' | 'year') {
  connectingHot.value = true
  try {
    await api('/v1/partner/hot', { method: 'POST', body: { plan } })
    toast.success(plan === 'year' ? t('toast.hotYear') : t('toast.hotMonth'))
    await refresh()
  }
  catch {
    toast.error(t('toast.hotFail'))
  }
  finally {
    connectingHot.value = false
  }
}

interface Bonus {
  id: string
  title: string
  title_ru: string | null
  promo_code: string | null
  description_ru: string | null
  terms_ru: string | null
  image_url: string | null
  published: boolean
}

const { data: bonuses, refresh: refreshBonuses } = await useAsyncData(
  'partner-bonuses-tab',
  () => api<{ items: Bonus[], publishedCount: number, maxPublished: number }>('/v1/partner/bonuses'),
  { server: false, lazy: true },
)

const bonusOpen = ref(false)
const bonusEditId = ref<string | null>(null)
const bonusTitle = ref('')
const bonusDescription = ref('')
const bonusTerms = ref('')
const bonusPromo = ref('')
const bonusImageDataUrl = ref('')
const bonusPreview = ref('')
const bonusBusy = ref(false)
const deleteBonusId = ref<string | null>(null)

function resetBonusForm() {
  bonusTitle.value = ''
  bonusDescription.value = ''
  bonusTerms.value = ''
  bonusPromo.value = ''
  bonusImageDataUrl.value = ''
  bonusPreview.value = ''
  bonusEditId.value = null
}

function openNewBonus() {
  resetBonusForm()
  bonusOpen.value = true
}

function openEditBonus(b: Bonus) {
  bonusEditId.value = b.id
  bonusTitle.value = b.title_ru || b.title
  bonusDescription.value = b.description_ru || ''
  bonusTerms.value = b.terms_ru || ''
  bonusPromo.value = b.promo_code || ''
  bonusImageDataUrl.value = ''
  bonusPreview.value = b.image_url || ''
  bonusOpen.value = true
}

function onBonusImage(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    bonusImageDataUrl.value = String(reader.result || '')
    bonusPreview.value = bonusImageDataUrl.value
  }
  reader.readAsDataURL(file)
}

async function saveBonus() {
  if (!bonusTitle.value.trim())
    return
  bonusBusy.value = true
  try {
    const body: Record<string, unknown> = {
      title: bonusTitle.value.trim(),
      description: bonusDescription.value.trim() || null,
      terms: bonusTerms.value.trim() || null,
      promo_code: bonusPromo.value.trim() || null,
    }
    if (bonusImageDataUrl.value)
      body.imageDataUrl = bonusImageDataUrl.value
    if (bonusEditId.value) {
      await api(`/v1/partner/bonuses/${bonusEditId.value}`, { method: 'PATCH', body })
    }
    else {
      await api('/v1/partner/bonuses', { method: 'POST', body })
    }
    bonusOpen.value = false
    toast.success(t('toast.bonusOk'))
    await refreshBonuses()
    await refresh()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string } }
    toast.error(e.data?.error === 'bonus_limit' ? t('toast.bonusLimit') : t('toast.bonusFail'))
  }
  finally {
    bonusBusy.value = false
  }
}

function askDeleteBonus(id: string) {
  deleteBonusId.value = id
}

async function confirmDeleteBonus() {
  const id = deleteBonusId.value
  if (!id)
    return
  deleteBonusId.value = null
  await api(`/v1/partner/bonuses/${id}`, { method: 'DELETE' })
  await refreshBonuses()
  await refresh()
}

const reviewSort = ref('new')
const reviewPage = ref(1)
const { data: reviews, refresh: refreshReviews } = await useAsyncData(
  'partner-reviews-tab',
  () => api<{
    items: Array<{
      id: string
      rating: number
      body: string
      status: string
      author_name: string | null
      created_at: string
      reply: { id: string, body: string } | null
    }>
    total: number
    page: number
  }>('/v1/partner/reviews', {
    query: { sort: reviewSort.value, page: reviewPage.value, limit: 20 },
  }),
  { watch: [reviewSort, reviewPage], server: false, lazy: true },
)

const { data: templates, refresh: refreshTemplates } = await useAsyncData(
  'partner-templates',
  () => api<{ items: Array<{ id: string, body: string }>, max: number }>('/v1/partner/reply-templates'),
  { server: false, lazy: true },
)

watch(tab, (t) => {
  if (!data.value?.cabinetOpen)
    return
  if (t === 'bonuses')
    void refreshBonuses()
  if (t === 'reviews') {
    void refreshReviews()
    void refreshTemplates()
  }
}, { immediate: true })

const tplDraft = ref('')
const tplEditId = ref<string | null>(null)
async function saveTemplate() {
  const body = tplDraft.value.trim()
  if (!body)
    return
  try {
    if (tplEditId.value)
      await api(`/v1/partner/reply-templates/${tplEditId.value}`, { method: 'PATCH', body: { body } })
    else
      await api('/v1/partner/reply-templates', { method: 'POST', body: { body } })
    tplDraft.value = ''
    tplEditId.value = null
    await refreshTemplates()
  }
  catch {
    toast.error(t('toast.tplLimit'))
  }
}
async function deleteTemplate(id: string) {
  await api(`/v1/partner/reply-templates/${id}`, { method: 'DELETE' })
  await refreshTemplates()
}

const replyOpen = ref(false)
const replyReviewId = ref<string | null>(null)
const replyText = ref('')
const replyBusy = ref(false)

function openReply(r: { id: string, reply: { body: string } | null }) {
  replyReviewId.value = r.id
  replyText.value = r.reply?.body || ''
  replyOpen.value = true
}
function insertTpl(body: string) {
  replyText.value = body
}
async function publishReply() {
  if (!replyReviewId.value || !replyText.value.trim())
    return
  replyBusy.value = true
  try {
    await api(`/v1/partner/reviews/${replyReviewId.value}/reply`, {
      method: 'PUT',
      body: { body: replyText.value.trim() },
    })
    replyOpen.value = false
    toast.success(t('toast.replyOk'))
    await refreshReviews()
  }
  catch {
    toast.error(t('toast.replyFail'))
  }
  finally {
    replyBusy.value = false
  }
}

function asset(path: string | null | undefined) {
  if (!path)
    return ''
  if (path.startsWith('http') || path.startsWith('data:'))
    return path
  return `${webOrigin}${path}`
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const kpis = computed(() => {
  const c = me.value?.casino
  const counts = me.value?.counts
  const clicks = dash.value?.clicks
  const items: Array<{
    key: string
    label: string
    value: number
    hint: string
    to?: string
    icon: typeof Star
    tone: AdminTone
  }> = [
    {
      key: 'rating',
      label: t('kpi.rating'),
      value: Number(c?.rating ?? 0),
      hint: c?.rating == null ? t('kpi.noRating') : t('kpi.byMethodology'),
      icon: Star,
      tone: 'amber',
    },
    {
      key: 'rank',
      label: t('kpi.rank'),
      value: Number(c?.rank ?? 0),
      hint: t('kpi.edPlayers', { ed: c?.editorialScore ?? '—', pl: c?.playerScore ?? '—' }),
      icon: Medal,
      tone: 'violet',
    },
    {
      key: 'reviews',
      label: t('kpi.reviews'),
      value: counts?.reviews ?? 0,
      hint: counts?.pendingReviews ? t('kpi.awaitingReply', { n: counts.pendingReviews }) : t('kpi.publishedAdj'),
      to: '/partner?tab=reviews',
      icon: Star,
      tone: 'cyan',
    },
    {
      key: 'clicks',
      label: t('kpi.clicks', { d: clickDays.value }),
      value: clicks ?? 0,
      hint: dash.value?.trackingOn === false ? t('kpi.trackingOff') : (clicks == null ? t('kpi.noData') : t('kpi.casinoClicks')),
      icon: MousePointerClick,
      tone: 'emerald',
    },
  ]
  return items
})
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('partner.title') }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ user?.email }} · {{ data?.casino?.name || t('partner.noCasino') }}
      </p>
    </div>

    <div v-if="error" class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('partner.loadErr') }}
    </div>
    <div v-else-if="pending && !data" class="space-y-2">
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <template v-else-if="me">
      <section class="rounded-2xl border p-4 sm:p-5 space-y-3">
        <h2 class="text-sm font-semibold">
          {{ t('partner.revshareTitle') }}
        </h2>
        <div v-if="!me?.cabinetOpen || editingLink" class="flex flex-col gap-2 sm:flex-row">
          <Input
            v-model="revshareInput"
            :placeholder="t('partner.revsharePlaceholder')"
            class="flex-1"
          />
          <Button :disabled="savingLink" @click="saveRevshare">
            {{ savingLink ? t('partner.saving') : t('partner.save') }}
          </Button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-2 text-sm">
          <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
            {{ t('partner.connected') }}
          </span>
          <Button size="sm" variant="outline" @click="editingLink = true">
            {{ t('partner.change') }}
          </Button>
        </div>
      </section>

      <p
        v-if="!me?.cabinetOpen"
        class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
      >
        {{ t('partner.needLink') }}
      </p>

      <Tabs
        v-else
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
          <TabsTrigger value="bonuses">
            {{ t('tabs.bonuses') }}
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
          <a
            :href="siteUrl('/methodology')"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {{ t('partner.methodology') }}
            <ExternalLink class="size-3" />
          </a>

          <div class="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 class="mb-2 text-sm font-medium">
                {{ t('partner.scoreHistory') }}
              </h3>
              <PartnerChart
                :points="scoreSeries.final.length ? scoreSeries.final : scoreSeries.editorial"
                :y-min="0"
                :y-max="5"
                :empty-text="t('partner.scoreEmpty')"
              />
              <p class="mt-1 text-[11px] text-muted-foreground">
                {{ t('partner.scoreHint') }}
              </p>
            </div>
            <div>
              <h3 class="mb-2 text-sm font-medium">
                {{ t('partner.rankHistory') }}
              </h3>
              <PartnerChart
                :points="scoreSeries.rank"
                invert-y
                color="#f0a202"
                :empty-text="t('partner.rankEmpty')"
              />
              <p class="mt-1 text-[11px] text-muted-foreground">
                {{ t('partner.rankHint') }}
              </p>
            </div>
          </div>

          <section class="rounded-xl border p-4 space-y-3">
            <div class="flex items-center gap-2">
              <Flame class="size-4 text-orange-500" />
              <h3 class="font-medium">
                HOT
              </h3>
            </div>
            <template v-if="me.casino?.hot">
              <p class="text-sm">
                {{ t('partner.hotUntil', { date: fmtDate(me?.casino?.hotUntil) }) }}
                <span v-if="me?.casino?.hotPlan" class="text-muted-foreground">
                  · {{ me?.casino?.hotPlan === 'year' ? t('partner.planYear') : t('partner.planMonth') }}
                </span>
              </p>
            </template>
            <div v-else class="flex flex-wrap gap-2">
              <Button :disabled="connectingHot" @click="connectHot('month')">
                {{ t('partner.connectMonth') }}
              </Button>
              <Button variant="outline" :disabled="connectingHot" @click="connectHot('year')">
                {{ t('partner.connectYear') }}
              </Button>
            </div>
          </section>

          <section class="rounded-xl border p-4 space-y-3">
            <h3 class="font-medium">
              {{ t('partner.report') }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t('partner.model') }} <strong>RevShare</strong>
              <span v-if="me.casino?.revshareRate != null">
                · {{ t('partner.rate', { n: me?.casino?.revshareRate ?? '' }) }}
              </span>
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <select
                v-model.number="clickDays"
                class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option :value="7">
                  {{ t('partner.d7') }}
                </option>
                <option :value="30">
                  {{ t('partner.d30') }}
                </option>
                <option :value="90">
                  {{ t('partner.d90') }}
                </option>
              </select>
              <p class="text-sm">
                {{ t('partner.clicksLabel') }}
                <strong v-if="dash?.clicks != null" class="tabular-nums">{{ dash.clicks }}</strong>
                <span v-else class="text-muted-foreground">{{ t('partner.noData') }}</span>
              </p>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="reviews" class="mt-4 space-y-4">
          <section>
            <h3 class="mb-2 text-sm font-medium">
              {{ t('partner.quickReplies') }}
            </h3>
            <div class="grid gap-2 sm:grid-cols-3">
              <button
                v-for="tpl in (templates?.items || [])"
                :key="tpl.id"
                type="button"
                class="rounded-xl border p-3 text-left text-sm hover:bg-muted/40"
                @click="tplEditId = tpl.id; tplDraft = tpl.body"
              >
                <p class="line-clamp-4">
                  {{ tpl.body }}
                </p>
                <div class="mt-2 flex gap-2">
                  <span class="text-xs text-muted-foreground">{{ t('partner.edit') }}</span>
                  <button type="button" class="text-xs text-destructive" @click.stop="deleteTemplate(tpl.id)">
                    {{ t('partner.delete') }}
                  </button>
                </div>
              </button>
              <div
                v-if="(templates?.items?.length || 0) < 6"
                class="rounded-xl border border-dashed p-3 space-y-2"
              >
                <textarea
                  v-model="tplDraft"
                  rows="3"
                  class="w-full rounded-md border bg-transparent px-2 py-1 text-sm"
                  :placeholder="t('partner.templatePh')"
                />
                <Button size="sm" variant="outline" @click="saveTemplate">
                  <Plus class="size-3.5" />
                  {{ tplEditId ? t('partner.save') : t('partner.add') }}
                </Button>
              </div>
            </div>
          </section>

          <div class="flex flex-wrap gap-2">
            <select
              v-model="reviewSort"
              class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
              @change="reviewPage = 1"
            >
              <option value="new">
                {{ t('partner.sortNew') }}
              </option>
              <option value="old">
                {{ t('partner.sortOld') }}
              </option>
              <option value="rating_asc">
                {{ t('partner.sortAsc') }}
              </option>
              <option value="rating_desc">
                {{ t('partner.sortDesc') }}
              </option>
            </select>
          </div>

          <div
            v-for="r in (reviews?.items || [])"
            :key="r.id"
            class="flex gap-3 rounded-xl border p-4"
          >
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex gap-2 text-sm">
                <span class="font-semibold">★ {{ r.rating }}</span>
                <span class="text-muted-foreground">{{ r.author_name || t('partner.anonymous') }}</span>
                <span class="text-xs text-muted-foreground">{{ fmtDate(r.created_at) }}</span>
              </div>
              <p class="whitespace-pre-wrap text-sm">
                {{ r.body }}
              </p>
              <p v-if="r.reply" class="rounded-md bg-muted/50 p-2 text-sm">
                {{ t('partner.replyPrefix', { body: r.reply.body }) }}
              </p>
            </div>
            <Button
              v-if="r.status === 'approved'"
              size="sm"
              variant="outline"
              class="shrink-0"
              @click="openReply(r)"
            >
              {{ t('partner.reply') }}
            </Button>
          </div>
          <p v-if="!(reviews?.items?.length)" class="py-8 text-center text-sm text-muted-foreground">
            {{ t('partner.noReviews') }}
          </p>
        </TabsContent>

        <TabsContent value="bonuses" class="mt-4 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-muted-foreground">
              {{ t('partner.publishedCount', { a: bonuses?.publishedCount ?? 0, b: bonuses?.maxPublished ?? 20 }) }}
            </p>
            <Button @click="openNewBonus">
              {{ t('partner.addBonus') }}
            </Button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <article
              v-for="b in (bonuses?.items || [])"
              :key="b.id"
              class="space-y-2 rounded-xl border p-4"
            >
              <img
                v-if="b.image_url"
                :src="asset(b.image_url)"
                alt=""
                class="h-28 w-full rounded-lg object-cover bg-muted"
              >
              <h3 class="font-medium">
                {{ b.title_ru || b.title }}
              </h3>
              <p v-if="b.promo_code" class="font-mono text-xs">
                {{ b.promo_code }}
              </p>
              <p v-if="b.description_ru" class="line-clamp-3 text-sm text-muted-foreground">
                {{ b.description_ru }}
              </p>
              <div class="flex gap-2">
                <Button size="sm" variant="outline" @click="openEditBonus(b)">
                  {{ t('partner.edit') }}
                </Button>
                <Button size="sm" variant="ghost" @click="askDeleteBonus(b.id)">
                  {{ t('partner.delete') }}
                </Button>
              </div>
            </article>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <Dialog v-model:open="replyOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('partner.replyTitle') }}</DialogTitle>
        </DialogHeader>
        <textarea
          v-model="replyText"
          rows="5"
          class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
        <div class="flex flex-wrap gap-1">
          <button
            v-for="tpl in (templates?.items || [])"
            :key="tpl.id"
            type="button"
            class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            @click="insertTpl(tpl.body)"
          >
            {{ tpl.body.slice(0, 40) }}…
          </button>
        </div>
        <DialogFooter>
          <Button :disabled="replyBusy" @click="publishReply">
            {{ t('partner.publish') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="bonusOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ bonusEditId ? t('partner.editBonus') : t('partner.addBonus') }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-2">
          <Input v-model="bonusTitle" :placeholder="t('partner.bonusTitle')" />
          <textarea v-model="bonusDescription" rows="3" class="w-full rounded-md border bg-transparent px-3 py-2 text-sm" :placeholder="t('partner.bonusDesc')" />
          <textarea v-model="bonusTerms" rows="3" class="w-full rounded-md border bg-transparent px-3 py-2 text-sm" :placeholder="t('partner.bonusTerms')" />
          <Input v-model="bonusPromo" :placeholder="t('partner.bonusPromo')" />
          <Input type="file" accept="image/png,image/jpeg,image/webp" @change="onBonusImage" />
          <img v-if="bonusPreview" :src="asset(bonusPreview)" alt="" class="h-24 rounded-md object-cover">
        </div>
        <DialogFooter>
          <Button :disabled="bonusBusy" @click="saveBonus">
            {{ t('partner.save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="!!deleteBonusId" @update:open="(v: boolean) => { if (!v) deleteBonusId = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('partner.deleteBonusTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('partner.deleteBonusBody') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('partner.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="confirmDeleteBonus">
            {{ t('partner.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
