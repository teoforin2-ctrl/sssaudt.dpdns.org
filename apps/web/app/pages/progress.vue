<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { playerId, hydrate } = useRewardGroup();
const { user, fetchMe } = useAuth();

onMounted(async () => {
  hydrate();
  await fetchMe();
  if (user.value?.role === "player") {
    const dash = String(config.public.dashboardUrl || "http://127.0.0.1:3711").replace(/\/$/, "");
    window.location.href = `${dash}/account?tab=progress&lang=${locale.value}`;
    return;
  }
});

type Progress = {
  xp: number;
  level: number;
  reviewsApproved: number;
  intoLevel: number;
  nextLevelXp: number;
  achievements: {
    id: string;
    title: string;
    description: string;
    unlockedAt: string | null;
  }[];
};

type Promo = {
  id: string;
  title: string;
  minLevel: number;
  claimed: boolean;
  code: string | null;
};

const { data, pending, refresh, error } = await useAsyncData(
  () => `progress-${playerId.value || "anon"}-${locale.value}`,
  async () => {
    if (!playerId.value) return null;
    const progress = await $fetch<Progress>(
      `${config.public.apiBase}/v1/players/${playerId.value}/progress`,
      { query: { locale: locale.value } },
    );
    const promos = await $fetch<{ items: Promo[] }>(
      `${config.public.apiBase}/v1/exclusive-promos`,
      {
        query: {
          locale: locale.value,
          playerId: playerId.value,
          // high ceiling so locked promos still appear (claim gated by real level)
          level: 99,
        },
      },
    );
    return { progress, promos: promos.items };
  },
  { watch: [playerId, locale] },
);

const claiming = ref<string | null>(null);
async function claim(id: string) {
  if (!playerId.value) return;
  claiming.value = id;
  try {
    await $fetch(`${config.public.apiBase}/v1/exclusive-promos/${id}/claim`, {
      method: "POST",
      body: { playerId: playerId.value },
    });
    await refresh();
  }
  finally {
    claiming.value = null;
  }
}

usePageSeo({
  title: () => t("progress.title"),
  description: () => t("progress.lead"),
});
</script>

<template>
  <section class="page">
    <h1 class="page-title">{{ t("progress.title") }}</h1>
    <p class="lead">{{ t("progress.lead") }}</p>

    <p v-if="!playerId" class="hint">
      {{ t("progress.needPlayer") }}
    </p>

    <template v-else-if="data?.progress">
      <div class="card stats">
        <div>
          <p class="label">{{ t("progress.level") }}</p>
          <p class="val">{{ data.progress.level }}</p>
        </div>
        <div>
          <p class="label">XP</p>
          <p class="val">{{ data.progress.xp }}</p>
        </div>
        <div>
          <p class="label">{{ t("progress.reviews") }}</p>
          <p class="val">{{ data.progress.reviewsApproved }}</p>
        </div>
      </div>
      <div class="bar">
        <div
          class="fill"
          :style="{ width: `${Math.min(100, (data.progress.intoLevel / Math.max(1, data.progress.nextLevelXp)) * 100)}%` }"
        />
      </div>
      <p class="meta">
        {{ data.progress.intoLevel }} / {{ data.progress.nextLevelXp }} XP
        <ArrowRight :size="13" :stroke-width="2" aria-hidden="true" />
        {{ t("progress.level") }} {{ data.progress.level + 1 }}
      </p>

      <h2>{{ t("progress.achievements") }}</h2>
      <ul class="ach">
        <li
          v-for="a in data.progress.achievements"
          :key="a.id"
          :class="{ on: !!a.unlockedAt }"
        >
          <strong>{{ a.title }}</strong>
          <span>{{ a.description }}</span>
        </li>
      </ul>

      <h2>{{ t("progress.exclusive") }}</h2>
      <ul class="promo">
        <li v-for="p in data.promos" :key="p.id">
          <div>
            <strong>{{ p.title }}</strong>
            <span>{{ t("progress.minLevel", { n: p.minLevel }) }}</span>
          </div>
          <code v-if="p.claimed && p.code">{{ p.code }}</code>
          <UiButton
            v-else
            size="sm"
            :disabled="claiming === p.id || data.progress.level < p.minLevel"
            @click="claim(p.id)"
          >
            {{ t("progress.claim") }}
          </UiButton>
        </li>
      </ul>
    </template>
    <UiSkeleton v-else-if="pending" height="180px" radius="12px" />
    <p v-else-if="error" class="hint">{{ t("home.apiDown") }}</p>
  </section>
</template>

<style scoped>
.page { max-width: 720px; }
.lead, .hint, .meta { color: var(--text-secondary); font-size: 14px; }
.meta { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.card.stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  padding: 16px; border-radius: 14px; border: 1px solid var(--border-default);
  background: var(--bg-elev-1); margin: 16px 0 10px;
}
.label { margin: 0; font-size: 12px; color: var(--text-tertiary); }
.val { margin: 4px 0 0; font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.bar {
  height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--border-default) 70%, transparent);
  overflow: hidden;
}
.fill { height: 100%; background: var(--accent-cta); }
h2 { font-family: var(--font-display); font-size: 18px; margin: 22px 0 10px; }
.ach, .promo { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ach li, .promo li {
  display: grid; gap: 4px; padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--border-default); background: var(--bg-elev-1);
  opacity: 0.55;
}
.ach li.on { opacity: 1; border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default)); }
.ach span, .promo span { font-size: 13px; color: var(--text-secondary); }
.promo li { grid-template-columns: 1fr auto; align-items: center; opacity: 1; }
code {
  font-size: 13px; padding: 4px 8px; border-radius: 8px;
  background: color-mix(in srgb, var(--border-default) 35%, transparent);
}
</style>
