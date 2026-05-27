<script setup lang="ts">
/**
 * ExpiringDocumentsView — WU-12B
 *
 * Tenant-wide dashboard showing all EmployeeDocument records expiring soon.
 *
 * Layout:
 *   - Page header with threshold selector (30 / 60 / 90 days)
 *   - Table: Employee ID, category badge, document title (notes), expiresAt, days remaining
 *   - Empty state: "Sin documentos próximos a vencer"
 *   - Loading skeleton
 *
 * Permission gate: read:EmployeeDocument (enforced at route level AND composable).
 *
 * Backend constraint (§4.4):
 *   GET /admin/employees-documents/expiring?daysUntilExpiry=N
 *   Route uses HYPHEN — NOT under /:employeeId.
 *   Default: 30 days. Returns array sorted by expiresAt asc.
 *   NEVER send tenantId.
 *
 * Design: warm orange primary, Nuxt UI 4 components only (UCard, UBadge, USelect, UTabs).
 */

import { computed, ref } from 'vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import {
  useExpiringDocuments,
  computeExpiringDocumentRow,
  formatDaysRemaining,
} from '../composables/useExpiringDocuments'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'

// ─── Threshold selector ────────────────────────────────────────────────────────

type ThresholdDays = 30 | 60 | 90

const thresholdOptions: { label: string; value: ThresholdDays }[] = [
  { label: 'Próximos 30 días', value: 30 },
  { label: 'Próximos 60 días', value: 60 },
  { label: 'Próximos 90 días', value: 90 },
]

const selectedThreshold = ref<ThresholdDays>(30)

// ─── Query ─────────────────────────────────────────────────────────────────────

const { data: expiringDocs, isLoading, isError } = useExpiringDocuments(
  computed(() => selectedThreshold.value),
)

// ─── Computed rows ─────────────────────────────────────────────────────────────

const rows = computed(() => {
  if (!expiringDocs.value) return []
  return expiringDocs.value.map((doc) => computeExpiringDocumentRow(doc))
})

// ─── Category badge color ──────────────────────────────────────────────────────

function getCategoryColor(
  category: string,
): 'primary' | 'warning' | 'error' | 'neutral' | 'success' {
  switch (category) {
    case 'CONTRACT':
    case 'NDA':
      return 'primary'
    case 'MEDICAL':
    case 'WARNING':
      return 'error'
    case 'EVALUATION':
    case 'CERTIFICATE':
      return 'success'
    default:
      return 'neutral'
  }
}

// ─── Days-remaining badge color ────────────────────────────────────────────────

function getDaysRemainingColor(days: number): 'error' | 'warning' | 'neutral' {
  if (days <= 7) return 'error'
  if (days <= 30) return 'warning'
  return 'neutral'
}

// ─── Category label ────────────────────────────────────────────────────────────

function getCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? category
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <AdminPageHeader
            title="Documentos por vencer"
            description="Documentos del personal próximos a su fecha de vencimiento"
          />

          <!-- Threshold selector -->
          <div class="flex shrink-0 items-center gap-2">
            <span class="text-sm text-muted">Mostrar:</span>
            <USelectMenu
              v-model="selectedThreshold"
              :options="thresholdOptions"
              value-attribute="value"
              option-attribute="label"
              size="sm"
              class="w-44"
            />
          </div>
        </div>
      </template>

      <div class="px-6 py-5">
        <!-- Loading state -->
        <div v-if="isLoading" class="flex flex-col gap-3">
          <USkeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
        </div>

        <!-- Error state -->
        <div v-else-if="isError" class="flex flex-col items-center gap-3 py-12 text-center">
          <UIcon name="i-lucide-alert-triangle" class="size-10 text-error" />
          <p class="text-sm text-muted">No se pudo cargar los documentos. Intentá de nuevo.</p>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="rows.length === 0"
          class="flex flex-col items-center gap-3 py-16 text-center"
        >
          <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-file-check-2" class="size-8 text-primary" />
          </div>
          <div>
            <p class="font-medium text-highlighted">Sin documentos próximos a vencer</p>
            <p class="mt-1 text-sm text-muted">
              No hay documentos que venzan en los próximos {{ selectedThreshold }} días.
            </p>
          </div>
        </div>

        <!-- Documents table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default">
                <th class="pb-3 pr-4 text-left font-medium text-muted">Documento</th>
                <th class="pb-3 pr-4 text-left font-medium text-muted">Categoría</th>
                <th class="pb-3 pr-4 text-left font-medium text-muted">Empleado ID</th>
                <th class="pb-3 pr-4 text-left font-medium text-muted">Fecha de vencimiento</th>
                <th class="pb-3 text-left font-medium text-muted">Tiempo restante</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in rows"
                :key="row.id"
                class="transition-colors hover:bg-elevated/50"
              >
                <!-- Document title (notes or category fallback) -->
                <td class="py-3.5 pr-4">
                  <p class="font-medium text-highlighted">{{ row.title }}</p>
                </td>

                <!-- Category badge -->
                <td class="py-3.5 pr-4">
                  <UBadge
                    :color="getCategoryColor(row.category)"
                    variant="subtle"
                    size="sm"
                  >
                    {{ getCategoryLabel(row.category) }}
                  </UBadge>
                </td>

                <!-- Employee ID -->
                <td class="py-3.5 pr-4">
                  <p class="font-mono text-xs text-muted">{{ row.employeeId }}</p>
                </td>

                <!-- Expiry date -->
                <td class="py-3.5 pr-4">
                  <p class="text-highlighted">{{ row.expiresAt ?? '—' }}</p>
                </td>

                <!-- Days remaining badge -->
                <td class="py-3.5">
                  <UBadge
                    :color="getDaysRemainingColor(row.daysRemaining)"
                    variant="soft"
                    size="sm"
                  >
                    {{ row.daysRemainingLabel }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Summary footer -->
          <div class="mt-4 border-t border-default pt-3">
            <p class="text-xs text-muted">
              {{ rows.length }} {{ rows.length === 1 ? 'documento' : 'documentos' }}
              próximos a vencer en los próximos {{ selectedThreshold }} días
            </p>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
