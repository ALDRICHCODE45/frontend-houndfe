<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { promotionApi } from '../api/promotion.api'
import PromotionForm from '../components/PromotionForm.vue'
import type { PromotionFormState, PromotionType } from '../interfaces/promotion.types'
import {
  toCreatePayload,
  toUpdatePayload,
  mapApiErrorToFields,
  type FormFieldError,
} from '../composables/usePromotionForm'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const toast = useToast()

// ── Valid type guard ──────────────────────────────────────────────────────────

const VALID_PROMOTION_TYPES: PromotionType[] = [
  'PRODUCT_DISCOUNT',
  'ORDER_DISCOUNT',
  'BUY_X_GET_Y',
  'ADVANCED',
]

function isValidPromotionType(t: string): t is PromotionType {
  return VALID_PROMOTION_TYPES.includes(t as PromotionType)
}

// ── Mode detection ────────────────────────────────────────────────────────────

/** True when the route has a `:type` param (create), false when it has `:id` (edit) */
const promotionType = computed(() => {
  const t = route.params.type
  if (typeof t === 'string' && t.length > 0) {
    if (isValidPromotionType(t)) return t
    return 'INVALID' as const
  }
  return null
})

const promotionId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.length > 0 ? id : null
})

const isCreateMode = computed(() => promotionType.value !== null)

// ── CRITICAL 4: Invalid type route guard ──────────────────────────────────────

watch(
  () => promotionType.value,
  (type) => {
    if (type === 'INVALID') {
      toast.add({
        title: 'Tipo de promoción inválido',
        description: 'El tipo de promoción no es válido.',
        color: 'error',
      })
      void router.push('/pos/promociones')
    }
  },
  { immediate: true },
)

// ── Data fetching (edit mode) ─────────────────────────────────────────────────

const {
  data: promotionData,
  isLoading: isLoadingPromotion,
  isError: isQueryError,
} = useQuery({
  queryKey: computed(() => promotionQueryKeys.detail(promotionId.value ?? '')),
  queryFn: () => promotionApi.getById(promotionId.value!),
  enabled: computed(() => !isCreateMode.value && promotionId.value !== null),
  retry: false,
})

// ── CRITICAL 5: 404 handling — watch query error ──────────────────────────────

watch(
  () => isQueryError.value,
  (hasError) => {
    if (hasError && !isCreateMode.value) {
      toast.add({
        title: 'Promoción no encontrada',
        description: 'La promoción que buscás no existe o fue eliminada.',
        color: 'error',
      })
      void router.push('/pos/promociones')
    }
  },
)

// ── Field-level API error state ───────────────────────────────────────────────

/** Bound to UForm via PromotionForm's :errors prop */
const apiErrors = ref<FormFieldError[]>([])

function handleErrorsCleared() {
  apiErrors.value = []
}

function handleMutationError(error: AxiosError<DomainApiError>, context: 'crear' | 'actualizar') {
  const response = error.response?.data ?? {}
  const { fieldErrors, toastMessage } = mapApiErrorToFields({
    error: response.error,
    message: response.message as string | undefined,
  })
  apiErrors.value = fieldErrors
  if (toastMessage || fieldErrors.length === 0) {
    toast.add({
      title: `Error al ${context}`,
      description: toastMessage ?? 'Verificá los campos del formulario.',
      color: 'error',
    })
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const createMutation = useMutation({
  mutationFn: (state: PromotionFormState) => promotionApi.create(toCreatePayload(state)),
  onSuccess: async () => {
    toast.add({
      title: 'Promoción creada correctamente',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated() })
    await router.push('/pos/promociones')
  },
  onError: (error) => {
    handleMutationError(error as AxiosError<DomainApiError>, 'crear')
  },
})

const updateMutation = useMutation({
  mutationFn: (state: PromotionFormState) =>
    promotionApi.update(promotionId.value!, toUpdatePayload(state)),
  onSuccess: async () => {
    toast.add({
      title: 'Promoción actualizada correctamente',
      color: 'success',
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated() }),
      queryClient.invalidateQueries({
        queryKey: promotionQueryKeys.detail(promotionId.value!),
      }),
    ])
    await router.push('/pos/promociones')
  },
  onError: (error) => {
    handleMutationError(error as AxiosError<DomainApiError>, 'actualizar')
  },
})

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleCancel() {
  void router.push('/pos/promociones')
}

/** CRITICAL 3: Header button triggers form submit via the PromotionForm's internal submit */
function handleSubmit(state: PromotionFormState) {
  if (isCreateMode.value) {
    createMutation.mutate(state)
  } else {
    updateMutation.mutate(state)
  }
}

const isSubmitting = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

// ── Computed type for the form (create mode uses route param, edit uses fetched) ─

const formType = computed<PromotionType>(() => {
  if (isCreateMode.value) {
    const t = promotionType.value
    if (t && t !== 'INVALID') return t
    return 'PRODUCT_DISCOUNT'
  }
  return promotionData.value?.type ?? 'PRODUCT_DISCOUNT'
})
</script>

<template>
  <div class="-m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
    <!-- ── Header bar ────────────────────────────────────────────────────────── -->
    <div class="shrink-0 border-b border-default bg-default px-10 py-4">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between">
        <!-- Back + title -->
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            class="cursor-pointer"
            @click="handleCancel"
          />
          <h1 class="text-lg font-semibold">
            {{ isCreateMode ? 'Crear Promoción' : 'Editar Promoción' }}
          </h1>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-3">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            class="cursor-pointer"
            :disabled="isSubmitting"
            @click="handleCancel"
          />
          <!-- CRITICAL 3: Header submit button triggers UForm via form ID -->
          <UButton
            :label="isCreateMode ? 'Crear' : 'Guardar cambios'"
            :loading="isSubmitting"
            class="cursor-pointer"
            type="submit"
            form="promotion-detail-form"
          />
        </div>
      </div>
    </div>

    <!-- ── Content area ──────────────────────────────────────────────────────── -->
    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto px-10 pb-6 pt-6">
      <!-- Loading skeleton (edit mode while fetching) -->
      <div v-if="isLoadingPromotion" class="flex flex-col gap-4">
        <USkeleton class="h-32 w-full rounded-xl" />
        <USkeleton class="h-48 w-full rounded-xl" />
        <USkeleton class="h-32 w-full rounded-xl" />
      </div>

      <!-- Form -->
      <PromotionForm
        v-else
        form-id="promotion-detail-form"
        :type="formType"
        :mode="isCreateMode ? 'create' : 'edit'"
        :initial-data="promotionData ?? null"
        :loading="isSubmitting"
        :api-errors="apiErrors"
        @submit="handleSubmit"
        @cancel="handleCancel"
        @errors-cleared="handleErrorsCleared"
      />
    </div>
  </div>
</template>
