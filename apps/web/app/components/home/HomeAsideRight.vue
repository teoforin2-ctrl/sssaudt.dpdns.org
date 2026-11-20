<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";

const { t } = useI18n();
const localePath = useLocalePath();

type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  authorName?: string | null;
  casinoSlug: string;
  casinoName: string;
};

type NewItem = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  rating: number;
};

defineProps<{
  reviews: ReviewItem[];
  newcomers: NewItem[];
}>();

const emit = defineEmits<{ pickCasino: [] }>();

function displayName(name: string) {
  return name.replace(/^Онлайн-казино\s+/i, "").replace(/^Online casino\s+/i, "").trim() || name;
}

function clip(text: string) {
  const t0 = text.replace(/\s+/g, " ").trim();
  return t0.length > 110 ? `${t0.slice(0, 110)}…` : t0;
}
</script>

<template>
  <aside class="aside">
    <section v-if="reviews.length" class="panel block" data-reveal-child>
      <h2>{{ t("home.aside.reviewsTitle") }}</h2>
      <ul class="reviews">
        <li v-for="r in reviews" :key="r.id">
          <div class="rev-head">
            <strong>{{ r.authorName || t("home.aside.anon") }}</strong>
            <UiRatingStars :value="r.rating" size="sm" />
          </div>
          <p class="casino">
            <NuxtLink class="casino-link" :to="localePath(`/casino/${r.casinoSlug}`)">
              {{ displayName(r.casinoName) }}
            </NuxtLink>
          </p>
          <p class="body">{{ clip(r.body) }}</p>
          <NuxtLink class="more" :to="localePath(`/casino/${r.casinoSlug}`)">
            {{ t("home.aside.readReview") }}
            <ArrowRight :size="13" :stroke-width="2" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="newcomers.length" class="panel block" data-reveal-child>
      <h2>{{ t("home.aside.newTitle") }}</h2>
      <ul class="newcomers">
        <li v-for="c in newcomers" :key="c.slug">
          <NuxtLink :to="localePath(`/casino/${c.slug}`)" class="row">
            <CasinoLogo :name="c.name" :src="c.logoUrl" size="sm" />
            <div class="meta">
              <strong>{{ displayName(c.name) }}</strong>
              <small>{{ c.rating.toFixed(1) }}</small>
            </div>
            <UiBadge tone="new">{{ t("home.new") }}</UiBadge>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="panel block cta" data-reveal-child>
      <h2>{{ t("card.reviewCtaTitle") }}</h2>
      <p>{{ t("home.aside.reviewHint") }}</p>
      <UiButton
        variant="primary"
        size="sm"
        type="button"
        data-track="cta_review"
        @click="emit('pickCasino')"
      >
        {{ t("home.aside.pickCasino") }}
      </UiButton>
    </section>
  </aside>
</template>

<style scoped>
.aside {
  display: grid;
  gap: 12px;
  align-content: start;
  position: sticky;
  top: calc(var(--header-h, 64px) + 72px);
}
@media (prefers-reduced-motion: no-preference) {
  .aside [data-reveal-child] {
    opacity: 0;
    transform: translateY(10px);
    animation: asideIn 0.2s var(--ease-out) both;
  }
  .aside [data-reveal-child]:nth-child(1) {
    animation-delay: 0ms;
  }
  .aside [data-reveal-child]:nth-child(2) {
    animation-delay: 40ms;
  }
  .aside [data-reveal-child]:nth-child(3) {
    animation-delay: 80ms;
  }
}
@keyframes asideIn {
  to {
    opacity: 1;
    transform: none;
  }
}
.block {
  padding: 14px;
}
h2 {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.reviews,
.newcomers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.rev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rev-head strong {
  font-size: 13px;
}
.casino {
  margin: 2px 0 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.casino-link {
  color: inherit;
  text-decoration: none;
  font-weight: 700;
}
.casino-link:hover {
  color: var(--accent-cta);
}
.body {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 750;
  color: var(--accent-cta);
  text-decoration: none;
}
.more:hover {
  text-decoration: underline;
}
.row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 8px;
  align-items: center;
  text-decoration: none;
  color: inherit;
  padding: 4px;
  border-radius: 10px;
}
.row:hover {
  background: var(--bg-elev-3);
  text-decoration: none;
}
.meta {
  min-width: 0;
}
.meta strong {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta small {
  color: var(--text-tertiary);
  font-size: 12px;
}
.cta p {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.45;
}
</style>
