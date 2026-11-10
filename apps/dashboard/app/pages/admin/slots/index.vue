<script setup lang="ts">
import { Eye, EyeOff, Pencil, Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const q = ref('')
const page = ref(1)

interface Row {
  id: string
  slug: string
  title: string
  theme: string
  volatility: string
  rtp: string | null
  status: string
  provider_name: string | null
}

interface ListRes { items: Row[], total: number }

const { data, pending, refresh } = await useAsyncData(
  'admin-slots',
  () => api<ListRes>('/v1/admin/slots', { query: { q: q.value || undefined, page: page.value, limit: 20 } }),
  { watch: [page] },
)

async function search() {
  page.value = 1
  await refresh()
}

async function togglePublish(row: Row) {
  await api(`/v1/admin/slots/${row.id}`, {
    method: 'PATCH',
    body: { status: row.status === 'published' ? 'draft' : 'published' },
  })
  await refresh()
}

const busyId = ref<string | null>(null)

async function removeSlot(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/slots/${id}`, { method: 'DELETE' })
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
          Слоты
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} записей
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminSectionHelp section="slots" />
        <Button as-child size="sm">
          <NuxtLink to="/admin/slots/new">
            <Plus class="size-4" />
            Добавить
          </NuxtLink>
        </Button>
      </div>
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Название / slug" />
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
              Слот
            </th>
            <th class="px-3 py-2 font-medium">
              Провайдер
            </th>
            <th class="px-3 py-2 font-medium">
              RTP
            </th>
            <th class="px-3 py-2 font-medium">
              Показ
            </th>
            <th class="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items || []" :key="row.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.title }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ row.slug }} · {{ row.theme }} · {{ row.volatility }}
              </div>
            </td>
            <td class="px-3 py-2">
              {{ row.provider_name || '—' }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ row.rtp || '—' }}
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.status === 'published' ? 'default' : 'secondary'">
                {{ row.status === 'published' ? 'на сайте' : row.status }}
              </Badge>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  :tooltip="row.status === 'published' ? 'Скрыть с сайта' : 'Показать на сайте'"
                  :icon="row.status === 'published' ? EyeOff : Eye"
                  @click="togglePublish(row)"
                />
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  :to="`/admin/slots/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="слот"
                  :label="row.title"
                  :busy="busyId === row.id"
                  @confirm="removeSlot(row.id)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!pending && !(data?.items?.length)">
            <td colspan="5" class="px-3 py-8 text-center text-muted-foreground">
              Ничего не найдено
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="(data?.total || 0) > 20" class="flex gap-2">
      <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">
        Назад
      </Button>
      <span class="text-sm self-center text-muted-foreground">стр. {{ page }}</span>
      <Button
        size="sm"
        variant="outline"
        :disabled="page * 20 >= (data?.total || 0)"
        @click="page++"
      >
        Далее
      </Button>
    </div>

  </div>
</template>
