<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { Ban, Check, Scale, X } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()
const status = ref('')
const q = ref('')
const busyId = ref<string | null>(null)
const form = reactive({ name: '', slug: '', reason_ru: '', reason_en: '' })

const canPublish = computed(() =>
  user.value?.role === 'lawyer'
  || user.value?.role === 'admin'
  || user.value?.role === 'developer',
)

interface Row {
  id: string
  name: string
  slug: string | null
  reason_ru: string
  reason_en: string
  status: string
  lawyer_note: string | null
  published_at: string | null
}

const { data, pending, refresh } = await useAsyncData(
  'admin-blacklist',
  () =>
    api<{ items: Row[] }>('/v1/admin/blacklist', {
      query: { status: status.value || undefined },
    }),
  { watch: [status] },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const filtered = computed(() => {
  const items = data.value?.items || []
  const needle = q.value.trim().toLowerCase()
  if (!needle)
    return items
  return items.filter(r =>
    r.name.toLowerCase().includes(needle)
    || (r.slug || '').toLowerCase().includes(needle)
    || (r.reason_ru || '').toLowerCase().includes(needle),
  )
})

const counts = computed(() => {
  const items = data.value?.items || []
  return {
    total: items.length,
    published: items.filter(i => i.status === 'published').length,
    pending: items.filter(i => i.status === 'pending_lawyer').length,
    draft: items.filter(i => i.status === 'draft').length,
  }
})

const kpiCards = computed(() => [
  { label: 'Всего', value: counts.value.total, hint: 'записей', tone: 'violet' as AdminTone },
  { label: 'Published', value: counts.value.published, hint: 'на сайте', tone: 'emerald' as AdminTone },
  { label: 'У юриста', value: counts.value.pending, hint: 'pending_lawyer', tone: 'amber' as AdminTone },
  { label: 'Черновики', value: counts.value.draft, hint: 'draft', tone: 'cyan' as AdminTone },
])

async function create(submitToLawyer: boolean) {
  if (!form.name.trim())
    return
  await api('/v1/admin/blacklist', {
    method: 'POST',
    body: {
      name: form.name.trim(),
      slug: form.slug || null,
      reason_ru: form.reason_ru,
      reason_en: form.reason_en,
      submit_to_lawyer: submitToLawyer,
    },
  })
  form.name = ''
  form.slug = ''
  form.reason_ru = ''
  form.reason_en = ''
  await refresh()
}

async function patch(id: string, body: Record<string, unknown>) {
  busyId.value = id
  try {
    await api(`/v1/admin/blacklist/${id}`, { method: 'PATCH', body })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function remove(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/blacklist/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Чёрный список"
      description="Публикация только с ролью lawyer / admin / developer"
      help="blacklist"
    />

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="Ban"
        :tone="card.tone"
        :ready="ready && !pending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="space-y-2 rounded-2xl border bg-card/40 p-4">
      <Input v-model="form.name" placeholder="Название бренда" />
      <Input v-model="form.slug" placeholder="slug (опц.)" />
      <Textarea v-model="form.reason_ru" rows="2" placeholder="Причина (RU)" />
      <Textarea v-model="form.reason_en" rows="2" placeholder="Reason (EN)" />
      <div class="flex gap-2">
        <Button size="sm" variant="secondary" @click="create(false)">
          Черновик
        </Button>
        <Button size="sm" @click="create(true)">
          На проверку юристу
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="chip in [
            { id: '', label: 'Все' },
            { id: 'draft', label: 'Draft' },
            { id: 'pending_lawyer', label: 'У юриста' },
            { id: 'published', label: 'Published' },
            { id: 'rejected', label: 'Rejected' },
          ]"
          :key="chip.id || 'all'"
          type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="status === chip.id
            ? 'border-foreground/20 bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'"
          @click="status = chip.id"
        >
          {{ chip.label }}
        </button>
      </div>
      <Input v-model="q" class="max-w-sm" placeholder="Поиск по имени / причине" />
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="3" />
    <div v-else class="space-y-3">
      <div
        v-for="r in filtered"
        :key="r.id"
        class="space-y-2 rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card"
      >
        <div class="flex flex-wrap items-center gap-2">
          <AdminUiAdminStatusBadge :status="r.status" />
          <strong>{{ r.name }}</strong>
          <span class="font-mono text-xs text-muted-foreground">{{ r.slug || '—' }}</span>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ r.reason_ru || r.reason_en }}
        </p>
        <div class="inline-flex flex-wrap items-center gap-0.5">
          <AdminIconButton
            v-if="r.status === 'draft'"
            tooltip="Отправить юристу"
            :icon="Scale"
            :disabled="busyId === r.id"
            @click="patch(r.id, { status: 'pending_lawyer' })"
          />
          <AdminIconButton
            v-if="canPublish && r.status !== 'published'"
            tooltip="Опубликовать"
            :icon="Check"
            :disabled="busyId === r.id"
            class="text-emerald-600"
            @click="patch(r.id, { status: 'published' })"
          />
          <AdminIconButton
            v-if="canPublish && r.status === 'pending_lawyer'"
            tooltip="Отклонить"
            :icon="X"
            :disabled="busyId === r.id"
            @click="patch(r.id, { status: 'rejected' })"
          />
          <AdminConfirmDelete
            entity="запись ЧС"
            :label="r.name"
            :busy="busyId === r.id"
            @confirm="remove(r.id)"
          />
        </div>
      </div>
      <AdminUiAdminEmptyState
        v-if="!filtered.length"
        title="Пусто"
        description="Нет записей по фильтру"
        :icon="Ban"
      />
    </div>
  </div>
</template>
