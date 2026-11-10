<script setup lang="ts">
import { Eye, EyeOff, Pencil, Plus, Power } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const q = ref('')
const page = ref(1)

interface Row {
  id: string
  title: string
  title_ru: string | null
  promo_code: string | null
  status: string
  published: boolean
  casino_slug: string
  casino_name: string
  wager: string | null
}

interface ListRes { items: Row[], total: number }

const { data, pending, refresh } = await useAsyncData(
  'admin-bonuses',
  () => api<ListRes>('/v1/admin/bonuses', { query: { q: q.value || undefined, page: page.value, limit: 20 } }),
  { watch: [page] },
)

async function search() {
  page.value = 1
  await refresh()
}

async function patch(id: string, body: Record<string, unknown>) {
  await api(`/v1/admin/bonuses/${id}`, { method: 'PATCH', body })
  await refresh()
}

const busyId = ref<string | null>(null)

async function removeBonus(id: string) {
  busyId.value = id
  try {
    await api(`/v1/admin/bonuses/${id}`, { method: 'DELETE' })
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
          Бонусы
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ data?.total ?? 0 }} записей
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminSectionHelp section="bonuses" />
        <Button as-child size="sm">
          <NuxtLink to="/admin/bonuses/new">
            <Plus class="size-4" />
            Добавить
          </NuxtLink>
        </Button>
      </div>
    </div>

    <form class="flex flex-wrap gap-2" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Название / промо / казино" />
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
              Бонус
            </th>
            <th class="px-3 py-2 font-medium">
              Казино
            </th>
            <th class="px-3 py-2 font-medium">
              Промо
            </th>
            <th class="px-3 py-2 font-medium">
              Статус
            </th>
            <th class="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items || []" :key="row.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.title_ru || row.title }}
              </div>
              <div class="text-xs text-muted-foreground">
                wager {{ row.wager || '—' }}
              </div>
            </td>
            <td class="px-3 py-2">
              {{ row.casino_name }}
              <div class="text-xs text-muted-foreground">
                {{ row.casino_slug }}
              </div>
            </td>
            <td class="px-3 py-2 font-mono text-xs">
              {{ row.promo_code || '—' }}
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.status === 'active' && row.published ? 'default' : 'secondary'">
                {{ row.status }}{{ row.published ? '' : ' · unpublished' }}
              </Badge>
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center justify-end gap-0.5">
                <AdminIconButton
                  :tooltip="row.published ? 'Скрыть с сайта' : 'Показать на сайте'"
                  :icon="row.published ? EyeOff : Eye"
                  @click="patch(row.id, { published: !row.published })"
                />
                <AdminIconButton
                  :tooltip="row.status === 'active' ? 'Деактивировать' : 'Активировать'"
                  :icon="Power"
                  @click="patch(row.id, { status: row.status === 'active' ? 'hidden' : 'active' })"
                />
                <AdminIconButton
                  tooltip="Редактировать"
                  :icon="Pencil"
                  :to="`/admin/bonuses/${row.id}`"
                />
                <AdminConfirmDelete
                  entity="бонус"
                  :label="row.title_ru || row.title"
                  :busy="busyId === row.id"
                  @confirm="removeBonus(row.id)"
                />
              </div>
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
      <Button size="sm" variant="outline" :disabled="page * 20 >= (data?.total || 0)" @click="page++">
        Далее
      </Button>
    </div>
  </div>
</template>
