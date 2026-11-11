<script setup lang="ts">
const props = defineProps<{
  status: string
  label?: string
}>()

const map: Record<string, { label: string, class: string }> = {
  published: { label: 'на сайте', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
  active: { label: 'активен', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
  approved: { label: 'одобрен', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
  draft: { label: 'черновик', class: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  pending: { label: 'ожидает', class: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  pending_lawyer: { label: 'у юриста', class: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  review: { label: 'на проверке', class: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400' },
  hidden: { label: 'скрыто', class: 'border-muted-foreground/30 text-muted-foreground' },
  rejected: { label: 'отклонён', class: 'border-rose-500/40 text-rose-700 dark:text-rose-400' },
  new: { label: 'новый', class: 'border-violet-500/40 text-violet-700 dark:text-violet-400' },
  open: { label: 'открыта', class: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  resolved: { label: 'закрыта', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
  deleted: { label: 'удалено', class: 'border-rose-500/40 text-rose-700 dark:text-rose-400' },
  in_review: { label: 'в работе', class: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400' },
  need_info: { label: 'нужна инфо', class: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  in_progress: { label: 'в работе', class: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400' },
  done: { label: 'готово', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
  spam: { label: 'спам', class: 'border-rose-500/40 text-rose-700 dark:text-rose-400' },
}

const meta = computed(() => map[props.status] || {
  label: props.status,
  class: 'border-border text-foreground/80',
})
</script>

<template>
  <Badge variant="outline" class="gap-1.5 font-normal tabular-nums" :class="meta.class">
    <span class="size-1.5 rounded-full bg-current opacity-80" />
    {{ label || meta.label }}
  </Badge>
</template>
