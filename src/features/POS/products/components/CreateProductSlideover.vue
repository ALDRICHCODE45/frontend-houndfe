<script setup lang="ts">
/**
 * CreateProductSlideover — con UForm nativo de Nuxt UI
 *
 * COMPARACIÓN FINAL:
 *
 * │ Approach        │ Script setup │ Template │ Dependencias extra │
 * │─────────────────│──────────────│──────────│────────────────────│
 * │ vee-validate    │ ~35 líneas   │ ~80 lín  │ 3 paquetes         │
 * │ vee + composable│ ~10 líneas   │ ~60 lín  │ 3 paquetes         │
 * │ UForm (actual)  │ ~10 líneas   │ ~50 lín  │ 0 (ya viene)       │
 *
 * ¿Qué hace <UForm>?
 *   1. Recibe :schema (zod directo) y :state (reactive)
 *   2. Valida automáticamente al hacer submit
 *   3. Pasa los errores a cada <UFormField> por `name`
 *   4. <UFormField> muestra el error SIN que vos hagas nada
 *
 * No necesitás:
 *   ✗ defineField()
 *   ✗ toTypedSchema()
 *   ✗ errors.campo manual
 *   ✗ :color="errors.x ? 'error' : undefined"
 *   ✗ <p v-if="errors.x">{{ errors.x }}</p>
 *   ✗ FormField.vue custom
 *
 * Todo eso lo hace UForm + UFormField por vos.
 */
import { useProductForm } from '../composables/useProductForm'
import type { CreateProductData } from '../interfaces/product.types'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ProductFormValues } from '../composables/useProductForm'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: CreateProductData]
}>()

const { schema, state, resetForm } = useProductForm()

function onSubmit(event: FormSubmitEvent<ProductFormValues>) {
  // event.data ya viene VALIDADO y TIPADO. Si llegó acá, es válido.
  emit('submit', event.data)
  resetForm()
  open.value = false
}

function handleCancel() {
  resetForm()
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Nuevo Producto"
    description="Completá los datos del producto"
    side="right"
    inset
    @after-leave="resetForm"
  >
    <template #body>
      <!--
        <UForm> recibe:
          :schema  → el schema de zod DIRECTO (sin adapters)
          :state   → el reactive({}) con los valores del form
          @submit  → se ejecuta SOLO si la validación pasa

        <UFormField> recibe:
          label → texto del label
          name  → key del campo en el state/schema

        UFormField busca automáticamente el error de ese `name`
        en el resultado de la validación y lo muestra abajo del input.
        También le pone el color error al input automáticamente.
      -->
      <UForm
        id="create-product-form"
        :schema="schema"
        :state="state"
        class="flex flex-col gap-5"
        @submit="onSubmit"
      >
        <UFormField label="Nombre" name="name">
          <UInput
            v-model="state.name"
            placeholder="Ej: Alimento Premium 10kg"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="SKU" name="sku">
          <UInput v-model="state.sku" placeholder="Ej: ALM-PREM-10K" size="lg" class="w-full" />
        </UFormField>

        <UFormField label="Categoría" name="category">
          <UInput v-model="state.category" placeholder="Ej: Alimentos" size="lg" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Precio" name="price">
            <UInput
              v-model.number="state.price"
              type="number"
              placeholder="0.00"
              size="lg"
              class="w-full"
              :min="0"
              step="0.01"
            />
          </UFormField>

          <UFormField label="Stock" name="stock">
            <UInput
              v-model.number="state.stock"
              type="number"
              placeholder="0"
              size="lg"
              class="w-full"
              :min="0"
            />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleCancel" />
        <UButton label="Crear Producto" color="primary" type="submit" form="create-product-form" />
      </div>
    </template>
  </USlideover>
</template>
