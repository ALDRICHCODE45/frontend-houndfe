// Leftover scratch file from T3 debugging, repurposed as a pointer-drag test. The parent should
// rename it (e.g. AppDataTable.resizeDrag.spec.ts) or delete it; the agent may not remove files.
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppDataTable from '../AppDataTable.vue'

it('resizes a column by dragging its header edge and shows the width while dragging', async () => {
  const wrapper = mount(AppDataTable<{ name: string; status: string }>, {
    props: {
      columns: [
        { accessorKey: 'name', header: 'Nombre' },
        { accessorKey: 'status', header: 'Estado', size: 180 },
      ] as never,
      data: [{ name: 'a', status: 'b' }],
    },
    attachTo: document.body,
    global: { stubs: { DataTableToolbar: true, DataTablePagination: true, DataTableBulkActions: true } },
  })
  await nextTick()
  const handle = wrapper.get('[data-resize-handle][aria-label="Cambiar ancho de Estado"]')
  await handle.trigger('mousedown', { button: 0, clientX: 100 })
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 140 }))
  await nextTick()
  await nextTick()
  expect(wrapper.emitted('update:columnSizing')?.slice(-1)[0]?.[0]).toEqual({ status: 220 })
  expect(wrapper.get('[data-testid="table-resize-tip"]').text()).toBe('Estado · 220 px')
  document.dispatchEvent(new MouseEvent('mouseup', { clientX: 140 }))
  await nextTick()
  await nextTick()
  expect(wrapper.find('[data-testid="table-resize-tip"]').exists()).toBe(false)
  wrapper.unmount()
})
