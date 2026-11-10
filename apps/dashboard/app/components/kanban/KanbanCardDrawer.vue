<script setup lang="ts">
import type { KanbanCard, KanbanLabel, KanbanSprint, KanbanUser } from '~/composables/useKanban'
import { priorityLabel } from '~/composables/useKanban'

const props = defineProps<{
  open: boolean
  cardId: string | null
  boardId: string
  labels: KanbanLabel[]
  sprints: KanbanSprint[]
  staff: KanbanUser[]
}>()

const emit = defineEmits<{
  close: []
  updated: []
  deleted: []
}>()

const { api } = useApi()

interface ChecklistItem { id: string, title: string, done: boolean, position: number, assigneeId?: string | null }
interface Checklist { id: string, title: string, position: number, items: ChecklistItem[] }

const loading = ref(false)
const saving = ref(false)
const detail = ref<{
  item: KanbanCard
  checklists: Checklist[]
  comments: Array<{ id: string, body: string, authorName?: string, createdAt: string, authorId?: string }>
  attachments: Array<{ id: string, url: string, name?: string | null, createdAt: string }>
  activity: Array<{ id: string, type: string, actorName?: string, createdAt: string }>
} | null>(null)

const draft = reactive({
  title: '',
  description: '',
  priority: 'none' as KanbanCard['priority'],
  dueAt: '',
  startAt: '',
  sprintId: '' as string,
  coverColor: '',
  assigneeIds: [] as string[],
  labelIds: [] as string[],
})

const newComment = ref('')
const newAttachUrl = ref('')
const newAttachName = ref('')
const newChecklistTitle = ref('Checklist')
const newItemTitle = ref<Record<string, string>>({})

watch(
  () => [props.open, props.cardId] as const,
  async ([open, id]) => {
    if (!open || !id) {
      detail.value = null
      return
    }
    await load(id)
  },
  { immediate: true },
)

async function load(id: string) {
  loading.value = true
  try {
    const res = await api<NonNullable<typeof detail.value>>(`/v1/admin/kanban/cards/${id}`)
    detail.value = res
    draft.title = res.item.title
    draft.description = res.item.description || ''
    draft.priority = res.item.priority
    draft.dueAt = res.item.dueAt ? res.item.dueAt.slice(0, 16) : ''
    draft.startAt = res.item.startAt ? res.item.startAt.slice(0, 16) : ''
    draft.sprintId = res.item.sprintId || ''
    draft.coverColor = res.item.coverColor || ''
    draft.assigneeIds = (res.item.assignees || []).map(a => a.id)
    draft.labelIds = (res.item.labels || []).map(l => l.id)
  }
  finally {
    loading.value = false
  }
}

async function save() {
  if (!props.cardId)
    return
  saving.value = true
  try {
    await api(`/v1/admin/kanban/cards/${props.cardId}`, {
      method: 'PATCH',
      body: {
        title: draft.title,
        description: draft.description || null,
        priority: draft.priority,
        dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
        startAt: draft.startAt ? new Date(draft.startAt).toISOString() : null,
        sprintId: draft.sprintId || null,
        coverColor: draft.coverColor || null,
        assigneeIds: draft.assigneeIds,
        labelIds: draft.labelIds,
      },
    })
    emit('updated')
    await load(props.cardId)
  }
  finally {
    saving.value = false
  }
}

async function removeCard() {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/cards/${props.cardId}`, { method: 'DELETE' })
  emit('deleted')
  emit('close')
}

async function addChecklist() {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/cards/${props.cardId}/checklists`, {
    method: 'POST',
    body: { title: newChecklistTitle.value || 'Checklist' },
  })
  await load(props.cardId)
}

async function addItem(checklistId: string) {
  const title = (newItemTitle.value[checklistId] || '').trim()
  if (!title || !props.cardId)
    return
  await api(`/v1/admin/kanban/checklists/${checklistId}/items`, {
    method: 'POST',
    body: { title },
  })
  newItemTitle.value[checklistId] = ''
  await load(props.cardId)
  emit('updated')
}

async function toggleItem(item: ChecklistItem) {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/checklist-items/${item.id}`, {
    method: 'PATCH',
    body: { done: !item.done },
  })
  await load(props.cardId)
  emit('updated')
}

async function removeItem(id: string) {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/checklist-items/${id}`, { method: 'DELETE' })
  await load(props.cardId)
  emit('updated')
}

async function removeChecklist(id: string) {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/checklists/${id}`, { method: 'DELETE' })
  await load(props.cardId)
  emit('updated')
}

async function postComment() {
  if (!props.cardId || !newComment.value.trim())
    return
  await api(`/v1/admin/kanban/cards/${props.cardId}/comments`, {
    method: 'POST',
    body: { body: newComment.value.trim() },
  })
  newComment.value = ''
  await load(props.cardId)
}

async function addAttachment() {
  if (!props.cardId || !newAttachUrl.value.trim())
    return
  await api(`/v1/admin/kanban/cards/${props.cardId}/attachments`, {
    method: 'POST',
    body: { url: newAttachUrl.value.trim(), name: newAttachName.value || null },
  })
  newAttachUrl.value = ''
  newAttachName.value = ''
  await load(props.cardId)
}

async function removeAttachment(id: string) {
  if (!props.cardId)
    return
  await api(`/v1/admin/kanban/attachments/${id}`, { method: 'DELETE' })
  await load(props.cardId)
}

function toggleAssignee(id: string) {
  const i = draft.assigneeIds.indexOf(id)
  if (i >= 0)
    draft.assigneeIds.splice(i, 1)
  else draft.assigneeIds.push(id)
}

function toggleLabel(id: string) {
  const i = draft.labelIds.indexOf(id)
  if (i >= 0)
    draft.labelIds.splice(i, 1)
  else draft.labelIds.push(id)
}
</script>

<template>
  <Sheet :open="open" @update:open="(v: boolean) => !v && emit('close')">
    <SheetContent class="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
      <div class="space-y-5 px-6 pt-6 pb-8">
        <SheetHeader class="pr-8 text-left">
          <SheetTitle>Карточка</SheetTitle>
          <SheetDescription>
            Подзадачи, люди, сроки, спринт
          </SheetDescription>
        </SheetHeader>

        <div v-if="loading" class="space-y-3 py-2">
          <Skeleton class="h-8 w-3/4" />
          <Skeleton class="h-24 w-full" />
        </div>

        <div v-else-if="detail" class="space-y-5">
          <Input v-model="draft.title" class="text-base font-semibold" />
          <Textarea v-model="draft.description" rows="4" placeholder="Описание…" />

          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>Приоритет</Label>
              <select v-model="draft.priority" class="mt-1 flex h-9 w-full rounded-md border bg-transparent px-2 text-sm">
                <option v-for="p in (['none', 'low', 'med', 'high', 'urgent'] as const)" :key="p" :value="p">
                  {{ priorityLabel(p) }}
                </option>
              </select>
            </div>
            <div>
              <Label>Спринт</Label>
              <select v-model="draft.sprintId" class="mt-1 flex h-9 w-full rounded-md border bg-transparent px-2 text-sm">
                <option value="">
                  —
                </option>
                <option v-for="s in sprints" :key="s.id" :value="s.id" :disabled="s.status === 'closed'">
                  {{ s.name }} ({{ s.status }})
                </option>
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input v-model="draft.startAt" type="datetime-local" class="mt-1" />
            </div>
            <div>
              <Label>Due</Label>
              <Input v-model="draft.dueAt" type="datetime-local" class="mt-1" />
            </div>
            <div>
              <Label>Cover</Label>
              <Input v-model="draft.coverColor" type="color" class="mt-1 h-9" />
            </div>
          </div>

          <div>
            <Label>Ответственные</Label>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="u in staff"
                :key="u.id"
                type="button"
                class="rounded-full border px-2 py-1 text-xs"
                :class="draft.assigneeIds.includes(u.id) ? 'border-primary bg-primary/10' : ''"
                @click="toggleAssignee(u.id)"
              >
                {{ u.displayName || u.email }}
              </button>
            </div>
          </div>

          <div>
            <Label>Метки</Label>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="l in labels"
                :key="l.id"
                type="button"
                class="rounded-full px-2 py-1 text-xs text-white"
                :style="{ background: l.color, opacity: draft.labelIds.includes(l.id) ? 1 : 0.35 }"
                @click="toggleLabel(l.id)"
              >
                {{ l.name }}
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <Button :disabled="saving" @click="save">
              Сохранить
            </Button>
            <AdminConfirmDelete
              entity="карточку"
              :label="draft.title"
              mode="button"
              @confirm="removeCard"
            />
          </div>

          <!-- Checklists -->
          <div class="space-y-3 border-t pt-4">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">
                Подзадачи
              </h3>
              <Button size="sm" variant="outline" @click="addChecklist">
                + чеклист
              </Button>
            </div>
            <div v-for="ch in detail?.checklists || []" :key="ch.id" class="rounded-lg border p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <strong class="text-sm">{{ ch.title }}</strong>
                <Button size="sm" variant="ghost" class="text-destructive" @click="removeChecklist(ch.id)">
                  ×
                </Button>
              </div>
              <ul class="space-y-1">
                <li v-for="it in ch.items" :key="it.id" class="flex items-center gap-2 text-sm">
                  <input type="checkbox" :checked="it.done" @change="toggleItem(it)">
                  <span :class="it.done ? 'line-through text-muted-foreground' : ''">{{ it.title }}</span>
                  <button type="button" class="ml-auto text-xs text-muted-foreground" @click="removeItem(it.id)">
                    del
                  </button>
                </li>
              </ul>
              <form class="mt-2 flex gap-2" @submit.prevent="addItem(ch.id)">
                <Input v-model="newItemTitle[ch.id]" placeholder="Новый пункт" class="h-8" />
                <Button size="sm" type="submit">
                  Add
                </Button>
              </form>
            </div>
          </div>

          <!-- Attachments -->
          <div class="space-y-2 border-t pt-4">
            <h3 class="font-semibold">
              Вложения (URL)
            </h3>
            <ul class="space-y-1 text-sm">
              <li v-for="a in detail?.attachments || []" :key="a.id" class="flex items-center gap-2">
                <a :href="a.url" target="_blank" rel="noopener" class="truncate text-primary underline">{{ a.name || a.url }}</a>
                <button type="button" class="text-xs text-destructive" @click="removeAttachment(a.id)">
                  ×
                </button>
              </li>
            </ul>
            <div class="flex flex-col gap-2">
              <Input v-model="newAttachUrl" placeholder="https://…" />
              <Input v-model="newAttachName" placeholder="Имя (опц.)" />
              <Button size="sm" variant="outline" @click="addAttachment">
                Добавить ссылку
              </Button>
            </div>
          </div>

          <!-- Comments -->
          <div class="space-y-2 border-t pt-4">
            <h3 class="font-semibold">
              Комментарии
            </h3>
            <div v-for="c in detail?.comments || []" :key="c.id" class="rounded-md bg-muted/40 p-2 text-sm">
              <div class="text-xs text-muted-foreground">
                {{ c.authorName }} · {{ new Date(c.createdAt).toLocaleString() }}
              </div>
              <p class="whitespace-pre-wrap">
                {{ c.body }}
              </p>
            </div>
            <Textarea v-model="newComment" rows="2" placeholder="Комментарий…" />
            <Button size="sm" @click="postComment">
              Отправить
            </Button>
          </div>

          <!-- Activity -->
          <div class="space-y-1 border-t pt-4">
            <h3 class="font-semibold">
              Активность
            </h3>
            <ul class="space-y-1 text-xs text-muted-foreground">
              <li v-for="a in detail?.activity || []" :key="a.id">
                {{ a.actorName || '—' }} · {{ a.type }} · {{ new Date(a.createdAt).toLocaleString() }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
