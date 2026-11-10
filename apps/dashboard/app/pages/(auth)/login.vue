<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="grid w-full max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          Casino.Review CMS
        </h1>
        <p class="text-balance text-sm text-muted-foreground">
          Войдите по email и паролю
        </p>
      </div>
      <AuthSignIn />
    </div>
  </div>
</template>
