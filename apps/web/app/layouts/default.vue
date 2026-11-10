<script setup lang="ts">
import AppHeader from "~/components/site/AppHeader.vue";
import AppFooter from "~/components/site/AppFooter.vue";
import PromoTicker from "~/components/site/PromoTicker.vue";
import CookieNotice from "~/components/site/CookieNotice.vue";
import AgeGateModal from "~/components/site/AgeGateModal.vue";
import BackToTop from "~/components/site/BackToTop.vue";
import UiToast from "~/components/ui/UiToast.vue";

const { locale, locales, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const config = useRuntimeConfig();


useHead(() => {
  const links = (locales.value as { code: string; language?: string }[]).map((l) => ({
    rel: "alternate" as const,
    hreflang: l.language || l.code,
    href: `${config.public.siteUrl}${switchLocalePath(l.code as "ru" | "en")}`,
  }));
  links.push({
    rel: "alternate",
    hreflang: "x-default",
    href: `${config.public.siteUrl}${switchLocalePath("ru")}`,
  });
  return {
    htmlAttrs: { lang: locale.value },
    link: links,
  };
});
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main">{{ t("a11y.skipToContent") }}</a>
    <NuxtLoadingIndicator color="var(--accent-cta)" :height="2" :throttle="120" />
    <PromoTicker />
    <AppHeader />
    <main id="main" class="main" tabindex="-1">
      <div class="container">
        <slot />
      </div>
    </main>
    <AppFooter />
    <CookieNotice />
    <AgeGateModal />
    <BackToTop />
    <UiToast />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.skip-link {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 1000;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--bg-elev-3);
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
  transform: translateY(-160%);
  transition: transform 0.15s var(--ease);
}
.skip-link:focus {
  transform: translateY(0);
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.main {
  flex: 1;
  padding: 28px 0 48px;
}
.main:focus {
  outline: none;
}
/* Center constrained pages; homepage (.home) stays full-bleed in the container */
.main > .container > :not(.home) {
  margin-inline: auto;
  width: 100%;
}
</style>

