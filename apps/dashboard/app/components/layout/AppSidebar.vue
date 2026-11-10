<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { navMenu, navMenuBottom } from '~/constants/menus'
import { partnerNavMenu, partnerNavMenuBottom } from '~/constants/partner-menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const { user } = useAuth()
const route = useRoute()

const isPartner = computed(() =>
  route.path.startsWith('/partner') || user.value?.role === 'partner_rep',
)

const canKanban = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

const canDocs = computed(() =>
  user.value?.role === 'admin'
  || user.value?.role === 'developer'
  || user.value?.role === 'editor',
)

const activeMenu = computed(() => {
  if (isPartner.value)
    return partnerNavMenu

  const hidden = new Set<string>()
  if (!canKanban.value) {
    hidden.add('/admin/kanban')
    hidden.add('/admin/server')
  }
  if (!canDocs.value) {
    hidden.add('/admin/branding')
    hidden.add('/admin/glossary')
  }
  if (!hidden.size)
    return navMenu

  return navMenu.map(group => ({
    ...group,
    items: group.items.filter(item => !('link' in item && hidden.has(item.link))),
  }))
})
const activeBottom = computed(() => isPartner.value ? partnerNavMenuBottom : navMenuBottom)

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
