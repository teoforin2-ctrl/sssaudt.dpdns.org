<script setup lang="ts">
/**
 * In-app design system gallery (Storybook substitute for the redesign checklist).
 * Dev-only — 404 in production.
 */
const { t } = useI18n();

definePageMeta({});

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: "Not Found" });
}

useHead({
  title: "Design System · SSS Audit",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});

const stars = ref(4);
const tab = ref("a");
const radio = ref("lt_week");
const text = ref("Demo review text for the design system gallery.");
const modalOpen = ref(false);
const chip = ref("all");

const swatches = [
  { name: "Obsidian", varName: "--bg-canvas", role: "Фон страницы" },
  { name: "Surface", varName: "--bg-elev-1", role: "Секции" },
  { name: "Card", varName: "--bg-elev-2", role: "Карточки" },
  { name: "Text", varName: "--text-primary", role: "Основной текст" },
  { name: "Muted", varName: "--text-secondary", role: "Подписи" },
  { name: "Neon Mint", varName: "--accent-cta", role: "CTA only" },
  { name: "Gold", varName: "--accent-gold", role: "Рейтинги / HOT" },
  { name: "Violet", varName: "--accent-violet", role: "TOP / служебные" },
  { name: "Alert", varName: "--accent-rose", role: "Ошибки / 18+" },
];

const demoCasino = {
  slug: "riobet",
  name: "Riobet",
  rating: 5.6,
  editorialScore: 4.9,
  playerScore: 4.1,
  reviewCount: 2106,
  rank: 2,
  displayRank: 2,
  top: true,
  hot: true,
  isNew: false,
  hasRepresentative: true,
  bonusLabel: "100 FS + 225%",
  bonusWager: "35",
  bonusPromo: "REVIEW26",
  bonusCheckedAt: "2026-11-01T12:00:00.000Z",
};
</script>

<template>
  <div class="ds">
    <p class="eyebrow">DEV · Design system</p>
    <h1 class="page-title">{{ t("ds.title") }}</h1>
    <p class="lead ds-lead">
      {{ t("ds.lead") }}
      Каталог по концепту редизайна (токены, кнопки, бейджи, карточка, trust).
    </p>

    <section class="block">
      <h2>Палитра</h2>
      <p class="hint">Зелёный — только действия. Золото — рейтинги и HOT.</p>
      <div class="sw-grid">
        <div v-for="s in swatches" :key="s.name" class="sw">
          <span class="sw-chip" :style="{ background: `var(${s.varName})` }" />
          <div>
            <p class="sw-name">{{ s.name }}</p>
            <p class="sw-hex">{{ s.varName }}</p>
            <p class="sw-role">{{ s.role }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Типографика</h2>
      <div class="type-rows">
        <div class="type-row">
          <p class="type-sample display xl">Рейтинг казино</p>
          <span>Display / Unbounded 800 · --text-display</span>
        </div>
        <div class="type-row">
          <p class="type-sample display lg">Блоки и секции</p>
          <span>H2 / Unbounded 700</span>
        </div>
        <div class="type-row">
          <p class="type-sample body">Основной текст описания и условий бонуса</p>
          <span>Body / Figtree 400–500 · 15–16px</span>
        </div>
        <div class="type-row">
          <p class="type-sample caption">WAGER ×35 · 2 893 ОТЗЫВА</p>
          <span>Caption · tabular-nums</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Кнопки</h2>
      <p class="hint">Максимум одна primary на экран.</p>
      <div class="row">
        <UiButton>Играть</UiButton>
        <UiButton variant="secondary">Обзор</UiButton>
        <UiButton variant="ghost">Как мы оцениваем</UiButton>
        <UiButton variant="danger">Danger</UiButton>
        <UiButton loading>Loading</UiButton>
        <UiButton disabled>Скоро</UiButton>
        <UiButton size="sm">Small</UiButton>
        <UiButton size="lg">Large</UiButton>
      </div>
    </section>

    <section class="block">
      <h2>Бейджи / chips / rating</h2>
      <p class="hint">Не больше двух бейджей в карточке. HOT — золото.</p>
      <div class="row">
        <UiBadge tone="top">TOP</UiBadge>
        <UiBadge tone="hot">HOT</UiBadge>
        <UiBadge tone="new">NEW</UiBadge>
        <UiBadge tone="rep">Представитель</UiBadge>
        <PublicBadge tone="hot">HOT</PublicBadge>
        <PublicBadge tone="top">TOP</PublicBadge>
        <UiRatingStars :value="4.6" />
        <UiRatingStars v-model="stars" interactive />
        <UiRatingPill :value="4.8" />
        <UiChip :active="chip === 'all'" @click="chip = 'all'">Все</UiChip>
        <UiChip :active="chip === 'top'" @click="chip = 'top'">Топ</UiChip>
      </div>
    </section>

    <section class="block">
      <h2>Карточка казино (v2)</h2>
      <PublicCasinoRow :casino="demoCasino" />
    </section>

    <section class="block">
      <h2>Trust grid</h2>
      <TrustGrid />
    </section>

    <section class="block">
      <h2>Form</h2>
      <div class="stack">
        <UiInput placeholder="Input" />
        <UiTextarea v-model="text" :min-length="20" :max-length="500" />
        <UiRadioGroup
          v-model="radio"
          name="duration"
          :options="[
            { value: 'lt_week', label: 'Меньше недели' },
            { value: 'w1_m1', label: 'От недели до месяца' },
          ]"
        />
        <UiTabs
          v-model="tab"
          :items="[
            { id: 'a', label: 'Обзор' },
            { id: 'b', label: 'Бонусы' },
            { id: 'c', label: 'Отзывы' },
          ]"
        />
        <div class="row">
          <UiCopyButton value="CASINORU" />
          <UiButton variant="secondary" @click="modalOpen = true">Open modal</UiButton>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Feedback</h2>
      <div class="stack">
        <UiSkeleton height="48px" />
        <UiEmptyState title="Пусто" description="Нет результатов фильтра">
          <UiButton size="sm" variant="secondary">Сбросить</UiButton>
        </UiEmptyState>
      </div>
    </section>

    <section class="block">
      <h2>Domain (legacy row)</h2>
      <div class="listing">
        <CasinoRow
          :casino="{
            slug: 'demo',
            name: 'Aurum Play',
            rating: 4.9,
            rank: 1,
            top: true,
            hot: true,
            hasRepresentative: true,
            bonusLabel: '100% до $500',
          }"
        />
      </div>
    </section>

    <UiModal :open="modalOpen" title="Modal preview" @close="modalOpen = false">
      <p style="margin: 0; color: var(--text-secondary)">Focus-trap preview · Esc closes.</p>
      <template #footer>
        <UiButton variant="ghost" @click="modalOpen = false">Cancel</UiButton>
        <UiButton @click="modalOpen = false">OK</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<style scoped>
.ds {
  max-width: 1100px;
  padding-bottom: 48px;
}
.ds-lead {
  margin-bottom: 28px;
}
.hint {
  margin: -4px 0 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.block {
  margin-bottom: 32px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border-subtle);
}
.block h2 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.stack {
  display: grid;
  gap: 12px;
}
.sw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.sw {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.sw-chip {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.sw-name {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.sw-hex,
.sw-role {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
}
.type-rows {
  display: grid;
  gap: 14px;
}
.type-row {
  display: grid;
  gap: 4px;
}
.type-row span {
  font-size: 11px;
  color: var(--text-secondary);
}
.type-sample.display {
  font-family: var(--font-display);
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.type-sample.xl {
  font-size: var(--text-display, clamp(40px, 5vw, 56px));
  line-height: 1.08;
}
.type-sample.lg {
  font-size: var(--text-h2, 28px);
  font-weight: 700;
}
.type-sample.body {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.type-sample.caption {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
</style>
