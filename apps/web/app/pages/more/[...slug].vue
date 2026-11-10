<script setup lang="ts">
const route = useRoute();
const localePath = useLocalePath();
const slug = (route.params.slug as string[]).join("/");

if (slug === "faq") {
  await navigateTo(localePath("/faq"), { redirectCode: 301 });
}

const { link } = useNavPage(`/more/${slug}`);
</script>

<template>
  <PageStub :title="link.title" />
</template>
