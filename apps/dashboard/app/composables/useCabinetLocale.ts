import type { CabinetLang } from '~/i18n/cabinet'
import { cabinetLookup, parseCabinetLang } from '~/i18n/cabinet'

function readCookieRaw(): string | null {
  if (!import.meta.client)
    return null
  const m = document.cookie.match(/(?:^|; )xr_lang=([^;]*)/)
  return m ? decodeURIComponent(m[1]!) : null
}

export function useCabinetLocale() {
  const config = useRuntimeConfig()
  const route = useRoute()
  const webOrigin = String(config.public.siteUrl || 'http://127.0.0.1:3710').replace(/\/$/, '')

  const cookie = useCookie<string>('xr_lang', {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    encode: v => String(v),
    decode: v => String(v),
  })

  const lang = useState<CabinetLang>('cabinet-lang', () => {
    const q = route.query.lang
    if (q === 'en' || q === 'ru')
      return q
    return parseCabinetLang(cookie.value || readCookieRaw())
  })

  function persist(next: CabinetLang) {
    lang.value = next
    cookie.value = next
  }

  watch(
    () => route.query.lang,
    (q) => {
      if (q === 'en' || q === 'ru')
        persist(q)
    },
    { immediate: true },
  )

  function t(key: string, vars?: Record<string, string | number>) {
    return cabinetLookup(lang.value, key, vars)
  }

  const dateLocale = computed(() => (lang.value === 'en' ? 'en-US' : 'ru-RU'))

  function siteUrl(path = '/') {
    const clean = path === '/' ? '' : (path.startsWith('/') ? path : `/${path}`)
    return `${webOrigin}/${lang.value}${clean}`
  }

  function fmtDate(v?: string | null) {
    if (!v)
      return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime()))
      return '—'
    return d.toLocaleDateString(dateLocale.value)
  }

  return { lang, t, persist, dateLocale, siteUrl, webOrigin, fmtDate }
}
