<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface RewardSettings {
  enabled: boolean
  currency: string
  network: string
  explorerTxTemplate: string
  fixedAmountA: number
  rewardPreviewB: string
  payoutMode: 'mock' | 'provider'
  minReviewChars: number
  moderationDelayMs: number
  payoutDelayMs: number
  rateLimitPerHour: number
  blockDuplicateWallet: boolean
  maxPaidReviewsPerPlayerCasino: number
  wheelTable: { amount: number, p: number }[]
}

interface SettingsRes {
  settings: { rewardSettings: RewardSettings }
}

const { data, pending, refresh } = await useAsyncData('admin-reward-settings', () => api<SettingsRes>('/v1/admin/site-settings'))

const form = reactive<RewardSettings>({
  enabled: true,
  currency: 'USDT',
  network: 'TRON (TRC-20)',
  explorerTxTemplate: 'https://tronscan.org/#/transaction/{hash}',
  fixedAmountA: 1,
  rewardPreviewB: 'случайную награду до $100',
  payoutMode: 'mock',
  minReviewChars: 250,
  moderationDelayMs: 2500,
  payoutDelayMs: 2000,
  rateLimitPerHour: 5,
  blockDuplicateWallet: true,
  maxPaidReviewsPerPlayerCasino: 1,
  wheelTable: [],
})

watch(
  () => data.value?.settings?.rewardSettings,
  (s) => {
    if (!s)
      return
    Object.assign(form, JSON.parse(JSON.stringify(s)))
  },
  { immediate: true },
)

const saving = ref(false)
const msg = ref<string | null>(null)
const err = ref<string | null>(null)
const isAdmin = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

async function save() {
  if (!isAdmin.value)
    return
  saving.value = true
  msg.value = null
  err.value = null
  try {
    await api('/v1/admin/site-settings', {
      method: 'PATCH',
      body: { reward_settings: { ...form } },
    })
    msg.value = 'Сохранено'
    await refresh()
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    err.value = status === 403 ? 'Только главный admin может менять награды' : 'Ошибка сохранения'
  }
  finally {
    saving.value = false
  }
}

function addWheelRow() {
  form.wheelTable.push({ amount: 1, p: 0.1 })
}

function removeWheelRow(i: number) {
  form.wheelTable.splice(i, 1)
}
</script>

<template>
  <div class="space-y-4 max-w-3xl">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Награды / payout
        </h1>
        <p class="text-sm text-muted-foreground">
          Только роль <code>admin</code>. Реальный провайдер — позже (режим provider).
        </p>
      </div>
      <AdminSectionHelp section="settings-rewards" />
    </div>

    <div v-if="!isAdmin" class="rounded-xl border border-amber-500/40 p-4 text-sm">
      Просмотр доступен staff, изменение — только главному admin.
    </div>

    <div v-if="pending && !data" class="space-y-2">
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <form v-else class="space-y-4" @submit.prevent="save">
      <label class="flex items-center gap-2 text-sm">
        <input v-model="form.enabled" type="checkbox" :disabled="!isAdmin">
        Программа наград включена
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Валюта</span>
          <Input v-model="form.currency" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Сеть</span>
          <Input v-model="form.network" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1 sm:col-span-2">
          <span class="text-muted-foreground">Explorer TX template</span>
          <Input v-model="form.explorerTxTemplate" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Группа A · fixed $</span>
          <Input v-model.number="form.fixedAmountA" type="number" step="0.01" min="0.01" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Режим payout</span>
          <select
            v-model="form.payoutMode"
            class="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            :disabled="!isAdmin"
          >
            <option value="mock">
              mock
            </option>
            <option value="provider">
              provider (TBD)
            </option>
          </select>
        </label>
        <label class="text-sm space-y-1 sm:col-span-2">
          <span class="text-muted-foreground">Текст награды для группы B</span>
          <Input v-model="form.rewardPreviewB" :disabled="!isAdmin" />
        </label>
      </div>

      <div class="rounded-xl border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-sm">
            Таблица вероятностей B
          </h3>
          <Button v-if="isAdmin" type="button" size="sm" variant="outline" @click="addWheelRow">
            + строка
          </Button>
        </div>
        <div
          v-for="(row, i) in form.wheelTable"
          :key="i"
          class="flex gap-2 items-center"
        >
          <Input v-model.number="row.amount" type="number" step="0.01" class="w-28" :disabled="!isAdmin" />
          <Input v-model.number="row.p" type="number" step="0.001" min="0" class="w-28" :disabled="!isAdmin" />
          <Button
            v-if="isAdmin"
            type="button"
            size="sm"
            variant="ghost"
            @click="removeWheelRow(i)"
          >
            ×
          </Button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Мин. символов отзыва</span>
          <Input v-model.number="form.minReviewChars" type="number" min="50" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Лимит модераций / час</span>
          <Input v-model.number="form.rateLimitPerHour" type="number" min="1" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Delay модерации (мс)</span>
          <Input v-model.number="form.moderationDelayMs" type="number" min="0" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Delay payout (мс)</span>
          <Input v-model.number="form.payoutDelayMs" type="number" min="0" :disabled="!isAdmin" />
        </label>
        <label class="text-sm space-y-1">
          <span class="text-muted-foreground">Макс. paid отзывов / игрок×казино</span>
          <Input v-model.number="form.maxPaidReviewsPerPlayerCasino" type="number" min="1" :disabled="!isAdmin" />
        </label>
        <label class="flex items-center gap-2 text-sm self-end">
          <input v-model="form.blockDuplicateWallet" type="checkbox" :disabled="!isAdmin">
          Блок дублей кошелька
        </label>
      </div>

      <div class="flex gap-2 items-center">
        <Button type="submit" :disabled="!isAdmin || saving">
          Сохранить
        </Button>
        <span v-if="msg" class="text-sm text-muted-foreground">{{ msg }}</span>
        <span v-if="err" class="text-sm text-destructive">{{ err }}</span>
      </div>
    </form>
  </div>
</template>
