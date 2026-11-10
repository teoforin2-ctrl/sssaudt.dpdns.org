<script setup lang="ts">
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
    logoDataUrl.value = null
    faviconDataUrl.value = null
    if (res?.settings) {
      logoPreview.value = res.settings.logoUrl
      faviconPreview.value = res.settings.favicon32Url || res.settings.faviconUrl
      fields.value.siteName = res.settings.siteName
      fields.value.contacts = { ...emptyContacts(), ...res.settings.contacts }
    }
    await refresh()
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: string }, message?: string }
    saveErr.value = e?.data?.error
      ? `Ошибка: ${e.data.error}`
      : e?.message || 'Ошибка сохранения'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <AdminPageHeader
      title="Настройки сайта"
      description="Название, логотип, фавикон и контакты публичного сайта"
      help="settings"
    />

    <AdminFormSkeleton v-if="pending && !data" :fields="6" />
    <p v-else-if="error" class="text-sm text-destructive">
      Не удалось загрузить настройки
    </p>

    <form v-else class="grid gap-6" @submit.prevent="save">
      <section class="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 class="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Бренд
        </h2>
        <div class="grid gap-2">
          <Label>Название сайта</Label>
          <input
            v-model="fields.siteName"
            maxlength="120"
            placeholder="SS Audit"
            class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
          <p class="text-xs text-muted-foreground">
            Показывается в шапке, футере, title страниц и alt логотипа.
          </p>
        </div>
      </section>

      <section class="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 class="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Логотип и фавикон
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>Логотип</Label>
            <div class="flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted px-3">
              <img
                v-if="logoPreview"
                :src="assetUrl(logoPreview)"
                alt="logo"
                class="max-h-20 max-w-full object-contain"
              >
              <span v-else class="text-xs text-muted-foreground">нет логотипа</span>
            </div>
            <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" @change="onLogoPick" />
            <label class="flex items-center gap-2 text-sm">
              <input v-model="fields.regenerateFromLogo" type="checkbox" class="size-4 rounded border">
              Перегенерировать фавикон из логотипа
            </label>
          </div>
          <div class="grid gap-2">
            <Label>Фавикон (исходник)</Label>
            <div class="flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              <img
                v-if="faviconPreview"
                :src="assetUrl(faviconPreview)"
                alt="favicon"
                class="size-12 object-contain"
              >
              <span v-else class="text-xs text-muted-foreground">нет фавикона</span>
            </div>
            <Input type="file" accept="image/png,image/jpeg,image/webp" @change="onFaviconPick" />
            <p class="text-xs text-muted-foreground">
              Из изображения создаются 32×32, 512×512 и apple-touch 180×180.
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 class="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Контакты
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>Email редакции</Label>
            <input
              v-model="fields.contacts.email"
              type="email"
              placeholder="editorial@example.com"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>Email партнёров / B2B</Label>
            <input
              v-model="fields.contacts.email_partners"
              type="email"
              placeholder="partners@example.com"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>Telegram</Label>
            <input
              v-model="fields.contacts.telegram"
              placeholder="https://t.me/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>VK</Label>
            <input
              v-model="fields.contacts.vk"
              placeholder="https://vk.com/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>YouTube</Label>
            <input
              v-model="fields.contacts.youtube"
              placeholder="https://youtube.com/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>X (Twitter)</Label>
            <input
              v-model="fields.contacts.x"
              placeholder="https://x.com/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>Instagram</Label>
            <input
              v-model="fields.contacts.instagram"
              placeholder="https://instagram.com/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2">
            <Label>Facebook</Label>
            <input
              v-model="fields.contacts.facebook"
              placeholder="https://facebook.com/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>Discord</Label>
            <input
              v-model="fields.contacts.discord"
              placeholder="https://discord.gg/…"
              class="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" :disabled="saving">
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
        <span v-if="saving" class="text-sm text-muted-foreground">Отправка…</span>
        <span v-else-if="saveMsg" class="text-sm text-emerald-600">{{ saveMsg }}</span>
        <span v-else-if="saveErr" class="text-sm text-destructive">{{ saveErr }}</span>
      </div>
    </form>
  </div>
</template>
