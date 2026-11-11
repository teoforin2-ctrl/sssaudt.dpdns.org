<script setup lang="ts">
import { locTitle, siteNav, type NavSection } from "~/data/site-nav";
import { catIcon, iconForColumn, iconForPath, iconForSection } from "~/data/nav-icons";

const { locale, locales, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const localePath = useLocalePath();
const route = useRoute();
const { theme, toggle, init } = useTheme();
const { user, fetchMe, logout, goDestination } = useAuth();
const { siteName } = useSiteSettings();

const drawer = ref(false);
const searchOpen = ref(false);
const scrolled = ref(false);
const openId = ref<string | null>(null);
const megaLeft = ref(0);
const drawerTop = ref(64);
const headerEl = ref<HTMLElement | null>(null);
const drawerOpen = ref<Record<string, boolean>>({});
const drawerCol = ref<Record<string, number>>({});
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let headerPlaceholder: HTMLDivElement | null = null;

/** Overflow-only lock — never position:fixed the body (breaks sticky + teleported drawer). */
function lockBodyScroll(lock: boolean) {
  if (!import.meta.client) return;
  const body = document.body;
  const html = document.documentElement;
  if (lock) {
    html.classList.add("drawer-scroll-lock");
    body.classList.add("drawer-scroll-lock");
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return;
  }
  html.classList.remove("drawer-scroll-lock");
  body.classList.remove("drawer-scroll-lock");
  html.style.overflow = "";
  body.style.overflow = "";
}

/**
 * overflow:hidden on html/body disables position:sticky. Pin the header to the
 * viewport while the drawer is open so the burger/menu stay usable after scroll.
 */
function pinHeaderForDrawer(pin: boolean) {
  if (!import.meta.client || !headerEl.value) return;
  const header = headerEl.value;
  if (pin) {
    const rect = header.getBoundingClientRect();
    if (!headerPlaceholder) {
      headerPlaceholder = document.createElement("div");
      headerPlaceholder.setAttribute("aria-hidden", "true");
      headerPlaceholder.style.height = `${Math.round(rect.height)}px`;
      headerPlaceholder.style.flexShrink = "0";
      header.before(headerPlaceholder);
    }
    header.style.position = "fixed";
    header.style.top = `${Math.max(0, Math.round(rect.top))}px`;
    header.style.left = "0";
    header.style.right = "0";
    header.style.width = "100%";
    header.style.zIndex = "50";
    return;
  }
  header.style.position = "";
  header.style.top = "";
  header.style.left = "";
  header.style.right = "";
  header.style.width = "";
  header.style.zIndex = "";
  headerPlaceholder?.remove();
  headerPlaceholder = null;
}

function syncMegaLeft() {
  if (!import.meta.client || !openId.value || !headerEl.value) return;
  const btn = headerEl.value.querySelector<HTMLElement>(`[data-nav-id="${openId.value}"]`);
  if (!btn) return;
  const headerRect = headerEl.value.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const margin = 12;
  const raw = btnRect.left - headerRect.left;
  const panel = headerEl.value.querySelector<HTMLElement>(".panel");
  const panelW = panel?.offsetWidth || Math.min(720, headerRect.width - margin * 2);
  const maxLeft = Math.max(margin, headerRect.width - margin - panelW);
  megaLeft.value = Math.min(Math.max(margin, raw), maxLeft);
}

onMounted(() => {
  // theme applied in plugins/theme.client.ts before mount
  void init();
  void fetchMe();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncMegaLeft, { passive: true });
});

async function onLogout() {
  await logout();
  drawer.value = false;
  await navigateTo(localePath("/"));
}

async function onCabinet() {
  drawer.value = false;
  if (!user.value) {
    await navigateTo(localePath("/login"));
    return;
  }
  await goDestination(
    user.value.isStaff ? "admin" : user.value.role === "partner_rep" ? "partner" : "account",
  );
}

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", syncMegaLeft);
    if (drawer.value) {
      lockBodyScroll(false);
      pinHeaderForDrawer(false);
    }
  }
  if (closeTimer) clearTimeout(closeTimer);
});

function onScroll() {
  scrolled.value = window.scrollY > 4;
  if (openId.value) syncMegaLeft();
}

watch(
  () => route.fullPath,
  () => {
    drawer.value = false;
    searchOpen.value = false;
    openId.value = null;
  },
);

function syncDrawerTop() {
  if (!import.meta.client || !headerEl.value) return;
  drawerTop.value = Math.round(headerEl.value.getBoundingClientRect().bottom);
}

watch(drawer, async (open) => {
  if (!import.meta.client) return;
  if (open) {
    openId.value = null;
    searchOpen.value = false;
    // Pin sticky header BEFORE overflow lock (lock kills sticky).
    pinHeaderForDrawer(true);
    syncDrawerTop();
    lockBodyScroll(true);
    await nextTick();
    syncDrawerTop();
    requestAnimationFrame(() => syncDrawerTop());
    return;
  }
  lockBodyScroll(false);
  pinHeaderForDrawer(false);
});

function sectionLabel(section: NavSection) {
  return locTitle(section.title, locale.value);
}

function openMenu(id: string) {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  openId.value = id;
  nextTick(() => {
    syncMegaLeft();
    requestAnimationFrame(syncMegaLeft);
  });
}

function scheduleClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    openId.value = null;
  }, 140);
}

function closeMenu() {
  if (closeTimer) clearTimeout(closeTimer);
  openId.value = null;
}

function toggleDrawerSection(id: string) {
  drawerOpen.value[id] = !drawerOpen.value[id];
}

function isActive(path: string) {
  const p = route.path.replace(/\/$/, "") || "/";
  if (path === "/") return p === "/" || p === "";
  return p === path || p.startsWith(`${path}/`);
}

const openSection = computed(() => siteNav.find((s) => s.id === openId.value && s.columns) ?? null);
</script>

<template>
  <header
    ref="headerEl"
    class="top"
    :class="{ scrolled, 'drawer-open': drawer }"
    @mouseleave="scheduleClose"
  >
    <div class="top-inner container">
      <NuxtLink :to="localePath('/')" class="brand" :aria-label="siteName">
        <BrandMark />
      </NuxtLink>

      <nav class="nav-inline desktop" :aria-label="t('nav.main')">
        <div
          v-for="section in siteNav"
          :key="section.id"
          class="nav-item"
          :data-nav-id="section.id"
          @mouseenter="section.columns ? openMenu(section.id) : closeMenu()"
        >
          <NuxtLink
            :to="localePath(section.path)"
            class="nav-link"
            :class="{ on: isActive(section.path), open: openId === section.id }"
            @click="section.columns ? undefined : closeMenu()"
          >
            <img
              class="nav-ico"
              :src="catIcon(iconForSection(section.id), 24)"
              alt=""
              width="22"
              height="22"
            />
            <span>{{ sectionLabel(section) }}</span>
            <svg
              v-if="section.columns"
              class="chev"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
            >
              <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </NuxtLink>
        </div>
      </nav>

      <div class="top-right">
        <div class="search-wrap">
          <button
            type="button"
            class="icon-btn"
            :aria-label="t('nav.search')"
            :aria-expanded="searchOpen"
            @click="searchOpen = !searchOpen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <div v-if="searchOpen" class="search-panel">
            <QuickSearch compact autofocus @close="searchOpen = false" />
          </div>
        </div>

        <span class="langs" role="group" :aria-label="t('nav.language')">
          <NuxtLink
            v-for="l in locales"
            :key="l.code"
            :to="switchLocalePath(l.code)"
            class="lang"
            :class="{ on: l.code === locale }"
          >
            {{ t(`lang.${l.code}`) }}
          </NuxtLink>
        </span>

        <button type="button" class="icon-btn" :aria-label="t('nav.theme')" @click="toggle()">
          {{ theme === "dark" ? "☀" : "☾" }}
        </button>

        <div class="auth-actions desktop-auth">
          <template v-if="user">
            <button
              type="button"
              class="icon-btn logout-btn"
              :aria-label="t('nav.logout')"
              :title="t('nav.logout')"
              @click="onLogout"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M15 12H3m0 0 3-3m-3 3 3 3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button type="button" class="auth-link" @click="onCabinet">
              {{ user.displayName || t("nav.account") }}
            </button>
          </template>
          <template v-else>
            <NuxtLink :to="localePath('/login')" class="auth-link">
              {{ t("nav.login") }}
            </NuxtLink>
            <NuxtLink :to="localePath('/register')" class="auth-cta">
              {{ t("nav.register") }}
            </NuxtLink>
          </template>
        </div>

        <button
          type="button"
          class="icon-btn burger"
          :class="{ open: drawer }"
          :aria-label="drawer ? t('nav.close') : t('nav.menu')"
          :aria-expanded="drawer"
          @click="drawer = !drawer"
        >
          <svg
            v-if="!drawer"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="openSection" class="mega-slot" @mouseenter="openMenu(openSection.id)">
      <MegaMenu :section="openSection" :anchor-left="megaLeft" @close="closeMenu" />
    </div>

    <Teleport to="body">
      <div
        v-if="drawer"
        class="drawer-root"
        :style="{ '--drawer-top': `${drawerTop}px` }"
      >
        <button
          type="button"
          class="drawer-backdrop"
          :aria-label="t('nav.menu')"
          @click="drawer = false"
        />
        <div class="drawer" role="dialog" :aria-label="t('nav.menu')">
          <div class="drawer-scroll">
            <div v-for="section in siteNav" :key="section.id" class="drawer-sec">
              <div class="drawer-head">
                <NuxtLink :to="localePath(section.path)" class="drawer-title" @click="drawer = false">
                  <img :src="catIcon(iconForSection(section.id), 48)" alt="" width="28" height="28" />
                  {{ sectionLabel(section) }}
                </NuxtLink>
                <button
                  v-if="section.columns"
                  type="button"
                  class="drawer-tog"
                  :aria-expanded="!!drawerOpen[section.id]"
                  @click="toggleDrawerSection(section.id)"
                >
                  {{ drawerOpen[section.id] ? "−" : "+" }}
                </button>
              </div>

              <div v-if="section.columns && drawerOpen[section.id]" class="drawer-body">
                <div class="drawer-rail">
                  <button
                    v-for="(col, i) in section.columns"
                    :key="col.title.ru"
                    type="button"
                    class="drawer-rail-btn"
                    :class="{ on: (drawerCol[section.id] ?? 0) === i }"
                    @click="drawerCol[section.id] = i"
                  >
                    <img :src="catIcon(iconForColumn(col.title.ru), 24)" alt="" width="22" height="22" />
                    {{ locTitle(col.title, locale) }}
                  </button>
                </div>
                <div class="drawer-list">
                  <NuxtLink
                    v-for="item in section.columns[drawerCol[section.id] ?? 0]?.items ?? []"
                    :key="item.path"
                    :to="localePath(item.path)"
                    @click="drawer = false"
                  >
                    <img
                      :src="catIcon(iconForPath(item.path, iconForSection(section.id)), 24)"
                      alt=""
                      width="24"
                      height="24"
                    />
                    {{ locTitle(item.title, locale) }}
                  </NuxtLink>
                </div>
              </div>
            </div>

            <div class="drawer-search">
              <QuickSearch compact @close="drawer = false" />
            </div>
            <div class="drawer-auth">
              <template v-if="user">
                <UiButton type="button" @click="onCabinet">
                  {{ t("nav.account") }}
                </UiButton>
                <UiButton variant="secondary" type="button" @click="onLogout">
                  {{ t("nav.logout") }}
                </UiButton>
              </template>
              <template v-else>
                <NuxtLink :to="localePath('/login')" class="drawer-auth-btn" @click="drawer = false">
                  {{ t("nav.login") }}
                </NuxtLink>
                <NuxtLink
                  :to="localePath('/register')"
                  class="drawer-auth-btn primary"
                  @click="drawer = false"
                >
                  {{ t("nav.register") }}
                </NuxtLink>
              </template>
            </div>

            <div class="drawer-tools">
              <span class="langs">
                <NuxtLink
                  v-for="l in locales"
                  :key="l.code"
                  :to="switchLocalePath(l.code)"
                  class="lang"
                  :class="{ on: l.code === locale }"
                >
                  {{ t(`lang.${l.code}`) }}
                </NuxtLink>
              </span>
              <UiButton variant="secondary" size="sm" type="button" @click="toggle()">
                {{ theme === "dark" ? t("nav.themeLight") : t("nav.themeDark") }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid transparent;
  background: color-mix(in srgb, var(--bg-canvas) 88%, transparent);
  backdrop-filter: blur(14px);
  transition: border-color 0.15s, box-shadow 0.15s;
  isolation: isolate;
}
.top.scrolled {
  border-bottom-color: var(--border-subtle);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.top.drawer-open {
  z-index: 50;
}
.top-inner {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding-block: 6px;
}
.brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;
  line-height: 0;
}
.brand:hover {
  text-decoration: none;
  opacity: 0.92;
}
.nav-inline {
  display: flex;
  align-items: stretch;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-inline::-webkit-scrollbar {
  display: none;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 750;
  letter-spacing: 0;
  white-space: nowrap;
  border-radius: 12px;
}
.nav-ico {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
}
.nav-link:hover,
.nav-link.on,
.nav-link.open {
  color: var(--text-primary);
  text-decoration: none;
  background: var(--bg-elev-2);
}
.nav-link.open {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.chev {
  opacity: 0.65;
}
.top-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.langs {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.lang {
  padding: 7px 11px;
  border-radius: 999px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  font-weight: 700;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}
.lang.on {
  background: var(--accent-cta);
  color: var(--text-inverse);
}
.search-wrap {
  position: relative;
}
.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(360px, 80vw);
  padding: 10px;
  border-radius: 14px;
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-2);
  display: grid;
  gap: 8px;
  z-index: 5;
}
.drawer-search {
  margin: 12px 0 8px;
}
.search-panel ul,
.drawer-hits {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}
.search-panel a,
.drawer-hits a {
  display: block;
  padding: 10px;
  border-radius: 10px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
}
.search-panel a:hover,
.drawer-hits a:hover {
  background: var(--bg-elev-2);
}
.empty {
  padding: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}
.burger {
  display: none;
  place-items: center;
}
.burger svg {
  display: block;
}
.drawer-root {
  display: none;
}
.drawer-backdrop {
  display: none;
}
.drawer {
  display: none;
}
.drawer-sec {
  border-bottom: 1px solid var(--border-subtle);
}
.drawer-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.drawer-title {
  flex: 1;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 800;
  font-size: 14px;
}
.drawer-title img {
  object-fit: contain;
}
.drawer-tog {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font-size: 18px;
  cursor: pointer;
}
.drawer-body {
  padding: 0 0 12px;
  display: grid;
  gap: 10px;
}
.drawer-rail {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.drawer-rail-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.drawer-rail-btn.on {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.drawer-rail-btn img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.drawer-list {
  display: grid;
  gap: 2px;
}
.drawer-list a {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  padding: 4px 2px;
}
.drawer-list img {
  object-fit: contain;
}
.drawer-tools {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.auth-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.auth-link {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.auth-link:hover,
.auth-link.muted:hover {
  color: var(--text-primary);
  background: var(--bg-elev-2);
  text-decoration: none;
}
.auth-cta {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--accent-cta);
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}
.auth-cta:hover {
  background: var(--accent-cta-soft);
  text-decoration: none;
}
.drawer-auth {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
  min-width: 0;
  width: 100%;
}
.drawer-auth :deep(.btn) {
  width: 100%;
  min-width: 0;
  justify-content: center;
}
.drawer-auth-btn {
  min-height: 44px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: none;
}
.drawer-auth-btn.primary {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
}

@media (max-width: 1100px) {
  .nav-link span {
    font-size: 11px;
  }
  .nav-link {
    padding: 0 8px;
  }
}
@media (max-width: 900px) {
  .desktop,
  .desktop-auth {
    display: none;
  }
  .burger {
    display: grid;
  }
  .top-right > .langs,
  .top-right > .search-wrap {
    display: none;
  }
  .drawer-root {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 45;
    width: 100%;
    max-width: 100vw;
    overflow: hidden;
    overscroll-behavior: none;
    /* Always viewport-fixed — never inherit a transformed/fixed body containing block */
    transform: translateZ(0);
  }
  .drawer-backdrop {
    display: block;
    position: absolute;
    top: var(--drawer-top, 64px);
    left: 0;
    right: 0;
    bottom: 0;
    border: 0;
    background: color-mix(in srgb, var(--bg-canvas) 28%, rgba(0, 0, 0, 0.5));
    cursor: pointer;
    touch-action: none;
  }
  .drawer {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: var(--drawer-top, 64px);
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    max-height: calc(100dvh - var(--drawer-top, 64px));
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-elev-1);
    box-shadow: var(--shadow-2);
    z-index: 1;
  }
  .drawer-scroll {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px 16px 18px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }
  .drawer-tools {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
