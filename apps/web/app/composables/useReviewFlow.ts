import type { RewardGroup } from "@x-reviewer/shared";
import { REVIEW_MIN_CHARS } from "@x-reviewer/shared";

export type ReviewFlowStep =
  | "form"
  | "captcha"
  | "moderating"
  | "rejected"
  | "approved"
  | "reward"
  | "payout"
  | "sending"
  | "success"
  | "failed"
  | "moderation_timeout";

export type PlayedDuration = "lt_week" | "w1_m1" | "m1_y1" | "gt_year";
export type ModesTried = "m1_5" | "m6_10" | "m10_plus";

export type ReviewFormState = {
  playedDuration: PlayedDuration | null;
  issuesRegistration: boolean | null;
  issuesDeposit: boolean | null;
  issuesWithdraw: boolean | null;
  modesTried: ModesTried | null;
  rating: number;
  body: string;
};

export function emptyReviewForm(): ReviewFormState {
  return {
    playedDuration: null,
    issuesRegistration: null,
    issuesDeposit: null,
    issuesWithdraw: null,
    modesTried: null,
    rating: 1,
    body: "",
  };
}

export function isReviewFormValid(f: ReviewFormState): boolean {
  return (
    f.playedDuration != null &&
    f.issuesRegistration != null &&
    f.issuesDeposit != null &&
    f.issuesWithdraw != null &&
    f.modesTried != null &&
    f.rating >= 1 &&
    f.rating <= 5 &&
    f.body.trim().length >= REVIEW_MIN_CHARS
  );
}

export function useReviewFlow() {
  const step = ref<ReviewFlowStep>("form");
  const form = reactive(emptyReviewForm());
  const reviewId = ref<string | null>(null);
  const abGroup = ref<RewardGroup | null>(null);
  const rewardAmount = ref<number | null>(null);
  const wallet = ref("");
  const txHash = ref<string | null>(null);
  const error = ref<string | null>(null);
  const focusDetail = ref(false);
  const spun = ref(false);

  function reset() {
    step.value = "form";
    Object.assign(form, emptyReviewForm());
    reviewId.value = null;
    rewardAmount.value = null;
    wallet.value = "";
    txHash.value = null;
    error.value = null;
    focusDetail.value = false;
    spun.value = false;
  }

  function go(next: ReviewFlowStep) {
    step.value = next;
  }

  return {
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
    isValid: computed(() => isReviewFormValid(form)),
  };
}
