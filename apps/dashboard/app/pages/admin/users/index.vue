<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { UserCheck, Users, UserX } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface Row {
  id: string
  email: string
  display_name: string | null
  role: string
  is_staff: boolean
  is_active: boolean
  casino_slug: string | null
  created_at: string
}

interface ListRes { items: Row[], total: number }

const q = ref('')
const role = ref('')
const page = ref(1)
const roles = [
  { value: '', label: 'Все роли' },
  { value: 'admin', label: 'admin' },
  { value: 'developer', label: 'developer' },
  { value: 'lawyer', label: 'lawyer' },
  { value: 'editor', label: 'editor' },
  { value: 'author', label: 'author' },
  { value: 'partner_rep', label: 'partner_rep' },
  { value: 'player', label: 'player' },
]

const roleTone: Record<string, string> = {
  admin: 'border-rose-500/40 text-rose-700 dark:text-rose-400',
  developer: 'border-violet-500/40 text-violet-700 dark:text-violet-400',
  lawyer: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  editor: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400',
  author: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  partner_rep: 'border-violet-500/40 text-violet-700 dark:text-violet-400',
  player: 'border-border text-muted-foreground',
}

const { data, pending, refresh } = await useAsyncData(
  'admin-users',
  () => api<ListRes>('/v1/admin/users', {
    query: {
      q: q.value || undefined,
      role: role.value || undefined,
      page: page.value,
      limit: 50,
    },
  }),
  { watch: [page, role] },
)

async function search() {
  page.value = 1
  await refresh()
}

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const roleCounts = computed(() => {
  const map: Record<string, number> = {}
  for (const row of data.value?.items || [])
    map[row.role] = (map[row.role] || 0) + 1
  return map
})

const kpiCards = computed(() => {
  const items = data.value?.items || []
  const active = items.filter(i => i.is_active).length
  return [
    { label: 'Всего', value: data.value?.total ?? 0, hint: 'аккаунтов', tone: 'violet' as AdminTone },
    { label: 'Активные', value: active, hint: 'на странице', tone: 'emerald' as AdminTone },
    { label: 'Admin', value: roleCounts.value.admin || 0, hint: 'роль admin', tone: 'rose' as AdminTone },
    { label: 'Editor', value: roleCounts.value.editor || 0, hint: 'роль editor', tone: 'cyan' as AdminTone },
  ]
})

const busyId = ref<string | null>(null)

function initials(row: Row) {
  const s = (row.display_name || row.email || '?').trim()
  return s.slice(0, 2).toUpperCase()
}

function isSelf(row: Row) {
  return user.value?.email === row.email
}

async function patchUser(id: string, body: Record<string, unknown>) {
  busyId.value = id
  try {
    await api(`/v1/admin/users/${id}`, { method: 'PATCH', body })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function removeUser(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/users/${id}`, { method: 'DELETE' })
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
      title="Пользователи"
      :description="`${data?.total ?? 0} аккаунтов · роли, поиск и действия`"
      help="users"
    />

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="Users"
        :tone="card.tone"
        :ready="ready && !pending"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <form class="flex flex-wrap gap-2 rounded-2xl border bg-card/40 p-3" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Email / имя" />
      <AdminSelect
        class="w-[180px]"
        :model-value="role"
        :options="roles.map(r => ({ value: r.value, label: r.label }))"
        @update:model-value="(v) => { role = String(v ?? ''); search() }"
      />
      <Button type="submit" variant="secondary" :disabled="pending">
        Найти
      </Button>
    </form>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              User
            </th>
            <th class="px-3 py-2.5 font-medium">
              Role
            </th>
            <th class="px-3 py-2.5 font-medium">
              Casino
            </th>
            <th class="px-3 py-2.5 font-medium">
              Active
            </th>
            <th class="px-3 py-2.5 font-medium text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data?.items || []"
            :key="row.id"
            class="border-t transition-colors hover:bg-muted/40"
            style="height: 52px"
          >
            <td class="px-3 py-2">
              <div class="flex items-center gap-3">
                <div class="grid size-8 place-items-center rounded-full border bg-muted text-[11px] font-semibold">
                  {{ initials(row) }}
                </div>
                <div>
                  <div class="font-medium">
                    {{ row.display_name || '—' }}
                    <Badge v-if="isSelf(row)" variant="outline" class="ml-1 text-[10px]">
                      вы
                    </Badge>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ row.email }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-3 py-2">
              <AdminSelect
                size="sm"
                class="w-[140px]"
                :model-value="row.role"
                :disabled="busyId === row.id || isSelf(row)"
                :options="roles.filter(x => x.value).map(r => ({ value: r.value, label: r.label }))"
                @update:model-value="(v) => patchUser(row.id, { role: String(v ?? '') })"
              />
              <Badge
                variant="outline"
                class="mt-1 font-normal"
                :class="roleTone[row.role] || ''"
              >
                {{ row.role }}
              </Badge>
            </td>
            <td class="px-3 py-2">
              <Input
                v-if="row.role === 'partner_rep'"
                class="h-8 w-[140px] text-xs"
                :model-value="row.casino_slug || ''"
                placeholder="casino slug"
                :disabled="busyId === row.id"
                @keydown.enter="patchUser(row.id, { casino_slug: ($event.target as HTMLInputElement).value || null })"
                @blur="patchUser(row.id, { casino_slug: ($event.target as HTMLInputElement).value || null })"
              />
              <span v-else class="text-xs text-muted-foreground">—</span>
            </td>
            <td class="px-3 py-2">
              <Switch
                :model-value="row.is_active"
                :disabled="busyId === row.id || isSelf(row)"
                @update:model-value="(v: boolean) => patchUser(row.id, { is_active: v })"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  :tooltip="row.is_active ? 'Деактивировать' : 'Активировать'"
                  :icon="row.is_active ? UserX : UserCheck"
                  :disabled="busyId === row.id || isSelf(row)"
                  @click="patchUser(row.id, { is_active: !row.is_active })"
                />
                <AdminConfirmDelete
                  v-if="!isSelf(row)"
                  entity="пользователя"
                  :label="row.email"
                  :busy="busyId === row.id"
                  @confirm="removeUser(row.id)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
