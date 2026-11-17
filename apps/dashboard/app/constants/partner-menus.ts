import type { NavMenu, NavMenuItems } from '~/types/nav'

export const partnerNavMenu: NavMenu[] = [
  {
    heading: 'Partner',
    items: [
      {
        title: 'Кабинет',
        icon: 'i-lucide-layout-dashboard',
        link: '/partner',
      },
    ],
  },
]

export const partnerNavMenuBottom: NavMenuItems = [
  {
    title: 'Открыть сайт',
    icon: 'i-lucide-external-link',
    link: '/',
  },
]
