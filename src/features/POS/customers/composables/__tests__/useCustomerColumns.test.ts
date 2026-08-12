import { describe, expect, it } from 'vitest'
import { useCustomerColumns } from '../useCustomerColumns'

describe('useCustomerColumns', () => {
  const { columns } = useCustomerColumns()

  it('exposes the expected column order: select, fullName, email, phone, globalPriceListName, actions', () => {
    expect(columns.map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey)).toEqual([
      'select',
      'fullName',
      'email',
      'phone',
      'globalPriceListName',
      'actions',
    ])
  })

  it('locks email/phone/globalPriceListName as sortable with accessorKey', () => {
    const email = columns.find((c) => (c as { accessorKey?: string }).accessorKey === 'email')
    const phone = columns.find((c) => (c as { accessorKey?: string }).accessorKey === 'phone')
    const priceList = columns.find((c) => (c as { accessorKey?: string }).accessorKey === 'globalPriceListName')

    expect(email).toBeDefined()
    expect(phone).toBeDefined()
    expect(priceList).toBeDefined()
    // createSimpleHeader returns a function — string header means no wrapper.
    expect(typeof email?.header).toBe('string')
    expect(typeof phone?.header).toBe('string')
    expect(typeof priceList?.header).toBe('string')
  })

  it('keeps the actions column pinned right, non-sortable, and non-hideable', () => {
    const actions = columns.find((c) => c.id === 'actions')
    expect(actions).toBeDefined()
    expect(actions?.enableSorting).toBe(false)
    expect(actions?.enableHiding).toBe(false)
    // The view-level defaultPinning handles right-pinning; the column carries
    // the right-aligned cell styling.
    const tdClass = (actions as { meta?: { class?: { td?: string } } })?.meta?.class?.td
    expect(tdClass).toContain('text-right')
  })

  it('keeps the select column non-sortable and non-hideable', () => {
    const select = columns.find((c) => c.id === 'select')
    expect(select?.enableSorting).toBe(false)
    expect(select?.enableHiding).toBe(false)
  })
})
