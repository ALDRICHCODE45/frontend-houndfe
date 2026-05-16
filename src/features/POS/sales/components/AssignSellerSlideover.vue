<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { usersApi } from '@/features/POS/users/api/user.api'
import { usersQueryKeys } from '@/core/shared/constants/query-keys'
import { useSellerAssignment } from '../composables/useSellerAssignment'
import { SellerAssignmentError } from '../interfaces/sale.types'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'error' | 'success' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  open: boolean
  saleId: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const toast = useToast()
const { assignSeller, isPending } = useSellerAssignment(() => props.saleId)

const searchInput = ref('')
const debouncedSearch = ref('')

watch(searchInput, (value) => {
  const timeout = setTimeout(() => {
    debouncedSearch.value = value.trim().toLowerCase()
  }, 200)

  return () => clearTimeout(timeout)
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      searchInput.value = ''
      debouncedSearch.value = ''
    }
  },
)

const usersQuery = useQuery({
  queryKey: usersQueryKeys.assignable(),
  queryFn: () => usersApi.listAssignable(),
  enabled: computed(() => props.open),
  staleTime: 30_000,
})

const users = computed<AssignableUser[]>(() => usersQuery.data.value ?? [])

const filteredUsers = computed(() => {
  const search = debouncedSearch.value
  if (!search) return users.value
  return users.value.filter((u) => u.name.toLowerCase().includes(search))
})

function resolveErrorMessage(error: unknown): string {
  const code = error instanceof SellerAssignmentError ? error.code : (error as { code?: string })?.code
  switch (code) {
    case 'SELLER_NOT_FOUND':
      return 'No se encontró el usuario. Recargá la lista.'
    case 'SELLER_NOT_ASSIGNABLE':
      return 'Ese usuario no se puede asignar como vendedor.'
    case 'SALE_NOT_FOUND':
      return 'La venta ya no existe.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tenés permisos para modificar esta venta.'
    default:
      return 'No se pudo asignar el vendedor.'
  }
}

async function handleSelectUser(user: AssignableUser) {
  try {
    await assignSeller(user.id)
    emit('update:open', false)
  } catch (error) {
    toast.add({
      title: 'Error',
      description: resolveErrorMessage(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <USlideover :open="open" side="right" inset @update:open="emit('update:open', $event)">
    <template #content>
      <div class="flex h-full flex-col" data-testid="assign-seller-slideover">
        <!-- Header -->
        <div class="border-b border-default px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-lg font-semibold">Asignar vendedor</p>
              <p class="text-sm text-muted">Seleccioná un usuario activo del equipo</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="emit('update:open', false)"
            />
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <UInput
            v-model="searchInput"
            data-testid="seller-search-input"
            icon="i-lucide-search"
            placeholder="Buscar por nombre"
            class="w-full"
          />

          <div v-if="usersQuery.isLoading.value" class="space-y-2">
            <USkeleton v-for="idx in 3" :key="idx" class="h-16 w-full" />
          </div>

          <div
            v-else-if="usersQuery.isError.value"
            class="rounded-md border border-error/50 p-4 text-sm text-error"
          >
            No se pudieron cargar los usuarios.
          </div>

          <div v-else-if="filteredUsers.length === 0" class="space-y-4">
            <div class="rounded-md border border-dashed border-default p-6 text-center">
              <UIcon name="i-lucide-users-x" class="mx-auto size-8 text-muted mb-2" />
              <p class="text-sm text-muted">
                {{ debouncedSearch ? 'No se encontraron usuarios' : 'No hay usuarios asignables' }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <UCard
              v-for="user in filteredUsers"
              :key="user.id"
              :data-testid="`seller-row-${user.id}`"
              class="cursor-pointer transition-colors hover:bg-elevated/70"
              :class="{ 'pointer-events-none opacity-60': isPending }"
              @click="handleSelectUser(user)"
            >
              <div class="flex items-center gap-3">
                <UAvatar :alt="user.name" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium truncate">{{ user.name }}</p>
                </div>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
