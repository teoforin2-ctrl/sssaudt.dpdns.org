<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { api } = useApi()
const { user } = useAuth()

interface ServerStats {
  ok: boolean
  ts: string
  host: {
    hostname: string
    platform: string
    arch: string
    release: string
    uptimeSec: number
    cpuCount: number
    cpuModel: string | null
    cpuPercent: number | null
    loadAvg: { m1: number, m5: number, m15: number }
    memory: {
      source: string
      totalBytes: number
      freeBytes: number
      usedBytes: number
      usedPercent: number
      availableBytes?: number
    }
    disk: {
      path: string
      totalBytes: number
      freeBytes: number
      usedBytes: number
      usedPercent: number
    } | null
  }
  process: {
    pid: number
    uptimeSec: number
    node: string
    rssBytes: number
    heapUsedBytes: number
    heapTotalBytes: number
    externalBytes: number
  }
}

const allowed = computed(() =>
  user.value?.role === 'admin' || user.value?.role === 'developer',
)

const stats = ref<ServerStats | null>(null)
const error = ref<string | null>(null)
const pending = ref(false)
const live = ref(true)
const intervalMs = 2000
let timer: ReturnType<typeof setInterval> | null = null
const historyCpu = ref<number[]>([])
const historyRam = ref<number[]>([])

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n < 0)
    return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
}

function fmtUptime(sec: number) {
  const s = Math.floor(sec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0)
    return `${d}д ${h}ч ${m}м`
  if (h > 0)
    return `${h}ч ${m}м`
  return `${m}м ${s % 60}с`
}

function spark(points: number[]) {
  if (points.length < 2)
    return ''
  const w = 120
  const h = 36
  const max = Math.max(100, ...points)
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - (p / max) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function thresholdClass(pct: number | null | undefined) {
  const n = Number(pct)
  if (!Number.isFinite(n))
    return 'bg-muted-foreground'
  if (n > 85)
    return 'bg-rose-500'
  if (n > 70)
    return 'bg-amber-500'
  return 'bg-emerald-500'
}

function thresholdText(pct: number | null | undefined) {
  const n = Number(pct)
  if (!Number.isFinite(n))
    return ''
  if (n > 85)
    return 'text-rose-600 dark:text-rose-400'
  if (n > 70)
    return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

const envBadge = computed(() => {
  const host = stats.value?.host.hostname || ''
  if (/mac|darwin|localhost|edward/i.test(host) || stats.value?.host.platform === 'darwin')
    return { label: 'local', class: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-400' }
  return { label: 'production', class: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' }
})

const heapPct = computed(() => {
  const p = stats.value?.process
  if (!p?.heapTotalBytes)
    return 0
  return Math.round((p.heapUsedBytes / p.heapTotalBytes) * 1000) / 10
})

async function tick() {
  if (!allowed.value)
    return
  pending.value = true
  try {
    const res = await api<ServerStats>('/v1/admin/server-stats')
    stats.value = res
    error.value = null
    const cpu = res.host.cpuPercent ?? 0
    historyCpu.value = [...historyCpu.value.slice(-39), Math.round(Number(cpu) * 10) / 10]
    historyRam.value = [...historyRam.value.slice(-39), res.host.memory.usedPercent]
  }
  catch (e: any) {
    error.value = e?.data?.error || e?.message || 'fetch_failed'
  }
  finally {
    pending.value = false
  }
}

function start() {
  stop()
  void tick()
  timer = setInterval(() => {
    if (live.value)
      void tick()
  }, intervalMs)
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(allowed, (ok) => {
  if (ok)
    start()
  else
    stop()
}, { immediate: true })

onBeforeUnmount(stop)
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      :live="live"
      :eyebrow="stats ? `${stats.host.hostname} · обновлено ${new Date(stats.ts).toLocaleTimeString()}` : 'Метрики API-хоста'"
      title="Сервер"
      description="На проде — VPS; локально — ваш Mac. Не путайте окружения."
      help="server"
    >
      <template #actions>
        <Badge v-if="stats" variant="outline" :class="envBadge.class">
          {{ envBadge.label }}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          :disabled="pending"
          @click="tick()"
        >
          Обновить
        </Button>
        <Button
          :variant="live ? 'default' : 'outline'"
          size="sm"
          @click="live = !live"
        >
          {{ live ? 'Live on' : 'Live off' }}
        </Button>
      </template>
    </AdminPageHeader>

    <div
      v-if="!allowed"
      class="rounded-xl border border-amber-500/40 p-4 text-sm"
    >
      Доступ только для ролей admin и developer.
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
    >
      Не удалось загрузить /v1/admin/server-stats: {{ error }}
    </div>

    <template v-else-if="stats">
      <p class="text-xs text-muted-foreground">
        {{ stats.host.platform }}/{{ stats.host.arch }} · uptime {{ fmtUptime(stats.host.uptimeSec) }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                CPU
              </p>
              <p class="mt-1 text-3xl font-semibold tabular-nums" :class="thresholdText(stats.host.cpuPercent)">
                {{ stats.host.cpuPercent != null ? `${stats.host.cpuPercent}%` : '—' }}
              </p>
            </div>
            <svg
              width="120"
              height="36"
              class="opacity-80"
              :class="thresholdText(stats.host.cpuPercent)"
              aria-hidden="true"
            >
              <path
                :d="spark(historyCpu)"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="thresholdClass(stats.host.cpuPercent)"
              :style="{ width: `${Math.min(100, stats.host.cpuPercent ?? 0)}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ stats.host.cpuCount }} cores · load {{ stats.host.loadAvg.m1 }} / {{ stats.host.loadAvg.m5 }} / {{ stats.host.loadAvg.m15 }}
          </p>
          <p
            v-if="stats.host.cpuModel"
            class="mt-1 truncate text-[11px] text-muted-foreground"
          >
            {{ stats.host.cpuModel }}
          </p>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                RAM
              </p>
              <p class="mt-1 text-3xl font-semibold tabular-nums" :class="thresholdText(stats.host.memory.usedPercent)">
                {{ stats.host.memory.usedPercent }}%
              </p>
            </div>
            <svg
              width="120"
              height="36"
              class="opacity-80"
              :class="thresholdText(stats.host.memory.usedPercent)"
              aria-hidden="true"
            >
              <path
                :d="spark(historyRam)"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
            </svg>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ fmtBytes(stats.host.memory.usedBytes) }} / {{ fmtBytes(stats.host.memory.totalBytes) }}
            · avail {{ fmtBytes(stats.host.memory.availableBytes ?? stats.host.memory.freeBytes) }}
            · {{ stats.host.memory.source }}
          </p>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="thresholdClass(stats.host.memory.usedPercent)"
              :style="{ width: `${Math.min(100, stats.host.memory.usedPercent)}%` }"
            />
          </div>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">
            Диск /
          </p>
          <p class="mt-1 text-3xl font-semibold tabular-nums" :class="thresholdText(stats.host.disk?.usedPercent)">
            {{ stats.host.disk ? `${stats.host.disk.usedPercent}%` : '—' }}
          </p>
          <p
            v-if="stats.host.disk"
            class="mt-2 text-xs text-muted-foreground"
          >
            {{ fmtBytes(stats.host.disk.usedBytes) }} / {{ fmtBytes(stats.host.disk.totalBytes) }}
          </p>
          <div
            v-if="stats.host.disk"
            class="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              class="h-full rounded-full transition-all"
              :class="thresholdClass(stats.host.disk.usedPercent)"
              :style="{ width: `${Math.min(100, stats.host.disk.usedPercent)}%` }"
            />
          </div>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">
            Uptime
          </p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {{ fmtUptime(stats.host.uptimeSec) }}
          </p>
          <p class="mt-2 text-xs text-muted-foreground">
            API process {{ fmtUptime(stats.process.uptimeSec) }} · pid {{ stats.process.pid }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl border bg-card p-4">
        <h2 class="text-sm font-semibold">
          Процесс API
        </h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">
              Node
            </p>
            <p class="font-medium">
              {{ stats.process.node }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              RSS
            </p>
            <p class="font-medium tabular-nums">
              {{ fmtBytes(stats.process.rssBytes) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Heap used
            </p>
            <p class="font-medium tabular-nums">
              {{ fmtBytes(stats.process.heapUsedBytes) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Heap total
            </p>
            <p class="font-medium tabular-nums">
              {{ fmtBytes(stats.process.heapTotalBytes) }}
            </p>
          </div>
        </div>
        <div class="mt-4 space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Heap</span>
            <span class="tabular-nums" :class="thresholdText(heapPct)">{{ heapPct }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="thresholdClass(heapPct)"
              :style="{ width: `${Math.min(100, heapPct)}%` }"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
