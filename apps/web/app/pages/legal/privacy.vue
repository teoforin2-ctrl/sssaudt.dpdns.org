<script setup lang="ts">
const { t } = useI18n();
usePageSeo({
  title: () => t("legal.privacy"),
  description: () => t("legal.privacyBody"),
});
</script>

<template>
  <article class="legal">
    <p class="meta">{{ t("legal.updated") }}</p>
    <h1 class="page-title">{{ t("legal.privacy") }}</h1>
    <p class="lead">{{ t("legal.privacyBody") }}</p>

    <section>
      <h2>{{ t("legal.privacyWhoTitle") }}</h2>
      <p>{{ t("legal.privacyWhoBody") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.privacyDataTitle") }}</h2>
      <ul>
        <li>{{ t("legal.privacyData1") }}</li>
        <li>{{ t("legal.privacyData2") }}</li>
        <li>{{ t("legal.privacyData3") }}</li>
        <li>{{ t("legal.privacyData4") }}</li>
      </ul>
    </section>

    <section>
      <h2>{{ t("legal.privacyGoalsTitle") }}</h2>
      <p>{{ t("legal.privacyGoals") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.privacyLegalTitle") }}</h2>
      <p>{{ t("legal.privacyLegalBody") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.privacyStorageTitle") }}</h2>
      <p>{{ t("legal.privacyStorageBody") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.privacyRightsTitle") }}</h2>
      <p>{{ t("legal.privacyRightsBody") }}</p>
      <p class="note">{{ t("legal.privacyDelete") }}</p>
    </section>

    <section>
      <h2>{{ t("legal.privacyChildrenTitle") }}</h2>
      <p>{{ t("legal.privacyChildrenBody") }}</p>
    </section>

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
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(24px, 7.2vw, 40px);
  letter-spacing: -0.03em;
  max-width: 100%;
  overflow-wrap: break-word;
  hyphens: auto;
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
ul {
  margin: 0;
  padding-left: 1.2rem;
}
li,
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
li + li {
  margin-top: 6px;
}
.note {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
