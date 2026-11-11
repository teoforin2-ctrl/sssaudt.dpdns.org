<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavLink } from '~/types/nav'
import { useSidebar } from '~/components/ui/sidebar'

const props = withDefaults(defineProps<{
  item: NavLink
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()

/** Full page nav for absolute URLs and public site root (not dashboard SPA routes). */
const external = computed(() => {
  const link = props.item.link
  return link === '/'
    || link.startsWith('http://')
    || link.startsWith('https://')
    || link.startsWith('//')
})

const badgeText = computed(() => {
  const b = props.item.badge
  if (b == null || b === '' || b === 0)
    return null
  const n = typeof b === 'number' ? b : Number(b)
  if (Number.isFinite(n) && n > 99)
    return '99+'
  return String(b)
})
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton as-child :tooltip="item.title" :size="size" :data-active="item.link === $route.path">
        <NuxtLink :to="item.link" :external="external" @click="setOpenMobile(false)">
          <Icon :name="item.icon || ''" />
          <span class="flex-1 truncate">{{ item.title }}</span>
          <span
            v-if="badgeText"
            class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-400"
          >
            {{ badgeText }}
          </span>
          <span v-else-if="item.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
            New
          </span>
        </NuxtLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
