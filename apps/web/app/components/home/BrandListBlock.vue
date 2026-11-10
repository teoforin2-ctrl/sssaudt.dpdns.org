<script setup lang="ts">
const props = defineProps<{
  title: string;
  allLabel: string;
  allTo: string;
  kind: string;
  items: {
    slug: string;
    name: string;
    bonusText?: string | null;
    tagline?: string | null;
    rating: number;
    hot?: boolean;
    hasRepresentative?: boolean;
    partnerUrl?: string | null;
    details?: Record<string, unknown>;
  }[];
}>();

const { t } = useI18n();
const localePath = useLocalePath();

const isLand = computed(() => props.kind === "land-casino");
const isAff = computed(() => props.kind === "affiliate-program");

function detailStr(details: Record<string, unknown> | undefined, key: string) {
  const v = details?.[key];
  return typeof v === "string" ? v : "";
}

function landLine(details?: Record<string, unknown>) {
  const city = detailStr(details, "city");
  const country = detailStr(details, "country");
  return [city, country].filter(Boolean).join(", ");
}

function sectionBase() {
  if (props.kind === "poker-room") return "poker-rooms";
  if (props.kind === "bookmaker") return "bookmakers";
  if (props.kind === "land-casino") return "land-casinos";
  return "affiliate-programs";
}
</script>

<template>
  <section class="block">
    <SectionHeader :title="title" :to="allTo" :link-label="allLabel" />
    <div class="list">
      <article v-for="b in items" :key="b.slug" class="row">
        <BrandLogo :name="b.name" :kind="kind" />
        <div class="meta">
          <div class="name">
            <NuxtLink class="name-link" :to="localePath(`/${sectionBase()}/${b.slug}`)">
              <strong>{{ b.name }}</strong>
            </NuxtLink>
            <UiBadge v-if="b.hot" tone="hot">HOT</UiBadge>
            <UiBadge v-if="b.hasRepresentative" tone="rep">{{ t("card.rep") }}</UiBadge>
          </div>
          <p v-if="isLand">
            {{ landLine(b.details) }}
          </p>
          <p v-else-if="isAff">{{ detailStr(b.details, "model") }}</p>
          <p v-else>{{ b.bonusText || b.tagline }}</p>
          <span class="rating">{{ b.rating.toFixed(1) }}</span>
        </div>
        <div class="actions">
          <NuxtLink class="btn btn-ghost btn-sm" :to="localePath(`/${sectionBase()}/${b.slug}`)">
            {{ isLand ? t("home.brands.details") : t("home.review") }}
          </NuxtLink>
          <a
            v-if="!isLand"
            class="btn btn-primary btn-sm"
            :href="b.partnerUrl || '#'"
            rel="sponsored nofollow noopener"
            target="_blank"
          >
            {{ isAff ? t("home.brands.join") : t("home.brands.claim") }}
          </a>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.block {
  min-width: 0;
}
.list {
  display: grid;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elev-1);
}
.meta p {
  margin: 4px 0;
  color: var(--text-secondary);
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.name {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.name-link {
  color: inherit;
  text-decoration: none;
}
.name-link:hover {
  color: var(--accent-cta);
}
.rating {
  font-weight: 800;
  font-size: 13px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
@media (max-width: 700px) {
  .row {
    grid-template-columns: 56px 1fr;
  }
  .actions {
    grid-column: 1 / -1;
  }
}
</style>
