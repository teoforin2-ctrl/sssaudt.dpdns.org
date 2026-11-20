<script setup lang="ts">
import { flattenNavLinks, locTitle, siteNav } from "~/data/site-nav";

const { locale, t } = useI18n();
const localePath = useLocalePath();
const all = flattenNavLinks();

useHead(() => ({ title: `${t("nav.sitemap")}` }));
</script>

<template>
  <article class="map">
    <h1 class="page-title">{{ t("nav.sitemap") }}</h1>
    <p class="lead">{{ t("stub.sitemapLead") }}</p>

    <section v-for="section in siteNav" :key="section.id" class="block">
      <h2>
        <NuxtLink :to="localePath(section.path)">
          {{ locTitle(section.title, locale) }}
        </NuxtLink>
      </h2>
      <ul>
        <li v-for="col in section.columns ?? []" :key="col.title.ru">
          <strong>{{ locTitle(col.title, locale) }}</strong>
          <ul class="sub">
            <li v-for="item in col.items" :key="item.path">
              <NuxtLink :to="localePath(item.path)">
                {{ locTitle(item.title, locale) }}
              </NuxtLink>
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <p class="count">{{ t("stub.sitemapCount", { n: all.length }) }}</p>
  </article>
</template>

<style scoped>
.map {
  max-width: 960px;
}
.lead {
  margin: 0 0 28px;
  color: var(--text-secondary);
}
.block {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-subtle);
}
h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
h2 a {
  color: var(--text-primary);
  text-decoration: none;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
.sub {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px 12px;
  margin-top: 6px;
}
.sub a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}
.sub a:hover {
  color: var(--accent-cta);
}
strong {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.count {
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
