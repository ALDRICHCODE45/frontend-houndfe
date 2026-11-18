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
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'

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
// A birth date is a calendar date: `new Date('1990-04-12')` is UTC midnight and
// reads one day early west of UTC, so the Y-M-D parts build a local date (T8 D8).
const DOB_FORMAT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })

function formatDob(dob: string | null | undefined): string {
  if (!dob) return '—'
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob)
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(dob)
  return Number.isNaN(date.getTime()) ? dob : DOB_FORMAT.format(date)
}
</script>

<template>
  <div class="employees-panel">
    <!-- Personal info section -->
    <HfSectionCard title="Información personal" :heading-level="2">
      <dl class="employees-dl">
        <div class="employees-dl__item">
          <dt>Nombre completo</dt>
          <dd>{{ employee.fullName }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Correo electrónico</dt>
          <dd>
            <a v-if="employee.email" :href="`mailto:${employee.email}`" class="employees-link break-all">
              {{ employee.email }}
            </a>
            <span v-else class="employees-dl__empty">—</span>
          </dd>
        </div>

        <div class="employees-dl__item">
          <dt>Teléfono</dt>
          <dd>
            <a v-if="employee.phone" :href="`tel:${employee.phone}`" class="employees-link">
              {{ employee.phone }}
            </a>
            <span v-else class="employees-dl__empty">—</span>
          </dd>
        </div>

        <div class="employees-dl__item">
          <dt>Fecha de nacimiento</dt>
          <dd>{{ formatDob(employee.dateOfBirth) }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Documento de identidad</dt>
          <dd v-if="employee.nationalId">
            <span class="text-[13px] font-normal text-muted">{{ getIdTypeLabel(employee.nationalIdType) }} · </span>
            {{ employee.nationalId }}
          </dd>
          <dd v-else class="employees-dl__empty">—</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Número de empleado</dt>
          <dd class="hf-figure">{{ employee.employeeNumber }}</dd>
        </div>
      </dl>
    </HfSectionCard>

    <!-- Address section -->
    <HfSectionCard title="Domicilio" :heading-level="2">
      <dl class="employees-dl">
        <div class="employees-dl__item">
          <dt>Calle y número</dt>
          <dd>
            <template v-if="employee.street">
              {{ employee.street }}
              <template v-if="employee.exteriorNumber"> {{ employee.exteriorNumber }}</template>
              <template v-if="employee.interiorNumber"> Int. {{ employee.interiorNumber }}</template>
            </template>
            <template v-else>—</template>
          </dd>
        </div>

        <div class="employees-dl__item">
          <dt>Código postal</dt>
          <dd>{{ employee.zipCode ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Colonia</dt>
          <dd>{{ employee.neighborhood ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Municipio / Alcaldía</dt>
          <dd>{{ employee.municipality ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Ciudad</dt>
          <dd>{{ employee.city ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Estado</dt>
          <dd>{{ employee.state ?? '—' }}</dd>
        </div>
      </dl>
    </HfSectionCard>
  </div>
</template>
