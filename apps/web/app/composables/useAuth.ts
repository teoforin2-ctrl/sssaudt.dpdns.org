export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  role: string
  isStaff: boolean
  casinoId: string | null
}

export type AuthDestination = 'admin' | 'partner' | 'account'

export function useAuth() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const dashboardUrl = (config.public.dashboardUrl as string) || 'http://127.0.0.1:3711'

  const user = useState<AuthUser | null>('auth-user', () => null)
  const loaded = useState('auth-loaded', () => false)

  function destinationFor(u: AuthUser): AuthDestination {
    if (u.isStaff)
      return 'admin'
    if (u.role === 'partner_rep')
      return 'partner'
    return 'account'
  }

  function safeRedirectPath(raw: unknown): string | null {
    if (typeof raw !== 'string')
      return null
    const path = raw.trim()
    // Only same-origin relative paths — no protocol-relative or absolute URLs.
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://'))
      return null
    return path
  }

  function dashboardHref(path: string) {
    const { locale } = useI18n()
    const base = dashboardUrl.replace(/\/$/, '')
    const sep = path.includes('?') ? '&' : '?'
    return `${base}${path}${sep}lang=${locale.value}`
  }

  async function goDestination(dest: AuthDestination) {
    const localePath = useLocalePath()
    const route = useRoute()
    const redirect = safeRedirectPath(route.query.redirect)

    if (dest === 'admin') {
      if (import.meta.client)
        window.location.href = `${dashboardUrl.replace(/\/$/, '')}/admin`
      return
    }
    if (dest === 'partner') {
      if (import.meta.client)
        window.location.href = dashboardHref('/partner')
      return
    }
    if (redirect)
      await navigateTo(redirect)
    else if (import.meta.client)
      window.location.href = dashboardHref('/account')
  }

  async function fetchMe(force = false) {
    if (loaded.value && !force)
      return user.value
    try {
      const res = await $fetch<{ user: AuthUser | null }>('/v1/auth/me', {
        baseURL: apiBase,
        credentials: 'include',
      })
      user.value = res.user ?? null
    }
    catch {
      user.value = null
    }
    finally {
      loaded.value = true
    }
    return user.value
  }

  function guestPlayerId(): string | undefined {
    if (!import.meta.client)
      return undefined
    const m = document.cookie.match(/(?:^|; )rv_player_id=([^;]*)/)
    const raw = m ? decodeURIComponent(m[1]!) : ''
    return /^[0-9a-f-]{36}$/i.test(raw) ? raw : undefined
  }

  function persistPlayerId(id?: string | null) {
    if (!import.meta.client || !id)
      return
    document.cookie = `rv_player_id=${encodeURIComponent(id)}; path=/; max-age=${90 * 86400}; samesite=lax`
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: AuthUser, destination: AuthDestination, playerId?: string | null }>('/v1/auth/login', {
      baseURL: apiBase,
      method: 'POST',
      body: { email, password, playerId: guestPlayerId() },
      credentials: 'include',
    })
    user.value = res.user
    loaded.value = true
    persistPlayerId(res.playerId)
    return res
  }

  async function register(payload: { email: string, password: string, displayName: string }) {
    const res = await $fetch<{ user: AuthUser, destination: AuthDestination, playerId?: string | null }>('/v1/auth/register', {
      baseURL: apiBase,
      method: 'POST',
      body: { ...payload, playerId: guestPlayerId() },
      credentials: 'include',
    })
    user.value = res.user
    loaded.value = true
    persistPlayerId(res.playerId)
    return res
  }

  async function logout() {
    try {
      await $fetch('/v1/auth/logout', {
        baseURL: apiBase,
        method: 'POST',
        credentials: 'include',
      })
    }
    finally {
      user.value = null
      loaded.value = true
    }
  }

  return {
    user,
    loaded,
    fetchMe,
    login,
    register,
    logout,
    goDestination,
    destinationFor,
    dashboardUrl,
  }
}
