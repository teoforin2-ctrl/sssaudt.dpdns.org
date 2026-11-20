<script setup lang="ts">
const { t } = useI18n();
usePageSeo({
  title: () => t("legal.cookies"),
  description: () => t("legal.cookiesBody"),
});
</script>

<template>
  <article class="legal">
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.cookies") }}</h1>
    <p class="lead">{{ t("legal.cookiesBody") }}</p>

    <section>
      <h2>{{ t("legal.cookiesWhatTitle") }}</h2>
      <p>{{ t("legal.cookiesWhatBody") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.cookiesNecessaryTitle") }}</h2>
      <p>{{ t("legal.cookiesNecessary") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.cookiesOptionalTitle") }}</h2>
      <p>{{ t("legal.cookiesOptional") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.cookiesManageTitle") }}</h2>
      <p>{{ t("legal.cookiesManageBody") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.cookiesThirdTitle") }}</h2>
      <p>{{ t("legal.cookiesThirdBody") }}</p>
    </section>

    <p class="note">{{ t("legal.cookiesContact") }}</p>
    <p class="note">{{ t("legal.draftNote") }}</p>
  </article>
</template>

<style scoped>
.legal {
  max-width: 820px;
  min-width: 0;
}
.meta {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.lead {
  margin: 0 0 22px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.55;
}
section {
  margin: 0 0 18px;
  padding: 0;
  border: 0;
  background: transparent;
}
h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 17px;
}
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.note {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
