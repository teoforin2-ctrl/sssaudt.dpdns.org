<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface PartnerMe {
  user: { email: string, role: string, casinoId: string | null }
  casino: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    descriptionRu: string | null
    descriptionEn: string | null
    status: string
    hasRepresentative: boolean
    representativeRequestedAt: string | null
    rating: number | null
    editorialScore: number | null
    playerScore: number | null
  } | null
  counts: { bonuses: number, reviews: number, pendingReviews: number }
}

const { data, pending, error, refresh } = await useAsyncData('partner-me', () => api<PartnerMe>('/v1/partner/me'))

const requesting = ref(false)
const savingProfile = ref(false)
const msg = ref<string | null>(null)
const profile = reactive({
  logoUrl: '',
  descriptionRu: '',
  descriptionEn: '',
})

watch(
  () => data.value?.casino,
  (casino) => {
    if (!casino)
      return
    profile.logoUrl = casino.logoUrl || ''
    profile.descriptionRu = casino.descriptionRu || ''
    profile.descriptionEn = casino.descriptionEn || ''
  },
  { immediate: true },
)

async function saveProfile() {
  savingProfile.value = true
  msg.value = null
  try {
    await api('/v1/partner/casino', {
      method: 'PATCH',
      body: {
        logoUrl: profile.logoUrl.trim() || null,
        descriptionRu: profile.descriptionRu.trim() || null,
        descriptionEn: profile.descriptionEn.trim() || null,
      },
    })
    msg.value = 'Профиль казино сохранён'
    await refresh()
  }
  catch {
    msg.value = 'Не удалось сохранить профиль'
  }
  finally {
    savingProfile.value = false
  }
}

async function requestBadge() {
  requesting.value = true
  msg.value = null
  try {
    await api('/v1/partner/representative/request', { method: 'POST' })
    msg.value = 'Заявка отправлена. Админ подтвердит бейдж вручную.'
    await refresh()
  }
  catch {
    msg.value = 'Не удалось отправить заявку'
  }
  finally {
    requesting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        Partner кабинет
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ user?.email }} · {{ user?.role }}
      </p>
    </div>

    <div v-if="error" class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
      Не удалось загрузить кабинет. Проверьте, что аккаунт привязан к казино.
    </div>

    <div v-else-if="pending && !data" class="space-y-2">
      <Skeleton class="h-24 w-full rounded-xl" />
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <template v-else-if="data?.casino">
      <div class="rounded-xl border p-4 flex flex-wrap gap-4 items-center">
        <img
          v-if="data.casino.logoUrl"
          :src="data.casino.logoUrl.startsWith('http') ? data.casino.logoUrl : `http://127.0.0.1:3710${data.casino.logoUrl}`"
          alt=""
          class="h-12 w-12 rounded-lg object-contain bg-muted"
        >
        <div class="min-w-0">
          <h2 class="text-lg font-semibold">
            {{ data.casino.name }}
          </h2>
          <p class="text-sm text-muted-foreground">
            /{{ data.casino.slug }} · статус {{ data.casino.status }}
          </p>
        </div>
        <Badge v-if="data.casino.hasRepresentative" class="ml-auto">
          Официальный представитель
        </Badge>
        <Badge v-else-if="data.casino.representativeRequestedAt" variant="secondary" class="ml-auto">
          Заявка на бейдж отправлена
        </Badge>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border p-4">
          <p class="text-xs uppercase text-muted-foreground">
            Бонусы
          </p>
          <p class="mt-1 text-2xl font-bold tabular-nums">
            {{ data.counts.bonuses }}
          </p>
          <NuxtLink class="text-sm underline" to="/partner/bonuses">
            Управление
          </NuxtLink>
        </div>
        <div class="rounded-xl border p-4">
          <p class="text-xs uppercase text-muted-foreground">
            Отзывы
          </p>
          <p class="mt-1 text-2xl font-bold tabular-nums">
            {{ data.counts.reviews }}
          </p>
          <NuxtLink class="text-sm underline" to="/partner/reviews">
            Смотреть
          </NuxtLink>
        </div>
        <div class="rounded-xl border p-4">
          <p class="text-xs uppercase text-muted-foreground">
            Рейтинг
          </p>
          <p class="mt-1 text-2xl font-bold tabular-nums">
            {{ data.casino.rating ?? '—' }}
          </p>
          <p class="text-xs text-muted-foreground">
            ред. {{ data.casino.editorialScore ?? '—' }} · игроки {{ data.casino.playerScore ?? '—' }}
          </p>
        </div>
      </div>

      <div class="rounded-xl border p-4 space-y-3">
        <div>
          <h3 class="font-medium">
            Описание и лого
          </h3>
          <p class="text-sm text-muted-foreground">
            Платежки пока только через CMS. Здесь — публичное описание и URL логотипа.
          </p>
        </div>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">Logo URL</span>
          <Input v-model="profile.logoUrl" placeholder="https://… или /uploads/…" />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">Описание (RU)</span>
          <textarea
            v-model="profile.descriptionRu"
            rows="4"
            class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">Description (EN)</span>
          <textarea
            v-model="profile.descriptionEn"
            rows="4"
            class="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <Button :disabled="savingProfile" @click="saveProfile">
          {{ savingProfile ? 'Сохраняю…' : 'Сохранить профиль' }}
        </Button>
      </div>

      <div v-if="!data?.casino?.hasRepresentative" class="rounded-xl border p-4 space-y-2">
        <h3 class="font-medium">
          Бейдж «Официальный представитель»
        </h3>
        <p class="text-sm text-muted-foreground">
          После заявки главный админ подтверждает бейдж в карточке казино.
        </p>
        <Button
          :disabled="requesting || !!data?.casino?.representativeRequestedAt"
          @click="requestBadge"
        >
          {{ data?.casino?.representativeRequestedAt ? 'Заявка уже отправлена' : 'Запросить бейдж' }}
        </Button>
        <p v-if="msg" class="text-sm text-muted-foreground">
          {{ msg }}
        </p>
      </div>
    </template>

    <div v-else class="rounded-xl border p-4 text-sm text-muted-foreground">
      К аккаунту не привязано казино. Попросите админа указать <code>casino_slug</code> в /admin/users.
    </div>
  </div>
</template>
