<script setup lang="ts">
import type { KanbanBoard } from '~/composables/useKanban'

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
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Канбан
        </h1>
        <p class="text-sm text-muted-foreground">
          Доски задач · только admin / developer
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AdminSectionHelp section="kanban" />
        <Button variant="outline" size="sm" @click="tab = 'boards'; refresh()">
          Доски
        </Button>
        <Button variant="outline" size="sm" @click="tab = 'mine'; refreshMine()">
          Мои задачи
        </Button>
        <Button size="sm" @click="creating = !creating">
          {{ creating ? 'Отмена' : 'Новая доска' }}
        </Button>
      </div>
    </div>

    <div
      v-if="notif?.items?.length"
      class="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
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

    <div v-if="creating" class="space-y-3 rounded-xl border p-4">
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
      <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input v-model="showArchived" type="checkbox" class="accent-primary">
        Показать архив
      </label>

      <AdminCardsSkeleton v-if="pending && !data" />
      <div v-else-if="!data?.items?.length" class="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Пока нет досок. Создайте первую.
      </div>
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="b in data.items"
          :key="b.id"
          class="group relative overflow-hidden rounded-xl border bg-card transition hover:shadow-md"
        >
          <div class="h-2" :style="{ background: b.color }" />
          <div class="space-y-3 p-4">
            <div>
              <NuxtLink :to="`/admin/kanban/${b.id}`" class="text-lg font-semibold hover:underline">
                {{ b.title }}
              </NuxtLink>
              <p v-if="b.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {{ b.description }}
              </p>
            </div>
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>{{ b.columnsCount ?? 0 }} кол. · {{ b.cardsCount ?? 0 }} карт.</span>
              <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
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
      </div>
    </template>

    <template v-else>
      <div v-if="!mine?.items?.length" class="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Нет назначенных задач
      </div>
      <ul v-else class="divide-y rounded-xl border">
        <li
          v-for="c in mine.items"
          :key="c.id"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
        >
          <div>
            <NuxtLink class="font-medium hover:underline" :to="`/admin/kanban/${c.boardId}?card=${c.id}`">
              {{ c.title }}
            </NuxtLink>
            <div class="text-xs text-muted-foreground">
              {{ c.boardTitle }} · {{ c.columnTitle }}
              <span v-if="c.dueAt"> · до {{ new Date(c.dueAt).toLocaleDateString() }}</span>
            </div>
          </div>
          <Badge variant="secondary">
            {{ c.priority }}
          </Badge>
        </li>
      </ul>
    </template>
  </div>
</template>
