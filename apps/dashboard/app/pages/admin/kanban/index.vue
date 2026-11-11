<script setup lang="ts">
import type { AdminTone } from '~/components/admin/ui/types'
import type { KanbanBoard } from '~/composables/useKanban'
import { AlertTriangle, Kanban, ListTodo } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const { listBoards, createBoard, patchBoard, deleteBoard, myCards, notifications, readNotifications } = useKanban()

const tab = ref<'boards' | 'mine'>('boards')
const showArchived = ref(false)
const creating = ref(false)
const form = reactive({ title: '', description: '', color: '#0f6e56' })
const busy = ref(false)
const err = ref<string | null>(null)

const { data, pending, refresh } = await useAsyncData(
  () => `kanban-boards-${showArchived.value}`,
  () => listBoards(showArchived.value),
  { watch: [showArchived] },
)

const { data: mine, refresh: refreshMine } = await useAsyncData('kanban-my-cards', () => myCards())
const { data: notif, refresh: refreshNotif } = await useAsyncData('kanban-notif', () => notifications(true))

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const overdueMine = computed(() =>
  (mine.value?.items || []).filter((c) => {
    if (!c.dueAt)
      return false
    return new Date(c.dueAt).getTime() < Date.now()
  }).length,
)

const totalCards = computed(() =>
  (data.value?.items || []).reduce((sum, b) => sum + (b.cardsCount || 0), 0),
)

const kpiCards = computed(() => [
  { label: 'Досок', value: data.value?.items?.length ?? 0, hint: showArchived.value ? 'с архивом' : 'активные', tone: 'violet' as AdminTone, icon: Kanban },
  { label: 'Карточек', value: totalCards.value, hint: 'на досках', tone: 'cyan' as AdminTone, icon: ListTodo },
  { label: 'Мои задачи', value: mine.value?.items?.length ?? 0, hint: 'назначенные вам', tone: 'amber' as AdminTone, icon: ListTodo },
  { label: 'Просрочено', value: overdueMine.value, hint: 'среди моих', tone: 'rose' as AdminTone, icon: AlertTriangle },
])

function progress(b: KanbanBoard) {
  const total = b.cardsCount || 0
  if (!total)
    return 0
  // doneApprox not always available — use columns heuristic if present
  const done = (b as KanbanBoard & { doneCount?: number }).doneCount
  if (typeof done === 'number')
    return Math.round((done / total) * 100)
  return Math.min(100, Math.round(((b.columnsCount || 1) / Math.max(1, total)) * 20))
}

async function create() {
  if (!form.title.trim())
    return
  busy.value = true
  err.value = null
  try {
    const res = await createBoard({
      title: form.title.trim(),
      description: form.description || undefined,
      color: form.color,
    })
    creating.value = false
    form.title = ''
    form.description = ''
    await refresh()
    await navigateTo(`/admin/kanban/${res.item.id}`)
  }
  catch {
    err.value = 'Не удалось создать доску'
  }
  finally {
    busy.value = false
  }
}

async function archive(board: KanbanBoard, archived: boolean) {
  await patchBoard(board.id, { archived })
  await refresh()
}

async function remove(board: KanbanBoard) {
  await deleteBoard(board.id)
  await refresh()
}

async function markNotifRead() {
  await readNotifications()
  await refreshNotif()
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Канбан"
      description="Доски задач · только admin / developer"
      help="kanban"
    >
      <template #actions>
        <Button size="sm" @click="creating = !creating">
          {{ creating ? 'Отмена' : 'Новая доска' }}
        </Button>
      </template>
    </AdminPageHeader>

    <AdminUiAdminStatGrid>
      <AdminUiAdminStatCard
        v-for="(card, i) in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :hint="card.hint"
        :icon="card.icon"
        :tone="card.tone"
        :ready="ready"
        :index="i"
      />
    </AdminUiAdminStatGrid>

    <div
      v-if="notif?.items?.length"
      class="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <strong>Уведомления ({{ notif.items.length }})</strong>
        <Button size="sm" variant="ghost" @click="markNotifRead">
          Прочитать все
        </Button>
      </div>
      <ul class="space-y-1">
        <li v-for="n in notif.items.slice(0, 5)" :key="n.id">
          <NuxtLink
            v-if="n.boardId"
            class="hover:underline"
            :to="`/admin/kanban/${n.boardId}${n.cardId ? `?card=${n.cardId}` : ''}`"
          >
            {{ n.title }}
          </NuxtLink>
          <span v-else>{{ n.title }}</span>
        </li>
      </ul>
    </div>

    <div class="inline-flex rounded-xl border bg-card/40 p-1">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === 'boards' ? 'bg-foreground text-background' : 'text-muted-foreground'"
        @click="tab = 'boards'; refresh()"
      >
        Доски
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === 'mine' ? 'bg-foreground text-background' : 'text-muted-foreground'"
        @click="tab = 'mine'; refreshMine()"
      >
        Мои задачи
      </button>
    </div>

    <div v-if="creating" class="space-y-3 rounded-2xl border bg-card/40 p-4">
      <Input v-model="form.title" placeholder="Название доски" />
      <Textarea v-model="form.description" placeholder="Описание (опционально)" rows="2" />
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted-foreground">Цвет</label>
        <input v-model="form.color" type="color" class="h-9 w-12 cursor-pointer rounded border bg-transparent">
        <Button :disabled="busy || !form.title.trim()" @click="create">
          Создать
        </Button>
      </div>
      <p v-if="err" class="text-sm text-destructive">
        {{ err }}
      </p>
    </div>

    <template v-if="tab === 'boards'">
      <AdminCheckbox v-model:checked="showArchived" label-class="text-muted-foreground">
        Показать архив
      </AdminCheckbox>

      <AdminCardsSkeleton v-if="pending && !data" />
      <AdminUiAdminEmptyState
        v-else-if="!data?.items?.length"
        title="Пока нет досок"
        description="Создайте первую доску"
        :icon="Kanban"
      >
        <Button size="sm" class="mt-2" @click="creating = true">
          Новая доска
        </Button>
      </AdminUiAdminEmptyState>
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="b in data.items"
          :key="b.id"
          class="group relative overflow-hidden rounded-2xl border bg-card transition hover:shadow-md"
        >
          <div class="h-1.5" :style="{ background: b.color }" />
          <div class="space-y-3 p-4">
            <div>
              <NuxtLink :to="`/admin/kanban/${b.id}`" class="text-lg font-semibold hover:underline">
                {{ b.title }}
              </NuxtLink>
              <p v-if="b.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {{ b.description }}
              </p>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ b.columnsCount ?? 0 }} кол. · {{ b.cardsCount ?? 0 }} карт.</span>
                <span class="tabular-nums">{{ progress(b) }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{ width: `${progress(b)}%`, background: b.color }"
                />
              </div>
            </div>
            <div class="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
              <Button
                v-if="!showArchived"
                size="sm"
                variant="ghost"
                @click="archive(b, true)"
              >
                Архив
              </Button>
              <Button
                v-else
                size="sm"
                variant="ghost"
                @click="archive(b, false)"
              >
                Вернуть
              </Button>
              <AdminConfirmDelete
                entity="доску"
                :label="b.title"
                mode="button"
                @confirm="remove(b)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <AdminUiAdminEmptyState
        v-if="!mine?.items?.length"
        title="Нет назначенных задач"
        description="Карточки появятся, когда вас назначат исполнителем"
        :icon="ListTodo"
      />
      <ul v-else class="divide-y overflow-hidden rounded-2xl border">
        <li
          v-for="c in mine.items"
          :key="c.id"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
        >
          <div>
            <NuxtLink class="font-medium hover:underline" :to="`/admin/kanban/${c.boardId}?card=${c.id}`">
              {{ c.title }}
            </NuxtLink>
            <div class="text-xs text-muted-foreground">
              {{ c.boardTitle }} · {{ c.columnTitle }}
              <span
                v-if="c.dueAt"
                :class="new Date(c.dueAt).getTime() < Date.now() ? 'text-rose-600 dark:text-rose-400' : ''"
              >
                · до {{ new Date(c.dueAt).toLocaleDateString('ru-RU') }}
              </span>
            </div>
          </div>
          <Badge variant="outline">
            {{ c.priority }}
          </Badge>
        </li>
      </ul>
    </template>
  </div>
</template>
