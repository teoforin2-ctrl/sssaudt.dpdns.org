<script setup lang="ts">
const props = defineProps<{
  categories: { slug: string; title: string }[];
  defaultCategorySlug?: string;
}>();
const emit = defineEmits<{ close: []; created: [slug: string] }>();

const config = useRuntimeConfig();
const { locale } = useI18n();
const localePath = useLocalePath();

const categorySlug = ref(props.defaultCategorySlug || props.categories[0]?.slug || "");
const title = ref("");
const body = ref("");
const sending = ref(false);
const err = ref<string | null>(null);

watch(
  () => props.defaultCategorySlug,
  (v) => {
    if (v) categorySlug.value = v;
  },
);

async function submit() {
  err.value = null;
  if (title.value.trim().length < 5 || body.value.trim().length < 5) {
    err.value = locale.value === "en" ? "Fill title and body (min 5 chars)" : "Заполните заголовок и текст (мин. 5 символов)";
    return;
  }
  sending.value = true;
  try {
    const res = await $fetch<{ topic: { slug: string } }>(`${config.public.apiBase}/v1/forum/topics`, {
      method: "POST",
      credentials: "include",
      body: {
        categorySlug: categorySlug.value,
        title: title.value.trim(),
        body: body.value.trim(),
      },
    });
    emit("created", res.topic.slug);
    await navigateTo(localePath(`/forum/tema/${res.topic.slug}`));
    emit("close");
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode;
    err.value = status === 401
      ? (locale.value === "en" ? "Sign in to create a topic" : "Войдите, чтобы создать тему")
      : (locale.value === "en" ? "Could not create topic" : "Не удалось создать тему");
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="modal">
      <header class="head">
        <h2>{{ locale === "en" ? "New topic" : "Новая тема" }}</h2>
        <button type="button" class="x" aria-label="Close" @click="emit('close')">×</button>
      </header>
      <form class="form" @submit.prevent="submit">
        <label>
          <span>{{ locale === "en" ? "Section" : "Раздел" }}</span>
          <UiSelect
            v-model="categorySlug"
            required
            :placeholder="locale === 'en' ? 'Choose section' : 'Выберите раздел'"
            :options="categories.map((c) => ({ value: c.slug, label: c.title }))"
          />
        </label>
        <label>
          <span>{{ locale === "en" ? "Title" : "Заголовок" }}</span>
          <input v-model="title" type="text" maxlength="200" required>
        </label>
        <label>
          <span>{{ locale === "en" ? "Message" : "Сообщение" }}</span>
          <textarea v-model="body" rows="6" maxlength="20000" required />
        </label>
        <p v-if="err" class="err">{{ err }}</p>
        <div class="actions">
          <UiButton type="button" variant="secondary" size="sm" @click="emit('close')">
            {{ locale === "en" ? "Cancel" : "Отмена" }}
          </UiButton>
          <UiButton type="submit" size="sm" :loading="sending" :disabled="sending">
            {{ locale === "en" ? "Publish" : "Опубликовать" }}
          </UiButton>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--bg-overlay);
  display: grid;
  place-items: center;
  padding: 20px;
}
.modal {
  width: min(560px, 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  box-shadow: var(--shadow-2);
  padding: 18px 18px 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}
.x {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.form { display: grid; gap: 12px; }
label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-secondary); }
input,
textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-primary);
  padding: 10px 12px;
  font: inherit;
  font-weight: 500;
}
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.err { margin: 0; color: var(--danger); font-size: 13px; font-weight: 600; }
</style>
