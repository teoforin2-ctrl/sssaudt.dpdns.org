<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')
const { theme } = useAppSettings()

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    { rel: 'apple-touch-icon', href: '/favicon.png' },
  ],
  htmlAttrs: {
    lang: 'ru',
  },
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const title = 'SS Audit — Admin'
const description = 'CMS и модерация SS Audit'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  robots: 'noindex, nofollow',
})

const router = useRouter()

defineShortcuts({
  'G-H': () => router.push('/'),
  'G-E': () => router.push('/email'),
})

const textDirection = useTextDirection({ initialValue: 'ltr' })
const dir = computed(() => textDirection.value === 'rtl' ? 'rtl' : 'ltr')
</script>

<template>
  <Body class="overscroll-none antialiased bg-background text-foreground">
    <ConfigProvider :dir="dir">
      <div id="app" vaul-drawer-wrapper class="relative">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>

        <AppSettings />
      </div>

      <Toaster :theme="colorMode.preference as any || 'system'" />
    </ConfigProvider>
  </Body>
</template>
