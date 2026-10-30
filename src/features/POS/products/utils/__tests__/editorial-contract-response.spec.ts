import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type {
  EditorialArchivedWarning, EditorialStateResponse, EditorialVocabularyResponse,
} from '../../interfaces/editorial-contract-response.types'
import {
  decodeEditorialStateResponse as stateReader,
  decodeEditorialVocabularyResponse as vocabularyReader,
  isEditorialVocabularyRevision as revisionGuard,
} from '../editorial-contract-response'

const revision = `ev2-sha256-${'a0'.repeat(32)}`
const document = (): EditorialContractDocument => ({
  schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [],
  familyCode: null, values: [], facts: [],
})
const warning = (): EditorialArchivedWarning => ({
  code: 'ARCHIVED_OPTION', familyId: ' family ', definitionId: 'definition',
  owner: 'sellable', variantId: ' variant ', optionCode: ' option ',
})
const state = (): EditorialStateResponse => ({
  contractVersion: 2, vocabularyRevision: revision,
  state: {
    cycle: 4,
    draft: { revision: 3, basePublishedRevision: 1, document: document() },
    published: { revision: 2, document: document() }, warnings: [warning()],
  },
})
const vocabulary = (): EditorialVocabularyResponse => ({
  contractVersion: 2, vocabularyRevision: revision,
  vocabulary: {
    semanticsVersion: 'editorial-production-1', families: [],
    definitions: [{ id: 'id', code: 'custom', label: ' Label ', type: 'single',
      options: [{ code: 'a', label: 'A', archived: true, sortOrder: -1 }],
      groups: [], aliases: [],
    }],
  },
})
type RecordData = Record<string, unknown>
const record = (raw: unknown) => raw as RecordData
const at = (root: unknown, path: string[]): RecordData =>
  path.reduce<unknown>((value, key) => record(value)[key], root) as RecordData
const statePaths = [[], ['state'], ['state', 'draft'], ['state', 'published'], ['state', 'warnings', '0']]
const vocabularyPaths = [[], ['vocabulary']]

// Exercise the public readers, including every required slot and closed branch.
for (const [label, fixture, reader, paths] of [
  ['state', state, stateReader, statePaths],
  ['vocabulary', vocabulary, vocabularyReader, vocabularyPaths],
] as const) {
  describe(`${label} closed response`, () => {
    it('preserves valid input unchanged and detached', () => {
      const input = fixture()
      const before = structuredClone(input)
      const output = reader(input)
      expect(output).toEqual(before)
      expect(output).not.toBe(input)
      expect(input).toEqual(before)
    })
    for (const path of paths) {
      for (const key of Object.keys(at(fixture(), path)).filter(key => key !== 'warnings')) {
        it(`requires ${[...path, key].join('.')}`, () => {
          const input = fixture()
          delete at(input, path)[key]
          expect(reader(input)).toBeNull()
        })
      }
      it.each(['extra', 'mode', 'minimumContractVersion', 'attestation', 'evidence'])(
        `rejects extra %s at ${path.join('.') || 'root'}`, (key) => {
          const input = fixture()
          at(input, path)[key] = null
          expect(reader(input)).toBeNull()
        },
      )
    }
    it.each([null, [], 'raw', 2, true, undefined, { data: fixture() }])('rejects root %j', raw => {
      expect(reader(raw)).toBeNull()
    })
    it.each([1, '2', null, 3])('requires literal contractVersion 2: %j', value => {
      const input = fixture()
      record(input).contractVersion = value
      expect(reader(input)).toBeNull()
    })
    it('rejects malformed revision in the envelope', () => {
      const input = fixture()
      input.vocabularyRevision += '\n'
      expect(reader(input)).toBeNull()
    })
    it('does not execute a meaningful nested getter', () => {
      const input = fixture()
      const target = label === 'state'
        ? at(input, ['state', 'draft', 'document']) : at(input, ['vocabulary', 'definitions', '0'])
      let calls = 0
      Object.defineProperty(target, label === 'state' ? 'commercialTitle' : 'label', {
        enumerable: true, get() { calls++; return 'otherwise valid' },
      })
      expect(reader(input)).toBeNull()
      expect(calls).toBe(0)
    })
  })
}

describe('exact primitive vocabulary revision', () => {
  it.each(['0'.repeat(64), 'abcdef0123456789'.repeat(4)])('accepts lowercase hex %s', hex => {
    expect(revisionGuard(`ev2-sha256-${hex}`)).toBe(true)
  })
  it.each([
    null, undefined, 2, true, {}, [], new String(revision),
    revision.slice(0, -1), `${revision}0`, revision.replace('ev2', 'EV2'),
    revision.replace('sha256', 'SHA256'), revision.replace('a', 'A'),
    `ev2-sha256-${'g'.repeat(64)}`, `ev2-sha256-${'é'.repeat(64)}`,
    ` ${revision}`, `${revision} `, `\n${revision}`, `${revision}\n`, `${revision}\r\n`,
    `${revision}\t`, `${revision},${revision}`, '',
  ])('rejects without coercion %j', raw => expect(revisionGuard(raw)).toBe(false))
  it('never calls conversion hooks', () => {
    let calls = 0
    expect(revisionGuard({ toString() { calls++; return revision } })).toBe(false)
    expect(calls).toBe(0)
  })
})

describe('stored state branches, not fresh admission', () => {
  it.each(['draft', 'published'] as const)('accepts a lone %s slot with positive cycle', slot => {
    const input = state()
    input.state[slot === 'draft' ? 'published' : 'draft'] = null
    expect(stateReader(input)).toEqual(input)
  })
  it.each([null, [], 'state'])('rejects malformed state container %j', raw => {
    const input = state()
    record(input).state = raw
    expect(stateReader(input)).toBeNull()
  })
  it.each([null, {}, 'warnings', [null], [warning(), { ...warning(), extra: true }]])(
    'rejects malformed warnings as a whole %j', raw => {
      const input = state()
      record(input.state).warnings = raw
      expect(stateReader(input)).toBeNull()
    },
  )
  it.each([null, 1, 2147483647])('accepts cleared slots with cycle %j', cycle => {
    const input = state()
    input.state = { cycle, draft: null, published: null }
    expect(stateReader(input)).toEqual(input)
  })
  it.each(['draft', 'published'] as const)('null cycle forbids populated %s', slot => {
    const input = state()
    input.state.cycle = null
    input.state[slot === 'draft' ? 'published' : 'draft'] = null
    expect(stateReader(input)).toBeNull()
  })
  for (const path of [['cycle'], ['draft', 'revision'], ['draft', 'basePublishedRevision'], ['published', 'revision']]) {
    it.each([0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER, NaN, Infinity, '1', true])(
      `rejects non-storage counter ${path.join('.')} %j`, value => {
        const input = state()
        at(input.state, path.slice(0, -1))[path[path.length - 1]!] = value
        expect(stateReader(input)).toBeNull()
      },
    )
    it.each([1, 2147483647])(`accepts positive int32 ${path.join('.')} %j`, value => {
      const input = state()
      at(input.state, path.slice(0, -1))[path[path.length - 1]!] = value
      expect(stateReader(input)).toEqual(input)
    })
  }
  it.each(['draft', 'published'] as const)('requires nonnull %s revision', slot => {
    const input = state()
    record(input.state[slot]).revision = null
    expect(stateReader(input)).toBeNull()
  })
  it('allows historical and null draft bases independent of current published revision', () => {
    const input = state()
    expect(stateReader(input)).toEqual(input)
    input.state.draft!.basePublishedRevision = null
    expect(stateReader(input)).toEqual(input)
  })
  it.each(['draft', 'published'] as const)('rejects malformed direct %s document atomically', slot => {
    for (const raw of [null, { mode: 'raw', document: document() }, { values: [] },
      { ...document(), values: [{ code: 'x', owner: 'product', variantId: null, state: 'known' }] }]) {
      const input = state()
      record(input.state[slot]).document = raw
      expect(stateReader(input)).toBeNull()
    }
  })
  it('rejects old raw state without envelope', () => expect(stateReader(state().state)).toBeNull())
  it('retains semantically incomplete document content without fresh limits', () => {
    const input = state()
    input.state.draft!.document = {
      ...document(), commercialTitle: ' '.repeat(10000), familyCode: null,
      values: [{ code: 'inactive', owner: 'sellable', variantId: null, state: 'unknown', evidence: null }],
    }
    expect(stateReader(input)).toEqual(input)
  })
  it('preserves omitted versus present-empty warnings', () => {
    const input = state()
    delete input.state.warnings
    expect(stateReader(input)).toEqual(input)
    expect(Object.prototype.hasOwnProperty.call(stateReader(input)!.state, 'warnings')).toBe(false)
    input.state.warnings = []
    expect(stateReader(input)).toEqual(input)
  })
  it.each(['familyId', 'definitionId', 'optionCode'])('requires scalar nonblank warning %s', key => {
    for (const raw of ['', ' \n\t', '\ud800', null, 1]) {
      const input = state()
      record(input.state.warnings![0])[key] = raw
      expect(stateReader(input)).toBeNull()
    }
  })
  it.each([['code', 'OTHER'], ['owner', 'variant'], ['variantId', 1], ['variantId', '\udfff']])(
    'rejects warning %s=%j', (key, value) => {
      const input = state()
      record(input.state.warnings![0])[key as string] = value
      expect(stateReader(input)).toBeNull()
    },
  )
  it('preserves warning order, owners, nullable variants and deeply detached documents', () => {
    const input = state()
    input.state.warnings!.push({ ...warning(), owner: 'product', variantId: null, optionCode: 'second' })
    const before = structuredClone(input)
    const output = stateReader(input)!
    expect(output).toEqual(before)
    output.state.warnings![0]!.optionCode = 'changed'
    output.state.draft!.document.mediaRefs.push('changed')
    output.state.published!.document.values.push({
      code: 'x', owner: 'product', variantId: null, state: 'unknown', evidence: null,
    })
    expect(input).toEqual(before)
  })
})

describe('qualified vocabulary envelope', () => {
  it.each([null, [], { mode: 'raw', vocabulary: vocabulary().vocabulary }])(
    'rejects malformed vocabulary slot %j', raw => {
      const input = vocabulary()
      record(input).vocabulary = raw
      expect(vocabularyReader(input)).toBeNull()
    },
  )
  it('propagates qualification failure instead of pruning invalid metadata', () => {
    const input = vocabulary()
    input.vocabulary.definitions.push(structuredClone(input.vocabulary.definitions[0]!))
    expect(vocabularyReader(input)).toBeNull()
  })
  it('rejects malformed nested metadata', () => {
    const input = vocabulary()
    delete record(input.vocabulary.definitions[0]).label
    expect(vocabularyReader(input)).toBeNull()
  })
  it('retains and detaches qualified archived metadata', () => {
    const input = vocabulary()
    const before = structuredClone(input)
    const output = vocabularyReader(input)!
    expect(output).toEqual(input)
    output.vocabulary.definitions[0]!.label = 'changed'
    output.vocabulary.families.push({ id: 'x', code: 'x', label: 'x', bindings: [] })
    expect(input).toEqual(before)
  })
})
