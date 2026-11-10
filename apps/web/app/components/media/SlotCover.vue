<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    theme?: string;
    rtp?: number | null;
    slug?: string;
    src?: string | null;
    /** Cover set: automats (home carousel) | slots (new slots row) */
    set?: "automats" | "slots";
  }>(),
  { set: "slots" },
);

/** Real PNGs shipped under /img/automats|slots — API slugs rarely match filenames. */
const PLACEHOLDER_COVERS = [
  "berry-cascade",
  "cactus-gold",
  "candy-orbit",
  "comet-chest",
  "frost-nets",
  "jelly-storm",
  "koi-lantern",
  "myth-spark",
  "neon-mango",
  "olympus-bolt",
  "reef-hook",
  "ringed-planet",
  "sand-oracle",
  "solar-scarab",
  "tome-of-runes",
  "vault-raid",
] as const;

/** Deterministic hash — hydration-safe fallback art. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const imgSrc = computed(() => {
  if (props.src) return props.src;
  const key = props.slug || props.title;
  if (!key) return null;
  // Prefer explicit cover URL later; until then map slug → existing placeholder (no 404 spam).
  const name = PLACEHOLDER_COVERS[hash(key) % PLACEHOLDER_COVERS.length]!;
  return `/img/${props.set}/${name}.png`;
});

const broken = ref(false);
watch(imgSrc, () => {
  broken.value = false;
});

const seed = computed(() => hash(`${props.slug || ""}|${props.title}|${props.theme || ""}`));
const theme = computed(() => props.theme || "fruits");
const uid = computed(() => `sc-${(seed.value % 1e9).toString(36)}`);
const useImg = computed(() => !!imgSrc.value && !broken.value);

const palettes: Record<string, { a: string; b: string; c: string; glow: string }> = {
  egypt: { a: "#1a0610", b: "#6a1430", c: "#ff4d8d", glow: "rgba(255,77,141,.45)" },
  fruits: { a: "#120818", b: "#5a1240", c: "#ff6bnb", glow: "rgba(255,90,160,.4)" },
  fishing: { a: "#080818", b: "#3a145a", c: "#ff4db8", glow: "rgba(255,77,184,.4)" },
  mythology: { a: "#12061a", b: "#4a0a4a", c: "#d24dff", glow: "rgba(210,77,255,.4)" },
  sweets: { a: "#1a0614", b: "#7a1448", c: "#ff5eb0", glow: "rgba(255,94,176,.45)" },
  "wild-west": { a: "#14080c", b: "#5a1828", c: "#ff6a8a", glow: "rgba(255,106,138,.4)" },
  space: { a: "#080614", b: "#2a0a4a", c: "#c44dff", glow: "rgba(196,77,255,.45)" },
  asian: { a: "#160608", b: "#6a1020", c: "#ff3d6a", glow: "rgba(255,61,106,.45)" },
  books: { a: "#0c0818", b: "#3a1458", c: "#b84dff", glow: "rgba(184,77,255,.4)" },
  treasure: { a: "#140810", b: "#5a1830", c: "#ff5a9a", glow: "rgba(255,90,154,.5)" },
};

const pal = computed(() => {
  const p = palettes[theme.value] || palettes.treasure!;
  // fix typo fruits c if any
  return p.c.includes("ff6bnb") ? { ...p, c: "#ff6bb0" } : p;
});

const stars = computed(() => {
  const n = 8 + (seed.value % 7);
  const out: { cx: number; cy: number; r: number; o: number }[] = [];
  let x = seed.value;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push({
      cx: 12 + (x % 176),
      cy: 12 + ((x >>> 8) % 140),
      r: 0.6 + ((x >>> 16) % 18) / 10,
      o: 0.25 + ((x >>> 24) % 50) / 100,
    });
  }
  return out;
});
</script>

<template>
  <div
    class="cover"
    role="img"
    :aria-label="title"
    :style="{ '--a': pal.a, '--b': pal.b, '--c': pal.c, '--glow': pal.glow }"
  >
    <img
      v-if="useImg"
      class="photo"
      :src="imgSrc!"
      :alt="title"
      width="400"
      height="500"
      loading="lazy"
      decoding="async"
      @error="broken = true"
    />

    <svg v-else viewBox="0 0 200 250" width="200" height="250" aria-hidden="true">
      <defs>
        <linearGradient :id="`${uid}-bg`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--a)" />
          <stop offset="55%" stop-color="var(--b)" />
          <stop offset="100%" stop-color="var(--a)" />
        </linearGradient>
        <radialGradient :id="`${uid}-glow`" cx="50%" cy="28%" r="55%">
          <stop offset="0%" stop-color="var(--glow)" />
          <stop offset="100%" stop-color="transparent" />
        </radialGradient>
      </defs>
      <rect width="200" height="250" rx="16" :fill="`url(#${uid}-bg)`" />
      <rect width="200" height="250" rx="16" :fill="`url(#${uid}-glow)`" />
      <circle v-for="(s, i) in stars" :key="i" :cx="s.cx" :cy="s.cy" :r="s.r" fill="var(--c)" :opacity="s.o" />
      <circle cx="100" cy="100" r="42" fill="rgba(255,77,141,.2)" stroke="var(--c)" stroke-width="2" />
    </svg>

    <span v-if="rtp != null" class="rtp">RTP {{ rtp.toFixed(1) }}%</span>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: 14px;
  overflow: hidden;
  background: #0a0610;
  border: 1px solid rgba(255, 77, 141, 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 24px rgba(255, 60, 120, 0.08);
}
.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
.rtp {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
</style>
