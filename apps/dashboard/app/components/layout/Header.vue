<script setup lang="ts">
const route = useRoute()
const { t, lang } = useCabinetLocale()
const isCabinet = computed(() =>
  route.path.startsWith('/partner') || route.path.startsWith('/account'),
)

const TITLE_MAP: Record<string, string> = {
  admin: 'Админ',
  partner: 'Партнёр',
  casinos: 'Казино',
  slots: 'Слоты',
  articles: 'Статьи',
  home: 'Главная',
  banners: 'Баннеры',
  bonuses: 'Бонусы',
  reviews: 'Отзывы',
  complaints: 'Жалобы',
  blacklist: 'Чёрный список',
  clicks: 'Клики /go/',
  rewards: 'A/B награды',
  forum: 'Форум',
  b2b: 'B2B / лиды',
  kanban: 'Канбан',
  users: 'Пользователи',
  ops: 'Ops lite',
  server: 'Сервер',
  settings: 'Настройки',
  branding: 'Брендинг',
  glossary: 'Глоссарий',
  new: 'Новая запись',
  payout: 'Payout',
}

function homeHref() {
  if (route.path.startsWith('/partner'))
    return '/partner'
  if (route.path.startsWith('/account'))
    return '/account'
  return '/admin'
}

function segmentTitle(raw: string) {
  const decoded = decodeURIComponent(raw.split('?')[0] || raw)
  if (TITLE_MAP[decoded])
    return TITLE_MAP[decoded]
  // UUID / id — keep short
  if (/^[0-9a-f-]{8,}$/i.test(decoded))
    return 'Карточка'
  return decoded
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function setLinks() {
  const home = { title: isCabinet.value ? t('tabs.home') : 'Главная', href: homeHref() }
  if (route.path === '/' || route.path === '/admin' || route.path === '/partner' || route.path === '/account') {
    return [home]
  }

  const segments = route.path.split('/').filter(item => item !== '')

  const breadcrumbs = segments.map((item, index) => {
    return {
      title: segmentTitle(item),
      href: `/${segments.slice(0, index + 1).join('/')}`,
    }
  })

  return [home, ...breadcrumbs]
}

const links = ref<{
  title: string
  href: string
}[]>(setLinks())

watch([() => route.fullPath, lang], () => {
  links.value = setLinks()
})
</script>

<template>
  <header class="sticky top-0 md:peer-data-[variant=inset]:top-2 z-10 h-(--header-height) flex items-center gap-4 border-b bg-background px-4 md:px-6 md:rounded-tl-xl md:rounded-tr-xl">
    <div class="w-full flex items-center gap-4 h-4">
      <SidebarTrigger />
      <Separator orientation="vertical" />
      <BaseBreadcrumbCustom :links="links" />
    </div>
    <div class="ml-auto flex items-center gap-2">
      <AdminCommandPalette v-if="!isCabinet" />
      <slot />
    </div>
  </header>
</template>
