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

const savedSnapshot = ref('')

watch(
  () => data.value?.settings?.rewardSettings,
  (s) => {
    if (!s)
      return
    Object.assign(form, JSON.parse(JSON.stringify(s)))
    savedSnapshot.value = JSON.stringify(form)
  },
  { immediate: true },
)

const dirty = computed(() => savedSnapshot.value !== '' && JSON.stringify(form) !== savedSnapshot.value)
const saving = ref(false)
const msg = ref<string | null>(null)
const err = ref<string | null>(null)
const isAdmin = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

const wheelSum = computed(() =>
  form.wheelTable.reduce((s, r) => s + (Number(r.p) || 0), 0),
)
const wheelOk = computed(() => Math.abs(wheelSum.value - 1) < 0.001)
const expectedValue = computed(() =>
  form.wheelTable.reduce((s, r) => s + (Number(r.amount) || 0) * (Number(r.p) || 0), 0),
)
const maxP = computed(() => Math.max(0.001, ...form.wheelTable.map(r => Number(r.p) || 0)))

async function save() {
  if (!isAdmin.value || !wheelOk.value)
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
    savedSnapshot.value = JSON.stringify(form)
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

function reset() {
  if (!savedSnapshot.value)
    return
  Object.assign(form, JSON.parse(savedSnapshot.value))
  msg.value = null
  err.value = null
}

function addWheelRow() {
  form.wheelTable.push({ amount: 1, p: 0.1 })
}

function removeWheelRow(i: number) {
  form.wheelTable.splice(i, 1)
}
</script>

<template>
  <div class="max-w-3xl space-y-6 pb-24">
    <AdminPageHeader
      title="Награды / payout"
      description="Только роль admin. Реальный провайдер — позже (режим provider)."
      help="settings-rewards"
    >
      <template #actions>
        <Badge
          v-if="form.payoutMode === 'mock'"
          variant="outline"
          class="border-amber-500/40 text-amber-700 dark:text-amber-400"
        >
          тестовый режим
        </Badge>
      </template>
    </AdminPageHeader>

    <div v-if="!isAdmin" class="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      Просмотр доступен staff, изменение — только главному admin.
    </div>

    <div v-if="pending && !data" class="space-y-2">
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <form v-else class="space-y-4" @submit.prevent="save">
      <section class="space-y-3 rounded-2xl border bg-card/40 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Программа
        </h2>
        <AdminCheckbox v-model:checked="form.enabled" :disabled="!isAdmin">
          Программа наград включена
        </AdminCheckbox>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Валюта</span>
            <Input v-model="form.currency" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Сеть</span>
            <Input v-model="form.network" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm sm:col-span-2">
            <span class="text-muted-foreground">Explorer TX template</span>
            <Input v-model="form.explorerTxTemplate" :disabled="!isAdmin" />
          </label>
        </div>
      </section>

      <section class="space-y-3 rounded-2xl border bg-card/40 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Группа A / B
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Группа A · fixed $</span>
            <Input v-model.number="form.fixedAmountA" type="number" step="0.01" min="0.01" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Режим payout</span>
            <AdminSelect
              v-model="form.payoutMode"
              :disabled="!isAdmin"
              :options="[
                { value: 'mock', label: 'mock' },
                { value: 'provider', label: 'provider (TBD)' },
              ]"
            />
          </label>
          <label class="space-y-1 text-sm sm:col-span-2">
            <span class="text-muted-foreground">Текст награды для группы B</span>
            <Input v-model="form.rewardPreviewB" :disabled="!isAdmin" />
          </label>
        </div>
      </section>

      <section class="space-y-3 rounded-2xl border bg-card/40 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Таблица вероятностей B
            </h2>
            <p class="text-xs text-muted-foreground">
              EV ≈ ${{ expectedValue.toFixed(2) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge
              variant="outline"
              :class="wheelOk
                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                : 'border-rose-500/40 text-rose-700 dark:text-rose-400'"
            >
              Σ p = {{ wheelSum.toFixed(3) }}
            </Badge>
            <Button v-if="isAdmin" type="button" size="sm" variant="outline" @click="addWheelRow">
              + строка
            </Button>
          </div>
        </div>
        <div
          v-for="(row, i) in form.wheelTable"
          :key="i"
          class="grid gap-2 sm:grid-cols-[7rem_7rem_1fr_auto] sm:items-center"
        >
          <Input v-model.number="row.amount" type="number" step="0.01" :disabled="!isAdmin" placeholder="$" />
          <Input v-model.number="row.p" type="number" step="0.001" min="0" :disabled="!isAdmin" placeholder="p" />
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-violet-500 transition-all"
              :style="{ width: `${((Number(row.p) || 0) / maxP) * 100}%` }"
            />
          </div>
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
        <p v-if="!wheelOk" class="text-xs text-rose-600 dark:text-rose-400">
          Сумма вероятностей должна быть 1.0 — сохранение заблокировано
        </p>
      </section>

      <section class="space-y-3 rounded-2xl border bg-card/40 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Лимиты модерации и защита
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Мин. символов отзыва</span>
            <Input v-model.number="form.minReviewChars" type="number" min="50" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Лимит модераций / час</span>
            <Input v-model.number="form.rateLimitPerHour" type="number" min="1" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Delay модерации (мс)</span>
            <Input v-model.number="form.moderationDelayMs" type="number" min="0" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Delay payout (мс)</span>
            <Input v-model.number="form.payoutDelayMs" type="number" min="0" :disabled="!isAdmin" />
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">Макс. paid отзывов / игрок×казино</span>
            <Input v-model.number="form.maxPaidReviewsPerPlayerCasino" type="number" min="1" :disabled="!isAdmin" />
          </label>
          <AdminCheckbox v-model:checked="form.blockDuplicateWallet" :disabled="!isAdmin" label-class="self-end">
            Блок дублей кошелька
          </AdminCheckbox>
        </div>
      </section>
    </form>

    <AdminUiAdminStickySaveBar
      :dirty="dirty && isAdmin"
      :saving="saving"
      :message="msg"
      :error="err || (!wheelOk ? 'Σ p ≠ 1.0' : null)"
      @save="save"
      @reset="reset"
    />
  </div>
</template>
