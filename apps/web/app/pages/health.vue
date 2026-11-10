<script setup lang="ts">
const config = useRuntimeConfig();
const { data, error, pending, refresh } = await useAsyncData("api-ready", () =>
  $fetch(`${config.public.apiBase}/ready`).catch(async (e) => {
    const health = await $fetch(`${config.public.apiBase}/health`).catch(() => null);
    throw Object.assign(e, { health });
  }),
);
</script>

<template>
  <section>
    <h1>API status</h1>
    <p class="muted">{{ config.public.apiBase }}</p>
    <button type="button" @click="refresh()">Обновить</button>
    <pre v-if="pending">…</pre>
    <pre v-else-if="error">{{ error }}</pre>
    <pre v-else>{{ data }}</pre>
  </section>
</template>

<style scoped>
h1 {
  font-family: var(--font-display);
}
.muted {
  color: var(--text-secondary);
}
button {
  border: 0;
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--accent-cta);
  color: #0b1220;
  font-weight: 800;
  cursor: pointer;
}
pre {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  background: var(--bg-elev-1);
  border: 1px solid var(--border-default);
  overflow: auto;
}
</style>
