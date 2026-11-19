import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const view = readFileSync('src/features/POS/sales/views/SalesListView.vue', 'utf8')

describe('SalesListView — cells found in the live check', () => {
  it('lets «Cancelada» and «Plazo vencido» wrap inside the Pago cell instead of spilling', () => {
    expect(view).toMatch(/<template #paymentStatus-cell="\{ row \}">\s*<div class="sale-pay-cell"/)
    expect(view).toMatch(/\.sale-pay-cell \{[^}]*flex-wrap: wrap/)
    expect(view).not.toMatch(/\.sale-cancel-note \{[^}]*white-space: nowrap/)
  })

})
