<script setup lang="ts">
const { user, loaded, fetchMe, goDestination } = useAuth()
const { locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const dashboardUrl = String(config.public.dashboardUrl || 'http://127.0.0.1:3711').replace(/\/$/, '')

definePageMeta({ layout: 'default' })

useSeoMeta({
  robots: 'noindex, nofollow',
})

onMounted(async () => {
  await fetchMe(true)
  if (!user.value) {
    await navigateTo({ path: localePath('/login'), query: { redirect: localePath('/account') } })
    return
  }
  if (user.value.isStaff || user.value.role === 'partner_rep') {
    await goDestination(user.value.isStaff ? 'admin' : 'partner')
    return
  }
  window.location.href = `${dashboardUrl}/account?lang=${locale.value}`
})
</script>

<template>
  <div class="container" style="padding: 48px 0">
    <UiSkeleton v-if="!loaded" height="40px" width="40%" />
  </div>
</template>
