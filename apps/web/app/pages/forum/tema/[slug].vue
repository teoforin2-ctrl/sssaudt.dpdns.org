<script setup lang="ts">
import { forumAgo, forumFmt, forumInitials, forumParagraphs, forumReplyLabel, forumTags } from "~/utils/forum";

const config = useRuntimeConfig();
const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { user, fetchMe } = useAuth();
const slug = computed(() => String(route.params.slug));

onMounted(() => {
  void fetchMe();
});

const loginRedirect = computed(() => ({
  path: localePath("/login"),
  query: { redirect: route.fullPath },
}));
const registerRedirect = computed(() => ({
  path: localePath("/register"),
  query: { redirect: route.fullPath },
}));

type Post = {
  id: string;
  authorName: string;
  authorBadge?: string | null;
  bodyMd: string;
  quoteAuthor?: string | null;
  quoteText?: string | null;
  helpful: number;
  createdAt: string;
};

type Topic = {
  slug: string;
  title: string;
  tags: unknown;
  authorName: string;
  authorBadge?: string | null;
  postsCount: number;
  viewsCount: number;
  isLocked: boolean;
  createdAt: string;
  categorySlug: string;
  categoryTitle: string;
};

type Related = {
  slug: string;
  title: string;
  posts_count: number;
  last_post_at: string;
};

const { data, pending, error, refresh } = await useAsyncData(
  () => `forum-topic-${slug.value}-${locale.value}`,
  async () => {
    const detail = await $fetch<{ topic: Topic; posts: Post[]; total: number }>(
      `${config.public.apiBase}/v1/forum/topics/${slug.value}`,
      { query: { locale: locale.value, limit: 100 } },
    );
    const home = await $fetch<{ recent: Related[] }>(`${config.public.apiBase}/v1/forum`, {
      query: { locale: locale.value },
    });
    return {
      ...detail,
      related: (home.recent || []).filter((t) => t.slug !== slug.value).slice(0, 5),
    };
  },
  { watch: [slug, locale] },
);

const reply = ref("");
const quote = ref<{ author: string; text: string } | null>(null);
const sending = ref(false);
const sendErr = ref<string | null>(null);

function setQuote(p: Post) {
  quote.value = {
    author: p.authorName,
    text: forumParagraphs(p.bodyMd)[0]?.slice(0, 180) || "",
  };
  if (import.meta.client) {
    document.getElementById("reply-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function submitReply() {
  sendErr.value = null;
  if (!reply.value.trim()) return;
  sending.value = true;
  try {
    await $fetch(`${config.public.apiBase}/v1/forum/topics/${slug.value}/replies`, {
      method: "POST",
      credentials: "include",
      body: {
        body: reply.value.trim(),
        quoteAuthor: quote.value?.author ?? null,
        quoteText: quote.value?.text ?? null,
      },
    });
    reply.value = "";
    quote.value = null;
    await refresh();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; data?: { error?: string } };
    if (e.statusCode === 401) {
      sendErr.value = locale.value === "en" ? "Sign in to reply" : "Войдите, чтобы ответить";
    } else if (e.data?.error === "locked") {
      sendErr.value = locale.value === "en" ? "Topic is locked" : "Тема закрыта";
    } else {
      sendErr.value = locale.value === "en" ? "Failed to send" : "Не удалось отправить";
    }
  } finally {
    sending.value = false;
  }
}

useHead(() => ({
  title: `${data.value?.topic?.title || t("pages.forum.title")}`,
  meta: [{
    name: "description",
    content: data.value?.topic
      ? `${data.value.topic.title}. ${forumReplyLabel(data.value.topic.postsCount, locale.value)}.`
      : t("pages.forum.lead"),
  }],
}));
</script>

<template>
  <div class="page">
    <nav class="crumbs">
      <NuxtLink :to="localePath('/forum')">{{ t("pages.forum.title") }}</NuxtLink>
      <template v-if="data?.topic">
        <span>/</span>
        <NuxtLink :to="localePath(`/forum/kategoriya/${data.topic.categorySlug}`)">
          {{ data.topic.categoryTitle }}
        </NuxtLink>
        <span>/</span>
        <span class="crumb-title">{{ data.topic.title }}</span>
      </template>
    </nav>

    <UiSkeletonStack v-if="pending && !data" :count="4" height="140px" />
    <UiEmptyState v-else-if="error || !data?.topic" title="404" />

    <template v-else>
      <header class="intro">
        <div class="intro-main">
          <div v-if="forumTags(data.topic.tags).length" class="tags">
            <span
              v-for="tag in forumTags(data.topic.tags)"
              :key="tag"
              class="chip"
              :class="{ resolved: tag.toLowerCase() === 'resolved' }"
            >{{ tag }}</span>
          </div>
          <h1 class="page-title">{{ data.topic.title }}</h1>
          <p class="meta">
            {{ locale === "en" ? "Opened by" : "Открыто" }}
            {{ data.topic.authorName }}
            · {{ forumAgo(data.topic.createdAt, locale) }}
            · {{ forumReplyLabel(data.topic.postsCount, locale) }}
            · {{ forumFmt(data.topic.viewsCount, locale) }} {{ locale === "en" ? "views" : "просмотров" }}
            <span v-if="data.topic.isLocked"> · 🔒</span>
          </p>
        </div>
      </header>

      <div class="layout">
        <div class="main">
          <article
            v-for="(p, i) in data.posts"
            :key="p.id"
            class="post"
            :class="{
              op: i === 0,
              mod: p.authorBadge === 'Модератор',
              rep: p.authorBadge === 'Представитель казино',
            }"
          >
            <aside class="author">
              <div class="avatar">{{ forumInitials(p.authorName) }}</div>
              <div>
                <strong>{{ p.authorName }}</strong>
                <span v-if="p.authorBadge" class="badge">{{ p.authorBadge }}</span>
              </div>
            </aside>
            <div class="body">
              <div class="post-top">
                <time>{{ new Date(p.createdAt).toLocaleString(locale === "en" ? "en-GB" : "ru-RU") }}</time>
                <span v-if="i === 0" class="op-chip">
                  {{ locale === "en" ? "Original post" : "Стартовое сообщение" }}
                </span>
              </div>
              <blockquote v-if="p.quoteText" class="quote">
                <cite>{{ p.quoteAuthor }} {{ locale === "en" ? "wrote:" : "писал:" }}</cite>
                <p>{{ p.quoteText }}</p>
              </blockquote>
              <p v-for="(para, pi) in forumParagraphs(p.bodyMd)" :key="pi">{{ para }}</p>
              <div class="post-actions">
                <button type="button" class="act" @click="setQuote(p)">
                  {{ locale === "en" ? "Quote" : "Цитировать" }}
                </button>
                <span class="helpful">👍 {{ locale === "en" ? "Helpful" : "Полезно" }} ({{ p.helpful }})</span>
              </div>
            </div>
          </article>

          <section id="reply-box" class="reply panel">
            <h2>{{ locale === "en" ? "Reply" : "Ответить" }}</h2>
            <p v-if="data.topic.isLocked" class="locked">
              {{ locale === "en" ? "This topic is locked." : "Тема закрыта для новых ответов." }}
            </p>
            <template v-else-if="user">
              <div v-if="quote" class="quote-preview">
                <span>{{ quote.author }}</span>
                <p>{{ quote.text }}</p>
                <button type="button" @click="quote = null">×</button>
              </div>
              <textarea
                v-model="reply"
                rows="5"
                :placeholder="locale === 'en' ? 'Write your reply…' : 'Напишите ответ…'"
                :disabled="sending"
              />
              <div class="row">
                <UiButton size="sm" :loading="sending" :disabled="sending || !reply.trim()" @click="submitReply">
                  {{ locale === "en" ? "Send reply" : "Отправить ответ" }}
                </UiButton>
                <span v-if="sendErr" class="err">{{ sendErr }}</span>
              </div>
            </template>
            <div v-else class="guest-reply">
              <p>
                {{ locale === "en"
                  ? "Sign in to reply to this topic."
                  : "Войдите, чтобы ответить в этой теме." }}
              </p>
              <div class="row">
                <NuxtLink class="btn btn-primary btn-sm" :to="loginRedirect">
                  {{ locale === "en" ? "Log in" : "Войти" }}
                </NuxtLink>
                <NuxtLink class="btn btn-secondary btn-sm" :to="registerRedirect">
                  {{ locale === "en" ? "Sign up" : "Регистрация" }}
                </NuxtLink>
              </div>
            </div>
          </section>
        </div>

        <aside class="side">
          <div class="panel">
            <h3>{{ locale === "en" ? "Related topics" : "Похожие темы" }}</h3>
            <NuxtLink
              v-for="topic in data.related"
              :key="topic.slug"
              class="rel"
              :to="localePath(`/forum/tema/${topic.slug}`)"
            >
              <span>{{ topic.title }}</span>
              <small>
                {{ forumReplyLabel(topic.posts_count, locale) }}
                · {{ forumAgo(topic.last_post_at, locale) }}
              </small>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { max-width: 1180px; }
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.crumbs a { color: var(--text-secondary); font-weight: 700; text-decoration: none; }
.crumb-title {
  max-width: 42ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.intro { margin-bottom: 20px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chip {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  background: var(--bg-elev-3);
  color: var(--text-secondary);
}
.chip.resolved { background: var(--accent-cta-soft); color: var(--accent-cta); }
.page-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 34px);
  letter-spacing: -0.03em;
  line-height: 1.2;
}
.meta { margin: 0; font-size: 13px; color: var(--text-tertiary); }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}
.main { display: grid; gap: 12px; }
.post {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.post.op { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-cta) 22%, transparent); }
.post.mod { border-color: color-mix(in srgb, var(--accent-violet) 40%, var(--border-default)); }
.post.rep { border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default)); }
.author {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  padding-right: 12px;
  border-right: 1px solid var(--border-subtle);
}
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-cta) 35%, transparent), color-mix(in srgb, var(--accent-violet) 35%, transparent));
}
.author strong { font-size: 13px; }
.badge {
  display: inline-flex;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.body { min-width: 0; }
.post-top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.op-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
  font-weight: 800;
  font-size: 10px;
}
.body > p {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
}
.quote, .quote-preview {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-left: 3px solid var(--accent-cta);
  border-radius: 0 10px 10px 0;
  background: var(--bg-elev-2);
}
.quote cite, .quote-preview span {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  color: var(--text-tertiary);
}
.quote p, .quote-preview p { margin: 0; font-size: 13px; color: var(--text-secondary); }
.quote-preview { position: relative; }
.quote-preview button {
  position: absolute;
  top: 6px;
  right: 8px;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 18px;
}
.post-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}
.act, .helpful {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.act { cursor: pointer; }
.helpful {
  margin-left: auto;
  border-color: color-mix(in srgb, var(--accent-cta) 30%, var(--border-default));
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
}
.panel {
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.guest-reply p {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
}
.reply h2, .side h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 16px;
}
.side h3 { font-size: 14px; }
.reply textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-primary);
  padding: 12px;
  font: inherit;
  resize: vertical;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}
.err { color: var(--danger); font-size: 13px; font-weight: 650; }
.locked { color: var(--text-secondary); font-size: 14px; }
.rel {
  display: grid;
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid var(--border-subtle);
  text-decoration: none;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.35;
}
.rel:first-of-type { border-top: 0; padding-top: 0; }
.rel:hover { color: var(--accent-cta); }
.rel small { color: var(--text-tertiary); font-size: 11px; }
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
  .post { grid-template-columns: 1fr; }
  .author {
    flex-direction: row;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--border-subtle);
    padding-right: 0;
    padding-bottom: 10px;
  }
}
</style>
