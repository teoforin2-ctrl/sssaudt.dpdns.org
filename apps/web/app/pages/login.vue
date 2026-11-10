<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { login, goDestination, user, fetchMe } = useAuth()

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: () => `${t('auth.loginTitle')}`,
  robots: 'noindex, nofollow',
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  await fetchMe()
  if (user.value)
    await goDestination(user.value.isStaff ? 'admin' : user.value.role === 'partner_rep' ? 'partner' : 'account')
})

async function onSubmit() {
  error.value = null
  loading.value = true
  try {
    const res = await login(email.value.trim(), password.value)
    await goDestination(res.destination)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 401
      ? t('auth.invalidCredentials')
      : t('auth.loginFailed')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page container">
    <h1 class="page-title">{{ t('auth.loginTitle') }}</h1>
    <p class="lead">{{ t('auth.loginLead') }}</p>

    <form class="card" @submit.prevent="onSubmit">
      <p v-if="error" class="err" role="alert">{{ error }}</p>

      <label class="field">
        <span>{{ t('auth.email') }}</span>
        <input v-model="email" type="email" required autocomplete="email" />
      </label>

      <label class="field">
        <span>{{ t('auth.password') }}</span>
        <input v-model="password" type="password" required minlength="1" autocomplete="current-password" />
      </label>

      <UiButton type="submit" :disabled="loading">
        {{ loading ? t('auth.loggingIn') : t('auth.login') }}
      </UiButton>

      <p class="switch">
        {{ t('auth.noAccount') }}
        <NuxtLink :to="localePath('/register')">{{ t('auth.register') }}</NuxtLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  max-width: 420px;
  padding-block: 48px 72px;
}
.lead {
  color: var(--text-secondary);
  margin: 8px 0 24px;
  font-size: 14px;
}
.card {
  display: grid;
  gap: 14px;
  padding: 22px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.field input {
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-canvas);
  color: var(--text-primary);
  padding: 0 12px;
  font: inherit;
}
.err {
  color: var(--danger, #e5484d);
  font-size: 13px;
  margin: 0;
}
.switch {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}
.switch a {
  color: var(--accent-cta);
  font-weight: 600;
}
</style>
