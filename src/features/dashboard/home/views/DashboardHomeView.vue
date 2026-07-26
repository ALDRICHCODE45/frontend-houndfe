<script setup lang="ts"></script>

<template>
  <UCard :ui="{ body: 'bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-layout-dashboard" class="size-5 text-coco-gold-500" />
        <h3 class="font-semibold">Dashboard</h3>
      </div>
    </template>

    <p class="text-dimmed">Bienvenido a Hound. Selecciona una sección en el sidebar.</p>
  </UCard>
</template>
