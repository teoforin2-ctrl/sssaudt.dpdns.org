<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { login, goDestination, user, fetchMe } = useAuth()
const { siteName } = useSiteSettings()
const brand = computed(() => String(siteName.value || 'SSS Audit').trim() || 'SSS Audit')

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: () => `${t('auth.loginTitle')}`,
  robots: 'noindex, nofollow',
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const registerTo = computed(() => {
  const q = route.query.redirect ? { redirect: String(route.query.redirect) } : undefined
  return { path: localePath('/register'), query: q }
})

onMounted(async () => {
  await fetchMe()
  if (user.value)
    await goDestination(user.value.isStaff ? 'admin' : user.value.role === 'partner_rep' ? 'partner' : 'account')
})

async function onSubmit() {
  if (loading.value)
    return
  error.value = null
  loading.value = true
  try {
    const res = await login(email.value.trim(), password.value)
    password.value = ''
    // Keep spinner until full navigation to cabinet/admin.
    await goDestination(res.destination)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 401
      ? t('auth.invalidCredentials')
      : t('auth.loginFailed')
    password.value = ''
    loading.value = false
  }
}
</script>

<template>
  <div class="container-auth auth-page">
    <form class="card" @submit.prevent="onSubmit">
      <h1 class="title">{{ brand }}</h1>
      <p class="lead">{{ t('auth.loginLead', { name: brand }) }}</p>

      <p v-if="error" class="err" role="alert">{{ error }}</p>

      <label class="field">
        <span>{{ t('auth.email') }}</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          inputmode="email"
          autocapitalize="off"
          spellcheck="false"
          autofocus
        >
      </label>

      <PublicPasswordField
        v-model="password"
        :label="t('auth.password')"
        autocomplete="current-password"
      />

      <UiButton type="submit" block :disabled="loading" :loading="loading">
        {{ loading ? t('auth.loggingIn') : t('auth.login') }}
      </UiButton>

      <p class="switch">
        {{ t('auth.noAccount') }}
        <NuxtLink :to="registerTo">{{ t('auth.register') }}</NuxtLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  padding-block: 48px 72px;
  min-height: calc(100vh - var(--header-h, 64px) - 160px);
  display: grid;
  align-content: center;
}
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 30px);
  letter-spacing: -0.03em;
}
.lead {
  color: var(--text-secondary);
  margin: 8px 0 4px;
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
  font-size: 16px;
}
.err {
  color: var(--danger, #e5484d);
  font-size: 13px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--accent-rose-soft);
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
