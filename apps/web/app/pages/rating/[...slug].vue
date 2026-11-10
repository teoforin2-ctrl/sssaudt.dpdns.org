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
  bonusPromo?: string | null;
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
    } catch {
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

const knownHub = computed(
  () =>
    !!hub.value ||
    !!navLink.value ||
    isPaymentsIndex.value ||
    !!paymentData.value?.payment,
);

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
  <section class="page">
    <header class="intro">
      <p class="eyebrow">{{ t("catalog.ratingTitle") }}</p>
      <h1 class="page-title">{{ title }}</h1>
      <p class="lead">
        {{
          isPaymentsIndex || paymentCode
            ? t("catalog.hub.paymentsLead")
            : hub
              ? t(hub.leadKey)
              : t("catalog.ratingLead")
        }}
      </p>
      <p v-if="leaf !== 'blacklist' && !isPaymentsIndex" class="count">
        {{ t("catalog.count", { n: items.length }) }}
      </p>
    </header>

    <div class="tabs">
      <NuxtLink :to="localePath('/rating')" class="tab">{{ t("catalog.hub.all") }}</NuxtLink>
      <NuxtLink :to="localePath('/rating/new')" class="tab">{{ t("catalog.hub.newCasinosTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/rating/licensed')" class="tab">{{ t("catalog.hub.licensedTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/rating/crypto')" class="tab">{{ t("catalog.hub.cryptoTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/rating/payments')" class="tab">{{ t("catalog.hub.paymentsTitle") }}</NuxtLink>
      <NuxtLink :to="localePath('/rating/blacklist')" class="tab">{{ t("catalog.hub.blacklistTitle") }}</NuxtLink>
    </div>

    <div v-if="leaf === 'blacklist'" class="panel bl">
      <p>{{ t("catalog.hub.blacklistBody") }}</p>
      <ul>
        <li>{{ t("catalog.hub.blacklistLi1") }}</li>
        <li>{{ t("catalog.hub.blacklistLi2") }}</li>
        <li>{{ t("catalog.hub.blacklistLi3") }}</li>
      </ul>
      <UiSkeleton v-if="blacklistPending" height="120px" radius="12px" style="margin-top: 14px" />
      <ul v-else-if="blacklistData?.items?.length" class="bl-list">
        <li v-for="b in blacklistData.items" :key="b.id">
          <strong>{{ b.name }}</strong>
          <p>{{ b.reason }}</p>
        </li>
      </ul>
      <p v-else class="note" style="margin-top: 14px">
        {{ t("catalog.hub.blacklistEmpty") }}
      </p>
      <p class="note">
        {{ t("catalog.hub.blacklistNote") }}
        <NuxtLink :to="localePath('/complaints')">{{ t("catalog.hub.complaintCta") }}</NuxtLink>
        ·
        <NuxtLink :to="localePath('/b2b')">{{ t("pages.b2b.title") }}</NuxtLink>
      </p>
    </div>


    <template v-else-if="isPaymentsIndex">
      <UiSkeleton v-if="paymentsPending" height="180px" radius="14px" />
      <ul v-else class="pay">
        <li v-for="p in paymentsData?.items || []" :key="p.code">
          <NuxtLink :to="localePath(`/rating/payments/${p.code}`)">
            <span>{{ p.name }}</span>
            <b>{{ p.casinosCount }}</b>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <template v-else>
      <SkeletonCasinoList v-if="pending || paymentPending" mode="list" :count="6" />
      <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
        <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
      </UiEmptyState>
      <UiEmptyState v-else-if="!items.length" :title="t('catalog.empty')" />
      <div v-else class="list">
        <CasinoRow
          v-for="c in items.slice(0, 40)"
          :key="c.id"
          :casino="c"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.page { max-width: 960px; }
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 62ch;
}
.count { margin: 0 0 14px; font-size: 13px; color: var(--text-tertiary); }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.tab {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  color: var(--text-secondary);
}
.tab.router-link-active {
  border-color: color-mix(in srgb, var(--accent-cta) 45%, var(--border-default));
  background: var(--accent-cta-soft);
  color: var(--text-primary);
}
.list { display: grid; gap: 10px; }
.pay { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.pay a {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  text-decoration: none;
  color: inherit;
  font-weight: 650;
}
.bl {
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.bl p, .bl li { color: var(--text-secondary); font-size: 15px; line-height: 1.6; }
.bl ul { margin: 14px 0; padding-left: 1.2rem; }
.bl-list {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.bl-list li {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-2, var(--bg-elev-1));
}
.bl-list strong { display: block; margin-bottom: 4px; color: var(--text-primary); }
.bl-list p { margin: 0; font-size: 14px; }
.note { margin-top: 16px !important; font-size: 13px !important; color: var(--text-tertiary) !important; }
</style>

