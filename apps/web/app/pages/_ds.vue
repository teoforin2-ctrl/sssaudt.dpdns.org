<script setup lang="ts">
const { t } = useI18n();

definePageMeta({
  // Dev gallery — keep out of production sitemap later
});

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: "Not Found" });
}

useHead({
  title: "Design System",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});

const stars = ref(4);
const tab = ref("a");
const radio = ref("lt_week");
const text = ref("Demo review text for the design system gallery.");
const modalOpen = ref(false);
const chip = ref("all");
</script>

<template>
  <div class="ds">
    <p class="eyebrow">DEV</p>
    <h1 class="page-title">{{ t("ds.title") }}</h1>
    <p class="lead" style="margin-bottom: 24px">{{ t("ds.lead") }}</p>

    <section class="block">
      <h2>Buttons</h2>
      <div class="row">
        <UiButton>Primary</UiButton>
        <UiButton variant="secondary">Secondary</UiButton>
        <UiButton variant="ghost">Ghost</UiButton>
        <UiButton variant="danger">Danger</UiButton>
        <UiButton loading>Loading</UiButton>
        <UiButton disabled>Disabled</UiButton>
        <UiButton size="sm">Small</UiButton>
        <UiButton size="lg">Large</UiButton>
      </div>
    </section>

    <section class="block">
      <h2>Badges / chips / rating</h2>
      <div class="row">
        <UiBadge tone="top">TOP</UiBadge>
        <UiBadge tone="hot">HOT</UiBadge>
        <UiBadge tone="new">NEW</UiBadge>
        <UiBadge tone="rep">Представитель</UiBadge>
        <UiRatingStars :value="4.6" />
        <UiRatingStars v-model="stars" interactive />
        <UiRatingPill :value="4.8" />
        <UiChip :active="chip === 'all'" @click="chip = 'all'">Все</UiChip>
        <UiChip :active="chip === 'top'" @click="chip = 'top'">Топ</UiChip>
      </div>
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
          <UiPopoverList
            :items="[
              { id: 'ru', label: 'Русский' },
              { id: 'en', label: 'English' },
              { id: 'kz', label: 'Қазақша' },
            ]"
          >
            <template #trigger>
              <UiButton variant="ghost" size="sm">Popover list</UiButton>
            </template>
          </UiPopoverList>
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
      <h2>Domain</h2>
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
      <div style="margin-top: 12px">
        <ReviewCtaBanner @open="modalOpen = true" />
      </div>
      <div class="grid-2" style="margin-top: 12px">
        <BonusCard title="Welcome 100%" type="welcome" amount-or-percent="100%" wager="35x" />
        <ReviewCard author-name="DemoUser" :rating="5" body="Демо-отзыв для галереи компонентов." editorial />
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
  max-width: 960px;
}
.block {
  margin-bottom: 28px;
}
.block h2 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 16px;
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
</style>
