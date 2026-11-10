<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import PasswordInput from '~/components/PasswordInput.vue'

const email = ref('admin@casino-review.local')
const password = ref('admin123')
const isLoading = ref(false)
const error = ref<string | null>(null)

const { login, goDestination, destinationFor } = useAuth()

async function onSubmit(event: Event) {
  event.preventDefault()
  if (!email.value || !password.value)
    return

  isLoading.value = true
  error.value = null
  try {
    const res = await login(email.value.trim(), password.value)
    const dest = res.destination || destinationFor(res.user)
    await goDestination(dest)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number, status?: number }).statusCode
      ?? (e as { status?: number }).status
    error.value = status === 401
      ? 'Неверный логин или пароль'
      : 'Не удалось войти. Проверьте API и попробуйте снова.'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form class="grid gap-6" @submit="onSubmit">
    <div class="grid gap-2">
      <Label for="email">
        Email
      </Label>
      <Input
        id="email"
        v-model="email"
        type="email"
        placeholder="admin@casino-review.local"
        :disabled="isLoading"
        auto-capitalize="none"
        auto-complete="email"
        auto-correct="off"
      />
    </div>
    <div class="grid gap-2">
      <Label for="password">
        Пароль
      </Label>
      <PasswordInput id="password" v-model="password" />
    </div>
    <p v-if="error" class="text-sm text-destructive" role="alert">
      {{ error }}
    </p>
    <Button type="submit" class="w-full" :disabled="isLoading">
      <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
      Войти
    </Button>
    <p class="text-xs text-muted-foreground text-center">
      Demo: admin@casino-review.local / admin123
    </p>
  </form>
</template>
