<script setup lang="ts">
/**
 * «Mascotas» of the customer card (handoff 27 §1–§3). Listing needs `read:Customer`; add, edit,
 * archive and restore need `update:Customer`; «Eliminar datos de la mascota» needs `delete:Customer`.
 */
import { computed, ref, watch } from 'vue'
import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import {
  usePetAccess,
  usePetMutations,
  usePetsList,
  type PetWriteOutcome,
  type PetEraseOutcome,
} from '../pets/usePets'
import { toCreatePetPayload, toUpdatePetPayload, type PetFormValues } from '../pets/petForm'
import type { Pet } from '../pets/pet.types'
import CustomerPetRow from './CustomerPetRow.vue'
import CustomerPetFormModal from './CustomerPetFormModal.vue'
import CustomerPetArchiveModal from './CustomerPetArchiveModal.vue'
import CustomerPetEraseModal from './CustomerPetEraseModal.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning'
  }) => void
}

const props = withDefaults(defineProps<{ customerId: string; activePetsCount?: number | null }>(), {
  activePetsCount: null,
})
const emit = defineEmits<{ 'update:activeCount': [count: number] }>()

const toast = useToast()
const { canRead, canUpdate, canDelete } = usePetAccess()
const showArchived = ref(false)
const active = usePetsList(() => props.customerId, 'ACTIVE')
const archived = usePetsList(() => props.customerId, 'ARCHIVED', showArchived)
const mutations = usePetMutations(() => props.customerId)
const pending = mutations.isPending

const activePets = computed(() => active.data.value ?? [])
const archivedPets = computed(() => archived.data.value ?? [])
const activeCount = computed(() => active.data.value?.length ?? props.activePetsCount ?? null)
watch(
  () => active.data.value?.length,
  (count) => {
    if (count !== undefined) emit('update:activeCount', count)
  },
)

const formOpen = ref(false)
const editingPet = ref<Pet | null>(null)
const formErrors = ref<Record<string, string>>({})
const archivingPet = ref<Pet | null>(null)
const erasingPet = ref<Pet | null>(null)

function actionsFor(pet: Pet): RowAction[] {
  const isActive = pet.status === 'ACTIVE'
  return [
    ...(canUpdate.value && isActive
      ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }]
      : []),
    ...(canUpdate.value && isActive
      ? [{ key: 'archive', label: 'Archivar…', icon: 'i-lucide-archive' }]
      : []),
    ...(canUpdate.value && !isActive
      ? [{ key: 'restore', label: 'Restaurar', icon: 'i-lucide-archive-restore' }]
      : []),
    ...(canDelete.value
      ? [
          {
            key: 'erase',
            label: 'Eliminar datos de la mascota…',
            icon: 'i-lucide-trash-2',
            destructive: true,
          },
        ]
      : []),
  ]
}

function openForm(pet: Pet | null) {
  if (!canUpdate.value) return
  editingPet.value = pet
  formErrors.value = {}
  formOpen.value = true
}

function closeDialogs() {
  formOpen.value = false
  archivingPet.value = null
  erasingPet.value = null
}

function handleAction(key: string, pet: Pet) {
  if (key === 'edit') openForm(pet)
  else if (key === 'archive') archivingPet.value = pet
  else if (key === 'restore') void restore(pet)
  else if (key === 'erase') erasingPet.value = pet
}

/** Success copy, the duplicate notice (the write still succeeded, §3.6) or the error copy. */
function report(outcome: PetWriteOutcome | PetEraseOutcome, success: string): boolean {
  if (outcome.status === 'ignored') return false
  if (outcome.status === 'failed') {
    const { error } = outcome
    if (formOpen.value && Object.keys(error.fields).length > 0) formErrors.value = error.fields
    else if (error.reload) closeDialogs()
    toast.add({ title: 'No se pudo completar', description: error.message, color: 'error' })
    return false
  }
  if (outcome.status === 'saved' && outcome.duplicateName) {
    toast.add({
      title: `Ya hay otra mascota llamada ${outcome.pet.name}`,
      description: 'Se guardó de todos modos.',
      color: 'warning',
    })
  } else {
    toast.add({ title: success, color: 'success' })
  }
  return true
}

async function submitForm(values: PetFormValues) {
  const pet = editingPet.value
  const outcome = pet
    ? await mutations.update(pet, toUpdatePetPayload(pet, values))
    : await mutations.create(toCreatePetPayload(values))
  if (report(outcome, pet ? 'Cambios guardados' : 'Mascota añadida')) formOpen.value = false
}

async function confirmArchive(reason: string) {
  if (!archivingPet.value) return
  if (report(await mutations.archive(archivingPet.value, reason), 'Mascota archivada'))
    archivingPet.value = null
}

async function restore(pet: Pet) {
  report(await mutations.restore(pet), 'Mascota restaurada')
}

async function confirmErase() {
  if (!erasingPet.value) return
  if (report(await mutations.erase(erasingPet.value), 'Datos de la mascota eliminados'))
    erasingPet.value = null
}

function archiveInstead() {
  archivingPet.value = erasingPet.value
  erasingPet.value = null
}
</script>

<template>
  <div v-if="canRead" class="flex flex-col gap-3" data-testid="customer-pets">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-(--hf-ink)">
        Activas<template v-if="activeCount !== null"> ({{ activeCount }})</template>
      </p>
      <UButton
        v-if="canUpdate"
        label="Añadir mascota"
        icon="i-lucide-plus"
        data-testid="pets-add"
        color="neutral"
        variant="outline"
        class="min-h-(--hf-control-height)"
        @click="openForm(null)"
      />
    </div>

    <p v-if="active.isLoading.value" class="text-sm text-(--hf-muted)">Cargando mascotas…</p>
    <p v-else-if="active.isError.value" class="text-sm text-(--hf-muted)">
      No se pudieron cargar las mascotas.
    </p>
    <p v-else-if="activePets.length === 0" class="text-sm text-(--hf-muted)">
      Sin mascotas registradas
    </p>
    <ul
      v-else
      class="overflow-hidden rounded-(--hf-radius-card) border border-(--hf-border) divide-y divide-(--hf-border)"
    >
      <CustomerPetRow
        v-for="pet in activePets"
        :key="pet.id"
        :pet="pet"
        :actions="actionsFor(pet)"
        @action="handleAction"
      />
    </ul>

    <button
      type="button"
      data-testid="pets-toggle-archived"
      class="flex min-h-(--hf-control-height) items-center gap-1 self-start rounded-(--hf-radius-control) text-sm font-medium text-(--hf-action) hover:underline"
      :aria-expanded="showArchived"
      @click="showArchived = !showArchived"
    >
      <UIcon
        :name="showArchived ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4"
        aria-hidden="true"
      />
      {{ showArchived ? 'Ocultar archivadas' : 'Ver archivadas' }}
    </button>

    <template v-if="showArchived">
      <p v-if="archived.isLoading.value" class="text-sm text-(--hf-muted)">Cargando archivadas…</p>
      <p v-else-if="archivedPets.length === 0" class="text-sm text-(--hf-muted)">
        Sin mascotas archivadas
      </p>
      <ul
        v-else
        class="overflow-hidden rounded-(--hf-radius-card) border border-(--hf-border) divide-y divide-(--hf-border)"
      >
        <CustomerPetRow
          v-for="pet in archivedPets"
          :key="pet.id"
          :pet="pet"
          :actions="actionsFor(pet)"
          @action="handleAction"
        />
      </ul>
    </template>

    <CustomerPetFormModal
      :open="formOpen"
      :pet="editingPet"
      :loading="pending"
      :errors="formErrors"
      @update:open="formOpen = $event"
      @submit="submitForm"
    />
    <CustomerPetArchiveModal
      :open="!!archivingPet"
      :pet="archivingPet"
      :loading="pending"
      @update:open="!$event && (archivingPet = null)"
      @confirm="confirmArchive"
    />
    <CustomerPetEraseModal
      :open="!!erasingPet"
      :pet="erasingPet"
      :loading="pending"
      :can-archive="canUpdate && erasingPet?.status === 'ACTIVE'"
      @update:open="!$event && (erasingPet = null)"
      @confirm="confirmErase"
      @archive-instead="archiveInstead"
    />
  </div>
</template>
