<script setup lang="ts">
const props = defineProps<{
  items: { id: string; label: string; hint?: string }[];
  placeholder?: string;
  emptyText?: string;
}>();
const open = ref(false);
const q = ref("");
const root = ref<HTMLElement | null>(null);

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return props.items;
  return props.items.filter((i) => i.label.toLowerCase().includes(s) || i.id.toLowerCase().includes(s));
});

function onDoc(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener("click", onDoc));
onBeforeUnmount(() => document.removeEventListener("click", onDoc));
</script>

<template>
  <div ref="root" class="pop">
    <button type="button" class="trigger" @click="open = !open">
      <slot name="trigger">Open</slot>
    </button>
    <div v-if="open" class="panel" role="listbox">
      <UiInput v-model="q" :placeholder="placeholder || 'Search…'" />
      <ul>
        <li v-if="!filtered.length" class="empty">{{ emptyText || "—" }}</li>
        <li v-for="item in filtered" :key="item.id">
          <button type="button" class="row" @click="open = false">
            <strong>{{ item.label }}</strong>
            <small v-if="item.hint">{{ item.hint }}</small>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.pop {
  position: relative;
  display: inline-block;
}
.trigger {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  cursor: pointer;
}
.panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 40;
  width: min(280px, 80vw);
  padding: 10px;
  border-radius: 14px;
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-2);
  display: grid;
  gap: 8px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
}
.row {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-primary);
  display: grid;
}
.row:hover {
  background: var(--bg-elev-2);
}
.row small {
  color: var(--text-tertiary);
}
.empty {
  padding: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
