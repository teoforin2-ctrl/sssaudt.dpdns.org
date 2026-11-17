<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import { Flame, MousePointerClick, ShieldCheck } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const route = useRoute()
const id = computed(() => String(route.params.id))

interface Partner {
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
  hot_until: string | null
  has_representative: boolean
  representative_requested_at: string | null
  badge_pending: boolean
  clicks_7d: number
  clicks_30d: number
  clicks_90d: number
  bonuses_published: number
  reviews_count: number
  final_rating: number | null
  rank: number | null
}

interface DetailRes {
  item: Partner
  bonuses: Array<{ id: string, title: string | null, published: boolean, created_at: string }>
  replies: Array<{ id: string, review_id: string, body: string, updated_at: string, rating: number | null }>
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-partner-${id.value}`,
  () => api<DetailRes>(`/v1/admin/partners/${id.value}`),
)

const displayName = ref('')
const casinoSlug = ref('')
const rate = ref('')
const password = ref('')
const saving = ref(false)
const busy = ref('')

watch(
  () => data.value?.item,
  (item) => {
    if (!item)
      return
    displayName.value = item.display_name || ''
    casinoSlug.value = item.casino_slug || ''
    rate.value = item.revshare_rate == null ? '' : String(item.revshare_rate)
  },
  { immediate: true },
)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const item = computed(() => data.value?.item ?? null)

const kpiCards = computed(() => {
  const p = item.value
  return [
    { label: 'Клики 7д', value: p?.clicks_7d ?? 0, hint: 'go_clicks', tone: 'cyan' as AdminTone, icon: MousePointerClick },
    { label: 'Клики 30д', value: p?.clicks_30d ?? 0, hint: 'go_clicks', tone: 'violet' as AdminTone, icon: MousePointerClick },
    { label: 'Клики 90д', value: p?.clicks_90d ?? 0, hint: 'go_clicks', tone: 'emerald' as AdminTone, icon: MousePointerClick },
  ]
})

function fmtDate(v?: string | null) {
  if (!v)
    return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime()))
    return v
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function patch(body: Record<string, unknown>, ok = 'Сохранено') {
  busy.value = Object.keys(body)[0] || 'save'
  saving.value = true
  try {
    await api(`/v1/admin/partners/${id.value}`, { method: 'PATCH', body })
    toast.success(ok)
    password.value = ''
    await refresh()
  }
  catch (err: unknown) {
    const code = (err as { data?: { error?: string } }).data?.error
    if (code === 'unknown_casino')
      toast.error('Казино не найдено')
    else
      toast.error('Ошибка сохранения')
  }
  finally {
    busy.value = ''
    saving.value = false
  }
}

async function saveProfile() {
  const body: Record<string, unknown> = {
    display_name: displayName.value.trim() || null,
    casino_slug: casinoSlug.value.trim() || null,
    revshare_rate: rate.value === '' ? null : Number(rate.value),
  }
  if (password.value.trim())
    body.password = password.value.trim()
  await patch(body)
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex flex-wrap items-center gap-3">
      <Button as-child variant="ghost" size="sm">
        <NuxtLink to="/admin/partners">
          ← Партнёры
        </NuxtLink>
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ item?.display_name || item?.email || 'Партнёр' }}
      </h1>
      <div class="ml-auto">
        <AdminSectionHelp section="partners" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Партнёр не найден
    </div>

    <template v-else-if="item">
      <div class="flex flex-wrap gap-2 text-sm">
        <Badge :variant="item.cabinet_open ? 'default' : 'outline'">
          {{ item.cabinet_open ? 'Кабинет открыт' : 'Гейт RevShare' }}
        </Badge>
        <Badge v-if="!item.is_active" variant="outline">
          неактивен
        </Badge>
        <Badge v-if="item.hot" variant="outline" class="text-amber-700 dark:text-amber-400">
          HOT{{ item.hot_until ? ` до ${fmtDate(item.hot_until)}` : '' }}
        </Badge>
        <Badge v-if="item.badge_pending" variant="outline" class="text-rose-700 dark:text-rose-400">
          заявка на бейдж
        </Badge>
        <span class="text-muted-foreground">
          {{ item.casino_name || 'без казино' }}
          <template v-if="item.rank">
            · #{{ item.rank }}
          </template>
          <template v-if="item.final_rating != null">
            · {{ item.final_rating }}
          </template>
        </span>
      </div>

      <AdminUiAdminStatGrid :cols="3">
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

      <form class="grid gap-4 rounded-2xl border bg-card/40 p-4 sm:grid-cols-2" @submit.prevent="saveProfile">
        <div class="grid gap-2">
          <Label>Имя</Label>
          <Input v-model="displayName" />
        </div>
        <div class="grid gap-2">
          <Label>Email</Label>
          <Input :model-value="item.email" disabled />
        </div>
        <div class="grid gap-2">
          <Label>Slug казино</Label>
          <Input v-model="casinoSlug" placeholder="casino-slug" />
        </div>
        <div class="grid gap-2">
          <Label>Ставка RevShare %</Label>
          <Input v-model="rate" type="number" min="0" max="100" step="0.1" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label>Новый пароль (необязательно)</Label>
          <Input v-model="password" type="password" minlength="8" autocomplete="new-password" />
        </div>
        <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Switch
            :model-value="item.is_active"
            :disabled="busy === 'is_active'"
            @update:model-value="(v: boolean) => patch({ is_active: v }, v ? 'Активирован' : 'Деактивирован')"
          />
          <span class="text-sm">Активен</span>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </Button>
        </div>
      </form>

      <div class="flex flex-wrap gap-2">
        <Button
          v-if="item.badge_pending"
          variant="secondary"
          size="sm"
          :disabled="busy === 'confirm_representative'"
          @click="patch({ confirm_representative: true }, 'Бейдж подтверждён')"
        >
          <ShieldCheck class="size-4" />
          Подтвердить бейдж
        </Button>
        <Button
          v-if="item.hot"
          variant="outline"
          size="sm"
          :disabled="busy === 'hot'"
          @click="patch({ hot: false }, 'HOT снят')"
        >
          <Flame class="size-4" />
          Снять HOT
        </Button>
        <Button
          v-if="item.cabinet_open"
          variant="outline"
          size="sm"
          :disabled="busy === 'clear_revshare'"
          @click="patch({ clear_revshare: true }, 'RevShare сброшен, кабинет закрыт')"
        >
          Сбросить RevShare
        </Button>
        <Button v-if="item.casino_id" as-child variant="outline" size="sm">
          <NuxtLink :to="`/admin/casinos/${item.casino_id}`">
            Карточка казино
          </NuxtLink>
        </Button>
        <Button as-child variant="ghost" size="sm">
          <NuxtLink to="/partner">
            Кабинет /partner
          </NuxtLink>
        </Button>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border">
          <div class="border-b px-3 py-2 text-sm font-medium">
            Бонусы · {{ item.bonuses_published }} опубликовано
          </div>
          <ul class="divide-y text-sm">
            <li v-for="b in data?.bonuses || []" :key="b.id" class="px-3 py-2">
              <div class="font-medium">
                {{ b.title || '—' }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ b.published ? 'опубликован' : 'черновик' }} · {{ fmtDate(b.created_at) }}
              </div>
            </li>
            <li v-if="!(data?.bonuses || []).length" class="px-3 py-6 text-muted-foreground">
              Бонусов нет
            </li>
          </ul>
        </div>
        <div class="rounded-2xl border">
          <div class="border-b px-3 py-2 text-sm font-medium">
            Ответы на отзывы · отзывов {{ item.reviews_count }}
          </div>
          <ul class="divide-y text-sm">
            <li v-for="r in data?.replies || []" :key="r.id" class="px-3 py-2">
              <div class="line-clamp-2">
                {{ r.body }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ r.rating != null ? `${r.rating}★ · ` : '' }}{{ fmtDate(r.updated_at) }}
              </div>
            </li>
            <li v-if="!(data?.replies || []).length" class="px-3 py-6 text-muted-foreground">
              Ответов нет
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
