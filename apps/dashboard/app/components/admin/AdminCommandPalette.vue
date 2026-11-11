<script setup lang="ts">
import type { NavLink, NavMenu } from '~/types/nav'
import { EDITOR_ADMIN_ALLOW_PREFIXES } from '~/constants/editor-access'
import { navMenu } from '~/constants/menus'

const open = ref(false)
const router = useRouter()
const { user } = useAuth()
const { metaSymbol } = useShortcuts()

defineShortcuts({
  Meta_K: () => {
    open.value = !open.value
  },
})

const isEditor = computed(() => user.value?.role === 'editor')
const editorAllowed = new Set<string>(EDITOR_ADMIN_ALLOW_PREFIXES)

const pages = computed(() => {
  const items: Array<NavLink & { group: string }> = []
  for (const group of navMenu as NavMenu[]) {
    for (const item of group.items) {
      if (!('link' in item))
        continue
      if (isEditor.value && !editorAllowed.has(item.link))
        continue
      items.push({ ...item, group: group.heading })
    }
  }
  return items
})

const actions = [
  { title: 'Добавить казино', link: '/admin/casinos/new' },
  { title: 'Добавить слот', link: '/admin/slots/new' },
  { title: 'Открыть статьи', link: '/admin/articles' },
]

function go(link: string) {
  open.value = false
  router.push(link)
}
</script>

<template>
  <div class="contents">
    <Button
      variant="outline"
      size="sm"
      class="hidden h-8 gap-2 text-xs text-muted-foreground md:inline-flex"
      @click="open = true"
    >
      <Icon name="i-lucide-search" class="size-3.5" />
      Поиск
      <kbd class="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        {{ metaSymbol }}K
      </kbd>
    </Button>

    <CommandDialog v-model:open="open">
      <CommandInput placeholder="Перейти к разделу или действию…" />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        <CommandGroup heading="Быстрые действия">
          <CommandItem
            v-for="a in actions"
            :key="a.link"
            :value="a.title"
            @select="go(a.link)"
          >
            <Icon name="i-lucide-plus" />
            {{ a.title }}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup
          v-for="group in [...new Set(pages.map(p => p.group))]"
          :key="group"
          :heading="group"
        >
          <CommandItem
            v-for="p in pages.filter(x => x.group === group)"
            :key="p.link"
            :value="`${p.title} ${p.link}`"
            class="gap-2"
            @select="go(p.link)"
          >
            <Icon :name="p.icon || 'i-lucide-file'" />
            {{ p.title }}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  </div>
</template>
