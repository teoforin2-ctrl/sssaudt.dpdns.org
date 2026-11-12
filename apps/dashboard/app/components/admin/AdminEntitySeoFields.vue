<script setup lang="ts">
export interface EntitySeoLocale {
  title?: string
  description?: string
  h1?: string
}

export interface EntitySeoModel {
  ru: EntitySeoLocale
  en: EntitySeoLocale
  ogImage: string | null
}

const model = defineModel<EntitySeoModel>({ required: true })

const lang = ref<'ru' | 'en'>('ru')

const varsHint = computed(() => {
  if (lang.value === 'en')
    return 'Empty = template from Admin → SEO. Vars like {casino}/{slot}/{article}/{siteName} still work in templates.'
  return 'Пусто = шаблон из Admin → SEO. В шаблонах работают {casino}/{slot}/{article}/{siteName}.'
})

watch(
  model,
  (v) => {
    if (!v)
      return
    if (!v.ru)
      v.ru = {}
    if (!v.en)
      v.en = {}
    if (v.ogImage === undefined)
      v.ogImage = null
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <section class="space-y-3 rounded-xl border p-4">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="text-base font-semibold">
        SEO
      </h2>
      <div class="ml-auto flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          :class="lang === 'ru' ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="lang = 'ru'"
        >
          RU
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          :class="lang === 'en' ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="lang = 'en'"
        >
          EN
        </button>
      </div>
    </div>
    <p class="text-xs text-muted-foreground">
      {{ varsHint }}
    </p>
    <div class="grid gap-3">
      <div class="grid gap-2">
        <Label>Title ({{ lang.toUpperCase() }})</Label>
        <Input v-model="model[lang].title" :placeholder="lang === 'en' ? 'Custom title' : 'Свой title'" />
      </div>
      <div class="grid gap-2">
        <Label>Description ({{ lang.toUpperCase() }})</Label>
        <Textarea
          v-model="model[lang].description"
          rows="3"
          :placeholder="lang === 'en' ? 'Custom meta description' : 'Своё meta-описание'"
        />
      </div>
      <div class="grid gap-2">
        <Label>H1 ({{ lang.toUpperCase() }})</Label>
        <Input v-model="model[lang].h1" placeholder="H1" />
      </div>
      <div class="grid gap-2">
        <Label>OG image URL</Label>
        <Input
          :model-value="model.ogImage || ''"
          placeholder="/uploads/... or https://..."
          @update:model-value="model.ogImage = String($event || '').trim() || null"
        />
        <p class="text-[11px] text-muted-foreground">
          Пусто → обложка/лого сущности, иначе автокарточка /v1/og/… (1200×630).
        </p>
      </div>
    </div>
  </section>
</template>
