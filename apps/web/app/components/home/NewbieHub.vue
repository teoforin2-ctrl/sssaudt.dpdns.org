<script setup lang="ts">
const props = defineProps<{
  topics: { topic: string; items: { slug: string; title: string; readingMinutes?: number; coverTheme?: string; kind?: string }[] }[];
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const active = ref(0);

const labels: Record<string, { ru: string; en: string }> = {
  basics: { ru: "Основы", en: "Basics" },
  terms: { ru: "Термины", en: "Terms" },
  "getting-started": { ru: "Старт", en: "Getting started" },
  slots: { ru: "Слоты", en: "Slots" },
  "table-games": { ru: "Настольные", en: "Table games" },
  live: { ru: "Live", en: "Live" },
  strategies: { ru: "Стратегии", en: "Strategies" },
  bonuses: { ru: "Бонусы", en: "Bonuses" },
  useful: { ru: "Полезное", en: "Useful" },
};

const { locale } = useI18n();
const current = computed(() => props.topics[active.value] || props.topics[0]);

function onTabKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    e.preventDefault();
    active.value = (active.value + 1) % props.topics.length;
  } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    active.value = (active.value - 1 + props.topics.length) % props.topics.length;
  } else if (e.key === "Home") {
    e.preventDefault();
    active.value = 0;
  } else if (e.key === "End") {
    e.preventDefault();
    active.value = Math.max(0, props.topics.length - 1);
  }
}
</script>

<template>
  <section v-if="topics.length" class="sec">
    <SectionHeader :title="t('home.newbie.title')" />
    <div class="hub">
      <div class="tabs" role="tablist" @keydown="onTabKey">
        <button
          v-for="(tp, i) in topics"
          :key="tp.topic"
          type="button"
          role="tab"
          class="tab"
          :class="{ on: i === active }"
          :aria-selected="i === active"
          :tabindex="i === active ? 0 : -1"
          @click="active = i"
        >
          {{ locale.startsWith("en") ? labels[tp.topic]?.en || tp.topic : labels[tp.topic]?.ru || tp.topic }}
        </button>
      </div>
      <div class="panel" role="tabpanel">
        <div class="list">
          <NuxtLink
            v-for="item in current?.items || []"
            :key="item.slug"
            :to="localePath(`/articles/${item.slug}`)"
            class="item"
          >
            <ArticleCover :title="item.title" :theme="item.coverTheme" :kind="item.kind" :slug="item.slug" />
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ t("home.articles.min", { n: item.readingMinutes || 5 }) }}</span>
            </div>
          </NuxtLink>
        </div>
        <NuxtLink
          v-if="current"
          class="all"
          :to="localePath(`/guides/${current.topic}`)"
        >
          {{ t("home.newbie.all") }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec {
  margin-top: 56px;
}
.hub {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
}
.tabs {
  display: grid;
  gap: 4px;
  align-content: start;
}
.tab {
  min-height: 40px;
  text-align: left;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  cursor: pointer;
}
.tab.on {
  border-color: rgba(61, 255, 138, 0.35);
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.item {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  align-items: center;
}
.item :deep(.cover) {
  aspect-ratio: 96 / 64;
}
.item strong {
  display: block;
  font-size: 13px;
  line-height: 1.3;
}
.item span {
  color: var(--text-tertiary);
  font-size: 12px;
}
.all {
  display: inline-block;
  margin-top: 14px;
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
@media (max-width: 900px) {
  .hub {
    grid-template-columns: 1fr;
  }
  .tabs {
    grid-auto-flow: column;
    overflow-x: auto;
  }
  .list {
    grid-template-columns: 1fr;
  }
}
</style>
