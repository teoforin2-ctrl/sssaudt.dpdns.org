<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="banner">
    <div class="bg" aria-hidden="true" />
    <div class="copy">
      <p class="eyebrow">{{ t("home.b2b.eyebrow") }}</p>
      <h2>{{ t("home.b2b.title") }}</h2>
      <p class="lead">{{ t("home.b2b.lead") }}</p>
      <div class="actions">
        <NuxtLink class="btn btn-primary" :to="localePath('/b2b')">
          {{ t("home.b2b.cta") }}
        </NuxtLink>
        <NuxtLink class="ghost" :to="localePath('/b2b') + '#lead'">
          {{ t("home.b2b.secondary") }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.banner {
  position: relative;
  margin-top: 56px;
  min-height: 220px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  display: grid;
  align-items: center;
}
.bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      100deg,
      color-mix(in srgb, var(--bg-base) 94%, transparent) 0%,
      color-mix(in srgb, var(--bg-base) 82%, transparent) 55%,
      color-mix(in srgb, var(--bg-base) 70%, transparent) 100%
    ),
    url("/img/sections/bg-home-b2b.webp") center / cover no-repeat;
  pointer-events: none;
}
html[data-theme="light"] .bg {
  background:
    linear-gradient(
      100deg,
      color-mix(in srgb, var(--bg-base) 97%, transparent) 0%,
      color-mix(in srgb, var(--bg-canvas) 92%, transparent) 55%,
      color-mix(in srgb, var(--bg-canvas) 88%, transparent) 100%
    ),
    url("/img/sections/bg-home-b2b.webp") center / cover no-repeat;
}
.copy {
  position: relative;
  z-index: 1;
  padding: 28px 24px;
  max-width: 640px;
  color: var(--text-primary);
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 800;
}
h2 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: -0.02em;
}
.lead {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.ghost {
  font-size: 14px;
  font-weight: 750;
  color: var(--text-secondary);
  text-decoration: none;
}
.ghost:hover {
  color: var(--accent-cta);
}
</style>
