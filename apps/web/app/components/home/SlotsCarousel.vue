<script setup lang="ts">
type SlotItem = {
  slug: string;
  title: string;
  theme?: string;
  rtp?: number | null;
  mechanics?: string[];
  providerName?: string | null;
  providerSlug?: string | null;
  isNew?: boolean;
  hasBonus?: boolean;
  demoUrl?: string | null;
};

const props = defineProps<{ slots: SlotItem[] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();

const filter = ref("all");
const filters = [
  { id: "all", label: "home.slots.filters.all" },
  { id: "new", label: "home.slots.filters.new" },
  { id: "highRtp", label: "home.slots.filters.highRtp" },
  { id: "bonusBuy", label: "home.slots.filters.bonusBuy" },
  { id: "holdAndWin", label: "home.slots.filters.holdAndWin" },
  { id: "megaways", label: "home.slots.filters.megaways" },
];

const filtered = computed(() => {
  let list = props.slots;
  if (filter.value === "new") list = list.filter((s) => s.isNew);
  else if (filter.value === "highRtp") list = list.filter((s) => (s.rtp || 0) >= 96.5);
  else if (filter.value === "bonusBuy") list = list.filter((s) => s.mechanics?.includes("bonus-buy"));
  else if (filter.value === "holdAndWin") list = list.filter((s) => s.mechanics?.includes("hold-and-win"));
  else if (filter.value === "megaways") list = list.filter((s) => s.mechanics?.includes("megaways"));
  return list.slice(0, 10);
});

const demo = ref<SlotItem | null>(null);
const rail = ref<HTMLElement | null>(null);
const canPrev = ref(false);
const canNext = ref(false);
const progress = ref(0);
let drag: { x: number; left: number; moved: boolean } | null = null;

function rtpLabel(rtp?: number | null) {
  if (rtp == null) return null;
  return `RTP ${rtp}%`;
}

function syncRail() {
  const el = rail.value;
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  canPrev.value = el.scrollLeft > 4;
  canNext.value = el.scrollLeft < max - 4;
  progress.value = max <= 0 ? 1 : Math.min(1, el.scrollLeft / max);
}

function scrollByDir(dir: -1 | 1) {
  const el = rail.value;
  if (!el) return;
  el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.7), behavior: "smooth" });
}

function onPointerDown(e: PointerEvent) {
  const el = rail.value;
  if (!el || e.pointerType === "touch") return;
  drag = { x: e.clientX, left: el.scrollLeft, moved: false };
  el.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!drag || !rail.value) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 3) drag.moved = true;
  rail.value.scrollLeft = drag.left - dx;
}

function onPointerUp(e: PointerEvent) {
  if (!drag || !rail.value) return;
  rail.value.releasePointerCapture(e.pointerId);
  drag = null;
}

onMounted(() => {
  syncRail();
  rail.value?.addEventListener("scroll", syncRail, { passive: true });
  window.addEventListener("resize", syncRail, { passive: true });
});
onBeforeUnmount(() => {
  rail.value?.removeEventListener("scroll", syncRail);
  window.removeEventListener("resize", syncRail);
});
watch(filtered, () => nextTick(syncRail));
</script>

<template>
  <section class="sec">
    <SectionHeader :title="t('home.slots.title')" to="/slots" :link-label="t('home.slots.all')">
      <template #actions>
        <div class="chips">
          <UiChip
            v-for="f in filters"
            :key="f.id"
            :active="filter === f.id"
            data-track="slots_tab"
            @click="filter = f.id"
          >
            {{ t(f.label) }}
          </UiChip>
        </div>
      </template>
    </SectionHeader>

    <div class="rail-wrap">
      <button
        type="button"
        class="nav prev"
        :disabled="!canPrev"
        :aria-label="t('home.slots.prev')"
        @click="scrollByDir(-1)"
      >
        ‹
      </button>
      <button
        type="button"
        class="nav next"
        :disabled="!canNext"
        :aria-label="t('home.slots.next')"
        @click="scrollByDir(1)"
      >
        ›
      </button>
    <div
      ref="rail"
      class="rail"
      aria-roledescription="carousel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <article v-for="s in filtered" :key="s.slug" class="card" data-reveal-child>
        <NuxtLink class="cover-link" :to="localePath(`/slots/${s.slug}`)">
          <div class="cover-wrap">
            <SlotCover set="slots" :title="s.title" :theme="s.theme" :rtp="s.rtp" :slug="s.slug" />
            <div class="badges">
              <UiBadge v-if="s.isNew" tone="new">
                {{ locale.startsWith("en") ? "New" : "Новинка" }}
              </UiBadge>
              <UiBadge v-else tone="top">{{ t("home.slots.hasReview") }}</UiBadge>
            </div>
            <span class="more-chip">{{ t("home.slots.more") }}</span>
          </div>
        </NuxtLink>
        <h3>
          <NuxtLink class="name-link" :to="localePath(`/slots/${s.slug}`)">{{ s.title }}</NuxtLink>
        </h3>
        <p class="meta">
          <span v-if="s.providerName">{{ s.providerName }}</span>
          <span v-if="s.providerName && rtpLabel(s.rtp)"> · </span>
          <span v-if="rtpLabel(s.rtp)">{{ rtpLabel(s.rtp) }}</span>
        </p>
        <div class="actions">
          <UiButton size="sm" variant="secondary" type="button" @click="demo = s">
            {{ t("home.slots.demo") }}
          </UiButton>
          <NuxtLink :to="localePath(`/slots/${s.slug}`)">{{ t("home.slots.more") }}</NuxtLink>
        </div>
      </article>
    </div>
    <div class="progress" aria-hidden="true">
      <span :style="{ transform: `scaleX(${Math.max(0.12, progress)})` }" />
    </div>
    </div>

    <UiModal :open="!!demo" :title="demo?.title || 'Demo'" @close="demo = null">
      <template v-if="demo">
        <p v-if="demo.demoUrl">
          <iframe :src="demo.demoUrl" sandbox="" title="demo" class="frame" />
        </p>
        <p v-else class="muted">{{ t("home.slots.demoSoon") }}</p>
        <NuxtLink class="btn btn-secondary btn-sm" :to="localePath(`/slots/${demo.slug}`)">
          {{ t("home.slots.more") }}
        </NuxtLink>
      </template>
    </UiModal>
  </section>
</template>

<style scoped>
.sec {
  margin-top: 56px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
@media (max-width: 820px) {
  .chips {
    display: none;
  }
}
.rail-wrap {
  position: relative;
}
.nav {
  position: absolute;
  top: 42%;
  z-index: 2;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elev-1) 92%, transparent);
  color: var(--text-primary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-1);
}
.nav:disabled {
  opacity: 0.35;
  cursor: default;
}
.nav.prev {
  left: -6px;
}
.nav.next {
  right: -6px;
}
.rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 1fr);
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 6px;
  cursor: grab;
  mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent);
}
.rail:active {
  cursor: grabbing;
}
.progress {
  margin-top: 10px;
  height: 3px;
  border-radius: 999px;
  background: var(--bg-elev-3);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: var(--accent-cta);
  transition: transform var(--dur-fast, 0.16s) var(--ease-out);
}
.card {
  scroll-snap-align: start;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 10px;
  min-width: 200px;
  min-height: 100%;
  height: 100%;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
  transition: border-color 0.15s ease, transform 0.15s ease;
  align-content: start;
}
.card .actions {
  margin-top: auto;
}
.card:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 35%, var(--border-default));
  transform: translateY(-2px);
}
.cover-link {
  text-decoration: none;
  color: inherit;
}
.cover-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}
.badges {
  position: absolute;
  left: 8px;
  top: 8px;
  display: flex;
  gap: 4px;
  z-index: 1;
}
.more-chip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 1;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-elev-1) 82%, transparent);
  border: 1px solid var(--border-default);
  backdrop-filter: blur(8px);
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.3;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.meta {
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
.actions a:hover {
  color: var(--accent-cta);
}
.frame {
  width: 100%;
  min-height: 280px;
  border: 0;
  border-radius: 12px;
}
.muted {
  color: var(--text-secondary);
  font-size: 14px;
}
@media (max-width: 768px) {
  .rail {
    grid-auto-columns: minmax(72%, 240px);
  }
}
@media (min-width: 1200px) {
  .nav {
    display: none;
  }
  .rail {
    grid-auto-flow: dense;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    overflow: visible;
    cursor: default;
    mask-image: none;
    -webkit-mask-image: none;
  }
  .progress {
    display: none;
  }
}
@media (max-width: 820px) {
  .nav {
    display: none;
  }
}
</style>
