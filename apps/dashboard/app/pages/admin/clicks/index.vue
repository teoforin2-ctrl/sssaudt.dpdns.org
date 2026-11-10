<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()

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

const maxDay = computed(() => Math.max(1, ...(data.value?.byDay.map(d => d.clicks) || [1])))

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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Клики /go/
        </h1>
        <p class="text-sm text-muted-foreground">
          Редиректы на партнёрские URL · таблица <code>go_clicks</code>
        </p>
      </div>
      <AdminSectionHelp section="clicks" />
    </div>

    <div class="flex flex-wrap gap-2 items-center">
      <select
        v-model.number="days"
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
      <Input
        v-model="q"
        class="max-w-sm"
        placeholder="Слаг / название казино"
        @keyup.enter="search"
      />
      <Button variant="secondary" :disabled="pending" @click="search">
        Найти
      </Button>
    </div>

    <div v-if="error" class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
      Не удалось загрузить отчёт
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          Кликов
        </p>
        <p class="mt-1 text-2xl font-bold tabular-nums">
          {{ data?.summary.total ?? '—' }}
        </p>
      </div>
      <div class="rounded-xl border p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          Казино
        </p>
        <p class="mt-1 text-2xl font-bold tabular-nums">
          {{ data?.summary.uniqueCasinos ?? '—' }}
        </p>
      </div>
      <div class="rounded-xl border p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          Последний клик
        </p>
        <p class="mt-1 text-sm font-semibold">
          {{ fmtDate(data?.summary.lastClick) }}
        </p>
      </div>
    </div>

    <div v-if="data?.byDay?.length" class="rounded-xl border p-4">
      <p class="mb-3 text-sm font-medium">
        По дням
      </p>
      <div class="flex items-end gap-1 h-24">
        <div
          v-for="d in data.byDay"
          :key="d.day"
          class="flex-1 min-w-0 rounded-t bg-primary/70"
          :style="{ height: `${Math.max(8, (d.clicks / maxDay) * 100)}%` }"
          :title="`${d.day}: ${d.clicks}`"
        />
      </div>
    </div>

    <div v-if="pending && !data" class="space-y-2">
      <Skeleton v-for="n in 6" :key="n" class="h-12 w-full rounded-xl" />
    </div>

    <div v-else class="rounded-xl border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-left">
          <tr>
            <th class="px-3 py-2 font-medium">
              #
            </th>
            <th class="px-3 py-2 font-medium">
              Казино
            </th>
            <th class="px-3 py-2 font-medium">
              Клики
            </th>
            <th class="px-3 py-2 font-medium">
              Последний
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(data?.items?.length)" class="border-t">
            <td colspan="4" class="px-3 py-6 text-center text-muted-foreground">
              Пока нет кликов за выбранный период
            </td>
          </tr>
          <tr
            v-for="(row, i) in data?.items || []"
            :key="row.casino_slug"
            class="border-t"
          >
            <td class="px-3 py-2 text-muted-foreground tabular-nums">
              {{ i + 1 }}
            </td>
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.casino_name }}
              </div>
              <div class="text-xs text-muted-foreground">
                <NuxtLink
                  v-if="row.casino_id"
                  class="underline-offset-2 hover:underline"
                  :to="`/admin/casinos/${row.casino_id}`"
                >
                  {{ row.casino_slug }}
                </NuxtLink>
                <span v-else>{{ row.casino_slug }}</span>
              </div>
            </td>
            <td class="px-3 py-2 font-semibold tabular-nums">
              {{ row.clicks }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ fmtDate(row.last_click) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
