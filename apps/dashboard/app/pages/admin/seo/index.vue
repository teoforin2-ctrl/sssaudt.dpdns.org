<script setup lang="ts">
import {
  Activity,
  Bot,
  ExternalLink,
  FileText,
  Globe2,
  ImagePlus,
  Map,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Switch } from '@/components/ui/switch'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

interface SeoLocaleFields {
  title?: string
  description?: string
  h1?: string
}

interface SeoTemplateI18n {
  ru: SeoLocaleFields
  en: SeoLocaleFields
}

interface SeoSettings {
  indexingEnabled: boolean
  canonicalHost: string
  defaultOgImage: string | null
  organizationSameAs: string[]
  aiRetrievalAllow: boolean
  aiTrainingAllow: boolean
  googleSiteVerification?: string
  yandexVerification?: string
  templates: Record<string, SeoTemplateI18n>
}

type TemplateKind = 'home' | 'casino' | 'slot' | 'article' | 'bonuses' | 'catalog' | 'forum'

const tab = ref('crawl')
const templateTab = ref<TemplateKind>('home')
const templateLang = ref<'ru' | 'en'>('ru')

function emptyTpl(): SeoTemplateI18n {
  return { ru: {}, en: {} }
}

function normalizeTpl(raw: unknown): SeoTemplateI18n {
  if (!raw || typeof raw !== 'object')
    return emptyTpl()
  const o = raw as Record<string, unknown>
  if ('ru' in o || 'en' in o) {
    return {
      ru: { ...((o.ru as SeoLocaleFields) || {}) },
      en: { ...((o.en as SeoLocaleFields) || {}) },
    }
  }
  // legacy flat → RU
  return {
    ru: {
      title: typeof o.title === 'string' ? o.title : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      h1: typeof o.h1 === 'string' ? o.h1 : undefined,
    },
    en: {},
  }
}

const { data, pending, error, refresh } = await useAsyncData('admin-seo', () =>
  api<{ seo: SeoSettings }>('/v1/seo'))

const { data: siteData } = await useAsyncData('admin-seo-site-name', () =>
  api<{ settings: { siteName?: string } }>('/v1/admin/site-settings').catch(() => null))

const siteName = computed(() => siteData.value?.settings?.siteName || 'SSS Audit')

const fields = ref<SeoSettings>({
  indexingEnabled: false,
  canonicalHost: 'dfijdsif.website',
  defaultOgImage: '/img/brand/logo.webp',
  organizationSameAs: [],
  aiRetrievalAllow: true,
  aiTrainingAllow: false,
  googleSiteVerification: '',
  yandexVerification: '',
  templates: {
    home: emptyTpl(),
    casino: emptyTpl(),
    slot: emptyTpl(),
    article: emptyTpl(),
    bonuses: emptyTpl(),
    catalog: emptyTpl(),
    forum: emptyTpl(),
  },
})

const sameAsText = ref('')
const ogPreview = ref<string | null>(null)
const ogDataUrl = ref<string | null>(null)
const saving = ref(false)
const saveMsg = ref<string | null>(null)
const saveErr = ref<string | null>(null)
const savedSnapshot = ref('')

const { data: sitemapStatus, refresh: refreshSitemapStatus } = await useAsyncData(
  'admin-seo-sitemap-status',
  () => api<{
    indexingEnabled: boolean
    totalUrls: number
    counts: Record<string, number>
    note: string
  }>('/v1/admin/seo/sitemap-status').catch(() => null),
)

const { data: pipelineStatus, refresh: refreshPipeline } = await useAsyncData(
  'admin-seo-pipeline',
  () => api<{
    indexNowKey: string | null
    keyFileUrl: string | null
    events: Array<{
      at: string
      action: string
      kind: string
      slug: string
      urls: string[]
      indexNow?: { ok: boolean, status?: number, error?: string }
      cacheBump?: { ok: boolean }
      cloudflare?: { ok: boolean, skipped?: boolean, error?: string }
    }>
  }>('/v1/admin/seo/pipeline').catch(() => null),
)

const { data: monitorStatus, refresh: refreshMonitor } = await useAsyncData(
  'admin-seo-monitor',
  () => api<{
    windowDays: number
    samples: number
    p75: { lcpMs: number | null, inpMs: number | null, cls: number | null, ttfbMs: number | null }
    bots: Array<{ bot: string, hits: number }>
    botTotal: number
    alerts: string[]
  }>('/v1/admin/seo/monitor').catch(() => null),
)

const pinging = ref(false)
async function pingIndexNowHome() {
  pinging.value = true
  try {
    await api('/v1/admin/seo/pipeline/ping', {
      method: 'POST',
      body: { kind: 'home', slug: '' },
    })
    await refreshPipeline()
    toast.success('IndexNow ping отправлен (или записан в журнал)')
  }
  catch {
    toast.error('IndexNow ping не удался')
  }
  finally {
    pinging.value = false
  }
}

function assetUrl(path: string | null | undefined) {
  if (!path)
    return ''
  if (path.startsWith('data:') || path.startsWith('http'))
    return path
  return `${webOrigin}${path}`
}

function applySeo(seo: SeoSettings) {
  fields.value = {
    indexingEnabled: !!seo.indexingEnabled,
    canonicalHost: seo.canonicalHost || 'dfijdsif.website',
    defaultOgImage: seo.defaultOgImage,
    organizationSameAs: [...(seo.organizationSameAs || [])],
    aiRetrievalAllow: seo.aiRetrievalAllow !== false,
    aiTrainingAllow: !!seo.aiTrainingAllow,
    googleSiteVerification: seo.googleSiteVerification || '',
    yandexVerification: seo.yandexVerification || '',
    templates: {
      home: normalizeTpl(seo.templates?.home),
      casino: normalizeTpl(seo.templates?.casino),
      slot: normalizeTpl(seo.templates?.slot),
      article: normalizeTpl(seo.templates?.article),
      bonuses: normalizeTpl(seo.templates?.bonuses),
      catalog: normalizeTpl(seo.templates?.catalog),
      forum: normalizeTpl(seo.templates?.forum),
    },
  }
  sameAsText.value = (seo.organizationSameAs || []).join('\n')
  ogPreview.value = seo.defaultOgImage
  ogDataUrl.value = null
}

function snapshotNow() {
  return JSON.stringify({
    indexingEnabled: fields.value.indexingEnabled,
    canonicalHost: fields.value.canonicalHost,
    defaultOgImage: fields.value.defaultOgImage,
    ogDataUrl: ogDataUrl.value,
    sameAsText: sameAsText.value,
    aiRetrievalAllow: fields.value.aiRetrievalAllow,
    aiTrainingAllow: fields.value.aiTrainingAllow,
    googleSiteVerification: fields.value.googleSiteVerification,
    yandexVerification: fields.value.yandexVerification,
    templates: fields.value.templates,
  })
}

function readImage(file: File, maxBytes = 8_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Нужен файл изображения (PNG/JPEG/WebP)'))
      return
    }
    if (file.size > maxBytes) {
      reject(new Error('Файл слишком большой (макс. ~8 МБ)'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

async function onOgPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const dataUrl = await readImage(file)
    ogDataUrl.value = dataUrl
    ogPreview.value = dataUrl
    saveErr.value = null
  }
  catch (err: unknown) {
    saveErr.value = err instanceof Error ? err.message : 'Ошибка файла'
    toast.error(saveErr.value)
  }
}

watch(
  () => data.value?.seo,
  (seo) => {
    if (!seo)
      return
    applySeo(seo)
    nextTick(() => {
      savedSnapshot.value = snapshotNow()
    })
  },
  { immediate: true },
)

const dirty = computed(() => {
  if (!savedSnapshot.value)
    return false
  return snapshotNow() !== savedSnapshot.value
})

function resetForm() {
  const seo = data.value?.seo
  if (!seo)
    return
  applySeo(seo)
  saveMsg.value = null
  saveErr.value = null
  savedSnapshot.value = snapshotNow()
}

/** Mirrors API defaultSeoSettings — shown as placeholders when admin fields are empty. */
const PLATFORM_DEFAULTS: Record<TemplateKind, SeoTemplateI18n> = {
  home: {
    ru: {
      title: 'Обзоры онлайн-казино 2026 — рейтинг, бонусы и отзывы — {siteName}',
      description: 'Редакционные обзоры казино: бонусы, выплаты, отзывы игроков. Честные оценки без обещаний выигрыша. 18+',
      h1: 'Рейтинг онлайн-казино',
    },
    en: {
      title: 'Online casino reviews 2026 — rankings, bonuses & ratings — {siteName}',
      description: 'Editorial casino reviews: bonuses, payouts, player feedback. Honest scores with no win promises. 18+',
      h1: 'Online casino ranking',
    },
  },
  casino: {
    ru: {
      title: '{casino} — обзор и отзывы игроков 2026 — {siteName}',
      description: 'Обзор {casino}: бонусы, выплаты, лицензия. Отзывы игроков и редакционная оценка. 18+',
      h1: '{casino} — обзор',
    },
    en: {
      title: '{casino} review & player ratings 2026 — {siteName}',
      description: '{casino} review: bonuses, payouts, licence. Player feedback and editorial score. 18+',
      h1: '{casino} review',
    },
  },
  slot: {
    ru: {
      title: '{slot} — обзор слота, RTP и демо — {siteName}',
      description: 'Обзор слота {slot}: RTP, волатильность, провайдер и демо. Где поиграть онлайн. 18+',
      h1: '{slot}',
    },
    en: {
      title: '{slot} slot review, RTP & demo — {siteName}',
      description: '{slot} slot review: RTP, volatility, provider and demo. Where to play online. 18+',
      h1: '{slot}',
    },
  },
  article: {
    ru: {
      title: '{article} — {siteName}',
      description: '{article}. Экспертный материал редакции {siteName}. 18+',
      h1: '{article}',
    },
    en: {
      title: '{article} — {siteName}',
      description: '{article}. Editorial guide from {siteName}. 18+',
      h1: '{article}',
    },
  },
  bonuses: {
    ru: {
      title: 'Бонусы казино 2026 — промокоды и фриспины — {siteName}',
      description: 'Актуальные бонусы казино: вейджер, промокоды, бездепозитные и фриспины. Проверено редакцией. 18+',
      h1: 'Бонусы казино',
    },
    en: {
      title: 'Casino bonuses 2026 — promo codes & free spins — {siteName}',
      description: 'Current casino bonuses: wagering, promo codes, no-deposit and free spins. Editor-checked. 18+',
      h1: 'Casino bonuses',
    },
  },
  catalog: {
    ru: {
      title: 'Рейтинг казино — {siteName}',
      description: 'Полный рейтинг онлайн-казино с оценками редакции и отзывами игроков. 18+',
      h1: 'Рейтинг казино',
    },
    en: {
      title: 'Casino ranking — {siteName}',
      description: 'Full online casino ranking with editorial scores and player reviews. 18+',
      h1: 'Casino ranking',
    },
  },
  forum: {
    ru: {
      title: 'Форум игроков — {siteName}',
      description: 'Обсуждения казино, бонусов и выплат на форуме {siteName}. 18+',
      h1: 'Форум',
    },
    en: {
      title: 'Player forum — {siteName}',
      description: 'Casino, bonus and payout discussions on the {siteName} forum. 18+',
      h1: 'Forum',
    },
  },
}

function fillTemplate(raw: string | undefined, vars: Record<string, string>, fallback: string) {
  const src = (raw || '').trim() || fallback
  return src.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

const previewVars = computed(() => ({
  siteName: siteName.value,
  casino: 'Demo Casino',
  slot: 'Book of Demo',
  article: 'How to choose a casino',
}))

watch(templateTab, (kind) => {
  if (!fields.value.templates[kind])
    fields.value.templates[kind] = emptyTpl()
  if (!fields.value.templates[kind].ru)
    fields.value.templates[kind].ru = {}
  if (!fields.value.templates[kind].en)
    fields.value.templates[kind].en = {}
}, { immediate: true })

function ensureTplLocale(kind: TemplateKind, lang: 'ru' | 'en'): SeoLocaleFields {
  if (!fields.value.templates[kind])
    fields.value.templates[kind] = emptyTpl()
  const block = fields.value.templates[kind]!
  if (!block[lang])
    block[lang] = {}
  return block[lang]
}

const activeTpl = computed(() => ensureTplLocale(templateTab.value, templateLang.value))

const editTitle = computed({
  get: () => activeTpl.value.title ?? '',
  set: (v: string) => {
    ensureTplLocale(templateTab.value, templateLang.value).title = v
  },
})
const editDescription = computed({
  get: () => activeTpl.value.description ?? '',
  set: (v: string) => {
    ensureTplLocale(templateTab.value, templateLang.value).description = v
  },
})
const editH1 = computed({
  get: () => activeTpl.value.h1 ?? '',
  set: (v: string) => {
    ensureTplLocale(templateTab.value, templateLang.value).h1 = v
  },
})

const activeDefaults = computed(() => {
  const kind = templateTab.value
  const lang = templateLang.value
  return PLATFORM_DEFAULTS[kind]?.[lang] || {}
})

const serpPreview = computed(() => {
  const kind = templateTab.value
  const lang = templateLang.value
  const tpl = activeTpl.value
  const defs = activeDefaults.value
  const title = fillTemplate(tpl.title, previewVars.value, defs.title || '{siteName}')
  const description = fillTemplate(
    tpl.description,
    previewVars.value,
    defs.description || (lang === 'en' ? 'Editorial page on {siteName}.' : 'Редакционная страница на {siteName}.'),
  )
  const host = (fields.value.canonicalHost || 'example.com').replace(/^https?:\/\//, '')
  const pathMap: Record<string, string> = {
    home: lang === 'en' ? '/en' : '/',
    casino: lang === 'en' ? '/en/casino/demo-casino' : '/ru/casino/demo-casino',
    slot: lang === 'en' ? '/en/slots/demo-slot' : '/ru/slots/demo-slot',
    article: lang === 'en' ? '/en/articles/demo' : '/ru/articles/demo',
    bonuses: lang === 'en' ? '/en/bonuses' : '/ru/bonuses',
    catalog: lang === 'en' ? '/en/rating' : '/ru/rating',
    forum: lang === 'en' ? '/en/forum' : '/ru/forum',
  }
  return {
    title: title.slice(0, 70),
    description: description.slice(0, 160),
    url: `https://${host}${pathMap[kind] || '/'}`,
  }
})

const robotsUrl = computed(() => `${webOrigin}/robots.txt`)
const sitemapUrl = computed(() => `${webOrigin}/sitemap.xml`)
const sitemapChunks = [
  'pages-ru',
  'casinos-ru',
  'slots-ru',
  'articles-ru',
  'bonuses-ru',
  'forum-ru',
] as const
function chunkUrl(name: string) {
  return `${webOrigin}/sitemaps/${name}.xml`
}

const inputClass
  = 'border-input bg-background/60 flex h-10 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]'
const textareaClass
  = 'border-input bg-background/60 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]'

async function save() {
  saving.value = true
  saveMsg.value = null
  saveErr.value = null
  try {
    const organizationSameAs = sameAsText.value
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20)

    const body: Record<string, unknown> = {
      indexingEnabled: fields.value.indexingEnabled,
      canonicalHost: fields.value.canonicalHost.trim(),
      organizationSameAs,
      aiRetrievalAllow: fields.value.aiRetrievalAllow,
      aiTrainingAllow: fields.value.aiTrainingAllow,
      googleSiteVerification: fields.value.googleSiteVerification || '',
      yandexVerification: fields.value.yandexVerification || '',
      templates: fields.value.templates,
    }
    if (ogDataUrl.value)
      body.defaultOgImageDataUrl = ogDataUrl.value
    else if (fields.value.defaultOgImage)
      body.defaultOgImage = fields.value.defaultOgImage

    const res = await api<{ seo: SeoSettings }>('/v1/admin/seo', {
      method: 'PATCH',
      body,
    })
    if (res?.seo)
      applySeo(res.seo)
    await refresh()
    await refreshSitemapStatus()
    saveMsg.value = fields.value.indexingEnabled
      ? 'Сохранено. Индексация включена.'
      : 'Сохранено. Индексация выключена (noindex).'
    toast.success(saveMsg.value)
    nextTick(() => {
      savedSnapshot.value = snapshotNow()
    })
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    saveErr.value = e?.data?.error ? `Ошибка: ${e.data.error}` : (e?.message || 'Ошибка сохранения')
    toast.error(saveErr.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 pb-28">
    <AdminPageHeader
      title="SEO"
      description="Индексация, canonical, шаблоны мета и политика AI-ботов"
      help="seo"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          as-child
        >
          <NuxtLink to="/admin/settings">
            <Settings2 class="size-4" />
            Бренд
          </NuxtLink>
        </Button>
        <Button
          variant="outline"
          size="sm"
          as-child
        >
          <a
            :href="robotsUrl"
            target="_blank"
            rel="noopener"
          >
            <FileText class="size-4" />
            robots.txt
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          as-child
        >
          <a
            :href="sitemapUrl"
            target="_blank"
            rel="noopener"
          >
            <Map class="size-4" />
            sitemap
          </a>
        </Button>
      </template>
    </AdminPageHeader>

    <AdminFormSkeleton v-if="pending && !data" :fields="6" />
    <AdminUiAdminEmptyState
      v-else-if="error"
      title="Не удалось загрузить SEO"
      description="Проверьте API и миграцию seo_settings, затем обновите страницу."
    />

    <div
      v-else
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <form class="min-w-0 space-y-4" @submit.prevent="save">
        <section
          class="relative overflow-hidden rounded-2xl border p-4 sm:p-5"
          :class="fields.indexingEnabled
            ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-card to-card'
            : 'border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-card to-card'"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 items-start gap-3">
              <div
                class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1"
                :class="fields.indexingEnabled
                  ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300'"
              >
                <ShieldCheck v-if="fields.indexingEnabled" class="size-5" />
                <ShieldAlert v-else class="size-5" />
              </div>
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold tracking-tight">
                    Индексация поисковиками
                  </h2>
                  <Badge
                    variant="outline"
                    :class="fields.indexingEnabled
                      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-500/40 text-amber-800 dark:text-amber-300'"
                  >
                    {{ fields.indexingEnabled ? 'index,follow' : 'noindex' }}
                  </Badge>
                </div>
                <p class="max-w-prose text-sm text-muted-foreground">
                  Главный тумблер. Выкл = meta noindex + X-Robots-Tag + robots Disallow: / на всём домене.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 rounded-xl border bg-background/70 px-3 py-2 shadow-xs">
              <span
                class="text-sm font-medium"
                :class="fields.indexingEnabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'"
              >
                {{ fields.indexingEnabled ? 'Открыто' : 'Закрыто' }}
              </span>
              <Switch
                :model-value="fields.indexingEnabled"
                @update:model-value="(v: boolean) => { fields.indexingEnabled = v }"
              />
            </div>
          </div>
          <p
            v-if="!fields.indexingEnabled"
            class="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
          >
            Сайт скрыт от Google/Яндекс. Включайте только когда мета, canonical и sitemap готовы.
          </p>
        </section>

        <Tabs v-model="tab" class="w-full">
          <TabsList class="grid w-full grid-cols-2 sm:w-auto sm:inline-flex sm:grid-cols-none">
            <TabsTrigger value="crawl">
              Хост и OG
            </TabsTrigger>
            <TabsTrigger value="verify">
              GSC / Яндекс
            </TabsTrigger>
            <TabsTrigger value="ai">
              AI-боты
            </TabsTrigger>
            <TabsTrigger value="templates">
              Шаблоны
            </TabsTrigger>
            <TabsTrigger value="monitor">
              Мониторинг
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crawl" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <Globe2 class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Canonical и Open Graph
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Хост без протокола — для canonical, sitemap и robots
                  </p>
                </div>
              </div>
              <div class="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <div class="grid gap-2 sm:col-span-2">
                  <Label>Canonical host</Label>
                  <input
                    v-model="fields.canonicalHost"
                    maxlength="253"
                    placeholder="dfijdsif.website"
                    :class="inputClass"
                  >
                  <p class="text-xs text-muted-foreground">
                    Без https:// — для canonical, sitemap и robots
                  </p>
                </div>

                <div class="grid gap-2 sm:col-span-2">
                  <Label>Default og:image (1200×630)</Label>
                  <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <label class="group relative grid cursor-pointer gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-medium">Загрузить изображение</span>
                        <ImagePlus class="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
                      </div>
                      <p class="text-xs text-muted-foreground">
                        PNG / JPEG / WebP · на сервере обрежется до 1200×630 и сохранится как WebP
                      </p>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="absolute inset-0 h-full cursor-pointer opacity-0"
                        @change="onOgPick"
                      />
                    </label>
                    <div class="overflow-hidden rounded-xl border bg-muted/20 ring-1 ring-border/50">
                      <div class="aspect-[1200/630] bg-[linear-gradient(135deg,#1a1224,#0b0612)]">
                        <img
                          v-if="ogPreview"
                          :src="assetUrl(ogPreview)"
                          alt="og:image preview"
                          class="size-full object-cover"
                        >
                        <div
                          v-else
                          class="flex size-full items-center justify-center text-xs text-muted-foreground"
                        >
                          Нет изображения
                        </div>
                      </div>
                      <p
                        v-if="fields.defaultOgImage && !ogDataUrl"
                        class="truncate border-t px-2 py-1.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {{ fields.defaultOgImage }}
                      </p>
                      <p
                        v-else-if="ogDataUrl"
                        class="border-t px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300"
                      >
                        Новое · сохранится при Save
                      </p>
                    </div>
                  </div>
                </div>

                <div class="grid gap-2 sm:col-span-2">
                  <Label>Organization sameAs</Label>
                  <textarea
                    v-model="sameAsText"
                    rows="4"
                    placeholder="https://t.me/…&#10;https://vk.com/…"
                    :class="textareaClass"
                  />
                  <p class="text-xs text-muted-foreground">
                    По одному URL на строку · до 20 · уходит в JSON-LD Organization
                  </p>
                </div>
              </div>
            </section>

            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <Map class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Sitemap
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Живая генерация из БД · индекс + чанки сущностей
                  </p>
                </div>
              </div>
              <div class="space-y-3 p-4 sm:p-5">
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p class="text-2xl font-semibold tabular-nums tracking-tight">
                      {{ sitemapStatus?.totalUrls?.toLocaleString('ru-RU') ?? '—' }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      URL в потенциальном sitemap (ru+en)
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    :class="fields.indexingEnabled
                      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-500/40 text-amber-800 dark:text-amber-300'"
                  >
                    {{ fields.indexingEnabled ? 'индексация on · полный crawl' : 'индексация off · sitemap всё равно полный' }}
                  </Badge>
                </div>
                <div
                  v-if="sitemapStatus?.counts"
                  class="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  <div
                    v-for="(n, key) in sitemapStatus.counts"
                    :key="key"
                    class="rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {{ key }}
                    </p>
                    <p class="text-sm font-semibold tabular-nums">
                      {{ n.toLocaleString('ru-RU') }}
                    </p>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ sitemapStatus?.note || 'Sitemap собирается на лету из БД — отдельной кнопки «сгенерировать» нет.' }}
                </p>
                <div class="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-xs font-medium">
                      IndexNow / SEO pipeline
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      :disabled="pinging"
                      @click="pingIndexNowHome"
                    >
                      {{ pinging ? 'Ping…' : 'Ping главную' }}
                    </Button>
                  </div>
                  <p class="text-[11px] text-muted-foreground">
                    Ключ:
                    <code class="font-mono">{{ pipelineStatus?.indexNowKey || '—' }}</code>
                    · файл
                    <code class="font-mono">{{ pipelineStatus?.keyFileUrl || '—' }}</code>
                    · ping при publish казино/слот/статья (если индексация включена)
                  </p>
                  <ul
                    v-if="pipelineStatus?.events?.length"
                    class="max-h-28 space-y-1 overflow-auto text-[11px] text-muted-foreground"
                  >
                    <li
                      v-for="(ev, i) in pipelineStatus.events.slice(0, 8)"
                      :key="i"
                    >
                      {{ ev.at.slice(11, 19) }} · {{ ev.action }} · {{ ev.kind }}/{{ ev.slug || '—' }}
                      ·
                      <span :class="ev.indexNow?.ok ? 'text-emerald-600' : 'text-amber-700'">
                        {{ ev.indexNow?.ok ? 'ok' : (ev.indexNow?.error || '—') }}
                      </span>
                      <span v-if="ev.cacheBump" class="text-muted-foreground">
                        · cache {{ ev.cacheBump.ok ? 'bump' : 'fail' }}
                      </span>
                      <span v-if="ev.cloudflare && !ev.cloudflare.skipped">
                        · CF {{ ev.cloudflare.ok ? 'purge' : (ev.cloudflare.error || 'fail') }}
                      </span>
                    </li>
                  </ul>
                </div>
                <p class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  Локально открывайте ссылки ниже (на <code class="font-mono">{{ webOrigin }}</code>).
                  На проде <code class="font-mono">dfijdsif.website/sitemap.xml</code> сейчас 404 —
                  нужен деплой web middleware + Caddy proxy на API.
                </p>
                <div class="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    as-child
                  >
                    <a
                      :href="sitemapUrl"
                      target="_blank"
                      rel="noopener"
                    >
                      <ExternalLink class="size-4" />
                      Индекс sitemap.xml
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    @click="refreshSitemapStatus()"
                  >
                    Обновить счётчики
                  </Button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <a
                    v-for="name in sitemapChunks"
                    :key="name"
                    :href="chunkUrl(name)"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center rounded-md border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {{ name }}.xml
                  </a>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="verify" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <ShieldCheck class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Верификация Search Console и Вебмастера
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Коды из кабинетов → meta в &lt;head&gt;. Sitemap уже отдаётся на /sitemap.xml
                  </p>
                </div>
              </div>
              <div class="grid gap-4 p-4 sm:p-5">
                <div class="grid gap-2">
                  <Label>Google Search Console (google-site-verification)</Label>
                  <input
                    v-model="fields.googleSiteVerification"
                    maxlength="200"
                    placeholder="токен из HTML-тега"
                    :class="inputClass"
                  >
                </div>
                <div class="grid gap-2">
                  <Label>Яндекс.Вебмастер (yandex-verification)</Label>
                  <input
                    v-model="fields.yandexVerification"
                    maxlength="200"
                    placeholder="токен из HTML-тега"
                    :class="inputClass"
                  >
                </div>
                <ol class="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                  <li>Добавьте domain-property <code class="font-mono">dfijdsif.website</code> в GSC и Вебмастере.</li>
                  <li>Вставьте токены сюда и сохраните.</li>
                  <li>Отправьте <a :href="sitemapUrl" target="_blank" rel="noopener" class="underline">sitemap.xml</a>.</li>
                  <li>Регион в Яндексе: Россия. «Переезд сайта» — после 301 со старого домена.</li>
                </ol>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="ai" class="mt-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <Bot class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Политика AI-ботов
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Пишется в robots.txt отдельно от классического crawl
                  </p>
                </div>
              </div>
              <div class="divide-y">
                <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                  <div>
                    <p class="text-sm font-medium">
                      Retrieval
                    </p>
                    <p class="text-xs text-muted-foreground">
                      ChatGPT Search, Perplexity, Claude — цитирование в ответах
                    </p>
                  </div>
                  <Switch
                    :model-value="fields.aiRetrievalAllow"
                    @update:model-value="(v: boolean) => { fields.aiRetrievalAllow = v }"
                  />
                </div>
                <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                  <div>
                    <p class="text-sm font-medium">
                      Training
                    </p>
                    <p class="text-xs text-muted-foreground">
                      GPTBot, ClaudeBot, Google-Extended — обучение моделей
                    </p>
                  </div>
                  <Switch
                    :model-value="fields.aiTrainingAllow"
                    @update:model-value="(v: boolean) => { fields.aiTrainingAllow = v }"
                  />
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="templates" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="border-b bg-muted/30 px-4 py-3 sm:px-5">
                <h2 class="text-sm font-semibold">
                  Шаблоны мета
                </h2>
                <p class="text-xs text-muted-foreground">
                  Отдельные RU / EN для каждой локали сайта.
                  Переменные:
                  <code class="rounded bg-muted px-1">{siteName}</code>
                  <code class="rounded bg-muted px-1">{casino}</code>
                  <code class="rounded bg-muted px-1">{slot}</code>
                  <code class="rounded bg-muted px-1">{article}</code>.
                  Пустое поле → дефолт платформы для этой локали.
                </p>
              </div>
              <div class="space-y-4 p-4 sm:p-5">
                <Tabs v-model="templateTab">
                  <TabsList class="flex h-auto flex-wrap gap-1">
                    <TabsTrigger value="home">
                      Главная
                    </TabsTrigger>
                    <TabsTrigger value="casino">
                      Казино
                    </TabsTrigger>
                    <TabsTrigger value="slot">
                      Слот
                    </TabsTrigger>
                    <TabsTrigger value="article">
                      Статья
                    </TabsTrigger>
                    <TabsTrigger value="bonuses">
                      Бонусы
                    </TabsTrigger>
                    <TabsTrigger value="catalog">
                      Рейтинг
                    </TabsTrigger>
                    <TabsTrigger value="forum">
                      Форум
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div class="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
                  <button
                    type="button"
                    class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                    :class="templateLang === 'ru' ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                    @click="templateLang = 'ru'"
                  >
                    RU
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                    :class="templateLang === 'en' ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                    @click="templateLang = 'en'"
                  >
                    EN
                  </button>
                </div>

                <div class="grid gap-3">
                  <div class="grid gap-2">
                    <Label>Title ({{ templateLang.toUpperCase() }})</Label>
                    <input
                      v-model="editTitle"
                      :placeholder="activeDefaults.title || '{siteName}'"
                      :class="inputClass"
                    >
                  </div>
                  <div class="grid gap-2">
                    <Label>Description ({{ templateLang.toUpperCase() }})</Label>
                    <textarea
                      v-model="editDescription"
                      rows="3"
                      :placeholder="activeDefaults.description || (templateLang === 'en' ? 'Meta description' : 'Мета-описание')"
                      :class="textareaClass"
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label>H1 ({{ templateLang.toUpperCase() }})</Label>
                    <input
                      v-model="editH1"
                      :placeholder="activeDefaults.h1 || 'H1'"
                      :class="inputClass"
                    >
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="monitor" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <div class="flex items-center gap-2">
                  <Activity class="size-4 text-muted-foreground" />
                  <div>
                    <h2 class="text-sm font-semibold">
                      Полевые CWV и боты (7 дней)
                    </h2>
                    <p class="text-xs text-muted-foreground">
                      Первая сторона: LCP/INP/CLS с браузеров + обходы по User-Agent
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  @click="refreshMonitor()"
                >
                  Обновить
                </Button>
              </div>
              <div class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <div class="rounded-xl border bg-muted/20 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Samples
                  </p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ monitorStatus?.samples ?? 0 }}
                  </p>
                </div>
                <div class="rounded-xl border bg-muted/20 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    LCP p75
                  </p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ monitorStatus?.p75?.lcpMs != null ? `${monitorStatus.p75.lcpMs} ms` : '—' }}
                  </p>
                </div>
                <div class="rounded-xl border bg-muted/20 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    INP p75
                  </p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ monitorStatus?.p75?.inpMs != null ? `${monitorStatus.p75.inpMs} ms` : '—' }}
                  </p>
                </div>
                <div class="rounded-xl border bg-muted/20 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    CLS p75
                  </p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ monitorStatus?.p75?.cls != null ? monitorStatus.p75.cls : '—' }}
                  </p>
                </div>
                <div class="rounded-xl border bg-muted/20 px-3 py-2 sm:col-span-2">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Боты (hits)
                  </p>
                  <p class="text-sm">
                    {{ monitorStatus?.botTotal ?? 0 }}
                    <span
                      v-for="b in (monitorStatus?.bots || [])"
                      :key="b.bot"
                      class="ml-2 font-mono text-xs text-muted-foreground"
                    >
                      {{ b.bot }} {{ b.hits }}
                    </span>
                  </p>
                </div>
                <div
                  v-if="monitorStatus?.alerts?.length"
                  class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 sm:col-span-2"
                >
                  <p
                    v-for="(a, i) in monitorStatus.alerts"
                    :key="i"
                  >
                    {{ a }}
                  </p>
                </div>
                <p class="text-xs text-muted-foreground sm:col-span-2">
                  Клики GSC и ИКС Яндекса появятся после подключения кабинетов (T19). CrUX — когда property наберёт трафик.
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </form>

      <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div class="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
            <span class="text-xs font-medium text-muted-foreground">Превью в выдаче</span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="lang in (['ru', 'en'] as const)"
                :key="lang"
                type="button"
                class="rounded-md px-2 py-0.5 text-[11px] uppercase transition-colors"
                :class="templateLang === lang ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                @click="templateLang = lang; tab = 'templates'"
              >
                {{ lang }}
              </button>
              <span class="mx-0.5 text-muted-foreground/40">·</span>
              <button
                v-for="kind in (['home', 'casino', 'slot', 'article', 'bonuses', 'catalog', 'forum'] as const)"
                :key="kind"
                type="button"
                class="rounded-md px-2 py-0.5 text-[11px] capitalize transition-colors"
                :class="templateTab === kind ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                @click="templateTab = kind; tab = 'templates'"
              >
                {{ kind }}
              </button>
            </div>
          </div>
          <div class="space-y-2 p-4">
            <p class="truncate text-lg leading-snug text-[#1a0dab] dark:text-blue-400">
              {{ serpPreview.title }}
            </p>
            <p class="truncate text-xs text-emerald-700 dark:text-emerald-400">
              {{ serpPreview.url }}
            </p>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ serpPreview.description }}
            </p>
            <div
              v-if="!fields.indexingEnabled"
              class="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200"
            >
              В выдаче не появится, пока индексация выключена
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border bg-card">
          <div class="border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Быстрые ссылки
          </div>
          <div class="grid gap-1 p-2">
            <a
              :href="robotsUrl"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <FileText class="size-4 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">robots.txt</span>
              <ExternalLink class="size-3.5 text-muted-foreground" />
            </a>
            <a
              :href="sitemapUrl"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <Map class="size-4 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">sitemap.xml</span>
              <ExternalLink class="size-3.5 text-muted-foreground" />
            </a>
            <NuxtLink
              to="/admin/settings"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <Settings2 class="size-4 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">Название и логотип</span>
            </NuxtLink>
          </div>
        </div>
      </aside>
    </div>

    <AdminUiAdminStickySaveBar
      :dirty="dirty"
      :saving="saving"
      :message="saveMsg"
      :error="saveErr"
      @save="save"
      @reset="resetForm"
    />
  </div>
</template>
