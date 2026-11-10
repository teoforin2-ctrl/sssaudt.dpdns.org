<script setup lang="ts">
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

const { data, pending, refresh, error } = await useAsyncData(
  'admin-ops',
  () => api<OpsRes>('/v1/admin/ops'),
)

const cards = computed(() => {
  const c = data.value?.counts
  if (!c)
    return []
  return [
    { label: 'Казино published', value: c.casinosPublished, to: '/admin/casinos' },
    { label: 'Отзывы pending', value: c.reviewsPending, to: '/admin/reviews' },
    { label: 'Отзывы approved', value: c.reviewsApproved, to: '/admin/reviews' },
    { label: 'Жалобы open', value: c.complaintsOpen, to: '/admin/complaints' },
    { label: 'ЧС published', value: c.blacklistPublished, to: '/admin/blacklist' },
    { label: 'Бонусы active', value: c.bonusesActive, to: '/admin/bonuses' },
    { label: 'Статьи published', value: c.articlesPublished, to: '/admin/articles' },
    { label: 'Игроки с прогрессом', value: c.playersWithProgress, to: '/admin' },
  ]
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Ops lite
        </h1>
        <p class="text-sm text-muted-foreground">
          Быстрый health-check API / Redis / очередей без полного APM
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          :disabled="pending"
          @click="refresh()"
        >
          Обновить
        </Button>
        <AdminSectionHelp section="ops" />
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
    >
      Не удалось загрузить /v1/admin/ops
    </div>

    <div
      v-else
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div class="rounded-xl border p-4">
        <p class="text-xs text-muted-foreground">
          API / DB
        </p>
        <p class="mt-1 text-lg font-semibold">
          {{ data?.ok ? 'OK' : '…' }}
          <span class="text-sm font-normal text-muted-foreground">
            · {{ data?.dbMs ?? '—' }} ms
          </span>
        </p>
      </div>
      <div class="rounded-xl border p-4">
        <p class="text-xs text-muted-foreground">
          Redis
        </p>
        <p
          class="mt-1 text-lg font-semibold"
          :class="data?.redisOk ? 'text-emerald-600' : 'text-destructive'"
        >
          {{ pending ? '…' : (data?.redisOk ? 'PONG' : 'DOWN') }}
        </p>
      </div>
      <div class="rounded-xl border p-4 sm:col-span-2">
        <p class="text-xs text-muted-foreground">
          Роль
        </p>
        <p class="mt-1 text-lg font-semibold">
          {{ data?.role || '—' }}
          <span
            v-if="data?.canAdmin"
            class="ml-2 text-xs font-medium text-muted-foreground"
          >admin rights</span>
        </p>
      </div>
    </div>

    <div
      v-if="pending && !data"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="h-24 animate-pulse rounded-xl border bg-muted/40"
      />
    </div>

    <div
      v-else
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <NuxtLink
        v-for="card in cards"
        :key="card.label"
        :to="card.to"
        class="rounded-xl border p-4 transition hover:bg-muted/40"
      >
        <p class="text-xs text-muted-foreground">
          {{ card.label }}
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">
          {{ card.value < 0 ? '—' : card.value }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
