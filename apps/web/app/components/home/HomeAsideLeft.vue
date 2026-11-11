<script setup lang="ts">
import { catIcon } from "~/data/nav-icons";

defineProps<{
  modelValue: string;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();
const { t } = useI18n();
const localePath = useLocalePath();

const cats = [
  { id: "all", icon: catIcon("casinos", 48), label: "home.filters.all" },
  { id: "top", icon: catIcon("jackpot", 48), label: "home.filters.top" },
  { id: "hot", icon: catIcon("bonus", 48), label: "home.filters.hot" },
  { id: "crypto", icon: catIcon("crypto", 48), label: "home.filters.crypto" },
  { id: "new", icon: catIcon("newyear", 48), label: "home.filters.new" },
];
</script>

<template>
  <aside class="aside">
    <h2>{{ t("home.aside.categories") }}</h2>
    <nav class="cats">
      <button
        v-for="c in cats"
        :key="c.id"
        type="button"
        class="cat"
        :class="{ on: modelValue === c.id }"
        @click="emit('update:modelValue', c.id)"
      >
        <img :src="c.icon" :alt="t(c.label)" width="36" height="36" loading="lazy" />
        <span>{{ t(c.label) }}</span>
      </button>
    </nav>

    <div class="panel tip">
      <h3>{{ t("home.aside.howTitle") }}</h3>
      <p>{{ t("home.aside.howBody") }}</p>
    </div>

    <section class="panel cta">
      <h3>{{ t("card.reviewCtaTitle") }}</h3>
      <p>{{ t("home.aside.reviewHint") }}</p>
      <NuxtLink class="btn btn-secondary btn-sm" :to="localePath('/') + '#listing'">
        {{ t("home.aside.toListing") }}
      </NuxtLink>
    </section>

  </aside>
</template>

<style scoped>
.aside {
  display: grid;
  gap: 14px;
  align-content: start;
}
h2,
h3 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.cats {
  display: grid;
  gap: 6px;
}
.cat {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.cat img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.cat.on {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, transparent);
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.tip,
.cta,
.tip p,
.cta p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}
.cta {
  background: var(--accent-cta-soft);
  border-color: color-mix(in srgb, var(--accent-cta) 25%, transparent);
}
.cta h3 {
  color: var(--accent-cta);
}
.cta .btn {
  margin-top: 10px;
}
</style>
