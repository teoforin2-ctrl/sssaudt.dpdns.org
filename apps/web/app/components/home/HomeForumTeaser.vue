<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

defineProps<{
  topics: {
    slug: string;
    title: string;
    author_name?: string;
    posts_count?: number;
    last_post_at?: string;
    category_title?: string;
  }[];
}>();

const { locale, t } = useI18n();
const localePath = useLocalePath();

function ago(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 60) return locale.value === "en" ? `${m}m` : `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 48) return locale.value === "en" ? `${h}h` : `${h} ч`;
  const d = Math.floor(h / 24);
  return locale.value === "en" ? `${d}d` : `${d} д`;
}
</script>

<template>
  <section class="sec" aria-labelledby="home-forum-title">
    <div class="bg" aria-hidden="true" />
    <div class="inner">
      <div class="head">
        <div class="titles">
          <p class="eyebrow">{{ t("home.forum.eyebrow") }}</p>
          <h2 id="home-forum-title">{{ t("home.forum.title") }}</h2>
        </div>
        <NuxtLink class="all" :to="localePath('/forum')">
          {{ t("home.forum.all") }}
          <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
        </NuxtLink>
      </div>
      <div class="list">
        <NuxtLink
          v-for="topic in topics.slice(0, 5)"
          :key="topic.slug"
          class="row"
          :to="localePath(`/forum/tema/${topic.slug}`)"
        >
          <div class="body">
            <strong>{{ topic.title }}</strong>
            <span class="meta">
              <template v-if="topic.author_name">{{ topic.author_name }} · </template>
              <template v-if="topic.category_title">{{ topic.category_title }} · </template>
              {{ ago(topic.last_post_at) }}
              <template v-if="topic.posts_count != null">
                · {{ topic.posts_count }} {{ locale === "en" ? "replies" : "ответов" }}
              </template>
            </span>
          </div>
          <span class="arrow" aria-hidden="true">
            <ArrowRight :size="16" :stroke-width="2" />
          </span>
        </NuxtLink>
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
      115deg,
      color-mix(in srgb, var(--bg-base) 94%, transparent),
      color-mix(in srgb, var(--bg-base) 86%, transparent)
    ),
    url("/img/sections/bg-home-forum.webp") center / cover no-repeat;
  pointer-events: none;
}
html[data-theme="light"] .bg {
  background:
    linear-gradient(
      115deg,
      color-mix(in srgb, var(--bg-base) 97%, transparent),
      color-mix(in srgb, var(--bg-canvas) 92%, transparent)
    ),
    url("/img/sections/bg-home-forum.webp") center / cover no-repeat;
}
.inner {
  position: relative;
  z-index: 1;
  padding: 20px 18px;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: baseline;
  margin-bottom: 14px;
}
.titles {
  flex: 1 1 auto;
  min-width: 0;
}
.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 800;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--text-primary);
}
.all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
  white-space: nowrap;
}
.list {
  display: grid;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-elev-1) 92%, transparent);
  backdrop-filter: blur(10px);
  text-decoration: none;
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}
.row:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  transform: translateY(-1px);
}
.body {
  min-width: 0;
  display: grid;
  gap: 4px;
}
strong {
  font-size: 14px;
  line-height: 1.35;
}
.meta {
  font-size: 12px;
  color: var(--text-tertiary);
}
.arrow {
  color: var(--accent-cta);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
</style>
