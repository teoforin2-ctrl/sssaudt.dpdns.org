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
        <div class="brand">
          <BrandMark />
        </div>

        <div class="badge" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          18+
        </div>

        <h2 :id="`age-gate-title-${locale}`">
          {{ t("ageGate.title") }}
        </h2>
        <p class="lead">
          {{ t("ageGate.lead") }}
        </p>

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
            {{ String(l.code).toUpperCase() }}
          </button>
        </div>

        <ul class="points">
          <li v-for="n in 4" :key="n">
            <span class="check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span>{{ t(`ageGate.point${n}`) }}</span>
          </li>
        </ul>

        <p class="note">
          {{ t("ageGate.note") }}
          <a
            class="ext"
            href="https://www.begambleaware.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            BeGambleAware
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </a>
        </p>
        <p class="policy">
          <NuxtLink :to="localePath('/legal/responsible-gambling')" class="link" @click="onConfirm">
            {{ t("ageGate.responsibleLink") }}
          </NuxtLink>
        </p>

        <div class="actions">
          <button type="button" class="confirm" @click="onConfirm">
            {{ t("ageGate.confirm") }}
          </button>
          <button type="button" class="leave" @click="onLeave">
            {{ t("ageGate.leave") }}
          </button>
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
  background: rgba(8, 11, 16, 0.78);
  backdrop-filter: blur(16px) saturate(0.7);
  -webkit-backdrop-filter: blur(16px) saturate(0.7);
}
.card {
  position: relative;
  z-index: 1;
  width: min(420px, 100%);
  border-radius: 24px;
  border: 1px solid var(--border-default);
  background:
    radial-gradient(420px 180px at 50% 0%, color-mix(in srgb, var(--accent-cta) 10%, transparent), transparent 60%),
    linear-gradient(180deg, var(--bg-elev-2), var(--bg-elev-1));
  box-shadow: var(--shadow-2), 0 0 0 1px rgba(61, 255, 138, 0.06);
  padding: 28px 24px 22px;
  outline: none;
  text-align: center;
  animation: pop 0.22s var(--ease-out);
}
.brand {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}
.brand :deep(svg),
.brand :deep(img) {
  height: 36px;
  width: auto;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  margin: 0 auto 14px;
  border-radius: 999px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff;
  background: var(--accent-rose);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-rose) 35%, transparent);
}
h2 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(22px, 3.2vw, 28px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  text-wrap: balance;
}
.lead {
  margin: 0 auto 16px;
  max-width: 34ch;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.langs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin: 0 auto 18px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-3);
}
.lang {
  min-width: 52px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lang.on {
  background: var(--accent-cta);
  color: var(--text-inverse);
  box-shadow: var(--glow-cta);
}
.lang:disabled {
  opacity: 0.6;
  cursor: wait;
}
.points {
  margin: 0 0 16px;
  padding: 16px 0 0;
  list-style: none;
  display: grid;
  gap: 10px;
  text-align: left;
  border-top: 1px solid var(--border-subtle);
}
.points li {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px;
  align-items: start;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.45;
}
.check {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 28%, transparent);
}
.note {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.45;
}
.ext {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent-cta);
  font-weight: 700;
  text-decoration: none;
}
.ext:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.policy {
  margin: 0 0 18px;
  font-size: 12px;
}
.link {
  color: var(--text-tertiary);
  text-underline-offset: 2px;
}
.link:hover {
  color: var(--accent-cta);
}
.actions {
  display: grid;
  gap: 12px;
}
.confirm {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 14px;
  background: var(--accent-cta);
  color: var(--text-inverse);
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--glow-cta);
  transition: background 0.15s, transform 0.15s;
}
.confirm:hover {
  background: var(--accent-cta-hover);
}
.confirm:active {
  background: var(--accent-cta-pressed);
  transform: translateY(1px);
}
.leave {
  border: 0;
  background: none;
  padding: 4px;
  color: var(--text-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: none;
}
.leave:hover {
  color: var(--text-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
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
