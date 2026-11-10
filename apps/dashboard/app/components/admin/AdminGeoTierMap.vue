<script setup lang="ts">
import type { GeoTierId } from '~/constants/geo-tiers'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import {
  GEO_COUNTRY_OVERRIDES,
  GEO_RESTRICTED_GROUPS,
  GEO_TERRITORY_NOTES,
  GEO_TIERS,
  isRestrictedTier,
  normalizeId,
  resolveCountryTier,
  tierMeta,
} from '~/constants/geo-tiers'

interface AreaDatum {
  id: string
  name: string
  tier: GeoTierId
  color: string
  note?: string
  path?: string
}

const loadError = ref('')
const loading = ref(true)
const filterTier = ref<GeoTierId | 'all'>('all')
const q = ref('')
const selected = ref<AreaDatum | null>(null)
const hoverId = ref<string | null>(null)
const areas = ref<AreaDatum[]>([])
const viewBox = ref('0 0 960 480')

onMounted(async () => {
  try {
    const res = await fetch('/docs/countries-110m.json')
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`)
    const topo = await res.json()
    const countries = feature(topo, topo.objects.countries) as unknown as {
      features: Array<{
        id?: string | number
        properties?: { name?: string }
        type: string
        geometry: unknown
      }>
    }
    const projection = geoNaturalEarth1().fitSize([960, 480], countries as any)
    const pathGen = geoPath(projection)

    areas.value = countries.features
      .filter(f => f.id != null)
      .map((f) => {
        const id = normalizeId(f.id)
        const base = resolveCountryTier(id)
        const enName = f.properties?.name || base.name
        const meta = tierMeta(base.tier)
        return {
          id,
          name: base.name.startsWith('Country ') ? enName : base.name,
          tier: base.tier,
          color: meta.color,
          note: base.note,
          path: pathGen(f as any) || '',
        } satisfies AreaDatum
      })
      .filter(a => a.path)
  }
  catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось загрузить карту'
  }
  finally {
    loading.value = false
  }
})

const visibleAreas = computed(() => {
  if (filterTier.value === 'all')
    return areas.value
  return areas.value
})

function fillFor(a: AreaDatum) {
  if (filterTier.value !== 'all' && a.tier !== filterTier.value)
    return 'rgba(148,163,184,.18)'
  return a.color
}

const filteredList = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return areas.value
    .filter((a) => {
      if (filterTier.value !== 'all' && a.tier !== filterTier.value)
        return false
      if (!needle)
        return true
      return a.name.toLowerCase().includes(needle) || a.id.includes(needle)
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})

const counts = computed(() => {
  const m = Object.fromEntries(GEO_TIERS.map(t => [t.id, 0])) as Record<GeoTierId, number>
  for (const a of areas.value)
    m[a.tier] = (m[a.tier] || 0) + 1
  return m
})

const active = computed(() => {
  if (selected.value)
    return selected.value
  if (!hoverId.value)
    return null
  return areas.value.find(a => a.id === hoverId.value) || null
})

function pickByName(name: string) {
  const clean = name.split('(')[0]!.trim()
  const fromOverride = GEO_COUNTRY_OVERRIDES.find(c => c.name === clean || name.startsWith(c.name))
  if (fromOverride) {
    const found = areas.value.find(a => a.id === normalizeId(fromOverride.id))
    selected.value = found || {
      id: normalizeId(fromOverride.id),
      name: fromOverride.name,
      tier: fromOverride.tier,
      color: tierMeta(fromOverride.tier).color,
      note: fromOverride.note,
    }
    return
  }
  const found = areas.value.find(a => a.name === clean)
  if (found)
    selected.value = found
}
</script>

<template>
  <div class="space-y-4">
    <div class="group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5">
      <div class="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div class="relative flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold tracking-tight">
            Карта TIER стран
          </h2>
          <p class="max-w-2xl text-sm text-muted-foreground">
            Кликни страну или найди в списке. Россия — «осторожно», не бан.
          </p>
        </div>
        <Badge variant="outline" class="tabular-nums">
          {{ areas.length || '…' }} стран
        </Badge>
      </div>

      <div class="relative mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          :variant="filterTier === 'all' ? 'default' : 'outline'"
          @click="filterTier = 'all'"
        >
          Все
        </Button>
        <Button
          v-for="t in GEO_TIERS"
          :key="t.id"
          size="sm"
          :variant="filterTier === t.id ? 'default' : 'outline'"
          class="gap-2"
          @click="filterTier = t.id"
        >
          <span class="size-2.5 rounded-full" :style="{ background: t.color }" />
          {{ t.short }}
          <span class="tabular-nums opacity-70">{{ counts[t.id] || 0 }}</span>
        </Button>
      </div>

      <p v-if="loadError" class="relative mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {{ loadError }}
      </p>

      <div class="relative mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div class="min-h-[320px] overflow-hidden rounded-xl border bg-muted/20 p-2">
          <div v-if="loading" class="grid h-[400px] place-items-center text-sm text-muted-foreground">
            Загрузка карты…
          </div>
          <svg
            v-else
            :viewBox="viewBox"
            class="h-auto w-full"
            role="img"
            aria-label="Карта стран по tier"
          >
            <path
              v-for="a in visibleAreas"
              :key="a.id"
              :d="a.path"
              :fill="fillFor(a)"
              stroke="rgba(15,23,42,.35)"
              stroke-width="0.4"
              class="cursor-pointer transition-opacity duration-150"
              :class="hoverId === a.id || selected?.id === a.id ? 'opacity-100' : 'opacity-90 hover:opacity-100'"
              @mouseenter="hoverId = a.id"
              @mouseleave="hoverId = null"
              @click="selected = a"
            >
              <title>{{ a.name }} · {{ tierMeta(a.tier).label }}</title>
            </path>
          </svg>
        </div>

        <div class="space-y-3">
          <div class="rounded-xl border p-3">
            <p class="text-xs text-muted-foreground">
              Выбрано
            </p>
            <template v-if="active">
              <p class="mt-1 text-base font-semibold">
                {{ active.name }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  <span class="size-2 rounded-full" :style="{ background: tierMeta(active.tier).color }" />
                  {{ tierMeta(active.tier).label }}
                </span>
                <Badge v-if="isRestrictedTier(active.tier)" variant="destructive">
                  restricted
                </Badge>
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                {{ tierMeta(active.tier).description }}
              </p>
              <p
                v-if="active.note"
                class="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200"
              >
                {{ active.note }}
              </p>
            </template>
            <p v-else class="mt-2 text-sm text-muted-foreground">
              Наведите или кликните страну на карте
            </p>
          </div>

          <div class="space-y-2">
            <Input v-model="q" placeholder="Поиск страны…" class="h-9" />
            <div class="max-h-[280px] space-y-1 overflow-auto rounded-xl border p-1.5">
              <button
                v-for="row in filteredList.slice(0, 80)"
                :key="row.id"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
                :class="selected?.id === row.id ? 'bg-muted' : ''"
                @click="selected = row"
              >
                <span class="size-2.5 shrink-0 rounded-full" :style="{ background: row.color }" />
                <span class="min-w-0 flex-1 truncate">{{ row.name }}</span>
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {{ tierMeta(row.tier).short }}
                </span>
              </button>
              <p v-if="!filteredList.length" class="px-2 py-6 text-center text-xs text-muted-foreground">
                Ничего не найдено
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border bg-card p-4 sm:p-5">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold tracking-tight">
          Запрещённые юрисдикции
        </h2>
        <p class="max-w-3xl text-sm text-muted-foreground">
          Платформа не работает с игроками из стран и территорий ниже.
          Регистрация, депозиты и игра оттуда запрещены.
        </p>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="g in GEO_RESTRICTED_GROUPS"
          :key="g.id"
          class="rounded-xl border p-3 transition-colors"
          :class="g.id === 'caution'
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-rose-500/20 bg-rose-500/5'"
        >
          <p class="text-sm font-semibold">
            {{ g.icon }} {{ g.title }}
          </p>
          <ul class="mt-2 space-y-1 text-sm text-muted-foreground">
            <li
              v-for="item in g.items"
              :key="item"
              class="flex gap-2"
            >
              <span class="opacity-50">•</span>
              <button
                type="button"
                class="text-left hover:text-foreground hover:underline"
                @click="pickByName(item)"
              >
                {{ item }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div
          v-for="note in GEO_TERRITORY_NOTES"
          :key="note.title"
          class="rounded-xl border px-3 py-2.5 text-sm"
        >
          <p class="font-medium">
            {{ note.title }}
          </p>
          <p class="mt-1 text-muted-foreground">
            {{ note.items.join(' · ') }}
          </p>
        </div>
      </div>

      <p class="mt-4 rounded-xl border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        Доступ из запрещённых стран блокируется по IP, KYC и платёжным данным.
        Обход через VPN — основание для блокировки аккаунта и удержания выплат.
      </p>
    </div>
  </div>
</template>
