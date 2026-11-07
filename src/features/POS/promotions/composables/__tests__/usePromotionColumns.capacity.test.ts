import { describe, it, expect } from 'vitest'
import { usePromotionColumns } from '../usePromotionColumns'

describe('usePromotionColumns — capacity column', () => {
  it('exposes a non-sortable capacity column labelled "Cupo"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'capacity')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Cupo')
    expect(col!.enableSorting).toBe(false)
  })

  it('keeps the capacity column hideable so existing table preferences survive', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'capacity')
    expect(col!.enableHiding).not.toBe(false)
  })

  it('gives the capacity badge room by default («Quedan 400 unidades» does not spill into Inicio)', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'capacity')
    expect(col!.size).toBe(176)
  })
})
