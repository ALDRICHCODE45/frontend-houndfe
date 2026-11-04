<script setup lang="ts">
/**
 * EmergencyContactsPanel — WU-11
 *
 * Emergency contacts section for the Employee Detail View.
 * Can be used inline in a panel or as a standalone section.
 *
 * Layout:
 *   - List of contacts: name, relationship (first by createdAt asc is the
 *     principal one — no isPrimary field from backend), phone, email
 *   - "Agregar" button (gated by canCreate)
 *   - ⋮ menu per row: Editar, Eliminar… last (gated by canUpdate / canDelete)
 *   - Create and Edit share the same form modal
 *   - Four states (S10): skeleton, error with Reintentar, empty, data
 *
 * CASL gates (EmployeeEmergencyContact subject):
 *   - canCreate: can('create', 'EmployeeEmergencyContact')
 *   - canUpdate: can('update', 'EmployeeEmergencyContact')
 *   - canDelete: can('delete', 'EmployeeEmergencyContact')
 *
 * Backend constraints (§4.6):
 *   - No pagination — full array returned
 *   - No isPrimary field — first by createdAt asc is primary (desviación #3)
 *   - name 1-120, relationship 1-60, phone 1-40, email optional
 *   - NEVER send tenantId
 */

import { computed, reactive, ref } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type { Employee, EmergencyContact } from '../interfaces/employee.types'
import { CreateEmergencyContactDtoSchema } from '../interfaces/employee.types'
import {
  useEmergencyContacts,
  useCreateEmergencyContact,
  useUpdateEmergencyContact,
  useDeleteEmergencyContact,
  sortContactsByCreatedAt,
  buildContactDisplayEntry,
} from '../composables/useEmergencyContacts'

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}>()

// ─── Queries & mutations ──────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const { data: contacts, isLoading, isError, refetch } = useEmergencyContacts(employeeId)
const { mutateAsync: createContact, isPending: isCreating } = useCreateEmergencyContact(employeeId)
const { mutateAsync: updateContact, isPending: isUpdating } = useUpdateEmergencyContact(employeeId)
const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteEmergencyContact(employeeId)

// ─── Derived — sorted contacts with isPrimary ─────────────────────────────────

const rawContacts = computed<EmergencyContact[]>(() => contacts.value ?? [])

const sortedContacts = computed(() => sortContactsByCreatedAt(rawContacts.value))

const contactEntries = computed(() =>
  sortedContacts.value.map((c) => buildContactDisplayEntry(c, rawContacts.value)),
)

// ─── Form state ───────────────────────────────────────────────────────────────

const isFormOpen = ref(false)
const editingContactId = ref<string | null>(null)

const form = reactive({
  name: '',
  relationship: '',
  phone: '',
  email: '',
})

const formError = ref<string | null>(null)

function openCreate(): void {
  editingContactId.value = null
  form.name = ''
  form.relationship = ''
  form.phone = ''
  form.email = ''
  formError.value = null
  isFormOpen.value = true
}

function openEdit(contact: EmergencyContact): void {
  editingContactId.value = contact.id
  form.name = contact.name
  form.relationship = contact.relationship
  form.phone = contact.phone
  form.email = contact.email ?? ''
  formError.value = null
  isFormOpen.value = true
}

async function submitForm(): Promise<void> {
  formError.value = null

  const parseResult = CreateEmergencyContactDtoSchema.safeParse({
    name: form.name,
    relationship: form.relationship,
    phone: form.phone,
    email: form.email || undefined,
  })

  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    formError.value = firstError?.message ?? 'Verifica los datos del formulario.'
    return
  }

  try {
    if (editingContactId.value) {
      await updateContact({ contactId: editingContactId.value, dto: parseResult.data })
    } else {
      await createContact(parseResult.data)
    }
    isFormOpen.value = false
  } catch {
    formError.value = 'Error al guardar el contacto. Intenta de nuevo.'
  }
}

// ─── Row menu ─────────────────────────────────────────────────────────────────

const rowActions = computed<RowAction[]>(() => [
  ...(props.canUpdate ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
  ...(props.canDelete
    ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
    : []),
])

function onRowAction(key: string, contactId: string): void {
  const contact = sortedContacts.value.find((c) => c.id === contactId)
  if (!contact) return
  if (key === 'edit') openEdit(contact)
  else if (key === 'delete') openDelete(contact)
}

// ─── Delete confirm state ─────────────────────────────────────────────────────

const isDeleteOpen = ref(false)
const deletingContactId = ref<string | null>(null)
const deletingContactName = ref('')

function openDelete(contact: EmergencyContact): void {
  deletingContactId.value = contact.id
  deletingContactName.value = contact.name
  isDeleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deletingContactId.value) return
  try {
    await deleteContact(deletingContactId.value)
    isDeleteOpen.value = false
    deletingContactId.value = null
  } catch {
    // error shown via toast from composable
  }
}
</script>

<template>
  <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
    <div class="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
      <h2 class="text-base font-semibold text-highlighted">Contactos de emergencia</h2>
      <UButton
        v-if="canCreate"
        icon="i-lucide-user-plus"
        size="sm"
        variant="outline"
        color="neutral"
        @click="openCreate"
      >
        Agregar
      </UButton>
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex flex-col gap-3 p-5"
      aria-busy="true"
      data-testid="contacts-skeleton"
    >
      <span class="sr-only">Cargando</span>
      <div v-for="n in 2" :key="n" class="h-14 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
    </div>

    <!-- Error -->
    <div v-else-if="isError" class="p-5" data-testid="contacts-error">
      <EmptyState
        kind="error"
        title="No se pudieron cargar los contactos"
        action-label="Reintentar"
        action-test-id="contacts-retry"
        @action="() => refetch()"
      />
    </div>

    <!-- Empty -->
    <div v-else-if="contactEntries.length === 0" class="p-5" data-testid="contacts-empty">
      <EmptyState
        title="Sin contactos de emergencia"
        description="Agrega al menos un contacto."
        icon="i-lucide-users"
      />
    </div>

    <!-- Contact list -->
    <ul v-else class="divide-y divide-default">
      <li
        v-for="entry in contactEntries"
        :key="entry.id"
        class="flex items-center justify-between gap-3 px-5 py-3"
        data-testid="contact-row"
      >
        <div class="min-w-0">
          <p class="hf-row-primary">{{ entry.name }}</p>
          <p class="hf-row-secondary">
            {{ entry.relationship }}<template v-if="entry.isPrimary"> · Principal</template>
          </p>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <a
              :href="`tel:${entry.phone}`"
              class="text-default underline decoration-(--hf-border) underline-offset-2 hover:text-primary"
            >
              {{ entry.phone }}
            </a>
            <a
              v-if="entry.email"
              :href="`mailto:${entry.email}`"
              class="break-all text-default underline decoration-(--hf-border) underline-offset-2 hover:text-primary"
            >
              {{ entry.email }}
            </a>
          </div>
        </div>

        <RowActionsMenu
          :actions="rowActions"
          :row-label="entry.name"
          portal-class="employees-form-portal"
          @select="onRowAction($event, entry.id)"
        />
      </li>
    </ul>
  </UCard>

  <!-- Create / Edit form modal -->
  <UModal :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    v-model:open="isFormOpen"
    :title="editingContactId ? 'Editar contacto' : 'Agregar contacto de emergencia'"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Nombre completo *">
          <UInput
            v-model="form.name"
            placeholder="María García"
            :maxlength="120"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Relación *">
          <UInput
            v-model="form.relationship"
            placeholder="Esposa, Padre, Hermano…"
            :maxlength="60"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Teléfono *">
          <UInput
            v-model="form.phone"
            type="tel"
            placeholder="+5215598765432"
            :maxlength="40"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Email (opcional)">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="contacto@ejemplo.com"
            class="w-full"
          />
        </UFormField>
        <p v-if="formError" class="text-sm text-(--hf-danger)" role="alert">{{ formError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          :loading="editingContactId ? isUpdating : isCreating"
          @click="submitForm"
        >
          {{ editingContactId ? 'Guardar cambios' : 'Agregar' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete confirmation -->
  <ConfirmModal
    v-model:open="isDeleteOpen"
    title="Eliminar contacto"
    :description="`Se eliminará a ${deletingContactName} de los contactos de emergencia. Esta acción no se puede deshacer.`"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="isDeleting"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    @confirm="confirmDelete"
  />
</template>
