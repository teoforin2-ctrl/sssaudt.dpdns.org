<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const status = ref('approved')
const page = ref(1)
const replyDraft = ref<Record<string, string>>({})
const busyId = ref<string | null>(null)

interface Review {
  id: string
  rating: number
  body: string
  status: string
  author_name: string | null
  created_at: string
  reward_group: string | null
  reward_amount_usd: string | null
  ai_quality_score: number | null
  reply: { id: string, body: string, updatedAt: string } | null
}

const { data, pending, refresh } = await useAsyncData(
  'partner-reviews',
  () =>
    api<{ items: Review[], total: number, page: number }>('/v1/partner/reviews', {
      query: {
        status: status.value || undefined,
        page: page.value,
        limit: 20,
      },
    }),
  { watch: [status, page] },
)

watch(data, (res) => {
  for (const r of res?.items || []) {
    if (replyDraft.value[r.id] == null)
      replyDraft.value[r.id] = r.reply?.body || ''
  }
}, { immediate: true })

async function saveReply(id: string) {
  const body = (replyDraft.value[id] || '').trim()
  if (!body)
    return
  busyId.value = id
  try {
    await api(`/v1/partner/reviews/${id}/reply`, { method: 'PUT', body: { body } })
    await refresh()
  }
  finally {
    busyId.value = null
  }
}

async function removeReply(id: string) {
  busyId.value = id
  try {
    await api(`/v1/partner/reviews/${id}/reply`, { method: 'DELETE' })
    replyDraft.value[id] = ''
    await refresh()
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        Отзывы казино
      </h1>
      <p class="text-sm text-muted-foreground">
        Можно отвечать на approved-отзывы от имени представителя. Модерация — у редакции.
      </p>
    </div>

    <div class="flex gap-2">
      <select
        v-model="status"
        class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
        @change="page = 1"
      >
        <option value="">
          Все
        </option>
        <option value="approved">
          approved
        </option>
        <option value="pending">
          pending
        </option>
        <option value="rejected">
          rejected
        </option>
      </select>
      <Button variant="secondary" :disabled="pending" @click="refresh">
        Обновить
      </Button>
    </div>

    <div v-if="pending && !data" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-16 w-full rounded-xl" />
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="r in data?.items || []"
        :key="r.id"
        class="space-y-3 rounded-xl border p-4"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="font-semibold">★ {{ r.rating }}</span>
          <Badge variant="secondary">
            {{ r.status }}
          </Badge>
          <span v-if="r.reward_group" class="text-xs text-muted-foreground">AB {{ r.reward_group }}</span>
          <span class="ml-auto text-xs text-muted-foreground">{{ r.author_name || 'аноним' }}</span>
        </div>
        <p class="whitespace-pre-wrap text-sm">
          {{ r.body }}
        </p>

        <div v-if="r.status === 'approved'" class="space-y-2 rounded-lg bg-muted/40 p-3">
          <div class="text-xs font-medium text-muted-foreground">
            Ответ представителя
          </div>
          <Textarea v-model="replyDraft[r.id]" rows="3" placeholder="Официальный ответ…" />
          <div class="flex gap-2">
            <Button size="sm" :disabled="busyId === r.id" @click="saveReply(r.id)">
              {{ r.reply ? 'Обновить ответ' : 'Опубликовать ответ' }}
            </Button>
            <Button
              v-if="r.reply"
              size="sm"
              variant="outline"
              :disabled="busyId === r.id"
              @click="removeReply(r.id)"
            >
              Удалить ответ
            </Button>
          </div>
        </div>
      </div>
      <p v-if="!(data?.items?.length)" class="py-8 text-center text-sm text-muted-foreground">
        Нет отзывов
      </p>
    </div>
  </div>
</template>
