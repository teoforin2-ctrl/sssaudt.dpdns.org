<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})

const { api } = useApi()
const { data } = await useAsyncData(
  'login-site-name',
  () => api<{ settings: { siteName?: string } }>('/v1/site-settings').catch(() => null),
)
const siteName = computed(() => data.value?.settings?.siteName?.trim() || 'SSS Audit')
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="grid w-full max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ siteName }}
        </h1>
        <p class="text-balance text-sm text-muted-foreground">
          Войдите по email и паролю
        </p>
      </div>
      <AuthSignIn />
    </div>
  </div>
</template>
