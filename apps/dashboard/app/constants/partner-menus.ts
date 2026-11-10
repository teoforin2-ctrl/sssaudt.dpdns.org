import type { NavMenu, NavMenuItems } from '~/types/nav'

export const partnerNavMenu: NavMenu[] = [
  {
    heading: 'Partner',
    items: [
      {
        title: 'Обзор',
        icon: 'i-lucide-layout-dashboard',
        link: '/partner',
      },
      {
        title: 'Бонусы',
        icon: 'i-lucide-gift',
        link: '/partner/bonuses',
      },
      {
        title: 'Отзывы',
        icon: 'i-lucide-message-square',
        link: '/partner/reviews',
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
