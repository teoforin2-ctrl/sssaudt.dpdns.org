<script setup lang="ts">
type Hit = {
  type: "casino" | "slot" | "bonus" | "article";
  slug: string;
  title: string;
  href: string;
  score?: number;
};

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    autofocus?: boolean;
  }>(),
  { compact: false, autofocus: false },
);

const emit = defineEmits<{ select: [hit: Hit]; close: [] }>();

const config = useRuntimeConfig();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();

const q = ref("");
const open = ref(false);
const loading = ref(false);
const items = ref<Hit[]>([]);
const active = ref(-1);
const root = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const popular = computed(() =>
  locale.value.startsWith("en")
    ? ["welcome bonus", "high RTP", "Megaways", "cashback"]
    : ["приветственный бонус", "высокий RTP", "Megaways", "кешбэк"],
);

const groups = computed(() => {
  const order: Hit["type"][] = ["casino", "slot", "bonus", "article"];
  return order
    .map((type) => ({
      type,
      label: t(`home.search.groups.${type}`),
      items: items.value.filter((i) => i.type === type),
    }))
    .filter((g) => g.items.length);
});

const flat = computed(() => groups.value.flatMap((g) => g.items));

function highlight(text: string) {
  const needle = q.value.trim();
  if (!needle) return text;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text;
  return (
    text.slice(0, i) +
    "<mark>" +
    text.slice(i, i + needle.length) +
    "</mark>" +
    text.slice(i + needle.length)
  );
}

async function runSearch(value: string) {
  const s = value.trim();
  if (!s) {
    items.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await $fetch<{ items: Hit[] }>(`${config.public.apiBase}/v1/search`, {
      query: { q: s, locale: locale.value },
    });
    items.value = res.items || [];
    active.value = items.value.length ? 0 : -1;
  } catch {
    items.value = [];
    active.value = -1;
  } finally {
    loading.value = false;
  }
}

watch(q, (value) => {
  open.value = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(value), 200);
});

function pick(hit: Hit) {
  emit("select", hit);
  open.value = false;
  q.value = "";
  items.value = [];
  router.push(localePath(hit.href));
  emit("close");
}

function applyPopular(term: string) {
  q.value = term;
  open.value = true;
  runSearch(term);
  inputEl.value?.focus();
}

function onKey(e: KeyboardEvent) {
  if (!open.value && e.key !== "Escape") open.value = true;
  const list = flat.value;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!list.length) return;
    active.value = (active.value + 1) % list.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!list.length) return;
    active.value = (active.value - 1 + list.length) % list.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const hit = list[active.value];
    if (hit) pick(hit);
  } else if (e.key === "Escape") {
    open.value = false;
    emit("close");
  }
}

function onDocKey(e: KeyboardEvent) {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
  e.preventDefault();
  open.value = true;
  inputEl.value?.focus();
}

function onClickOutside(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}

onMounted(() => {
  window.addEventListener("keydown", onDocKey);
  document.addEventListener("mousedown", onClickOutside);
  if (props.autofocus) inputEl.value?.focus();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onDocKey);
  document.removeEventListener("mousedown", onClickOutside);
  if (debounceTimer) clearTimeout(debounceTimer);
});

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<template>
  <div ref="root" class="qs" :class="{ compact }">
    <label class="field">
      <span class="sr">{{ t("home.search.placeholder") }}</span>
      <input
        ref="inputEl"
        v-model="q"
        type="search"
        autocomplete="off"
        :placeholder="t('home.search.placeholder')"
        @focus="open = true"
        @keydown="onKey"
      />
      <kbd v-if="!compact" class="hint">/</kbd>
    </label>

    <div v-if="open" class="panel" role="listbox">
      <template v-if="q.trim()">
        <p v-if="loading" class="muted">…</p>
        <p v-else-if="!items.length" class="muted">{{ t("home.search.empty") }}</p>
        <div v-for="g in groups" :key="g.type" class="group">
          <p class="g-title">{{ g.label }}</p>
          <button
            v-for="hit in g.items"
            :key="`${hit.type}-${hit.slug}`"
            type="button"
            role="option"
            class="hit"
            :class="{ on: flat[active] === hit }"
            :aria-selected="flat[active] === hit"
            @mouseenter="active = flat.indexOf(hit)"
            @click="pick(hit)"
          >
            <span v-html="highlight(hit.title)" />
          </button>
        </div>
      </template>
      <template v-else>
        <p class="g-title">{{ t("home.search.popular") }}</p>
        <div class="chips">
          <button v-for="term in popular" :key="term" type="button" class="chip" @click="applyPopular(term)">
            {{ term }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.qs {
  position: relative;
  width: 100%;
}
.field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
}
.field:focus-within {
  border-color: var(--border-strong);
}
input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  outline: none;
}
.hint {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 2px 6px;
}
.panel {
  position: absolute;
  z-index: 40;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  max-height: 360px;
  overflow: auto;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elev-1);
  box-shadow: var(--shadow-2, 0 12px 40px rgba(0, 0, 0, 0.35));
}
.group + .group {
  margin-top: 10px;
}
.g-title {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-weight: 800;
}
.hit {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
}
.hit:hover,
.hit.on {
  background: var(--bg-elev-2);
}
.hit :deep(mark) {
  background: color-mix(in srgb, var(--accent-cta) 25%, transparent);
  color: inherit;
  border-radius: 3px;
}
.muted {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1px solid var(--border-default);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.compact .field {
  min-height: 40px;
}
</style>
