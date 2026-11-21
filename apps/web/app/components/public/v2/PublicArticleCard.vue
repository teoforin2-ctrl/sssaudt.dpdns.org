<script setup lang="ts">
import { articleKindLabel } from "@x-reviewer/shared";
import { ArrowRight } from "lucide-vue-next";
import { formatDate } from "~/utils/format";

const { locale, t } = useI18n();
const localePath = useLocalePath();

const props = defineProps<{
  slug: string;
  title: string;
  excerpt?: string | null;
  kind?: string | null;
  coverTheme?: string | null;
  coverUrl?: string | null;
  readingMinutes?: number | null;
  publishedAt?: string | null;
  authorName?: string | null;
  authorSlug?: string | null;
  featured?: boolean;
}>();

const kindI18nKey: Record<string, string> = {
  "slot-cards": "catalog.hub.slotCardsTitle",
  providers: "catalog.hub.providersTitle",
  glossary: "catalog.hub.glossaryTitle",
  "mechanics-guides": "catalog.hub.mechanicsGuidesTitle",
  news: "catalog.hub.newsTitle",
  collections: "catalog.hub.collectionsTitle",
  guide: "catalog.hub.guidesTitle",
  analytics: "catalog.hub.analyticsTitle",
};

const kindLabel = computed(() => {
  const k = (props.kind || "").toLowerCase().trim();
  if (!k) return null;
  const key = kindI18nKey[k];
  if (key) return t(key);
  return articleKindLabel(k, locale.value === "en" ? "en" : "ru");
});

const dateLabel = computed(() => formatDateTime(props.publishedAt, locale.value));
const initials = computed(() =>
  (props.authorName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);
</script>

<template>
  <article class="card" :class="{ featured }">
    <NuxtLink :to="localePath(`/articles/${slug}`)" class="media">
      <ArticleCover
        :title="title"
        :theme="coverTheme || undefined"
        :kind="kind || undefined"
        :slug="slug"
        :src="coverUrl"
      />
      <PublicBadge v-if="kindLabel" tone="type" class="kind">{{ kindLabel }}</PublicBadge>
    </NuxtLink>
    <div class="body">
      <h2 class="title">
        <NuxtLink :to="localePath(`/articles/${slug}`)">{{ title }}</NuxtLink>
      </h2>
      <p v-if="excerpt" class="ex">{{ excerpt }}</p>
      <div class="foot">
        <span v-if="authorName" class="author">
          <span class="av" aria-hidden="true">{{ initials }}</span>
          <NuxtLink
            v-if="authorSlug"
            class="aname"
            :to="localePath(`/authors/${authorSlug}`)"
          >{{ authorName }}</NuxtLink>
          <span v-else class="aname">{{ authorName }}</span>
        </span>
        <time v-if="dateLabel" class="meta" :datetime="publishedAt || undefined">{{ dateLabel }}</time>
        <span class="meta">{{ t("catalog.readMin", { n: readingMinutes || 5 }) }}</span>
        <span class="arrow" aria-hidden="true">
          <ArrowRight :size="14" :stroke-width="2" />
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  overflow: hidden;
  transition:
    transform 0.15s var(--ease-out),
    border-color 0.15s,
    box-shadow 0.15s;
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
    box-shadow: var(--shadow-1);
  }
  .card:hover .arrow {
    opacity: 1;
    transform: translateX(2px);
  }
  .card:hover :deep(img) {
    transform: scale(1.03);
  }
}
.media {
  position: relative;
  display: block;
  text-decoration: none;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.media :deep(.cover),
.media :deep(img),
.media :deep(.glow) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s var(--ease-out);
}
.kind {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 14px 14px;
  flex: 1;
}
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.title a {
  color: inherit;
  text-decoration: none;
}
.ex {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.foot {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-tertiary);
}
.author {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}
.av {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 800;
  background: var(--bg-elev-3);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.aname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
  font-weight: 650;
  max-width: 140px;
}
.arrow {
  margin-left: auto;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  color: var(--accent-cta);
}
.featured {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 0;
}
.featured .media {
  aspect-ratio: auto;
  min-height: 240px;
  height: 100%;
}
.featured .body {
  padding: 22px;
  justify-content: center;
}
.featured .title {
  font-size: clamp(20px, 2.4vw, 28px);
  -webkit-line-clamp: 4;
}
@media (max-width: 900px) {
  .featured {
    grid-template-columns: 1fr;
  }
}
</style>
