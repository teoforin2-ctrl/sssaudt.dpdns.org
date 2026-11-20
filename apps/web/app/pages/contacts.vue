<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const { contacts, siteName } = useSiteSettings();

const editorialEmail = computed(() => contacts.value.email || "");
const partnersEmail = computed(() => contacts.value.email_partners || "");

const socials = computed(() => {
  const c = contacts.value;
  const items: { key: string; label: string; href: string }[] = [];
  const push = (key: string, label: string, href?: string) => {
    const v = (href || "").trim();
    if (v) items.push({ key, label, href: v });
  };
  push("telegram", "Telegram", c.telegram);
  push("vk", "VK", c.vk);
  push("youtube", "YouTube", c.youtube);
  push("x", "X", c.x);
  push("instagram", "Instagram", c.instagram);
  push("facebook", "Facebook", c.facebook);
  push("discord", "Discord", c.discord);
  return items;
});

useHead(() => ({
  title: `${t("pages.contacts.title")}`,
  meta: [{ name: "description", content: t("pages.contacts.lead") }],
}));
</script>

<template>
  <article class="page">
    <p class="eyebrow">{{ t("pages.contacts.eyebrow") }}</p>
    <h1 class="page-title">{{ t("pages.contacts.title") }}</h1>
    <p class="lead">{{ t("pages.contacts.lead") }}</p>

    <div class="grid">
      <div class="panel card">
        <h2>{{ t("pages.contacts.editorial") }}</h2>
        <p>{{ t("pages.contacts.editorialBody") }}</p>
        <a v-if="editorialEmail" class="mail" :href="`mailto:${editorialEmail}`">{{ editorialEmail }}</a>
        <p v-else class="empty">—</p>
      </div>
      <div class="panel card">
        <h2>{{ t("pages.contacts.partners") }}</h2>
        <p>{{ t("pages.contacts.partnersBody") }}</p>
        <a v-if="partnersEmail" class="mail" :href="`mailto:${partnersEmail}`">{{ partnersEmail }}</a>
        <p v-else class="empty">—</p>
        <p class="b2b">
          <NuxtLink :to="localePath('/b2b')">{{ t("pages.b2b.title") }}</NuxtLink>
        </p>
      </div>
    </div>

    <section v-if="socials.length" class="socials card">
      <h2>{{ t("pages.contacts.socials", { brand: siteName }) }}</h2>
      <div class="social-list">
        <a
          v-for="s in socials"
          :key="s.key"
          class="social"
          :href="s.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ s.label }}
        </a>
      </div>
    </section>

    <p class="muted">
      {{ t("pages.contacts.note") }}
      <NuxtLink :to="localePath('/legal/privacy')">{{ t("legal.privacy") }}</NuxtLink>
    </p>
  </article>
</template>

<style scoped>
.page {
  max-width: 900px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.lead {
  margin: 0 0 22px;
  color: var(--text-secondary);
  font-size: 15px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.card {
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.card h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-family: var(--font-display);
}
.card p {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
.mail {
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
.empty {
  margin: 0;
  color: var(--text-tertiary);
}
.b2b {
  margin: 10px 0 0;
  font-size: 13px;
}
.socials {
  margin-top: 14px;
}
.social-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.social {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}
.social:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  color: var(--accent-cta);
}
.muted {
  margin-top: 18px;
  font-size: 13px;
  color: var(--text-tertiary);
}
@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
