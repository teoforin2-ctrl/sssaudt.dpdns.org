<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();

const form = reactive({
  casinoSlug: String(route.query.casino || ""),
  casinoName: "",
  authorName: "",
  authorEmail: "",
  subject: "",
  body: "",
});
const busy = ref(false);
const ok = ref(false);
const err = ref<string | null>(null);

usePageSeo({
  title: () => t("catalog.complaints.title"),
  description: () => t("catalog.complaints.lead"),
});

async function submit() {
  busy.value = true;
  err.value = null;
  ok.value = false;
  try {
    await $fetch(`${config.public.apiBase}/v1/complaints`, {
      method: "POST",
      body: {
        casinoSlug: form.casinoSlug || null,
        casinoName: form.casinoName || null,
        authorName: form.authorName,
        authorEmail: form.authorEmail,
        subject: form.subject,
        body: form.body,
      },
    });
    ok.value = true;
    form.subject = "";
    form.body = "";
  } catch {
    err.value = t("catalog.complaints.error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <article class="page">
    <h1 class="page-title">{{ t("catalog.complaints.title") }}</h1>
    <p class="lead">{{ t("catalog.complaints.lead") }}</p>

    <form class="form" @submit.prevent="submit">
      <label>
        <span>{{ t("catalog.complaints.casinoSlug") }}</span>
        <input v-model="form.casinoSlug" type="text" />
      </label>
      <label>
        <span>{{ t("catalog.complaints.name") }}</span>
        <input v-model="form.authorName" type="text" required minlength="2" />
      </label>
      <label>
        <span>{{ t("catalog.complaints.email") }}</span>
        <input v-model="form.authorEmail" type="email" required />
      </label>
      <label>
        <span>{{ t("catalog.complaints.subject") }}</span>
        <input v-model="form.subject" type="text" required minlength="3" />
      </label>
      <label>
        <span>{{ t("catalog.complaints.body") }}</span>
        <textarea v-model="form.body" rows="6" required minlength="30" />
      </label>
      <p v-if="ok" class="ok">{{ t("catalog.complaints.ok") }}</p>
      <p v-if="err" class="err">{{ err }}</p>
      <div class="actions">
        <UiButton type="submit" size="sm" :disabled="busy">
          {{ busy ? "…" : t("catalog.complaints.submit") }}
        </UiButton>
        <NuxtLink :to="localePath('/rating/blacklist')">{{ t("catalog.hub.blacklistTitle") }}</NuxtLink>
      </div>
    </form>
  </article>
</template>

<style scoped>
.page { max-width: 640px; }
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
}
.lead { margin: 0 0 18px; color: var(--text-secondary); }
.form { display: grid; gap: 12px; }
label { display: grid; gap: 6px; font-size: 13px; font-weight: 650; }
input, textarea {
  width: 100%;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-elev-1);
  color: var(--text-primary);
  padding: 10px 12px;
  font: inherit;
  font-weight: 400;
}
.actions { display: flex; align-items: center; gap: 14px; }
.ok { color: var(--accent-cta); font-size: 14px; }
.err { color: #c0392b; font-size: 14px; }
</style>
