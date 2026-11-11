export function useAdminQueueBadges() {
  const { api } = useApi()
  const { user } = useAuth()

  const enabled = computed(() => {
    const role = user.value?.role
    return role === 'admin' || role === 'developer' || role === 'editor' || role === 'lawyer'
  })

  const { data } = useAsyncData(
    'admin-queue-badges',
    async () => {
      if (!enabled.value)
        return null
      try {
        return await api<{
          reviewsPending: number
          complaintsOpen: number
        }>('/v1/admin/stats', { query: { days: 7 } })
      }
      catch {
        return null
      }
    },
    {
      server: false,
      lazy: true,
      watch: [enabled],
    },
  )

  return {
    reviewsPending: computed(() => data.value?.reviewsPending ?? 0),
    complaintsOpen: computed(() => data.value?.complaintsOpen ?? 0),
  }
}
