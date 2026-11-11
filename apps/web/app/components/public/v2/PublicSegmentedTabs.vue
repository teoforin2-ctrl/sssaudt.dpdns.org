<script setup lang="ts">
export type SegmentTab = {
  key: string;
  label: string;
  to?: string;
  count?: number | string | null;
  active?: boolean;
};

defineProps<{
  tabs: SegmentTab[];
  sticky?: boolean;
}>();

const emit = defineEmits<{ select: [key: string] }>();
</script>

<template>
  <nav class="tabs" :class="{ sticky }" aria-label="Sections">
    <div class="scroller">
      <template v-for="tab in tabs" :key="tab.key">
        <NuxtLink
          v-if="tab.to"
          :to="tab.to"
          class="tab"
          :class="{ on: tab.active }"
        >
          <span>{{ tab.label }}</span>
          <span v-if="tab.count != null" class="n tabular-nums">{{ tab.count }}</span>
        </NuxtLink>
        <button
          v-else
          type="button"
          class="tab"
          :class="{ on: tab.active }"
          @click="emit('select', tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="tab.count != null" class="n tabular-nums">{{ tab.count }}</span>
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.tabs {
  margin-bottom: 16px;
}
.tabs.sticky {
  position: sticky;
  top: calc(var(--header-h, 64px) + 4px);
  z-index: 20;
  padding: 6px 0;
  background: color-mix(in srgb, var(--bg-canvas) 88%, transparent);
  backdrop-filter: blur(10px);
}
.scroller {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}
.scroller::-webkit-scrollbar {
  display: none;
}
.tab {
  scroll-snap-align: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none !important;
  white-space: nowrap;
  cursor: pointer;
  flex: 0 0 auto;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.tab:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.tab.on,
.tab.router-link-active {
  background: var(--accent-cta-soft);
  border-color: color-mix(in srgb, var(--accent-cta) 40%, var(--border-default));
  color: var(--text-primary);
}
.n {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-tertiary);
}
.tab.on .n,
.tab.router-link-active .n {
  color: var(--accent-cta);
}
</style>
