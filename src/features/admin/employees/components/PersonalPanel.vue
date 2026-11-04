<script setup lang="ts">
/**
 * PersonalPanel — WU-06A
 *
 * Read-only personal data panel for the Employee Detail View — Personal tab.
 *
 * Displays:
 *   - Personal info section: nombre completo, email, teléfono, nacimiento, documento, número de empleado
 *   - Address section: street, exteriorNumber, interiorNumber, zipCode, neighborhood, municipality, city, state
 *
 * Editing lives in the detail header (one primary action per view), so the
 * sections carry no edit buttons of their own.
 */

import type { Employee } from '../interfaces/employee.types'

defineProps<{
  employee: Employee
}>()

// ── Identity document type labels ─────────────────────────────────────────────
const ID_TYPE_LABELS: Record<string, string> = {
  INE: 'INE',
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
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Información personal</h2>
      </div>

      <dl class="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        <div>
          <dt class="text-[13px] text-muted">Nombre completo</dt>
          <dd class="mt-1 font-medium text-highlighted">{{ employee.fullName }}</dd>
        </div>

        <div class="min-w-0">
          <dt class="text-[13px] text-muted">Correo electrónico</dt>
          <dd class="mt-1">
            <a
              v-if="employee.email"
              :href="`mailto:${employee.email}`"
              class="break-all font-medium text-default underline decoration-(--hf-border) underline-offset-2 hover:text-primary"
            >
              {{ employee.email }}
            </a>
            <span v-else class="text-muted">—</span>
          </dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Teléfono</dt>
          <dd class="mt-1">
            <a
              v-if="employee.phone"
              :href="`tel:${employee.phone}`"
              class="font-medium text-default underline decoration-(--hf-border) underline-offset-2 hover:text-primary"
            >
              {{ employee.phone }}
            </a>
            <span v-else class="text-muted">—</span>
          </dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Fecha de nacimiento</dt>
          <dd class="mt-1 font-medium text-default">{{ formatDob(employee.dateOfBirth) }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Documento de identidad</dt>
          <dd v-if="employee.nationalId" class="mt-1 font-medium text-default">
            <span class="text-[13px] font-normal text-muted">{{ getIdTypeLabel(employee.nationalIdType) }} · </span>
            {{ employee.nationalId }}
          </dd>
          <dd v-else class="mt-1 text-muted">—</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Número de empleado</dt>
          <dd class="hf-figure mt-1 font-medium text-default">{{ employee.employeeNumber }}</dd>
        </div>
      </dl>
    </UCard>

    <!-- Address section -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Domicilio</h2>
      </div>

      <dl class="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        <div>
          <dt class="text-[13px] text-muted">Calle y número</dt>
          <dd class="mt-1 font-medium text-default">
            <template v-if="employee.street">
              {{ employee.street }}
              <template v-if="employee.exteriorNumber"> {{ employee.exteriorNumber }}</template>
              <template v-if="employee.interiorNumber"> Int. {{ employee.interiorNumber }}</template>
            </template>
            <template v-else>—</template>
          </dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Código postal</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.zipCode ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Colonia</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.neighborhood ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Municipio / Alcaldía</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.municipality ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Ciudad</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.city ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Estado</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.state ?? '—' }}</dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
