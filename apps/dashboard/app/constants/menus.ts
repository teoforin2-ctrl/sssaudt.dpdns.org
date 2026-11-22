import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'Обзор',
    items: [
      {
        title: 'Дашборд',
        icon: 'i-lucide-layout-dashboard',
        link: '/admin',
      },
    ],
  },
  {
    heading: 'Контент',
    items: [
      {
        title: 'Казино',
        icon: 'i-lucide-building-2',
        link: '/admin/casinos',
      },
      {
        title: 'Слоты',
        icon: 'i-lucide-gamepad-2',
        link: '/admin/slots',
      },
      {
        title: 'Статьи',
        icon: 'i-lucide-file-text',
        link: '/admin/articles',
      },
      {
        title: 'Главная',
        icon: 'i-lucide-layout-template',
        link: '/admin/home',
      },
      {
        title: 'Баннеры',
        icon: 'i-lucide-image',
        link: '/admin/banners',
      },
    ],
  },
  {
    heading: 'Операции',
    items: [
      {
        title: 'Бонусы',
        icon: 'i-lucide-gift',
        link: '/admin/bonuses',
      },
      {
        title: 'Отзывы',
        icon: 'i-lucide-message-square',
        link: '/admin/reviews',
      },
      {
        title: 'Жалобы',
        icon: 'i-lucide-shield-alert',
        link: '/admin/complaints',
      },
      {
        title: 'Чёрный список',
        icon: 'i-lucide-ban',
        link: '/admin/blacklist',
      },

      {
        title: 'Партнёры',
        icon: 'i-lucide-handshake',
        link: '/admin/partners',
      },
      {
        title: 'Клики /go/',
        icon: 'i-lucide-mouse-pointer-click',
        link: '/admin/clicks',
      },
      {
        title: 'A/B награды',
        icon: 'i-lucide-chart-column',
        link: '/admin/rewards',
      },
      {
        title: 'Форум',
        icon: 'i-lucide-messages-square',
        link: '/admin/forum',
      },
      {
        title: 'B2B / лиды',
        icon: 'i-lucide-briefcase-business',
        link: '/admin/b2b',
      },
    ],
  },
  {
    heading: 'Команда',
    items: [
      {
        title: 'Канбан',
        icon: 'i-lucide-kanban',
        link: '/admin/kanban',
      },
      {
        title: 'Пользователи',
        icon: 'i-lucide-users',
        link: '/admin/users',
      },
      {
        title: 'Брендинг',
        icon: 'i-lucide-palette',
        link: '/admin/branding',
      },
      {
        title: 'Глоссарий',
        icon: 'i-lucide-book-open-text',
        link: '/admin/glossary',
      },
    ],
  },

  {
    heading: 'Система',
    items: [
      {
        title: 'Ops lite',
        icon: 'i-lucide-activity',
        link: '/admin/ops',
      },
      {
        title: 'Сервер',
        icon: 'i-lucide-server',
        link: '/admin/server',
      },
      {
        title: 'Настройки сайта',
        icon: 'i-lucide-settings',
        link: '/admin/settings',
      },
      {
        title: 'SEO',
        icon: 'i-lucide-search-check',
        link: '/admin/seo',
      },
      {
        title: 'ИИ',
        icon: 'i-lucide-bot',
        link: '/admin/ai',
      },
      {
        title: 'Парсер',
        icon: 'i-lucide-radar',
        link: '/admin/parser',
      },
      {
        title: 'Источники новостей',
        icon: 'i-lucide-rss',
        link: '/admin/news-sources',
      },
      {
        title: 'Награды / payout',
        icon: 'i-lucide-coins',
        link: '/admin/settings/rewards',
      },
    ],
  },
]

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Открыть сайт',
    icon: 'i-lucide-external-link',
    link: '/',
  },
]
