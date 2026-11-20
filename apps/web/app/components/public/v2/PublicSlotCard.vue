<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

defineProps<{
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  providerName?: string | null;
  isNew?: boolean;
  mechanics?: string[];
  demoUrl?: string | null;
  coverSrc?: string | null;
}>();
</script>

<template>
  <article class="card">
    <NuxtLink :to="localePath(`/slots/${slug}`)" class="cover-link">
      <SlotCover :title="title" :theme="theme" :slug="slug" :src="coverSrc" :rtp="null" />
      <span v-if="rtp != null" class="rtp" :class="{ good: rtp >= 96.5 }">
        RTP {{ rtp.toFixed(1) }}%
      </span>
      <span v-if="isNew || mechanics?.includes('megaways') || mechanics?.includes('bonus-buy')" class="corner">
        <PublicBadge v-if="isNew" tone="new">{{ t("home.new") }}</PublicBadge>
        <PublicBadge v-else-if="mechanics?.includes('megaways')" tone="type">Megaways</PublicBadge>
        <PublicBadge v-else-if="mechanics?.includes('bonus-buy')" tone="hot">{{ t("home.slots.filters.bonusBuy") }}</PublicBadge>
      </span>
      <span v-if="demoUrl" class="demo-hover">{{ t("catalog.demo") }}</span>
    </NuxtLink>
    <h2 class="title">
      <NuxtLink :to="localePath(`/slots/${slug}`)">{{ title }}</NuxtLink>
    </h2>
    <p v-if="providerName" class="provider">{{ providerName }}</p>
    <div class="actions">
      <UiButton
        v-if="demoUrl"
        size="sm"
        variant="secondary"
        class="demo-mobile"
        :href="demoUrl"
        external
      >
        {{ t("catalog.demo") }}
      </UiButton>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100%;
}
.cover-link {
  position: relative;
  display: block;
  text-decoration: none;
  border-radius: 14px;
  overflow: hidden;
}
.rtp {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rtp.good {
  background: color-mix(in srgb, var(--accent-gold) 78%, #000);
}
.corner {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  display: flex;
  gap: 4px;
}
.demo-hover {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgba(8, 11, 16, 0.55);
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s;
}
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .cover-link:hover .demo-hover {
    opacity: 1;
  }
}
.title {
  margin: 0;
  font-size: 14px;
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.title a {
  color: inherit;
  text-decoration: none;
}
.provider {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
.actions {
  margin-top: auto;
}
.demo-mobile {
  display: none;
  width: 100%;
}
@media (hover: none) {
  .demo-mobile {
    display: inline-flex;
  }
  .demo-hover {
    display: none;
  }
}
</style>
