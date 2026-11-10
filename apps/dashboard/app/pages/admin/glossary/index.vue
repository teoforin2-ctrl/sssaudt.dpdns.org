<script setup lang="ts">
import { glossarySections, glossaryTermCount } from '~/constants/glossary-terms'

definePageMeta({ layout: 'default' })

const tab = ref<'glossary' | 'geo'>('glossary')
const q = ref('')
const activeSection = ref<string>('all')

const sectionOptions = computed(() => [
  { id: 'all', title: 'Все разделы' },
  ...glossarySections.map(s => ({ id: s.id, title: s.title })),
])

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return glossarySections
    .filter(s => activeSection.value === 'all' || s.id === activeSection.value)
    .map((s) => {
      const terms = s.terms.filter((t) => {
        if (!needle)
          return true
        const hay = `${t.name} ${t.en} ${t.keys} ${t.body} ${t.alias} ${t.tags.join(' ')}`.toLowerCase()
        return hay.includes(needle)
      })
      return { ...s, terms }
    })
    .filter(s => s.terms.length > 0)
})

const visibleCount = computed(() => filtered.value.reduce((n, s) => n + s.terms.length, 0))

function tagClass(tag: string) {
  const t = tag.toLowerCase()
  if (t.includes('деньг') || t.includes('бонус') || t.includes('money'))
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (t.includes('tech') || t.includes('math') || t.includes('тех'))
    return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
  if (t.includes('legal') || t.includes('гео') || t.includes('лиценз'))
    return 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
  if (t.includes('risk') || t.includes('риск'))
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
  return 'bg-muted text-muted-foreground'
}
</script>

<template>
  <div class="space-y-4">
    <AdminPageHeader
      title="Глоссарий"
      description="Термины iGaming для редакции + карта TIER и запрещённые юрисдикции."
      help="glossary"
    >
      <Badge variant="outline" class="tabular-nums">
        {{ glossaryTermCount }} терминов
      </Badge>
    </AdminPageHeader>

    <Tabs v-model="tab" class="space-y-4">
      <TabsList>
        <TabsTrigger value="glossary">
          Глоссарий
        </TabsTrigger>
        <TabsTrigger value="geo">
          Гео / TIER
        </TabsTrigger>
      </TabsList>

      <TabsContent value="glossary" class="mt-0 space-y-4">
        <div class="rounded-2xl border bg-card p-4">
          <div class="flex flex-wrap gap-2">
            <Input
              v-model="q"
              placeholder="Поиск: RTP, вейджер, CPA, KYC…"
              class="h-9 max-w-md"
            />
            <select
              v-model="activeSection"
              class="flex h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option v-for="s in sectionOptions" :key="s.id" :value="s.id">
                {{ s.title }}
              </option>
            </select>
            <Badge variant="secondary" class="tabular-nums">
              {{ visibleCount }} найдено
            </Badge>
          </div>
        </div>

        <div v-if="!filtered.length" class="rounded-2xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
          По запросу ничего не найдено
        </div>

        <section
          v-for="section in filtered"
          :id="section.id"
          :key="section.id"
          class="scroll-mt-20 space-y-3"
        >
          <div>
            <h2 class="text-lg font-semibold tracking-tight">
              {{ section.title }}
            </h2>
            <p v-if="section.lead" class="mt-1 max-w-3xl text-sm text-muted-foreground">
              {{ section.lead }}
            </p>
          </div>

          <div class="grid gap-2">
            <article
              v-for="term in section.terms"
              :key="`${section.id}-${term.name}-${term.en}`"
              class="rounded-2xl border bg-card p-4 transition-all hover:shadow-md"
            >
              <div class="flex flex-wrap items-baseline gap-2">
                <h3 class="font-semibold tracking-tight">
                  {{ term.name }}
                </h3>
                <code
                  v-if="term.en"
                  class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {{ term.en }}
                </code>
                <div class="ml-auto flex flex-wrap gap-1">
                  <span
                    v-for="tag in term.tags"
                    :key="tag"
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    :class="tagClass(tag)"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                {{ term.body }}
              </p>
              <p v-if="term.alias" class="mt-2 text-xs text-muted-foreground">
                {{ term.alias }}
              </p>
            </article>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="geo" class="mt-0">
        <AdminGeoTierMap />
      </TabsContent>
    </Tabs>
  </div>
</template>
