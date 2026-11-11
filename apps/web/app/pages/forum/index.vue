<script setup lang="ts">
import { forumAgo, forumFmt, forumReplyLabel, forumTags } from "~/utils/forum";

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { user, fetchMe } = useAuth();

onMounted(() => {
  void fetchMe();
});

type Category = {
  slug: string;
  icon: string;
  title: string;
  description: string;
  topics_count: number;
  posts_count: number;
  last_topic?: { title: string; author: string; at: string; slug: string } | null;
};

type Topic = {
  slug: string;
  title: string;
  author_name: string;
  author_badge?: string | null;
  posts_count: number;
  views_count: number;
  last_post_at: string;
  category_slug: string;
  category_title: string;
  tags?: unknown;
};

const showNew = ref(false);

const { data, pending, error, refresh } = await useAsyncData(
  () => `forum-home-${locale.value}`,
  () =>
    $fetch<{
      stats: { topics: number; posts: number };
      categories: Category[];
      recent: Topic[];
    }>(`${config.public.apiBase}/v1/forum`, { query: { locale: locale.value } }),
  { watch: [locale] },
);

const popular = computed(() =>
  [...(data.value?.recent || [])].sort((a, b) => b.posts_count - a.posts_count).slice(0, 10),
);

useHead(() => ({
  title: `${t("pages.forum.title")}`,
  meta: [{ name: "description", content: t("pages.forum.lead") }],
}));
</script>

<template>
  <div class="page">
    <nav class="crumbs" aria-label="Breadcrumb">
      <NuxtLink :to="localePath('/')">⌂</NuxtLink>
      <span>/</span>
      <span>{{ t("pages.forum.title") }}</span>
    </nav>

    <header class="hero">
      <div>
        <h1 class="page-title">{{ t("pages.forum.title") }}</h1>
        <p v-if="data" class="stats">
          {{ forumFmt(data.stats.topics, locale) }} {{ locale === "en" ? "topics" : "тем" }}
          · {{ forumFmt(data.stats.posts, locale) }} {{ locale === "en" ? "posts" : "сообщений" }}
        </p>
      </div>
      <div class="hero-actions">
        <UiButton size="sm" @click="showNew = true">
          + {{ locale === "en" ? "New topic" : "Новая тема" }}
        </UiButton>
        <UiButton size="sm" variant="secondary" :href="localePath('/forum/rules')">
          {{ t("pages.forum.rulesLink") }}
        </UiButton>
      </div>
    </header>

    <NuxtLink class="search" :to="localePath('/search')">
      <span class="search-ico" aria-hidden="true">⌕</span>
      <span>{{ locale === "en" ? "Search forum and site…" : "Поиск по форуму и сайту…" }}</span>
    </NuxtLink>

    <SkeletonForumTopics v-if="pending && !data" :count="5" />
    <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
      <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
    </UiEmptyState>

    <div v-else class="layout">
      <div class="main">
        <section>
          <h2>{{ locale === "en" ? "Sections" : "Разделы" }}</h2>
          <div class="cats">
            <div
              v-for="c in data?.categories || []"
              :key="c.slug"
              class="cat"
            >
              <NuxtLink class="cat-main" :to="localePath(`/forum/kategoriya/${c.slug}`)">
                <div class="cat-ico" aria-hidden="true">{{ c.icon || "💬" }}</div>
                <div class="cat-body">
                  <strong>{{ c.title }}</strong>
                  <p>{{ c.description }}</p>
                  <span class="meta">
                    {{ forumFmt(c.topics_count, locale) }} {{ locale === "en" ? "topics" : "тем" }}
                    · {{ forumFmt(c.posts_count, locale) }} {{ locale === "en" ? "posts" : "сообщений" }}
                  </span>
                </div>
              </NuxtLink>
              <div v-if="c.last_topic" class="cat-last">
                <NuxtLink
                  class="line-clamp last-topic"
                  :to="localePath(`/forum/tema/${c.last_topic.slug}`)"
                >
                  {{ c.last_topic.title }}
                </NuxtLink>
                <span>{{ c.last_topic.author }} · {{ forumAgo(c.last_topic.at, locale) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="recent-sec">
          <h2>{{ locale === "en" ? "Latest topics" : "Последние темы" }}</h2>
          <div class="topics-card">
            <NuxtLink
              v-for="topic in data?.recent || []"
              :key="topic.slug"
              class="topic"
              :to="localePath(`/forum/tema/${topic.slug}`)"
            >
              <span class="topic-ico" aria-hidden="true">✦</span>
              <div class="topic-body">
                <strong class="line-clamp">{{ topic.title }}</strong>
                <div class="topic-meta">
                  <span>{{ topic.author_name }}</span>
                  <span v-if="topic.author_badge" class="badge">{{ topic.author_badge }}</span>
                  <span
                    v-for="tag in forumTags(topic.tags).slice(0, 3)"
                    :key="tag"
                    class="chip"
                  >{{ tag }}</span>
                  <span>· {{ forumAgo(topic.last_post_at, locale) }}</span>
                </div>
              </div>
              <div class="topic-side">
                <strong>{{ forumReplyLabel(topic.posts_count, locale) }}</strong>
              </div>
            </NuxtLink>
          </div>
        </section>
      </div>

      <aside class="side">
        <div class="panel">
          <h3>{{ locale === "en" ? "Popular topics" : "Популярные темы" }}</h3>
          <NuxtLink
            v-for="topic in popular"
            :key="topic.slug"
            class="pop"
            :to="localePath(`/forum/tema/${topic.slug}`)"
          >
            <span class="line-clamp">{{ topic.title }}</span>
            <em>{{ topic.posts_count }}</em>
          </NuxtLink>
        </div>

        <div v-if="!user" class="panel cta">
          <h3>{{ locale === "en" ? "Sign up" : "Зарегистрируйтесь" }}</h3>
          <p>
            {{ locale === "en"
              ? "Create topics, leave reviews and talk to experts."
              : "Создавайте темы, оставляйте отзывы и общайтесь с экспертами." }}
          </p>
          <UiButton size="sm" :href="localePath('/register')">
            {{ locale === "en" ? "Sign up" : "Регистрация" }}
          </UiButton>
        </div>
      </aside>
    </div>

    <ForumNewTopicModal
      v-if="showNew"
      :categories="(data?.categories || []).map((c) => ({ slug: c.slug, title: c.title }))"
      @close="showNew = false"
    />
  </div>
</template>

<style scoped>
.page { max-width: 1180px; }
.crumbs {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.crumbs a { color: var(--text-secondary); text-decoration: none; font-weight: 700; }
.hero {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 18px;
}
.page-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
}
.stats {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 640px;
  margin-bottom: 28px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 14px;
}
.search-ico { color: var(--accent-cta); font-size: 16px; }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 28px;
  align-items: start;
}
.main h2, .side h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 18px;
}
.side h3 { font-size: 14px; }
.cats { display: grid; gap: 10px; }
.cat {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  transition: border-color 0.15s var(--ease-out), transform 0.15s var(--ease-out);
}
.cat:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  transform: translateY(-1px);
}
.cat-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.cat-ico {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--bg-elev-2);
  font-size: 22px;
}
.cat-body { min-width: 0; }
.cat-body strong { font-size: 15px; }
.cat-body p {
  margin: 4px 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.meta { font-size: 12px; color: var(--text-tertiary); }
.cat-last {
  max-width: 200px;
  padding-left: 14px;
  border-left: 1px solid var(--border-default);
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}
.cat-last .line-clamp,
.cat-last .last-topic {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 650;
  margin-bottom: 2px;
  text-decoration: none;
}
.cat-last .last-topic:hover {
  color: var(--accent-cta);
}
.recent-sec { margin-top: 32px; }
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
.topic-ico {
  color: var(--accent-cta);
  margin-top: 3px;
  font-size: 12px;
}
.topic-body { flex: 1; min-width: 0; }
.topic-body strong { font-size: 14px; font-weight: 700; }
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
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.chip { background: var(--bg-elev-3); color: var(--text-secondary); }
.topic-side {
  text-align: right;
  min-width: 52px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.topic-side strong {
  display: block;
  color: var(--text-primary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.panel {
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  margin-bottom: 12px;
}
.panel.cta {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  background: color-mix(in srgb, var(--accent-cta) 8%, var(--bg-elev-1));
}
.panel.cta p {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
.pop {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.35;
  border-top: 1px solid var(--border-subtle);
}
.pop:first-of-type { border-top: 0; padding-top: 0; }
.pop:hover { color: var(--accent-cta); }
.pop em {
  font-style: normal;
  color: var(--text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
  .cat { grid-template-columns: 1fr; }
  .cat-last {
    max-width: none;
    text-align: left;
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid var(--border-subtle);
    padding-top: 8px;
  }
}
</style>
