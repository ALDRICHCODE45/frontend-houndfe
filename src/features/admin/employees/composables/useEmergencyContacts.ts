/**
 * useEmergencyContacts — WU-11
 *
 * Pure helpers + composables for the Contactos de emergencia section.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - sortContactsByCreatedAt(contacts)       — sorts contacts by createdAt asc (oldest first)
 *   - isPrimaryContact(contact, allContacts)  — true if contact is first by createdAt
 *   - buildContactDisplayEntry(contact, all)  — builds a display-ready entry with isPrimary
 *   - formatContactRelationship(rel)          — relationship as-is (free text, no mapping)
 *
 *   Composables (require Vue + TanStack Query context):
 *   - useEmergencyContacts(employeeId)        — query for emergency contacts list
 *   - useCreateEmergencyContact(employeeId)   — mutation to create a contact
 *   - useUpdateEmergencyContact(employeeId)   — mutation to update a contact
 *   - useDeleteEmergencyContact(employeeId)   — mutation to delete a contact
 *
 * Primary contact convention:
 *   Backend has no `isPrimary` field. Convention: first contact by createdAt asc
 *   (see backend doc §4.6, desviación #3). Implemented in isPrimaryContact().
 *
 * CASL gates:
 *   - Read requires can('read', 'EmployeeEmergencyContact')
 *   - Create requires can('create', 'EmployeeEmergencyContact')
 *   - Update requires can('update', 'EmployeeEmergencyContact')
 *   - Delete requires can('delete', 'EmployeeEmergencyContact')
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeEmergencyContactQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import type {
  EmergencyContact,
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
} from '../interfaces/employee.types'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Sort emergency contacts by createdAt ascending (oldest first).
 *
 * Convention: the first contact (index 0 after sort) is the primary contact.
 * Backend does not have an isPrimary field (§4.6, desviación #3).
 *
 * Returns a new array — does NOT mutate the input.
 *
 * PURE — deterministic.
 */
export function sortContactsByCreatedAt(contacts: EmergencyContact[]): EmergencyContact[] {
  return [...contacts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

/**
 * Check if a contact is the primary contact (first by createdAt asc).
 *
 * Determines primary by comparing contact.id against the id of the first
 * element in sortContactsByCreatedAt(allContacts).
 *
 * PURE — deterministic.
 */
export function isPrimaryContact(
  contact: EmergencyContact,
  allContacts: EmergencyContact[],
): boolean {
  const sorted = sortContactsByCreatedAt(allContacts)
  const first = sorted[0]
  return first !== undefined && first.id === contact.id
}

/**
 * Return the relationship string as-is.
 *
 * Relationship is free text (no backend enum), so no mapping is needed.
 * Exported to keep the display layer free of string logic.
 *
 * PURE — deterministic.
 */
export function formatContactRelationship(relationship: string): string {
  return relationship
}

export interface ContactDisplayEntry {
  id: string
  name: string
  relationship: string
  phone: string
  email: string | null
  /** True if this is the first contact by createdAt (primary) */
  isPrimary: boolean
}

/**
 * Build a display-ready contact entry with isPrimary computed.
 *
 * allContacts should be the UNSORTED raw list from the API — sorting is
 * handled internally to determine primary.
 *
 * PURE — deterministic.
 */
export function buildContactDisplayEntry(
  contact: EmergencyContact,
  allContacts: EmergencyContact[],
): ContactDisplayEntry {
  return {
    id: contact.id,
    name: contact.name,
    relationship: formatContactRelationship(contact.relationship),
    phone: contact.phone,
    email: contact.email,
    isPrimary: isPrimaryContact(contact, allContacts),
  }
}

// ─── Composables ──────────────────────────────────────────────────────────────

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * useEmergencyContacts — query composable for the emergency contacts list.
 *
 * Requires read:EmployeeEmergencyContact permission.
 * Returns unsorted raw array — use sortContactsByCreatedAt for display.
 * No pagination — the backend returns the full array (small N expected).
 */
export function useEmergencyContacts(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeEmergencyContactQueryKeys.list(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery<EmergencyContact[]>({
    queryKey,
    queryFn: () => employeesApi.getEmergencyContacts(toValue(employeeId)),
    enabled: isReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useCreateEmergencyContact — mutation composable to create a new emergency contact.
 *
 * On success: invalidates emergency contacts list.
 * Requires create:EmployeeEmergencyContact permission.
 */
export function useCreateEmergencyContact(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<EmergencyContact, Error, CreateEmergencyContactDto>({
    mutationFn: (dto: CreateEmergencyContactDto) =>
      employeesApi.createEmergencyContact(toValue(employeeId), dto),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeEmergencyContactQueryKeys.list(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Contacto de emergencia agregado', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo agregar el contacto',
        description: 'Verificá los datos e intentá de nuevo.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * useUpdateEmergencyContact — mutation composable to update an emergency contact.
 *
 * On success: invalidates emergency contacts list.
 * Requires update:EmployeeEmergencyContact permission.
 */
export function useUpdateEmergencyContact(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<
    EmergencyContact,
    Error,
    { contactId: string; dto: UpdateEmergencyContactDto }
  >({
    mutationFn: ({ contactId, dto }) =>
      employeesApi.updateEmergencyContact(toValue(employeeId), contactId, dto),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeEmergencyContactQueryKeys.list(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Contacto actualizado', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo actualizar el contacto',
        description: 'Verificá los datos e intentá de nuevo.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * useDeleteEmergencyContact — mutation composable to delete an emergency contact.
 *
 * On success: invalidates emergency contacts list.
 * Requires delete:EmployeeEmergencyContact permission.
 */
export function useDeleteEmergencyContact(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<void, Error, string>({
    mutationFn: (contactId: string) =>
      employeesApi.deleteEmergencyContact(toValue(employeeId), contactId),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeEmergencyContactQueryKeys.list(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Contacto eliminado', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo eliminar el contacto',
        description: 'Intentá de nuevo.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  }
}
