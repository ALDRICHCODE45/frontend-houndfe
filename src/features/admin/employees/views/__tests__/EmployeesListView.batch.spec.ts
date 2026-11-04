import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/admin/employees/views/EmployeesListView.vue'),
  'utf8',
)

describe('EmployeesListView batch operations', () => {
  it('defines independent CASL gates', () => {
    expect(source).toContain("userCan('batch_delete', 'Employee')")
    expect(source.match(/userCan\('update', 'Employee'\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('gates row selection to the batch permissions and drops the card view mode', () => {
    expect(source).toContain(':enable-row-selection="canUseBatchActions"')
    expect(source).toContain('v-model:row-selection="rowSelection"')
    expect(source).toContain(':bulk-actions="bulkActions"')
    expect(source).not.toContain('viewMode')
    expect(source).not.toContain('ViewToggle')
  })

  it('renders reusable select column slots', () => {
    expect(source).toContain('<template #select-header="{ table }">')
    expect(source).toContain('<SelectColumn :table="table" mode="header" />')
    expect(source).toContain('<template #select-cell="{ row }">')
    expect(source).toContain('<SelectColumn :row="row" mode="cell" />')
  })

  it('wires all three batch confirmation modals', () => {
    expect(source).toContain('<BatchTerminateModal')
    expect(source.match(/^\s*<ConfirmModal/gm)?.length).toBe(2)
    expect(source).toContain(':loading="isBatchPending"')
  })

  it('keeps per-row lifecycle dialogs', () => {
    expect(source).toContain('<TerminateEmployeeDialog')
    expect(source).toContain('<ReactivateEmployeeDialog')
  })
})
