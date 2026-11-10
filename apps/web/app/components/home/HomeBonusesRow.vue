<script setup lang="ts">
const props = defineProps<{
  items: {
    id: string;
    title: string;
    type?: string | null;
    amountOrPercent?: string | null;
    wager?: string | null;
    promoCode?: string | null;
    casinoSlug: string;
    casinoName: string;
    casinoLogoUrl?: string | null;
  }[];
}>();

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const list = computed(() => props.items.slice(0, 6));
</script>

<template>
  <section class="sec" aria-labelledby="home-bonuses-title">
    <div class="bg" aria-hidden="true" />
    <div class="inner">
      <SectionHeader
        :title="t('home.bonuses.title')"
        to="/bonuses"
        :link-label="t('home.bonuses.all')"
      />
      <div class="grid">
        <article v-for="b in list" :key="b.id" class="card">
          <div class="card-head">
            <NuxtLink class="logo" :to="localePath(`/casino/${b.casinoSlug}`)">
              <CasinoLogo :name="b.casinoName" :src="b.casinoLogoUrl" size="sm" />
            </NuxtLink>
            <div class="meta">
              <NuxtLink class="casino" :to="localePath(`/casino/${b.casinoSlug}`)">
                {{ b.casinoName }}
              </NuxtLink>
              <div class="chips">
                <UiBadge v-if="b.type" tone="top">{{ b.type }}</UiBadge>
                <span v-if="b.wager">{{ t("catalog.wager", { x: b.wager }) }}</span>
              </div>
            </div>
          </div>
          <h3>
            <NuxtLink class="title" :to="localePath(`/casino/${b.casinoSlug}`)">
              {{ b.title }}
            </NuxtLink>
          </h3>
          <p v-if="b.amountOrPercent" class="amount">{{ b.amountOrPercent }}</p>
          <div class="actions">
            <UiCopyButton v-if="b.promoCode" :value="b.promoCode" />
            <UiButton
              size="sm"
              variant="primary"
              :href="`${config.public.apiBase}/go/${b.casinoSlug}?locale=${locale}`"
              external
            >
              {{ t("home.play") }}
            </UiButton>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec {
  position: relative;
  margin-top: 56px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
}
.bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      120deg,
      color-mix(in srgb, var(--bg-base) 94%, transparent),
      color-mix(in srgb, var(--bg-base) 86%, transparent)
    ),
    url("/img/sections/bg-home-bonuses.jpg") center / cover no-repeat;
  pointer-events: none;
}
html[data-theme="light"] .bg {
  background:
    linear-gradient(
      120deg,
      color-mix(in srgb, var(--bg-base) 97%, transparent),
      color-mix(in srgb, var(--bg-canvas) 92%, transparent)
    ),
    url("/img/sections/bg-home-bonuses.jpg") center / cover no-repeat;
}
.inner {
  position: relative;
  z-index: 1;
  padding: 20px 18px 18px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elev-1) 92%, transparent);
  backdrop-filter: blur(10px);
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
}
.card-head {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 10px;
  align-items: center;
}
.casino {
  color: inherit;
  text-decoration: none;
  font-weight: 700;
  font-size: 13px;
}
.casino:hover,
.title:hover {
  color: var(--accent-cta);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}
h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
}
.title {
  color: inherit;
  text-decoration: none;
}
.amount {
  margin: 0;
  color: var(--accent-cta);
  font-weight: 750;
  font-size: 14px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
