export interface StaffUser {
  id: string
  email: string
  displayName: string | null
  role: string
  isStaff: boolean
  casinoId: string | null
}

export type AuthDestination = 'admin' | 'partner' | 'account'

export function useAuth() {
  const user = useState<StaffUser | null>('auth-user', () => null)
  const loaded = useState('auth-loaded', () => false)
  const { api } = useApi()
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

  async function fetchMe(force = false) {
    if (loaded.value && !force)
      return user.value
    try {
      const res = await api<{ user: StaffUser }>('/v1/auth/me')
      user.value = res.user
    }
    catch {
      user.value = null
    }
    finally {
      loaded.value = true
    }
    return user.value
  }

  async function login(email: string, password: string) {
    const res = await api<{ user: StaffUser, destination?: AuthDestination }>('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
    loaded.value = true
    return res
  }

  async function logout() {
    try {
      await api('/v1/auth/logout', { method: 'POST' })
    }
    finally {
      user.value = null
      loaded.value = true
    }
  }

  function destinationFor(u: StaffUser): AuthDestination {
    if (u.isStaff)
      return 'admin'
    if (u.role === 'partner_rep')
      return 'partner'
    return 'account'
  }

  async function goDestination(dest: AuthDestination) {
    if (dest === 'admin') {
      await navigateTo('/admin')
      return
    }
    if (dest === 'partner') {
      await navigateTo('/partner')
      return
    }
    if (import.meta.client)
      window.location.href = `${siteUrl.replace(/\/$/, '')}/ru/account`
  }

  return { user, loaded, fetchMe, login, logout, goDestination, destinationFor }
}
