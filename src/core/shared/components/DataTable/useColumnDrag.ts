import { onBeforeUnmount, ref } from 'vue'
import type { ColumnGroup } from './columnArrange.utils'

/** Where a dragged column would land: its group, its index there, and the drop line's x. */
export interface ColumnDropTarget {
  group: ColumnGroup
  index: number
  x: number
}

interface ColumnDragOptions {
  surface: () => HTMLElement | undefined
  canDrag: (id: string) => boolean
  labelOf: (id: string) => string
  /** Cells of the column, marked while it is dragged. */
  cellsOf: (id: string) => HTMLElement[]
  targetAt: (id: string, x: number) => ColumnDropTarget | undefined
  onDrop: (id: string, target: ColumnDropTarget) => void
  onCancel: (id: string) => void
}

/** A press only becomes a drag past this distance, so a click still sorts. */
const DRAG_THRESHOLD = 5
const SCROLL_EDGE = 48
const SCROLL_STEP = 16
const DRAGGING_CELL_CLASS = 'hf-col-dragging'
const DRAGGING_BODY_CLASS = 'hf-table-dragging'

interface Session {
  id: string
  pointerId: number | undefined
  x0: number
  y0: number
  active: boolean
  target?: ColumnDropTarget
  cells: HTMLElement[]
}

/**
 * Header drag reorder with pointer events (mouse and pen; touch does nothing): a ghost follows the
 * pointer, a drop line marks the gap, the surface scrolls near its edges and Esc cancels. The click
 * that ends a drag is swallowed so it does not sort.
 */
export function useColumnDrag(options: ColumnDragOptions) {
  const ghost = ref<{ label: string; x: number; y: number }>()
  const line = ref<{ x: number; top: number; height: number }>()
  let session: Session | undefined

  function onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0 || event.pointerType === 'touch' || !options.canDrag(id)) return
    finish()
    session = { id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, active: false, cells: [] }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeydown, true)
  }

  function begin(current: Session) {
    current.active = true
    current.cells = options.cellsOf(current.id)
    current.cells.forEach(cell => cell.classList.add(DRAGGING_CELL_CLASS))
    document.body.classList.add(DRAGGING_BODY_CLASS)
    window.getSelection?.()?.removeAllRanges()
  }

  function onMove(event: PointerEvent) {
    const current = session
    if (!current || event.pointerId !== current.pointerId) return
    if (!current.active) {
      if (Math.hypot(event.clientX - current.x0, event.clientY - current.y0) < DRAG_THRESHOLD) return
      begin(current)
    }
    ghost.value = { label: options.labelOf(current.id), x: event.clientX, y: event.clientY }
    const surface = options.surface()
    if (!surface) return
    const bounds = surface.getBoundingClientRect()
    if (event.clientX < bounds.left + SCROLL_EDGE) surface.scrollLeft -= SCROLL_STEP
    else if (event.clientX > bounds.right - SCROLL_EDGE) surface.scrollLeft += SCROLL_STEP
    current.target = options.targetAt(current.id, event.clientX)
    line.value = current.target ? { x: current.target.x, top: bounds.top, height: bounds.height } : undefined
  }

  function onUp(event: PointerEvent) {
    if (session && event.pointerId !== session.pointerId) return
    const ended = finish()
    if (!ended?.active) return
    swallowNextClick()
    if (ended.target) options.onDrop(ended.id, ended.target)
  }

  function onPointerCancel() {
    finish()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !session?.active) return
    event.preventDefault()
    event.stopPropagation()
    const ended = finish()
    if (ended) options.onCancel(ended.id)
  }

  function swallowNextClick() {
    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
  }

  function finish(): Session | undefined {
    const ended = session
    session = undefined
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeydown, true)
    ended?.cells.forEach(cell => cell.classList.remove(DRAGGING_CELL_CLASS))
    document.body.classList.remove(DRAGGING_BODY_CLASS)
    ghost.value = undefined
    line.value = undefined
    return ended
  }

  onBeforeUnmount(finish)

  return { ghost, line, onPointerDown }
}
