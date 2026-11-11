<script setup lang="ts">
defineProps<{
  eyebrow?: string | null;
  title: string;
  lead?: string | null;
  container?: "content" | "narrow" | "form" | "wide" | "prose";
}>();
</script>

<template>
  <article :class="`container-${container || 'content'} page`">
    <PublicPageHero :eyebrow="eyebrow" :title="title" :lead="lead">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PublicPageHero>
    <div class="page-content body">
      <slot />
    </div>
    <div v-if="$slots.links" class="links">
      <slot name="links" />
    </div>
  </article>
</template>

<style scoped>
.page {
  padding-bottom: 8px;
}
.body :deep(.panel),
.body :deep(.section) {
  margin-top: 14px;
}
.links {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
