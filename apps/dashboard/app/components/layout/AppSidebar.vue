<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { EDITOR_ADMIN_ALLOW_PREFIXES } from '~/constants/editor-access'
import { navMenu, navMenuBottom } from '~/constants/menus'
import { partnerNavMenu, partnerNavMenuBottom } from '~/constants/partner-menus'
import { playerNavMenu, playerNavMenuBottom } from '~/constants/player-menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const { user } = useAuth()
const route = useRoute()
const { t, siteUrl } = useCabinetLocale()

const isPartner = computed(() =>
  route.path.startsWith('/partner') || user.value?.role === 'partner_rep',
)
const isPlayer = computed(() =>
  route.path.startsWith('/account') || user.value?.role === 'player',
)

const canKanban = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

const canDocs = computed(() =>
  user.value?.role === 'admin'
  || user.value?.role === 'developer'
  || user.value?.role === 'editor',
)

const isEditor = computed(() => user.value?.role === 'editor')

const editorAllowed = new Set<string>(EDITOR_ADMIN_ALLOW_PREFIXES)

const { reviewsPending, complaintsOpen } = useAdminQueueBadges()

const badgeByLink = computed<Record<string, number>>(() => ({
  '/admin/reviews': reviewsPending.value,
  '/admin/complaints': complaintsOpen.value,
}))

const activeMenu = computed(() => {
  if (isPlayer.value) {
    return playerNavMenu.map(group => ({
      ...group,
      heading: t('nav.player'),
      items: group.items.map(item =>
        'title' in item ? { ...item, title: t('nav.cabinet') } : item,
      ),
    }))
  }
  if (isPartner.value) {
    return partnerNavMenu.map(group => ({
      ...group,
      heading: t('nav.partner'),
      items: group.items.map(item =>
        'title' in item ? { ...item, title: t('nav.cabinet') } : item,
      ),
    }))
  }

  const hidden = new Set<string>()
  if (isEditor.value) {
    for (const group of navMenu) {
      for (const item of group.items) {
        if ('link' in item && !editorAllowed.has(item.link))
          hidden.add(item.link)
      }
    }
  }
  else {
    if (!canKanban.value) {
      hidden.add('/admin/kanban')
      hidden.add('/admin/server')
    }
    if (!canDocs.value) {
      hidden.add('/admin/branding')
      hidden.add('/admin/glossary')
    }
    // SEO / AI — admin/developer only (editors filtered via EDITOR_ADMIN_ALLOW_PREFIXES)
    if (!canKanban.value)
      hidden.add('/admin/seo')
    if (!canKanban.value)
      hidden.add('/admin/ai')
    if (!canKanban.value)
      hidden.add('/admin/parser')
    if (!canKanban.value)
      hidden.add('/admin/partners')
  }

  return navMenu
    .map(group => ({
      ...group,
      items: group.items
        .filter(item => !('link' in item && hidden.has(item.link)))
        .map((item) => {
          if (!('link' in item))
            return item
          const badge = badgeByLink.value[item.link]
          return badge ? { ...item, badge } : item
        }),
    }))
    .filter(group => group.items.length > 0)
})
const config = useRuntimeConfig()
const siteOrigin = String(config.public.siteUrl || 'http://127.0.0.1:3710').replace(/\/$/, '')

const activeBottom = computed(() => {
  const items = isPlayer.value
    ? playerNavMenuBottom
    : isPartner.value
      ? partnerNavMenuBottom
      : navMenuBottom
  return items.map((item) => {
    if (!('link' in item))
      return item
    // "/" was resolving to the dashboard itself — send users to the public site.
    if (item.link === '/' || item.link === '/ru' || item.title === 'Открыть сайт' || item.title === 'Open site')
      return { ...item, title: (isPlayer.value || isPartner.value) ? t('nav.openSite') : item.title, link: (isPlayer.value || isPartner.value) ? siteUrl('/') : `${siteOrigin}/ru` }
    return item
  })
})

const sidebarUser = computed(() => ({
  name: user.value?.displayName || user.value?.email || 'Staff',
  email: user.value?.email || '',
  avatar: '',
  role: user.value?.role || '',
}))

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in activeMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in activeBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter :user="sidebarUser" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
