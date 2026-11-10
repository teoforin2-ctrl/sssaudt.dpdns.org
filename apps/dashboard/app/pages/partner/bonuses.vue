<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()

interface Bonus {
  id: string
  title: string
  title_ru: string | null
  promo_code: string | null
  type: string | null
  amount_or_percent: string | null
  wager: string | null
  status: string
  published: boolean
}

const { data, pending, refresh } = await useAsyncData('partner-bonuses', () => api<{ items: Bonus[] }>('/v1/partner/bonuses'))

const form = reactive({
  title: '',
  promo_code: '',
  type: '',
  amount_or_percent: '',
  wager: '',
})
const creating = ref(false)
const err = ref<string | null>(null)

async function createBonus() {
  if (!form.title.trim())
    return
  creating.value = true
  err.value = null
  try {
    await api('/v1/partner/bonuses', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        promo_code: form.promo_code || null,
        type: form.type || null,
        amount_or_percent: form.amount_or_percent || null,
        wager: form.wager || null,
      },
    })
    form.title = ''
    form.promo_code = ''
    form.type = ''
    form.amount_or_percent = ''
    form.wager = ''
    await refresh()
  }
  catch {
    err.value = 'Не удалось создать бонус'
  }
  finally {
    creating.value = false
  }
}

async function patch(id: string, body: Record<string, unknown>) {
  await api(`/v1/partner/bonuses/${id}`, { method: 'PATCH', body })
  await refresh()
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        Бонусы казино
      </h1>
      <p class="text-sm text-muted-foreground">
        Новые бонусы создаются скрытыми — опубликуйте после проверки.
      </p>
    </div>

    <form class="rounded-xl border p-4 grid gap-2 sm:grid-cols-2" @submit.prevent="createBonus">
      <Input v-model="form.title" placeholder="Название *" required />
      <Input v-model="form.promo_code" placeholder="Промокод" />
      <Input v-model="form.type" placeholder="Тип" />
      <Input v-model="form.amount_or_percent" placeholder="Сумма / %" />
      <Input v-model="form.wager" placeholder="Вейджер" />
      <Button type="submit" :disabled="creating">
        Добавить
      </Button>
      <p v-if="err" class="sm:col-span-2 text-sm text-destructive">
        {{ err }}
      </p>
    </form>

    <div v-if="pending && !data" class="space-y-2">
      <Skeleton v-for="n in 4" :key="n" class="h-12 w-full rounded-xl" />
    </div>
    <div v-else class="rounded-xl border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-left">
          <tr>
            <th class="px-3 py-2">
              Бонус
            </th>
            <th class="px-3 py-2">
              Промо
            </th>
            <th class="px-3 py-2">
              Статус
            </th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in data?.items || []" :key="b.id" class="border-t">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ b.title_ru || b.title }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ b.type || '—' }} · {{ b.amount_or_percent || '—' }}
              </div>
            </td>
            <td class="px-3 py-2 font-mono text-xs">
              {{ b.promo_code || '—' }}
            </td>
            <td class="px-3 py-2">
              {{ b.status }}{{ b.published ? ' · pub' : '' }}
            </td>
            <td class="px-3 py-2 text-right space-x-1">
              <Button
                size="sm"
                variant="outline"
                @click="patch(b.id, { published: !b.published, status: !b.published ? 'active' : 'hidden' })"
              >
                {{ b.published ? 'Скрыть' : 'Опубликовать' }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
