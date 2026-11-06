<script setup lang="ts">
/**
 * ShippingBoxesPanel — the Cajas tab (handoff §5, S4, S5). Lists the boxes,
 * creates and edits them in a slideover, retires or reactivates them with a
 * PATCH of isActive, and deletes them for good after a confirmation. Errors
 * read as Spanish next to the field or action that caused them (S6).
 */
import { computed, shallowRef, watch } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { confirmLeave } from '@/core/shared/composables/useLeaveGuard'
import type { ShippingBox } from '../interfaces/shipping-settings.types'
import { useShippingBoxes } from '../composables/useShippingBoxes'
import {
  boxPatch,
  boxToDraft,
  draftToBoxBody,
  emptyBoxDraft,
  mapBoxError,
  type BoxDraft,
  type BoxErrors,
} from '../utils/shippingBoxForm'
import ShippingBoxForm from './ShippingBoxForm.vue'
import ShippingBoxList, { type BoxRowAction } from './ShippingBoxList.vue'

const props = defineProps<{ tenantId: string; canUpdate: boolean }>()
const emit = defineEmits<{ dirty: [dirty: boolean] }>()

const toast = useToast()
const { query, create, update, remove } = useShippingBoxes(() => props.tenantId, () => true)
const boxes = computed(() => query.data.value ?? [])
const busy = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)

const editorOpen = shallowRef(false)
const editing = shallowRef<ShippingBox | null>(null)
const formKey = shallowRef(0)
const formDirty = shallowRef(false)
const formErrors = shallowRef<BoxErrors>({})
const formMessage = shallowRef<string | null>(null)
const actionMessage = shallowRef<string | null>(null)
const deleteTarget = shallowRef<ShippingBox | null>(null)
const deleteMessage = shallowRef<string | null>(null)

const initialDraft = computed<BoxDraft>(() => (editing.value ? boxToDraft(editing.value) : emptyBoxDraft()))
watch(() => editorOpen.value && formDirty.value, (dirty) => emit('dirty', dirty), { immediate: true })

function openEditor(box: ShippingBox | null) {
  editing.value = box
  formErrors.value = {}
  formMessage.value = null
  formDirty.value = false
  formKey.value++
  editorOpen.value = true
}

async function requestClose() {
  if (create.isPending.value || update.isPending.value) return
  if (formDirty.value && !(await confirmLeave({ description: 'Tienes cambios sin guardar en la caja. Si sales ahora, se pierden.' }))) return
  editorOpen.value = false
  formDirty.value = false
}

const editorModel = computed({
  get: () => editorOpen.value,
  set: (value: boolean) => {
    if (value) editorOpen.value = true
    else void requestClose()
  },
})

async function save(draft: BoxDraft) {
  formErrors.value = {}
  formMessage.value = null
  const box = editing.value
  try {
    if (box) {
      const patch = boxPatch(box, draft)
      if (Object.keys(patch).length > 0) await update.mutateAsync({ boxId: box.id, patch })
    } else {
      await create.mutateAsync(draftToBoxBody(draft))
    }
    editorOpen.value = false
    formDirty.value = false
    toast.add({ title: box ? 'Caja guardada' : 'Caja creada', color: 'success' })
  } catch (err) {
    const mapped = mapBoxError(err, 'save')
    formErrors.value = mapped.fields
    formMessage.value = mapped.message
  }
}

async function setActive(box: ShippingBox, isActive: boolean) {
  actionMessage.value = null
  try {
    await update.mutateAsync({ boxId: box.id, patch: { isActive } })
    toast.add({
      title: isActive ? 'Caja reactivada' : 'Caja retirada',
      description: isActive ? 'Se vuelve a usar para cotizar envíos.' : 'Ya no se usa para cotizar envíos.',
      color: 'success',
    })
  } catch (err) {
    actionMessage.value = mapBoxError(err, isActive ? 'reactivate' : 'retire').message
  }
}

function onAction(action: BoxRowAction, box: ShippingBox) {
  if (!props.canUpdate || busy.value) return
  if (action === 'edit') openEditor(box)
  else if (action === 'retire') void setActive(box, false)
  else if (action === 'reactivate') void setActive(box, true)
  else {
    deleteMessage.value = null
    deleteTarget.value = box
  }
}

const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (value: boolean) => {
    if (!value && !remove.isPending.value) deleteTarget.value = null
  },
})
const deleteDescription = computed(() =>
  deleteMessage.value ?? 'Se elimina para siempre y no se puede deshacer. Si solo quieres dejar de usarla, retírala.',
)

async function confirmDelete() {
  const box = deleteTarget.value
  if (!box) return
  try {
    await remove.mutateAsync(box.id)
    deleteTarget.value = null
    toast.add({ title: 'Caja eliminada', color: 'success' })
  } catch (err) {
    deleteMessage.value = mapBoxError(err, 'delete').message
  }
}
</script>

<template>
  <section class="shipping-panel" aria-labelledby="shipping-boxes-title">
    <div class="shipping-panel__head">
      <h2 id="shipping-boxes-title" class="shipping-panel__title">Cajas</h2>
      <UButton
        v-if="canUpdate && boxes.length > 0"
        data-testid="create-box"
        class="hf-primary-control min-h-11"
        icon="i-lucide-plus"
        :disabled="busy"
        @click="openEditor(null)"
      >
        Crear caja
      </UButton>
    </div>

    <p v-if="actionMessage" role="alert" class="shipping-panel__alert">{{ actionMessage }}</p>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 overflow-hidden shadow-sm">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <ShippingBoxList
          :boxes="boxes"
          :loading="query.isLoading.value"
          :fetching="query.isFetching.value"
          :error="query.isError.value"
          :can-update="canUpdate"
          :disabled="busy"
          @action="onAction"
          @create="openEditor(null)"
          @refresh="query.refetch()"
        />
      </div>
    </UCard>

    <USlideover
      v-model:open="editorModel"
      :title="editing ? editing.name : 'Crear caja'"
      description="Medidas interiores en cm y pesos en kg."
      :dismissible="!busy"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay shipping-settings-portal' }"
    >
      <template #body>
        <p v-if="formMessage" role="alert" class="shipping-panel__alert">{{ formMessage }}</p>
        <ShippingBoxForm
          v-if="editorOpen"
          :key="formKey"
          :initial="initialDraft"
          :editing="editing !== null"
          :saving="create.isPending.value || update.isPending.value"
          :server-errors="formErrors"
          @save="save"
          @dirty="formDirty = $event"
        />
      </template>
    </USlideover>

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="deleteTarget ? `¿Eliminar la caja «${deleteTarget.name}»?` : '¿Eliminar la caja?'"
      :description="deleteDescription"
      confirm-label="Eliminar caja"
      confirm-color="error"
      :loading="remove.isPending.value"
      :ui="{ content: 'hf-theme hf-ui shipping-settings-portal' }"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.shipping-panel { display: grid; gap: 16px; min-width: 0; }
.shipping-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.shipping-panel__title { color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.shipping-panel__alert { border: 1px solid var(--hf-danger-border); border-radius: 6px; background: var(--hf-danger-soft); color: var(--hf-danger); padding: 12px 16px; font-size: 14px; }
</style>
