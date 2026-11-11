<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const status = ref('')
const page = ref(1)
const limit = ref(30)
const busyId = ref<string | null>(null)

interface Row {
  id: string
  casino_slug: string | null
  casino_name: string | null
  author_name: string | null
  author_email: string | null
  subject: string
  body: string
  status: string
  staff_note: string | null
  created_at: string
}

interface ListRes {
  items: Row[]
  total: number
  summary?: {
    total: number
    open: number
    inProgress: number
    resolved: number
  }
}

const { data, pending, refresh } = await useAsyncData(
  'admin-complaints',
  () =>
    api<ListRes>('/v1/admin/complaints', {
      query: { status: status.value || undefined, page: page.value, limit: limit.value },
    }),
  { watch: [status, page, limit] },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const summary = computed(() => data.value?.summary)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / limit.value)))

const kpiCards = computed(() => {
  const s = summary.value
  return [
    { label: 'Всего', value: s?.total ?? data.value?.total ?? 0, hint: 'жалоб', tone: 'violet' as AdminTone, icon: ShieldAlert },
    { label: 'Открытые', value: s?.open ?? 0, hint: 'new / review / info', tone: 'amber' as AdminTone, icon: Clock3 },
    { label: 'В работе', value: s?.inProgress ?? 0, hint: 'in_review', tone: 'cyan' as AdminTone, icon: Clock3 },
    { label: 'Решено', value: s?.resolved ?? 0, hint: 'resolved', tone: 'emerald' as AdminTone, icon: CheckCircle2 },
  ]
})

function daysOpen(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

function slaClass(row: Row) {
  if (['resolved', 'rejected'].includes(row.status))
    return 'text-muted-foreground'
  const d = daysOpen(row.created_at)
  if (d >= 7)
    return 'text-rose-600 dark:text-rose-400'
  if (d >= 3)
    return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

async function setStatus(id: string, next: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/complaints/${id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function saveNote(id: string, note: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/complaints/${id}`, { method: 'PATCH', body: { staff_note: note || null } })
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
      title="Жалобы"
      :description="`Workflow: new → in_review → need_info / resolved / rejected · ${(summary?.total ?? data?.total ?? 0).toLocaleString('ru-RU')}`"
      help="complaints"
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
        :ready="ready && !pending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div class="flex flex-wrap gap-1.5 rounded-2xl border bg-card/40 p-3">
      <button
        v-for="chip in [
          { id: '', label: 'Все' },
          { id: 'new', label: 'New' },
          { id: 'in_review', label: 'In review' },
          { id: 'need_info', label: 'Need info' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'rejected', label: 'Rejected' },
        ]"
        :key="chip.id || 'all'"
        type="button"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="status === chip.id
          ? 'border-foreground/20 bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'"
        @click="status = chip.id; page = 1"
      >
        {{ chip.label }}
      </button>
    </div>

    <AdminTableSkeleton v-if="pending && !data" :cols="4" />
    <div v-else class="space-y-3">
      <div
        v-for="r in data?.items || []"
        :key="r.id"
        class="space-y-3 rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <AdminUiAdminStatusBadge :status="r.status" />
          <strong>{{ r.subject }}</strong>
          <Badge v-if="r.casino_slug || r.casino_name" variant="outline" class="font-normal">
            {{ r.casino_name || r.casino_slug }}
          </Badge>
          <span class="ml-auto text-xs tabular-nums" :class="slaClass(r)" :title="new Date(r.created_at).toLocaleString('ru-RU')">
            открыто {{ daysOpen(r.created_at) }} дн.
          </span>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ r.author_name || 'аноним' }} · {{ r.author_email || '—' }}
        </p>
        <p class="whitespace-pre-wrap text-sm leading-relaxed">
          {{ r.body }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="s in ['in_review', 'need_info', 'resolved', 'rejected']"
            :key="s"
            size="sm"
            variant="outline"
            class="h-8"
            :disabled="busyId === r.id || r.status === s"
            @click="setStatus(r.id, s)"
          >
            {{ s }}
          </Button>
        </div>
        <Input
          class="max-w-xl"
          :model-value="r.staff_note || ''"
          placeholder="Заметка редакции · Enter чтобы сохранить"
          :disabled="busyId === r.id"
          @keydown.enter="saveNote(r.id, ($event.target as HTMLInputElement).value)"
        />
      </div>
      <AdminUiAdminEmptyState
        v-if="!(data?.items?.length)"
        title="Жалоб нет"
        description="По текущему фильтру пусто"
        :icon="ShieldAlert"
      />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-muted-foreground">
        стр. {{ page }} / {{ totalPages }}
      </p>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="page <= 1 || pending" @click="page--">
          Назад
        </Button>
        <Button size="sm" variant="outline" :disabled="page >= totalPages || pending" @click="page++">
          Далее
        </Button>
      </div>
    </div>
  </div>
</template>
