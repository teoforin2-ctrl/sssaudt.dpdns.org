<script setup lang="ts">
import type { AdminHelpKey, AdminHelpSection } from '~/constants/admin-help'
import { CircleHelp } from 'lucide-vue-next'
import { adminHelp } from '~/constants/admin-help'

const props = withDefaults(defineProps<{
  section: AdminHelpKey
  /** Compact icon-only (default shows «Справка») */
  compact?: boolean
}>(), {
  compact: false,
})

const open = ref(false)
const fallbackHelp: AdminHelpSection = {
  title: 'Справка',
  summary: 'Описание раздела пока не добавлено.',
  steps: ['Обратитесь к документации или разработчику.'],
}
const help = computed((): AdminHelpSection => adminHelp[props.section] || fallbackHelp)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="gap-1.5 border-sky-500/40 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
        :aria-label="`Справка: ${help.title}`"
      >
        <CircleHelp class="size-4 shrink-0" />
        <span v-if="!compact">Справка</span>
      </Button>
    </DialogTrigger>

    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          Как работать: {{ help.title }}
        </DialogTitle>
        <DialogDescription>
          {{ help.summary }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 text-sm">
        <ol class="list-decimal space-y-2 pl-4 text-foreground">
          <li
            v-for="(step, i) in help.steps"
            :key="i"
          >
            {{ step }}
          </li>
        </ol>

        <div
          v-if="help.tips?.length"
          class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
        >
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Важно
          </p>
          <ul class="list-disc space-y-1 pl-4 text-muted-foreground">
            <li
              v-for="(tip, i) in help.tips"
              :key="i"
            >
              {{ tip }}
            </li>
          </ul>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" @click="open = false">
          Понятно
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
