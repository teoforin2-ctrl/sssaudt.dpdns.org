<script setup lang="ts">
import { formatDate, formatWager, wagerTone } from "~/utils/format";

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const props = defineProps<{
  id?: string;
  title: string;
  type?: string | null;
  wager?: string | null;
  minDeposit?: string | null;
  validUntil?: string | null;
  promoCode?: string | null;
  checkedAt?: string | null;
  casinoSlug: string;
  casinoName: string;
  casinoLogoUrl?: string | null;
  compact?: boolean;
}>();

const wagerLabel = computed(() => formatWager(props.wager));
const wagerToneVal = computed(() => wagerTone(props.wager));
const checked = computed(() => formatDate(props.checkedAt, locale.value));
const minDep = computed(() => {
  const v = props.minDeposit?.trim();
  if (!v || v === "—" || v === "-") return null;
  return v;
});
</script>

<template>
  <article class="card" :class="{ compact }">
    <div class="head">
      <NuxtLink class="logo" :to="localePath(`/casino/${casinoSlug}`)">
        <CasinoLogo :name="casinoName" :src="casinoLogoUrl" size="sm" variant="v2" />
      </NuxtLink>
      <div class="head-text">
        <NuxtLink class="casino" :to="localePath(`/casino/${casinoSlug}`)">{{ casinoName }}</NuxtLink>
        <PublicBadge v-if="type" tone="type">{{ type }}</PublicBadge>
      </div>
    </div>

    <h2 class="title">
      <NuxtLink :to="localePath(`/casino/${casinoSlug}`)">{{ title }}</NuxtLink>
    </h2>

    <div v-if="wagerLabel || minDep || validUntil" class="facts">
      <span v-if="wagerLabel" class="fact" :class="wagerToneVal ? `w-${wagerToneVal}` : undefined">
        {{ t("catalog.wagerShort", { x: wagerLabel }) }}
      </span>
      <span v-if="minDep" class="fact">{{ t("catalog.minDeposit", { v: minDep }) }}</span>
      <span v-if="validUntil" class="fact">{{ formatDate(validUntil, locale) }}</span>
    </div>

    <PublicCopyChip v-if="promoCode" :value="promoCode" />

    <div class="foot">
      <UiButton
        variant="primary"
        size="sm"
        class="play"
        :href="`${config.public.apiBase}/go/${casinoSlug}?locale=${locale}`"
        external
      >
        {{ t("home.play") }}
      </UiButton>
      <NuxtLink class="review" :to="localePath(`/casino/${casinoSlug}`)">
        {{ t("catalog.openCasino") }}
      </NuxtLink>
      <p v-if="checked" class="checked">
        <span aria-hidden="true">✓</span>
        {{ t("catalog.checked", { d: checked }) }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  transition:
    border-color 0.15s,
    transform 0.15s var(--ease-out),
    box-shadow 0.15s;
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
    box-shadow: var(--shadow-1);
  }
}
.head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.logo {
  line-height: 0;
  text-decoration: none;
}
.head-text {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.casino {
  font-size: 13px;
  font-weight: 750;
  color: var(--text-primary);
  text-decoration: none;
}
.casino:hover {
  color: var(--accent-cta);
}
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
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
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fact {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 9px;
  border-radius: 8px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.fact.w-good {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  border-color: transparent;
}
.fact.w-mid {
  background: var(--accent-amber-soft);
  color: var(--accent-amber);
  border-color: transparent;
}
.fact.w-high {
  background: var(--accent-rose-soft);
  color: var(--accent-rose);
  border-color: transparent;
}
.foot {
  margin-top: auto;
  display: grid;
  gap: 8px;
}
.play {
  width: 100%;
}
.review {
  font-size: 13px;
  font-weight: 750;
  color: var(--text-secondary);
  text-decoration: none;
  text-align: center;
}
.review:hover {
  color: var(--accent-cta);
}
.checked {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
}
.checked span {
  color: var(--accent-cta);
}
.compact {
  padding: 12px;
}
</style>
