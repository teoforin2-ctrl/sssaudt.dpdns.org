<script setup lang="ts">
defineProps<{
  dirty: boolean
  saving?: boolean
  message?: string | null
  error?: string | null
}>()

defineEmits<{
  save: []
  reset: []
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="dirty"
      class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none"
    >
      <div class="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl backdrop-blur">
        <p class="text-sm text-muted-foreground">
          Есть несохранённые изменения
        </p>
        <p v-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>
        <p v-else-if="message" class="text-sm text-emerald-600 dark:text-emerald-400">
          {{ message }}
        </p>
        <div class="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" :disabled="saving" @click="$emit('reset')">
            Отмена
          </Button>
          <Button size="sm" :disabled="saving" @click="$emit('save')">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
