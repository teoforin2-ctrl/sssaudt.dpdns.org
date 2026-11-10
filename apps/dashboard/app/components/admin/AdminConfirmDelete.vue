<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    /** What is being deleted, shown in the dialog (e.g. casino name). */
    label?: string | null
    /** Entity noun in Russian nominative, e.g. «отзыв», «казино». */
    entity?: string
    busy?: boolean
    disabled?: boolean
    /** Icon-only trigger (default) or a text button. */
    mode?: 'icon' | 'button'
  }>(),
  {
    label: null,
    entity: 'запись',
    busy: false,
    disabled: false,
    mode: 'icon',
  },
)

const emit = defineEmits<{ confirm: [] }>()

const open = ref(false)

const title = computed(() => `Удалить ${props.entity}?`)
const description = computed(() => {
  const name = (props.label || '').trim()
  if (name) {
    return `«${name}» будет удалено безвозвратно. Это действие нельзя отменить.`
  }
  return `Запись будет удалена безвозвратно. Это действие нельзя отменить.`
})

function onConfirm() {
  if (props.busy || props.disabled)
    return
  emit('confirm')
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogTrigger as-child>
      <span class="inline-flex">
        <TooltipProvider v-if="mode === 'icon'" :delay-duration="250">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-destructive"
                :disabled="disabled || busy"
                :aria-label="title"
              >
                <Trash2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Удалить</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          v-else
          type="button"
          variant="destructive"
          size="sm"
          :disabled="disabled || busy"
          :aria-label="title"
        >
          <Trash2 class="size-4" />
          <span>Удалить</span>
        </Button>
      </span>
    </AlertDialogTrigger>

    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="busy">
          Отмена
        </AlertDialogCancel>
        <AlertDialogAction
          :class="cn(buttonVariants({ variant: 'destructive' }))"
          :disabled="busy"
          @click="onConfirm"
        >
          {{ busy ? 'Удаление…' : 'Удалить' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
