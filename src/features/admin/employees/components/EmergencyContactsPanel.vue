<script setup lang="ts">
/**
 * EmergencyContactsPanel — WU-11
 *
 * Emergency contacts section for the Employee Detail View.
 * Can be used inline in a panel or as a standalone section.
 *
 * Layout:
 *   - List of contacts: name, relationship, phone, email
 *   - First by createdAt asc is marked "Contacto principal" (no isPrimary field from backend)
 *   - "Agregar" button (gated by canCreate)
 *   - Edit / Delete per row (gated by canUpdate / canDelete)
 *   - Create and Edit share the same form modal
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

const { data: contacts, isLoading } = useEmergencyContacts(employeeId)
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
    formError.value = firstError?.message ?? 'Verificá los datos del formulario.'
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
    formError.value = 'Error al guardar el contacto. Intentá de nuevo.'
  }
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
  <div class="flex flex-col gap-4">

    <!-- Header row -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-highlighted">Contactos de emergencia</h3>
      <UButton
        v-if="canCreate"
        icon="i-lucide-user-plus"
        size="xs"
        variant="outline"
        @click="openCreate"
      >
        Agregar
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-col gap-3">
      <div v-for="n in 2" :key="n" class="h-16 animate-pulse rounded-lg bg-elevated" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="contactEntries.length === 0"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-default py-10 text-center"
    >
      <UIcon name="i-lucide-users" class="size-8 text-muted opacity-60" />
      <div>
        <p class="text-sm font-medium text-highlighted">Sin contactos de emergencia</p>
        <p class="text-xs text-muted">
          Agregá al menos un contacto en caso de emergencia.
        </p>
      </div>
    </div>

    <!-- Contact list -->
    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="entry in contactEntries"
        :key="entry.id"
        class="flex items-start justify-between gap-3 rounded-xl border border-default bg-elevated/30 p-4"
      >
        <div class="flex flex-col gap-1 min-w-0">
          <!-- Name + primary badge -->
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-highlighted truncate">{{ entry.name }}</span>
            <UBadge v-if="entry.isPrimary" color="primary" variant="subtle" size="xs">
              Principal
            </UBadge>
          </div>
          <!-- Relationship -->
          <span class="text-xs text-muted">{{ entry.relationship }}</span>
          <!-- Contact info -->
          <div class="flex flex-wrap items-center gap-3 mt-1">
            <a
              :href="`tel:${entry.phone}`"
              class="flex items-center gap-1 text-xs text-default hover:text-primary"
            >
              <UIcon name="i-lucide-phone" class="size-3.5 shrink-0" />
              {{ entry.phone }}
            </a>
            <a
              v-if="entry.email"
              :href="`mailto:${entry.email}`"
              class="flex items-center gap-1 text-xs text-default hover:text-primary"
            >
              <UIcon name="i-lucide-mail" class="size-3.5 shrink-0" />
              {{ entry.email }}
            </a>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            v-if="canUpdate"
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="`Editar ${entry.name}`"
            @click="openEdit(sortedContacts.find(c => c.id === entry.id)!)"
          />
          <UButton
            v-if="canDelete"
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            :loading="isDeleting && deletingContactId === entry.id"
            :aria-label="`Eliminar ${entry.name}`"
            @click="openDelete(sortedContacts.find(c => c.id === entry.id)!)"
          />
        </div>
      </li>
    </ul>

  </div>

  <!-- Create / Edit form modal -->
  <UModal
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
        <p v-if="formError" class="text-sm text-error">{{ formError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isFormOpen = false">
          Cancelar
        </UButton>
        <UButton
          :loading="editingContactId ? isUpdating : isCreating"
          @click="submitForm"
        >
          {{ editingContactId ? 'Guardar cambios' : 'Agregar' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete confirm modal -->
  <UModal v-model:open="isDeleteOpen" title="Eliminar contacto">
    <template #body>
      <p class="text-sm text-muted">
        ¿Estás seguro de que querés eliminar a
        <span class="font-semibold text-highlighted">{{ deletingContactName }}</span>
        de los contactos de emergencia?
      </p>
      <p class="mt-2 text-xs text-muted">Esta acción no se puede deshacer.</p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isDeleteOpen = false">
          Cancelar
        </UButton>
        <UButton color="error" :loading="isDeleting" @click="confirmDelete">
          Eliminar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
