import type { Component } from 'vue'

export type AdminTone = 'cyan' | 'amber' | 'violet' | 'emerald' | 'rose' | 'neutral'

export interface AdminStatCardProps {
  label: string
  value: number
  hint?: string
  delta?: number | null
  /** When previous period was 0 and current > 0 */
  isNew?: boolean
  to?: string
  icon?: Component
  tone?: AdminTone
  ready?: boolean
  index?: number
  locales?: string
}
