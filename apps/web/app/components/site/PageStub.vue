<script setup lang="ts">
import { locTitle, type LocText, type NavLink } from "~/data/site-nav";

const props = defineProps<{
  title: LocText | string;
  lead?: LocText | string;
  links?: NavLink[];
}>();

const { locale, t } = useI18n();
const localePath = useLocalePath();

const heading = computed(() =>
  typeof props.title === "string" ? props.title : locTitle(props.title, locale.value),
);

const leadText = computed(() => {
  if (!props.lead) return t("stub.lead");
  return typeof props.lead === "string" ? props.lead : locTitle(props.lead, locale.value);
});

useHead(() => ({ title: `${heading.value}` }));
</script>

<template>
  <article class="stub">
    <p class="eyebrow">{{ t("stub.eyebrow") }}</p>
    <h1 class="page-title">{{ heading }}</h1>
    <p class="lead">{{ leadText }}</p>

    <ul v-if="links?.length" class="links">
      <li v-for="item in links" :key="item.path">
        <NuxtLink :to="localePath(item.path)">
          {{ locTitle(item.title, locale) }}
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.stub {
  max-width: 920px;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 700;
}
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 40px);
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.lead {
  margin: 0 0 24px;
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 60ch;
}
.links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.links a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
}
.links a:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  background: var(--accent-cta-soft);
  text-decoration: none;
}
</style>
