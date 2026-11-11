<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { ChartColumn, Coins } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const days = ref(30)

interface GroupRow {
  group: string
  submitted: number
  approved: number
  rejected: number
  paid: number
  avgQuality: number | null
  rewardCostUsd: number
  qualityYield: number | null
  costPerQuality: number | null
  approveRate: number
}

const { data, pending, error, refresh } = await useAsyncData(
  'admin-ab-report',
  () =>
    api<{ days: number, groups: GroupRow[] }>('/v1/admin/rewards/ab-report', {
      query: { days: days.value },
    }),
  { watch: [days] },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const groupA = computed(() => data.value?.groups?.find(g => g.group === 'A'))
const groupB = computed(() => data.value?.groups?.find(g => g.group === 'B'))

const kpiCards = computed(() => {
  const a = groupA.value
  const b = groupB.value
  return [
    { label: 'A · approved', value: a?.approved ?? 0, hint: a ? `${Math.round(a.approveRate * 100)}% rate` : '—', tone: 'cyan' as AdminTone },
    { label: 'B · approved', value: b?.approved ?? 0, hint: b ? `${Math.round(b.approveRate * 100)}% rate` : '—', tone: 'violet' as AdminTone },
    { label: 'A · cost $', value: a?.rewardCostUsd ?? 0, hint: 'выплачено', tone: 'amber' as AdminTone },
    { label: 'B · cost $', value: b?.rewardCostUsd ?? 0, hint: 'выплачено', tone: 'emerald' as AdminTone },
  ]
})

const maxApproved = computed(() =>
  Math.max(1, ...(data.value?.groups || []).map(g => g.approved)),
)
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="A/B награды · Quality Yield"
      description="UGC-отзывы за период · yield ≈ (avg quality × approved) / $ paid"
      help="rewards"
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
          Обновить
        </Button>
        <Button as-child size="sm" variant="secondary">
          <NuxtLink to="/admin/settings/rewards">
            Настройки
          </NuxtLink>
        </Button>
      </template>
    </AdminPageHeader>

    <div v-if="error" class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Не удалось загрузить отчёт
    </div>

    <template v-else>
      <AdminUiAdminStatGrid>
        <AdminUiAdminStatCard
          v-for="(card, i) in kpiCards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :hint="card.hint"
          :icon="i < 2 ? ChartColumn : Coins"
          :tone="card.tone"
          :ready="ready && !pending"
          :index="i"
        />
      </AdminUiAdminStatGrid>

      <div
        v-if="data?.groups?.length"
        class="grid gap-3 rounded-2xl border bg-card/40 p-4 sm:grid-cols-2"
      >
        <div v-for="g in data.groups" :key="g.group" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium">
              Группа {{ g.group }}
            </span>
            <span class="tabular-nums text-muted-foreground">
              {{ g.approved }} approved
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="g.group === 'A' ? 'bg-cyan-500' : 'bg-violet-500'"
              :style="{ width: ready ? `${(g.approved / maxApproved) * 100}%` : '0%' }"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            yield {{ g.qualityYield ?? '—' }} · $/q {{ g.costPerQuality ?? '—' }}
          </p>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/80 text-left backdrop-blur">
            <tr class="text-xs uppercase tracking-wide text-muted-foreground">
              <th class="px-3 py-2.5 font-medium">
                Группа
              </th>
              <th class="px-3 py-2.5 font-medium">
                Submitted
              </th>
              <th class="px-3 py-2.5 font-medium">
                Approved
              </th>
              <th class="px-3 py-2.5 font-medium">
                Rejected
              </th>
              <th class="px-3 py-2.5 font-medium">
                Paid
              </th>
              <th class="px-3 py-2.5 font-medium">
                Avg quality
              </th>
              <th class="px-3 py-2.5 font-medium">
                Cost $
              </th>
              <th class="px-3 py-2.5 font-medium">
                Yield
              </th>
              <th class="px-3 py-2.5 font-medium">
                $/quality
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!(data?.groups?.length)">
              <td colspan="9" class="px-3 py-2">
                <AdminUiAdminEmptyState
                  title="Нет UGC-данных за период"
                  description="Отзывы с наградами появятся после трафика"
                  :icon="ChartColumn"
                />
              </td>
            </tr>
            <tr
              v-for="g in data?.groups || []"
              :key="g.group"
              class="border-t transition-colors hover:bg-muted/40"
            >
              <td class="px-3 py-2.5 font-semibold">
                {{ g.group }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.submitted }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.approved }}
                <span class="text-xs text-muted-foreground">({{ Math.round(g.approveRate * 100) }}%)</span>
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.rejected }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.paid }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.avgQuality?.toFixed(1) ?? '—' }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.rewardCostUsd.toFixed(2) }}
              </td>
              <td class="px-3 py-2.5 tabular-nums font-semibold">
                {{ g.qualityYield ?? '—' }}
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ g.costPerQuality ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
