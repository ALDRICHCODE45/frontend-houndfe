<script setup lang="ts">
/**
 * ProfileAccountSection — «Cuenta»: the signed-in person's name and email, read-only. Only what
 * the session already knows; nothing is editable here and nothing is invented.
 */
import { useId } from 'vue'

defineProps<{ name: string; email: string }>()

const headingId = useId()
</script>

<template>
  <section class="pf-group" :aria-labelledby="headingId" data-testid="profile-account">
    <div class="pf-group-head">
      <h2 :id="headingId" class="pf-group-title">Cuenta</h2>
    </div>
    <dl class="pf-surface pf-kv">
      <dt>Nombre</dt>
      <dd>{{ name }}</dd>
      <dt>Correo</dt>
      <dd>{{ email }}</dd>
    </dl>
  </section>
</template>
