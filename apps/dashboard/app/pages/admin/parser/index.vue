<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  Bot,
  CheckCircle2,
  Database,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const tab = ref<'items' | 'sources'>('items')
const flash = ref<{ tone: 'ok' | 'err', text: string } | null>(null)

function notify(tone: 'ok' | 'err', text: string) {
  flash.value = { tone, text }
}

interface Overview {
  totals: { total: number, published: number, aiDone: number, new: number, errors: number }
  byStatus: Array<{ status: string, count: number }>
  byType: Array<{ contentType: string, count: number }>
  bySource: Array<{ sourceCode: string, count: number }>
}

interface SourceRow {
  id: string
  code: string
  name: string
  baseUrl: string | null
  contentTypes: string[]
  enabled: boolean
  notes: string | null
  itemsCount: number
}

interface ItemRow {
  id: string
  contentType: string
  sourceCode: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourceLocale: string | null
  externalId: string | null
  title: string | null
  processStatus: string
  aiStatus: string
  published: boolean
  publishedAt: string | null
  liveId: string | null
  liveSlug: string | null
  error: string | null
  scrapedAt: string | null
  aiProcessedAt: string | null
}

const q = ref('')
const contentType = ref('all')
const source = ref('all')
const processStatus = ref('all')
const aiStatus = ref('all')
const published = ref('all')
const page = ref(1)
const limit = ref(20)
const busyId = ref<string | null>(null)

const { data: overview, refresh: refreshOverview } = await useAsyncData(
  'admin-parser-overview',
  () => api<Overview>('/v1/admin/parser/overview'),
)

const { data: sourcesData, refresh: refreshSources } = await useAsyncData(
  'admin-parser-sources',
  () => api<{ items: SourceRow[] }>('/v1/admin/parser/sources'),
)

const listKey = computed(() =>
  `admin-parser-items-${page.value}-${contentType.value}-${source.value}-${processStatus.value}-${aiStatus.value}-${published.value}-${q.value}`,
)

const { data: itemsData, pending, refresh: refreshItems } = await useAsyncData(
  listKey,
  () => api<{ items: ItemRow[], total: number, page: number, limit: number }>('/v1/admin/parser/items', {
    query: {
      page: page.value,
      limit: limit.value,
      q: q.value || undefined,
      contentType: contentType.value !== 'all' ? contentType.value : undefined,
      source: source.value !== 'all' ? source.value : undefined,
      processStatus: processStatus.value !== 'all' ? processStatus.value : undefined,
      aiStatus: aiStatus.value !== 'all' ? aiStatus.value : undefined,
      published: published.value !== 'all' ? published.value : undefined,
    },
  }),
  { watch: [page, limit, contentType, source, processStatus, aiStatus, published] },
)

watch([contentType, source, processStatus, aiStatus, published, limit], () => {
  page.value = 1
})

async function search() {
  page.value = 1
  await refreshItems()
}

async function refreshAll() {
  await Promise.all([refreshOverview(), refreshSources(), refreshItems()])
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const kpiCards = computed(() => {
  const t = overview.value?.totals
  return [
    { label: 'Всего', value: t?.total ?? 0, hint: 'в staging', tone: 'violet' as AdminTone, icon: Database },
    { label: 'Новые', value: t?.new ?? 0, hint: 'только спарсено', tone: 'cyan' as AdminTone, icon: Globe2 },
    { label: 'Через ИИ', value: t?.aiDone ?? 0, hint: 'ai done', tone: 'amber' as AdminTone, icon: Bot },
    { label: 'На сайте', value: t?.published ?? 0, hint: 'published', tone: 'emerald' as AdminTone, icon: CheckCircle2 },
  ]
})

const sourceOptions = computed(() => {
  const fromSources = (sourcesData.value?.items || []).map((s: SourceRow) => ({
    value: s.code,
    label: `${s.name} (${s.itemsCount})`,
  }))
  const known = new Set(fromSources.map((o: { value: string }) => o.value))
  const extras = (overview.value?.bySource || [])
    .filter((s: Overview['bySource'][number]) => !known.has(s.sourceCode))
    .map((s: Overview['bySource'][number]) => ({
      value: s.sourceCode,
      label: `${s.sourceCode} (${s.count})`,
    }))
  return [{ value: 'all', label: 'Все источники' }, ...fromSources, ...extras]
})

const totalPages = computed(() => Math.max(1, Math.ceil((itemsData.value?.total || 0) / limit.value)))

function statusLabel(s: string) {
  const map: Record<string, string> = {
    new: 'спарсено',
    queued: 'в очереди ИИ',
    processing: 'ИИ…',
    ai_done: 'ИИ готов',
    published: 'на сайте',
    done: 'готово',
    error: 'ошибка',
    rejected: 'отклонено',
  }
  return map[s] || s
}

function statusClass(s: string) {
  if (s === 'published' || s === 'done')
    return 'text-emerald-600'
  if (s === 'error' || s === 'rejected')
    return 'text-destructive'
  if (s === 'queued' || s === 'processing' || s === 'ai_done')
    return 'text-amber-600'
  return 'text-muted-foreground'
}

function liveAdminPath(row: ItemRow): string | null {
  if (!row.liveId)
    return null
  if (row.contentType === 'article')
    return `/admin/articles/${row.liveId}`
  if (row.contentType === 'casino')
    return `/admin/casinos/${row.liveId}`
  if (row.contentType === 'slot')
    return `/admin/slots/${row.liveId}`
  return null
}

/** new / error / ai_done — можно (пере)отправить в ИИ */
function canQueueAi(row: ItemRow) {
  if (row.processStatus === 'rejected' || row.processStatus === 'processing')
    return false
  if (row.aiStatus === 'queued' || row.aiStatus === 'processing')
    return false
  return row.processStatus === 'new'
    || row.processStatus === 'error'
    || row.processStatus === 'ai_done'
    || row.aiStatus === 'error'
    || row.aiStatus === 'none'
}

async function queueAi(row: ItemRow, autoPublish = false) {
  busyId.value = row.id
  try {
    await api(`/v1/admin/parser/items/${row.id}/queue-ai`, {
      method: 'POST',
      body: { autoPublish },
    })
    notify('ok', autoPublish ? 'В очереди ИИ → автопубликация' : 'В очереди ИИ (черновик)')
    await refreshAll()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    busyId.value = null
  }
}

const queueAllBusy = ref(false)
async function queueAllNew(autoPublish = true) {
  queueAllBusy.value = true
  try {
    const res = await api<{ queued: number, failed: number }>('/v1/admin/parser/queue-all', {
      method: 'POST',
      body: { autoPublish, limit: 20 },
    })
    notify('ok', `В очередь: ${res.queued}${res.failed ? `, ошибок: ${res.failed}` : ''}${autoPublish ? ' · с публикацией' : ''}`)
    await refreshAll()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    queueAllBusy.value = false
  }
}

async function rejectItem(row: ItemRow) {
  busyId.value = row.id
  try {
    await api(`/v1/admin/parser/items/${row.id}/reject`, { method: 'POST' })
    notify('ok', 'Отклонено')
    await refreshAll()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    busyId.value = null
  }
}

async function deleteItem(row: ItemRow) {
  const label = row.title || row.externalId || row.id.slice(0, 8)
  if (!confirm(`Удалить из staging «${label}»? Live-контент на сайте не трогаем.`))
    return
  busyId.value = row.id
  try {
    await api(`/v1/admin/parser/items/${row.id}`, { method: 'DELETE' })
    notify('ok', 'Удалено из staging')
    await refreshAll()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка удаления')
  }
  finally {
    busyId.value = null
  }
}

async function markPublished(row: ItemRow, on: boolean) {
  busyId.value = row.id
  try {
    await api(`/v1/admin/parser/items/${row.id}/mark-published`, {
      method: 'POST',
      body: { published: on },
    })
    notify('ok', on ? 'Отмечено как на сайте' : 'Снята отметка публикации')
    await refreshAll()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    busyId.value = null
  }
}

const showCreateSource = ref(false)
const creatingSource = ref(false)
const sourceForm = ref({
  code: '',
  name: '',
  baseUrl: '',
  contentTypes: 'article',
  notes: '',
})

async function createSource() {
  creatingSource.value = true
  try {
    const f = sourceForm.value
    await api('/v1/admin/parser/sources', {
      method: 'POST',
      body: {
        code: f.code.trim(),
        name: f.name.trim(),
        baseUrl: f.baseUrl.trim() || null,
        contentTypes: f.contentTypes.split(/[\s,]+/).filter(Boolean),
        notes: f.notes.trim() || null,
      },
    })
    notify('ok', 'Источник добавлен')
    showCreateSource.value = false
    sourceForm.value = { code: '', name: '', baseUrl: '', contentTypes: 'article', notes: '' }
    await refreshSources()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    creatingSource.value = false
  }
}

const showIngest = ref(false)
const ingesting = ref(false)
const ingestForm = ref({
  contentType: 'article',
  sourceCode: 'manual',
  sourceUrl: '',
  sourceLocale: 'en',
  title: '',
  body: '',
})

async function ingestDemo() {
  ingesting.value = true
  try {
    const f = ingestForm.value
    await api('/v1/admin/parser/ingest', {
      method: 'POST',
      body: {
        contentType: f.contentType,
        sourceCode: f.sourceCode || 'manual',
        sourceUrl: f.sourceUrl.trim() || null,
        sourceLocale: f.sourceLocale || 'en',
        title: f.title.trim() || 'Demo parsed item',
        body: f.body.trim() || 'Parsed body placeholder.',
      },
    })
    notify('ok', 'Добавлено в staging')
    showIngest.value = false
    await refreshAll()
    tab.value = 'items'
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    notify('err', e?.data?.error || e?.message || 'Ошибка')
  }
  finally {
    ingesting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Парсер"
      description="Сырьё по источникам и типам · статус ИИ · публикация на сайте"
      help="parser"
    >
      <template #actions>
        <AdminTip tip="Вручную положить сырую запись в staging (как будто спарсили с внешнего сайта). На сайт сразу не попадёт.">
          <Button size="sm" variant="outline" @click="showIngest = true">
            <Plus class="size-4" />
            Добавить в staging
          </Button>
        </AdminTip>
        <AdminTip tip="Все записи со статусом new/error: создать черновик в нужном разделе, прогнать unique+translate и сразу опубликовать на сайте. Нужен OpenAI key в /admin/ai.">
          <Button
            size="sm"
            variant="secondary"
            :disabled="queueAllBusy || pending"
            @click="queueAllNew(true)"
          >
            <Bot class="size-4" />
            {{ queueAllBusy ? 'Ставим…' : 'Все new → ИИ + сайт' }}
          </Button>
        </AdminTip>
        <AdminTip tip="Перезагрузить KPI, список staging и источники.">
          <Button size="sm" variant="outline" :disabled="pending" @click="refreshAll()">
            <RefreshCw class="size-4" :class="pending ? 'animate-spin' : ''" />
            Обновить
          </Button>
        </AdminTip>
      </template>
    </AdminPageHeader>

    <p
      v-if="flash"
      class="text-sm"
      :class="flash.tone === 'ok' ? 'text-emerald-600' : 'text-destructive'"
    >
      {{ flash.text }}
    </p>

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="card.icon"
        :tone="card.tone"
        :ready="ready"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="flex flex-wrap gap-1.5">
      <AdminTip tip="Спарсенные сущности: тип, источник, статус ИИ и публикация.">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'items'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'items'"
        >
          Staging
        </button>
      </AdminTip>
      <AdminTip tip="Справочник фидов/парсеров (code, URL, какие типы контента тянут).">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="tab === 'sources'
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="tab = 'sources'"
        >
          Источники
        </button>
      </AdminTip>
    </div>

    <template v-if="tab === 'items'">
      <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3">
        <form class="flex min-w-[220px] flex-1 flex-wrap gap-2" @submit.prevent="search">
          <div class="relative min-w-[200px] flex-1">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="q" class="pl-8" placeholder="Заголовок / URL / slug / external id" />
          </div>
          <AdminTip tip="Поиск по заголовку, URL, slug и external id.">
            <Button type="submit" variant="secondary" :disabled="pending">
              Найти
            </Button>
          </AdminTip>
        </form>
        <div class="flex flex-wrap gap-2">
          <AdminSelect
            v-model="contentType"
            class="w-[150px]"
            size="sm"
            :options="[
              { value: 'all', label: 'Все типы' },
              { value: 'article', label: 'article' },
              { value: 'casino', label: 'casino' },
              { value: 'slot', label: 'slot' },
              { value: 'forum', label: 'forum' },
            ]"
          />
          <AdminSelect
            v-model="source"
            class="w-[200px]"
            size="sm"
            :options="sourceOptions"
          />
          <AdminSelect
            v-model="processStatus"
            class="w-[170px]"
            size="sm"
            :options="[
              { value: 'all', label: 'Все статусы' },
              { value: 'new', label: 'спарсено' },
              { value: 'queued', label: 'в очереди ИИ' },
              { value: 'processing', label: 'ИИ…' },
              { value: 'ai_done', label: 'ИИ готов' },
              { value: 'published', label: 'на сайте' },
              { value: 'error', label: 'ошибка' },
              { value: 'rejected', label: 'отклонено' },
            ]"
          />
          <AdminSelect
            v-model="aiStatus"
            class="w-[150px]"
            size="sm"
            :options="[
              { value: 'all', label: 'ИИ: все' },
              { value: 'none', label: 'ИИ: нет' },
              { value: 'queued', label: 'ИИ: очередь' },
              { value: 'done', label: 'ИИ: done' },
              { value: 'error', label: 'ИИ: error' },
            ]"
          />
          <AdminSelect
            v-model="published"
            class="w-[150px]"
            size="sm"
            :options="[
              { value: 'all', label: 'Публикация' },
              { value: 'true', label: 'На сайте' },
              { value: 'false', label: 'Не на сайте' },
            ]"
          />
        </div>
      </div>

      <AdminTableSkeleton v-if="pending && !itemsData" :cols="6" />
      <div v-else class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
            <tr class="text-xs uppercase tracking-wide text-muted-foreground">
              <th class="px-3 py-2.5 font-medium">
                Контент
              </th>
              <th class="px-3 py-2.5 font-medium">
                Источник
              </th>
              <th class="px-3 py-2.5 font-medium">
                Статус
              </th>
              <th class="px-3 py-2.5 font-medium">
                ИИ
              </th>
              <th class="px-3 py-2.5 font-medium">
                Сайт
              </th>
              <th class="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in itemsData?.items || []"
              :key="row.id"
              class="border-t align-top transition-colors hover:bg-muted/40"
            >
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="font-normal capitalize">
                    {{ row.contentType }}
                  </Badge>
                  <span v-if="row.sourceLocale" class="text-[10px] uppercase text-muted-foreground">
                    {{ row.sourceLocale }}
                  </span>
                </div>
                <div class="mt-1 max-w-[280px] truncate font-medium">
                  {{ row.title || '—' }}
                </div>
                <a
                  v-if="row.sourceUrl"
                  :href="row.sourceUrl"
                  target="_blank"
                  rel="noopener"
                  class="mt-0.5 block max-w-[280px] truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  {{ row.sourceUrl }}
                </a>
                <div class="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {{ row.scrapedAt ? new Date(row.scrapedAt).toLocaleString('ru-RU') : '—' }}
                </div>
              </td>
              <td class="px-3 py-2.5">
                <div class="font-medium">
                  {{ row.sourceName || row.sourceCode || '—' }}
                </div>
                <div class="font-mono text-[11px] text-muted-foreground">
                  {{ row.sourceCode || '—' }}
                </div>
              </td>
              <td class="px-3 py-2.5">
                <span class="text-xs font-semibold" :class="statusClass(row.processStatus)">
                  {{ statusLabel(row.processStatus) }}
                </span>
                <div v-if="row.error" class="mt-1 max-w-[180px] text-[11px] text-destructive">
                  {{ row.error }}
                </div>
              </td>
              <td class="px-3 py-2.5 text-xs">
                <span :class="row.aiStatus === 'done' ? 'text-emerald-600' : row.aiStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'">
                  {{ row.aiStatus }}
                </span>
                <div v-if="row.aiProcessedAt" class="text-[11px] text-muted-foreground">
                  {{ new Date(row.aiProcessedAt).toLocaleDateString('ru-RU') }}
                </div>
              </td>
              <td class="px-3 py-2.5 text-xs">
                <div class="flex items-center gap-1.5">
                  <CheckCircle2 v-if="row.published" class="size-3.5 text-emerald-600" />
                  <XCircle v-else class="size-3.5 text-muted-foreground/50" />
                  <span>{{ row.published ? 'да' : 'нет' }}</span>
                </div>
                <NuxtLink
                  v-if="row.liveId && liveAdminPath(row)"
                  :to="liveAdminPath(row)!"
                  class="mt-1 block font-mono text-[11px] underline underline-offset-2"
                >
                  {{ row.liveSlug || 'draft' }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2.5 text-right">
                <div class="inline-flex flex-wrap justify-end gap-1">
                  <AdminTip
                    v-if="canQueueAi(row)"
                    tip="Создать/привязать черновик в разделе сайта и поставить в очередь unique+translate. Без автопубликации — останется draft."
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 text-xs"
                      :disabled="busyId === row.id"
                      @click="queueAi(row, false)"
                    >
                      {{ row.processStatus === 'error' || row.aiStatus === 'error' ? 'Снова в ИИ' : 'В ИИ' }}
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="canQueueAi(row)"
                    tip="То же, что «В ИИ», плюс после успешной обработки сразу published в articles / casinos / slots / forum."
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      class="h-7 text-xs"
                      :disabled="busyId === row.id"
                      @click="queueAi(row, true)"
                    >
                      {{ row.processStatus === 'error' || row.aiStatus === 'error' ? 'Снова ИИ + сайт' : 'ИИ + сайт' }}
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="!row.published && row.liveId"
                    tip="Пометить staging как «на сайте» и выставить published у связанной live-сущности (без повторного ИИ)."
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 text-xs"
                      :disabled="busyId === row.id"
                      @click="markPublished(row, true)"
                    >
                      На сайте
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="row.published"
                    tip="Снять флаг публикации у staging (live-сущность вручную не откатываем в draft)."
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 text-xs"
                      :disabled="busyId === row.id"
                      @click="markPublished(row, false)"
                    >
                      Снять
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="row.processStatus !== 'rejected'"
                    tip="Отклонить сырьё: больше не попадёт в автоочередь ИИ. Запись останется в списке со статусом «отклонено»."
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 text-xs"
                      :disabled="busyId === row.id"
                      @click="rejectItem(row)"
                    >
                      Отклонить
                    </Button>
                  </AdminTip>
                  <AdminTip
                    v-if="row.processStatus !== 'processing' && row.aiStatus !== 'processing'"
                    tip="Удалить строку из staging навсегда. Live-статья/казино/слот на сайте не удаляются."
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 text-xs text-destructive"
                      :disabled="busyId === row.id"
                      @click="deleteItem(row)"
                    >
                      Удалить
                    </Button>
                  </AdminTip>
                </div>
              </td>
            </tr>
            <tr v-if="!pending && !(itemsData?.items?.length)">
              <td colspan="6" class="px-3 py-8 text-center text-muted-foreground">
                Staging пуст — добавьте запись или дождитесь парсера
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-muted-foreground">
          {{ (itemsData?.total || 0).toLocaleString('ru-RU') }} · стр. {{ page }} / {{ totalPages }}
        </p>
        <div class="flex gap-2">
          <AdminTip tip="Предыдущая страница списка staging.">
            <Button size="sm" variant="outline" :disabled="page <= 1 || pending" @click="page--">
              Назад
            </Button>
          </AdminTip>
          <AdminTip tip="Следующая страница списка staging.">
            <Button size="sm" variant="outline" :disabled="page >= totalPages || pending" @click="page++">
              Далее
            </Button>
          </AdminTip>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex justify-end">
        <AdminTip tip="Добавить источник парсинга (code, имя, URL, типы контента).">
          <Button size="sm" @click="showCreateSource = true">
            <Plus class="size-4" />
            Источник
          </Button>
        </AdminTip>
      </div>
      <div class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/80 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">
                Источник
              </th>
              <th class="px-3 py-2">
                Типы
              </th>
              <th class="px-3 py-2">
                Записей
              </th>
              <th class="px-3 py-2">
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sourcesData?.items || []" :key="s.id" class="border-t">
              <td class="px-3 py-2.5">
                <div class="font-medium">
                  {{ s.name }}
                </div>
                <div class="font-mono text-[11px] text-muted-foreground">
                  {{ s.code }}
                </div>
                <a
                  v-if="s.baseUrl"
                  :href="s.baseUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  {{ s.baseUrl }}
                </a>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="t in s.contentTypes"
                    :key="t"
                    variant="outline"
                    class="font-normal capitalize"
                  >
                    {{ t }}
                  </Badge>
                  <span v-if="!s.contentTypes?.length" class="text-muted-foreground">—</span>
                </div>
              </td>
              <td class="px-3 py-2.5 tabular-nums">
                {{ s.itemsCount }}
              </td>
              <td class="px-3 py-2.5 text-xs">
                {{ s.enabled ? 'вкл' : 'выкл' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div
      v-if="showIngest"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      @click.self="showIngest = false"
    >
      <form class="w-full max-w-lg space-y-3 rounded-2xl border bg-background p-4 shadow-xl" @submit.prevent="ingestDemo">
        <h2 class="text-lg font-semibold">
          Добавить в staging
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <div class="grid gap-1">
            <Label>Тип</Label>
            <AdminSelect
              v-model="ingestForm.contentType"
              :options="[
                { value: 'article', label: 'article' },
                { value: 'casino', label: 'casino' },
                { value: 'slot', label: 'slot' },
                { value: 'forum', label: 'forum' },
              ]"
            />
          </div>
          <div class="grid gap-1">
            <Label>Источник (code)</Label>
            <Input v-model="ingestForm.sourceCode" placeholder="manual" />
          </div>
        </div>
        <div class="grid gap-1">
          <Label>Source URL</Label>
          <Input v-model="ingestForm.sourceUrl" placeholder="https://…" />
        </div>
        <div class="grid gap-1">
          <Label>Locale</Label>
          <Input v-model="ingestForm.sourceLocale" placeholder="en" />
        </div>
        <div class="grid gap-1">
          <Label>Title</Label>
          <Input v-model="ingestForm.title" />
        </div>
        <div class="grid gap-1">
          <Label>Body</Label>
          <textarea v-model="ingestForm.body" rows="4" class="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div class="flex justify-end gap-2">
          <AdminTip tip="Закрыть без сохранения.">
            <Button type="button" variant="ghost" @click="showIngest = false">
              Отмена
            </Button>
          </AdminTip>
          <AdminTip tip="Сохранить в staging со статусом «спарсено» (new). ИИ и публикация — отдельными кнопками.">
            <Button type="submit" :disabled="ingesting">
              {{ ingesting ? '…' : 'Сохранить' }}
            </Button>
          </AdminTip>
        </div>
      </form>
    </div>

    <div
      v-if="showCreateSource"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      @click.self="showCreateSource = false"
    >
      <form class="w-full max-w-md space-y-3 rounded-2xl border bg-background p-4 shadow-xl" @submit.prevent="createSource">
        <h2 class="text-lg font-semibold">
          Новый источник
        </h2>
        <div class="grid gap-1">
          <Label>Code</Label>
          <Input v-model="sourceForm.code" placeholder="partner_feed_a" required pattern="[a-z0-9_]+" />
        </div>
        <div class="grid gap-1">
          <Label>Name</Label>
          <Input v-model="sourceForm.name" required />
        </div>
        <div class="grid gap-1">
          <Label>Base URL</Label>
          <Input v-model="sourceForm.baseUrl" placeholder="https://…" />
        </div>
        <div class="grid gap-1">
          <Label>Типы (через запятую)</Label>
          <Input v-model="sourceForm.contentTypes" placeholder="article, casino" />
        </div>
        <div class="grid gap-1">
          <Label>Notes</Label>
          <Input v-model="sourceForm.notes" />
        </div>
        <div class="flex justify-end gap-2">
          <AdminTip tip="Закрыть без создания источника.">
            <Button type="button" variant="ghost" @click="showCreateSource = false">
              Отмена
            </Button>
          </AdminTip>
          <AdminTip tip="Создать источник в справочнике parser_sources.">
            <Button type="submit" :disabled="creatingSource">
              Создать
            </Button>
          </AdminTip>
        </div>
      </form>
    </div>
  </div>
</template>
