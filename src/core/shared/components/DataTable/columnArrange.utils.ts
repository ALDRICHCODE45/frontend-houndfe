import type { ColumnOrderState, ColumnPinningState } from '@tanstack/vue-table'
import { isLockedColumn } from './tableLayout'

/** Where a column sits on screen: pinned left, the scrolling centre, or pinned right. */
export type ColumnGroup = 'left' | 'center' | 'right'

export interface ColumnArrangement {
  order: ColumnOrderState
  pinning: ColumnPinningState
}

type IsVisible = (id: string) => boolean

export function columnGroup(id: string, pinning: ColumnPinningState): ColumnGroup {
  if (pinning.left?.includes(id)) return 'left'
  if (pinning.right?.includes(id)) return 'right'
  return 'center'
}

/** The visible columns the user can arrange in one group, in screen order (TanStack orders the centre
 * by `order` and each pinned side by its pinning list). */
export function groupMembers(group: ColumnGroup, { order, pinning }: ColumnArrangement, visible: IsVisible): string[] {
  const list = group === 'center' ? order.filter(id => columnGroup(id, pinning) === 'center') : (pinning[group] ?? [])
  return list.filter(id => visible(id) && !isLockedColumn(id))
}

/** The arrangeable visible columns left to right, the base of «posición N de M». */
export function screenOrder(arrangement: ColumnArrangement, visible: IsVisible): string[] {
  return (['left', 'center', 'right'] as const).flatMap(group => groupMembers(group, arrangement, visible))
}

/** The arrangement with `id` taken out of the order and both pinned sides. */
export function withoutColumn({ order, pinning }: ColumnArrangement, id: string): ColumnArrangement {
  const drop = (list: string[] = []) => list.filter(other => other !== id)
  return { order: drop(order), pinning: { left: drop(pinning.left), right: drop(pinning.right) } }
}

/**
 * Puts `id` at `index` among the visible arrangeable columns of `group` (counted without `id`),
 * pinning or unpinning it. Hidden columns keep their places; an empty side takes the column next
 * to its locked column.
 */
export function placeColumn(
  arrangement: ColumnArrangement,
  id: string,
  group: ColumnGroup,
  index: number,
  visible: IsVisible,
): ColumnArrangement {
  const base = withoutColumn(arrangement, id)
  const members = groupMembers(group, base, visible)
  const at = Math.max(0, Math.min(members.length, index))
  const before = members[at]
  const after = members[at - 1]
  const insert = (list: string[]) => {
    const position =
      before !== undefined
        ? list.indexOf(before)
        : after !== undefined
          ? list.indexOf(after) + 1
          : group === 'right'
            ? 0
            : list.length
    return [...list.slice(0, position), id, ...list.slice(position)]
  }
  if (group === 'center') return { order: insert(base.order), pinning: base.pinning }
  return {
    order: arrangement.order,
    pinning: { ...base.pinning, [group]: insert(base.pinning[group] ?? []) },
  }
}

/** One step left (-1) or right (+1) inside the column's group; `undefined` at the group's edge. */
export function moveColumn(
  arrangement: ColumnArrangement,
  id: string,
  delta: number,
  visible: IsVisible,
): ColumnArrangement | undefined {
  const group = columnGroup(id, arrangement.pinning)
  const members = groupMembers(group, arrangement, visible)
  const index = members.indexOf(id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= members.length) return undefined
  return placeColumn(arrangement, id, group, target, visible)
}
