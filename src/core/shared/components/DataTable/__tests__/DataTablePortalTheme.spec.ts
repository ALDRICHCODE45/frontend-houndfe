import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import DataTableToolbar from '../DataTableToolbar.vue'

const isMobile = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useBreakpoints: () => ({ smaller: () => isMobile }),
}))

const PortalStub = defineComponent({
  name: 'PortalProbe',
  props: ['ui', 'items', 'open'],
  template: '<div><slot /><slot name="content" /></div>',
})
const tableApi = {
  getAllColumns: () => [
    {
      id: 'name',
      columnDef: { header: 'Nombre' },
      getCanHide: () => true,
      getIsVisible: () => true,
      toggleVisibility: vi.fn(),
    },
  ],
}

function mountToolbar(portalClass?: string) {
  return mount(DataTableToolbar, {
    props: {
      globalFilter: '',
      showColumnVisibility: true,
      showRefresh: true,
      tableApi,
      ...(portalClass ? { portalClass } : {}),
    },
    slots: { filters: '<span>Existing filter</span>' },
    global: {
      stubs: {
        UTooltip: PortalStub,
        Tooltip: PortalStub,
        UDropdownMenu: PortalStub,
        DropdownMenu: PortalStub,
        USlideover: PortalStub,
        Slideover: PortalStub,
      },
    },
  })
}

describe('DataTable opt-in portal presentation', () => {
  beforeEach(() => {
    isMobile.value = false
  })

  for (const mobile of [false, true]) {
    it(`leaves existing portal classes unchanged (${mobile ? 'mobile' : 'desktop'})`, () => {
      isMobile.value = mobile
      const wrapper = mountToolbar()
      const portals = wrapper.findAllComponents(PortalStub)
      expect(portals.length).toBeGreaterThanOrEqual(2)
      for (const portal of portals) {
        expect(portal.props('ui')?.content).toBeUndefined()
      }
      wrapper.unmount()
    })

    it(`themes only explicitly opted-in portal content (${mobile ? 'mobile' : 'desktop'})`, () => {
      isMobile.value = mobile
      const wrapper = mountToolbar('hf-theme hf-ui')
      const portals = wrapper.findAllComponents(PortalStub)
      expect(portals.length).toBeGreaterThanOrEqual(2)
      for (const portal of portals) {
        expect(portal.props('ui')?.content).toBe('hf-theme hf-ui')
      }
      expect(wrapper.props('globalFilter')).toBe('')
      wrapper.unmount()
    })
  }

  it('forwards a separately opted-in pagination boundary without changing table models', () => {
    const PaginationProbe = defineComponent({
      props: ['portalClass', 'pageIndex', 'pageSize'],
      template: '<div />',
    })
    const wrapper = mount(AppDataTable, {
      props: {
        columns: [{ accessorKey: 'name', header: 'Nombre' }],
        data: [{ name: 'Juan' }],
        totalCount: 1,
        pagination: { pageIndex: 0, pageSize: 10 },
        paginationPortalClass: 'hf-theme hf-ui clients-list-portal',
      },
      global: { stubs: { DataTableToolbar: true, DataTablePagination: PaginationProbe, UTable: true, Table: true } },
    })
    const pagination = wrapper.getComponent(PaginationProbe)
    expect(pagination.props('portalClass')).toBe('hf-theme hf-ui clients-list-portal')
    expect(pagination.props('pageIndex')).toBe(0)
    expect(pagination.props('pageSize')).toBe(10)
    expect(wrapper.emitted('update:pagination')).toBeUndefined()
    wrapper.unmount()
  })

  it('does not extend the old toolbar portal opt-in to pagination', () => {
    const PaginationProbe = defineComponent({
      props: ['portalClass'],
      template: '<div />',
    })
    const wrapper = mount(AppDataTable, {
      props: {
        columns: [{ accessorKey: 'name', header: 'Nombre' }],
        data: [{ name: 'Juan' }],
        totalCount: 1,
        portalClass: 'existing-toolbar-theme',
      },
      global: { stubs: { DataTableToolbar: true, DataTablePagination: PaginationProbe, UTable: true, Table: true } },
    })
    expect(wrapper.getComponent(PaginationProbe).props('portalClass')).toBeUndefined()
    wrapper.unmount()
  })

  it('forwards the optional presentation class without changing table models', () => {
    const ToolbarProbe = defineComponent({
      props: ['portalClass', 'globalFilter'],
      template: '<div />',
    })
    const wrapper = mount(AppDataTable, {
      props: {
        columns: [{ accessorKey: 'name', header: 'Nombre' }],
        data: [],
        globalFilter: 'existing search',
        portalClass: 'hf-theme hf-ui',
      },
      global: { stubs: { DataTableToolbar: ToolbarProbe, UTable: true, Table: true } },
    })
    const toolbar = wrapper.getComponent(ToolbarProbe)
    expect(toolbar.props('portalClass')).toBe('hf-theme hf-ui')
    expect(toolbar.props('globalFilter')).toBe('existing search')
    expect(wrapper.emitted('update:globalFilter')).toBeUndefined()
    wrapper.unmount()
  })
})
