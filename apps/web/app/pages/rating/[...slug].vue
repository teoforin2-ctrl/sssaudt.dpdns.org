<script setup lang="ts">
import { findNavLink, locTitle } from "~/data/site-nav";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();

const parts = computed(() => (route.params.slug as string[]) || []);
const leaf = computed(() => parts.value[parts.value.length - 1] || "");
const path = computed(() => `/rating/${parts.value.join("/")}`);
const navLink = computed(() => findNavLink(path.value));

const isPaymentsIndex = computed(() => parts.value[0] === "payments" && parts.value.length === 1);
const paymentCode = computed(() =>
  parts.value[0] === "payments" && parts.value.length === 2 ? parts.value[1] : "",
);

type CasinoListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
  editorialScore?: number;
  playerScore?: number | null;
  reviewCount?: number;
  hot: boolean;
  top: boolean;
  rank: number;
  isNew?: boolean;
  hasRepresentative?: boolean;
  bonusLabel?: string | null;
  bonusWager?: string | null;
  bonusPromo?: string | null;
  bonusCheckedAt?: string | null;
  license?: string | null;
  crypto?: boolean;
};

type PaymentItem = { code: string; name: string; casinosCount: number; crypto?: boolean };

const hubMeta: Record<string, { titleKey: string; leadKey: string; filter: (c: CasinoListItem) => boolean }> = {
  new: {
    titleKey: "catalog.hub.newCasinosTitle",
    leadKey: "catalog.hub.newCasinosLead",
    filter: (c) => !!c.isNew,
  },
  licensed: {
    titleKey: "catalog.hub.licensedTitle",
    leadKey: "catalog.hub.licensedLead",
    filter: (c) => !!c.license || /лиценз|curacao|malta|mga|license/i.test(c.bonusLabel || ""),
  },
  crypto: {
    titleKey: "catalog.hub.cryptoTitle",
    leadKey: "catalog.hub.cryptoLead",
    filter: (c) =>
      c.crypto === true ||
      /crypto|btc|usdt|bitcoin|крипто/i.test(`${c.bonusLabel || ""} ${c.name}`),
  },
  blacklist: {
    titleKey: "catalog.hub.blacklistTitle",
    leadKey: "catalog.hub.blacklistLead",
    filter: () => false,
  },
};

const hub = computed(() => hubMeta[leaf.value] || null);

const { data: paymentsData, pending: paymentsPending } = await useAsyncData(
  () => `payments-hub-${locale.value}`,
  async () => {
    if (!isPaymentsIndex.value) return null;
    return $fetch<{ items: PaymentItem[] }>(`${config.public.apiBase}/v1/payments`, {
      query: { locale: locale.value },
    });
  },
  { watch: [isPaymentsIndex, locale] },
);

const { data: paymentData, pending: paymentPending } = await useAsyncData(
  () => `payment-${paymentCode.value}-${locale.value}`,
  async () => {
    if (!paymentCode.value) return null;
    try {
      return await $fetch<{
        payment: { code: string; name: string };
        items: CasinoListItem[];
      }>(`${config.public.apiBase}/v1/payments/${paymentCode.value}`, {
        query: { locale: locale.value },
      });
    }
    catch {
      return null;
    }
  },
  { watch: [paymentCode, locale] },
);

const isBlacklist = computed(() => leaf.value === "blacklist");

const { data: blacklistData, pending: blacklistPending } = await useAsyncData(
  () => `blacklist-${locale.value}`,
  async () => {
    if (!isBlacklist.value) return null;
    return $fetch<{ items: { id: string; name: string; slug?: string | null; reason: string; publishedAt?: string | null }[] }>(
      `${config.public.apiBase}/v1/blacklist`,
      { query: { locale: locale.value } },
    );
  },
  { watch: [isBlacklist, locale] },
);

const title = computed(() => {
  if (isPaymentsIndex.value) return t("catalog.hub.paymentsTitle");
  if (paymentData.value?.payment) {
    return t("catalog.hub.paymentCasinos", { name: paymentData.value.payment.name });
  }
  if (hub.value) return t(hub.value.titleKey);
  if (navLink.value) return locTitle(navLink.value.title, locale.value);
  return leaf.value;
});

const { data, pending, error, refresh } = await useAsyncData(
  () => `rating-hub-${leaf.value}-${locale.value}`,
  async () => {
    if (isPaymentsIndex.value || paymentCode.value) return null;
    return $fetch<{ items: CasinoListItem[] }>(`${config.public.apiBase}/v1/casinos`, {
      query: { locale: locale.value },
    });
  },
  { watch: [leaf, locale, isPaymentsIndex, paymentCode] },
);

const items = computed(() => {
  if (paymentData.value?.items) return paymentData.value.items;
  const all = data.value?.items ?? [];
  if (!hub.value || leaf.value === "blacklist") return all;
  const filtered = all.filter(hub.value.filter);
  if (leaf.value === "licensed" && filtered.length < 8) {
    return all.filter((c) => c.rating >= 4.5).slice(0, 40);
  }
  if (leaf.value === "crypto" && filtered.length < 5) return all.slice(0, 30);
  if (leaf.value === "new" && filtered.length < 5) {
    return [...all].sort((a, b) => a.rank - b.rank).slice(-40).reverse();
  }
  return filtered;
});

const visibleCount = ref(20);
watch(leaf, () => {
  visibleCount.value = 20;
});

const visible = computed(() =>
  items.value.slice(0, visibleCount.value).map((c, i) => ({
    ...c,
    displayRank: i + 1,
  })),
);

const knownHub = computed(
  () =>
    !!hub.value ||
    !!navLink.value ||
    isPaymentsIndex.value ||
    !!paymentData.value?.payment,
);

const activeKey = computed(() => {
  if (isPaymentsIndex.value || paymentCode.value) return "payments";
  if (leaf.value === "blacklist") return "blacklist";
  return leaf.value || "all";
});

const hubTabs = computed(() =>
  [
    { key: "all", label: t("catalog.hub.all"), to: localePath("/rating") },
    { key: "new", label: t("catalog.hub.newCasinosTitle"), to: localePath("/rating/new") },
    { key: "licensed", label: t("catalog.hub.licensedTitle"), to: localePath("/rating/licensed") },
    { key: "crypto", label: t("catalog.hub.cryptoTitle"), to: localePath("/rating/crypto") },
    { key: "payments", label: t("catalog.hub.paymentsTitle"), to: localePath("/rating/payments") },
    { key: "blacklist", label: t("catalog.hub.blacklistTitle"), to: localePath("/rating/blacklist") },
  ].map((tab) => ({ ...tab, active: tab.key === activeKey.value })),
);

const paymentGroups = computed(() => {
  const list = paymentsData.value?.items || [];
  const cards = ["visa", "mastercard", "mc"];
  const crypto = ["usdt", "btc", "bitcoin", "eth", "ethereum", "crypto"];
  const fast = ["sbp", "qiwi", "yoomoney"];
  const groups: { key: string; title: string; items: PaymentItem[] }[] = [
    { key: "cards", title: t("catalog.hub.payGroupCards") || "Карты", items: [] },
    { key: "crypto", title: t("catalog.hub.payGroupCrypto") || "Криптовалюты", items: [] },
    { key: "fast", title: t("catalog.hub.payGroupFast") || "Быстрые платежи", items: [] },
    { key: "other", title: t("catalog.hub.payGroupOther") || "Другие", items: [] },
  ];
  const max = Math.max(...list.map((p) => p.casinosCount), 1);
  for (const p of list) {
    const code = p.code.toLowerCase();
    const enriched = { ...p, share: p.casinosCount / max };
    if (cards.some((c) => code.includes(c))) groups[0]!.items.push(enriched as PaymentItem);
    else if (p.crypto || crypto.some((c) => code.includes(c))) groups[1]!.items.push(enriched as PaymentItem);
    else if (fast.some((c) => code.includes(c))) groups[2]!.items.push(enriched as PaymentItem);
    else groups[3]!.items.push(enriched as PaymentItem);
  }
  return groups.filter((g) => g.items.length);
});

usePageSeo({
  title: () => title.value,
  description: () =>
    isPaymentsIndex.value || paymentCode.value
      ? t("catalog.hub.paymentsLead")
      : hub.value
        ? t(hub.value.leadKey)
        : t("catalog.ratingLead"),
  noindex: () => !knownHub.value,
});
</script>

<template>
  <section :class="isBlacklist || isPaymentsIndex ? 'container-narrow' : 'container-wide'" class="page">
    <PublicPageHero
      :eyebrow="t('catalog.ratingTitle')"
      :title="title"
      :lead="
        isPaymentsIndex || paymentCode
          ? t('catalog.hub.paymentsLead')
          : hub
            ? t(hub.leadKey)
            : t('catalog.ratingLead')
      "
      :count="leaf !== 'blacklist' && !isPaymentsIndex ? t('catalog.count', { n: items.length }) : null"
    />

    <PublicSegmentedTabs :tabs="hubTabs" sticky />

    <div v-if="leaf === 'blacklist'" class="bl">
      <div v-if="!blacklistData?.items?.length && !blacklistPending" class="empty-bl">
        <div class="shield icon-bubble" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
        </div>
        <h2>{{ t("catalog.hub.blacklistEmpty") }}</h2>
        <p>{{ t("catalog.hub.blacklistBody") }}</p>
      </div>
      <p v-else class="bl-body">{{ t("catalog.hub.blacklistBody") }}</p>

      <div class="criteria">
        <article class="crit">
          <span class="ico icon-bubble" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <p>{{ t("catalog.hub.blacklistLi1") }}</p>
        </article>
        <article class="crit">
          <span class="ico icon-bubble" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
          </span>
          <p>{{ t("catalog.hub.blacklistLi2") }}</p>
        </article>
        <article class="crit">
          <span class="ico icon-bubble" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </span>
          <p>{{ t("catalog.hub.blacklistLi3") }}</p>
        </article>
      </div>

      <UiSkeleton v-if="blacklistPending" height="120px" radius="12px" style="margin-top: 14px" />
      <ul v-else-if="blacklistData?.items?.length" class="bl-list">
        <li v-for="b in blacklistData.items" :key="b.id">
          <strong>{{ b.name }}</strong>
          <p>{{ b.reason }}</p>
        </li>
      </ul>

      <div class="bl-actions">
        <NuxtLink class="btn btn-primary btn-sm" :to="localePath('/complaints')">
          {{ t("catalog.hub.complaintCta") }}
        </NuxtLink>
        <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/b2b')">
          {{ t("pages.b2b.title") }}
        </NuxtLink>
      </div>
      <p class="note">{{ t("catalog.hub.blacklistNote") }}</p>
    </div>

    <template v-else-if="isPaymentsIndex">
      <UiSkeleton v-if="paymentsPending" height="180px" radius="14px" />
      <div v-else class="pay-groups">
        <section v-for="g in paymentGroups" :key="g.key" class="pay-group">
          <h2>{{ g.title }}</h2>
          <ul class="pay">
            <li v-for="p in g.items" :key="p.code">
              <NuxtLink :to="localePath(`/rating/payments/${p.code}`)">
                <span class="pay-name">{{ p.name }}</span>
                <span class="pay-bar" aria-hidden="true">
                  <i :style="{ width: `${Math.max(8, ((p as any).share || 0) * 100)}%` }" />
                </span>
                <b class="tabular-nums">{{ p.casinosCount }}</b>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <template v-else>
      <SkeletonCasinoList v-if="pending || paymentPending" mode="list" :count="6" />
      <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
        <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
      </UiEmptyState>
      <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
      <div v-else class="list">
        <PublicCasinoRow v-for="c in visible" :key="c.id" :casino="c" />
      </div>
      <div v-if="visibleCount < items.length" class="more">
        <UiButton variant="secondary" size="sm" @click="visibleCount += 20">
          {{ t("catalog.showMoreN", { n: Math.min(20, items.length - visibleCount) }) }}
        </UiButton>
      </div>
      <p v-if="items.length" class="shown tabular-nums">
        {{ t("catalog.shownOf", { shown: visible.length, total: items.length }) }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.list {
  display: grid;
  gap: 10px;
}
.more {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
.shown {
  margin: 12px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
}
.bl-body {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.6;
}
.empty-bl {
  text-align: center;
  padding: 28px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  margin-bottom: 16px;
}
.shield {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 28%, transparent);
  box-shadow: var(--glow-cta);
}
.empty-bl h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 20px;
}
.empty-bl p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}
.criteria {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.crit {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.crit .ico {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 28%, transparent);
}
.crit p {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-secondary);
  line-height: 1.4;
}
.bl-list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 10px;
}
.bl-list li {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-2);
}
.bl-list strong {
  display: block;
  margin-bottom: 4px;
}
.bl-list p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
.bl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.note {
  margin-top: 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.pay-groups {
  display: grid;
  gap: 20px;
}
.pay-group h2 {
  margin: 0 0 10px;
  font-size: 15px;
  font-family: var(--font-display);
}
.pay {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.pay a {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.pay a:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  transform: translateY(-1px);
}
.pay-name {
  font-weight: 750;
  font-size: 14px;
}
.pay-bar {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: var(--bg-elev-3);
  overflow: hidden;
}
.pay-bar i {
  display: block;
  height: 100%;
  background: var(--accent-cta);
  border-radius: inherit;
}
.pay b {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 700;
}
@media (max-width: 900px) {
  .criteria {
    grid-template-columns: 1fr;
  }
  .pay {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .pay {
    grid-template-columns: 1fr;
  }
}
</style>
