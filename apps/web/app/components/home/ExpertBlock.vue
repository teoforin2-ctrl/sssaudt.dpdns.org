<script setup lang="ts">
import { ArrowRight, BadgeCheck } from "lucide-vue-next";

const props = defineProps<{
  expert: {
    slug: string;
    name: string;
    role?: string | null;
    quote?: string | null;
    hue?: number;
    isSeed?: boolean;
    photoUrl?: string | null;
    checksThisWeek?: number | null;
  };
}>();
const { t } = useI18n();
const localePath = useLocalePath();

const checks = computed(() => {
  const n = Number(props.expert.checksThisWeek ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
});

const photoSrc = computed(() => {
  const url = String(props.expert.photoUrl || "").trim();
  if (url) return url;
  if (props.expert.slug === "mira-volkova") return "/img/authors/mira-volkova.jpg";
  return null;
});
</script>

<template>
  <section class="expert">
    <div class="glow" aria-hidden="true" />
    <div class="top">
      <p class="label">{{ t("home.expert.label") }}</p>
      <h2>{{ t("home.expert.title") }}</h2>
    </div>
    <div class="row">
      <div class="avatar-wrap">
        <img
          v-if="photoSrc"
          class="photo"
          :src="photoSrc"
          :alt="expert.name"
          width="56"
          height="56"
          loading="lazy"
          decoding="async"
        >
        <AuthorAvatar
          v-else
          :name="expert.name"
          :hue="expert.hue || 168"
          :size="56"
        />
      </div>
      <div class="meta">
        <strong class="name-line">
          <NuxtLink class="name-link" :to="localePath(`/authors/${expert.slug}`)">
            {{ expert.name }}
          </NuxtLink>
          <BadgeCheck
            class="verified"
            :size="16"
            :stroke-width="2"
            :aria-label="t('home.expert.verified')"
          />
        </strong>
        <p v-if="expert.role" class="role">{{ expert.role }}</p>
        <p v-if="checks != null" class="checks tabular-nums">
          {{ t("home.expert.checksWeek", { n: checks }) }}
        </p>
        <p v-else-if="expert.quote" class="quote">{{ expert.quote }}</p>
      </div>
    </div>
    <NuxtLink class="profile" :to="localePath(`/authors/${expert.slug}`)">
      {{ t("home.expert.profile") }}
      <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
    </NuxtLink>
  </section>
</template>

<style scoped>
.expert {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  box-sizing: border-box;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: linear-gradient(135deg, var(--bg-elev-1), color-mix(in srgb, var(--bg-page) 70%, #0d1218));
}
.glow {
  position: absolute;
  right: -32px;
  top: -32px;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-cta) 8%, transparent);
  filter: blur(24px);
  pointer-events: none;
}
.top {
  display: grid;
  gap: 4px;
  position: relative;
  z-index: 1;
}
.label {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 700;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(18px, 2.2vw, 20px);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}
.avatar-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-cta) 30%, transparent);
}
.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.meta {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 2px;
}
.name-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.verified {
  color: var(--accent-cta);
  flex-shrink: 0;
}
.role {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.checks {
  margin: 2px 0 0;
  color: var(--accent-cta);
  font-size: 11px;
  font-weight: 500;
}
.quote {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
}
.profile {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-cta);
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
  width: fit-content;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover,
.profile:hover {
  color: var(--text-primary);
}
</style>
