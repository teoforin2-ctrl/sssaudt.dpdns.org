export function useApi() {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase as string

  function api<T>(path: string, opts: Parameters<typeof $fetch<T>>[1] = {}) {
    return $fetch<T>(path, {
      baseURL,
      credentials: 'include',
      ...opts,
    })
  }

  return { api, baseURL }
}
