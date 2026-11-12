<script setup lang="ts">
import { ExternalLink, ImagePlus, Link2, Mail, Search } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'default' })

const { api } = useApi()
const config = useRuntimeConfig()
const webOrigin = (config.public.siteUrl as string) || 'http://127.0.0.1:3710'

interface Contacts {
  email: string
  email_partners: string
  telegram: string
  vk: string
  youtube: string
  x: string
  instagram: string
  facebook: string
  discord: string
}

interface Settings {
  siteName: string
  logoUrl: string | null
  faviconUrl: string | null
  favicon32Url: string | null
  appleTouchIconUrl: string | null
  contacts: Contacts
  updatedAt: string | null
}

function emptyContacts(): Contacts {
  return {
    email: '',
    email_partners: '',
    telegram: '',
    vk: '',
    youtube: '',
    x: '',
    instagram: '',
    facebook: '',
    discord: '',
  }
}

const tab = ref('brand')

const { data, pending, error, refresh } = await useAsyncData('admin-site-settings', () =>
  api<{ settings: Settings }>('/v1/admin/site-settings'))

const fields = ref({
  siteName: 'SS Audit',
  contacts: emptyContacts(),
  regenerateFromLogo: true,
})

const logoPreview = ref<string | null>(null)
const logoDataUrl = ref<string | null>(null)
const faviconPreview = ref<string | null>(null)
const faviconDataUrl = ref<string | null>(null)

watch(
  () => data.value?.settings,
  (s) => {
    if (!s)
      return
    fields.value.siteName = s.siteName || 'SS Audit'
    fields.value.contacts = { ...emptyContacts(), ...s.contacts }
    logoPreview.value = s.logoUrl
    faviconPreview.value = s.favicon32Url || s.faviconUrl
    logoDataUrl.value = null
    faviconDataUrl.value = null
  },
  { immediate: true },
)

const saving = ref(false)
const saveMsg = ref<string | null>(null)
const saveErr = ref<string | null>(null)
const savedSnapshot = ref('')

function snapshotNow() {
  return JSON.stringify({
    siteName: fields.value.siteName,
    contacts: fields.value.contacts,
    regenerateFromLogo: fields.value.regenerateFromLogo,
    logo: logoDataUrl.value,
    favicon: faviconDataUrl.value,
  })
}

watch(
  () => data.value?.settings,
  (s) => {
    if (!s)
      return
    nextTick(() => {
      savedSnapshot.value = snapshotNow()
    })
  },
  { immediate: true },
)

const dirty = computed(() => {
  if (!savedSnapshot.value)
    return false
  return snapshotNow() !== savedSnapshot.value
})

const filledSocials = computed(() => {
  const c = fields.value.contacts
  return [c.telegram, c.vk, c.youtube, c.x, c.instagram, c.facebook, c.discord].filter(Boolean).length
})

function resetForm() {
  const s = data.value?.settings
  if (!s)
    return
  fields.value.siteName = s.siteName || 'SS Audit'
  fields.value.contacts = { ...emptyContacts(), ...s.contacts }
  fields.value.regenerateFromLogo = true
  logoPreview.value = s.logoUrl
  faviconPreview.value = s.favicon32Url || s.faviconUrl
  logoDataUrl.value = null
  faviconDataUrl.value = null
  saveMsg.value = null
  saveErr.value = null
  savedSnapshot.value = snapshotNow()
}

function assetUrl(path: string | null | undefined) {
  if (!path)
    return ''
  if (path.startsWith('data:') || path.startsWith('http'))
    return path
  return `${webOrigin}${path}`
}

function readImage(file: File, maxBytes = 5_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Нужен файл изображения'))
      return
    }
    if (file.size > maxBytes) {
      reject(new Error('Файл слишком большой (макс. ~5 МБ)'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

async function onLogoPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const dataUrl = await readImage(file)
    logoDataUrl.value = dataUrl
    logoPreview.value = dataUrl
    saveErr.value = null
  }
  catch (err: unknown) {
    saveErr.value = err instanceof Error ? err.message : 'Ошибка файла'
  }
}

async function onFaviconPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const dataUrl = await readImage(file)
    faviconDataUrl.value = dataUrl
    faviconPreview.value = dataUrl
    saveErr.value = null
  }
  catch (err: unknown) {
    saveErr.value = err instanceof Error ? err.message : 'Ошибка файла'
  }
}

async function save() {
  saving.value = true
  saveMsg.value = null
  saveErr.value = null
  try {
    const body: Record<string, unknown> = {
      site_name: fields.value.siteName.trim() || 'SS Audit',
      contacts: { ...fields.value.contacts },
      regenerate_favicon_from_logo: fields.value.regenerateFromLogo && !faviconDataUrl.value,
    }
    if (logoDataUrl.value)
      body.logo_data_url = logoDataUrl.value
    if (faviconDataUrl.value)
      body.favicon_data_url = faviconDataUrl.value

    const res = await api<{ settings: Settings }>('/v1/admin/site-settings', {
      method: 'PATCH',
      body,
    })
    saveMsg.value = 'Сохранено'
    toast.success('Настройки сайта сохранены')
    logoDataUrl.value = null
    faviconDataUrl.value = null
    if (res?.settings) {
      logoPreview.value = res.settings.logoUrl
      faviconPreview.value = res.settings.favicon32Url || res.settings.faviconUrl
      fields.value.siteName = res.settings.siteName
      fields.value.contacts = { ...emptyContacts(), ...res.settings.contacts }
    }
    await refresh()
    nextTick(() => {
      savedSnapshot.value = snapshotNow()
    })
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    saveErr.value = e?.data?.error
      ? `Ошибка: ${e.data.error}`
      : e?.message || 'Ошибка сохранения'
    toast.error(saveErr.value)
  }
  finally {
    saving.value = false
  }
}

const inputClass
  = 'border-input bg-background/60 flex h-10 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]'
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 pb-28">
    <AdminPageHeader
      title="Настройки сайта"
      description="Бренд, логотип и контакты публичного портала"
      help="settings"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          as-child
        >
          <NuxtLink to="/admin/seo">
            <Search class="size-4" />
            SEO
          </NuxtLink>
        </Button>
        <Button
          variant="outline"
          size="sm"
          as-child
        >
          <a
            :href="webOrigin"
            target="_blank"
            rel="noopener"
          >
            <ExternalLink class="size-4" />
            Открыть сайт
          </a>
        </Button>
      </template>
    </AdminPageHeader>

    <AdminFormSkeleton v-if="pending && !data" :fields="6" />
    <AdminUiAdminEmptyState
      v-else-if="error"
      title="Не удалось загрузить настройки"
      description="Проверьте API и права доступа, затем обновите страницу."
    />

    <div
      v-else
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <form class="min-w-0 space-y-4" @submit.prevent="save">
        <Tabs v-model="tab" class="w-full">
          <TabsList class="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="brand">
              Бренд
            </TabsTrigger>
            <TabsTrigger value="contacts">
              Контакты
              <Badge
                v-if="filledSocials"
                variant="secondary"
                class="ml-1.5 h-5 px-1.5 font-normal"
              >
                {{ filledSocials }}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brand" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="border-b bg-muted/30 px-4 py-3 sm:px-5">
                <h2 class="text-sm font-semibold">
                  Название
                </h2>
                <p class="text-xs text-muted-foreground">
                  В шапке, футере, title и alt логотипа
                </p>
              </div>
              <div class="grid gap-2 p-4 sm:p-5">
                <Label for="site-name">Название сайта</Label>
                <input
                  id="site-name"
                  v-model="fields.siteName"
                  maxlength="120"
                  placeholder="SSS Audit"
                  :class="inputClass"
                >
              </div>
            </section>

            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="border-b bg-muted/30 px-4 py-3 sm:px-5">
                <h2 class="text-sm font-semibold">
                  Логотип и фавикон
                </h2>
                <p class="text-xs text-muted-foreground">
                  PNG / WebP / SVG · из лого можно сразу собрать фавиконы
                </p>
              </div>
              <div class="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <div class="grid gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <label class="group relative grid cursor-pointer gap-3">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">Логотип</span>
                      <ImagePlus class="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
                    </div>
                    <div class="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-background/80 px-3 ring-1 ring-border/60">
                      <img
                        v-if="logoPreview"
                        :src="assetUrl(logoPreview)"
                        alt="logo preview"
                        class="max-h-24 max-w-full object-contain"
                      >
                      <span v-else class="text-xs text-muted-foreground">Выберите файл</span>
                    </div>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      class="absolute inset-0 h-full cursor-pointer opacity-0"
                      @change="onLogoPick"
                    />
                  </label>
                  <AdminCheckbox v-model:checked="fields.regenerateFromLogo">
                    Сгенерировать фавикон из лого
                  </AdminCheckbox>
                </div>

                <div class="grid gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <label class="group relative grid cursor-pointer gap-3">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">Фавикон</span>
                      <ImagePlus class="size-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
                    </div>
                    <div class="flex h-28 items-center justify-center gap-4 overflow-hidden rounded-lg bg-background/80 ring-1 ring-border/60">
                      <img
                        v-if="faviconPreview"
                        :src="assetUrl(faviconPreview)"
                        alt="favicon preview"
                        class="size-14 object-contain"
                      >
                      <span v-else class="text-xs text-muted-foreground">32 / 512 / apple-touch</span>
                    </div>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      class="absolute inset-0 h-full cursor-pointer opacity-0"
                      @change="onFaviconPick"
                    />
                  </label>
                  <p class="text-xs text-muted-foreground">
                    Отдельный исходник, если не хотите брать из лого
                  </p>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="contacts" class="mt-4 space-y-4">
            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <Mail class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Email
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Редакция и B2B
                  </p>
                </div>
              </div>
              <div class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <div class="grid gap-2">
                  <Label>Редакция</Label>
                  <input
                    v-model="fields.contacts.email"
                    type="email"
                    placeholder="editorial@example.com"
                    :class="inputClass"
                  >
                </div>
                <div class="grid gap-2">
                  <Label>Партнёры / B2B</Label>
                  <input
                    v-model="fields.contacts.email_partners"
                    type="email"
                    placeholder="partners@example.com"
                    :class="inputClass"
                  >
                </div>
              </div>
            </section>

            <section class="overflow-hidden rounded-2xl border bg-card">
              <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <Link2 class="size-4 text-muted-foreground" />
                <div>
                  <h2 class="text-sm font-semibold">
                    Соцсети
                  </h2>
                  <p class="text-xs text-muted-foreground">
                    Полные URL — уйдут в футер и schema sameAs
                  </p>
                </div>
              </div>
              <div class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <div class="grid gap-2">
                  <Label>Telegram</Label>
                  <input v-model="fields.contacts.telegram" placeholder="https://t.me/…" :class="inputClass">
                </div>
                <div class="grid gap-2">
                  <Label>VK</Label>
                  <input v-model="fields.contacts.vk" placeholder="https://vk.com/…" :class="inputClass">
                </div>
                <div class="grid gap-2">
                  <Label>YouTube</Label>
                  <input v-model="fields.contacts.youtube" placeholder="https://youtube.com/…" :class="inputClass">
                </div>
                <div class="grid gap-2">
                  <Label>X (Twitter)</Label>
                  <input v-model="fields.contacts.x" placeholder="https://x.com/…" :class="inputClass">
                </div>
                <div class="grid gap-2">
                  <Label>Instagram</Label>
                  <input v-model="fields.contacts.instagram" placeholder="https://instagram.com/…" :class="inputClass">
                </div>
                <div class="grid gap-2">
                  <Label>Facebook</Label>
                  <input v-model="fields.contacts.facebook" placeholder="https://facebook.com/…" :class="inputClass">
                </div>
                <div class="grid gap-2 sm:col-span-2">
                  <Label>Discord</Label>
                  <input v-model="fields.contacts.discord" placeholder="https://discord.gg/…" :class="inputClass">
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </form>

      <aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div class="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div class="border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Превью бренда
          </div>
          <div class="space-y-4 p-4">
            <div class="flex items-center gap-3 rounded-xl bg-zinc-950 px-4 py-3 text-zinc-50">
              <div class="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
                <img
                  v-if="logoPreview"
                  :src="assetUrl(logoPreview)"
                  alt=""
                  class="max-h-8 max-w-[2.5rem] object-contain"
                >
                <span v-else class="text-[10px] text-zinc-500">logo</span>
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold tracking-tight">
                  {{ fields.siteName || 'Название сайта' }}
                </p>
                <p class="truncate text-[11px] text-zinc-400">
                  Шапка публичного сайта
                </p>
              </div>
              <img
                v-if="faviconPreview"
                :src="assetUrl(faviconPreview)"
                alt=""
                class="ml-auto size-5 rounded object-contain"
              >
            </div>

            <div class="rounded-xl border bg-background p-3">
              <div class="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span class="size-2.5 rounded-full bg-red-400/80" />
                <span class="size-2.5 rounded-full bg-amber-400/80" />
                <span class="size-2.5 rounded-full bg-emerald-400/80" />
                <span class="ml-1 truncate">{{ webOrigin.replace(/^https?:\/\//, '') }}</span>
              </div>
              <div class="flex items-start gap-2">
                <img
                  v-if="faviconPreview"
                  :src="assetUrl(faviconPreview)"
                  alt=""
                  class="mt-0.5 size-4 rounded-sm object-contain"
                >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-blue-600 dark:text-blue-400">
                    {{ fields.siteName || 'SSS Audit' }}
                  </p>
                  <p class="truncate text-[11px] text-emerald-700 dark:text-emerald-400">
                    {{ webOrigin }}/
                  </p>
                </div>
              </div>
            </div>

            <p class="text-[11px] leading-relaxed text-muted-foreground">
              Изменения появятся на сайте после сохранения. Индексацию и robots настраивайте в
              <NuxtLink to="/admin/seo" class="font-medium text-foreground underline-offset-2 hover:underline">
                SEO
              </NuxtLink>.
            </p>
          </div>
        </div>
      </aside>
    </div>

    <AdminUiAdminStickySaveBar
      :dirty="dirty"
      :saving="saving"
      :message="saveMsg"
      :error="saveErr"
      @save="save"
      @reset="resetForm"
    />
  </div>
</template>
