<script setup lang="ts">
const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

interface SidebarSettings {
  siteName: string
  favicon32Url: string | null
  faviconUrl: string | null
  logoUrl: string | null
}

async function loadSidebarSettings() {
  const admin = await api<{ settings: SidebarSettings }>('/v1/admin/site-settings').catch(() => null)
  if (admin?.settings)
    return admin
  return api<{ settings: SidebarSettings }>('/v1/site-settings').catch(() => null)
}

const { data } = await useAsyncData('admin-sidebar-site-settings', loadSidebarSettings)

const siteName = computed(() => data.value?.settings?.siteName || 'SSS Audit')
const { user } = useAuth()
const { t } = useCabinetLocale()
const subtitle = computed(() => {
  if (user.value?.role === 'player')
    return t('subtitle.player')
  if (user.value?.role === 'partner_rep')
    return t('subtitle.partner')
  return t('subtitle.admin')
})
const iconUrl = computed(() => {
  const path = data.value?.settings?.favicon32Url
    || data.value?.settings?.faviconUrl
    || data.value?.settings?.logoUrl
    || '/favicon.png'
  if (path.startsWith('http'))
    return path
  if (path.startsWith('/uploads/'))
    return `${webOrigin}${path}`
  return path
})
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        as-child
        class="pointer-events-none cursor-default hover:bg-transparent active:bg-transparent"
      >
        <div class="flex w-full items-center gap-2">
          <div class="aspect-square size-8 flex items-center justify-center overflow-hidden rounded-lg bg-black">
            <img
              :src="iconUrl"
              alt=""
              width="32"
              height="32"
              class="size-8 object-cover"
            >
          </div>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-semibold">
              {{ siteName }}
            </span>
            <span class="truncate text-xs text-muted-foreground">
              {{ subtitle }}
            </span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
