<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

defineProps<{
  articles: {
    slug: string;
    title: string;
    excerpt?: string | null;
    kind?: string;
    coverTheme?: string;
    coverUrl?: string | null;
    readingMinutes?: number;
    publishedAt?: string;
  }[];
}>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="sec">
    <SectionHeader :title="t('home.articles.title')" to="/articles" :link-label="t('home.articles.all')" />
    <div class="row">
      <article v-for="a in articles" :key="a.slug" class="card">
        <ArticleCover
          :title="a.title"
          :theme="a.coverTheme"
          :kind="a.kind"
          :slug="a.slug"
          :src="a.coverUrl"
        />
        <p class="meta">
          <span v-if="a.publishedAt">
            {{ new Date(a.publishedAt).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU") }}
          </span>
          · {{ t("home.articles.min", { n: a.readingMinutes || 5 }) }}
        </p>
        <h3>
          <NuxtLink class="name-link" :to="localePath(`/articles/${a.slug}`)">{{ a.title }}</NuxtLink>
        </h3>
        <p class="ex">{{ a.excerpt }}</p>
        <NuxtLink class="read" :to="localePath(`/articles/${a.slug}`)">
          {{ t("home.articles.read") }}
          <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
        </NuxtLink>
      </article>
    </div>
  </section>
</template>

<style scoped>
.sec {
  margin-top: 56px;
}
.row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.card {
  display: grid;
  gap: 8px;
  align-content: start;
}
.meta {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.ex {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
a,
.read {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
@media (max-width: 1100px) {
  .row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .row {
    grid-auto-flow: column;
    grid-auto-columns: minmax(78%, 280px);
    grid-template-columns: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: 4px;
    mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent);
  }
  .card {
    scroll-snap-align: start;
  }
}
</style>
