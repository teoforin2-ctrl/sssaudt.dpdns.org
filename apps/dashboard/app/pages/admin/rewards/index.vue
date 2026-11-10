<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          A/B награды · Quality Yield
        </h1>
        <p class="text-sm text-muted-foreground">
          UGC-отзывы за период · yield ≈ (avg quality × approved) / $ paid
        </p>
      </div>
      <AdminSectionHelp section="rewards" />
    </div>

    <div class="flex gap-2 items-center">
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
      <Button variant="secondary" :disabled="pending" @click="refresh">
        Обновить
      </Button>
      <NuxtLink class="text-sm underline ml-auto" to="/admin/settings/rewards">
        Настройки наград →
      </NuxtLink>
    </div>

    <div v-if="error" class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
      Не удалось загрузить отчёт
    </div>

    <div v-else class="rounded-xl border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-left">
          <tr>
            <th class="px-3 py-2">
              Группа
            </th>
            <th class="px-3 py-2">
              Submitted
            </th>
            <th class="px-3 py-2">
              Approved
            </th>
            <th class="px-3 py-2">
              Rejected
            </th>
            <th class="px-3 py-2">
              Paid
            </th>
            <th class="px-3 py-2">
              Avg quality
            </th>
            <th class="px-3 py-2">
              Cost $
            </th>
            <th class="px-3 py-2">
              Quality Yield
            </th>
            <th class="px-3 py-2">
              $/quality
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(data?.groups?.length)" class="border-t">
            <td colspan="9" class="px-3 py-6 text-center text-muted-foreground">
              Нет UGC-данных за период
            </td>
          </tr>
          <tr v-for="g in data?.groups || []" :key="g.group" class="border-t">
            <td class="px-3 py-2 font-semibold">
              {{ g.group }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.submitted }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.approved }}
              <span class="text-xs text-muted-foreground">({{ Math.round(g.approveRate * 100) }}%)</span>
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.rejected }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.paid }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.avgQuality?.toFixed(1) ?? '—' }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.rewardCostUsd.toFixed(2) }}
            </td>
            <td class="px-3 py-2 tabular-nums font-semibold">
              {{ g.qualityYield ?? '—' }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ g.costPerQuality ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
