/**
 * Clickable-row contract for tables and mobile cards.
 *
 * A whole row (or card) opens its primary target on click and on Enter, except
 * when the event comes from something interactive inside it (the ⋮ menu, a
 * link, a checkbox, an input...), which keeps its own behavior. The primary
 * cell should still hold a real button or link for assistive tech; the row
 * click is the pointer shortcut to the same target.
 */

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="combobox"]',
  '[data-row-ignore]',
].join(',')

/** True when `target` is, or sits inside, an interactive element below `boundary`. */
export function isInteractiveTarget(target: EventTarget | null, boundary: Element | null): boolean {
  if (!(target instanceof Element)) return false
  const interactive = target.closest(INTERACTIVE_SELECTOR)
  return interactive !== null && interactive !== boundary && (boundary?.contains(interactive) ?? true)
}

export interface ClickableRowOptions {
  /** Add `tabindex="0"` so the row itself takes focus. Turn off when the primary cell already holds a real button. */
  focusable?: boolean
}

export function useClickableRow<T>(open: (item: T) => void, options: ClickableRowOptions = {}) {
  const { focusable = true } = options

  function onClick(event: MouseEvent, item: T) {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    if (isInteractiveTarget(event.target, event.currentTarget as Element | null)) return
    if (window.getSelection()?.toString()) return
    open(item)
  }

  function onKeydown(event: KeyboardEvent, item: T) {
    if (event.defaultPrevented || event.key !== 'Enter') return
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    // Enter belongs to the focused child; only the row itself opens the target.
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    open(item)
  }

  /** Attributes to bind on the row element: `v-bind="rowProps(item)"`. */
  function rowProps(item: T) {
    return {
      class: 'hf-clickable-row',
      ...(focusable ? { tabindex: 0 } : {}),
      onClick: (event: MouseEvent) => onClick(event, item),
      onKeydown: (event: KeyboardEvent) => onKeydown(event, item),
    }
  }

  return { onClick, onKeydown, rowProps }
}
