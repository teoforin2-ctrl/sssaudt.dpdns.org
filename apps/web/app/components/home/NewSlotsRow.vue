<script setup lang="ts">
type SlotItem = {
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  providerName?: string | null;
  providerSlug?: string | null;
  releaseDate?: string | null;
  demoUrl?: string | null;
};

defineProps<{ slots: SlotItem[] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const demo = ref<SlotItem | null>(null);
</script>

<template>
  <section class="sec">
    <SectionHeader :title="t('home.slots.newTitle')" to="/slots/new" :link-label="t('home.slots.all')" />
    <div class="row">
      <article v-for="s in slots" :key="s.slug" class="card">
        <SlotCover set="slots" :title="s.title" :theme="s.theme" :rtp="s.rtp" :slug="s.slug" />
        <UiBadge tone="new">NEW</UiBadge>
        <h3>
          <NuxtLink class="name-link" :to="localePath(`/slots/${s.slug}`)">{{ s.title }}</NuxtLink>
        </h3>
        <p>
          {{ s.providerName }}
          <template v-if="s.releaseDate">
            ·
            {{
              new Date(s.releaseDate).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU")
            }}
          </template>
        </p>
        <div class="actions">
          <UiButton size="sm" variant="secondary" type="button" @click="demo = s">
            {{ t("home.slots.demo") }}
          </UiButton>
          <NuxtLink :to="localePath(`/slots/${s.slug}`)">{{ t("home.review") }}</NuxtLink>
        </div>
      </article>
    </div>

    <UiModal :open="!!demo" :title="demo?.title || 'Demo'" @close="demo = null">
      <template v-if="demo">
        <iframe v-if="demo.demoUrl" :src="demo.demoUrl" sandbox="" title="demo" class="frame" />
        <p v-else class="muted">{{ t("home.slots.demoSoon") }}</p>
        <NuxtLink class="btn btn-secondary btn-sm" :to="localePath(`/slots/${demo.slug}`)">
          {{ t("home.review") }}
        </NuxtLink>
      </template>
    </UiModal>
  </section>
</template>

<style scoped>
.sec {
  margin-top: 56px;
}
.row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  gap: 8px;
  align-content: start;
}
h3 {
  margin: 0;
  font-size: 14px;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.actions a {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-decoration: none;
}
.frame {
  width: 100%;
  min-height: 240px;
  border: 0;
  border-radius: 12px;
}
.muted {
  color: var(--text-secondary);
  font-size: 14px;
}
@media (max-width: 1100px) {
  .row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .row {
    grid-auto-flow: column;
    grid-auto-columns: 70%;
    grid-template-columns: none;
    overflow-x: auto;
  }
}
</style>
