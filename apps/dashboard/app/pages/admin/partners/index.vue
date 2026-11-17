<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { Handshake, MousePointerClick, Plus, ShieldCheck, Unplug } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { api } = useApi()

interface Row {
  id: string
  email: string
  display_name: string | null
  is_active: boolean
  created_at: string
  cabinet_open: boolean
  casino_id: string | null
  casino_slug: string | null
  casino_name: string | null
  casino_status: string | null
  revshare_rate: number | null
  hot: boolean
  badge_pending: boolean
  has_representative: boolean
  clicks_30d: number
  bonuses_published: number
}

interface ListRes {
  items: Row[]
  total: number
  summary: {
    total: number
    active: number
    cabinet_open: number
    hot: number
    badge_pending: number
    clicks_30d: number
  }
}

const q = ref('')
const filter = ref('')
const page = ref(1)
const creating = ref(false)
const createBusy = ref(false)
const createForm = reactive({
  email: '',
  password: '',
  display_name: '',
  casino_slug: '',
})

const { data: casinos } = await useAsyncData(
  'admin-partners-casinos',
  () => api<{ items: Array<{ slug: string, name: string, name_ru?: string | null }> }>('/v1/admin/casinos', {
    query: { limit: 100, sort: 'name' },
  }),
)

const casinoOptions = computed(() =>
  (casinos.value?.items || []).map(c => ({
    value: c.slug,
    label: `${c.name_ru || c.name} (${c.slug})`,
  })),
)

const listKey = computed(() => `admin-partners-${page.value}-${filter.value}-${q.value}`)

const { data, pending, refresh, error } = await useAsyncData(
  listKey,
  () => api<ListRes>('/v1/admin/partners', {
    query: {
      q: q.value || undefined,
      filter: filter.value || undefined,
      page: page.value,
      limit: 30,
    },
  }),
  { watch: [page, filter] },
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

const kpiCards = computed(() => {
  const s = data.value?.summary
  return [
    { label: 'Партнёры', value: s?.total ?? 0, hint: `${s?.active ?? 0} активных`, tone: 'violet' as AdminTone, icon: Handshake },
    { label: 'Кабинет открыт', value: s?.cabinet_open ?? 0, hint: 'есть RevShare', tone: 'emerald' as AdminTone, icon: Unplug },
    { label: 'Клики 30д', value: s?.clicks_30d ?? 0, hint: 'по казино партнёров', tone: 'cyan' as AdminTone, icon: MousePointerClick },
    { label: 'Бейдж / HOT', value: s?.badge_pending ?? 0, hint: `${s?.hot ?? 0} в HOT`, tone: 'amber' as AdminTone, icon: ShieldCheck },
  ]
})

function fmtRate(v: number | null) {
  if (v == null)
    return '—'
  return `${v}%`
}

async function createPartner() {
  createBusy.value = true
  try {
    const created = await api<{ item: Row }>('/v1/admin/partners', {
      method: 'POST',
      body: {
        email: createForm.email.trim(),
        password: createForm.password,
        display_name: createForm.display_name.trim() || undefined,
        casino_slug: createForm.casino_slug,
      },
    })
    toast.success('Партнёр создан')
    creating.value = false
    createForm.email = ''
    createForm.password = ''
    createForm.display_name = ''
    createForm.casino_slug = ''
    await navigateTo(`/admin/partners/${created.item.id}`)
  }
  catch (err: unknown) {
    const code = (err as { data?: { error?: string } }).data?.error
    if (code === 'email_taken')
      toast.error('Email уже занят')
    else if (code === 'casino_has_partner')
      toast.error('У казино уже есть активный партнёр')
    else if (code === 'unknown_casino')
      toast.error('Казино не найдено')
    else
      toast.error('Не удалось создать')
  }
  finally {
    createBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Партнёры"
      :description="`${data?.total ?? 0} кабинетов · ставка, клики, HOT, бейдж`"
      help="partners"
    >
      <template #actions>
        <Button size="sm" @click="creating = true">
          <Plus class="size-4" />
          Создать партнёра
        </Button>
      </template>
    </AdminPageHeader>

    <div v-if="error" class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Не удалось загрузить партнёров
    </div>

    <AdminUiAdminStatGrid v-else :cols="4">
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

    <form class="flex flex-wrap gap-2 rounded-2xl border bg-card/40 p-3" @submit.prevent="search">
      <Input v-model="q" class="max-w-sm" placeholder="Email / казино" />
      <AdminSelect
        class="w-[200px]"
        :model-value="filter"
        :options="[
          { value: '', label: 'Все' },
          { value: 'open', label: 'Кабинет открыт' },
          { value: 'closed', label: 'Без RevShare' },
          { value: 'hot', label: 'HOT' },
          { value: 'badge', label: 'Ждут бейдж' },
          { value: 'inactive', label: 'Неактивные' },
        ]"
        @update:model-value="(v) => { filter = String(v ?? ''); search() }"
      />
      <Button type="submit" variant="secondary" :disabled="pending">
        Найти
      </Button>
    </form>

    <AdminTableSkeleton v-if="pending && !data" :cols="7" />
    <div v-else class="overflow-x-auto rounded-2xl border">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr class="text-xs uppercase tracking-wide text-muted-foreground">
            <th class="px-3 py-2.5 font-medium">
              Партнёр
            </th>
            <th class="px-3 py-2.5 font-medium">
              Казино
            </th>
            <th class="px-3 py-2.5 font-medium">
              Ставка
            </th>
            <th class="px-3 py-2.5 font-medium">
              Клики 30д
            </th>
            <th class="px-3 py-2.5 font-medium">
              Кабинет
            </th>
            <th class="px-3 py-2.5 font-medium">
              Статус
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data?.items || []"
            :key="row.id"
            class="cursor-pointer border-t transition-colors hover:bg-muted/40"
            style="height: 52px"
            @click="navigateTo(`/admin/partners/${row.id}`)"
          >
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ row.display_name || '—' }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ row.email }}
              </div>
            </td>
            <td class="px-3 py-2">
              <div>{{ row.casino_name || '—' }}</div>
              <div class="text-xs text-muted-foreground">
                {{ row.casino_slug || 'нет привязки' }}
              </div>
            </td>
            <td class="px-3 py-2">
              {{ fmtRate(row.revshare_rate) }}
            </td>
            <td class="px-3 py-2 tabular-nums">
              {{ row.clicks_30d }}
            </td>
            <td class="px-3 py-2">
              <Badge :variant="row.cabinet_open ? 'default' : 'outline'" class="font-normal">
                {{ row.cabinet_open ? 'открыт' : 'гейт' }}
              </Badge>
            </td>
            <td class="px-3 py-2">
              <div class="flex flex-wrap gap-1">
                <Badge v-if="!row.is_active" variant="outline" class="font-normal text-muted-foreground">
                  off
                </Badge>
                <Badge v-if="row.hot" variant="outline" class="font-normal text-amber-700 dark:text-amber-400">
                  HOT
                </Badge>
                <Badge v-if="row.badge_pending" variant="outline" class="font-normal text-rose-700 dark:text-rose-400">
                  бейдж
                </Badge>
                <Badge v-else-if="row.has_representative" variant="outline" class="font-normal">
                  представитель
                </Badge>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!(data?.items || []).length" class="px-3 py-8 text-center text-sm text-muted-foreground">
        Партнёров нет
      </p>
    </div>

    <Dialog :open="creating" @update:open="(v) => { if (!v) creating = false }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Новый партнёр
          </DialogTitle>
        </DialogHeader>
        <form class="grid gap-3" @submit.prevent="createPartner">
          <div class="grid gap-2">
            <Label>Email</Label>
            <Input v-model="createForm.email" type="email" required autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label>Пароль</Label>
            <Input v-model="createForm.password" type="password" required minlength="8" autocomplete="new-password" />
          </div>
          <div class="grid gap-2">
            <Label>Имя</Label>
            <Input v-model="createForm.display_name" />
          </div>
          <div class="grid gap-2">
            <Label>Казино</Label>
            <AdminSelect
              :model-value="createForm.casino_slug"
              :options="casinoOptions"
              placeholder="Выберите казино"
              @update:model-value="(v) => { createForm.casino_slug = String(v ?? '') }"
            />
          </div>
          <Button type="submit" :disabled="createBusy || !createForm.casino_slug">
            {{ createBusy ? 'Создание…' : 'Создать' }}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
