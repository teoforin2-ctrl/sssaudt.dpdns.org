<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { user, loaded, fetchMe, logout, goDestination } = useAuth()

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: () => `${t('auth.accountTitle')}`,
  robots: 'noindex, nofollow',
})

onMounted(async () => {
  await fetchMe(true)
  if (!user.value) {
    await navigateTo(localePath('/login'))
    return
  }
  if (user.value.isStaff || user.value.role === 'partner_rep')
    await goDestination(user.value.isStaff ? 'admin' : 'partner')
})

async function onLogout() {
  await logout()
  await navigateTo(localePath('/'))
}
</script>

<template>
  <div class="account container">
    <div v-if="!loaded" class="card" aria-busy="true">
      <UiSkeleton height="20px" width="40%" />
      <UiSkeleton height="20px" width="70%" style="margin-top: 12px" />
      <UiSkeleton height="20px" width="55%" style="margin-top: 12px" />
    </div>

    <template v-else-if="user">
      <h1 class="page-title">{{ t('auth.accountTitle') }}</h1>
      <p class="lead">{{ t('auth.accountLead') }}</p>

      <div class="card">
        <div class="row">
          <span class="label">{{ t('auth.displayName') }}</span>
          <strong>{{ user.displayName || '—' }}</strong>
        </div>
        <div class="row">
          <span class="label">{{ t('auth.email') }}</span>
          <strong>{{ user.email }}</strong>
        </div>
        <div class="row">
          <span class="label">{{ t('auth.role') }}</span>
          <strong>{{ user.role }}</strong>
        </div>
      </div>

      <div class="actions">
        <UiButton variant="secondary" type="button" @click="onLogout">
          {{ t('auth.logout') }}
        </UiButton>
        <NuxtLink :to="localePath('/')">{{ t('auth.toHome') }}</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.account {
  max-width: 560px;
  padding-block: 48px 72px;
}
.lead {
  color: var(--text-secondary);
  margin: 8px 0 24px;
  font-size: 14px;
}
.muted {
  color: var(--text-secondary);
}
.card {
  display: grid;
  gap: 12px;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.card[aria-busy="true"] {
  gap: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}
.label {
  color: var(--text-secondary);
}
.actions {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.actions a {
  font-size: 14px;
  color: var(--accent-cta);
}
</style>
