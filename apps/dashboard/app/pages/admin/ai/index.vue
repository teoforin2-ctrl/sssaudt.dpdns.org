<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Bot,
  Coins,
  ListTodo,
  RefreshCw,
  Settings2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Switch } from '@/components/ui/switch'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const tab = ref<'overview' | 'settings' | 'usage' | 'jobs'>('overview')

interface AiSettings {
  model: string
  sourceLocales: string[]
  targetLocales: string[]
  autoProcess: boolean
  autoPublish: boolean
  dailyTokenLimit: number | null
  enabled: boolean
  hasApiKey: boolean
  apiKeyHint: string | null
  updatedAt: string | null
}

interface Overview {
  settings: AiSettings
  todayTokens: number
  jobsByStatus: Record<string, number>
  articlesAiProcessed: number
}

interface UsageRes {
  from: string
  to: string
  totals: { promptTokens: number, completionTokens: number, totalTokens: number, requests: number }
  daily: Array<{ day: string, promptTokens: number, completionTokens: number, totalTokens: number, requests: number }>
  breakdown: Array<{ contentType: string, action: string, promptTokens: number, completionTokens: number, totalTokens: number, requests: number }>
}

interface JobRow {
  id: string
  content_type: string
  content_id: string | null
  content_slug: string | null
  action: string
  status: string
  source_locale: string | null
  target_locales: string[]
  error: string | null
  attempts: number
  max_attempts: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  model: string | null
  created_at: string
  finished_at: string | null
}

const { data: overview, pending: overviewPending, refresh: refreshOverview } = await useAsyncData(
  'admin-ai-overview',
  () => api<Overview>('/v1/admin/ai/overview'),
)

const settingsForm = reactive({
  model: 'gpt-4o-mini',
  sourceLocales: 'en',
  targetLocales: 'ru',
  autoProcess: false,
  autoPublish: false,
  dailyTokenLimit: '' as string,
  enabled: true,
  apiKey: '',
  clearKey: false,
})

watch(
  () => overview.value?.settings,
  (s) => {
    if (!s)
      return
    settingsForm.model = s.model
    settingsForm.sourceLocales = (s.sourceLocales || []).join(', ')
    settingsForm.targetLocales = (s.targetLocales || []).join(', ')
    settingsForm.autoProcess = s.autoProcess
    settingsForm.autoPublish = Boolean(s.autoPublish)
    settingsForm.dailyTokenLimit = s.dailyTokenLimit != null ? String(s.dailyTokenLimit) : ''
    settingsForm.enabled = s.enabled
  },
  { immediate: true },
)

const saving = ref(false)
async function saveSettings() {
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      model: settingsForm.model.trim(),
      sourceLocales: settingsForm.sourceLocales.split(/[\s,]+/).filter(Boolean),
      targetLocales: settingsForm.targetLocales.split(/[\s,]+/).filter(Boolean),
      autoProcess: settingsForm.autoProcess,
      autoPublish: settingsForm.autoPublish,
      enabled: settingsForm.enabled,
      dailyTokenLimit: settingsForm.dailyTokenLimit.trim()
        ? Number(settingsForm.dailyTokenLimit)
        : null,
    }
    if (settingsForm.clearKey)
      body.apiKey = null
    else if (settingsForm.apiKey.trim())
      body.apiKey = settingsForm.apiKey.trim()

    await api('/v1/admin/ai/settings', { method: 'PATCH', body })
    settingsForm.apiKey = ''
    settingsForm.clearKey = false
    toast.success('Настройки ИИ сохранены')
    await refreshOverview()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    toast.error(e?.data?.error || e?.message || 'Ошибка сохранения')
  }
  finally {
    saving.value = false
  }
}

const usageFrom = ref(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
const usageTo = ref(new Date().toISOString().slice(0, 10))
const usageContentType = ref('all')
const usageAction = ref('all')

const { data: usage, pending: usagePending, refresh: refreshUsage } = await useAsyncData(
  'admin-ai-usage',
  () => api<UsageRes>('/v1/admin/ai/usage', {
    query: {
      from: usageFrom.value,
      to: usageTo.value,
      contentType: usageContentType.value,
      action: usageAction.value,
    },
  }),
  { immediate: false },
)

const jobStatus = ref('all')
const jobPage = ref(1)
const jobsKey = computed(() => `admin-ai-jobs-${jobStatus.value}-${jobPage.value}`)
const { data: jobs, pending: jobsPending, refresh: refreshJobs } = await useAsyncData(
  jobsKey,
  () => api<{ items: JobRow[], total: number, page: number, limit: number }>('/v1/admin/ai/jobs', {
    query: {
      page: jobPage.value,
      limit: 20,
      status: jobStatus.value !== 'all' ? jobStatus.value : undefined,
    },
  }),
  { immediate: false, watch: [jobStatus, jobPage] },
)

watch(tab, async (t) => {
  if (t === 'usage' && !usage.value)
    await refreshUsage()
  if (t === 'jobs' && !jobs.value)
    await refreshJobs()
  if (t === 'overview')
    await refreshOverview()
})

async function retryJob(id: string) {
  await api(`/v1/admin/ai/jobs/${id}/retry`, { method: 'POST' })
  toast.success('Задача возвращена в очередь')
  await refreshJobs()
}

async function cancelJob(id: string) {
  await api(`/v1/admin/ai/jobs/${id}/cancel`, { method: 'POST' })
  toast.success('Задача отменена')
  await refreshJobs()
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const kpiCards = computed(() => {
  const o = overview.value
  const by = o?.jobsByStatus || {}
  return [
    { label: 'Токены сегодня', value: o?.todayTokens ?? 0, hint: o?.settings?.dailyTokenLimit ? `лимит ${o.settings.dailyTokenLimit}` : 'без лимита', tone: 'cyan' as AdminTone, icon: Coins },
    { label: 'Статьи AI', value: o?.articlesAiProcessed ?? 0, hint: 'обработано', tone: 'violet' as AdminTone, icon: Bot },
    { label: 'В очереди', value: (by.pending || 0) + (by.processing || 0), hint: `pending ${by.pending || 0}`, tone: 'amber' as AdminTone, icon: ListTodo },
    { label: 'Ошибки', value: by.failed || 0, hint: `done ${by.done || 0}`, tone: 'rose' as AdminTone, icon: Settings2 },
  ]
})

function statusClass(s: string) {
  if (s === 'done')
    return 'text-emerald-600'
  if (s === 'failed')
    return 'text-destructive'
  if (s === 'processing')
    return 'text-amber-600'
  if (s === 'cancelled')
    return 'text-muted-foreground'
  return ''
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="ИИ"
      description="OpenAI ключ, очередь задач, учёт токенов"
      help="ai"
    >
      <template #actions>
        <AdminTip tip="Обновить KPI: токены сегодня, статьи с ИИ, очередь и ошибки.">
          <Button
            size="sm"
            variant="outline"
            :disabled="overviewPending"
            @click="refreshOverview()"
          >
            <RefreshCw class="size-4" :class="overviewPending ? 'animate-spin' : ''" />
            Обновить
          </Button>
        </AdminTip>
      </template>
    </AdminPageHeader>

    <div class="flex flex-wrap gap-1.5">
      <AdminTip tip="Сводка: ключ, модель, локали, KPI по токенам и jobs.">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'overview'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'overview'"
        >
          Обзор
        </button>
      </AdminTip>
      <AdminTip tip="OpenAI key, модель, языки, лимиты, автообработка staging и автопубликация.">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'settings'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'settings'"
        >
          Настройки
        </button>
      </AdminTip>
      <AdminTip tip="Расход токенов по дням и разбивка unique/translate × тип контента.">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'usage'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'usage'"
        >
          Токены
        </button>
      </AdminTip>
      <AdminTip tip="Очередь AI jobs: pending → processing → done/failed. Retry и Cancel.">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'jobs'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'jobs'"
        >
          Очередь
        </button>
      </AdminTip>
    </div>

    <template v-if="tab === 'overview'">
      <AdminUiAdminStatGrid>
        <AdminUiAdminStatCard
          v-for="(card, i) in kpiCards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :hint="card.hint"
          :icon="card.icon"
          :tone="card.tone"
          :ready="ready && !overviewPending"
          :index="i"
        />
      </AdminUiAdminStatGrid>

      <div class="rounded-2xl border bg-card/40 p-4 text-sm">
        <p class="font-medium">
          Статус провайдера
        </p>
        <dl class="mt-3 grid gap-2 sm:grid-cols-2">
          <div class="flex justify-between gap-3 border-b border-border/60 py-1.5">
            <dt class="text-muted-foreground">
              API key
            </dt>
            <dd class="font-mono text-xs">
              {{ overview?.settings?.hasApiKey ? (overview.settings.apiKeyHint || '••••') : 'не задан' }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-border/60 py-1.5">
            <dt class="text-muted-foreground">
              Модель
            </dt>
            <dd>{{ overview?.settings?.model || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-border/60 py-1.5">
            <dt class="text-muted-foreground">
              Источник → цели
            </dt>
            <dd>
              {{ (overview?.settings?.sourceLocales || []).join(',') || '—' }}
              →
              {{ (overview?.settings?.targetLocales || []).join(',') || '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-border/60 py-1.5">
            <dt class="text-muted-foreground">
              Пайплайн
            </dt>
            <dd>{{ overview?.settings?.enabled === false ? 'выкл' : 'вкл' }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <form
      v-else-if="tab === 'settings'"
      class="max-w-2xl space-y-4 rounded-2xl border bg-card/40 p-4"
      @submit.prevent="saveSettings"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <Label>Пайплайн включён</Label>
          <p class="text-xs text-muted-foreground">
            Выкл — воркер отклоняет новые обработки
          </p>
        </div>
        <AdminTip tip="Выкл — воркер не берёт новые AI jobs (уже processing доработает).">
          <Switch
            :model-value="settingsForm.enabled"
            @update:model-value="(v: boolean) => { settingsForm.enabled = v }"
          />
        </AdminTip>
      </div>

      <div class="grid gap-2">
        <Label>Модель OpenAI</Label>
        <Input v-model="settingsForm.model" placeholder="gpt-4o-mini" title="Идентификатор модели OpenAI, например gpt-4o-mini" />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label>Source locales</Label>
          <Input v-model="settingsForm.sourceLocales" placeholder="en" />
        </div>
        <div class="grid gap-2">
          <Label>Target locales</Label>
          <Input v-model="settingsForm.targetLocales" placeholder="ru" />
        </div>
      </div>

      <div class="grid gap-2">
        <Label>Дневной лимит токенов</Label>
        <Input v-model="settingsForm.dailyTokenLimit" type="number" min="1" placeholder="пусто = без лимита" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <div>
          <Label>Автообработка</Label>
          <p class="text-xs text-muted-foreground">
            Staging new → live draft + AI job автоматически
          </p>
        </div>
        <AdminTip tip="Вкл — воркер сам забирает staging new и ставит AI jobs (нужен ключ).">
          <Switch
            :model-value="settingsForm.autoProcess"
            @update:model-value="(v: boolean) => { settingsForm.autoProcess = v }"
          />
        </AdminTip>
      </div>

      <div class="flex items-center justify-between gap-3">
        <div>
          <Label>Автопубликация</Label>
          <p class="text-xs text-muted-foreground">
            После ИИ сразу published в articles / casinos / slots / forum
          </p>
        </div>
        <AdminTip tip="После успешного AI job live-сущность становится published. Для ручных кнопок «ИИ + сайт» тоже используется.">
          <Switch
            :model-value="settingsForm.autoPublish"
            @update:model-value="(v: boolean) => { settingsForm.autoPublish = v }"
          />
        </AdminTip>
      </div>

      <div class="grid gap-2">
        <Label>OpenAI API key</Label>
        <Input
          v-model="settingsForm.apiKey"
          type="password"
          autocomplete="off"
          :placeholder="overview?.settings?.apiKeyHint ? `текущий: ${overview.settings.apiKeyHint}` : 'sk-…'"
        />
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <input v-model="settingsForm.clearKey" type="checkbox" class="size-3.5">
          Удалить сохранённый ключ (останется только env OPENAI_API_KEY)
        </label>
      </div>

      <div class="flex gap-2">
        <AdminTip tip="Сохранить модель, локали, лимиты, флаги и (если введён) новый API key. Ключ шифруется на сервере.">
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </Button>
        </AdminTip>
      </div>
    </form>

    <div v-else-if="tab === 'usage'" class="space-y-4">
      <div class="flex flex-wrap items-end gap-3 rounded-2xl border bg-card/40 p-3">
        <div class="grid gap-1">
          <Label class="text-xs">
            С
          </Label>
          <Input v-model="usageFrom" type="date" class="w-[160px]" />
        </div>
        <div class="grid gap-1">
          <Label class="text-xs">
            По
          </Label>
          <Input v-model="usageTo" type="date" class="w-[160px]" />
        </div>
        <div class="grid gap-1">
          <Label class="text-xs">
            Тип
          </Label>
          <AdminSelect
            v-model="usageContentType"
            class="w-[160px]"
            size="sm"
            :options="[
              { value: 'all', label: 'all' },
              { value: 'article', label: 'article' },
              { value: 'casino', label: 'casino' },
              { value: 'slot', label: 'slot' },
              { value: 'forum_category', label: 'forum' },
            ]"
          />
        </div>
        <div class="grid gap-1">
          <Label class="text-xs">
            Действие
          </Label>
          <AdminSelect
            v-model="usageAction"
            class="w-[140px]"
            size="sm"
            :options="[
              { value: 'all', label: 'all' },
              { value: 'unique', label: 'unique' },
              { value: 'translate', label: 'translate' },
            ]"
          />
        </div>
        <AdminTip tip="Загрузить usage за выбранный период с фильтрами тип/действие.">
          <Button size="sm" variant="secondary" :disabled="usagePending" @click="refreshUsage()">
            Показать
          </Button>
        </AdminTip>
      </div>

      <div class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl border p-3">
          <p class="text-xs text-muted-foreground">
            Total
          </p>
          <p class="mt-1 text-lg font-semibold tabular-nums">
            {{ (usage?.totals?.totalTokens ?? 0).toLocaleString('ru-RU') }}
          </p>
        </div>
        <div class="rounded-xl border p-3">
          <p class="text-xs text-muted-foreground">
            Prompt
          </p>
          <p class="mt-1 text-lg font-semibold tabular-nums">
            {{ (usage?.totals?.promptTokens ?? 0).toLocaleString('ru-RU') }}
          </p>
        </div>
        <div class="rounded-xl border p-3">
          <p class="text-xs text-muted-foreground">
            Completion
          </p>
          <p class="mt-1 text-lg font-semibold tabular-nums">
            {{ (usage?.totals?.completionTokens ?? 0).toLocaleString('ru-RU') }}
          </p>
        </div>
        <div class="rounded-xl border p-3">
          <p class="text-xs text-muted-foreground">
            Requests
          </p>
          <p class="mt-1 text-lg font-semibold tabular-nums">
            {{ (usage?.totals?.requests ?? 0).toLocaleString('ru-RU') }}
          </p>
        </div>
      </div>

      <div class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/80 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">
                День
              </th>
              <th class="px-3 py-2">
                Prompt
              </th>
              <th class="px-3 py-2">
                Completion
              </th>
              <th class="px-3 py-2">
                Total
              </th>
              <th class="px-3 py-2">
                Req.
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usage?.daily || []" :key="row.day" class="border-t">
              <td class="px-3 py-2 tabular-nums">
                {{ row.day }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ row.promptTokens.toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ row.completionTokens.toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2 tabular-nums font-medium">
                {{ row.totalTokens.toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ row.requests }}
              </td>
            </tr>
            <tr v-if="!usagePending && !(usage?.daily?.length)">
              <td colspan="5" class="px-3 py-6 text-center text-muted-foreground">
                Нет данных за период
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="usage?.breakdown?.length" class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/80 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">
                Тип
              </th>
              <th class="px-3 py-2">
                Действие
              </th>
              <th class="px-3 py-2">
                Total
              </th>
              <th class="px-3 py-2">
                Req.
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usage.breakdown" :key="`${row.contentType}-${row.action}`" class="border-t">
              <td class="px-3 py-2">
                {{ row.contentType }}
              </td>
              <td class="px-3 py-2">
                {{ row.action }}
              </td>
              <td class="px-3 py-2 tabular-nums font-medium">
                {{ row.totalTokens.toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ row.requests }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap gap-1.5">
        <AdminTip
          v-for="chip in [
            { id: 'all', label: 'Все', tip: 'Показать все jobs без фильтра по статусу.' },
            { id: 'pending', label: 'pending', tip: 'Ждут воркера.' },
            { id: 'processing', label: 'processing', tip: 'Сейчас обрабатываются OpenAI.' },
            { id: 'done', label: 'done', tip: 'Успешно завершённые.' },
            { id: 'failed', label: 'failed', tip: 'Упали с ошибкой — можно Retry.' },
          ]"
          :key="chip.id"
          :tip="chip.tip"
        >
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="jobStatus === chip.id
              ? 'border-foreground/20 bg-foreground text-background'
              : 'border-border bg-background text-muted-foreground hover:text-foreground'"
            @click="jobStatus = chip.id; jobPage = 1"
          >
            {{ chip.label }}
          </button>
        </AdminTip>
        <AdminTip tip="Обновить список AI jobs.">
          <Button size="sm" variant="outline" class="ml-auto" :disabled="jobsPending" @click="refreshJobs()">
            <RefreshCw class="size-4" />
          </Button>
        </AdminTip>
      </div>

      <div class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/80 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">
                Статус
              </th>
              <th class="px-3 py-2">
                Контент
              </th>
              <th class="px-3 py-2">
                Языки
              </th>
              <th class="px-3 py-2">
                Токены
              </th>
              <th class="px-3 py-2">
                Создано
              </th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in jobs?.items || []" :key="row.id" class="border-t align-top">
              <td class="px-3 py-2">
                <span class="font-medium capitalize" :class="statusClass(row.status)">{{ row.status }}</span>
                <div class="text-[11px] text-muted-foreground">
                  {{ row.attempts }}/{{ row.max_attempts }}
                </div>
                <div v-if="row.error" class="mt-1 max-w-[220px] text-[11px] text-destructive">
                  {{ row.error }}
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="font-medium">
                  {{ row.content_type }}
                </div>
                <div class="font-mono text-xs text-muted-foreground">
                  {{ row.content_slug || row.content_id || '—' }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs">
                {{ row.source_locale || 'auto' }}
                →
                {{ (row.target_locales || []).join(',') || '—' }}
              </td>
              <td class="px-3 py-2 tabular-nums text-xs">
                {{ row.total_tokens || 0 }}
                <div class="text-muted-foreground">
                  {{ row.model || '—' }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                {{ new Date(row.created_at).toLocaleString('ru-RU') }}
              </td>
              <td class="px-3 py-2 text-right">
                <div class="inline-flex gap-1">
                  <AdminTip
                    v-if="row.status === 'failed' || row.status === 'cancelled'"
                    tip="Вернуть задачу в pending — воркер снова попытается (нужен валидный OpenAI key)."
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 text-xs"
                      @click="retryJob(row.id)"
                    >
                      Retry
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="row.status === 'pending' || row.status === 'processing'"
                    tip="Отменить задачу: статус cancelled, воркер её больше не возьмёт."
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 text-xs"
                      @click="cancelJob(row.id)"
                    >
                      Cancel
                    </Button>
                  </AdminTip>
                </div>
              </td>
            </tr>
            <tr v-if="!jobsPending && !(jobs?.items?.length)">
              <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">
                Очередь пуста
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
