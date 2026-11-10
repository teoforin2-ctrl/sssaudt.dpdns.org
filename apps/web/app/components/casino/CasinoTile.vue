<script setup lang="ts">
const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const props = defineProps<{
  casino: {
    slug: string;
    name: string;
    logoUrl?: string | null;
    rating: number;
    hot?: boolean;
    top?: boolean;
    rank: number;
    hasRepresentative?: boolean;
    isNew?: boolean;
    bonusLabel?: string | null;
  };
}>();

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}
</script>

<template>
  <article class="tile">
    <div class="head">
      <NuxtLink class="logo-link" :to="localePath(`/casino/${casino.slug}`)">
        <CasinoLogo :name="casino.name" :src="casino.logoUrl" />
      </NuxtLink>
      <div class="badges">
        <UiBadge v-if="casino.top" tone="top">TOP</UiBadge>
        <UiBadge v-if="casino.hot" tone="hot">HOT</UiBadge>
        <UiBadge v-if="casino.isNew" tone="new">NEW</UiBadge>
      </div>
    </div>
    <h3>
      <NuxtLink class="name-link" :to="localePath(`/casino/${casino.slug}`)">
        {{ displayName(casino.name) }}
      </NuxtLink>
    </h3>
    <div class="rating">
      <UiRatingStars :value="casino.rating" size="sm" />
      <strong>{{ casino.rating.toFixed(1) }}</strong>
    </div>
    <p class="offer">{{ casino.bonusLabel || t("home.offerFallback") }}</p>
    <div class="actions">
      <a
        class="btn btn-primary btn-sm"
        :href="`${config.public.apiBase}/go/${casino.slug}?locale=${locale}`"
        rel="sponsored nofollow noopener"
        target="_blank"
      >
        {{ t("home.play") }}
      </a>
      <NuxtLink class="review" :to="localePath(`/casino/${casino.slug}`)">
        {{ t("home.review") }}
      </NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.tile {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  transition:
    transform 0.15s var(--ease),
    border-color 0.15s;
}
.tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.rating {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rating strong {
  font-size: 14px;
}
.offer {
  margin: 0;
  min-height: 2.6em;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.review {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-decoration: none;
}
.review:hover {
  color: var(--text-primary);
}
</style>
