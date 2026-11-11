<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "info" | "important" | "responsible" | "note";
    title?: string | null;
  }>(),
  { tone: "info" },
);
</script>

<template>
  <aside class="callout" :class="tone" role="note">
    <strong v-if="title" class="t">{{ title }}</strong>
    <div class="b"><slot /></div>
  </aside>
</template>

<style scoped>
.callout {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}
.t {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary);
  font-size: 13px;
}
.info {
  border-color: color-mix(in srgb, var(--accent-cyan) 35%, var(--border-default));
  background: color-mix(in srgb, var(--accent-cyan) 10%, var(--bg-elev-1));
}
.important {
  border-color: color-mix(in srgb, var(--accent-amber) 40%, var(--border-default));
  background: color-mix(in srgb, var(--accent-amber) 10%, var(--bg-elev-1));
}
.responsible {
  border-color: color-mix(in srgb, var(--accent-rose) 35%, var(--border-default));
  background: color-mix(in srgb, var(--accent-rose) 8%, var(--bg-elev-1));
}
.note {
  background: var(--bg-elev-2);
}
</style>
