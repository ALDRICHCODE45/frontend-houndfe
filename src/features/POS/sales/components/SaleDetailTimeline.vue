<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SaleTimelineEvent } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import { formatSaleDate } from '../utils/saleDate.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  timeline: SaleTimelineEvent[]
  currentUserId?: string | null
  isPending?: boolean
  onUpdateComment?: (commentId: string, payload: { body: string }) => Promise<unknown>
  onDeleteComment?: (commentId: string) => Promise<unknown>
}>()

const toast = useToast()
const editingCommentId = ref<string | null>(null)
const editingBody = ref('')

const isPending = computed(() => props.isPending ?? false)

const orderedTimeline = computed(() => [...props.timeline].sort((a, b) => b.at.localeCompare(a.at)))

function eventLabel(event: SaleTimelineEvent): string {
  if (event.type === 'SALE_REGISTERED') return 'Venta Registrada'
  if (event.type === 'PRODUCTS_DELIVERED') return 'Entrega de Productos'
  if (event.type === 'COMMENT') return 'Comentario'

  return `Cobro de ${formatCentsMXN(event.amountCents)} en ${formatPaymentMethod(event.method)}`
}

function actorLabel(event: SaleTimelineEvent): string | null {
  if (event.type === 'COMMENT') return event.actor.name
  return event.actor?.name ?? null
}

function eventIcon(event: SaleTimelineEvent): string {
  if (event.type === 'COMMENT') return 'i-lucide-message-circle'
  return 'i-lucide-circle'
}

function canManageComment(event: SaleTimelineEvent): boolean {
  if (event.type !== 'COMMENT') return false
  return event.actor.id === props.currentUserId
}

function startEdit(event: SaleTimelineEvent) {
  if (event.type !== 'COMMENT') return
  editingCommentId.value = event.commentId
  editingBody.value = event.body
}

function cancelEdit() {
  editingCommentId.value = null
  editingBody.value = ''
}

async function saveEdit(commentId: string) {
  if (!props.onUpdateComment) return
  try {
    await props.onUpdateComment(commentId, { body: editingBody.value })
    cancelEdit()
  } catch {
    toast.add({ title: 'Error', description: 'No se pudo actualizar el comentario', color: 'error' })
  }
}

async function saveEditForEvent(event: SaleTimelineEvent) {
  if (event.type !== 'COMMENT') return
  await saveEdit(event.commentId)
}

async function deleteComment(commentId: string) {
  if (!props.onDeleteComment) return
  try {
    await props.onDeleteComment(commentId)
  } catch {
    toast.add({ title: 'Error', description: 'No se pudo eliminar el comentario', color: 'error' })
  }
}

async function deleteCommentForEvent(event: SaleTimelineEvent) {
  if (event.type !== 'COMMENT') return
  await deleteComment(event.commentId)
}

</script>

<template>
  <UCard>
    <h3 class="mb-4 text-sm font-semibold">Timeline</h3>

    <div class="space-y-3">
      <div
        v-for="event in orderedTimeline"
        :key="event.type === 'COMMENT' ? event.commentId : `${event.type}-${event.at}`"
        data-testid="timeline-event"
        class="flex items-start gap-3"
      >
        <UIcon :name="eventIcon(event)" class="mt-1 size-4" data-testid="timeline-icon" />
        <div>
          <p class="text-sm font-medium">{{ eventLabel(event) }}</p>
          <p v-if="actorLabel(event)" class="text-xs text-muted" data-testid="timeline-actor">
            {{ actorLabel(event) }}
          </p>
          <p v-if="event.type === 'COMMENT'" class="text-sm" data-testid="timeline-comment-body">
            {{ event.body }}
          </p>
          <div
            v-if="event.type === 'COMMENT' && editingCommentId === event.commentId"
            class="mt-2 space-y-2"
            data-testid="comment-edit-form"
          >
            <UTextarea v-model="editingBody" data-testid="comment-edit-textarea" />
            <div class="flex gap-2">
              <UButton variant="ghost" size="xs" data-testid="comment-edit-cancel" @click="cancelEdit">Cancelar</UButton>
              <UButton size="xs" :disabled="isPending || editingBody.trim().length === 0" data-testid="comment-edit-save" @click="saveEditForEvent(event)">
                Guardar
              </UButton>
            </div>
          </div>
          <div v-else-if="canManageComment(event)" class="mt-1 flex gap-2">
            <UButton variant="ghost" size="xs" data-testid="comment-edit-trigger" @click="startEdit(event)">Editar</UButton>
            <UButton variant="ghost" size="xs" data-testid="comment-delete-trigger" @click="deleteCommentForEvent(event)">Eliminar</UButton>
          </div>
          <p class="text-xs text-muted">{{ formatSaleDate(event.at) }}</p>
        </div>
      </div>
    </div>
  </UCard>
</template>
