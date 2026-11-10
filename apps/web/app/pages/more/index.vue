<script setup lang="ts">
const { link, childLinks } = useNavPage("/more");
</script>

<template>
  <PageStub :title="link.title" :links="childLinks" />
</template>
