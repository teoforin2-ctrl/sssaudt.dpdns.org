<script setup lang="ts">
import {
  brandColors,
  brandComponents,
  brandFonts,
  brandPrinciples,
  brandRadii,
  brandSurfaces,
  brandText,
  brandVoice,
} from '~/constants/brandbook'

definePageMeta({ layout: 'default' })

const sections = [
  { id: 'principles', label: 'Принципы' },
  { id: 'color', label: 'Цвет' },
  { id: 'type', label: 'Типографика' },
  { id: 'radius', label: 'Радиусы' },
  { id: 'components', label: 'UI' },
  { id: 'voice', label: 'Тон' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Брендинг"
      description="Design system Casino review: токены, принципы и тон — в стиле админки, без внешнего HTML."
      help="branding"
    />

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="s in sections"
        :key="s.id"
        size="sm"
        variant="outline"
        @click="scrollTo(s.id)"
      >
        {{ s.label }}
      </Button>
    </div>

    <!-- Hero preview -->
    <div class="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(61,255,138,.12),transparent_45%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,255,.14),transparent_40%)]" />
      <div class="relative grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div class="space-y-3">
          <Badge variant="outline" class="border-emerald-500/40 text-emerald-600">
            Brandbook · admin view
          </Badge>
          <h2 class="font-[family-name:var(--font-display,inherit)] text-3xl font-bold tracking-tight sm:text-4xl">
            Casino review
          </h2>
          <p class="max-w-xl text-sm text-muted-foreground">
            Тёмный premium, один зелёный CTA, честные формулировки.
            Ниже — те же токены, что в brandbook, но уже как виджеты админки.
          </p>
          <div class="flex flex-wrap gap-2 pt-1">
            <Button class="bg-[#3dff8a] text-[#0b1220] hover:bg-[#62ff9f]">
              Primary CTA
            </Button>
            <Button variant="outline">
              Secondary
            </Button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="c in brandColors.slice(0, 6)"
            :key="c.token"
            class="rounded-xl border p-3"
          >
            <div class="mb-2 h-10 rounded-lg" :style="{ background: c.value }" />
            <p class="text-xs font-medium">
              {{ c.name }}
            </p>
            <p class="font-mono text-[10px] text-muted-foreground">
              {{ c.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <section id="principles" class="scroll-mt-20 space-y-3">
      <h2 class="text-lg font-semibold tracking-tight">
        Принципы
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="(p, i) in brandPrinciples"
          :key="p.title"
          class="rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p class="text-xs tabular-nums text-muted-foreground">
            0{{ i + 1 }}
          </p>
          <p class="mt-2 font-semibold">
            {{ p.title }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ p.body }}
          </p>
        </div>
      </div>
    </section>

    <section id="color" class="scroll-mt-20 grid gap-4 xl:grid-cols-2">
      <div class="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 class="text-lg font-semibold tracking-tight">
          Акценты
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Семантические цвета публичного сайта
        </p>
        <div class="mt-4 space-y-2">
          <div
            v-for="c in brandColors"
            :key="c.token"
            class="flex items-center gap-3 rounded-xl border px-3 py-2"
          >
            <span class="size-9 shrink-0 rounded-lg border" :style="{ background: c.value }" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">
                {{ c.name }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ c.usage }}
              </p>
            </div>
            <code class="shrink-0 font-mono text-[11px] text-muted-foreground">{{ c.value }}</code>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 class="text-lg font-semibold tracking-tight">
            Surfaces
          </h2>
          <div class="mt-4 grid grid-cols-5 gap-2">
            <div
              v-for="s in brandSurfaces"
              :key="s.token"
              class="overflow-hidden rounded-xl border"
            >
              <div class="h-16" :style="{ background: s.value }" />
              <div class="px-2 py-1.5">
                <p class="text-[11px] font-medium">
                  {{ s.name }}
                </p>
                <p class="font-mono text-[10px] text-muted-foreground">
                  {{ s.value }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 class="text-lg font-semibold tracking-tight">
            Text
          </h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <div
              v-for="t in brandText"
              :key="t.token"
              class="rounded-xl border px-3 py-2"
            >
              <p class="text-sm font-medium" :style="{ color: t.value }">
                {{ t.name }}
              </p>
              <p class="font-mono text-[10px] text-muted-foreground">
                {{ t.value }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="type" class="scroll-mt-20 grid gap-4 md:grid-cols-2">
      <div
        v-for="f in brandFonts"
        :key="f.role"
        class="rounded-2xl border bg-card p-5"
      >
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ f.role }}
        </p>
        <p class="mt-2 text-3xl font-bold tracking-tight">
          {{ f.family }}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ f.usage }}
        </p>
        <p class="mt-4 text-sm">
          The quick brown fox jumps over the lazy dog · 0123456789
        </p>
      </div>
    </section>

    <section id="radius" class="scroll-mt-20 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 class="text-lg font-semibold tracking-tight">
        Радиусы
      </h2>
      <div class="mt-4 flex flex-wrap gap-4">
        <div
          v-for="r in brandRadii"
          :key="r.token"
          class="flex flex-col items-center gap-2"
        >
          <div
            class="size-16 border border-emerald-500/40 bg-emerald-500/10"
            :style="{ borderRadius: r.value }"
          />
          <p class="text-xs font-medium">
            {{ r.name }}
          </p>
          <p class="font-mono text-[10px] text-muted-foreground">
            {{ r.value }}
          </p>
        </div>
      </div>
    </section>

    <section id="components" class="scroll-mt-20 space-y-3">
      <h2 class="text-lg font-semibold tracking-tight">
        UI-паттерны
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="c in brandComponents"
          :key="c.name"
          class="rounded-2xl border bg-card p-4"
        >
          <p class="font-medium">
            {{ c.name }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ c.note }}
          </p>
        </div>
      </div>
    </section>

    <section id="voice" class="scroll-mt-20 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 class="text-lg font-semibold tracking-tight">
        Тон коммуникации
      </h2>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div
          v-for="(v, i) in brandVoice"
          :key="i"
          class="grid gap-2 sm:grid-cols-2"
        >
          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p class="text-xs font-semibold text-emerald-600">
              Do
            </p>
            <p class="mt-1">
              {{ v.do }}
            </p>
          </div>
          <div class="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
            <p class="text-xs font-semibold text-rose-600">
              Don’t
            </p>
            <p class="mt-1">
              {{ v.dont }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
