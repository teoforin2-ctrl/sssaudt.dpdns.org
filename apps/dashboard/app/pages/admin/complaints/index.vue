<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const status = ref('')
const page = ref(1)
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

const { data, pending, refresh } = await useAsyncData(
  'admin-complaints',
  () =>
    api<{ items: Row[], total: number }>('/v1/admin/complaints', {
      query: { status: status.value || undefined, page: page.value, limit: 30 },
    }),
  { watch: [status, page] },
)

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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Жалобы
        </h1>
        <p class="text-sm text-muted-foreground">
          Workflow: new → in_review → need_info / resolved / rejected · {{ data?.total ?? 0 }}
        </p>
      </div>
      <AdminSectionHelp section="complaints" />
    </div>

    <select
      v-model="status"
      class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
      @change="page = 1"
    >
      <option value="">
        Все статусы
      </option>
      <option
        v-for="s in ['new', 'in_review', 'need_info', 'resolved', 'rejected']"
        :key="s"
        :value="s"
      >
        {{ s }}
      </option>
    </select>

    <AdminTableSkeleton v-if="pending && !data" :cols="4" />
    <div v-else class="space-y-3">
      <div
        v-for="r in data?.items || []"
        :key="r.id"
        class="space-y-2 rounded-xl border p-4"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <Badge>{{ r.status }}</Badge>
          <strong>{{ r.subject }}</strong>
          <span class="text-muted-foreground">{{ r.casino_slug || r.casino_name || '—' }}</span>
          <span class="ml-auto text-xs text-muted-foreground">{{ new Date(r.created_at).toLocaleString() }}</span>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ r.author_name }} · {{ r.author_email }}
        </p>
        <p class="whitespace-pre-wrap text-sm">
          {{ r.body }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="s in ['in_review', 'need_info', 'resolved', 'rejected']"
            :key="s"
            size="sm"
            variant="outline"
            :disabled="busyId === r.id || r.status === s"
            @click="setStatus(r.id, s)"
          >
            {{ s }}
          </Button>
        </div>
        <Input
          class="max-w-xl"
          :model-value="r.staff_note || ''"
          placeholder="Заметка редакции"
          :disabled="busyId === r.id"
          @keydown.enter="saveNote(r.id, ($event.target as HTMLInputElement).value)"
        />
      </div>
      <p v-if="!(data?.items?.length)" class="py-8 text-center text-sm text-muted-foreground">
        Жалоб нет
      </p>
    </div>
  </div>
</template>
