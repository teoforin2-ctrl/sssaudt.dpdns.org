<script setup lang="ts">
defineProps<{
  expert: {
    slug: string;
    name: string;
    role?: string | null;
    quote?: string | null;
    hue?: number;
    isSeed?: boolean;
  };
}>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="panel expert">
    <div class="top">
      <p class="label">{{ t("home.expert.label") }}</p>
      <h2>{{ t("home.expert.title") }}</h2>
    </div>
    <div class="row">
      <AuthorAvatar :name="expert.name" :hue="expert.hue || 168" />
      <div class="meta">
        <strong>
          <NuxtLink class="name-link" :to="localePath(`/authors/${expert.slug}`)">
            {{ expert.name }}
          </NuxtLink>
        </strong>
        <p class="role">{{ expert.role }}</p>
        <p class="quote">{{ expert.quote }}</p>
        <NuxtLink class="profile" :to="localePath(`/authors/${expert.slug}`)">
          {{ t("home.expert.profile") }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.expert {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  box-sizing: border-box;
  padding: 22px;
}
.top {
  display: grid;
  gap: 6px;
}
.label {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 800;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
}
.row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.meta {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 2px;
}
.role {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}
.quote {
  margin: 8px 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
}
.profile {
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover,
.profile:hover {
  color: var(--accent-cta);
}
</style>
