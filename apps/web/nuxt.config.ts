import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const criticalCss = readFileSync(join(rootDir, "public/critical.css"), "utf8");

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["@nuxtjs/i18n", "@nuxt/fonts"],

  components: [
    { path: "~/components", pathPrefix: false },
  ],

  css: ["~/assets/css/main.css"],

  // Inline component CSS into SSR HTML — less FOUC after hydration
  features: {
    inlineStyles: true,
  },

  fonts: {
    defaults: {
      weights: [400, 500, 600, 700, 800],
      styles: ["normal"],
    },
    families: [
      {
        name: "Figtree",
        provider: "google",
        weights: [400, 500, 600, 700, 800],
        display: "swap",
        preload: true,
        subsets: ["latin", "cyrillic"],
      },
      {
        name: "Unbounded",
        provider: "google",
        weights: [500, 600, 700, 800],
        display: "swap",
        preload: true,
        subsets: ["latin", "cyrillic"],
      },
    ],
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      // One CSS file → less FOUC from late chunk injection
      cssCodeSplit: false,
    },
    css: {
      devSourcemap: false,
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://127.0.0.1:3712",
      dashboardUrl: process.env.NUXT_PUBLIC_DASHBOARD_URL || "http://127.0.0.1:3711",
      siteName: "SS Audit",
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://127.0.0.1:3710",
      // Staging/local stay noindex unless explicitly enabled for prod crawl.
      allowIndexing: process.env.NUXT_PUBLIC_ALLOW_INDEXING || "false",
    },
  },

  i18n: {
    locales: [
      { code: "ru", language: "ru-RU", name: "Русский", file: "ru.json" },
      { code: "en", language: "en-US", name: "English", file: "en.json" },
    ],
    defaultLocale: "ru",
    lazy: true,
    langDir: "locales",
    strategy: "prefix",
    detectBrowserLanguage: {
      cookieKey: "xr_lang",
      fallbackLocale: "ru",
      useCookie: true,
      redirectOn: "root",
    },
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://127.0.0.1:3710",
  },

  app: {
    head: {
      title: "SS Audit",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "Online casino reviews — SS Audit" },
        { name: "theme-color", content: "#0b0612" },
      ],
      // Styles FIRST (before scripts) — blocks FOUC
      style: [
        {
          innerHTML: criticalCss,
          tagPriority: -30,
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com", tagPriority: -25 },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "", tagPriority: -25 },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      ],
      script: [
        {
          // Sync: hide/blur site before first paint if age gate not accepted
          innerHTML:
            '(function(){try{if(localStorage.getItem("xr_age_gate_ok")!=="1")document.documentElement.classList.add("age-gate-pending")}catch(e){document.documentElement.classList.add("age-gate-pending")}})();',
          tagPriority: -20,
        },
        {
          src: "/theme-boot.js",
          tagPriority: -19,
        },
        {
          src: "/age-gate-boot.js",
          tagPriority: -18,
        },
        {
          // Reveal #__nuxt once Vite/app CSS is present
          src: "/css-ready-boot.js",
          tagPriority: 20,
        },
      ],
      htmlAttrs: {
        "data-theme": "dark",
      },
    },
  },
});
