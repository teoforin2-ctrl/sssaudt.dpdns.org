<script setup lang="ts">
const props = defineProps<{
  authorName?: string | null;
  authorRank?: string | null;
  dateText?: string | null;
  rating: number;
  body: string;
  editorial?: boolean;
  rewarded?: boolean;
  replyBody?: string | null;
}>();

const { t } = useI18n();

const author = computed(() => {
  const raw = (props.authorName || "").trim();
  if (!raw) return { name: "Player", meta: props.dateText || "" };
  const parts = raw.split(/\s+/);
  return {
    name: parts[0] || "Player",
    meta: [props.authorRank, props.dateText, parts.slice(1).join(" ")].filter(Boolean).join(" · "),
  };
});

const initials = computed(() => author.value.name.slice(0, 2).toUpperCase());
</script>

<template>
  <article class="review-card">
    <div class="review-head">
      <div class="review-user">
        <div class="avatar">{{ initials }}</div>
        <div>
          <strong style="font-size: 13px">{{ author.name }}</strong><br />
          <small>{{ author.meta || t("card.newbie") }}</small>
        </div>
      </div>
      <UiRatingStars :value="rating" size="sm" />
    </div>
    <div v-if="editorial || rewarded" class="casino-meta" style="margin-bottom: 8px">
      <UiBadge v-if="editorial" tone="neutral">{{ t("card.editorialReview") }}</UiBadge>
      <UiBadge v-if="rewarded" tone="new">{{ t("card.rewardedReview") }}</UiBadge>
    </div>
    <p class="body">{{ body }}</p>
    <div v-if="replyBody" class="reply">
      <strong>{{ t("card.officialReply") }}</strong>
      <p>{{ replyBody }}</p>
    </div>
  </article>
</template>

<style scoped>
.body {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13.5px;
  line-height: 1.55;
}
.reply {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-elev-1) 88%, var(--accent-cta) 12%);
}
.reply strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}
.reply p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>

