<script setup lang="ts">
import { footerNav, locTitle } from "~/data/site-nav";

const { t, locale, locales } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { contacts, siteName } = useSiteSettings();
const year = new Date().getFullYear();

const socials = computed(() => {
  const c = contacts.value;
  return [
    { key: "telegram", label: "Telegram", href: c.telegram },
    { key: "vk", label: "VK", href: c.vk },
    { key: "youtube", label: "YouTube", href: c.youtube },
    { key: "x", label: "X", href: c.x },
    { key: "instagram", label: "Instagram", href: c.instagram },
    { key: "facebook", label: "Facebook", href: c.facebook },
    { key: "discord", label: "Discord", href: c.discord },
  ].filter((s) => !!s.href?.trim());
});
</script>

<template>
  <footer class="foot">
    <div class="container grid">
      <div class="about-col">
        <div class="brand">
          <BrandMark size="lg" />
        </div>
        <p class="about">{{ t("footer.about") }}</p>
        <div v-if="socials.length" class="socials">
          <a
            v-for="s in socials"
            :key="s.key"
            class="social"
            :href="s.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ s.label }}
          </a>
        </div>
        <p v-if="contacts.email" class="mail">
          <a :href="`mailto:${contacts.email}`">{{ contacts.email }}</a>
        </p>
        <div class="help">
          <strong>{{ t("footer.helpTitle") }}</strong>
          <p>{{ t("footer.helpBody") }}</p>
        </div>
      </div>

      <div v-for="col in footerNav" :key="col.title.ru">
        <h3>{{ locTitle(col.title, locale) }}</h3>
        <NuxtLink v-for="item in col.items" :key="item.path" :to="localePath(item.path)">
          {{ locTitle(item.title, locale) }}
        </NuxtLink>
      </div>

      <div>
        <h3>{{ t("footer.legal") }}</h3>
        <NuxtLink :to="localePath('/legal/18-plus')">18+</NuxtLink>
        <NuxtLink :to="localePath('/legal/responsible-gambling')">{{ t("legal.responsible") }}</NuxtLink>
        <NuxtLink :to="localePath('/legal/privacy')">{{ t("legal.privacy") }}</NuxtLink>
        <NuxtLink :to="localePath('/legal/cookies')">{{ t("legal.cookies") }}</NuxtLink>
        <NuxtLink :to="localePath('/legal/affiliate-disclosure')">{{ t("legal.affiliate") }}</NuxtLink>
        <NuxtLink :to="localePath('/sitemap')">{{ t("nav.sitemap") }}</NuxtLink>

        <h3 class="lang-title">{{ t("footer.language") }}</h3>
        <div class="langs">
          <NuxtLink
            v-for="l in locales"
            :key="l.code"
            :to="switchLocalePath(l.code)"
            class="lang"
          >
            {{ t(`lang.${l.code}`) }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="container bottom">
      <span>© {{ year }} {{ siteName }}</span>
      <span class="age">18+</span>
      <p>{{ t("footer.disclaimer") }}</p>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  position: relative;
  isolation: isolate;
  margin-top: auto;
  border-top: none;
  padding: 40px 0 28px;
  overflow: hidden;
  background-color: #07090f;
  background-image: url("/img/footer_bg.webp");
  background-repeat: no-repeat;
  background-position: center bottom;
  background-size: cover;
}
.foot::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-canvas) 72%, transparent) 0%,
    color-mix(in srgb, var(--bg-canvas) 45%, transparent) 45%,
    color-mix(in srgb, #05070c 35%, transparent) 100%
  );
}
[data-theme="light"] .foot {
  background-color: #eef1f6;
  background-image: url("/img/footer_bg.webp");
  background-repeat: no-repeat;
  background-position: center bottom;
  background-size: cover;
}
[data-theme="light"] .foot::before {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.88) 0%,
    rgba(255, 255, 255, 0.72) 50%,
    rgba(248, 250, 252, 0.55) 100%
  );
}
.grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr 1fr 1.05fr;
  gap: 28px 24px;
}
.brand {
  display: inline-flex;
  align-items: center;
  margin-bottom: 12px;
  line-height: 0;
}
.about {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
  max-width: 40ch;
  line-height: 1.55;
}
h3 {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.lang-title {
  margin-top: 18px;
}
.grid a {
  display: block;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  min-height: 30px;
  padding-top: 3px;
}
.grid a:hover {
  color: var(--text-primary);
}
.langs {
  display: flex;
  gap: 8px;
}
.lang {
  min-height: 36px !important;
  padding: 8px 12px !important;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
}
.socials {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 4px;
}
.socials .social {
  display: inline-flex;
  align-items: center;
  min-height: 30px !important;
  padding: 4px 10px !important;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.socials .social:hover {
  color: var(--accent-cta);
}
.mail {
  margin: 8px 0 0;
  font-size: 13px;
}
.mail a {
  color: var(--accent-cta);
  text-decoration: none;
  font-weight: 700;
  min-height: auto;
  padding-top: 0;
  display: inline;
}
.help {
  margin-top: 16px;
}
.help strong {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}
.help p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.45;
}
.bottom {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 12px;
}
.bottom p {
  margin: 0;
  flex: 1 1 280px;
}
.age {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  font-weight: 800;
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .about-col {
    grid-column: 1 / -1;
  }
}
@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
