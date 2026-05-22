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

type TimelineEventType = 'SALE_REGISTERED' | 'PAYMENT_RECEIVED' | 'PRODUCTS_DELIVERED' | 'COMMENT'

const EVENT_COLORS: Readonly<Record<TimelineEventType, { text: string; bg: string }>> = {
  SALE_REGISTERED: { text: 'text-primary', bg: 'bg-primary/10' },
  PAYMENT_RECEIVED: { text: 'text-success', bg: 'bg-success/10' },
  PRODUCTS_DELIVERED: { text: 'text-info', bg: 'bg-info/10' },
  COMMENT: { text: 'text-muted', bg: 'bg-muted/10' },
} as const

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
  if (event.type === 'SALE_REGISTERED') return 'i-lucide-plus-circle'
  if (event.type === 'PAYMENT_RECEIVED') return 'i-lucide-circle-dollar-sign'
  if (event.type === 'PRODUCTS_DELIVERED') return 'i-lucide-shopping-cart'
  if (event.type === 'COMMENT') return 'i-lucide-message-circle'
  return 'i-lucide-circle'
}

function eventIconColor(event: SaleTimelineEvent): string {
  const colors = EVENT_COLORS[event.type] ?? { text: 'text-muted', bg: 'bg-muted/10' }
  return `${colors.text} ${colors.bg}`
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
    <template #header>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Historial</h3>
    </template>

    <div class="space-y-4">
      <div
        v-for="(event, index) in orderedTimeline"
        :key="event.type === 'COMMENT' ? event.commentId : `${event.type}-${event.at}`"
        data-testid="timeline-event"
        class="flex items-start gap-3 relative"
      >
        <!-- Vertical connector line (except for last event) -->
        <div
          v-if="index < orderedTimeline.length - 1"
          class="absolute left-5 top-10 bottom-0 w-px bg-gray-200"
        />
        
        <!-- Icon container -->
        <div 
          class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center relative"
          :data-testid="`timeline-event-icon-${event.type}`"
          :class="eventIconColor(event)"
        >
          <UIcon :name="eventIcon(event)" class="size-5" data-testid="timeline-icon" />
        </div>
        
        <div class="flex-1 min-w-0">
          <p class="font-medium">{{ eventLabel(event) }}</p>
          <div class="flex items-center justify-between">
            <p v-if="actorLabel(event)" class="text-sm text-muted" data-testid="timeline-actor">
              {{ actorLabel(event) }}
            </p>
            <UTooltip :text="formatSaleDate(event.at)">
              <p class="text-sm text-muted">{{ formatSaleDate(event.at) }}</p>
            </UTooltip>
          </div>
          
          <p v-if="event.type === 'COMMENT'" class="mt-2 text-sm" data-testid="timeline-comment-body">
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
            <UButton variant="link" color="neutral" size="xs" data-testid="comment-edit-trigger" @click="startEdit(event)">Editar</UButton>
            <UButton variant="link" color="neutral" size="xs" data-testid="comment-delete-trigger" @click="deleteCommentForEvent(event)">Eliminar</UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
