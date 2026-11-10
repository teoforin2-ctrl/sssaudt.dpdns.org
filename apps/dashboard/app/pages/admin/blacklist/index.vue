<script setup lang="ts">
import { Check, Scale, X } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()
const status = ref('')
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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Чёрный список
        </h1>
        <p class="text-sm text-muted-foreground">
          Публикация только с ролью lawyer / admin / developer
        </p>
      </div>
      <AdminSectionHelp section="blacklist" />
    </div>

    <div class="space-y-2 rounded-xl border p-4">
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

    <select
      v-model="status"
      class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
    >
      <option value="">
        Все
      </option>
      <option
        v-for="s in ['draft', 'pending_lawyer', 'published', 'rejected']"
        :key="s"
        :value="s"
      >
        {{ s }}
      </option>
    </select>

    <AdminTableSkeleton v-if="pending && !data" :cols="3" />
    <div v-else class="space-y-3">
      <div
        v-for="r in data?.items || []"
        :key="r.id"
        class="space-y-2 rounded-xl border p-4"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Badge>{{ r.status }}</Badge>
          <strong>{{ r.name }}</strong>
          <span class="text-xs text-muted-foreground">{{ r.slug || '—' }}</span>
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
    </div>
  </div>
</template>
