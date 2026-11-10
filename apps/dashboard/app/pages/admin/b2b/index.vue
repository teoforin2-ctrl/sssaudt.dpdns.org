<script setup lang="ts">
import { Eye, EyeOff, Sparkles } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const tab = ref<'leads' | 'packages' | 'cases'>('leads')
const leadStatus = ref('')
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

const { data: leadsData, pending: leadsPending, refresh: refreshLeads } = await useAsyncData(
  'admin-b2b-leads',
  () => api<{ items: Lead[], total: number }>('/v1/admin/b2b/leads', {
    query: { status: leadStatus.value || undefined, limit: 50 },
  }),
  { watch: [leadStatus] },
)

const { data: packagesData, pending: packagesPending, refresh: refreshPackages } = await useAsyncData(
  'admin-b2b-packages',
  () => api<{ items: PackageRow[] }>('/v1/admin/b2b/packages'),
)

const { data: casesData, pending: casesPending, refresh: refreshCases } = await useAsyncData(
  'admin-b2b-cases',
  () => api<{ items: CaseRow[] }>('/v1/admin/b2b/cases'),
)

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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          B2B / казино под ключ
        </h1>
        <p class="text-sm text-muted-foreground">
          Лиды, пакеты и кейсы для публичной страницы /b2b
        </p>
      </div>
      <AdminSectionHelp section="b2b" />
    </div>

    <div class="flex flex-wrap gap-2">
      <Button :variant="tab === 'leads' ? 'default' : 'secondary'" @click="tab = 'leads'">
        Лиды ({{ leadsData?.total ?? 0 }})
      </Button>
      <Button :variant="tab === 'packages' ? 'default' : 'secondary'" @click="tab = 'packages'">
        Пакеты
      </Button>
      <Button :variant="tab === 'cases' ? 'default' : 'secondary'" @click="tab = 'cases'">
        Кейсы
      </Button>
    </div>

    <p v-if="msg" class="text-sm text-muted-foreground">
      {{ msg }}
    </p>

    <template v-if="tab === 'leads'">
      <div class="flex flex-wrap gap-2">
        <select v-model="leadStatus" class="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">
            Все статусы
          </option>
          <option value="new">
            new
          </option>
          <option value="in_progress">
            in_progress
          </option>
          <option value="done">
            done
          </option>
          <option value="spam">
            spam
          </option>
        </select>
      </div>
      <AdminTableSkeleton v-if="leadsPending && !leadsData" :cols="6" />
      <div v-else class="overflow-x-auto rounded-xl border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left">
            <tr>
              <th class="px-3 py-2 font-medium">
                Контакт
              </th>
              <th class="px-3 py-2 font-medium">
                Тип
              </th>
              <th class="px-3 py-2 font-medium">
                Бюджет
              </th>
              <th class="px-3 py-2 font-medium">
                Сообщение
              </th>
              <th class="px-3 py-2 font-medium">
                Статус
              </th>
              <th class="px-3 py-2 font-medium">
                Дата
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in leadsData?.items || []" :key="row.id" class="border-t align-top">
              <td class="px-3 py-2">
                <div class="font-medium">
                  {{ row.name }}
                </div>
                <div class="text-muted-foreground">
                  {{ row.contact }}
                </div>
              </td>
              <td class="px-3 py-2">
                {{ row.project_type }}
              </td>
              <td class="px-3 py-2">
                {{ row.budget || '—' }}
              </td>
              <td class="max-w-xs px-3 py-2 text-muted-foreground">
                {{ row.message || '—' }}
              </td>
              <td class="px-3 py-2">
                <select
                  class="rounded-md border bg-background px-2 py-1 text-xs"
                  :value="row.status"
                  :disabled="busyId === row.id"
                  @change="setLeadStatus(row.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="new">
                    new
                  </option>
                  <option value="in_progress">
                    in_progress
                  </option>
                  <option value="done">
                    done
                  </option>
                  <option value="spam">
                    spam
                  </option>
                </select>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {{ new Date(row.created_at).toLocaleString('ru-RU') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="tab === 'packages'">
      <form class="grid gap-3 rounded-xl border p-4 md:grid-cols-2" @submit.prevent="createPackage">
        <Input v-model="packageForm.slug" placeholder="slug" required />
        <Input v-model.number="packageForm.sort_order" type="number" placeholder="sort" />
        <Input v-model="packageForm.title_ru" placeholder="title RU" required />
        <Input v-model="packageForm.title_en" placeholder="title EN" required />
        <Input v-model="packageForm.price_label_ru" placeholder="цена RU" />
        <Input v-model="packageForm.price_label_en" placeholder="price EN" />
        <textarea v-model="packageForm.features_ru" class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" placeholder="фичи RU (по строке)" />
        <textarea v-model="packageForm.features_en" class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" placeholder="features EN (one per line)" />
        <label class="flex items-center gap-2 text-sm">
          <input v-model="packageForm.highlight" type="checkbox"> Highlight
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="packageForm.published" type="checkbox"> Published
        </label>
        <Button type="submit" class="md:col-span-2">
          Добавить пакет
        </Button>
      </form>

      <AdminTableSkeleton v-if="packagesPending && !packagesData" :cols="5" />
      <div v-else class="space-y-3">
        <div v-for="row in packagesData?.items || []" :key="row.id" class="rounded-xl border p-4">
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
            <div class="inline-flex items-center gap-0.5">
              <AdminIconButton
                :tooltip="row.published ? 'Скрыть' : 'Опубликовать'"
                :icon="row.published ? EyeOff : Eye"
                :disabled="busyId === row.id"
                @click="patchPackage(row.id, { published: !row.published })"
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
      <form class="grid gap-3 rounded-xl border p-4 md:grid-cols-2" @submit.prevent="createCase">
        <Input v-model="caseForm.slug" placeholder="slug" required />
        <Input v-model.number="caseForm.sort_order" type="number" placeholder="sort" />
        <Input v-model="caseForm.title_ru" placeholder="title RU" required />
        <Input v-model="caseForm.title_en" placeholder="title EN" required />
        <Input v-model="caseForm.summary_ru" placeholder="summary RU" />
        <Input v-model="caseForm.summary_en" placeholder="summary EN" />
        <textarea v-model="caseForm.metrics_ru" class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" placeholder="метрики RU (по строке)" />
        <textarea v-model="caseForm.metrics_en" class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" placeholder="metrics EN (one per line)" />
        <Input v-model="caseForm.cover_url" class="md:col-span-2" placeholder="cover URL (optional)" />
        <label class="flex items-center gap-2 text-sm">
          <input v-model="caseForm.published" type="checkbox"> Published
        </label>
        <Button type="submit">
          Добавить кейс
        </Button>
      </form>

      <AdminTableSkeleton v-if="casesPending && !casesData" :cols="4" />
      <div v-else class="space-y-3">
        <div v-for="row in casesData?.items || []" :key="row.id" class="rounded-xl border p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-medium">
                {{ row.title_ru }} / {{ row.title_en }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{ row.summary_ru }}
              </div>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <AdminIconButton
                :tooltip="row.published ? 'Скрыть' : 'Опубликовать'"
                :icon="row.published ? EyeOff : Eye"
                :disabled="busyId === row.id"
                @click="patchCase(row.id, { published: !row.published })"
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
