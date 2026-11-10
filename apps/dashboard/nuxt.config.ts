import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Admin / partner cabinet — no SEO SSR needed
  ssr: false,
  devtools: { enabled: true },

  css: ['~/assets/css/tailwind.css'],
  vite: {
    // @tailwindcss/vite may resolve a different Vite major than Nuxt's
    plugins: [tailwindcss() as never],
    build: {
      cssCodeSplit: false,
    },
    optimizeDeps: {
      include: ['md-editor-v3'],
    },
  },

  build: {
    transpile: ['md-editor-v3'],
  },

  devServer: {
    host: '0.0.0.0',
    port: Number(process.env.DASHBOARD_PORT || 3711),
  },

  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],

  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
    '@nuxthub/core',
  ],

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
    componentDir: '~/components/ui',
  },

  colorMode: {
    classSuffix: '',
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
    },
    // Avoid clash with public web app /_fonts on the same domain
    assets: {
      prefix: '/_fonts_dash',
    },
  },

  routeRules: {
    '/': { redirect: '/admin' },
    '/components': { redirect: '/components/accordion' },
    '/settings': { redirect: '/settings/profile' },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:3712',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3710',
    },
  },

  imports: {
    dirs: ['./lib'],
  },

  compatibilityDate: '2026-03-13',

  // Avoid /_nuxt/builds/meta/dev.json 404 noise in local SPA admin
  experimental: {
    appManifest: false,
  },

  nitro: {
    prerender: {
      ignore: [
        '/examples/forms',
        '/terms',
        '/privacy',
        '/components/pagination',
        '/docs',
      ],
    },
  },
  // Local monorepo app (template used github-pages baseURL — removed)
  // Prod (same host as web): NUXT_BUILD_ASSETS_DIR=/_nuxt_dash/ avoids /_nuxt clash
  app: {
    baseURL: '/',
    buildAssetsDir: process.env.NUXT_BUILD_ASSETS_DIR || '/_nuxt/',
    head: {
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
      ],
      link: [
        { rel: 'stylesheet', href: '/critical-boot.css' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/favicon.png' },
      ],
    },
  },
})
