<script setup lang="ts">
import type { BulletLegendItemInterface } from '@unovis/ts'
import type { Component } from 'vue'
import { omit } from '@unovis/ts'
import { VisTooltip } from '@unovis/vue'
import { createApp } from 'vue'
import { ChartTooltip } from '.'

const props = defineProps<{
  selector: string
  index: string
  /** Numeric field for donut/pie segment tooltips */
  category?: string
  items?: BulletLegendItemInterface[]
  valueFormatter?: (tick: number, i?: number, ticks?: number[]) => string
  customTooltip?: Component
}>()

function formatValue(value: unknown) {
  const formatter = props.valueFormatter ?? ((tick: number) => `${tick}`)
  if (typeof value === 'number' && Number.isFinite(value))
    return formatter(value)
  if (typeof value === 'string')
    return value
  return '—'
}

// Use weakmap to store reference to each datapoint for Tooltip
const wm = new WeakMap()
function template(d: any, i: number, elements: (HTMLElement | SVGElement)[]) {
  // Donut/pie segments: Unovis wraps source row in `{ data, ...arcProps }`
  if (d?.data && typeof d.data === 'object') {
    const data = d.data
    if (wm.has(data))
      return wm.get(data)

    const label = data[props.index] ?? data.name ?? ''
    const rawValue = props.category
      ? data[props.category]
      : data.value ?? data[props.index]
    const style = getComputedStyle(elements[i]!)
    const omittedData = [{
      name: String(label),
      value: formatValue(rawValue),
      color: style.fill,
    }]
    const componentDiv = document.createElement('div')
    const TooltipComponent = props.customTooltip ?? ChartTooltip
    // eslint-disable-next-line vue/one-component-per-file -- tooltip mount helper
    createApp(TooltipComponent, { title: String(label), data: omittedData }).mount(componentDiv)
    wm.set(data, componentDiv.innerHTML)
    return componentDiv.innerHTML
  }

  if (props.index in d) {
    if (wm.has(d))
      return wm.get(d)

    const componentDiv = document.createElement('div')
    const omittedData = Object.entries(omit(d, [props.index]))
      .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
      .map(([key, value]) => {
        const legendReference = props.items?.find(item => item.name === key)
        return { ...legendReference, name: legendReference?.name ?? key, value: formatValue(value) }
      })
    const TooltipComponent = props.customTooltip ?? ChartTooltip
    // eslint-disable-next-line vue/one-component-per-file -- tooltip mount helper
    createApp(TooltipComponent, { title: String(d[props.index] ?? ''), data: omittedData }).mount(componentDiv)
    wm.set(d, componentDiv.innerHTML)
    return componentDiv.innerHTML
  }

  return ''
}
</script>

<template>
  <VisTooltip
    :horizontal-shift="20" :vertical-shift="20" :triggers="{
      [selector]: template,
    }"
  />
</template>
