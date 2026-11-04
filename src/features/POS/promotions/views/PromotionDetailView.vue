<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { promotionApi } from '../api/promotion.api'
import PromotionForm from '../components/PromotionForm.vue'
import '../styles/promotions-visual.css'
import type { PromotionFormState, PromotionType } from '../interfaces/promotion.types'
import {
  toCreatePayload,
  toUpdatePayload,
  mapApiErrorToFields,
  type FormFieldError,
} from '../composables/usePromotionForm'
import {
  INVALID_PROMOTION_TYPE,
  PROMOTION_TYPE,
} from '../constants/promotion.constants'

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
const tenantId = useSafeTenantId()

// ── Valid type guard ──────────────────────────────────────────────────────────

const VALID_PROMOTION_TYPES: PromotionType[] = [
  PROMOTION_TYPE.PRODUCT_DISCOUNT,
  PROMOTION_TYPE.ORDER_DISCOUNT,
  PROMOTION_TYPE.BUY_X_GET_Y,
  PROMOTION_TYPE.ADVANCED,
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
    return INVALID_PROMOTION_TYPE
  }
  return null
})

const promotionId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.length > 0 ? id : null
})

const isCreateMode = computed(() => promotionType.value !== null)

// ── Invalid type route: shown in place as a not-found state ───────────────────

const isInvalidType = computed(() => promotionType.value === INVALID_PROMOTION_TYPE)

// ── Data fetching (edit mode) ─────────────────────────────────────────────────

const {
  data: promotionData,
  isLoading: isLoadingPromotion,
  isError: isQueryError,
  error: queryError,
  refetch: refetchPromotion,
} = useQuery({
  queryKey: computed(() => promotionQueryKeys.detail(tenantId.value, promotionId.value ?? '')),
  queryFn: () => promotionApi.getById(promotionId.value!),
  enabled: computed(() => !isCreateMode.value && promotionId.value !== null),
  retry: false,
})

// ── Not found vs failed request ───────────────────────────────────────────────
// A missing promotion (404) is an empty state with a way back; any other
// failure is the error state with Reintentar. Neither toasts nor redirects.

const isNotFound = computed(
  () =>
    isInvalidType.value ||
    (isQueryError.value &&
      !isCreateMode.value &&
      (queryError.value as { response?: { status?: number } } | null)?.response?.status === 404),
)

const isLoadError = computed(() => isQueryError.value && !isCreateMode.value && !isNotFound.value)

/** The form (and its save actions) only exist once there is something to edit. */
const showForm = computed(() => !isNotFound.value && !isLoadError.value && !isLoadingPromotion.value)

const notFoundTitle = computed(() =>
  isInvalidType.value ? 'No encontramos ese tipo de promoción' : 'No encontramos la promoción',
)

const headerTitle = computed(() => {
  if (isNotFound.value || isLoadError.value) return 'Promoción'
  return isCreateMode.value ? 'Nueva promoción' : 'Editar promoción'
})

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
      description: toastMessage ?? 'Verifica los campos del formulario.',
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
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
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
      queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) }),
      queryClient.invalidateQueries({
        queryKey: promotionQueryKeys.detail(tenantId.value, promotionId.value!),
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
    if (t && t !== INVALID_PROMOTION_TYPE) return t
    return PROMOTION_TYPE.PRODUCT_DISCOUNT
  }
  return promotionData.value?.type ?? PROMOTION_TYPE.PRODUCT_DISCOUNT
})
</script>

<template>
  <div
    class="hf-theme hf-ui promotions-workspace -m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]"
  >
    <!-- ── Header bar ────────────────────────────────────────────────────────── -->
    <div
      class="promotions-workspace-header shrink-0 border-b border-default bg-default px-4 py-4 md:px-10"
    >
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between">
        <!-- Back + title -->
        <div class="flex min-w-0 items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            class="cursor-pointer"
            aria-label="Volver a promociones"
            @click="handleCancel"
          />
          <h1 class="promotions-workspace-title min-w-0 text-lg font-semibold">
            {{ headerTitle }}
          </h1>
        </div>

        <!-- The one primary action; the back arrow leaves without saving.
             Below md it moves to the sticky bottom bar. -->
        <div
          v-if="showForm"
          class="hidden shrink-0 items-center gap-3 md:flex"
          data-testid="header-submit"
        >
          <!-- CRITICAL 3: Header submit button triggers UForm via form ID -->
          <UButton
            :label="isCreateMode ? 'Crear promoción' : 'Guardar cambios'"
            :loading="isSubmitting"
            class="cursor-pointer"
            type="submit"
            form="promotion-detail-form"
          />
        </div>
      </div>
    </div>

    <!-- ── Content area ──────────────────────────────────────────────────────── -->
    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-6 md:px-10">
      <!-- Loading skeleton (edit mode while fetching), shaped like the form -->
      <div
        v-if="isLoadingPromotion"
        class="grid grid-cols-1 gap-6 lg:grid-cols-3"
        aria-busy="true"
        data-testid="detail-loading"
      >
        <span class="sr-only">Cargando promoción…</span>
        <div class="flex flex-col gap-6 lg:col-span-2">
          <div class="promotions-skeleton-section" data-skeleton="section">
            <div class="promotions-skeleton-bar animate-pulse h-7 w-44 rounded-full" />
            <div class="promotions-skeleton-bar animate-pulse h-3.5 w-36" />
            <div class="promotions-skeleton-bar animate-pulse h-11 w-full" data-skeleton="field" />
            <div class="grid grid-cols-2 gap-3">
              <div class="promotions-skeleton-bar animate-pulse h-20 w-full" />
              <div class="promotions-skeleton-bar animate-pulse h-20 w-full" />
            </div>
          </div>
          <div class="promotions-skeleton-section" data-skeleton="section">
            <div class="promotions-skeleton-bar animate-pulse h-4 w-40" />
            <div class="promotions-skeleton-bar animate-pulse h-11 w-full" />
            <div class="promotions-skeleton-bar animate-pulse h-11 w-full" />
          </div>
          <div class="promotions-skeleton-section" data-skeleton="section">
            <div class="promotions-skeleton-bar animate-pulse h-4 w-32" />
            <div class="promotions-skeleton-bar animate-pulse h-9 w-full" />
          </div>
        </div>
        <div class="promotions-skeleton-section hidden lg:flex" data-skeleton="summary">
          <div class="promotions-skeleton-bar animate-pulse h-4 w-24" />
          <div class="promotions-skeleton-bar animate-pulse h-3.5 w-full" />
          <div class="promotions-skeleton-bar animate-pulse h-3.5 w-4/5" />
        </div>
      </div>

      <!-- Not found (404 or an unknown type): an empty state with a way back. -->
      <div v-else-if="isNotFound" data-testid="detail-not-found">
        <EmptyState
          :title="notFoundTitle"
          description="Pudo haberse eliminado o el enlace no es correcto."
          action-label="Volver a promociones"
          action-icon="i-lucide-arrow-left"
          action-test-id="detail-not-found-back"
          @action="handleCancel"
        />
      </div>

      <!-- Failed request: say what happened and offer Reintentar. -->
      <div v-else-if="isLoadError" data-testid="detail-error">
        <EmptyState
          kind="error"
          title="No se pudo cargar la promoción"
          description="Inténtalo de nuevo en un momento."
          action-label="Reintentar"
          action-test-id="detail-error-retry"
          @action="refetchPromotion()"
        />
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

    <!-- Mobile: the single primary lives in the sticky bottom bar. -->
    <div
      v-if="showForm"
      class="promotions-action-bar shrink-0 md:hidden"
      data-testid="mobile-action-bar"
    >
      <button
        type="submit"
        form="promotion-detail-form"
        class="promotions-bar-primary"
        :disabled="isSubmitting"
      >
        {{ isCreateMode ? 'Crear promoción' : 'Guardar cambios' }}
      </button>
    </div>
  </div>
</template>
