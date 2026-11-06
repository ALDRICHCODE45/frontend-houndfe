import { describe, expect, it } from 'vitest'
import { navCountBadge, withNavBadges } from '../navBadges'

const items = [
  {
    label: 'POS',
    children: [
      { label: 'Ventas', to: '/pos/ventas' },
      { label: 'Reembolsos pendientes', to: '/pos/reembolsos' },
    ],
  },
]

describe('withNavBadges', () => {
  it('puts the count on the matching child', () => {
    const [pos] = withNavBadges(items, { '/pos/reembolsos': 4 })
    expect(pos!.children![1]!.badge).toEqual(navCountBadge(4))
    expect(pos!.children![0]!.badge).toBeUndefined()
  })

  it('hides the badge at 0', () => {
    const [pos] = withNavBadges(items, { '/pos/reembolsos': 0 })
    expect(pos!.children![1]!.badge).toBeUndefined()
    expect(pos!.badge).toBeUndefined()
  })

  it('puts the sum of its children counts on the group, so a closed group still shows it', () => {
    const group = [{ label: 'Sistema', children: [{ label: 'Envíos', to: '/a' }, { label: 'Validaciones', to: '/b' }, { label: 'Otra', to: '/c' }] }]
    const [sistema] = withNavBadges(group, { '/a': 2, '/b': 1 })
    expect(sistema!.badge).toEqual(navCountBadge(3))
    expect(sistema!.children![0]!.badge).toEqual(navCountBadge(2))
    expect(sistema!.children![1]!.badge).toEqual(navCountBadge(1))
  })

  it('caps a long count at 99+', () => {
    expect(navCountBadge(120)).toMatchObject({ label: '99+' })
  })
})
