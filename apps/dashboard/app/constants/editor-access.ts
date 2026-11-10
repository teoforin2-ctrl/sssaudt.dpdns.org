/** Admin paths available to role=editor (content + moderation). */
export const EDITOR_ADMIN_ALLOW_PREFIXES = [
  '/admin',
  '/admin/casinos',
  '/admin/slots',
  '/admin/articles',
  '/admin/home',
  '/admin/banners',
  '/admin/bonuses',
  '/admin/reviews',
  '/admin/complaints',
  '/admin/forum',
  '/admin/glossary',
] as const

export function isEditorAdminPathAllowed(path: string): boolean {
  const clean = path.split('?')[0] || path
  if (clean === '/admin')
    return true
  return EDITOR_ADMIN_ALLOW_PREFIXES.some(
    prefix => prefix !== '/admin' && (clean === prefix || clean.startsWith(`${prefix}/`)),
  )
}
