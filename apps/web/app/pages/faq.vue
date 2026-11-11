<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();

const items = computed(() =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `q${n}`,
    q: t(`pages.faq.q${n}`),
    a: t(`pages.faq.a${n}`),
  })),
);

const openId = ref(items.value[0]?.id || "q1");

onMounted(() => {
  const hash = route.hash?.replace("#", "");
  if (hash && items.value.some((i) => i.id === hash)) openId.value = hash;
});

function toggle(id: string) {
  openId.value = openId.value === id ? "" : id;
}

usePageSeo({
  title: () => t("pages.faq.title"),
  description: () => t("pages.faq.lead"),
});

useJsonLd(() => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.value.map((i) => ({
    "@type": "Question",
    name: i.q,
    acceptedAnswer: { "@type": "Answer", text: i.a },
  })),
}));
</script>

<template>
  <PublicContentPage
    :eyebrow="t('pages.faq.eyebrow')"
    :title="t('pages.faq.title')"
    :lead="t('pages.faq.lead')"
  >
    <div class="list">
      <div
        v-for="item in items"
        :id="item.id"
        :key="item.id"
        class="item"
        :class="{ open: openId === item.id }"
      >
        <button
          type="button"
          class="sum"
          :aria-expanded="openId === item.id"
          @click="toggle(item.id)"
        >
          <span>{{ item.q }}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div v-show="openId === item.id" class="ans">
          <p>{{ item.a }}</p>
        </div>
      </div>
    </div>

    <template #links>
      <PublicLinkRow
        :links="[
          { to: localePath('/contacts'), label: t('pages.faq.contact'), primary: true },
          { to: localePath('/legal/responsible-gambling'), label: t('nav.responsible') },
        ]"
      />
    </template>
  </PublicContentPage>
</template>

<style scoped>
.list {
  display: grid;
  gap: 10px;
}
.item {
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  overflow: hidden;
}
.sum {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
}
.chev {
  color: var(--text-tertiary);
  transition: transform 0.15s;
}
.item.open .chev {
  transform: rotate(180deg);
  color: var(--accent-cta);
}
.ans {
  padding: 0 16px 16px;
}
.ans p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
</style>
