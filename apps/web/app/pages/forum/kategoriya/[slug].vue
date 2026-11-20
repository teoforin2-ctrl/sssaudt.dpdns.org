<script setup lang="ts">
import { MessageSquare } from "lucide-vue-next";
import { forumAgo, forumFmt, forumReplyLabel, forumTags } from "~/utils/forum";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug));
const showNew = ref(false);

const { data, pending, error, refresh } = await useAsyncData(
  () => `forum-cat-${slug.value}-${locale.value}`,
  async () => {
    const [cat, home] = await Promise.all([
      $fetch<{
        category: { slug: string; title: string; description: string; icon: string };
        items: Array<{
          slug: string;
          title: string;
          author_name: string;
          author_badge?: string | null;
          posts_count: number;
          views_count: number;
          last_post_at: string;
          tags?: unknown;
        }>;
        total: number;
      }>(`${config.public.apiBase}/v1/forum/categories/${slug.value}`, {
        query: { locale: locale.value, limit: 50 },
      }),
      $fetch<{ categories: { slug: string; title: string }[] }>(
        `${config.public.apiBase}/v1/forum`,
        { query: { locale: locale.value } },
      ),
    ]);
    return { ...cat, allCategories: home.categories };
  },
  { watch: [slug, locale] },
);

useHead(() => ({
  title: `${data.value?.category?.title || t("pages.forum.title")}`,
  meta: [{ name: "description", content: data.value?.category?.description || t("pages.forum.lead") }],
}));
</script>

<template>
  <div class="page">
    <nav class="crumbs">
      <NuxtLink :to="localePath('/forum')">{{ t("pages.forum.title") }}</NuxtLink>
      <span>/</span>
      <span>{{ data?.category?.title || "…" }}</span>
    </nav>

    <SkeletonForumTopics v-if="pending && !data" :count="5" />
    <UiEmptyState v-else-if="error || !data?.category" title="404">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>

    <template v-else>
      <header class="hero">
        <div>
          <div class="icon" aria-hidden="true">
            <ForumCatIcon :slug="data.category.slug" :emoji="data.category.icon" :size="28" />
          </div>
          <h1 class="page-title">{{ data.category.title }}</h1>
          <p class="lead">{{ data.category.description }}</p>
          <p class="count">{{ forumFmt(data.total, locale) }} {{ locale === "en" ? "topics" : "тем" }}</p>
        </div>
        <UiButton size="sm" @click="showNew = true">
          + {{ locale === "en" ? "New topic" : "Новая тема" }}
        </UiButton>
      </header>

      <div class="topics-card">
        <NuxtLink
          v-for="topic in data.items"
          :key="topic.slug"
          class="topic"
          :to="localePath(`/forum/tema/${topic.slug}`)"
        >
          <span class="topic-ico" aria-hidden="true">
            <MessageSquare :size="16" :stroke-width="2" />
          </span>
          <div class="topic-body">
            <strong>{{ topic.title }}</strong>
            <div class="topic-meta">
              <span>{{ topic.author_name }}</span>
              <span v-if="topic.author_badge" class="badge">{{ topic.author_badge }}</span>
              <span
                v-for="tag in forumTags(topic.tags).slice(0, 3)"
                :key="tag"
                class="chip"
              >{{ tag }}</span>
              <span>· {{ forumAgo(topic.last_post_at, locale) }} · {{ forumReplyLabel(topic.posts_count, locale) }}</span>
            </div>
          </div>
        </NuxtLink>
        <UiEmptyState v-if="!data.items.length" :title="t('catalog.empty')" />
      </div>
    </template>

    <ForumNewTopicModal
      v-if="showNew && data"
      :categories="data.allCategories"
      :default-category-slug="data.category.slug"
      @close="showNew = false"
    />
  </div>
</template>

<style scoped>
.page { max-width: 960px; }
.crumbs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.crumbs a { color: var(--text-secondary); font-weight: 700; text-decoration: none; }
.hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 22px;
}
.icon {
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent-cta) 10%, var(--bg-elev-2));
  color: var(--accent-cta);
}
.lead {
  margin: 0 0 6px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 62ch;
}
.count { margin: 0; font-size: 13px; color: var(--text-tertiary); }
.topics-card {
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  overflow: hidden;
}
.topic {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
  border-top: 1px solid var(--border-subtle);
}
.topic:first-child { border-top: 0; }
.topic:hover { background: var(--bg-elev-2); }
.topic-ico { color: var(--accent-cta); margin-top: 3px; display: grid; place-items: start; }
.topic-body { min-width: 0; flex: 1; }
.topic-body strong { font-size: 14px; }
.topic-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.badge, .chip {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
}
.badge { background: var(--accent-cta-soft); color: var(--accent-cta); }
.chip { background: var(--bg-elev-3); color: var(--text-secondary); }
</style>
