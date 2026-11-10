export type KanbanPriority = 'none' | 'low' | 'med' | 'high' | 'urgent'

export interface KanbanUser {
  id: string
  email: string
  displayName: string | null
  role?: string
}

export interface KanbanLabel {
  id: string
  name: string
  color: string
}

export interface KanbanCard {
  id: string
  boardId: string
  columnId: string
  title: string
  description?: string | null
  position: number
  priority: KanbanPriority
  dueAt?: string | null
  startAt?: string | null
  sprintId?: string | null
  coverColor?: string | null
  assignees: KanbanUser[]
  labels: KanbanLabel[]
  checklistTotal: number
  checklistDone: number
  archivedAt?: string | null
  completedAt?: string | null
  boardTitle?: string
  columnTitle?: string
}

export interface KanbanColumn {
  id: string
  title: string
  position: number
  wipLimit?: number | null
  cards: KanbanCard[]
}

export interface KanbanSprint {
  id: string
  name: string
  goal?: string | null
  startsOn?: string | null
  endsOn?: string | null
  status: 'planned' | 'active' | 'closed'
}

export interface KanbanBoard {
  id: string
  title: string
  description?: string | null
  color: string
  ownerId?: string | null
  archivedAt?: string | null
  cardsCount?: number
  columnsCount?: number
}

export function useKanban() {
  const { api } = useApi()

  return {
    api,
    listBoards: (archived = false) =>
      api<{ items: KanbanBoard[] }>('/v1/admin/kanban/boards', {
        query: archived ? { archived: '1' } : undefined,
      }),
    createBoard: (body: { title: string, description?: string, color?: string }) =>
      api<{ item: KanbanBoard }>('/v1/admin/kanban/boards', { method: 'POST', body }),
    patchBoard: (id: string, body: Record<string, unknown>) =>
      api(`/v1/admin/kanban/boards/${id}`, { method: 'PATCH', body }),
    deleteBoard: (id: string) =>
      api(`/v1/admin/kanban/boards/${id}`, { method: 'DELETE' }),
    fullBoard: (id: string) =>
      api<{
        board: KanbanBoard
        columns: KanbanColumn[]
        labels: KanbanLabel[]
        sprints: KanbanSprint[]
        activity: Array<{ id: string, type: string, actorName?: string, createdAt: string, cardId?: string, payload?: unknown }>
      }>(`/v1/admin/kanban/boards/${id}/full`),
    staff: () => api<{ items: KanbanUser[] }>('/v1/admin/kanban/staff'),
    myCards: () => api<{ items: KanbanCard[] }>('/v1/admin/kanban/my-cards'),
    notifications: (unread = false) =>
      api<{ items: Array<{ id: string, title: string, body?: string, boardId?: string, cardId?: string, readAt?: string, createdAt: string }> }>(
        '/v1/admin/kanban/notifications',
        { query: unread ? { unread: '1' } : undefined },
      ),
    readNotifications: (ids?: string[]) =>
      api('/v1/admin/kanban/notifications/read', { method: 'POST', body: { ids } }),
  }
}

export function priorityLabel(p: KanbanPriority) {
  return ({ none: '—', low: 'Low', med: 'Med', high: 'High', urgent: 'Urgent' } as const)[p]
}

export function isOverdue(dueAt?: string | null) {
  if (!dueAt)
    return false
  return new Date(dueAt).getTime() < Date.now()
}
