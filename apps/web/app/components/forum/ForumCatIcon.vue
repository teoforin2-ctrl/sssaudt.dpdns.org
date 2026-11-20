<script setup lang="ts">
import type { Component } from "vue";
import {
  Dices,
  Gamepad2,
  Gift,
  Megaphone,
  MessageCircle,
  TriangleAlert,
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    slug?: string | null;
    emoji?: string | null;
    size?: number;
  }>(),
  { size: 22 },
);

/** Map DB emoji / category slug → Lucide (smilies out, icons in). */
const bySlug: Record<string, Component> = {
  "online-kazino": Dices,
  zhaloby: TriangleAlert,
  bonusy: Gift,
  sloty: Gamepad2,
  offtop: MessageCircle,
  novosti: Megaphone,
};

const byEmoji: Record<string, Component> = {
  "🎰": Dices,
  "⚠️": TriangleAlert,
  "⚠": TriangleAlert,
  "🎁": Gift,
  "🎮": Gamepad2,
  "💬": MessageCircle,
  "📢": Megaphone,
};

const icon = computed<Component>(() => {
  const slug = String(props.slug || "").trim();
  if (slug && bySlug[slug]) return bySlug[slug]!;
  const raw = String(props.emoji || "").trim();
  // strip variation selector
  const key = raw.replace(/\uFE0F/g, "");
  if (byEmoji[raw]) return byEmoji[raw]!;
  if (byEmoji[key]) return byEmoji[key]!;
  return MessageCircle;
});
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="2"
    aria-hidden="true"
  />
</template>
