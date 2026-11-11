<script setup lang="ts">
type PackageItem = {
  id: string;
  slug: string;
  title: string;
  priceLabel?: string | null;
  features: string[];
  highlight?: boolean;
};

type CaseItem = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  metrics: string[];
  coverUrl?: string | null;
};

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const { contacts } = useSiteSettings();

const partnersMail = computed(
  () => contacts.value.email_partners || contacts.value.email || "",
);

const { data, pending, error, refresh } = await useAsyncData(
  () => `b2b-${locale.value}`,
  () =>
    $fetch<{ packages: PackageItem[]; cases: CaseItem[] }>(`${config.public.apiBase}/v1/b2b`, {
      query: { locale: locale.value },
    }),
  { watch: [locale] },
);

const packages = computed(() => data.value?.packages || []);
const cases = computed(() => data.value?.cases || []);

const form = reactive({
  name: "",
  contact: "",
  projectType: "white-label" as "white-label" | "custom" | "aggregator" | "other",
  budget: "",
  message: "",
});
const sending = ref(false);
const sent = ref(false);
const formError = ref<string | null>(null);

async function submitLead() {
  formError.value = null;
  sending.value = true;
  sent.value = false;
  try {
    await $fetch(`${config.public.apiBase}/v1/b2b/leads`, {
      method: "POST",
      body: {
        name: form.name,
        contact: form.contact,
        projectType: form.projectType,
        budget: form.budget || null,
        message: form.message || null,
        locale: locale.value,
      },
    });
    sent.value = true;
    form.name = "";
    form.contact = "";
    form.budget = "";
    form.message = "";
    form.projectType = "white-label";
  } catch {
    formError.value = t("pages.b2b.formError");
  } finally {
    sending.value = false;
  }
}

useHead(() => ({
  title: `${t("pages.b2b.title")}`,
  meta: [{ name: "description", content: t("pages.b2b.lead") }],
}));
</script>

<template>
  <article class="page">
    <header class="hero">
      <div class="hero-bg" aria-hidden="true" />
      <div class="hero-copy">
        <p class="eyebrow">{{ t("pages.b2b.eyebrow") }}</p>
        <h1 class="page-title">{{ t("pages.b2b.title") }}</h1>
        <p class="lead">{{ t("pages.b2b.lead") }}</p>
        <div class="cta-row">
          <a class="btn btn-primary" href="#lead">{{ t("pages.b2b.cta") }}</a>
          <a v-if="partnersMail" class="ghost" :href="`mailto:${partnersMail}`">{{ partnersMail }}</a>
          <NuxtLink v-else class="ghost" :to="localePath('/contacts')">{{ t("pages.contacts.title") }}</NuxtLink>
        </div>
      </div>
    </header>

    <section class="block">
      <h2>{{ t("pages.b2b.packagesTitle") }}</h2>
      <SkeletonB2bPackages v-if="pending" />
      <UiEmptyState v-else-if="error" :title="t('home.apiDown')">
        <UiButton size="sm" variant="secondary" @click="refresh()">{{ t("home.retry") }}</UiButton>
      </UiEmptyState>
      <div v-else class="packages">
        <article
          v-for="p in packages"
          :key="p.id"
          class="pkg"
          :class="{ highlight: p.highlight }"
        >
          <div v-if="p.highlight" class="popular">{{ t("pages.b2b.popular") }}</div>
          <p class="tier">{{ p.title }}</p>
          <div class="price">
            <strong>{{ p.priceLabel || "—" }}</strong>
            <span>{{ t("pages.b2b.priceHint") }}</span>
          </div>
          <ul>
            <li v-for="f in p.features" :key="f">
              <span class="check" aria-hidden="true">✓</span>
              <span>{{ f }}</span>
            </li>
          </ul>
          <a
            class="cta"
            :class="p.highlight ? 'cta-primary' : 'cta-ghost'"
            href="#lead"
          >
            {{ t("pages.b2b.discuss") }}
          </a>
        </article>
      </div>
    </section>

    <section class="block">
      <h2>{{ t("pages.b2b.casesTitle") }}</h2>
      <SkeletonB2bCases v-if="pending" />
      <div v-else class="cases">
        <article v-for="c in cases" :key="c.id" class="case">
          <h3>{{ c.title }}</h3>
          <p v-if="c.summary">{{ c.summary }}</p>
          <ul>
            <li v-for="m in c.metrics" :key="m">{{ m }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section id="lead" class="lead-sec">
      <div class="lead-copy">
        <h2>{{ t("pages.b2b.formTitle") }}</h2>
        <p>{{ t("pages.b2b.formLead") }}</p>
        <ul class="bullets">
          <li>{{ t("pages.b2b.formBullet1") }}</li>
          <li>{{ t("pages.b2b.formBullet2") }}</li>
          <li>{{ t("pages.b2b.formBullet3") }}</li>
        </ul>
      </div>
      <form class="form" @submit.prevent="submitLead">
        <label>
          <span>{{ t("pages.b2b.formName") }}</span>
          <input v-model="form.name" required minlength="2" maxlength="120" />
        </label>
        <label>
          <span>{{ t("pages.b2b.formContact") }}</span>
          <input v-model="form.contact" required minlength="3" maxlength="200" placeholder="@telegram / email" />
        </label>
        <label>
          <span>{{ t("pages.b2b.formType") }}</span>
          <UiSelect
            v-model="form.projectType"
            :options="[
              { value: 'white-label', label: 'White Label' },
              { value: 'custom', label: t('pages.b2b.typeCustom') },
              { value: 'aggregator', label: t('pages.b2b.typeAgg') },
              { value: 'other', label: t('pages.b2b.typeOther') },
            ]"
          />
        </label>
        <label>
          <span>{{ t("pages.b2b.formBudget") }}</span>
          <UiSelect
            v-model="form.budget"
            :placeholder="t('pages.b2b.budgetAny')"
            :options="[
              { value: '', label: t('pages.b2b.budgetAny') },
              { value: 'to-30k', label: t('pages.b2b.budget30') },
              { value: '30-80k', label: t('pages.b2b.budget80') },
              { value: '80-200k', label: t('pages.b2b.budget200') },
              { value: '200k+', label: t('pages.b2b.budget200p') },
            ]"
          />
        </label>
        <label class="full">
          <span>{{ t("pages.b2b.formMessage") }}</span>
          <textarea v-model="form.message" rows="4" maxlength="2000" />
        </label>
        <p v-if="formError" class="err">{{ formError }}</p>
        <p v-if="sent" class="ok">{{ t("pages.b2b.formOk") }}</p>
        <UiButton type="submit" variant="primary" :disabled="sending">
          {{ sending ? t("pages.b2b.formSending") : t("pages.b2b.formSubmit") }}
        </UiButton>
      </form>
    </section>

    <p class="note">{{ t("pages.b2b.note") }}</p>
  </article>
</template>

<style scoped>
.page {
  max-width: 1100px;
}
.hero {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  margin-bottom: 28px;
  min-height: clamp(320px, 42vh, 460px);
  display: flex;
  align-items: center;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-color: var(--bg-base);
  background-image:
    linear-gradient(
      105deg,
      color-mix(in srgb, var(--bg-base) 94%, transparent),
      color-mix(in srgb, var(--bg-base) 70%, transparent)
    ),
    url("/img/sections/bg-b2b-hero.webp");
  background-size: cover, cover;
  background-position: center, center;
  background-repeat: no-repeat;
}
html[data-theme="light"] .hero-bg {
  background-image:
    linear-gradient(
      105deg,
      color-mix(in srgb, var(--bg-base) 96%, transparent),
      color-mix(in srgb, var(--bg-canvas) 88%, transparent)
    ),
    url("/img/sections/bg-b2b-hero.webp");
}
.hero-copy {
  position: relative;
  z-index: 1;
  padding: clamp(40px, 6vw, 72px) clamp(28px, 4vw, 56px);
  max-width: 720px;
  color: var(--text-primary);
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-cta);
  font-weight: 750;
}
.page-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: clamp(28px, 3.2vw, 44px);
  letter-spacing: -0.03em;
}
.lead {
  margin: 0 0 18px;
  color: var(--text-secondary);
  font-size: 16px;
  max-width: 62ch;
  line-height: 1.55;
}
.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.ghost {
  font-size: 14px;
  font-weight: 750;
  color: var(--text-secondary);
  text-decoration: none;
}
.block {
  margin-bottom: 32px;
}
.block h2 {
  margin: 0 0 14px;
  font-family: var(--font-display);
  font-size: 22px;
}
.packages {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
  padding-top: 14px;
  overflow: visible;
}
.pkg {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  padding: 28px 22px 22px;
  border-radius: 20px;
  border: 1px solid var(--border-default);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elev-2) 70%, transparent), transparent 40%),
    var(--bg-elev-1);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.pkg:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 28%, var(--border-default));
}
.pkg.highlight {
  border-color: color-mix(in srgb, var(--accent-cta) 55%, var(--border-default));
  background:
    radial-gradient(420px 180px at 50% 0%, color-mix(in srgb, var(--accent-cta) 16%, transparent), transparent 65%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elev-2) 80%, transparent), transparent 45%),
    var(--bg-elev-1);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-cta) 22%, transparent),
    0 18px 40px -24px color-mix(in srgb, var(--accent-cta) 40%, transparent);
}
.popular {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-inverse);
  background: var(--accent-cta);
  white-space: nowrap;
  pointer-events: none;
}
.tier {
  margin: 0;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.price {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.price strong {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(22px, 2.2vw, 32px);
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text-primary);
  white-space: nowrap;
}
.pkg.highlight .price strong {
  color: var(--accent-cta);
}
.price span {
  font-size: 13px;
  color: var(--text-tertiary);
}
.pkg ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
}
.pkg li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.45;
}
.pkg li > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.check {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
  flex-shrink: 0;
}
.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  margin-top: auto;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 750;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.cta-primary {
  color: var(--text-inverse);
  background: var(--accent-cta);
}
.cta-primary:hover {
  filter: brightness(1.05);
}
.cta-ghost {
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  background: transparent;
}
.cta-ghost:hover {
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--accent-cta);
}
.case ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
.cases {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.case {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
}
.case h3 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 17px;
}
.case p {
  margin: 0 0 10px;
  color: var(--text-secondary);
  font-size: 14px;
}
.lead-sec {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 18px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-default);
  background:
    radial-gradient(500px 180px at 0% 0%, color-mix(in srgb, var(--accent-cta) 12%, transparent), transparent 60%),
    var(--bg-elev-1);
  margin-bottom: 18px;
}
.lead-copy h2 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 22px;
}
.lead-copy p {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
.bullets {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.55;
}
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.form label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary);
}
.form .full {
  grid-column: 1 / -1;
}
.form input,
.form textarea {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  font: inherit;
}
.form textarea {
  min-height: 110px;
  resize: vertical;
}
.err {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--accent-rose, #ff6b8a);
  font-size: 13px;
}
.ok {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--accent-cta);
  font-size: 13px;
  font-weight: 700;
}
.note {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
@media (max-width: 900px) {
  .packages,
  .cases,
  .lead-sec,
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
