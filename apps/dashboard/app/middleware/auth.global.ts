import { isEditorAdminPathAllowed } from '~/constants/editor-access'

const PUBLIC_PREFIXES = [
  '/login',
  '/login-basic',
  '/register',
  '/forgot-password',
  '/otp',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
]

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client)
    return

  const isPublic = PUBLIC_PREFIXES.some(
    p => to.path === p || to.path.startsWith(`${p}/`) || to.path.startsWith(`${p}-`),
  )

  const { user, loaded, fetchMe } = useAuth()
  if (!loaded.value)
    await fetchMe()

  if (to.path === '/login' || to.path.startsWith('/login')) {
    if (user.value?.isStaff)
      return navigateTo('/admin')
    if (user.value?.role === 'partner_rep')
      return navigateTo('/partner')
    return
  }

  if (isPublic)
    return

  if (to.path.startsWith('/admin')) {
    if (!user.value?.isStaff)
      return navigateTo('/login')

    const role = user.value.role
    if (role === 'editor') {
      if (!isEditorAdminPathAllowed(to.path))
        return navigateTo('/403')
      return
    }

    if (to.path.startsWith('/admin/kanban') || to.path.startsWith('/admin/server')) {
      if (role !== 'admin' && role !== 'developer')
        return navigateTo('/403')
    }
    if (to.path.startsWith('/admin/branding') || to.path.startsWith('/admin/glossary') || to.path.startsWith('/admin/seo')) {
      if (role !== 'admin' && role !== 'developer')
        return navigateTo('/403')
    }
    return
  }

  if (to.path.startsWith('/partner')) {
    if (!user.value)
      return navigateTo('/login')
    if (!(user.value.isStaff || user.value.role === 'partner_rep'))
      return navigateTo('/login')
  }
})
