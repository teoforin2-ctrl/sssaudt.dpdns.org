<script setup lang="ts">
import { UserCheck, UserX } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()

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

const busyId = ref<string | null>(null)

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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Пользователи
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} аккаунтов · фильтр по роли, поиск и действия
        </p>
      </div>
      <AdminSectionHelp section="users" />
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Email / имя" />
      <select
        v-model="role"
        class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
        @change="search"
      >
        <option v-for="r in roles" :key="r.value || 'all'" :value="r.value">
          {{ r.label }}
        </option>
      </select>
      <Button type="submit" variant="secondary" :disabled="pending">
        Найти
      </Button>
    </form>

    <AdminTableSkeleton v-if="pending && !data" :cols="5" />
    <div v-else class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="px-3 py-2 font-medium">
              User
            </th>
            <th class="px-3 py-2 font-medium">
              Role
            </th>
            <th class="px-3 py-2 font-medium">
              Casino
            </th>
            <th class="px-3 py-2 font-medium">
              Active
            </th>
            <th class="px-3 py-2 font-medium text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items || []" :key="row.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.display_name || '—' }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ row.email }}
              </div>
            </td>
            <td class="px-3 py-2">
              <select
                class="flex h-8 rounded-md border bg-transparent px-2 text-xs"
                :value="row.role"
                :disabled="busyId === row.id"
                @change="patchUser(row.id, { role: ($event.target as HTMLSelectElement).value })"
              >
                <option v-for="r in roles.filter(x => x.value)" :key="r.value" :value="r.value">
                  {{ r.label }}
                </option>
              </select>
            </td>
            <td class="px-3 py-2">
              <input
                class="flex h-8 w-[140px] rounded-md border bg-transparent px-2 text-xs"
                :value="row.casino_slug || ''"
                placeholder="slug"
                :disabled="busyId === row.id || row.role !== 'partner_rep'"
                @keydown.enter="patchUser(row.id, { casino_slug: ($event.target as HTMLInputElement).value || null })"
                @blur="patchUser(row.id, { casino_slug: ($event.target as HTMLInputElement).value || null })"
              >
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.is_active ? 'default' : 'secondary'">
                {{ row.is_active ? 'active' : 'off' }}
              </Badge>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  :tooltip="row.is_active ? 'Деактивировать' : 'Активировать'"
                  :icon="row.is_active ? UserX : UserCheck"
                  :disabled="busyId === row.id"
                  @click="patchUser(row.id, { is_active: !row.is_active })"
                />
                <AdminConfirmDelete
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
