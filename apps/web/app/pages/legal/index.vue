<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
usePageSeo({
  title: () => t("legal.title"),
  description: () => t("legal.draftNote"),
});


const links = [
  { to: "/legal/18-plus", label: "legal.age" },
  { to: "/legal/responsible-gambling", label: "legal.responsible" },
  { to: "/legal/privacy", label: "legal.privacy" },
  { to: "/legal/cookies", label: "legal.cookies" },
  { to: "/legal/affiliate-disclosure", label: "legal.affiliate" },
];
</script>

<template>
  <article class="legal">
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.title") }}</h1>
    <p class="lead" style="margin-bottom: 18px">{{ t("legal.draftNote") }}</p>

    <div class="legal-grid">
      <NuxtLink v-for="l in links" :key="l.to" class="panel legal-card" :to="localePath(l.to)">
        <h2>{{ t(l.label) }}</h2>
      </NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.legal {
  max-width: 820px;
}
.meta {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.legal-grid {
  display: grid;
  gap: 12px;
}
.legal-card {
  padding: 18px 20px;
  color: inherit;
  text-decoration: none;
}
.legal-card:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 30%, var(--border-default));
  text-decoration: none;
}
.legal-card h2 {
  margin: 0;
  font-size: 16px;
  font-family: var(--font-display);
}
</style>
