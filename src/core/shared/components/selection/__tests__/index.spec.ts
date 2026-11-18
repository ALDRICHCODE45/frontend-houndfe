import { describe, expect, it } from 'vitest'
import * as selection from '../index'

describe('selection index', () => {
  it('exports the five selection primitives', () => {
    expect(Object.keys(selection).sort()).toEqual(
      ['HfRadioCards', 'HfRowMark', 'HfSelectableRows', 'HfSwitchRow', 'HfToggleChips'].sort(),
    )
  })
})
