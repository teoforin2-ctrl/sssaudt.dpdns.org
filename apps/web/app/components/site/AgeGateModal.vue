<script setup lang="ts">
import type { AgeGateLocale } from "~/composables/useAgeGate";

const { t, locale, locales } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { accepted, read, accept, readLang, saveLang, clearBootOverlay, removeBootDom, clearPendingClass } = useAgeGate();

const ready = ref(false);
const panel = ref<HTMLElement | null>(null);
const switching = ref(false);

const open = computed(() => ready.value && accepted.value === false);

onMounted(async () => {
  read();
  if (accepted.value !== true)
    accepted.value = false;

  const saved = readLang();
  if (saved && saved !== locale.value) {
    switching.value = true;
    try {
      await navigateTo(switchLocalePath(saved));
    }
    finally {
      switching.value = false;
    }
  }

  ready.value = true;

  await nextTick();
  if (accepted.value === true) {
    clearBootOverlay();
    return;
  }

  // Hand off: Vue dialog is painted → drop static boot without unblurring
  document.documentElement.classList.add("age-gate-open");
  document.body.style.overflow = "hidden";
  removeBootDom();
  clearPendingClass();
  panel.value?.focus();
});

watch(open, (v) => {
  if (!import.meta.client)
    return;
  document.body.style.overflow = v ? "hidden" : "";
  document.documentElement.classList.toggle("age-gate-open", v);
  if (v)
    nextTick(() => panel.value?.focus());
});

onBeforeUnmount(() => {
  if (!import.meta.client)
    return;
  document.body.style.overflow = "";
  document.documentElement.classList.remove("age-gate-open");
  clearBootOverlay();
});

async function pickLang(code: string) {
  if (code !== "ru" && code !== "en")
    return;
  const next = code as AgeGateLocale;
  saveLang(next);

  // Keep Nuxt i18n cookie in sync with header language switcher
  try {
    const i18n = useNuxtApp().$i18n as { setLocaleCookie?: (c: string) => void };
    i18n.setLocaleCookie?.(next);
  }
  catch {
    /* ignore */
  }

  if (next === locale.value)
    return;

  switching.value = true;
  try {
    await navigateTo(switchLocalePath(next));
  }
  finally {
    switching.value = false;
  }
}

function onConfirm() {
  saveLang((locale.value === "en" ? "en" : "ru") as AgeGateLocale);
  try {
    const i18n = useNuxtApp().$i18n as { setLocaleCookie?: (c: string) => void };
    i18n.setLocaleCookie?.(locale.value);
  }
  catch {
    /* ignore */
  }
  accept();
}

function onLeave() {
  if (!import.meta.client)
    return;
  window.location.href = "https://www.google.com";
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape")
    e.preventDefault();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="gate"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`age-gate-title-${locale}`"
      @keydown="onKey"
    >
      <div class="blur" aria-hidden="true" />
      <div ref="panel" class="card" tabindex="-1">
        <div class="top">
          <div class="badge" aria-hidden="true">
            18+
          </div>
          <div class="langs" role="group" :aria-label="t('ageGate.language')">
            <button
              v-for="l in locales"
              :key="l.code"
              type="button"
              class="lang"
              :class="{ on: l.code === locale }"
              :disabled="switching"
              :aria-pressed="l.code === locale"
              @click="pickLang(l.code)"
            >
              {{ t(`lang.${l.code}`) }}
            </button>
          </div>
        </div>

        <h2 :id="`age-gate-title-${locale}`">
          {{ t("ageGate.title") }}
        </h2>
        <p class="lead">
          {{ t("ageGate.lead") }}
        </p>
        <ul class="points">
          <li>{{ t("ageGate.point1") }}</li>
          <li>{{ t("ageGate.point2") }}</li>
          <li>{{ t("ageGate.point3") }}</li>
          <li>{{ t("ageGate.point4") }}</li>
        </ul>
        <p class="note">
          {{ t("ageGate.note") }}
          <NuxtLink :to="localePath('/legal/responsible-gambling')" class="link" @click="onConfirm">
            {{ t("ageGate.responsibleLink") }}
          </NuxtLink>
        </p>
        <div class="actions">
          <UiButton variant="primary" size="lg" type="button" class="confirm" @click="onConfirm">
            {{ t("ageGate.confirm") }}
          </UiButton>
          <UiButton variant="ghost" size="md" type="button" @click="onLeave">
            {{ t("ageGate.leave") }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}
.blur {
  position: absolute;
  inset: 0;
  background: rgba(8, 11, 16, 0.72);
  backdrop-filter: blur(14px) saturate(0.75);
  -webkit-backdrop-filter: blur(14px) saturate(0.75);
}
.card {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  border-radius: 22px;
  border: 1px solid var(--border-default);
  background: linear-gradient(180deg, var(--bg-elev-2), var(--bg-elev-1));
  box-shadow: var(--shadow-2), 0 0 0 1px rgba(61, 255, 138, 0.08);
  padding: 24px 22px 20px;
  outline: none;
  animation: pop 0.22s var(--ease-out);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-inverse);
  background: var(--accent-cta);
  box-shadow: var(--glow-cta);
}
.langs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-3);
}
.lang {
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.lang.on {
  background: var(--bg-elev-1);
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
}
.lang:disabled {
  opacity: 0.6;
  cursor: wait;
}
h2 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: clamp(20px, 3vw, 24px);
  letter-spacing: -0.03em;
  line-height: 1.2;
}
.lead {
  margin: 0 0 14px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
.points {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.points li {
  position: relative;
  padding-left: 18px;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.45;
}
.points li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-amber);
  box-shadow: 0 0 0 3px var(--accent-amber-soft);
}
.note {
  margin: 0 0 18px;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.45;
}
.link {
  color: var(--accent-cta);
  text-underline-offset: 2px;
}
.actions {
  display: grid;
  gap: 8px;
}
.confirm {
  width: 100%;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }
}
</style>

<style>
html.age-gate-open .shell {
  filter: blur(8px);
  pointer-events: none;
  user-select: none;
}
</style>
