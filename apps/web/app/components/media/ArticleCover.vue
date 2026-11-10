<script setup lang="ts">
const props = defineProps<{
  title: string;
  theme?: string;
  kind?: string;
  slug?: string;
  src?: string | null;
}>();

const imgSrc = computed(() => {
  if (props.src) return props.src;
  // Prefer explicit cover_url from API; local fallbacks for seeded assets.
  if (props.slug) return `/img/articles/${props.slug}.png`;
  return null;
});

const broken = ref(false);
watch(imgSrc, () => {
  broken.value = false;
});
const { el, activeSrc } = useLazySrc(imgSrc);
const useImg = computed(() => !!activeSrc.value && !broken.value);
</script>

<template>
  <div ref="el" class="cover" role="img" :aria-label="title">
    <img
      v-if="useImg"
      class="photo"
      :src="activeSrc!"
      :alt="title"
      width="640"
      height="400"
      loading="lazy"
      fetchpriority="low"
      decoding="async"
      @error="broken = true"
    />
    <div v-else class="glow" :data-theme="theme || kind || 'guide'" />
    <span class="kind">{{ kind || "guide" }}</span>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  overflow: hidden;
  background: #0a0610;
  border: 1px solid rgba(255, 77, 141, 0.16);
}
.photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
.glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(500px 180px at 20% 20%, rgba(255, 60, 120, 0.4), transparent 60%),
    radial-gradient(420px 160px at 90% 80%, rgba(160, 40, 255, 0.28), transparent 55%),
    linear-gradient(145deg, #120814, #080610);
}
.glow[data-theme="news"] {
  background:
    radial-gradient(500px 180px at 30% 20%, rgba(255, 40, 100, 0.45), transparent 60%),
    linear-gradient(145deg, #160810, #080610);
}
.glow[data-theme="analytics"] {
  background:
    radial-gradient(500px 180px at 70% 30%, rgba(200, 60, 255, 0.4), transparent 60%),
    linear-gradient(145deg, #100818, #080610);
}
.kind {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
</style>
