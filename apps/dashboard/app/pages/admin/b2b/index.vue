<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import {
  BriefcaseBusiness,
  CheckCircle2,
  Inbox,
  Sparkles,
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const tab = ref<'leads' | 'packages' | 'cases'>('leads')
const leadStatus = ref('')
const leadView = ref<'table' | 'funnel'>('table')
const hideTest = ref(true)
const busyId = ref<string | null>(null)
const msg = ref<string | null>(null)

interface Lead {
  id: string
  name: string
  contact: string
  project_type: string
  budget: string | null
  message: string | null
  status: string
  locale: string
  created_at: string
}

interface PackageRow {
  id: string
  slug: string
  title_ru: string
  title_en: string
  price_label_ru: string | null
  price_label_en: string | null
  features_ru: string[]
  features_en: string[]
  highlight: boolean
  sort_order: number
  published: boolean
}

interface CaseRow {
  id: string
  slug: string
  title_ru: string
  title_en: string
  summary_ru: string | null
  summary_en: string | null
  metrics_ru: string[]
  metrics_en: string[]
  cover_url: string | null
  sort_order: number
  published: boolean
}

interface LeadsRes {
  items: Lead[]
  total: number
  summary?: {
    total: number
    new: number
    inProgress: number
    done: number
    spam: number
  }
}

const { data: leadsData, pending: leadsPending, refresh: refreshLeads } = await useAsyncData(
  'admin-b2b-leads',
  () => api<LeadsRes>('/v1/admin/b2b/leads', {
    query: {
      status: leadStatus.value || undefined,
      hide_test: hideTest.value ? '1' : undefined,
      limit: 50,
    },
  }),
  { watch: [leadStatus, hideTest] },
)

const { data: packagesData, pending: packagesPending, refresh: refreshPackages } = await useAsyncData(
  'admin-b2b-packages',
  () => api<{ items: PackageRow[] }>('/v1/admin/b2b/packages'),
)

const { data: casesData, pending: casesPending, refresh: refreshCases } = await useAsyncData(
  'admin-b2b-cases',
  () => api<{ items: CaseRow[] }>('/v1/admin/b2b/cases'),
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const summary = computed(() => leadsData.value?.summary)
const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Лидов', value: s?.total ?? leadsData.value?.total ?? 0, hint: 'всего', tone: 'violet' as AdminTone, icon: BriefcaseBusiness },
    { label: 'Новые', value: s?.new ?? 0, hint: 'new', tone: 'amber' as AdminTone, icon: Inbox },
    { label: 'В работе', value: s?.inProgress ?? 0, hint: 'in_progress', tone: 'cyan' as AdminTone, icon: BriefcaseBusiness },
    { label: 'Закрыто', value: s?.done ?? 0, hint: 'done', tone: 'emerald' as AdminTone, icon: CheckCircle2 },
  ]
})

const funnelCols = computed(() => {
  const items = leadsData.value?.items || []
  const pick = (st: string) => items.filter(i => i.status === st)
  return [
    { id: 'new', label: 'New', items: pick('new'), tone: 'border-amber-500/40' },
    { id: 'in_progress', label: 'In progress', items: pick('in_progress'), tone: 'border-cyan-500/40' },
    { id: 'done', label: 'Done', items: pick('done'), tone: 'border-emerald-500/40' },
    { id: 'spam', label: 'Spam / lost', items: pick('spam'), tone: 'border-rose-500/40' },
  ]
})

function isTestLead(row: Lead) {
  return /smoke/i.test(`${row.name} ${row.message || ''}`)
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24)
    return `${hours} ч`
  return new Date(iso).toLocaleDateString('ru-RU')
}

const packageForm = reactive({
  slug: '',
  title_ru: '',
  title_en: '',
  price_label_ru: '',
  price_label_en: '',
  features_ru: '',
  features_en: '',
  highlight: false,
  sort_order: 0,
  published: true,
})

const caseForm = reactive({
  slug: '',
  title_ru: '',
  title_en: '',
  summary_ru: '',
  summary_en: '',
  metrics_ru: '',
  metrics_en: '',
  cover_url: '',
  sort_order: 0,
  published: true,
})

function lines(text: string) {
  return text.split('\n').map(s => s.trim()).filter(Boolean)
}

async function setLeadStatus(id: string, status: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/b2b/leads/${id}`, { method: 'PATCH', body: { status } })
    await refreshLeads()
  }
  finally {
    busyId.value = null
  }
}

async function createPackage() {
  msg.value = null
  try {
    await api('/v1/admin/b2b/packages', {
      method: 'POST',
      body: {
        ...packageForm,
        features_ru: lines(packageForm.features_ru),
        features_en: lines(packageForm.features_en),
      },
    })
    msg.value = 'Пакет создан'
    Object.assign(packageForm, {
      slug: '',
      title_ru: '',
      title_en: '',
      price_label_ru: '',
      price_label_en: '',
      features_ru: '',
      features_en: '',
      highlight: false,
      sort_order: 0,
      published: true,
    })
    await refreshPackages()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    msg.value = e?.data?.error || e?.message || 'Ошибка'
  }
}

async function patchPackage(id: string, body: Record<string, unknown>) {
  busyId.value = id
  try {
    await api(`/v1/admin/b2b/packages/${id}`, { method: 'PATCH', body })
    await refreshPackages()
  }
  finally {
    busyId.value = null
  }
}

async function removePackage(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/b2b/packages/${id}`, { method: 'DELETE' })
    await refreshPackages()
  }
  finally {
    busyId.value = null
  }
}

async function createCase() {
  msg.value = null
  try {
    await api('/v1/admin/b2b/cases', {
      method: 'POST',
      body: {
        ...caseForm,
        metrics_ru: lines(caseForm.metrics_ru),
        metrics_en: lines(caseForm.metrics_en),
        cover_url: caseForm.cover_url || null,
      },
    })
    msg.value = 'Кейс создан'
    Object.assign(caseForm, {
      slug: '',
      title_ru: '',
      title_en: '',
      summary_ru: '',
      summary_en: '',
      metrics_ru: '',
      metrics_en: '',
      cover_url: '',
      sort_order: 0,
      published: true,
    })
    await refreshCases()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    msg.value = e?.data?.error || e?.message || 'Ошибка'
  }
}

async function patchCase(id: string, body: Record<string, unknown>) {
  busyId.value = id
  try {
    await api(`/v1/admin/b2b/cases/${id}`, { method: 'PATCH', body })
    await refreshCases()
  }
  finally {
    busyId.value = null
  }
}

async function removeCase(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/b2b/cases/${id}`, { method: 'DELETE' })
    await refreshCases()
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="B2B / казино под ключ"
      description="Лиды, пакеты и кейсы для публичной страницы /b2b"
      help="b2b"
    />

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="card.icon"
        :tone="card.tone"
        :ready="ready && !leadsPending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="inline-flex rounded-xl border bg-card/40 p-1">
      <button
        v-for="t in [
          { id: 'leads', label: `Лиды (${leadsData?.total ?? 0})` },
          { id: 'packages', label: `Пакеты (${packagesData?.items?.length ?? 0})` },
          { id: 'cases', label: `Кейсы (${casesData?.items?.length ?? 0})` },
        ]"
        :key="t.id"
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'"
        @click="tab = t.id as typeof tab"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="msg" class="text-sm text-muted-foreground">
      {{ msg }}
    </p>

    <template v-if="tab === 'leads'">
      <div class="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/40 p-3">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="chip in [
              { id: '', label: 'Все' },
              { id: 'new', label: 'New' },
              { id: 'in_progress', label: 'In progress' },
              { id: 'done', label: 'Done' },
              { id: 'spam', label: 'Spam' },
            ]"
            :key="chip.id || 'all'"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="leadStatus === chip.id
              ? 'border-foreground/20 bg-foreground text-background'
              : 'border-border bg-background text-muted-foreground hover:text-foreground'"
            @click="leadStatus = chip.id"
          >
            {{ chip.label }}
          </button>
        </div>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <AdminCheckbox v-model:checked="hideTest">
            Скрыть test/smoke
          </AdminCheckbox>
          <div class="inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs"
              :class="leadView === 'table' ? 'bg-muted font-medium' : 'text-muted-foreground'"
              @click="leadView = 'table'"
            >
              Таблица
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs"
              :class="leadView === 'funnel' ? 'bg-muted font-medium' : 'text-muted-foreground'"
              @click="leadView = 'funnel'"
            >
              Воронка
            </button>
          </div>
        </div>
      </div>

      <AdminTableSkeleton v-if="leadsPending && !leadsData" :cols="6" />

      <div v-else-if="leadView === 'funnel'" class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="col in funnelCols"
          :key="col.id"
          class="rounded-2xl border bg-card/40 p-3"
          :class="col.tone"
        >
          <div class="mb-3 flex items-center justify-between text-sm font-medium">
            <span>{{ col.label }}</span>
            <span class="tabular-nums text-muted-foreground">{{ col.items.length }}</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="row in col.items"
              :key="row.id"
              class="rounded-xl border bg-background p-2.5 text-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ row.name }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ row.contact }}
                  </p>
                </div>
                <Badge v-if="isTestLead(row)" variant="outline" class="shrink-0 text-[10px]">
                  test
                </Badge>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ row.budget || 'бюджет —' }} · {{ relativeTime(row.created_at) }}
              </p>
              <AdminSelect
                size="sm"
                class="mt-2 w-full"
                :model-value="row.status"
                :disabled="busyId === row.id"
                :options="[
                  { value: 'new', label: 'new' },
                  { value: 'in_progress', label: 'in_progress' },
                  { value: 'done', label: 'done' },
                  { value: 'spam', label: 'spam' },
                ]"
                @update:model-value="(v) => setLeadStatus(row.id, String(v ?? ''))"
              />
            </div>
            <p v-if="!col.items.length" class="py-6 text-center text-xs text-muted-foreground">
              Пусто
            </p>
          </div>
        </div>
      </div>

      <div v-else class="overflow-x-auto rounded-2xl border">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
            <tr class="text-xs uppercase tracking-wide text-muted-foreground">
              <th class="px-3 py-2.5 font-medium">
                Контакт
              </th>
              <th class="px-3 py-2.5 font-medium">
                Тип
              </th>
              <th class="px-3 py-2.5 font-medium">
                Бюджет
              </th>
              <th class="px-3 py-2.5 font-medium">
                Сообщение
              </th>
              <th class="px-3 py-2.5 font-medium">
                Статус
              </th>
              <th class="px-3 py-2.5 font-medium">
                Дата
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in leadsData?.items || []" :key="row.id" class="border-t align-top transition-colors hover:bg-muted/40">
              <td class="px-3 py-2.5">
                <div class="font-medium">
                  {{ row.name }}
                  <Badge v-if="isTestLead(row)" variant="outline" class="ml-1 text-[10px]">
                    test
                  </Badge>
                </div>
                <div class="text-muted-foreground">
                  {{ row.contact }}
                </div>
              </td>
              <td class="px-3 py-2.5">
                {{ row.project_type }}
              </td>
              <td class="px-3 py-2.5">
                {{ row.budget || '—' }}
              </td>
              <td class="max-w-xs px-3 py-2.5 text-muted-foreground">
                {{ row.message || '—' }}
              </td>
              <td class="px-3 py-2.5">
                <AdminSelect
                  size="sm"
                  class="w-[130px]"
                  :model-value="row.status"
                  :disabled="busyId === row.id"
                  :options="[
                    { value: 'new', label: 'new' },
                    { value: 'in_progress', label: 'in_progress' },
                    { value: 'done', label: 'done' },
                    { value: 'spam', label: 'spam' },
                  ]"
                  @update:model-value="(v) => setLeadStatus(row.id, String(v ?? ''))"
                />
              </td>
              <td class="whitespace-nowrap px-3 py-2.5 text-muted-foreground" :title="new Date(row.created_at).toLocaleString('ru-RU')">
                {{ relativeTime(row.created_at) }}
              </td>
            </tr>
            <tr v-if="!(leadsData?.items?.length)">
              <td colspan="6" class="px-3 py-2">
                <AdminUiAdminEmptyState
                  title="Лидов нет"
                  description="Новые заявки появятся с /b2b"
                  :icon="Inbox"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="tab === 'packages'">
      <form class="grid gap-3 rounded-2xl border bg-card/40 p-4 md:grid-cols-2" @submit.prevent="createPackage">
        <Input v-model="packageForm.slug" placeholder="slug" required />
        <Input v-model.number="packageForm.sort_order" type="number" placeholder="sort" />
        <Input v-model="packageForm.title_ru" placeholder="title RU" required />
        <Input v-model="packageForm.title_en" placeholder="title EN" required />
        <Input v-model="packageForm.price_label_ru" placeholder="цена RU" />
        <Input v-model="packageForm.price_label_en" placeholder="price EN" />
        <Textarea v-model="packageForm.features_ru" class="min-h-24" placeholder="фичи RU (по строке)" />
        <Textarea v-model="packageForm.features_en" class="min-h-24" placeholder="features EN (one per line)" />
        <AdminCheckbox v-model:checked="packageForm.highlight">
          Highlight
        </AdminCheckbox>
        <AdminCheckbox v-model:checked="packageForm.published">
          Published
        </AdminCheckbox>
        <Button type="submit" class="md:col-span-2">
          Добавить пакет
        </Button>
      </form>

      <AdminTableSkeleton v-if="packagesPending && !packagesData" :cols="5" />
      <AdminUiAdminEmptyState
        v-else-if="!(packagesData?.items?.length)"
        title="Пакетов пока нет"
        description="Создайте первый пакет выше"
        :icon="BriefcaseBusiness"
      />
      <div v-else class="space-y-3">
        <div v-for="row in packagesData?.items || []" :key="row.id" class="rounded-2xl border bg-card/40 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-medium">
                {{ row.title_ru }} / {{ row.title_en }}
                <span class="text-muted-foreground">({{ row.slug }})</span>
              </div>
              <div class="text-sm text-muted-foreground">
                {{ row.price_label_ru }} · sort {{ row.sort_order }}
              </div>
            </div>
            <div class="inline-flex items-center gap-2">
              <Switch
                :model-value="row.published"
                :disabled="busyId === row.id"
                @update:model-value="(v: boolean) => patchPackage(row.id, { published: v })"
              />
              <AdminIconButton
                :tooltip="row.highlight ? 'Убрать highlight' : 'Highlight'"
                :icon="Sparkles"
                :disabled="busyId === row.id"
                :class="row.highlight ? 'text-amber-500' : undefined"
                @click="patchPackage(row.id, { highlight: !row.highlight })"
              />
              <AdminConfirmDelete
                entity="пакет"
                :label="row.title_ru"
                :busy="busyId === row.id"
                @confirm="removePackage(row.id)"
              />
            </div>
          </div>
          <ul class="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            <li v-for="f in row.features_ru || []" :key="f">
              {{ f }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template v-else>
      <form class="grid gap-3 rounded-2xl border bg-card/40 p-4 md:grid-cols-2" @submit.prevent="createCase">
        <Input v-model="caseForm.slug" placeholder="slug" required />
        <Input v-model.number="caseForm.sort_order" type="number" placeholder="sort" />
        <Input v-model="caseForm.title_ru" placeholder="title RU" required />
        <Input v-model="caseForm.title_en" placeholder="title EN" required />
        <Input v-model="caseForm.summary_ru" placeholder="summary RU" />
        <Input v-model="caseForm.summary_en" placeholder="summary EN" />
        <Textarea v-model="caseForm.metrics_ru" class="min-h-24" placeholder="метрики RU (по строке)" />
        <Textarea v-model="caseForm.metrics_en" class="min-h-24" placeholder="metrics EN (one per line)" />
        <Input v-model="caseForm.cover_url" class="md:col-span-2" placeholder="cover URL (optional)" />
        <AdminCheckbox v-model:checked="caseForm.published">
          Published
        </AdminCheckbox>
        <Button type="submit">
          Добавить кейс
        </Button>
      </form>

      <AdminTableSkeleton v-if="casesPending && !casesData" :cols="4" />
      <AdminUiAdminEmptyState
        v-else-if="!(casesData?.items?.length)"
        title="Кейсов пока нет"
        description="Добавьте первый кейс выше"
        :icon="BriefcaseBusiness"
      />
      <div v-else class="space-y-3">
        <div v-for="row in casesData?.items || []" :key="row.id" class="rounded-2xl border bg-card/40 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-medium">
                {{ row.title_ru }} / {{ row.title_en }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{ row.summary_ru }}
              </div>
            </div>
            <div class="inline-flex items-center gap-2">
              <Switch
                :model-value="row.published"
                :disabled="busyId === row.id"
                @update:model-value="(v: boolean) => patchCase(row.id, { published: v })"
              />
              <AdminConfirmDelete
                entity="кейс"
                :label="row.title_ru"
                :busy="busyId === row.id"
                @confirm="removeCase(row.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
