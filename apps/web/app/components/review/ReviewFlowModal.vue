<script setup lang="ts">
import {
  REVIEW_MIN_CHARS,
  formatRewardUsd,
  isTrc20Address,
  DEFAULT_REWARD_SETTINGS,
} from "@x-reviewer/shared";
import { Check, Hourglass } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  casinoSlug: string;
  casinoName: string;
}>();

const emit = defineEmits<{ close: []; published: [] }>();

const config = useRuntimeConfig();
const { t, locale } = useI18n();
const route = useRoute();
const { ensureGroup, setPlayerId, playerId, cookieId, hydrate, group } = useRewardGroup();
const {
  step,
  form,
  reviewId,
  abGroup,
  rewardAmount,
  wallet,
  txHash,
  error,
  focusDetail,
  spun,
  reset,
  go,
} = useReviewFlow();

const detailRef = ref<HTMLTextAreaElement | null>(null);
const captchaChecked = ref(false);
const captchaBusy = ref(false);
const submitting = ref(false);
const spinning = ref(false);

const { data: rewardCfg } = await useAsyncData("public-reward-settings", () =>
  $fetch<{
    enabled: boolean;
    currency: string;
    network: string;
    explorerTxTemplate: string;
    fixedAmountA: number;
    rewardPreviewB: string;
    minReviewChars: number;
  }>(`${config.public.apiBase}/v1/reward-settings`),
);

const currency = computed(() => rewardCfg.value?.currency || DEFAULT_REWARD_SETTINGS.currency);
const network = computed(() => rewardCfg.value?.network || DEFAULT_REWARD_SETTINGS.network);
const fixedA = computed(
  () => rewardCfg.value?.fixedAmountA ?? DEFAULT_REWARD_SETTINGS.fixedAmountA,
);
const minChars = computed(
  () => rewardCfg.value?.minReviewChars ?? REVIEW_MIN_CHARS,
);

const rewardPreview = computed(() => {
  const g = group.value || ensureGroup();
  return g === "A"
    ? formatRewardUsd(fixedA.value)
    : rewardCfg.value?.rewardPreviewB || t("reviewFlow.rewardPreviewB");
});

const explorerUrl = computed(() => {
  const tpl = rewardCfg.value?.explorerTxTemplate || DEFAULT_REWARD_SETTINGS.explorerTxTemplate;
  return txHash.value ? tpl.replace("{hash}", txHash.value) : "#";
});

const forceFail = computed(() => String(route.query.payout || "") === "fail");

const canSubmit = computed(
  () =>
    form.playedDuration != null &&
    form.issuesRegistration != null &&
    form.issuesDeposit != null &&
    form.issuesWithdraw != null &&
    form.modesTried != null &&
    form.rating >= 1 &&
    form.body.trim().length >= minChars.value,
);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    hydrate();
    ensureGroup();
    abGroup.value = group.value;
    if (step.value === "form") captchaChecked.value = false;
  },
);

watch(focusDetail, async (v) => {
  if (!v) return;
  await nextTick();
  detailRef.value?.focus();
  detailRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
  focusDetail.value = false;
});

function requestClose() {
  if (step.value === "moderating" || step.value === "sending") {
    const ok = window.confirm(t("reviewFlow.closeConfirm"));
    if (!ok) return;
  }
  emit("close");
}

async function startCaptcha() {
  if (!canSubmit.value) return;
  ensureGroup();
  go("captcha");
  captchaChecked.value = false;
}

async function onCaptchaCheck() {
  if (captchaBusy.value || captchaChecked.value) return;
  captchaBusy.value = true;
  await new Promise((r) => setTimeout(r, 700));
  captchaChecked.value = true;
  captchaBusy.value = false;
  await submitModerate();
}

async function submitModerate() {
  go("moderating");
  submitting.value = true;
  error.value = null;
  const g = ensureGroup();

  const timeout = window.setTimeout(() => {
    if (step.value === "moderating") {
      go("moderation_timeout");
      submitting.value = false;
    }
  }, 30000);

  try {
    const res = await $fetch<{
      status: "approved" | "rejected";
      reviewId: string;
      playerId: string;
      abGroup: "A" | "B";
      rewardAmountUsd?: number | null;
    }>(`${config.public.apiBase}/v1/reviews/moderate`, {
      method: "POST",
      body: {
        casinoSlug: props.casinoSlug,
        playerId: playerId.value || undefined,
        cookieId: cookieId.value || undefined,
        abGroup: g,
        locale: locale.value === "en" ? "en" : "ru",
        rating: form.rating,
        body: form.body,
        playedDuration: form.playedDuration,
        issuesRegistration: form.issuesRegistration,
        issuesDeposit: form.issuesDeposit,
        issuesWithdraw: form.issuesWithdraw,
        modesTried: form.modesTried,
        captchaToken: "mock-ok",
      },
    });
    window.clearTimeout(timeout);
    setPlayerId(res.playerId);
    reviewId.value = res.reviewId;
    abGroup.value = res.abGroup;
    if (res.status === "rejected") {
      go("rejected");
      return;
    }
    rewardAmount.value = res.rewardAmountUsd ?? null;
    go("reward");
    emit("published");
  } catch (e: unknown) {
    window.clearTimeout(timeout);
    const err = e as { statusCode?: number };
    error.value = err?.statusCode === 429 ? t("reviewFlow.rateLimited") : t("reviewFlow.moderationError");
    go("moderation_timeout");
  } finally {
    submitting.value = false;
  }
}

function backToForm() {
  go("form");
  focusDetail.value = true;
}

function claimReward() {
  go("payout");
}

async function spinWheel() {
  if (!reviewId.value || !playerId.value || spun.value || spinning.value) return;
  try {
    const res = await $fetch<{ amountUsd: number; alreadySpun: boolean }>(
      `${config.public.apiBase}/v1/rewards/spin`,
      {
        method: "POST",
        body: { reviewId: reviewId.value, playerId: playerId.value },
      },
    );
    rewardAmount.value = res.amountUsd;
    if (res.alreadySpun) {
      spun.value = true;
      return;
    }
    spinning.value = true;
  } catch {
    error.value = t("reviewFlow.spinError");
  }
}

function onSpinDone() {
  spinning.value = false;
  spun.value = true;
}

async function sendPayout() {
  if (!reviewId.value || !playerId.value) return;
  if (!isTrc20Address(wallet.value)) {
    error.value = t("reviewFlow.invalidWallet");
    return;
  }
  error.value = null;
  go("sending");
  try {
    const res = await $fetch<{ status: string; txHash?: string; amountUsd: number }>(
      `${config.public.apiBase}/v1/rewards/payout`,
      {
        method: "POST",
        query: forceFail.value ? { payout: "fail" } : undefined,
        body: {
          reviewId: reviewId.value,
          playerId: playerId.value,
          walletAddress: wallet.value.trim(),
          forceFail: forceFail.value,
        },
      },
    );
    txHash.value = res.txHash || null;
    rewardAmount.value = res.amountUsd;
    go("success");
  } catch {
    go("failed");
  }
}

function done() {
  reset();
  emit("close");
}

const playedOpts = [
  { value: "lt_week" as const, labelKey: "reviewFlow.played.lt_week" },
  { value: "w1_m1" as const, labelKey: "reviewFlow.played.w1_m1" },
  { value: "m1_y1" as const, labelKey: "reviewFlow.played.m1_y1" },
  { value: "gt_year" as const, labelKey: "reviewFlow.played.gt_year" },
];

const modesOpts = [
  { value: "m1_5" as const, labelKey: "reviewFlow.modes.m1_5" },
  { value: "m6_10" as const, labelKey: "reviewFlow.modes.m6_10" },
  { value: "m10_plus" as const, labelKey: "reviewFlow.modes.m10_plus" },
];

const yesNo = [
  { value: true, labelKey: "reviewFlow.yes" },
  { value: false, labelKey: "reviewFlow.no" },
];
</script>

<template>
  <UiModal
    :open="open"
    size="lg"
    :title="t('reviewFlow.title', { name: casinoName })"
    @close="requestClose"
  >
    <div class="flow" :data-step="step">
      <div v-if="step === 'form'" class="step">
        <fieldset>
          <legend>{{ t("reviewFlow.qPlayed") }}</legend>
          <div class="pills" role="radiogroup" :aria-label="t('reviewFlow.qPlayed')">
            <button
              v-for="o in playedOpts"
              :key="o.value"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.playedDuration === o.value"
              :class="{ on: form.playedDuration === o.value }"
              @click="form.playedDuration = o.value"
            >
              {{ t(o.labelKey) }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t("reviewFlow.qReg") }}</legend>
          <div class="pills" role="radiogroup" :aria-label="t('reviewFlow.qReg')">
            <button
              v-for="o in yesNo"
              :key="'r' + String(o.value)"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.issuesRegistration === o.value"
              :class="{ on: form.issuesRegistration === o.value }"
              @click="form.issuesRegistration = o.value"
            >
              {{ t(o.labelKey) }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t("reviewFlow.qDeposit") }}</legend>
          <div class="pills" role="radiogroup" :aria-label="t('reviewFlow.qDeposit')">
            <button
              v-for="o in yesNo"
              :key="'d' + String(o.value)"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.issuesDeposit === o.value"
              :class="{ on: form.issuesDeposit === o.value }"
              @click="form.issuesDeposit = o.value"
            >
              {{ t(o.labelKey) }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t("reviewFlow.qWithdraw") }}</legend>
          <div class="pills" role="radiogroup" :aria-label="t('reviewFlow.qWithdraw')">
            <button
              v-for="o in yesNo"
              :key="'w' + String(o.value)"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.issuesWithdraw === o.value"
              :class="{ on: form.issuesWithdraw === o.value }"
              @click="form.issuesWithdraw = o.value"
            >
              {{ t(o.labelKey) }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t("reviewFlow.qModes") }}</legend>
          <div class="pills" role="radiogroup" :aria-label="t('reviewFlow.qModes')">
            <button
              v-for="o in modesOpts"
              :key="o.value"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.modesTried === o.value"
              :class="{ on: form.modesTried === o.value }"
              @click="form.modesTried = o.value"
            >
              {{ t(o.labelKey) }}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t("reviewFlow.qRating") }}</legend>
          <UiRatingStars v-model="form.rating" interactive />
        </fieldset>


        <fieldset>
          <legend>
            <label for="rf-body">{{ t("reviewFlow.qBody") }}</label>
          </legend>
          <textarea
            id="rf-body"
            ref="detailRef"
            v-model="form.body"
            class="ta"
            rows="6"
            :placeholder="t('reviewFlow.bodyPlaceholder')"
          />
          <p class="counter" :class="{ ok: form.body.trim().length >= minChars }" aria-live="polite">
            {{ form.body.trim().length }} / {{ minChars }}
          </p>
        </fieldset>


        <p class="reward-line">
          {{ t("reviewFlow.rewardLine", { amount: rewardPreview }) }}
        </p>
      </div>

      <div v-else-if="step === 'captcha'" class="step center">
        <h3>{{ t("reviewFlow.captchaTitle") }}</h3>
        <label class="captcha">
          <input
            type="checkbox"
            :checked="captchaChecked"
            :disabled="captchaBusy || captchaChecked"
            @change="onCaptchaCheck"
          >
          <span>{{ captchaBusy ? t("reviewFlow.captchaChecking") : t("reviewFlow.captchaLabel") }}</span>
        </label>
        <p class="hint">
          {{ t("reviewFlow.captchaTodo") }}
        </p>
      </div>

      <div v-else-if="step === 'moderating'" class="step center">
        <h3>{{ t("reviewFlow.moderatingTitle") }}</h3>
        <div class="hourglass" aria-hidden="true">
          <Hourglass :size="36" :stroke-width="2" />
        </div>
        <p class="hint">
          {{ t("reviewFlow.moderatingHint") }}
        </p>
      </div>

      <div v-else-if="step === 'rejected'" class="step center">
        <p class="lead">
          {{ t("reviewFlow.rejectedBody") }}
        </p>
      </div>

      <div v-else-if="step === 'moderation_timeout'" class="step center">
        <p class="lead">
          {{ error || t("reviewFlow.timeoutBody") }}
        </p>
      </div>

      <div v-else-if="step === 'reward'" class="step center">
        <div class="check" aria-hidden="true">
          <Check :size="32" :stroke-width="2.5" />
        </div>
        <p class="thanks">
          {{ t("reviewFlow.thanks") }}
        </p>
        <h3>{{ t("reviewFlow.claimTitle") }}</h3>

        <template v-if="abGroup === 'A'">
          <p class="amount">
            {{ formatRewardUsd(rewardAmount || fixedA) }}
          </p>
        </template>
        <template v-else>
          <RewardWheel
            v-if="rewardAmount != null"
            :amount-usd="rewardAmount"
            :spinning="spinning"
            :done="spun"
            @done="onSpinDone"
          />
          <p v-else class="hint">
            {{ t("reviewFlow.spinHint") }}
          </p>
        </template>
      </div>

      <div v-else-if="step === 'payout'" class="step">
        <h3>{{ t("reviewFlow.payoutTitle") }}</h3>
        <p class="amount">
          {{ t("reviewFlow.yourReward", { amount: formatRewardUsd(rewardAmount || 0) }) }}
        </p>
        <p class="meta">
          {{ currency }}, {{ network }}
        </p>
        <label class="field">
          <span>{{ t("reviewFlow.walletLabel") }}</span>
          <input v-model="wallet" type="text" autocomplete="off" spellcheck="false">
        </label>
        <p class="warn">
          {{ t("reviewFlow.walletWarn") }}
        </p>
        <p v-if="error" class="err">
          {{ error }}
        </p>
      </div>

      <div v-else-if="step === 'sending'" class="step center">
        <h3>{{ t("reviewFlow.sendingTitle") }}</h3>
        <div class="spinner" aria-hidden="true" />
      </div>

      <div v-else-if="step === 'success'" class="step center">
        <div class="success-ico" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <h3>{{ t("reviewFlow.successTitle") }}</h3>
        <p class="meta">
          {{ formatRewardUsd(rewardAmount || 0) }}, {{ currency }}, {{ network }}
        </p>
        <a
          v-if="txHash"
          class="tx"
          :href="explorerUrl"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t("reviewFlow.viewTx") }}</a>
      </div>

      <div v-else-if="step === 'failed'" class="step center">
        <p class="lead">
          {{ t("reviewFlow.payoutFailed") }}
        </p>
      </div>
    </div>

    <template #footer>
      <template v-if="step === 'form'">
        <UiButton variant="ghost" type="button" @click="requestClose">
          {{ t("reviewFlow.cancel") }}
        </UiButton>
        <UiButton
          variant="primary"
          type="button"
          :disabled="!canSubmit"
          @click="startCaptcha"
        >
          {{ t("reviewFlow.submit") }}
        </UiButton>
      </template>

      <template v-else-if="step === 'rejected' || step === 'moderation_timeout'">
        <UiButton variant="primary" type="button" @click="backToForm">
          {{ t("reviewFlow.backToForm") }}
        </UiButton>
      </template>

      <template v-else-if="step === 'reward'">
        <UiButton
          v-if="abGroup === 'B' && !spun"
          variant="primary"
          type="button"
          :disabled="spinning"
          :loading="spinning"
          @click="spinWheel"
        >
          {{ t("reviewFlow.spin") }}
        </UiButton>
        <UiButton
          v-else
          variant="primary"
          type="button"
          @click="claimReward"
        >
          {{ t("reviewFlow.claim") }}
        </UiButton>
      </template>

      <template v-else-if="step === 'payout'">
        <UiButton variant="ghost" type="button" @click="go('reward')">
          {{ t("reviewFlow.back") }}
        </UiButton>
        <UiButton variant="primary" type="button" @click="sendPayout">
          {{ t("reviewFlow.getReward") }}
        </UiButton>
      </template>

      <template v-else-if="step === 'failed'">
        <UiButton variant="primary" type="button" @click="go('payout')">
          {{ t("reviewFlow.retry") }}
        </UiButton>
      </template>

      <template v-else-if="step === 'success'">
        <UiButton variant="primary" type="button" @click="done">
          {{ t("reviewFlow.done") }}
        </UiButton>
      </template>
    </template>
  </UiModal>
</template>

<style scoped>
.flow {
  min-height: 180px;
}
.step {
  display: grid;
  gap: 14px;
  animation: cross 0.2s var(--ease-out);
}
.step.center {
  text-align: center;
  place-items: center;
  padding: 12px 0;
}
@keyframes cross {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .step { animation: none; }
}
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
}
legend {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-secondary);
}
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill {
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.pill.on {
  border-color: color-mix(in srgb, var(--accent-cta) 55%, var(--border-default));
  background: color-mix(in srgb, var(--accent-cta) 16%, var(--bg-elev-2));
  color: var(--accent-cta);
  font-weight: 600;
}
.ta {
  width: 100%;
  resize: vertical;
  min-height: 120px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-primary);
  padding: 12px;
  font: inherit;
  line-height: 1.45;
}
.counter {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}
.counter.ok { color: var(--accent-cta); }
.reward-line {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
}
.captcha {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-elev-2);
  cursor: pointer;
}
.hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.hourglass {
  display: grid;
  place-items: center;
  color: var(--accent-cta);
  animation: tick 1.2s ease-in-out infinite;
}
@keyframes tick {
  50% { transform: rotate(180deg); }
}
@media (prefers-reduced-motion: reduce) {
  .hourglass { animation: none; }
}
.lead {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  max-width: 36ch;
}
.check {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 34px;
  font-weight: 800;
  color: #fff;
  background: var(--accent-cta);
  box-shadow:
    0 0 0 8px color-mix(in srgb, var(--accent-cta) 25%, transparent),
    0 12px 32px color-mix(in srgb, var(--accent-cta) 35%, transparent);
}
.thanks {
  margin: 0;
  max-width: 42ch;
  line-height: 1.45;
  color: var(--text-secondary);
}
.amount {
  margin: 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
}
.meta {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.field input {
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-elev-2);
  color: var(--text-primary);
  padding: 12px;
  font: inherit;
}
.warn {
  margin: 0;
  font-size: 12px;
  color: var(--accent-amber);
  line-height: 1.4;
}
.err {
  margin: 0;
  color: #f07178;
  font-size: 13px;
}
.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent-cta);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(1turn); }
}
.success-ico {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: var(--accent-cta);
  background: var(--accent-cta-soft);
  border: 1px solid color-mix(in srgb, var(--accent-cta) 30%, transparent);
}
.tx {
  color: var(--accent-cta);
  font-size: 14px;
}
h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}
</style>
