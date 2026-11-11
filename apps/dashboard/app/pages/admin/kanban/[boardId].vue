<script setup lang="ts">
import type { KanbanCard, KanbanColumn, KanbanLabel, KanbanSprint, KanbanUser } from '~/composables/useKanban'
import draggable from 'vuedraggable'
import { isOverdue, priorityLabel } from '~/composables/useKanban'

definePageMeta({ layout: 'default' })

const route = useRoute()
const boardId = computed(() => String(route.params.boardId))
const {
  api,
  fullBoard,
  staff: loadStaff,
} = useKanban()

const columns = ref<KanbanColumn[]>([])
const boardTitle = ref('')
const boardColor = ref('#0f6e56')
const labels = ref<KanbanLabel[]>([])
const sprints = ref<KanbanSprint[]>([])
const activity = ref<Array<{ id: string, type: string, actorName?: string, createdAt: string }>>([])
const staff = ref<KanbanUser[]>([])
const pending = ref(true)
const err = ref<string | null>(null)

const view = ref<'board' | 'list'>('board')
const q = ref('')
const filterAssignee = ref('')
const filterLabel = ref('')
const filterPriority = ref('')
const filterSprint = ref('')
const filterMine = ref(false)
const { user } = useAuth()

const openCardId = ref<string | null>(null)
const newColTitle = ref('')
const quickAdd = ref<Record<string, string>>({})
const showSprintForm = ref(false)
const sprintForm = reactive({ name: '', goal: '', startsOn: '', endsOn: '', status: 'planned' as KanbanSprint['status'] })
const showLabelForm = ref(false)
const labelForm = reactive({ name: '', color: '#6b4ea8' })
const renamingCol = ref<string | null>(null)
const renameValue = ref('')
const boardScrollEl = ref<HTMLElement | null>(null)

/** Nested column overflow-y eats trackpad swipes — forward horizontal intent to the board. */
function onBoardWheel(e: WheelEvent) {
  const el = boardScrollEl.value
  if (!el)
    return
  const absX = Math.abs(e.deltaX)
  const absY = Math.abs(e.deltaY)
  if (!(absX > absY || e.shiftKey))
    return
  const dx = (e.shiftKey && absX <= absY) ? e.deltaY : e.deltaX
  if (!dx)
    return
  const prev = el.scrollLeft
  el.scrollLeft += dx
  if (el.scrollLeft !== prev)
    e.preventDefault()
}

watch(boardScrollEl, (el, _prev, onCleanup) => {
  if (!el)
    return
  el.addEventListener('wheel', onBoardWheel, { passive: false })
  onCleanup(() => el.removeEventListener('wheel', onBoardWheel))
})

async function refresh() {
  pending.value = true
  err.value = null
  try {
    const [full, st] = await Promise.all([fullBoard(boardId.value), loadStaff()])
    boardTitle.value = full.board.title
    boardColor.value = full.board.color
    columns.value = full.columns
    labels.value = full.labels
    sprints.value = full.sprints
    activity.value = full.activity
    staff.value = st.items
  }
  catch {
    err.value = 'Не удалось загрузить доску'
  }
  finally {
    pending.value = false
  }
}

await refresh()

watch(
  () => route.query.card,
  (v) => {
    if (v)
      openCardId.value = String(v)
  },
  { immediate: true },
)

function cardVisible(c: KanbanCard) {
  if (q.value && !c.title.toLowerCase().includes(q.value.toLowerCase()) && !(c.description || '').toLowerCase().includes(q.value.toLowerCase()))
    return false
  if (filterAssignee.value && !c.assignees.some(a => a.id === filterAssignee.value))
    return false
  if (filterMine.value && user.value && !c.assignees.some(a => a.id === user.value!.id))
    return false
  if (filterLabel.value && !c.labels.some(l => l.id === filterLabel.value))
    return false
  if (filterPriority.value && c.priority !== filterPriority.value)
    return false
  if (filterSprint.value === 'none' && c.sprintId)
    return false
  if (filterSprint.value && filterSprint.value !== 'none' && c.sprintId !== filterSprint.value)
    return false
  return true
}

const filteredColumns = computed(() =>
  columns.value.map(col => ({
    ...col,
    cards: col.cards.filter(cardVisible),
  })),
)

const flatCards = computed(() =>
  filteredColumns.value.flatMap(c => c.cards.map(card => ({ ...card, columnTitle: c.title }))),
)

async function onCardListChange(col: KanbanColumn, evt: { added?: { element: KanbanCard, newIndex: number }, moved?: { element: KanbanCard, newIndex: number } }) {
  // Keep local columnId/position in sync for all cards in this column
  col.cards.forEach((card, i) => {
    card.columnId = col.id
    card.position = i
  })
  const moved = evt.added?.element || evt.moved?.element
  const newIndex = evt.added?.newIndex ?? evt.moved?.newIndex
  if (!moved || newIndex == null)
    return
  await api(`/v1/admin/kanban/cards/${moved.id}/move`, {
    method: 'POST',
    body: { columnId: col.id, position: newIndex },
  }).catch(() => null)
}

async function onColumnReorder() {
  const ids = columns.value.map(c => c.id)
  await api(`/v1/admin/kanban/boards/${boardId.value}/columns/reorder`, {
    method: 'POST',
    body: { columnIds: ids },
  })
}

async function addColumn() {
  const title = newColTitle.value.trim()
  if (!title)
    return
  await api(`/v1/admin/kanban/boards/${boardId.value}/columns`, {
    method: 'POST',
    body: { title },
  })
  newColTitle.value = ''
  await refresh()
}

async function saveColTitle(col: KanbanColumn) {
  const title = renameValue.value.trim()
  if (!title)
    return
  await api(`/v1/admin/kanban/columns/${col.id}`, { method: 'PATCH', body: { title } })
  renamingCol.value = null
  await refresh()
}

async function archiveColumn(col: KanbanColumn) {
  await api(`/v1/admin/kanban/columns/${col.id}`, { method: 'PATCH', body: { archived: true } })
  await refresh()
}

async function addCard(col: KanbanColumn) {
  const title = (quickAdd.value[col.id] || '').trim()
  if (!title)
    return
  await api(`/v1/admin/kanban/columns/${col.id}/cards`, {
    method: 'POST',
    body: { title },
  })
  quickAdd.value[col.id] = ''
  await refresh()
}

function openCard(id: string) {
  openCardId.value = id
  navigateTo({ query: { ...route.query, card: id } }, { replace: true })
}

function closeCard() {
  openCardId.value = null
  const q = { ...route.query }
  delete q.card
  navigateTo({ query: q }, { replace: true })
}

async function createSprint() {
  if (!sprintForm.name.trim())
    return
  await api(`/v1/admin/kanban/boards/${boardId.value}/sprints`, {
    method: 'POST',
    body: {
      name: sprintForm.name.trim(),
      goal: sprintForm.goal || null,
      startsOn: sprintForm.startsOn || null,
      endsOn: sprintForm.endsOn || null,
      status: sprintForm.status,
    },
  })
  showSprintForm.value = false
  sprintForm.name = ''
  sprintForm.goal = ''
  await refresh()
}

async function closeSprint(s: KanbanSprint) {
  await api(`/v1/admin/kanban/sprints/${s.id}`, { method: 'PATCH', body: { status: 'closed' } })
  await refresh()
}

async function createLabel() {
  if (!labelForm.name.trim())
    return
  await api(`/v1/admin/kanban/boards/${boardId.value}/labels`, {
    method: 'POST',
    body: { name: labelForm.name.trim(), color: labelForm.color },
  })
  labelForm.name = ''
  showLabelForm.value = false
  await refresh()
}

function wipWarn(col: KanbanColumn) {
  return col.wipLimit != null && col.cards.length > col.wipLimit
}
</script>

<template>
  <div class="flex h-[calc(100dvh-7.5rem)] flex-col gap-3 overflow-hidden">
    <div class="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <NuxtLink to="/admin/kanban" class="text-sm text-muted-foreground hover:underline">
          ← Канбан
        </NuxtLink>
        <h1 class="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span class="inline-block h-3 w-3 rounded-full" :style="{ background: boardColor }" />
          {{ boardTitle }}
        </h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <AdminSectionHelp section="kanban-board" />
        <Button size="sm" :variant="view === 'board' ? 'default' : 'outline'" @click="view = 'board'">
          Board
        </Button>
        <Button size="sm" :variant="view === 'list' ? 'default' : 'outline'" @click="view = 'list'">
          List
        </Button>
        <Button size="sm" variant="outline" @click="showSprintForm = !showSprintForm">
          Спринты
        </Button>
        <Button size="sm" variant="outline" @click="showLabelForm = !showLabelForm">
          Метки
        </Button>
        <Button size="sm" variant="secondary" @click="refresh">
          Refresh
        </Button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border p-3">
      <Input v-model="q" class="max-w-xs" placeholder="Поиск…" />
      <AdminSelect
        v-model="filterAssignee"
        class="w-[160px]"
        placeholder="Assignee"
        :options="[
          { value: '', label: 'Assignee' },
          ...staff.map(u => ({ value: u.id, label: u.displayName || u.email })),
        ]"
      />
      <AdminSelect
        v-model="filterLabel"
        class="w-[140px]"
        placeholder="Label"
        :options="[
          { value: '', label: 'Label' },
          ...labels.map(l => ({ value: l.id, label: l.name })),
        ]"
      />
      <AdminSelect
        v-model="filterPriority"
        class="w-[130px]"
        placeholder="Priority"
        :options="[
          { value: '', label: 'Priority' },
          ...['none', 'low', 'med', 'high', 'urgent'].map(p => ({ value: p, label: p })),
        ]"
      />
      <AdminSelect
        v-model="filterSprint"
        class="w-[150px]"
        placeholder="Sprint"
        :options="[
          { value: '', label: 'Sprint' },
          { value: 'none', label: 'Без спринта' },
          ...sprints.map(s => ({ value: s.id, label: s.name })),
        ]"
      />
      <AdminCheckbox v-model:checked="filterMine">
        Мои
      </AdminCheckbox>
    </div>

    <div v-if="showSprintForm" class="shrink-0 space-y-2 rounded-xl border p-3">
      <div class="flex flex-wrap gap-2">
        <Input v-model="sprintForm.name" placeholder="Название спринта" class="max-w-xs" />
        <Input v-model="sprintForm.goal" placeholder="Цель" class="max-w-xs" />
        <Input v-model="sprintForm.startsOn" type="date" class="w-auto" />
        <Input v-model="sprintForm.endsOn" type="date" class="w-auto" />
        <AdminSelect
          v-model="sprintForm.status"
          class="w-[130px]"
          :options="[
            { value: 'planned', label: 'planned' },
            { value: 'active', label: 'active' },
            { value: 'closed', label: 'closed' },
          ]"
        />
        <Button size="sm" @click="createSprint">
          Создать
        </Button>
      </div>
      <ul class="text-sm text-muted-foreground">
        <li v-for="s in sprints" :key="s.id" class="flex items-center gap-2 py-1">
          <Badge :variant="s.status === 'active' ? 'default' : 'secondary'">
            {{ s.status }}
          </Badge>
          {{ s.name }}
          <Button v-if="s.status !== 'closed'" size="sm" variant="ghost" @click="closeSprint(s)">
            Закрыть
          </Button>
        </li>
      </ul>
    </div>

    <div v-if="showLabelForm" class="flex shrink-0 flex-wrap items-end gap-2 rounded-xl border p-3">
      <Input v-model="labelForm.name" placeholder="Метка" class="max-w-xs" />
      <Input v-model="labelForm.color" type="color" class="h-9 w-12" />
      <Button size="sm" @click="createLabel">
        Добавить метку
      </Button>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="l in labels"
          :key="l.id"
          class="rounded-full px-2 py-0.5 text-xs text-white"
          :style="{ background: l.color }"
        >{{ l.name }}</span>
      </div>
    </div>

    <p v-if="err" class="text-sm text-destructive">
      {{ err }}
    </p>
    <div v-if="pending" class="text-sm text-muted-foreground">
      Загрузка…
    </div>

    <!-- BOARD VIEW -->
    <div v-else-if="view === 'board'" class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div
        ref="boardScrollEl"
        class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        <div class="flex h-full min-w-min items-stretch gap-3">
          <draggable
            v-model="columns"
            item-key="id"
            handle=".col-handle"
            class="flex h-full gap-3"
            ghost-class="opacity-40"
            @end="onColumnReorder"
          >
            <template #item="{ element: col }">
              <div
                class="flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/30"
                :class="wipWarn(col) ? 'border-amber-500' : ''"
              >
                <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
                  <span class="col-handle cursor-grab text-muted-foreground">⠿</span>
                  <template v-if="renamingCol === col.id">
                    <Input v-model="renameValue" class="h-8" @keydown.enter="saveColTitle(col)" />
                    <Button size="sm" @click="saveColTitle(col)">
                      OK
                    </Button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="flex-1 truncate text-left text-sm font-semibold"
                      @dblclick="renamingCol = col.id; renameValue = col.title"
                    >
                      {{ col.title }}
                      <span class="ml-1 font-normal text-muted-foreground">{{ col.cards.length }}</span>
                      <span v-if="col.wipLimit" class="text-xs text-muted-foreground">/{{ col.wipLimit }}</span>
                    </button>
                    <AdminConfirmDelete
                      entity="колонку"
                      :label="col.title"
                      @confirm="archiveColumn(col)"
                    />
                  </template>
                </div>

                <draggable
                  v-model="col.cards"
                  group="kanban-cards"
                  item-key="id"
                  class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain p-2"
                  ghost-class="opacity-40"
                  @change="(e: any) => onCardListChange(col, e)"
                >
                  <template #item="{ element: card }">
                    <button
                      v-show="cardVisible(card)"
                      type="button"
                      class="shrink-0 rounded-lg border bg-card p-2.5 text-left shadow-sm transition hover:border-primary/40"
                      :style="card.coverColor ? { borderTop: `3px solid ${card.coverColor}` } : undefined"
                      @click="openCard(card.id)"
                    >
                      <div v-if="card.labels.length" class="mb-1.5 flex flex-wrap gap-1">
                        <span
                          v-for="l in card.labels"
                          :key="l.id"
                          class="h-1.5 w-8 rounded-full"
                          :style="{ background: l.color }"
                          :title="l.name"
                        />
                      </div>
                      <div class="text-sm font-medium leading-snug">
                        {{ card.title }}
                      </div>
                      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge
                          v-if="card.priority !== 'none'"
                          variant="outline"
                          class="h-5 px-1.5 text-[10px]"
                        >
                          {{ priorityLabel(card.priority) }}
                        </Badge>
                        <span
                          v-if="card.dueAt"
                          :class="isOverdue(card.dueAt) ? 'text-destructive font-semibold' : ''"
                        >
                          {{ new Date(card.dueAt).toLocaleDateString() }}
                        </span>
                        <span v-if="card.checklistTotal">
                          {{ card.checklistDone }}/{{ card.checklistTotal }}
                        </span>
                        <span v-for="a in card.assignees.slice(0, 3)" :key="a.id" class="rounded-full bg-muted px-1.5">
                          {{ (a.displayName || a.email || '?').slice(0, 2).toUpperCase() }}
                        </span>
                      </div>
                    </button>
                  </template>
                </draggable>

                <form class="shrink-0 border-t p-2" @submit.prevent="addCard(col)">
                  <Input
                    v-model="quickAdd[col.id]"
                    class="h-8 text-sm"
                    placeholder="+ карточка"
                  />
                </form>
              </div>
            </template>
          </draggable>

          <form class="flex h-fit w-64 shrink-0 gap-2 rounded-xl border border-dashed p-3" @submit.prevent="addColumn">
            <Input v-model="newColTitle" placeholder="Новая колонка" />
            <Button type="submit" size="sm">
              +
            </Button>
          </form>
        </div>
      </div>
    </div>

    <!-- LIST VIEW -->
    <div v-else class="min-h-0 flex-1 overflow-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="px-3 py-2">
              Task
            </th>
            <th class="px-3 py-2">
              Column
            </th>
            <th class="px-3 py-2">
              Priority
            </th>
            <th class="px-3 py-2">
              Due
            </th>
            <th class="px-3 py-2">
              Assignees
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in flatCards"
            :key="c.id"
            class="cursor-pointer border-t hover:bg-muted/30"
            @click="openCard(c.id)"
          >
            <td class="px-3 py-2 font-medium">
              {{ c.title }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ c.columnTitle }}
            </td>
            <td class="px-3 py-2">
              {{ priorityLabel(c.priority) }}
            </td>
            <td class="px-3 py-2" :class="isOverdue(c.dueAt) ? 'text-destructive' : ''">
              {{ c.dueAt ? new Date(c.dueAt).toLocaleDateString() : '—' }}
            </td>
            <td class="px-3 py-2">
              {{ c.assignees.map(a => a.displayName || a.email).join(', ') || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Activity strip -->
    <details class="max-h-28 shrink-0 overflow-auto rounded-xl border p-3 text-sm">
      <summary class="cursor-pointer font-medium">
        Активность доски
      </summary>
      <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
        <li v-for="a in activity" :key="a.id">
          {{ a.actorName || '—' }} · {{ a.type }} · {{ new Date(a.createdAt).toLocaleString() }}
        </li>
      </ul>
    </details>

    <KanbanCardDrawer
      :open="!!openCardId"
      :card-id="openCardId"
      :board-id="boardId"
      :labels="labels"
      :sprints="sprints"
      :staff="staff"
      @close="closeCard"
      @updated="refresh"
      @deleted="refresh(); closeCard()"
    />
  </div>
</template>
