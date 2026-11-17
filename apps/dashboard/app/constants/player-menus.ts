import type { NavMenu, NavMenuItems } from '~/types/nav'

export const playerNavMenu: NavMenu[] = [
  {
    heading: 'Игрок',
    items: [
      {
        title: 'Кабинет',
        icon: 'i-lucide-layout-dashboard',
        link: '/account',
      },
    ],
  },
]

export const playerNavMenuBottom: NavMenuItems = [
  {
    title: 'Открыть сайт',
    icon: 'i-lucide-external-link',
    link: '/',
  },
]
