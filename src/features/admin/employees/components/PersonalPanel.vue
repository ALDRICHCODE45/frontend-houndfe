<script setup lang="ts">
/**
 * PersonalPanel — WU-06A
 *
 * Read-only personal data panel for the Employee Detail View — Personal tab.
 *
 * Displays:
 *   - Personal info section: nombre completo, documento de identidad, fecha de nacimiento, email, phone
 *   - Address section: street, exteriorNumber, interiorNumber, zipCode, neighborhood, municipality, city, state
 *
 * Design: card-based sections with edit pencil icon per Claude Design.
 * Clicking edit emits 'edit' event (reuses WU-05B slideover).
 */

import type { Employee } from '../interfaces/employee.types'

const props = defineProps<{
  employee: Employee
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
}>()

// ── Address composed string ────────────────────────────────────────────────────
function getFullAddress(e: Employee): string | null {
  const street = e.street ? `${e.street}${e.exteriorNumber ? ` ${e.exteriorNumber}` : ''}${e.interiorNumber ? ` Int. ${e.interiorNumber}` : ''}` : null
  const zone = [e.neighborhood, e.municipality, e.city, e.state].filter(Boolean).join(', ')
  const cp = e.zipCode ? `C.P. ${e.zipCode}` : null
  const parts = [street, zone, cp].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

// ── Identity document type labels ─────────────────────────────────────────────
const ID_TYPE_LABELS: Record<string, string> = {
  INE: 'INE / IFE',
  PASSPORT: 'Pasaporte',
  DRIVER_LICENSE: 'Licencia de conducir',
  MILITARY_ID: 'Cartilla militar',
  OTHER: 'Otro',
}

function getIdTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return ID_TYPE_LABELS[type] ?? type
}

// ── Date of birth formatter ───────────────────────────────────────────────────
function formatDob(dob: string | null | undefined): string {
  if (!dob) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dob))
  } catch {
    return dob
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Personal info section -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Section header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <h3 class="text-sm font-semibold text-highlighted">Información personal</h3>
        <UButton
          v-if="canUpdate"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Editar información personal"
          @click="emit('edit', employee)"
        />
      </div>

      <!-- Fields grid -->
      <div class="grid grid-cols-1 gap-0 sm:grid-cols-2">
        <!-- Nombre completo -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Nombre completo</p>
          <p class="mt-1 font-medium text-highlighted">{{ employee.fullName }}</p>
        </div>

        <!-- Email -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Email</p>
          <a
            v-if="employee.email"
            :href="`mailto:${employee.email}`"
            class="mt-1 block break-all font-medium text-default hover:text-primary hover:underline"
          >
            {{ employee.email }}
          </a>
          <p v-else class="mt-1 text-muted">—</p>
        </div>

        <!-- Teléfono -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Teléfono</p>
          <a
            v-if="employee.phone"
            :href="`tel:${employee.phone}`"
            class="mt-1 block font-medium text-default hover:text-primary"
          >
            {{ employee.phone }}
          </a>
          <p v-else class="mt-1 text-muted">—</p>
        </div>

        <!-- Fecha de nacimiento -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Fecha de nacimiento</p>
          <p class="mt-1 font-medium text-default">{{ formatDob(employee.dateOfBirth) }}</p>
        </div>

        <!-- Documento de identidad -->
        <div class="px-5 py-4 sm:border-r border-b sm:border-b-0">
          <p class="text-xs text-muted">Documento de identidad</p>
          <p v-if="employee.nationalId" class="mt-1 font-medium text-default">
            <span class="text-xs text-muted">{{ getIdTypeLabel(employee.nationalIdType) }} · </span>
            {{ employee.nationalId }}
          </p>
          <p v-else class="mt-1 text-muted">—</p>
        </div>

        <!-- Número de empleado -->
        <div class="px-5 py-4">
          <p class="text-xs text-muted">Número de empleado</p>
          <p class="mt-1 font-mono font-medium text-default">{{ employee.employeeNumber }}</p>
        </div>
      </div>
    </UCard>

    <!-- Address section -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Section header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <h3 class="text-sm font-semibold text-highlighted">Domicilio</h3>
        <UButton
          v-if="canUpdate"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Editar domicilio"
          @click="emit('edit', employee)"
        />
      </div>

      <div class="grid grid-cols-1 gap-0 sm:grid-cols-2">
        <!-- Calle y número -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Calle y número</p>
          <p class="mt-1 font-medium text-default">
            <template v-if="employee.street">
              {{ employee.street }}
              <template v-if="employee.exteriorNumber"> {{ employee.exteriorNumber }}</template>
              <template v-if="employee.interiorNumber"> Int. {{ employee.interiorNumber }}</template>
            </template>
            <template v-else>—</template>
          </p>
        </div>

        <!-- Código postal -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Código postal</p>
          <p class="mt-1 font-medium text-default">{{ employee.zipCode ?? '—' }}</p>
        </div>

        <!-- Colonia -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Colonia</p>
          <p class="mt-1 font-medium text-default">{{ employee.neighborhood ?? '—' }}</p>
        </div>

        <!-- Municipio / Alcaldía -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Municipio / Alcaldía</p>
          <p class="mt-1 font-medium text-default">{{ employee.municipality ?? '—' }}</p>
        </div>

        <!-- Ciudad -->
        <div class="px-5 py-4 sm:border-r border-b sm:border-b-0">
          <p class="text-xs text-muted">Ciudad</p>
          <p class="mt-1 font-medium text-default">{{ employee.city ?? '—' }}</p>
        </div>

        <!-- Estado -->
        <div class="px-5 py-4">
          <p class="text-xs text-muted">Estado</p>
          <p class="mt-1 font-medium text-default">{{ employee.state ?? '—' }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
