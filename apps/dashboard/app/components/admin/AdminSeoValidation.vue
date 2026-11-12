<script setup lang="ts">
export interface SeoIssue {
  level: 'error' | 'warning'
  code: string
  locale?: 'ru' | 'en'
  message: string
}

export interface SeoValidateResult {
  ok: boolean
  blockers: SeoIssue[]
  warnings: SeoIssue[]
}

defineProps<{
  result: SeoValidateResult | null
}>()
</script>

<template>
  <div
    v-if="result && (result.blockers.length || result.warnings.length)"
    class="space-y-2 rounded-xl border p-3"
    :class="result.blockers.length
      ? 'border-destructive/40 bg-destructive/5'
      : 'border-amber-500/30 bg-amber-500/10'"
  >
    <p class="text-sm font-medium">
      {{ result.blockers.length ? 'SEO: публикация заблокирована' : 'SEO: предупреждения' }}
    </p>
    <ul v-if="result.blockers.length" class="space-y-1 text-sm text-destructive">
      <li v-for="(issue, i) in result.blockers" :key="`e-${i}`">
        {{ issue.message }}
      </li>
    </ul>
    <ul v-if="result.warnings.length" class="space-y-1 text-xs text-amber-800 dark:text-amber-200">
      <li v-for="(issue, i) in result.warnings" :key="`w-${i}`">
        {{ issue.message }}
      </li>
    </ul>
  </div>
</template>
