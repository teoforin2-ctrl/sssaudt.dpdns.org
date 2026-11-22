<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface NewsSource {
  id: number
  name: string
  kind: 'rss' | 'csv'
  url: string | null
  path: string | null
  priority: number
  enabled: boolean
  lastCheckAt?: string | null
  lastCheckOk?: boolean | null
  lastCheckItems?: number | null
  lastCheckError?: string | null
}

interface CheckResult {
  ok: boolean
  httpStatus?: number
  items?: number
  sampleTitles?: string[]
  error?: string
}

const allowed = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

const sources = ref<NewsSource[]>([])
const pending = ref(false)
const error = ref<string | null>(null)

// форма добавления
const showAdd = ref(false)
const formName = ref('')
const formKind = ref<'rss' | 'csv'>('rss')
const formUrl = ref('')
const formPath = ref('')
const formPriority = ref(5)
const addError = ref<string | null>(null)
const addPending = ref(false)
const checkUrlPending = ref(false)
const checkUrlResult = ref<CheckResult | null>(null)

// результаты проверки по строкам
const rowChecks = ref<Record<number, CheckResult & { at: string }>>({})
const rowCheckPending = ref<Record<number, boolean>>({})

async function load() {
  pending.value = true
  try {
    const res = await api<{ items: NewsSource[] }>('/v1/admin/news-sources')
    sources.value = res.items
    error.value = null
  }
  catch (e: any) {
    error.value = e?.data?.error || e?.message || 'fetch_failed'
  }
  finally {
    pending.value = false
  }
}

async function addSource() {
  addError.value = null
  addPending.value = true
  try {
    await api('/v1/admin/news-sources', {
      method: 'POST',
      body: {
        name: formName.value.trim(),
        kind: formKind.value,
        url: formKind.value === 'rss' ? formUrl.value.trim() : undefined,
        path: formKind.value === 'csv' ? formPath.value.trim() : undefined,
        priority: formPriority.value,
      },
    })
    showAdd.value = false
    formName.value = ''
    formUrl.value = ''
    formPath.value = ''
    await load()
  }
  catch (e: any) {
    addError.value = e?.data?.error || e?.message || 'create_failed'
  }
  finally {
    addPending.value = false
  }
}

async function checkUrlBeforeSave() {
  checkUrlPending.value = true
  checkUrlResult.value = null
  try {
    checkUrlResult.value = await api<CheckResult>('/v1/admin/news-sources/check-url', {
      method: 'POST',
      body: { url: formUrl.value.trim() },
    })
  }
  catch (e: any) {
    checkUrlResult.value = { ok: false, error: e?.data?.error || e?.message || 'check_failed' }
  }
  finally {
    checkUrlPending.value = false
  }
}

async function checkRow(s: NewsSource) {
  rowCheckPending.value = { ...rowCheckPending.value, [s.id]: true }
  try {
    const res = await api<CheckResult>(`/v1/admin/news-sources/${s.id}/check`, { method: 'POST' })
    rowChecks.value = {
      ...rowChecks.value,
      [s.id]: { ...res, at: new Date().toLocaleTimeString() },
    }
    await load()
  }
  catch (e: any) {
    rowChecks.value = {
      ...rowChecks.value,
      [s.id]: { ok: false, error: e?.data?.error || e?.message || 'check_failed', at: new Date().toLocaleTimeString() },
    }
  }
  finally {
    rowCheckPending.value = { ...rowCheckPending.value, [s.id]: false }
  }
}

async function toggle(s: NewsSource) {
  await api(`/v1/admin/news-sources/${s.id}`, {
    method: 'PATCH',
    body: { enabled: !s.enabled },
  })
  await load()
}

async function removeSource(s: NewsSource) {
  if (!confirm(`Удалить источник «${s.name}»?`))
    return
  await api(`/v1/admin/news-sources/${s.id}`, { method: 'DELETE' })
  await load()
}

onMounted(() => {
  if (allowed.value)
    void load()
})
watch(allowed, (ok) => {
  if (ok)
    void load()
})
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      eyebrow="newsbot · ротация 1 источник за прогон, каждые 30 мин"
      title="Источники новостей"
      description="RSS и CSV-источники для newsbot. Новый источник подхватывается на следующем прогоне автоматически."
      help="news-sources"
    >
      <template #actions>
        <Button variant="outline" size="sm" :disabled="pending" @click="load()">
          Обновить
        </Button>
        <Button size="sm" @click="showAdd = !showAdd">
          {{ showAdd ? 'Свернуть' : 'Добавить источник' }}
        </Button>
      </template>
    </AdminPageHeader>

    <div v-if="!allowed" class="rounded-xl border border-amber-500/40 p-4 text-sm">
      Доступ только для ролей admin и developer.
    </div>

    <div v-else-if="error" class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
      Не удалось загрузить: {{ error }}
    </div>

    <template v-else>
      <div v-if="showAdd" class="rounded-2xl border bg-card p-4 space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="text-xs text-muted-foreground">Название</label>
            <input
              v-model="formName"
              class="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="Например: Poker Industry Daily"
            >
          </div>
          <div>
            <label class="text-xs text-muted-foreground">Тип</label>
            <select v-model="formKind" class="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="rss">
                RSS-фид
              </option>
              <option value="csv">
                CSV-файл на сервере
              </option>
            </select>
          </div>
          <div v-if="formKind === 'rss'">
            <label class="text-xs text-muted-foreground">URL фида</label>
            <input
              v-model="formUrl"
              class="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="https://example.com/feed/"
            >
          </div>
          <div v-else>
            <label class="text-xs text-muted-foreground">Путь к файлу на сервере</label>
            <input
              v-model="formPath"
              class="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="/opt/newsbot/data/myfile.csv"
            >
          </div>
          <div>
            <label class="text-xs text-muted-foreground">Приоритет (1-9, больше = чаще выбирается)</label>
            <input
              v-model.number="formPriority"
              type="number"
              min="1"
              max="9"
              class="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
          </div>
        </div>

        <div v-if="formKind === 'rss'" class="flex items-center gap-3">
          <Button variant="outline" size="sm" :disabled="checkUrlPending || !formUrl" @click="checkUrlBeforeSave()">
            {{ checkUrlPending ? 'Проверяю...' : 'Проверить фид' }}
          </Button>
          <span
            v-if="checkUrlResult"
            class="text-sm"
            :class="checkUrlResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ checkUrlResult.ok
              ? `OK: ${checkUrlResult.items} записей · HTTP ${checkUrlResult.httpStatus}`
              : `Ошибка: ${checkUrlResult.error}` }}
          </span>
        </div>
        <div v-if="checkUrlResult?.sampleTitles?.length" class="text-xs text-muted-foreground space-y-0.5">
          <div>Примеры заголовков:</div>
          <div v-for="t in checkUrlResult.sampleTitles" :key="t">
            · {{ t }}
          </div>
        </div>
        <p v-if="addError" class="text-sm text-destructive">
          {{ addError }}
        </p>
        <Button size="sm" :disabled="addPending || !formName" @click="addSource()">
          {{ addPending ? 'Сохраняю...' : 'Сохранить' }}
        </Button>
      </div>

      <div class="rounded-2xl border bg-card p-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-muted-foreground">
              <th class="py-2 pr-3">
                Название
              </th>
              <th class="py-2 pr-3">
                Тип
              </th>
              <th class="py-2 pr-3">
                URL / путь
              </th>
              <th class="py-2 pr-3">
                Приоритет
              </th>
              <th class="py-2 pr-3">
                Вкл
              </th>
              <th class="py-2 pr-3">
                Проверка
              </th>
              <th class="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sources" :key="s.id" class="border-t align-top">
              <td class="py-2 pr-3 font-medium">
                {{ s.name }}
              </td>
              <td class="py-2 pr-3">
                <Badge variant="outline" class="uppercase">
                  {{ s.kind }}
                </Badge>
              </td>
              <td class="max-w-[280px] truncate py-2 pr-3 text-xs text-muted-foreground">
                {{ s.url || s.path }}
              </td>
              <td class="py-2 pr-3 tabular-nums">
                {{ s.priority }}
              </td>
              <td class="py-2 pr-3">
                <button
                  class="rounded-full px-2 py-0.5 text-xs border"
                  :class="s.enabled ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : 'border-muted-foreground/40 text-muted-foreground'"
                  @click="toggle(s)"
                >
                  {{ s.enabled ? 'вкл' : 'выкл' }}
                </button>
              </td>
              <td class="py-2 pr-3">
                <Button variant="outline" size="sm" :disabled="rowCheckPending[s.id] || s.kind !== 'rss'" @click="checkRow(s)">
                  {{ rowCheckPending[s.id] ? '...' : 'Проверить' }}
                </Button>
                <div
                  v-if="rowChecks[s.id]"
                  class="mt-1 max-w-[260px] text-xs"
                  :class="rowChecks[s.id].ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                >
                  {{ rowChecks[s.id].ok
                    ? `OK: ${rowChecks[s.id].items} записей (${rowChecks[s.id].at})`
                    : `Ошибка: ${rowChecks[s.id].error}` }}
                  <div v-if="rowChecks[s.id].sampleTitles?.length" class="mt-1 text-muted-foreground">
                    {{ rowChecks[s.id].sampleTitles![0] }}
                  </div>
                </div>
                <div
                  v-else-if="s.lastCheckAt"
                  class="mt-1 max-w-[260px] text-xs"
                  :class="s.lastCheckOk ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-rose-600/70 dark:text-rose-400/70'"
                >
                  {{ s.lastCheckOk ? `OK: ${s.lastCheckItems} записей` : `Ошибка: ${s.lastCheckError}` }}
                  (последняя проверка)
                </div>
              </td>
              <td class="py-2 pr-3 text-right">
                <Button variant="ghost" size="sm" class="text-destructive" @click="removeSource(s)">
                  Удалить
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-3 text-xs text-muted-foreground">
          Источники из этой таблицы newsbot подхватывает автоматически при каждом прогоне (30 мин) — рестарт не нужен.
          CSV-источник требует наличия файла на диске сервера. RSS-кнопка «Проверить» фетчит фид с сервера и показывает число записей.
        </p>
      </div>
    </template>
  </div>
</template>
