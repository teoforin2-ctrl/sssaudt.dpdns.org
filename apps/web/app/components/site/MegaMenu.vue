<script setup lang="ts">
import {
  findNavLink,
  locTitle,
  type NavColumn,
  type NavLink,
  type NavSection,
} from "~/data/site-nav";
import {
  catIcon,
  featuredBySection,
  iconForColumn,
  iconForPath,
  iconForSection,
} from "~/data/nav-icons";

const props = defineProps<{
  section: NavSection;
  /** Left offset from header edge; aligns panel with the trigger button. */
  anchorLeft?: number;
}>();

const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLElement | null>(null);
const leftPx = ref(12);
const maxWidthPx = ref<number | null>(null);

const panelStyle = computed(() => {
  const style: Record<string, string> = { left: `${leftPx.value}px` };
  if (maxWidthPx.value != null) style.maxWidth = `${maxWidthPx.value}px`;
  return style;
});

function clampLeft() {
  if (!import.meta.client || !panelRef.value) return;
  const el = panelRef.value;
  const margin = 12;
  const parent = el.offsetParent as HTMLElement | null;
  const parentW = parent?.clientWidth ?? window.innerWidth;
  const avail = Math.max(200, parentW - margin * 2);

  // Measure natural width without the clamp constraint.
  const prevMax = el.style.maxWidth;
  el.style.maxWidth = "none";
  const naturalW = Math.ceil(el.getBoundingClientRect().width) || Math.min(720, avail);
  el.style.maxWidth = prevMax;

  const panelW = Math.min(naturalW, 720, avail);
  const raw = props.anchorLeft != null && props.anchorLeft > 0 ? props.anchorLeft : margin;
  leftPx.value = Math.min(Math.max(margin, raw), Math.max(margin, parentW - margin - panelW));
  maxWidthPx.value = panelW < naturalW || panelW < 720 ? panelW : null;
}

function scheduleClamp() {
  nextTick(() => {
    clampLeft();
    requestAnimationFrame(clampLeft);
  });
}

watch(
  () => [props.anchorLeft, props.section.id] as const,
  () => scheduleClamp(),
  { immediate: true },
);

onMounted(() => {
  scheduleClamp();
  window.addEventListener("resize", clampLeft, { passive: true });
});

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener("resize", clampLeft);
});

const { locale, t } = useI18n();
const localePath = useLocalePath();

const activeCol = ref(0);

watch(
  () => props.section.id,
  () => {
    activeCol.value = 0;
  },
);

const columns = computed(() => props.section.columns ?? []);
const showRail = computed(() => columns.value.length > 1);
const current = computed<NavColumn | undefined>(() => columns.value[activeCol.value]);

const featured = computed(() => {
  const paths = featuredBySection[props.section.id] ?? [];
  const items: (NavLink & { icon: string })[] = [];
  for (const path of paths) {
    const hit = findNavLink(path) ?? { path, title: props.section.title };
    items.push({
      ...hit,
      icon: iconForPath(path, iconForSection(props.section.id)),
    });
  }
  return items;
});

const listItems = computed(() => {
  const col = current.value;
  if (!col) return [] as (NavLink & { icon: string })[];
  return col.items.map((item) => ({
    ...item,
    icon: iconForPath(item.path, iconForColumn(col.title.ru)),
  }));
});

function onClose() {
  emit("close");
}
</script>

<template>
  <div
    ref="panelRef"
    class="panel"
    role="menu"
    :aria-label="locTitle(section.title, locale)"
    :style="panelStyle"
  >
    <div class="inner">
      <div v-if="featured.length" class="featured">
        <p class="label">{{ t("nav.popular") }}</p>
        <div class="tiles" :style="{ '--tile-cols': Math.min(featured.length, 4) }">
          <NuxtLink
            v-for="item in featured"
            :key="item.path"
            :to="localePath(item.path)"
            class="tile"
            @click="onClose"
          >
            <span class="tile-icon">
              <img :src="catIcon(item.icon)" :alt="''" width="48" height="48" loading="lazy" />
            </span>
            <span class="tile-name">{{ locTitle(item.title, locale) }}</span>
          </NuxtLink>
        </div>
      </div>

      <div class="body" :class="{ 'no-rail': !showRail }">
        <aside v-if="showRail" class="rail" aria-label="categories">
          <button
            v-for="(col, i) in columns"
            :key="col.title.ru"
            type="button"
            class="rail-btn"
            :class="{ on: i === activeCol }"
            @mouseenter="activeCol = i"
            @focus="activeCol = i"
            @click="activeCol = i"
          >
            <img
              :src="catIcon(iconForColumn(col.title.ru))"
              alt=""
              width="28"
              height="28"
              loading="lazy"
            />
            <span>{{ locTitle(col.title, locale) }}</span>
            <span class="count">{{ col.items.length }}</span>
          </button>
        </aside>

        <div class="list-wrap">
          <div class="list-head">
            <h3>
              <img
                v-if="current"
                :src="catIcon(iconForColumn(current.title.ru))"
                alt=""
                width="22"
                height="22"
              />
              {{ current ? locTitle(current.title, locale) : locTitle(section.title, locale) }}
            </h3>
            <NuxtLink class="all" :to="localePath(section.path)" @click="onClose">
              {{ t("nav.seeAll") }}
            </NuxtLink>
          </div>

          <div
            class="list"
            :style="{ '--list-cols': Math.min(Math.max(listItems.length, 1), 3) }"
          >
            <NuxtLink
              v-for="item in listItems"
              :key="item.path"
              :to="localePath(item.path)"
              class="item"
              @click="onClose"
            >
              <img :src="catIcon(item.icon)" alt="" width="32" height="32" loading="lazy" />
              <span>{{ locTitle(item.title, locale) }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: absolute;
  left: 12px;
  right: auto;
  top: 100%;
  width: max-content;
  max-width: min(720px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 0;
  background:
    radial-gradient(520px 220px at 12% 0%, color-mix(in srgb, var(--accent-violet) 12%, transparent), transparent 55%),
    radial-gradient(420px 180px at 88% 0%, color-mix(in srgb, var(--accent-cta) 10%, transparent), transparent 50%),
    var(--bg-elev-1);
  border: 1px solid var(--border-default);
  border-top: none;
  border-radius: 0 0 16px 16px;
  box-shadow: var(--shadow-2);
  z-index: 30;
  animation: rise 0.16s var(--ease-out);
  transform: none;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.inner {
  padding: 14px 16px 16px;
  display: grid;
  gap: 14px;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
}
.label {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 800;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(var(--tile-cols, 4), minmax(104px, 120px));
  gap: 10px;
}
.tile {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elev-2) 88%, transparent);
  text-decoration: none;
  color: var(--text-secondary);
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s var(--ease);
  min-height: 96px;
}
.tile:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  background: var(--accent-cta-soft);
  color: var(--text-primary);
  text-decoration: none;
  transform: translateY(-2px);
}
.tile-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
}
.tile-icon img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
}
.tile-name {
  font-size: 12px;
  font-weight: 750;
  text-align: center;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.body {
  display: grid;
  grid-template-columns: 200px max-content;
  gap: 12px;
  align-items: start;
}
.body.no-rail {
  grid-template-columns: max-content;
}
.rail {
  display: grid;
  gap: 4px;
  padding: 6px;
  border-radius: 16px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-subtle);
  max-height: min(52vh, 420px);
  overflow: auto;
}
.rail-btn {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.rail-btn img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.rail-btn .count {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 700;
}
.rail-btn:hover {
  background: var(--bg-elev-3);
  color: var(--text-primary);
}
.rail-btn.on {
  background: var(--accent-cta-soft);
  color: var(--accent-cta);
}
.rail-btn.on .count {
  color: var(--accent-cta);
}

.list-wrap {
  min-width: 0;
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-canvas) 55%, var(--bg-elev-2));
  padding: 12px 14px 14px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.list-head h3 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
}
.list-head img {
  object-fit: contain;
}
.all {
  font-size: 12px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
  white-space: nowrap;
}
.all:hover {
  text-decoration: underline;
}
.list {
  display: grid;
  grid-template-columns: repeat(var(--list-cols, 2), minmax(150px, 190px));
  gap: 4px 10px;
  max-height: min(48vh, 360px);
  overflow: auto;
  padding-right: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 12px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
}
.item img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.28));
}
.item:hover {
  background: var(--bg-elev-2);
  color: var(--text-primary);
  text-decoration: none;
}

@media (max-width: 720px) {
  .panel {
    left: 12px !important;
    right: 12px;
    width: auto;
    max-width: none;
  }
  .tiles {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }
  .body,
  .body.no-rail {
    grid-template-columns: 1fr;
  }
  .list {
    grid-template-columns: 1fr;
  }
  .inner {
    width: auto;
  }
}
</style>
